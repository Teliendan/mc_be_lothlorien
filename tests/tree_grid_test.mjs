// Distribution contracts, not a claim of native collision safety.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { TREE_GRID_KINDS, TREE_GRID_SET, TREE_GRID_PLACEMENT, treeGridDefinitions } from "../tools/build_tree_grid_test.mjs";
import { MEMORIAL_SITES, memorialSitesSet } from "../tools/memorial.mjs";
import { readNbt } from "../tools/village_sim.mjs";

const bp = new URL("../lothlorien_bp/", import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, bp), "utf8"));
function check() {
const definitions = treeGridDefinitions();
const set = json(TREE_GRID_SET)["minecraft:structure_set"];
assert.deepEqual(set.placement, { type: "minecraft:random_spread", salt: 518204731, separation: 2, spacing: 6, spread_type: "linear" });
assert.deepEqual(set.placement, TREE_GRID_PLACEMENT);
assert.deepEqual(json(MEMORIAL_SITES.file), memorialSitesSet());
if (set.structures.length === 1 && set.structures[0].structure === "lothlorien:giant_mallorn") {
  assert.deepEqual(set.structures, [{ structure: "lothlorien:giant_mallorn", weight: 1 }]);
  const files = new Set(readdirSync(new URL("worldgen/structures/", bp)));
  assert.ok(![...files].some(f => /^tree_grid_/.test(f)), "restored profile must remove test structure definitions");
  console.log("ok   dense tree-grid test is disabled; original tree grid and separate small-place sets restored");
  return;
}
for (const [path, definition] of Object.entries(definitions)) assert.deepEqual(json(path), definition, path);
assert.deepEqual(set.structures, [
  { structure: "lothlorien:elven_village", weight: 10 },
  { structure: "lothlorien:tree_grid_platform", weight: 19 },
  { structure: "lothlorien:tree_grid_plain", weight: 33 },
  { structure: "lothlorien:tree_grid_shrine", weight: 18 },
]);
assert.equal(set.structures.reduce((s, e) => s + e.weight, 0), 80);
assert.ok(Object.keys(definitions).every(path => !/garden|memorial|elven_village|\.mcstructure/.test(path)),
  "generator must not rewrite gardens/memorials, village rules or saved art");

const original = json("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"];
const legacyEntries = json("worldgen/template_pools/giant_mallorn.json")["minecraft:template_pool"].elements;
const locations = [];
const pools = new Map(readdirSync(new URL("worldgen/template_pools/", bp)).map(file => {
  const pool = json(`worldgen/template_pools/${file}`)["minecraft:template_pool"];
  return [pool.description.identifier, pool];
}));
for (const kind of TREE_GRID_KINDS) {
  const name = kind.structure.split(":")[1];
  const structure = json(`worldgen/structures/${name}.json`)["minecraft:jigsaw"];
  assert.deepEqual(structure.biome_filters, [{ test: "has_biome_tag", value: "lothlorien" }]);
  // Giants measure from the lake bed (ocean_floor) so a trunk on a water site does not hover; villages keep world_surface.
  assert.equal(structure.heightmap_projection, kind.id === "village" ? "world_surface" : "ocean_floor",
    "use terrain rather than sky fixture height");
  const pool = pools.get(structure.start_pool);
  assert.ok(pool, `start pool for ${kind.structure}`);
  if (kind.id === "village") {
    assert.equal(structure.max_depth, 2);
    assert.equal(structure.start_height.value.absolute, -17);
    assert.equal(structure.start_jigsaw_name, "lothlorien:village_anchor");
    assert.equal(structure.start_pool, "lothlorien:village/start");
  } else {
    const clone = structuredClone(structure);
    clone.description.identifier = original.description.identifier;
    clone.start_pool = original.start_pool;
    assert.deepEqual(clone, original, "tree/shrine category retains every original assembly and ground setting");
    assert.equal(pool.elements.length, { platform: 2, plain: 4, shrine: 1 }[kind.id]);
    locations.push(...pool.elements);
  }
  for (const entry of pool.elements) {
    assert.equal(entry.element.element_type, "minecraft:single_pool_element");
    const nbt = readNbt(readFileSync(new URL(`structures/${entry.element.location}.mcstructure`, bp)));
    const entities = Object.values(nbt.structure.palette.default.block_position_data).map(p => p.block_entity_data);
    assert.ok(entities.some(e => e?.id === "JigsawBlock" && e.name === structure.start_jigsaw_name),
      `${kind.structure} template must contain its own actual start anchor`);
  }
}
const ordered = entries => [...entries].sort((a, b) => a.element.location.localeCompare(b.element.location));
assert.deepEqual(ordered(locations), ordered(legacyEntries), "partition all original assets without dropping variants or modifying relative weights");
const allSets = readdirSync(new URL("worldgen/structure_sets/", bp)).map(file => json(`worldgen/structure_sets/${file}`)["minecraft:structure_set"]);
assert.equal(allSets.length, 2, "one shared tree grid plus one memorial-only grid (gardens are a feature, not a set)");
for (const kind of TREE_GRID_KINDS)
  assert.equal(allSets.flatMap(s => s.structures).filter(e => e.structure === kind.structure).length, 1,
    `no extra set duplicates ${kind.structure}`);
assert.equal(allSets.flatMap(s => s.structures).filter(e => e.structure === "lothlorien:giant_mallorn").length, 0,
  "legacy mixed structure remains command-only during this test");
console.log("ok   dense native tree-grid test: 10/19/33/18 weights (village 1 in 8), original spacing/salt, memorial-only grid, exact variant partition and per-type anchors/heights");
}
check();
