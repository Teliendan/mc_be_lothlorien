// Owner collection policy: ordinary blocks do not acquire tool/tier loot gates.
// Approved leaf/crop rules have dedicated tests; nectar's shears exception is checked here.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const bp = new URL("../lothlorien_bp/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, bp)));
const exceptions = new Set(["lothlorien:mallorn_leaves", "lothlorien:western_corn", "lothlorien:nectar_bloom"]);
function assertUngated(value) {
  if (Array.isArray(value)) return value.forEach(assertUngated);
  if (!value || typeof value !== "object") return;
  assert.ok(!["match_tool", "killed_by_player", "killed_by_player_or_pets", "killed_by_entity"].includes(value.condition),
    `ordinary block collection cannot require a tool/player context: ${value.condition}`);
  Object.values(value).forEach(assertUngated);
}
const reviewed = [];
for (const filename of readdirSync(new URL("blocks/", bp)).filter((name) => name.endsWith(".json"))) {
  const body = read(`blocks/${filename}`)["minecraft:block"], id = body.description.identifier;
  if (exceptions.has(id)) continue;
  const components = [body.components, ...(body.permutations ?? []).map((permutation) => permutation.components)];
  const visited = new Set();
  function auditTable(path) {
    if (visited.has(path)) return;
    visited.add(path);
    const table = read(path); assertUngated(table);
    function visit(value) {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== "object") return;
      if (value.type === "loot_table") auditTable(value.name.endsWith(".json") ? value.name : `${value.name}.json`);
      Object.values(value).forEach(visit);
    }
    visit(table);
  }
  for (const component of components) if (component?.["minecraft:loot"]) auditTable(component["minecraft:loot"]);
  reviewed.push(id);
}
assert.ok(!reviewed.includes("lothlorien:nectar_bloom") && reviewed.includes("lothlorien:star_canopy"));

const nectar = read("loot_tables/blocks/nectar_bloom.json");
const shearsCondition = { condition: "match_tool", item: "minecraft:shears" };
const silkCondition = { condition: "match_tool", enchantments: [
  { enchantment: "silk_touch", levels: { range_min: 1 } }] };
const expectedNectar = { pools: [[shearsCondition], [silkCondition, { ...shearsCondition, operator: "not" }]]
  .map((conditions) => ({ rolls: 1, conditions, entries: [{ type: "item", name: "lothlorien:nectar_bloom",
    functions: [{ function: "set_count", count: 1 }, { function: "explosion_decay" }],
  }] })) };
assert.deepEqual(nectar, expectedNectar, "owner exception: shears or Silk Touch, exclusive one-bloom pools with native decay");
const bloom = read("blocks/nectar_bloom.json")["minecraft:block"];
assert.deepEqual(bloom.description.states["lothlorien:nectar"], [0, 1, 2, 3]);
assert.equal(bloom.components["minecraft:loot"], "loot_tables/blocks/nectar_bloom.json");
for (const permutation of bloom.permutations)
  assert.equal(permutation.components["minecraft:loot"], undefined, "every nectar stage inherits shears/Silk collection");
const generated = JSON.parse(execFileSync("python", ["-B", "-c",
  "import json,runpy; print(json.dumps(runpy.run_path('tools/make_nectar_bloom.py')['loot']()))"], {
  cwd: new URL("../", import.meta.url), encoding: "utf8",
}));
assert.deepEqual(generated, nectar, "art generator reproduces the reviewed loot without generating art");

for (const broken of [{ pools: [{ conditions: [{ condition: "match_tool", item: "minecraft:shears" }] }] },
  { pools: [{ entries: [{ conditions: [{ condition: "match_tool", "minecraft:match_tool_filter_all": ["minecraft:is_pickaxe"] }] }] }] },
  { pools: [{ conditions: [{ condition: "killed_by_player" }] }] }])
  assert.throws(() => assertUngated(broken), "both pool/entry predicates and player-only conditions restrict ordinary collection");
console.log(`ok   ordinary harvest: ${reviewed.length} ordinary block routes ungated; explicit shears/Silk nectar exception, all stages, decay and generator`);
