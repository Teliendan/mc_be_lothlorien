// Project loot semantics only: native condition evaluation and explosion decay
// need target-game acceptance. Fortune/Silk Touch native parity is unresolved.
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
        assert.equal(condition.item, "minecraft:shears");
        assert.equal(condition.enchantments, undefined, "no guessed enchantment policy");
        assert.ok([undefined, "not"].includes(condition.operator));
        const matches = tool?.item === condition.item;
        probability *= Number(condition.operator === "not" ? !matches : matches);
      }
    }
    for (const fn of entry.functions ?? []) {
      assert.ok(["set_count", "explosion_decay"].includes(fn.function));
      if (fn.function === "set_count") count = fn.count;
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
  // Enchanted-tool assertions protect the current limited implementation; they
  // do not establish that native Bedrock fern behaves identically.
  for (const tool of [undefined, {}, { item: "minecraft:stick" },
    { item: "minecraft:diamond_hoe" }, { item: "minecraft:diamond_axe", enchantments: { silk_touch: 1 } },
    ...[1, 2, 3].map((fortune) => ({ item: "minecraft:diamond_pickaxe", enchantments: { fortune } }))])
    assert.deepEqual(expectations(loot, tool), { [seed]: 0.125 }, "non-shears use the baseline seed pool; no fern self-drop");
}

function assertDecay(loot) {
  for (const pool of loot.pools) {
    const functions = pool.entries[0].functions;
    assert.equal(functions.filter((fn) => fn.function === "explosion_decay").length, 1);
    assert.equal(functions.at(-1).function, "explosion_decay", "native decay must process the final count");
    assert.deepEqual(functions[0], { function: "set_count", count: 1 });
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
broken.pools[1].conditions[1].chance = 0.25;
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
broken.pools[0].entries[0].functions.pop();
assert.throws(() => assertDecay(broken));

console.log("ok   golden fern harvest: shears exclusivity, baseline wheat seed chance, tool-less routes, decay order and generator");
