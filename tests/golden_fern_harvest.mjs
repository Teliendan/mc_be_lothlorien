// Owner 2026-10-13: flower-like collection replaces native fern seed harvesting.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const table = JSON.parse(readFileSync(new URL("../lothlorien_bp/loot_tables/blocks/golden_fern.json", import.meta.url)));
const fern = "lothlorien:golden_fern";
function assertCollectible(loot) {
  assert.equal(loot.pools.length, 1, "one drop route, no extra seeds or enchantment pools");
  const pool = loot.pools[0];
  assert.equal(pool.rolls, 1);
  assert.deepEqual(pool.conditions ?? [], [], "bare hand, shears, ordinary and enchanted tools all collect");
  assert.equal(pool.entries.length, 1);
  const entry = pool.entries[0];
  assert.equal(entry.type, "item");
  assert.equal(entry.name, fern);
  assert.deepEqual(entry.conditions ?? [], []);
  assert.deepEqual(entry.functions, [
    { function: "set_count", count: 1 }, { function: "explosion_decay" },
  ], "one fern; native blast decay processes final count");
}
assertCollectible(table);
const generated = JSON.parse(execFileSync("python", ["-B", "tools/golden_fern_loot.py", "--print-loot"], {
  cwd: new URL("../", import.meta.url), encoding: "utf8",
}));
assert.deepEqual(generated, table, "regeneration preserves reviewed collection policy");
for (const corrupt of [
  (loot) => { loot.pools[0].conditions = [{ condition: "match_tool", item: "minecraft:shears" }]; },
  (loot) => { loot.pools.push(structuredClone(loot.pools[0])); },
  (loot) => { loot.pools[0].entries[0].name = "minecraft:wheat_seeds"; },
  (loot) => { loot.pools[0].entries[0].functions[0].count = 2; },
  (loot) => { loot.pools[0].entries[0].functions.reverse(); },
]) {
  const broken = structuredClone(table);
  corrupt(broken);
  assert.throws(() => assertCollectible(broken));
}
console.log("ok   golden fern: any-tool one-fern collection, native decay, no seeds, generator parity");
