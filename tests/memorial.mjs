import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { MEMORIAL, MEMORIAL_FEATURE, MEMORIAL_FILES, buildMemorial, memorialFeature, memorialWorldgen } from "../tools/memorial.mjs";
import { placeEntities, toMcstructure } from "../tools/build_structures.mjs";
import { readNbt } from "../tools/village_sim.mjs";
import { SITES } from "../tools/site_feature.mjs";
import { SILVER_WATCH } from "../tools/watch_camp_rules.mjs";
import { checkWalk, defaultCollision } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";

const memorial = buildMemorial(), { blocks } = memorial;
const get = (x, y, z) => blocks.get(`${x},${y},${z}`);
const get2 = (build, x, y, z) => build.blocks.get(`${x},${y},${z}`);
// All four approaches, the central aisle and the inner side of each bench.
// Stairs are treated conservatively as full cubes; the must points are access
// cells beside the seats, not an assertion that the bench itself is a path.
const must = [[0, 1, -6], [-5, 1, 0], [5, 1, 0], [0, 1, 7],
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
  assert.ok(!/slab/.test(get(x, 0, z)?.name), "no slab rim (owner 2026-10-28)");
}
for (const k of memorial.ground) if (!memorial.leaf.has(k)) {
  const [x, z] = k.split(",").map(Number);
  assert.equal(get(x, 0, z)?.name, "minecraft:grass_block", "apron at deck level, no trench");
}
assert.deepEqual(memorial.entities.map((e) => e.id), ["lothlorien:memorial_sound"], "uninhabited: only the invisible sound source");
const voice = memorial.entities[0];
const capCell = memorial.blocks.get(`${Math.floor(voice.x)},${Math.floor(voice.y)},${Math.floor(voice.z)}`);
assert.equal(capCell?.name, "lothlorien:mallorn_heartwood_slab", "sound source sits on the pillar cap");
assert.ok(capCell.states["minecraft:vertical_half"] === "bottom" && voice.y % 1 >= 0.5, "above the bottom slab, not inside it");
const encoded = toMcstructure(blocks, MEMORIAL.size, MEMORIAL.offset, placeEntities(memorial.entities, MEMORIAL.offset));
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
const giantSet = asset("worldgen/structure_sets/giant_mallorn.json")["minecraft:structure_set"];
assert.equal(generated.structure_sets, undefined);
for (const file of MEMORIAL_FILES.retired) assert.ok(!existsSync(new URL(`../lothlorien_bp/${file}`, import.meta.url)), `${file} retired`);
assert.ok(giantSet.structures.every(e => e.structure !== "lothlorien:memorial"), "memorial stays off the village/tree grid");
const definition = generated.structures["minecraft:jigsaw"];
const giantDef = asset("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"];
assert.deepEqual(definition.biome_filters, giantDef.biome_filters, "same biome eligibility as giants");
assert.equal(definition.heightmap_projection, "world_surface");
// Vertical placement uses encoded template height, not the named jigsaw's Y.
const shipped = readNbt(readFileSync(new URL("../lothlorien_bp/structures/lothlorien/memorial_leaf_01.mcstructure", import.meta.url)));
const shippedPalette = shipped.structure.palette.default.block_palette;
const surfaceY = (index) => definition.start_height.value.absolute + Math.floor(index / shipped.size[2]) % shipped.size[1];
for (const [index, id] of shipped.structure.block_indices[0].entries()) {
  const name = shippedPalette[id]?.name;
  if (name === "minecraft:dirt") assert.ok(surfaceY(index) < 0, "foundation dirt stays underground");
  if (name === "minecraft:grass_block") assert.ok(surfaceY(index) <= 0, "soil pockets stay at or below terrain");
  if (name?.endsWith("_planks")) assert.equal(surfaceY(index), 0, "memorial planks replace the terrain top, even with a deep foundation");
}
// owner, Test G 2026-10-20: deep soil under the apron, 4 free cells above the deck, a ragged shoulder
for (const k of memorial.ground) {
  const [x, z] = k.split(",").map(Number);
  for (let y = -6; y <= -2; y++) assert.ok(["minecraft:dirt", "minecraft:jigsaw"].includes(get(x, y, z)?.name), `soil under ${k} at ${y}`);
  for (let y = 1; y <= 4; y++) assert.ok(get(x, y, z), `cell ${k},${y} is written`);
}
assert.ok(memorial.skirt.ring1.length > 20 && memorial.skirt.ring2.length > 4, "a shoulder in both rings");
assert.equal(definition.start_jigsaw_name, anchor.name);
assert.equal(definition.start_pool, generated.template_pools["minecraft:template_pool"].description.identifier);
assert.deepEqual(generated.template_pools["minecraft:template_pool"].elements, [{
  element: { element_type: "minecraft:single_pool_element", location: "lothlorien/memorial_leaf_01" }, weight: 1,
}]);
assert.deepEqual(encoded.buffer, readFileSync(new URL("../lothlorien_bp/structures/lothlorien/memorial_leaf_01.mcstructure", import.meta.url)));
assert.deepEqual(toMcstructure(buildMemorial().blocks, MEMORIAL.size, MEMORIAL.offset, placeEntities(memorial.entities, MEMORIAL.offset)).buffer, encoded.buffer);

// Natural feature copy: no anchor, 11 x 15 centred box, same constraints as the garden, shared site lattice.
const copy = buildMemorial({ feature: true });
assert.ok(![...copy.blocks.values()].some((b) => b.name === "minecraft:jigsaw"), "feature copy has no jigsaw anchor");
assert.deepEqual(copy.entities, [], "a feature drops template entities (owner, 2026-10-28)");
assert.equal(get2(copy, ...MEMORIAL_FEATURE.seedAt).name, MEMORIAL_FEATURE.seed, "top pillar log is the sound seed");
assert.equal(get2(memorial, ...MEMORIAL_FEATURE.seedAt).name, "lothlorien:mallorn_log");
const [jigSound] = memorial.entities;
const seedJs = readFileSync(new URL("../lothlorien_bp/scripts/memorial_seed.js", import.meta.url), "utf8");
assert.match(seedJs, /offset: \{ x: 0\.5, y: 1\.6, z: 0\.5 \}/, "script offset matches the template sound position");
assert.deepEqual([jigSound.x, jigSound.y, jigSound.z], [MEMORIAL_FEATURE.seedAt[0] + 0.5, MEMORIAL_FEATURE.seedAt[1] + 1.6, MEMORIAL_FEATURE.seedAt[2] + 0.5],
  "seed spawns the sound where the jigsaw template has it");
const seedBlock = asset("blocks/memorial_seed.json")["minecraft:block"], logBlock = asset("blocks/mallorn_log.json")["minecraft:block"];
for (const [k, v] of Object.entries(logBlock.components)) assert.deepEqual(seedBlock.components[k], v, `seed looks and behaves like the log: ${k}`);
assert.deepEqual(seedBlock.components["minecraft:tick"], { interval_range: [10, 20], looping: false });
assert.deepEqual([MEMORIAL_FEATURE.size[0], MEMORIAL_FEATURE.size[2]], [11, 15]);
assert.deepEqual([MEMORIAL_FEATURE.offset[0], MEMORIAL_FEATURE.offset[2]], [5, 7], "odd centred box");
assert.equal(copy.skirt.ring1.length + copy.skirt.ring2.length, 0, "option C: no shoulder");
for (const [k] of copy.blocks) {
  const [x, y, z] = k.split(",").map(Number);
  assert.ok(Math.abs(x) <= 5 && z >= -7 && z <= 7 && y >= -3 && y <= 5, `feature cell ${k} inside the box`);
}
const featureAsset = readFileSync(new URL("../lothlorien_bp/structures/lothlorien/memorial_leaf_feature_01.mcstructure", import.meta.url));
const enc = toMcstructure(copy.blocks, MEMORIAL_FEATURE.size, MEMORIAL_FEATURE.offset, placeEntities(copy.entities, MEMORIAL_FEATURE.offset));
assert.equal(enc.clipped, 0);
assert.deepEqual(enc.buffer, featureAsset);
const featureNbt = readNbt(featureAsset);
assert.equal(featureNbt.structure.palette.default.block_palette.some((p) => p.name === "minecraft:jigsaw"), false);
assert.equal(featureNbt.structure.entities.length, 0);
const mf = asset("features/memorial_feature.json"), mfSpec = memorialFeature();
assert.deepEqual(mf, mfSpec);
const spec = mf["minecraft:structure_template_feature"], gspec = asset("features/flower_garden_feature.json")["minecraft:structure_template_feature"];
assert.equal(spec.structure_name, MEMORIAL_FEATURE.id);
assert.equal(spec.ground_level, MEMORIAL_FEATURE.groundLevel);
assert.equal(MEMORIAL_FEATURE.groundLevel, MEMORIAL_FEATURE.offset[1], "ground_level is the deck row: deck flush with the terrain (owner 2026-10-28)");
assert.equal(spec.adjustment_radius, 0);
assert.deepEqual(spec.constraints, gspec.constraints, "same tuned constraints as the garden");
assert.equal(spec.rotate_around_center, true);
// Placed by the shared garden/memorial site rule; the rotated 15-long side from centre 7 stays in the chunk (radius 0).
assert.ok(SITES.features.some(([id]) => id === MEMORIAL_FEATURE.feature));
for (const c of SITES.extent) assert.ok(c - 7 >= 0 && c + 7 <= 15);
console.log("ok   leaf memorial: connected approaches, supported planting, native banners, ground anchor, memorial feature on the shared site lattice, flush deck, sound seed log, deterministic assets");
