import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { GARDEN, GARDEN_CHANCE, GARDEN_EXTENT, GARDEN_FILES, GARDEN_LATTICE, buildFlowerGarden, flowerGardenFeature, flowerGardenFeatureRule, flowerGardenLoot } from "../tools/flower_garden.mjs";
import { SITE_ALLOWLIST } from "../tools/site_feature.mjs";
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
assert.ok(![...blocks.values()].some((b) => b.name === "minecraft:jigsaw"), "a feature does not consume jigsaw blocks: none buried");
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
const feature = flowerGardenFeature(), rule = flowerGardenFeatureRule();
assert.deepEqual(feature, JSON.parse(asset(GARDEN_FILES.feature)));
assert.deepEqual(rule, JSON.parse(asset(GARDEN_FILES.rule)));
for (const f of GARDEN_FILES.retired) assert.throws(() => asset(f), `${f} is retired`);
assert.ok(!readdirSync(new URL("../lothlorien_bp/worldgen/structure_sets/", import.meta.url)).includes("garden_sites.json"));
const f = feature["minecraft:structure_template_feature"];
assert.equal(f.structure_name, GARDEN.id);
assert.equal(f.rotate_around_center, true);
assert.equal(f.adjustment_radius, 1);
assert.equal(f.ground_level, GARDEN.groundLevel);
assert.deepEqual(Object.keys(f.constraints).sort(), ["block_intersection", "grounded", "leveled", "unburied"]);
assert.equal(f.constraints.leveled.max_steepness, 2);
assert.equal(f.constraints.block_intersection.only_check_intersection_for_motion_blocking_blocks, false);
assert.ok(!SITE_ALLOWLIST.some((n) => /water|lava|ice|_log|leaves|planks|slab|stairs|mallorn|jigsaw|barrel|glass/.test(n)),
  "allowlist is terrain only: water, trees and builds refuse the site");
// odd centred 13 x 13 box: the rotation centre is a whole cell and every quarter turn maps the box onto itself
assert.deepEqual(GARDEN.size.filter((_, i) => i !== 1), [13, 13]);
assert.deepEqual([GARDEN.offset[0], GARDEN.offset[2]], [6, 6]);
// the ground_level row is the grass row that replaces the terrain top block; the rule y is that block
assert.equal(GARDEN.groundLevel, GARDEN.offset[1] - 1);
assert.equal(get(0, -1, 0).name, "minecraft:grass_block");
const dist = rule["minecraft:feature_rules"].distribution, cond = rule["minecraft:feature_rules"].conditions;
assert.equal(dist.y, "query.heightmap(variable.worldx, variable.worldz) - 1");
assert.equal(cond.placement_pass, "before_surface_pass");
assert.equal(rule["minecraft:feature_rules"].description.places_feature, GARDEN.feature);
assert.deepEqual(cond["minecraft:biome_filter"], [{ test: "has_biome_tag", value: "lothlorien" }], "same biome eligibility as the old garden");
// the whole box plus the adjustment stays in one chunk for every centre in the extent (all four facings are the same box)
const half = (GARDEN.size[0] - 1) / 2 + f.adjustment_radius;
for (const c of GARDEN_EXTENT) assert.ok(c - half >= 0 && c + half <= 15, `centre ${c} keeps the footprint in its chunk`);
assert.deepEqual([dist.x.extent, dist.z.extent], [[...GARDEN_EXTENT], [...GARDEN_EXTENT]]);
assert.ok(dist.iterations.includes(`, ${GARDEN_LATTICE}) == 0`), "one candidate chunk per lattice cell");
// the engine drops a rule whose scatter_chance has numerator >= denominator: chance 1 is no scatter_chance
if (GARDEN_CHANCE.numerator >= GARDEN_CHANCE.denominator) assert.equal(dist.scatter_chance, undefined, "chance 1: no scatter_chance");
else assert.deepEqual(dist.scatter_chance, GARDEN_CHANCE);
const treeSet = JSON.parse(asset("worldgen/structure_sets/giant_mallorn.json"))["minecraft:structure_set"];
assert.deepEqual(treeSet.placement, { type: "minecraft:random_spread", salt: 518204731,
  separation: 2, spacing: 6, spread_type: "linear" }, "existing big-tree placement rate and grid remain unchanged");
// shipped template: grass row at ground_level, 3 deep soil, nothing else underground
const shipped = readNbt(asset("structures/lothlorien/flower_garden_01.mcstructure"));
assert.deepEqual(shipped.size, GARDEN.size);
const shippedPalette = shipped.structure.palette.default.block_palette;
const [, sy, sz] = shipped.size;
for (const [index, id] of shipped.structure.block_indices[0].entries()) {
  const name = shippedPalette[id]?.name, y = Math.floor(index / sz) % sy;
  if (name === "minecraft:grass_block") assert.ok(y <= GARDEN.groundLevel, "grass stays at or below the replaced top block");
  if (name === "minecraft:dirt") assert.ok(y < GARDEN.groundLevel, "soil stays under the grass row");
}
const grassIndex = (GARDEN.offset[0] * sy + GARDEN.groundLevel) * sz + GARDEN.offset[2];
assert.equal(shippedPalette[shipped.structure.block_indices[0][grassIndex]].name, "minecraft:grass_block");
for (const k of garden.footprint) {
  const [x, z] = k.split(",").map(Number);
  for (let y = -3; y <= -2; y++) assert.ok(get(x, y, z)?.name === "minecraft:dirt" || y === -2 && get(x, y, z), `soil under ${k} at ${y}`);
  for (let y = 0; y < 4; y++) assert.ok(get(x, y, z), `cell ${k},${y} is written (cleared or planted)`);
}
assert.ok(garden.skirt.ring1.length > 20 && garden.skirt.ring2.length === 0, "one shoulder ring, no second");
for (const [x, z] of garden.skirt.ring1) assert.equal(get(x, -2, z)?.name, "minecraft:grass_block", "shoulder steps down one");
assert.deepEqual(toMcstructure(buildFlowerGarden().blocks, GARDEN.size, GARDEN.offset).buffer, encoded.buffer);
console.log("ok   flower garden: supported beds, native barrel, owner loot, natural 13x13 template feature + lattice rule (test build), deterministic shipped assets");
