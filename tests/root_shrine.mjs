// Focused build-contract tests: room access, root continuity, supported decor and serialized cache.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHRINE, buildRootShrine, rootShrineLoot } from "../tools/root_shrine.mjs";
import { placeEntities, toMcstructure, giantMallornPool } from "../tools/build_structures.mjs";
import { ANCHOR_AT, TRUNK_ANCHOR } from "../tools/mallorn_anchor.mjs";
import { readNbt } from "../tools/village_sim.mjs";
import { checkWalk, defaultCollision } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";
import { SILVER_WATCH } from "../tools/watch_camp_rules.mjs";

const shrine = buildRootShrine(), { blocks } = shrine;
const key = (x, y, z) => `${x},${y},${z}`;
const get = (x, y, z) => blocks.get(key(x, y, z));
const room = { x0: -1, x1: 3, y0: -1, y1: 5, z0: -7, z1: -1 };
const walk = checkWalk(get, room, {
  walkable: (n) => ["minecraft:moss_block", "minecraft:grass_block"].includes(n),
  collision: (b) => ["lothlorien:niphredil", "lothlorien:elanor"].includes(b?.name) ? null : defaultCollision(b),
  must: [SHRINE.entrance, SHRINE.offering, SHRINE.cacheStand].map(([x, y, z]) => ({ x, y, z })),
});
assert.deepEqual(walk.violations.filter((v) => ["headroom", "disconnected"].includes(v.rule)), [], "standing entrance → offering → cache route");
for (const [x, z] of shrine.flowers) assert.equal(get(x, -1, z)?.name, "minecraft:grass_block", "flower support");
assert.equal(get(1, 1, 0)?.states["minecraft:vertical_half"], "top", "pot has a full-height shelf surface");
assert.equal(get(1, 2, 0)?.name, "minecraft:decorated_pot");
assert.equal(get(1, 3, 0)?.name, "minecraft:air", "pot neck has a full cell of visible space above it");
for (const x of [0, 2]) {
  const candle = get(x, 2, 0);
  assert.equal(candle?.name, "minecraft:white_candle", "candles flank the offering vessel");
  assert.equal(candle.states.lit, true, "shrine candles are lit");
  assert.ok(candle.states.candles >= 1 && candle.states.candles <= 3, "native grouped candles");
  assert.equal(get(x, 1, 0)?.states["minecraft:vertical_half"], "top", "candles have full-height shelf support");
  assert.equal(get(x, 3, 0)?.name, "minecraft:air", "space above candles and flames");
}
assert.equal(get(3, 2, -2)?.name, "minecraft:wall_banner");
assert.equal(get(3, 2, -2)?.states.facing_direction, 4, "banner faces west into the shrine");
assert.equal(get(4, 2, -2)?.name, "lothlorien:mallorn_wood", "banner is fixed to the inner root wall behind it");
assert.equal(get(3, 1, -2)?.name, "minecraft:air", "banner's lower cloth hangs freely");
assert.equal(get(3, -1, -2)?.name, "minecraft:moss_block", "floor candle group has soil support beside the mat");
assert.equal(get(-2, 1, -2)?.name, "minecraft:air", "chest lid opens");
assert.equal(get(-1, 0, -2)?.name, "minecraft:air", "standing access beside cache");
assert.equal(get(-1, 1, -2)?.name, "minecraft:air", "standing headroom beside cache");

// Every new above-ground root is continuously connected to the original trunk (face adjacency).
const isWood = (b) => ["lothlorien:mallorn_log", "lothlorien:mallorn_wood"].includes(b?.name);
const lowestRoot = Math.min(...[...blocks].filter(([, b]) => isWood(b)).map(([k]) => Number(k.split(",")[1])));
for (const [k, b] of blocks) {
  const [x, y, z] = k.split(",").map(Number);
  if (y === -1 && ["minecraft:moss_block", "minecraft:grass_block"].includes(b.name)) {
    for (let below = y - 1; below >= lowestRoot; below--)
      assert.ok(get(x, below, z)?.name === "minecraft:dirt" || isWood(get(x, below, z)),
        `solid soil/root foundation beneath the shrine floor at ${x},${below},${z}`);
  }
  if (b.name === "minecraft:dirt") {
    assert.ok(y >= lowestRoot && y < -1, "dirt stays between floor and root depth");
    assert.ok(["minecraft:moss_block", "minecraft:grass_block"].includes(get(x, -1, z)?.name),
      "foundation stays beneath the existing floor footprint");
  }
}
assert.equal(get(-3, lowestRoot, -2)?.name, "lothlorien:mallorn_log", "buried buttress roots remain wood");
const seen = new Set([key(1, 7, 1)]), queue = [[1, 7, 1]];
for (let i = 0; i < queue.length; i++) {
  const [x, y, z] = queue[i];
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const p = [x + dx, y + dy, z + dz], k = key(...p);
    if (!seen.has(k) && isWood(get(...p))) { seen.add(k); queue.push(p); }
  }
}
for (const [k, b] of blocks) {
  const [x, y, z] = k.split(",").map(Number);
  if (isWood(b) && x >= -3 && x <= 5 && z >= -7 && z <= 0 && y >= 3 && y <= 6)
    assert.ok(seen.has(k), `root/shoulder is attached to trunk: ${k}`);
  if (b.name === "lothlorien:mallorn_leaves") assert.equal(b.states["lothlorien:persistent"], true);
  if (b.name === "minecraft:air") assert.ok(y >= 0 && y <= 3 && z >= -7 && z <= 0 && x >= -2 && x <= 4, `only recess/approach, altar niche and banner pocket carved: ${k}`);
}
assert.ok([...blocks].some(([k, b]) => Number(k.split(",")[1]) >= 30 && b.name === "lothlorien:mallorn_leaves"), "complete crown ships");
assert.deepEqual(shrine.entities.map((e) => e.id), ["lothlorien:shrine_sound"], "uninhabited: only the invisible sound source");
const voice = shrine.entities[0], cell = (dy) => shrine.blocks.get(`${Math.floor(voice.x)},${Math.floor(voice.y) + dy},${Math.floor(voice.z)}`)?.name;
assert.equal(cell(0), "minecraft:air", "sound source hangs in the open room");
assert.ok(cell(1) && cell(1) !== "minecraft:air", "sound source sits right under the root ceiling");

const encoded = toMcstructure(blocks, SHRINE.size, SHRINE.offset, placeEntities(shrine.entities, SHRINE.offset));
assert.equal(encoded.clipped, 0, "whole tree fits");
const nbt = readNbt(encoded.buffer), pal = nbt.structure.palette.default;
assert.deepEqual(nbt.size, SHRINE.size);
assert.ok(nbt.structure.block_indices[0].includes(-1), "unused terrain remains structure void");
const anchorPos = [ANCHOR_AT.x, ANCHOR_AT.y, ANCHOR_AT.z].map((v, i) => v + SHRINE.offset[i]);
const anchorIndex = (anchorPos[0] * SHRINE.size[1] + anchorPos[1]) * SHRINE.size[2] + anchorPos[2];
assert.equal(pal.block_palette[nbt.structure.block_indices[0][anchorIndex]].name, "minecraft:jigsaw");
const anchorData = pal.block_position_data[String(anchorIndex)].block_entity_data;
assert.equal(anchorData.name, TRUNK_ANCHOR, "shrine uses the same rotation/ground anchor as the other giants");
assert.equal(anchorData.final_state, "lothlorien:mallorn_log", "worldgen replaces the buried connector with a root");
assert.equal(anchorData.target_pool, "minecraft:empty", "shrine is a complete single piece");
assert.deepEqual([anchorData.x, anchorData.y, anchorData.z], anchorPos);
const potPos = [1, 2, 0].map((v, i) => v + SHRINE.offset[i]);
const potIndex = (potPos[0] * SHRINE.size[1] + potPos[1]) * SHRINE.size[2] + potPos[2];
const potData = pal.block_position_data[String(potIndex)].block_entity_data;
assert.equal(potData.id, "DecoratedPot", "offering uses native pot data, not a chest");
assert.deepEqual(potData.item, { Count: 1, Damage: 0, Name: "lothlorien:morning_dew", WasPickedUp: 0 }, "one full dew bottle is inside the vase");
assert.deepEqual([potData.x, potData.y, potData.z], potPos, "pot data uses template-local coordinates");
assert.equal(potData.Items, undefined, "native pot stores a single item compound rather than chest slots");
assert.equal(potData.LootTable, undefined, "fixed offering cannot roll some other loot");
const stackPot = toMcstructure(new Map([["0,0,0", {
  name: "minecraft:decorated_pot", states: {}, potItem: { name: "lothlorien:morning_dew", count: 4 },
}]]), [1, 1, 1], [0, 0, 0]);
assert.equal(readNbt(stackPot.buffer).structure.palette.default.block_position_data["0"].block_entity_data.item.Count, 4,
  "native item Count is a numeric byte, not a boolean");
const [cx, cy, cz] = SHRINE.chest.map((v, i) => v + SHRINE.offset[i]);
const chestIndex = (cx * SHRINE.size[1] + cy) * SHRINE.size[2] + cz;
assert.equal(pal.block_position_data[String(chestIndex)].block_entity_data.LootTable, SHRINE.loot);
assert.deepEqual([pal.block_position_data[String(chestIndex)].block_entity_data.x,
  pal.block_position_data[String(chestIndex)].block_entity_data.y,
  pal.block_position_data[String(chestIndex)].block_entity_data.z], [cx, cy, cz]);
const bannerPos = [3, 2, -2].map((v, i) => v + SHRINE.offset[i]);
const bannerIndex = (bannerPos[0] * SHRINE.size[1] + bannerPos[1]) * SHRINE.size[2] + bannerPos[2];
const bannerData = pal.block_position_data[String(bannerIndex)].block_entity_data;
assert.equal(bannerData.id, "Banner", "native patterned banner survives serialization");
assert.equal(bannerData.Base, SILVER_WATCH.baseId, "main banner's green base is preserved");
assert.deepEqual(bannerData.Patterns, SILVER_WATCH.patterns.map((p) => ({
  Pattern: p.code, Color: p.color === "silver" ? 15 : p.colorId,
})), "all main-banner layers preserved, replacing only light gray with white");
assert.equal(SILVER_WATCH.patterns.find((p) => p.code === "cbo").colorId, 7, "main banner outside the shrine remains light gray");
const loot = rootShrineLoot();
assert.ok(loot.pools.every((p) => p.entries.every((e) => e.name !== "minecraft:emerald")), "no emeralds in shrine loot");
const books = loot.pools.filter((p) => p.entries.some((e) => e.name === "minecraft:book"));
assert.equal(books.length, 1, "exactly one Mending reward pool");
assert.equal(books[0].rolls, 1);
assert.equal(books[0].conditions, undefined, "Mending is guaranteed");
assert.equal(books[0].entries.length, 1, "book has no competing or empty result");
assert.deepEqual(books[0].entries[0].functions, [
  { function: "set_count", count: 1 },
  { function: "specific_enchants", enchants: [{ id: "mending", level: 1 }] },
], "exactly one Mending I book");
assert.deepEqual(encoded.buffer, readFileSync(new URL("../lothlorien_bp/structures/lothlorien/root_shrine_01.mcstructure", import.meta.url)), "shipped file matches generator");
assert.deepEqual(rootShrineLoot(), JSON.parse(readFileSync(new URL("../lothlorien_bp/loot_tables/chests/root_shrine.json", import.meta.url), "utf8")));
const worldgen = (kind) => JSON.parse(readFileSync(new URL(`../lothlorien_bp/worldgen/${kind}/giant_mallorn.json`, import.meta.url), "utf8"));
const poolFile = worldgen("template_pools");
assert.deepEqual(poolFile, giantMallornPool(), "rebuilding giants or the shrine preserves its registration");
const pool = poolFile["minecraft:template_pool"];
const shrineEntries = pool.elements.filter((e) => e.element.location === SHRINE.id.replace(":", "/"));
assert.equal(shrineEntries.length, 1);
assert.equal(shrineEntries[0].weight / pool.elements.reduce((sum, e) => sum + e.weight, 0), 0.25,
  "legacy mixed tree pool retains one-in-four shrine selection");
const structure = worldgen("structures")["minecraft:jigsaw"];
assert.equal(structure.start_pool, pool.description.identifier);
assert.equal(structure.start_jigsaw_name, anchorData.name);
assert.equal(structure.start_height.value.absolute, -SHRINE.offset[1], "shrine floor shares the existing ground alignment");
assert.deepEqual(structure.biome_filters, [{ test: "has_biome_tag", value: "lothlorien" }]);
const set = worldgen("structure_sets")["minecraft:structure_set"];
assert.deepEqual(set.placement, {
  type: "minecraft:random_spread", salt: 518204731, separation: 2, spacing: 6, spread_type: "linear",
}, "keep the current Great Mallorn attempt rate and placement grid");
if (set.structures.some(e => e.structure === "lothlorien:elven_village")) {
  assert.ok(set.structures.some(e => e.structure === "lothlorien:tree_grid_shrine" && e.weight === 18),
    "dense prototype selects the complete shrine as its own weighted structure");
} else assert.deepEqual(set.structures, [{ structure: "lothlorien:giant_mallorn", weight: 1 }], "restored legacy selection");
assert.deepEqual(toMcstructure(buildRootShrine().blocks, SHRINE.size, SHRINE.offset, placeEntities(shrine.entities, SHRINE.offset)).buffer, encoded.buffer, "deterministic prototype");
console.log("ok   root shrine: walkable ground-level room, supported decor/rewards, deterministic full tree; legacy mixed-pool weight retained, dense selection covered by tree-grid test");
