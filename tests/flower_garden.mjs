import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GARDEN, GARDEN_SITES, gardenSitesSet, buildFlowerGarden, flowerGardenLoot, flowerGardenWorldgen } from "../tools/flower_garden.mjs";
import { toMcstructure } from "../tools/build_structures.mjs";
import { readNbt } from "../tools/village_sim.mjs";
import { checkWalk, defaultCollision } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";

const garden = buildFlowerGarden(), { blocks } = garden;
const get = (x, y, z) => blocks.get(`${x},${y},${z}`);
const must = [[0, 0, -5], [-5, 0, 0], [5, 0, 0], [0, 0, 4], [3, 0, 5], [5, 0, 5]];
const walk = checkWalk(get, { x0: -6, x1: 6, y0: -2, y1: 2, z0: -6, z1: 6 }, {
  walkable: (name) => ["minecraft:grass_block", "lothlorien:mallorn_slab", "lothlorien:mallorn_stairs"].includes(name),
  collision: (b) => garden.flowers.some((p) => get(...p) === b) ? null : defaultCollision(b),
  must: must.map(([x, y, z]) => ({ x, y, z })),
});
assert.deepEqual(walk.violations.filter((v) => ["headroom", "disconnected"].includes(v.rule)), [],
  "open approaches, bench and both barrel access cells connect without jumping");
assert.equal(garden.flowers.length, 24);
for (const [x, y, z] of garden.flowers) assert.equal(get(x, y - 1, z)?.name, "minecraft:grass_block");
for (const [key, b] of blocks) {
  assert.ok(!/sapling|sprout/.test(b.name), "no planted trees in flower beds");
  if (b.name === "lothlorien:mallorn_slab") {
    const [x, y, z] = key.split(",").map(Number);
    assert.equal(get(x, y - 1, z)?.name, "minecraft:grass_block", `edging is supported: ${key}`);
  }
}
assert.deepEqual(garden.entities, []);
const encoded = toMcstructure(blocks, GARDEN.size, GARDEN.offset);
assert.equal(encoded.clipped, 0);
const nbt = readNbt(encoded.buffer), palette = nbt.structure.palette.default;
const dataAt = (at) => {
  const [x, y, z] = at.map((v, i) => v + GARDEN.offset[i]);
  return palette.block_position_data[String((x * GARDEN.size[1] + y) * GARDEN.size[2] + z)].block_entity_data;
};
const barrel = dataAt(GARDEN.barrel);
assert.equal(barrel.id, "Barrel", "barrel must not receive chest block entity data");
assert.equal(barrel.LootTable, GARDEN.loot);
assert.deepEqual(barrel.Items, [], "defer loot until the barrel is opened");
assert.deepEqual([barrel.x, barrel.y, barrel.z], GARDEN.barrel.map((v, i) => v + GARDEN.offset[i]));
assert.equal(get(4, 1, 5)?.name, "minecraft:air", "barrel lid remains exposed");
assert.equal(dataAt([0, -2, 0]).name, GARDEN.anchor);
assert.equal(dataAt([0, -2, 0]).final_state, "minecraft:dirt");
assert.ok(nbt.structure.block_indices[0].includes(-1), "unused cells preserve surrounding terrain");
const chest = readNbt(toMcstructure(new Map([["0,0,0", {
  name: "minecraft:chest", states: {}, loot: GARDEN.loot,
}]]), [1, 1, 1], [0, 0, 0]).buffer).structure.palette.default.block_position_data["0"].block_entity_data;
assert.equal(chest.id, "Chest", "existing tree and shrine caches retain native chest data");
const loot = flowerGardenLoot(), nuts = loot.pools[0];
assert.equal(nuts.rolls, 1);
assert.equal(nuts.conditions, undefined);
assert.equal(nuts.entries.length, 1);
assert.equal(nuts.entries[0].name, "lothlorien:mallorn_acorn");
assert.deepEqual(nuts.entries[0].functions, [{ function: "set_count", count: { min: 2, max: 5 } }]);
assert.equal(loot.pools[2].rolls, 2, "a few flowers alongside nuts and supplies");
for (const [i, name] of [[3, "minecraft:wooden_hoe"], [4, "minecraft:shears"]]) {
  assert.equal(loot.pools[i].rolls, 1);
  assert.equal(loot.pools[i].conditions, undefined);
  assert.deepEqual(loot.pools[i].entries, [{ type: "item", name, weight: 1,
    functions: [{ function: "set_count", count: 1 }] }], "both requested tools are guaranteed separately");
}
const asset = (path) => readFileSync(new URL(`../lothlorien_bp/${path}`, import.meta.url));
assert.deepEqual(encoded.buffer, asset("structures/lothlorien/flower_garden_01.mcstructure"));
assert.deepEqual(loot, JSON.parse(asset(GARDEN.loot)));
for (const [kind, data] of Object.entries(flowerGardenWorldgen()))
  assert.deepEqual(data, JSON.parse(asset(`worldgen/${kind}/flower_garden.json`)));
const treeSet = JSON.parse(asset("worldgen/structure_sets/giant_mallorn.json"))["minecraft:structure_set"];
const gardenSet = gardenSitesSet()["minecraft:structure_set"];
assert.deepEqual(JSON.parse(asset(GARDEN_SITES.file)), gardenSitesSet());
assert.deepEqual(treeSet.placement, { type: "minecraft:random_spread", salt: 518204731,
  separation: 2, spacing: 6, spread_type: "linear" }, "existing big-tree placement rate and grid remain unchanged");
assert.ok(treeSet.structures.every(e => e.structure !== "lothlorien:flower_garden"),
  "garden keeps its own grid rather than competing on the village/tree grid");
// owner 2026-10-21: one grid, each candidate a garden or a memorial, about the old combined count
assert.deepEqual(gardenSet.structures, [{ structure: "lothlorien:flower_garden", weight: 1 }, { structure: "lothlorien:memorial", weight: 1 }]);
assert.deepEqual([gardenSet.placement.spacing, gardenSet.placement.separation], [9, 3]);
assert.ok(gardenSet.placement.separation * 2 < gardenSet.placement.spacing, "engine rule: separation < spacing / 2");
assert.ok(Math.abs(1 / 9 ** 2 / (2 / 12 ** 2) - 1) < 0.15, "combined site density within 15 % of two separate 12-chunk grids");
assert.notEqual(gardenSet.placement.salt, treeSet.placement.salt);
const giant = JSON.parse(asset("worldgen/structures/giant_mallorn.json"))["minecraft:jigsaw"];
const gardenDef = flowerGardenWorldgen().structures["minecraft:jigsaw"];
assert.deepEqual(gardenDef.biome_filters, giant.biome_filters, "same biome eligibility as giants");
// Gardens keep world_surface (their soil replaces a water top); giants use ocean_floor since 2026-10-27.
assert.equal(gardenDef.heightmap_projection, "world_surface");
// Vertical placement uses encoded template height, not the named jigsaw's Y.
const shipped = readNbt(asset("structures/lothlorien/flower_garden_01.mcstructure"));
const shippedPalette = shipped.structure.palette.default.block_palette;
const surfaceY = (index) => gardenDef.start_height.value.absolute + Math.floor(index / shipped.size[2]) % shipped.size[1];
for (const [index, id] of shipped.structure.block_indices[0].entries()) {
  const name = shippedPalette[id]?.name;
  if (name === "minecraft:grass_block") assert.ok(surfaceY(index) <= 0, "all garden soil stays at or below terrain");
  if (name === "minecraft:dirt") assert.ok(surfaceY(index) < 0, "foundation dirt stays underground");
}
const grassIndex = (GARDEN.offset[0] * shipped.size[1] + GARDEN.offset[1] - 1) * shipped.size[2] + GARDEN.offset[2];
assert.equal(shippedPalette[shipped.structure.block_indices[0][grassIndex]].name, "minecraft:grass_block");
assert.equal(surfaceY(grassIndex), 0, "the garden soil surface replaces the terrain top, even with a deep foundation");
// owner, Test G 2026-10-20: deep soil, 4 free cells above the planting, a ragged shoulder (not a square), nothing else written
for (const k of garden.footprint) {
  const [x, z] = k.split(",").map(Number);
  for (let y = -6; y <= -2; y++) assert.ok(["minecraft:dirt", "minecraft:jigsaw"].includes(get(x, y, z)?.name), `soil under ${k} at ${y}`);
  for (let y = 0; y < 4; y++) assert.ok(get(x, y, z), `cell ${k},${y} is written (cleared or planted)`);
}
assert.ok(garden.skirt.ring1.length > 20 && garden.skirt.ring2.length > 4, "a shoulder in both rings");
const ring1 = new Set(); for (const k of garden.footprint) { const [x, z] = k.split(",").map(Number); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!garden.footprint.has(`${x + a},${z + b}`)) ring1.add(`${x + a},${z + b}`); }
assert.ok(garden.skirt.ring1.length < ring1.size, "the shoulder is ragged");
for (const [x, z] of garden.skirt.ring1) assert.equal(get(x, -2, z)?.name, "minecraft:grass_block", "ring 1 steps down one");
for (const [x, z] of garden.skirt.ring2) assert.equal(get(x, -3, z)?.name, "minecraft:grass_block", "ring 2 steps down two");
assert.deepEqual(toMcstructure(buildFlowerGarden().blocks, GARDEN.size, GARDEN.offset).buffer, encoded.buffer);
console.log("ok   flower garden: supported beds, native barrel, owner loot, shared garden/memorial grid 9/3, deterministic shipped assets");
