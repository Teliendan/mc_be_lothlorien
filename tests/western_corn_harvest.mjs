// Exact distribution checks for our table, not a native loot engine emulator.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (name) => JSON.parse(readFileSync(new URL(`../lothlorien_bp/loot_tables/blocks/${name}.json`, import.meta.url)));
const seed = "lothlorien:western_corn_seeds", grain = "lothlorien:western_corn_grain";
const young = read("western_corn"), mature = read("western_corn_mature");

function distribution(loot, item, tool) {
  let pmf = [1];
  for (const pool of loot.pools) {
    assert.equal(pool.rolls, 1, "each seed trial is an independent pool");
    assert.equal(pool.entries.length, 1);
    const entry = pool.entries[0];
    assert.equal(entry.type, "item");
    assert.deepEqual(entry.functions, [
      { function: "set_count", count: 1 }, { function: "explosion_decay" },
    ], "native decay follows the final count");
    let probability = 1;
    for (const condition of pool.conditions ?? []) {
      if (condition.condition === "random_chance") probability *= condition.chance;
      else {
        assert.equal(condition.condition, "match_tool");
        assert.equal(condition.operator, undefined);
        assert.equal(condition.enchantments.length, 1);
        const enchantment = condition.enchantments[0];
        assert.equal(enchantment.enchantment, "fortune");
        const level = tool?.fortune;
        probability *= Number(level !== undefined && level >= enchantment.levels.range_min
          && level <= (enchantment.levels.range_max ?? Infinity));
      }
    }
    if (entry.name !== item || probability === 0) continue;
    const next = Array(pmf.length + 1).fill(0);
    pmf.forEach((p, n) => { next[n] += p * (1 - probability); next[n + 1] += p * probability; });
    pmf = next;
  }
  return pmf;
}

function expectedBinomial(trials) {
  let pmf = [1];
  for (let trial = 0; trial < trials; trial++) {
    const next = Array(pmf.length + 1).fill(0);
    pmf.forEach((p, n) => { next[n] += p * 7 / 15; next[n + 1] += p * 8 / 15; });
    pmf = next;
  }
  return pmf;
}

function close(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((p, n) => assert.ok(Math.abs(p - expected[n]) < 1e-12, `drop ${n}: ${p} != ${expected[n]}`));
}

function checkHarvest(youngTable, matureTable) {
  for (const tool of [undefined, {}, { silk_touch: 1 }, { fortune: 1 }, { fortune: 2 }, { fortune: 3 }]) {
    close(distribution(youngTable, seed, tool), [0, 1]);
    close(distribution(youngTable, grain, tool), [1]);
    close(distribution(matureTable, grain, tool), [0, 1]);
    close(distribution(matureTable, seed, tool), expectedBinomial(3 + (tool?.fortune ?? 0)));
  }
  assert.deepEqual([...new Set(matureTable.pools.map((p) => p.entries[0].name))].sort(), [grain, seed].sort());
  const block = readFileSync(new URL("../lothlorien_bp/blocks/western_corn.json", import.meta.url), "utf8");
  const body = JSON.parse(block)["minecraft:block"];
  assert.equal(body.components["minecraft:loot"], "loot_tables/blocks/western_corn.json");
  const matureRoute = body.permutations.filter((p) => p.components["minecraft:loot"]);
  assert.equal(matureRoute.length, 1);
  assert.match(matureRoute[0].condition, /growth'\) == 7$/);
  assert.equal(matureRoute[0].components["minecraft:loot"], "loot_tables/blocks/western_corn_mature.json");
}

checkHarvest(young, mature);
const generated = JSON.parse(execFileSync("python", ["-B", "tools/western_corn_loot.py", "--print-loot"], {
  cwd: new URL("../", import.meta.url), encoding: "utf8",
}));
assert.deepEqual(generated, { young, mature }, "generator preserves both reviewed recipes");

let broken = structuredClone(mature);
broken.pools[1].conditions[0].chance = 4 / 7;
assert.throws(() => checkHarvest(young, broken), "Java seed probability must not replace Bedrock");
broken = structuredClone(mature);
broken.pools[1].rolls = 3;
assert.throws(() => checkHarvest(young, broken), "pool condition cannot represent independent rolls");
broken = structuredClone(mature);
broken.pools[0].entries[0].functions[0].count = { min: 1, max: 2 };
assert.throws(() => checkHarvest(young, broken), "wheat counterpart has exactly one grain");
broken = structuredClone(mature);
broken.pools[4].conditions[0].enchantments[0].levels.range_max = 1;
assert.throws(() => checkHarvest(young, broken), "each Fortune level adds rather than replaces a trial");
broken = structuredClone(young);
broken.pools[0].entries[0].functions.pop();
assert.throws(() => checkHarvest(broken, mature), "young crop also needs native explosion decay");
console.log("ok   Western corn harvest: exact Bedrock wheat seed distributions, fixed grain, young crop, decay and generator");
