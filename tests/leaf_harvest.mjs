// Project harvest semantics, not an engine emulator. Only the predicates used by
// these tables are evaluated; native explosion decay is checked structurally.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const readLoot = (name) => JSON.parse(readFileSync(new URL(`../lothlorien_bp/loot_tables/blocks/${name}.json`, import.meta.url)));
const leaf = "lothlorien:mallorn_leaves", acorn = "lothlorien:mallorn_acorn", stick = "minecraft:stick";
const shears = { item: "minecraft:shears" };
const silkHoe = { item: "minecraft:diamond_hoe", enchantments: { silk_touch: 1 } };

function conditionProbability(condition, tool) {
  let result;
  if (condition.condition === "random_chance") {
    assert.equal(condition.operator, undefined);
    return condition.chance;
  }
  assert.equal(condition.condition, "match_tool", "unexpected condition needs a deliberate test evaluator update");
  result = tool !== undefined;
  if (condition.item !== undefined) result &&= tool?.item === condition.item;
  for (const enchantment of condition.enchantments ?? []) {
    // Absence is not an enchantment at level zero. This catches the old trap.
    const level = tool?.enchantments?.[enchantment.enchantment];
    result &&= level !== undefined && level >= (enchantment.levels?.range_min ?? 0)
      && level <= (enchantment.levels?.range_max ?? Infinity);
  }
  assert.ok([undefined, "not", "!=", "==", "equals"].includes(condition.operator));
  return condition.operator === "not" || condition.operator === "!=" ? Number(!result) : Number(result);
}

function dropExpectations(table, tool) {
  const result = new Map();
  for (const pool of table.pools) {
    assert.equal(pool.rolls, 1);
    assert.equal(pool.entries.length, 1, "these leaf pools deliberately have no weighted alternatives");
    const entry = pool.entries[0];
    const probability = [...(pool.conditions ?? []), ...(entry.conditions ?? [])]
      .reduce((value, condition) => value * conditionProbability(condition, tool), 1);
    let count = 1;
    for (const fn of entry.functions ?? []) {
      assert.ok(["set_count", "explosion_decay"].includes(fn.function));
      if (fn.function === "set_count") count = typeof fn.count === "number" ? fn.count : (fn.count.min + fn.count.max) / 2;
    }
    result.set(entry.name, (result.get(entry.name) ?? 0) + probability * count);
  }
  return Object.fromEntries([...result].filter(([, expected]) => expected !== 0));
}

function assertHarvest(table) {
  for (const tool of [shears, silkHoe, { item: "minecraft:stick", enchantments: { silk_touch: 1 } },
    { ...shears, enchantments: { silk_touch: 1, fortune: 3 } },
    ...[1, 2, 3, 4].map((fortune) => ({ ...shears, enchantments: { fortune } })),
    { ...silkHoe, enchantments: { silk_touch: 1, fortune: 3 } }]) {
    assert.deepEqual(dropExpectations(table, tool), { [leaf]: 1 }, "shears/Silk Touch collect exactly one leaf, with no auxiliaries");
  }
  const stickChances = [1/50, 1/45, 1/40, 1/30, 1/10];
  const acornChances = [1/50, 1/40, 1/30, 1/25];
  for (const tool of [undefined, {}, { item: "minecraft:iron_sword" }, { item: "minecraft:diamond_hoe" },
    ...[0, 1, 2, 3, 4, 7].map((fortune) => ({ item: "minecraft:diamond_hoe", enchantments: { fortune } })),
    { item: "minecraft:diamond_axe", enchantments: { fortune: 2 } }]) {
    const drops = dropExpectations(table, tool);
    const level = tool?.enchantments?.fortune ?? 0;
    assert.equal(drops[leaf], undefined, "hand/ordinary tool/decay cannot collect the leaf block");
    assert.ok(Math.abs(drops[stick] - 1.5 * stickChances[Math.min(level, 4)]) < 1e-12,
      "Wiki stick chance times uniform 1..2 count, exactly one Fortune branch");
    assert.ok(Math.abs(drops[acorn] - acornChances[Math.min(level, 3)]) < 1e-12,
      "custom 2% acorn base scaled by oak-sapling Fortune boosts, exactly one branch");
  }
}

function assertExplosionFunctions(table) {
  for (const pool of table.pools) {
    const functions = pool.entries[0].functions ?? [];
    assert.equal(functions.filter((fn) => fn.function === "explosion_decay").length, 1);
    assert.equal(functions.at(-1).function, "explosion_decay", "decay processes the final set_count stack");
  }
  for (const pool of table.pools.filter((pool) => pool.entries[0].name === stick))
    assert.deepEqual(pool.entries[0].functions[0], { function: "set_count", count: { min: 1, max: 2 } });
}

const table = readLoot("mallorn_leaves");
assertHarvest(table);
assertExplosionFunctions(table);
const generated = JSON.parse(execFileSync("python", ["-B", "tools/make_mallorn_leaves.py", "--print-loot"], {
  cwd: new URL("../", import.meta.url), encoding: "utf8",
}));
assert.deepEqual(generated, table, "explicit leaf generator mode preserves the reviewed harvest table");

// Prove the semantic assertions reject meaningful regressions, including the
// old independent auxiliary pools and duplicate self drops on enchanted shears.
let broken = structuredClone(table);
for (const pool of broken.pools.filter((pool) => [stick, acorn].includes(pool.entries[0].name)))
  pool.conditions = pool.conditions.filter((condition) => condition.condition === "random_chance");
assert.throws(() => assertHarvest(broken));
broken = structuredClone(table);
broken.pools[1].conditions = broken.pools[1].conditions.filter((condition) => condition.item !== "minecraft:shears");
assert.throws(() => assertHarvest(broken));
broken = structuredClone(table);
broken.pools[1].conditions[0].enchantments[0].levels.range_min = 2;
assert.throws(() => assertHarvest(broken));
broken = structuredClone(table);
const wrongAbsence = broken.pools[2].conditions.find((condition) => condition.enchantments);
delete wrongAbsence.operator;
wrongAbsence.enchantments[0].levels = { range_min: 0, range_max: 0 };
assert.throws(() => assertHarvest(broken), "absent enchantment must not be tested as level zero");
broken = structuredClone(table);
broken.pools.find((pool) => pool.entries[0].name === stick).conditions.at(-1).chance = 0.05;
assert.throws(() => assertHarvest(broken));
broken = structuredClone(table);
broken.pools[2].entries[0].functions.reverse();
assert.throws(() => assertExplosionFunctions(broken));
broken = structuredClone(table);
broken.pools.find((pool) => pool.entries[0].name === acorn).entries[0].functions = [];
assert.throws(() => assertExplosionFunctions(broken));
broken = structuredClone(table);
const acornPools = broken.pools.filter((pool) => pool.entries[0].name === acorn);
acornPools[1].conditions.find((condition) => condition.enchantments?.[0].enchantment === "fortune")
  .enchantments[0].levels.range_min = 2;
assert.throws(() => assertHarvest(broken), "Fortune I cannot disappear or overlap Fortune II");
broken = structuredClone(table);
const fortuneThree = broken.pools.filter((pool) => pool.entries[0].name === acorn).at(-1);
fortuneThree.conditions.at(-1).chance = 0.10;
assert.throws(() => assertHarvest(broken), "custom acorns must stay rarer than oak saplings at Fortune III");
broken = structuredClone(table);
const extraBase = structuredClone(broken.pools.find((pool) => pool.entries[0].name === acorn));
broken.pools.push(extraBase);
assert.throws(() => assertHarvest(broken), "duplicate auxiliary pools must not stack");

// Owner exceptions are part of the contract, not collateral vanilla changes.
const golden = readLoot("mallorn_golden_leaves");
const nectar = readLoot("nectar_bloom");
assert.deepEqual(dropExpectations(nectar, shears), { "lothlorien:nectar_bloom": 1 });
for (const tool of [undefined, {}, silkHoe]) assert.deepEqual(dropExpectations(nectar, tool), {});
for (const tool of [undefined, {}, shears, silkHoe])
  assert.deepEqual(dropExpectations(golden, tool), { "lothlorien:mallorn_golden_leaves": 1 });
// Owner 2026-10-10: reusable jar and mounted antler collect with any tool.
// Native custom-block default self-drop has no loot-table tool predicate.
for (const name of ["firefly_jar", "deer_antler"]) {
  const block = JSON.parse(readFileSync(new URL(`../lothlorien_bp/blocks/${name}.json`, import.meta.url)))["minecraft:block"];
  assert.equal(block.components["minecraft:loot"], undefined, `${name}: keep native collectible self-drop`);
  for (const permutation of block.permutations ?? [])
    assert.equal(permutation.components?.["minecraft:loot"], undefined, `${name}: no state-dependent harvest gate`);
}
console.log("ok   leaf harvest: shears/Silk exclusivity, custom acorn and native stick Fortune branches, decay context, generator and owner exceptions");
