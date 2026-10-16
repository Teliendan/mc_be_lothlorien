import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MEMORIAL, buildMemorial, memorialWorldgen } from "../tools/memorial.mjs";
import { flowerGardenWorldgen } from "../tools/flower_garden.mjs";
import { toMcstructure } from "../tools/build_structures.mjs";
import { readNbt } from "../tools/village_sim.mjs";
import { SILVER_WATCH } from "../tools/watch_camp_rules.mjs";
import { checkWalk, defaultCollision } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";

const memorial = buildMemorial(), { blocks } = memorial;
const get = (x, y, z) => blocks.get(`${x},${y},${z}`);
// All four approaches, the central aisle and the inner side of each bench.
// Stairs are treated conservatively as full cubes; the must points are access
// cells beside the seats, not an assertion that the bench itself is a path.
const must = [[0, 0, -6], [-5, 0, 0], [5, 0, 0], [0, 0, 7],
  [0, 1, -3], [0, 1, 0], [-1, 1, -1], [1, 1, -1], [-1, 1, 2], [1, 1, 2]];
const walk = checkWalk(get, { x0: -5, x1: 5, y0: -2, y1: 5, z0: -6, z1: 7 }, {
  walkable: (name) => /grass_block|planks|slab/.test(name),
  collision: (b) => b && /niphredil|lily_of_the_valley/.test(b.name) ? null : defaultCollision(b),
  must: must.map(([x, y, z]) => ({ x, y, z })),
});
assert.deepEqual(walk.violations.filter((v) => ["headroom", "disconnected"].includes(v.rule)), [],
  "approaches and bench access must connect without jumping or low ceilings");
for (const [x, y, z] of memorial.flowers) assert.equal(get(x, y - 1, z)?.name, "minecraft:grass_block");
for (const [x, y, z] of memorial.seats) assert.equal(get(x, y - 1, z)?.name, "lothlorien:mallorn_planks");
for (const k of memorial.leaf) {
  const [x, z] = k.split(",").map(Number);
  assert.equal(get(x, -1, z)?.name, "minecraft:grass_block", "every deck cell stands on ground");
}
assert.deepEqual(memorial.entities, [], "uninhabited memorial has no template actors");
const encoded = toMcstructure(blocks, MEMORIAL.size, MEMORIAL.offset);
assert.equal(encoded.clipped, 0, "template must include the full deck, apron and cap");
const nbt = readNbt(encoded.buffer), palette = nbt.structure.palette.default;
const dataAt = (x, y, z) => {
  x += MEMORIAL.offset[0]; y += MEMORIAL.offset[1]; z += MEMORIAL.offset[2];
  return palette.block_position_data[String((x * MEMORIAL.size[1] + y) * MEMORIAL.size[2] + z)].block_entity_data;
};
for (const [z, facing] of [[2, 2], [4, 3]]) {
  assert.equal(get(0, 3, z).states.facing_direction, facing);
  assert.equal(get(0, 3, 3).name, "lothlorien:mallorn_log", "banner is attached to the pillar");
  assert.equal(get(0, 2, z).name, "minecraft:air", "two-block cloth has hanging clearance");
  const banner = dataAt(0, 3, z);
  assert.equal(banner.id, "Banner");
  assert.equal(banner.Base, SILVER_WATCH.baseId);
  assert.deepEqual(banner.Patterns, SILVER_WATCH.patterns.map((p) =>
    ({ Pattern: p.code, Color: p.color === "silver" ? 15 : p.colorId })),
  "preserve all six existing pattern layers, changing only the border to white");
}
assert.ok(nbt.structure.block_indices[0].includes(-1), "unused cells preserve terrain and canopy");
assert.equal(get(5, 5, 7), undefined, "unused upper corners stay void");
assert.ok(![...blocks.values()].some((b) => /sapling|sprout/.test(b.name)), "no planted growing trees");
assert.equal([...blocks.values()].filter((b) => b.name === "minecraft:jigsaw").length, 1);
const anchor = dataAt(0, -2, 0);
assert.equal(anchor.id, "JigsawBlock");
assert.equal(anchor.name, MEMORIAL.anchor);
assert.equal(anchor.final_state, "minecraft:dirt");
assert.equal(anchor.target_pool, "minecraft:empty");
const asset = (path) => JSON.parse(readFileSync(new URL(`../lothlorien_bp/${path}`, import.meta.url)));
const generated = memorialWorldgen();
for (const [kind, data] of Object.entries(generated))
  assert.deepEqual(data, asset(`worldgen/${kind}/memorial.json`));
const memorialSet = generated.structure_sets["minecraft:structure_set"];
const gardenSet = asset("worldgen/structure_sets/flower_garden.json")["minecraft:structure_set"];
const giantSet = asset("worldgen/structure_sets/giant_mallorn.json")["minecraft:structure_set"];
const { salt: memorialSalt, ...memorialGrid } = memorialSet.placement;
const { salt: gardenSalt, ...gardenGrid } = gardenSet.placement;
assert.deepEqual(memorialGrid, gardenGrid, "same frequency and spread as accepted gardens");
assert.equal(new Set([memorialSalt, gardenSalt, giantSet.placement.salt]).size, 3, "independent placement grids");
assert.deepEqual(gardenSet, flowerGardenWorldgen().structure_sets["minecraft:structure_set"],
  "garden density and membership remain unchanged");
assert.deepEqual(memorialSet.structures, [{ structure: "lothlorien:memorial", weight: 1 }]);
assert.equal((giantSet.placement.spacing / memorialSet.placement.spacing) ** 2, 0.25);
assert.deepEqual(giantSet.structures, [{ structure: "lothlorien:giant_mallorn", weight: 1 }]);
const definition = generated.structures["minecraft:jigsaw"];
const gardenDef = asset("worldgen/structures/flower_garden.json")["minecraft:jigsaw"];
for (const field of ["biome_filters", "heightmap_projection", "step", "terrain_adaptation"])
  assert.deepEqual(definition[field], gardenDef[field], `${field}: same garden terrain eligibility`);
assert.equal(definition.start_height.value.absolute, -MEMORIAL.offset[1]);
assert.equal(definition.start_jigsaw_name, anchor.name);
assert.equal(definition.start_pool, generated.template_pools["minecraft:template_pool"].description.identifier);
assert.deepEqual(generated.template_pools["minecraft:template_pool"].elements, [{
  element: { element_type: "minecraft:single_pool_element", location: "lothlorien/memorial_leaf_01" }, weight: 1,
}]);
assert.deepEqual(encoded.buffer, readFileSync(new URL("../lothlorien_bp/structures/lothlorien/memorial_leaf_01.mcstructure", import.meta.url)));
assert.deepEqual(toMcstructure(buildMemorial().blocks, MEMORIAL.size, MEMORIAL.offset).buffer, encoded.buffer);
console.log("ok   leaf memorial: connected approaches, supported planting, native banners, ground anchor, garden-frequency worldgen, deterministic asset");
