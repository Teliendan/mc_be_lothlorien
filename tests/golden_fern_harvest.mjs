// Project loot semantics only: native condition evaluation and explosion decay
// need target-game acceptance. Wiki-documented standard Fortune I-III is covered.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const table = JSON.parse(readFileSync(new URL("../lothlorien_bp/loot_tables/blocks/golden_fern.json", import.meta.url)));
const fern = "lothlorien:golden_fern", seed = "minecraft:wheat_seeds";

function expectations(loot, tool) {
  const result = {};
  for (const pool of loot.pools) {
    assert.equal(pool.rolls, 1);
    assert.equal(pool.entries.length, 1);
    const entry = pool.entries[0];
    assert.equal(entry.type, "item");
    let probability = 1, count = 1;
    for (const condition of [...(pool.conditions ?? []), ...(entry.conditions ?? [])]) {
      if (condition.condition === "random_chance") probability *= condition.chance;
      else {
        assert.equal(condition.condition, "match_tool");
        assert.ok([undefined, "not"].includes(condition.operator));
        let matches = tool !== undefined;
        if (condition.item) matches &&= tool?.item === condition.item;
        for (const enchantment of condition.enchantments ?? []) {
          const level = tool?.enchantments?.[enchantment.enchantment];
          matches &&= level !== undefined && level >= (enchantment.levels?.range_min ?? 0)
            && level <= (enchantment.levels?.range_max ?? Infinity);
        }
        probability *= Number(condition.operator === "not" ? !matches : matches);
      }
    }
    for (const fn of entry.functions ?? []) {
      assert.ok(["set_count", "explosion_decay"].includes(fn.function));
      if (fn.function === "set_count") count = typeof fn.count === "number"
        ? fn.count : (fn.count.min + fn.count.max) / 2;
    }
    if (probability) result[entry.name] = (result[entry.name] ?? 0) + probability * count;
  }
  return result;
}

function assertHarvest(loot) {
  for (const tool of [{ item: "minecraft:shears" },
    { item: "minecraft:shears", enchantments: { silk_touch: 1, fortune: 3 } }])
    assert.deepEqual(expectations(loot, tool), { [fern]: 1 }, "shears collect one fern and no seeds");
  // undefined covers native tool-less support/water/piston removal contexts.
  // Source-based expectations do not establish the engine's execution.
  for (const tool of [undefined, {}, { item: "minecraft:stick" },
    { item: "minecraft:diamond_hoe" }, { item: "minecraft:diamond_axe", enchantments: { silk_touch: 1 } }])
    assert.deepEqual(expectations(loot, tool), { [seed]: 0.125 }, "non-shears use the baseline seed pool; no fern self-drop");
  for (const fortune of [1, 2, 3])
    assert.deepEqual(expectations(loot, { item: "minecraft:diamond_hoe", enchantments: { fortune } }),
      { [seed]: 0.125 * (fortune + 1) }, "one-in-eight event, uniform 1..(2*Fortune+1) seed count");
  assert.deepEqual(loot.pools.map((p) => p.entries[0].functions[0].count),
    [1, 1, { min: 1, max: 3 }, { min: 1, max: 5 }, { min: 1, max: 7 }]);
}

function assertDecay(loot) {
  for (const pool of loot.pools) {
    const functions = pool.entries[0].functions;
    assert.equal(functions.filter((fn) => fn.function === "explosion_decay").length, 1);
    assert.equal(functions.at(-1).function, "explosion_decay", "native decay must process the final count");
    assert.equal(functions[0].function, "set_count");
  }
}

assertHarvest(table);
assertDecay(table);
const generated = JSON.parse(execFileSync("python", ["-B", "tools/golden_fern_loot.py", "--print-loot"], {
  cwd: new URL("../", import.meta.url), encoding: "utf8",
}));
assert.deepEqual(generated, table, "regeneration preserves the reviewed harvest recipe");

let broken = structuredClone(table);
broken.pools[1].conditions = broken.pools[1].conditions.filter((condition) => condition.condition === "random_chance");
assert.throws(() => assertHarvest(broken), "independent seed pool would award extra loot to shears");
broken = structuredClone(table);
delete broken.pools[1].conditions[0].operator;
assert.throws(() => assertHarvest(broken), "ordinary and tool-less routes must reach seed pool");
broken = structuredClone(table);
broken.pools[1].conditions.find((condition) => condition.condition === "random_chance").chance = 0.25;
assert.throws(() => assertHarvest(broken), "seed chance is one in eight");
broken = structuredClone(table);
broken.pools[1].entries[0].name = "lothlorien:western_corn_seeds";
assert.throws(() => assertHarvest(broken), "counterpart yields native wheat seeds");
broken = structuredClone(table);
broken.pools[0].entries[0].functions[0].count = 2;
assert.throws(() => assertHarvest(broken), "one fern per collected plant");
broken = structuredClone(table);
broken.pools[1].entries[0].functions.reverse();
assert.throws(() => assertDecay(broken));
broken = structuredClone(table);
delete broken.pools[2].conditions.find((condition) => condition.enchantments).enchantments[0].levels.range_max;
assert.throws(() => assertHarvest(broken), "Fortune I pool cannot overlap II and III");
broken = structuredClone(table);
broken.pools[4].entries[0].functions[0].count = { min: 1, max: 5 };
assert.throws(() => assertHarvest(broken), "Fortune III must use 1..7 seeds");
broken = structuredClone(table);
broken.pools[0].entries[0].functions.pop();
assert.throws(() => assertDecay(broken));

console.log("ok   golden fern harvest: shears exclusivity, baseline and Fortune I-III seed counts, tool-less routes, decay order and generator");
