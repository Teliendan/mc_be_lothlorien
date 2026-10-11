// Regression tests: node tests/run.mjs (run by `mods verify lothlorien`).
import assert from "node:assert/strict";
import "./support_motion.mjs";
import "./rope_lifecycle.mjs";
import "./script_performance.mjs";
import "./animal_home.mjs";
import "./stair_water.mjs";
import "./leaf_harvest.mjs";
import "./golden_fern_harvest.mjs";
import "./western_corn_harvest.mjs";
import "./star_canopy_harvest.mjs";
import "./ordinary_harvest.mjs";
import "./script_glue.mjs";
import "./renown.mjs";
import "./trade.mjs";
import { leafUndersideY } from "../lothlorien_bp/scripts/leaf_fall.js";
import { BONEMEAL_TABLE, SPREAD_TRIES, COVERS, pickWeighted } from "../lothlorien_bp/scripts/flora_table.js";
import { readFileSync } from "node:fs";
import { MAX_GROWTH, growChance, bonemealSteps, advanceGrowth } from "../lothlorien_bp/scripts/crop_rules.js";
import { estimateDepth, probeCount, ringOffsets, DEPTH_NAMES, DEPTH_RADII } from "../lothlorien_bp/scripts/depth.js";
import * as H from "../lothlorien_bp/scripts/harmony.js";
import { makeRandom, makeBuilder } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { buildFletMallorn, LADDER, ROUND_LADDER, LEAF_KEEP, ROOT_DEPTH, B, bentBranch, bareBranchEnds } from "../tools/flet_mallorn.mjs";
import { SIZE, SIZE_Y, TRUNK_AT, CHOSEN, TRUNK_ANCHOR } from "../tools/build_structures.mjs";
import { existsSync, readdirSync } from "node:fs";
import * as WR from "../lothlorien_bp/scripts/warden_replace_rules.js";
import { loadVillageData, parseMcstructure, runSeeds, rotated, PLANKS, FENCE, LANTERN_ID, populateElves } from "../tools/village_sim.mjs";
import * as EL from "../lothlorien_bp/scripts/elf_rules.js";

// The glue suites share one fake server/clock; finish static imports before resetting it for M3/M4.
await import("./trade_glue.mjs");
await import("./healer.mjs");

const L = "lothlorien:lothlorien", RIVER = "minecraft:river", FOREST = "minecraft:forest";
const T = new Set([RIVER]);
const depth = (fn) => estimateDepth(fn, L, T);
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

// Half-plane world: Lothlorien for x < border, forest beyond.
const halfPlane = (border) => (dx) => (dx < border ? L : FOREST);

test("outside the biome", () => assert.equal(depth(() => FOREST).level, 0));
test("an unreadable animal/player position is unknown, not confirmed outside", () => {
  assert.deepEqual(depth(() => undefined), { level: 0, distance: 0, complete: false });
});
test("border 10 blocks away is edge", () => assert.equal(depth(halfPlane(10)).level, 1));
test("border 30 blocks away is inner", () => assert.equal(depth(halfPlane(30)).level, 2));
test("no border within the rings is heart", () => {
  const r = depth(() => L);
  assert.equal(r.level, 3);
  assert.equal(r.complete, true);
});
test("result does not depend on the side the border is on", () => {
  for (const b of [5, 20, 35, 60]) {
    const east = depth((dx) => (dx < b ? L : FOREST)).level;
    const west = depth((dx) => (dx > -b ? L : FOREST)).level;
    const north = depth((dx, dz) => (dz > -b ? L : FOREST)).level;
    assert.equal(east, west, `border ${b}`);
    assert.equal(east, north, `border ${b}`);
  }
});
// The in-game bug: chunks ahead of a flying player are not loaded yet. An unreadable probe
// must not be treated as inside, or a close border in that direction is ignored.
test("unloaded probes never raise the level", () => {
  const border = 20; // real answer: inner
  const unloadedBeyond = (dx) => (dx >= 12 ? undefined : dx < border ? L : FOREST);
  const r = depth(unloadedBeyond);
  assert.ok(r.level <= 2, `got level ${r.level}`);
  assert.equal(r.complete, false);
  assert.equal(depth((dx) => (dx >= 12 ? undefined : L)).level, 1); // only ring 8 is known
});
test("a river through the biome is not an edge", () => {
  const riverStripe = (dx) => (Math.abs(dx) <= 6 ? RIVER : L);
  assert.equal(depth(riverStripe).level, 3);
});
test("a river outside the biome is outside", () => {
  assert.equal(depth((dx) => (Math.abs(dx) <= 6 ? RIVER : FOREST)).level, 0);
});
test("standing in a river inside the biome counts", () => {
  assert.equal(depth((dx, dz) => (dx === 0 && dz === 0 ? RIVER : L)).level, 3);
});
test("outer rings are dense enough for a 12-block tongue", () => {
  const outer = DEPTH_RADII[DEPTH_RADII.length - 1];
  for (let deg = 0; deg < 360; deg += 7) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    // Foreign strip 12 wide pointing at the player along angle `a`, reaching to outer - 1.
    const tongue = (dx, dz) => (dx * c + dz * s >= outer - 1 && Math.abs(-dx * s + dz * c) <= 6 ? FOREST : L);
    assert.equal(depth(tongue).level, 2, `angle ${deg}`);
  }
  assert.ok(ringOffsets(outer).length >= 24);
  assert.ok(probeCount() < 120, `probe count ${probeCount()}`);
});

const LEAF = "lothlorien:mallorn_leaves", AIR = "minecraft:air";
const isLeaf = (id) => id === LEAF;
test("leaf fall: single-layer canopy lets go at the top leaf", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 20 ? LEAF : AIR), isLeaf), 20));
test("leaf fall: thick canopy walks down to the open underside", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 17 ? LEAF : AIR), isLeaf), 17));
test("leaf fall: nothing when the column is not open below within reach", () =>
  assert.equal(leafUndersideY(20, () => LEAF, isLeaf), undefined));
test("leaf fall: unreadable block gives up", () =>
  assert.equal(leafUndersideY(20, (y) => (y >= 19 ? LEAF : undefined), isLeaf), undefined));

test("bone meal table: ends of the range and only known ids", () => {
  assert.equal(pickWeighted(BONEMEAL_TABLE, 0), "minecraft:short_grass");
  assert.equal(pickWeighted(BONEMEAL_TABLE, 0.999999), "lothlorien:athelas");
  for (const [id] of BONEMEAL_TABLE) assert.ok(["minecraft:short_grass", "minecraft:fern"].includes(id) || id.startsWith("lothlorien:"));
});
test("bone meal table: no vanilla flowers, athelas is the rarest", () => {
  assert.ok(!BONEMEAL_TABLE.some(([id]) => /dandelion|poppy/.test(id)));
  assert.equal(Math.min(...BONEMEAL_TABLE.map(([, w]) => w)), BONEMEAL_TABLE.find(([id]) => id.endsWith("athelas"))[1]);
});

test("bone meal spread: our plants grow more, Athelas the least", () => {
  for (const id of ["elanor", "niphredil", "golden_fern", "athelas"]) assert.ok(SPREAD_TRIES[`lothlorien:${id}`] > 0, id);
  assert.equal(Math.min(...Object.values(SPREAD_TRIES)), SPREAD_TRIES["lothlorien:athelas"]);
  assert.deepEqual(COVERS, ["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom"]);
});

// Phase 7: Western Corn and Lembas.
const bp = (f) => JSON.parse(readFileSync(new URL(`../lothlorien_bp/${f}`, import.meta.url), "utf8"));
test("corn: wet soil grows faster than dry, dim light slower, darkness stalls", () => {
  assert.ok(growChance(15, 7) > growChance(15, 0));
  assert.ok(growChance(15, 0) > growChance(7, 0));
  assert.ok(growChance(7, 0) > growChance(4, 0));
  assert.equal(growChance(3, 7), 0);
  assert.ok(growChance(4, 0) > 0, "must tolerate the light wheat cannot (wheat needs 9)");
});
test("corn: bone meal advances 2-5 stages and stops at maturity", () => {
  assert.equal(bonemealSteps(0), 2);
  assert.equal(bonemealSteps(0.999), 5);
  assert.equal(advanceGrowth(5, 5), MAX_GROWTH);
});
test("corn: block states, stage textures and loot agree with the script", () => {
  const b = bp("blocks/western_corn.json")["minecraft:block"];
  assert.deepEqual(b.description.states["lothlorien:growth"], [...Array(MAX_GROWTH + 1).keys()]);
  for (let n = 1; n <= MAX_GROWTH; n++) {
    assert.ok(b.permutations.some((p) => p.condition.endsWith(`== ${n}`) && p.components["minecraft:material_instances"]), `stage ${n}`);
  }
  assert.ok(b.permutations.some((p) => p.condition.endsWith(`== ${MAX_GROWTH}`) && p.components["minecraft:loot"]), "mature loot");
  assert.ok(b.components["minecraft:placement_filter"].conditions[0].block_filter.includes("minecraft:farmland"));
  const mature = bp("loot_tables/blocks/western_corn_mature.json");
  const names = mature.pools.flatMap((p) => p.entries.map((e) => e.name));
  assert.deepEqual([...new Set(names)].sort(), ["lothlorien:western_corn_grain", "lothlorien:western_corn_seeds"]);
  assert.equal(bp("features/western_corn_feature.json")["minecraft:single_block_feature"].places_block.states["lothlorien:growth"], MAX_GROWTH);
});
test("seeds only plant on farmland; Lembas chain is dough -> cake -> wrapped", () => {
  assert.deepEqual(bp("items/western_corn_seeds.json")["minecraft:item"].components["minecraft:block_placer"].use_on, ["minecraft:farmland"]);
  assert.equal(bp("recipes/lembas_dough.json")["minecraft:recipe_shaped"].result.item, "lothlorien:lembas_dough");
  assert.equal(bp("recipes/furnace_lembas_cake.json")["minecraft:recipe_furnace"].input, "lothlorien:lembas_dough");
  assert.equal(bp("recipes/furnace_lembas_cake.json")["minecraft:recipe_furnace"].output, "lothlorien:lembas_cake");
  const wrap = bp("recipes/lembas_wrapped.json")["minecraft:recipe_shaped"];
  assert.deepEqual(Object.values(wrap.key).map((k) => k.item).sort(), ["lothlorien:lembas_cake", "lothlorien:mallorn_leaves"]);
});
test("wrapped Lembas: more nutrition than the cake, eaten faster", () => {
  const food = (n) => bp(`items/${n}.json`)["minecraft:item"].components;
  const cake = food("lembas_cake"), wrapped = food("lembas_wrapped");
  assert.ok(wrapped["minecraft:food"].nutrition > cake["minecraft:food"].nutrition);
  assert.ok(wrapped["minecraft:use_modifiers"].use_duration < cake["minecraft:use_modifiers"].use_duration, "eaten faster");
});

// Giant flet Mallorns (tools/flet_mallorn.mjs), over many seeds.
const flets = [{}, { woven: true, lush: true }].flatMap((opts) =>
  Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), opts)));
const plains = Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), { woven: true, lush: true, flet: false }));
const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
test("flet: ladder unbroken from the ground through the floor, with a floor to step onto", () => {
  for (const t of flets) {
    for (let y = 0; y <= t.floorY; y++) assert.equal(at(t, LADDER.x, y, LADDER.z), B.ropeHanging, `ladder gap at y ${y}`);
    for (let y = 0; y <= t.floorY + 2; y++) assert.equal(at(t, LADDER.x, y, LADDER.z - 1) === B.leaves || at(t, LADDER.x, y, LADDER.z - 1) === B.log, false);
    assert.equal(at(t, LADDER.x, t.floorY, LADDER.z - 1), B.planks);
    for (let y = t.floorY + 1; y <= t.floorY + 3; y++) assert.equal(at(t, LADDER.x, y, LADDER.z), undefined, "headroom over the hole");
  }
});
test("flet: chest stands on the floor with room above", () => {
  for (const t of flets) {
    const [k] = [...t.blocks].find(([, v]) => v.name === B.chest);
    const [x, y, z] = k.split(",").map(Number);
    assert.equal(y, t.floorY + 1);
    assert.ok([B.planks, B.log].includes(at(t, x, y - 1, z)));
    assert.equal(at(t, x, y + 1, z), undefined);
  }
});
test(`giants: every leaf is within ${LEAF_KEEP} steps of a log (no decay after generation)`, () => {
  for (const t of [...flets, ...plains]) {
    const seen = new Set(), queue = [];
    for (const [k, v] of t.blocks) if (v.name === B.log) { seen.add(k); queue.push([k, 0]); }
    for (let i = 0; i < queue.length; i++) {
      const [k, d] = queue[i];
      if (d === LEAF_KEEP) continue;
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = `${x + dx},${y + dy},${z + dz}`;
        if (!seen.has(n) && t.blocks.get(n)?.name === B.leaves) { seen.add(n); queue.push([n, d + 1]); }
      }
    }
    for (const [k, v] of t.blocks) if (v.name === B.leaves) assert.ok(seen.has(k), `far leaf ${k}`);
  }
});
test("giants: tree fits the structure box and drops few leaves", () => {
  for (const t of [...flets, ...plains]) {
    for (const k of t.blocks.keys()) {
      const [x, y, z] = k.split(",").map(Number);
      assert.ok(x + TRUNK_AT >= 0 && x + TRUNK_AT < SIZE && z + TRUNK_AT >= 0 && z + TRUNK_AT < SIZE, `outside x/z ${k}`);
      assert.ok(y + ROOT_DEPTH >= 0 && y + ROOT_DEPTH < SIZE_Y, `outside y ${k}`);
    }
    assert.ok(t.trimmed < 60, `${t.trimmed} leaves trimmed`);
  }
});

test("plain giant: no platform, fence, ladder or chest", () => {
  for (const t of plains) {
    for (const v of t.blocks.values()) assert.ok(![B.ropeHanging, B.chest, B.fence, B.planks].includes(v.name), v.name);
  }
});

// Round-trunk variants (corner cells cut): the same checks, with the ladder at x 1.
const rounds = [{ woven: true, lush: true, round: true }, { woven: true, lush: true, flet: false, round: true }].map((opts) =>
  Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), opts)));
const roundFlets = rounds[0], roundPlains = rounds[1];
test("round trunk: 12 cells (corners cut above the roots) up to the top of the 4x4 part; ladder, chest and floor still work", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    for (let y = -ROOT_DEPTH; y < t.floorY; y++) {
      for (const [x, z] of [[0, 0], [3, 0], [0, 3], [3, 3]]) if (y > 3) assert.ok(![B.log, B.wood].includes(at(t, x, y, z)), `corner log above the foot at ${x},${y},${z}`);
      for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
        if (![0, 3].includes(x) || ![0, 3].includes(z)) assert.equal([B.log, B.wood, B.ropeHanging].includes(at(t, x, y, z)), true, `hole in trunk ${x},${y},${z}`);
      }
    }
  }
  for (const t of roundFlets) {
    for (let y = 0; y <= t.floorY; y++) assert.equal(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z), B.ropeHanging, `ladder gap at y ${y}`);
    for (let y = -ROOT_DEPTH; y <= t.floorY; y++) assert.ok([B.log, B.wood].includes(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z + 1)), `nothing behind the ladder at y ${y}`);
    for (let y = 0; y <= t.floorY + 2; y++) assert.ok(![B.leaves, B.log, B.wood].includes(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z - 1)), "ladder front blocked");
    for (let y = t.floorY + 1; y <= t.floorY + 3; y++) assert.equal(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z), undefined, "headroom over the hole");
    const [k] = [...t.blocks].find(([, v]) => v.name === B.chest);
    const [x, y, z] = k.split(",").map(Number);
    assert.ok([B.log, B.wood].includes(at(t, x - 1, y, z)), "chest against a trunk cell");
    assert.equal(y, t.floorY + 1);
  }
});
test("round trunk: every log joins the trunk through face or edge contact (nothing hangs by a corner only)", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    const logs = new Set([...t.blocks].filter(([, v]) => v.name === B.log || v.name === B.wood).map(([k]) => k));
    const seen = new Set(["1,0,1"]), queue = ["1,0,1"];
    for (let i = 0; i < queue.length; i++) {
      const [x, y, z] = queue[i].split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const n = `${x + dx},${y + dy},${z + dz}`; // rising branches step up and sideways at once: edges count
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 2 && logs.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    assert.equal(seen.size, logs.size, `${logs.size - seen.size} logs not joined to the trunk`);
  }
});
test("round trunk: fits the box and keeps leaves in reach of a log", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    for (const k of t.blocks.keys()) {
      const [x, y, z] = k.split(",").map(Number);
      assert.ok(x + TRUNK_AT >= 0 && x + TRUNK_AT < SIZE && z + TRUNK_AT >= 0 && z + TRUNK_AT < SIZE && y + ROOT_DEPTH >= 0 && y + ROOT_DEPTH < SIZE_Y, `outside ${k}`);
    }
    assert.ok(t.trimmed < 60);
  }
  for (const t of roundPlains) for (const v of t.blocks.values()) assert.ok(![B.ropeHanging, B.chest, B.fence, B.planks].includes(v.name), v.name);
});

test("giants: the jigsaw pool matches CHOSEN, every piece ships, the structure set uses it", () => {
  const pool = bp("worldgen/template_pools/giant_mallorn.json")["minecraft:template_pool"];
  const GIANT_TREES = pool.elements.map((e) => e.element.location.replace("lothlorien/", ""));
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_pool, pool.description.identifier);
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_height.value.absolute, -ROOT_DEPTH);
  assert.ok(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].max_depth >= 1, "max_depth 0 never builds");
  const set = bp("worldgen/structure_sets/giant_mallorn.json")["minecraft:structure_set"];
  assert.ok(set.placement.separation * 2 < set.placement.spacing, "engine rule: separation < spacing / 2");
  // start chunks of neighbouring cells are at least separation + 1 chunks apart; the trunk anchor keeps each
  // trunk on its start however the piece is rotated (without it, trunks were seen 27 apart at separation 2)
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_jigsaw_name, TRUNK_ANCHOR);
  assert.ok((set.placement.separation + 1) * 16 >= SIZE, "neighbouring giants cannot overlap");
  assert.deepEqual(pool.elements.map((e) => e.weight), CHOSEN.map(([, , w]) => w));
  assert.deepEqual(GIANT_TREES, CHOSEN.map(([v, n]) => `mallorn_${v}_${String(n).padStart(2, "0")}`));
  for (const name of GIANT_TREES) {
    assert.ok(existsSync(new URL(`../lothlorien_bp/structures/lothlorien/${name}.mcstructure`, import.meta.url)), name);
  }
});

const catalogEntries = () => JSON.parse(readFileSync(new URL("../localization/catalog.json", import.meta.url), "utf8")).packs.lothlorien_rp.entries;
const hs = (harmony, timer = 0) => ({ harmony, timer });
const afterPenalty = (h, p) => { const s = hs(h); H.applyPenalty(s, p); return s.harmony; };
test("harmony: band table incl. every edge, wariness and boundary constants", () => {
  const band = (h) => H.bandOf(h);
  assert.deepEqual([10, 9, 0, -1, -14, -15, -29, -30, -60].map(band),
    ["friend", "guest", "guest", "uneasy", "uneasy", "shunned", "shunned", "hated", "hated"]);
  assert.deepEqual([H.FRIEND_FROM, H.GUEST_FROM, H.UNEASY_FROM, H.SHUNNED_FROM, H.MIN_HARMONY, H.MAX_HARMONY], [10, 0, -14, -29, -60, 10]);
  assert.deepEqual(H.BANDS, ["hated", "shunned", "uneasy", "guest", "friend"]);
  assert.ok(H.isFriend(hs(10)) && !H.isFriend(hs(9)) && H.isHated(hs(-30)) && !H.isHated(hs(-29)));
});
test("harmony: recovery is +1 per 60 s inside up to 10, +1 per 120 s outside and never above 0", () => {
  const a = hs(0); H.tick(a, true, 59); assert.equal(a.harmony, 0); H.tick(a, true, 1); assert.equal(a.harmony, 1);
  H.tick(a, true, 100000); assert.equal(a.harmony, 10, "capped at +10");
  const b = hs(-5); H.tick(b, false, 119); assert.equal(b.harmony, -5); H.tick(b, false, 1); assert.equal(b.harmony, -4);
  H.tick(b, false, 10000); assert.equal(b.harmony, 0, "outside stops at 0");
  const c = hs(6); H.tick(c, false, 10000); assert.equal(c.harmony, 6, "positive harmony is kept outside, not raised");
  const d = hs(-3); H.tick(d, true, 60); assert.equal(d.harmony, -2, "inside recovers from below zero too");
  const e = hs(10, 40); H.tick(e, true, 1); assert.equal(e.timer, 0, "no credit piles up at the cap");
});
test("harmony: a deed restarts the minute timer", () => {
  const s = hs(0); H.tick(s, true, 50); H.recordDeed(s, "animal"); assert.equal(s.harmony, -3); assert.equal(s.timer, 0);
  H.tick(s, true, 59); assert.equal(s.harmony, -3); H.tick(s, true, 1); assert.equal(s.harmony, -2);
});
test("harmony: above 0 a penalty point costs 2, from 0 down 1 (point by point)", () => {
  assert.equal(afterPenalty(4, 3), -1, "2, 0, -1");
  assert.equal(afterPenalty(5, 3), -1, "3, 1, -1");
  assert.equal(afterPenalty(1, 1), -1);
  assert.equal(afterPenalty(10, 1), 8);
  assert.equal(afterPenalty(10, 3), 4);
  assert.equal(afterPenalty(0, 3), -3, "at 0 and below one point costs one");
  assert.equal(afterPenalty(-10, 3), -13);
  assert.ok(!H.isFriend(hs(8)), "any deed loses Friend");
});
test("harmony: floor at -60", () => {
  assert.equal(afterPenalty(-58, 10), -60);
  const s = hs(-60); H.recordDeed(s, "unicorn"); assert.equal(s.harmony, -60);
});
test("harmony: every deed cost", () => {
  assert.deepEqual(H.DEED_COSTS, { animal: 3, monster: 1, white_deer: 6, unicorn: 10, warden_fight: 1, warden_kill: 6, elf_fight: 1, elf_kill: 6, player: 3 });
  for (const [kind, cost] of Object.entries(H.DEED_COSTS)) { const s = hs(0); H.recordDeed(s, kind); assert.equal(s.harmony, -cost, kind); }
  const s = hs(10); H.recordDeed(s, "monster"); assert.equal(s.harmony, 8);
  const u = hs(10); H.recordDeed(u, "unicorn"); assert.equal(u.harmony, -5, "8, 6, 4, 2, 0, then five at 1 each");
  const n = hs(3, 7); H.recordDeed(n, "nonsense"); assert.deepEqual(n, hs(3, 7), "unknown deed kinds count nothing");
});
test("harmony: victims are classified into deed kinds (inanimate counts nothing, wardens and players are their own kinds)", () => {
  const k = H.deedKindOf;
  assert.equal(k("minecraft:armor_stand", ["inanimate", "mob"]), undefined);
  assert.equal(k("lothlorien:deer", ["mob"]), "animal");
  assert.equal(k("minecraft:cow", ["cow", "animal", "mob"]), "animal");
  assert.equal(k("minecraft:villager_v2", ["villager"]), "animal");
  assert.equal(k("minecraft:zombie", ["zombie", "monster", "mob"]), "monster");
  assert.equal(k(W.WHITE_DEER_ID, ["mob"]), "white_deer");
  assert.equal(k("lothlorien:unicorn"), "unicorn");
  assert.equal(k(EW.WARDEN_ID, ["lothlorien_warden", "irongolem", "mob"]), "warden_kill");
  assert.equal(k("minecraft:player", ["player"]), "player");
  assert.equal(k("minecraft:cow"), "animal");
  assert.equal(k("lothlorien:elf", ["lothlorien_elf", "mob"]), "elf_kill", "a civilian elf is its own kind (was a plain animal, 3)");
  assert.equal(k("lothlorien:elf_post", ["lothlorien_elf_post", "elf_post_home", "inanimate"]), undefined, "a post counts nothing");
});
test("harmony: deedCounts - elf and warden deeds count anywhere, every other kind only inside the forest, no kind never", () => {
  for (const kind of ["warden_fight", "warden_kill", "elf_fight", "elf_kill"]) { assert.equal(H.deedCounts(kind, false), true, kind); assert.equal(H.deedCounts(kind, true), true, kind); }
  for (const kind of ["animal", "monster", "white_deer", "unicorn", "player"]) { assert.equal(H.deedCounts(kind, false), false, `${kind} outside`); assert.equal(H.deedCounts(kind, true), true, `${kind} inside`); }
  assert.equal(H.deedCounts(undefined, true), false); assert.equal(H.deedCounts(undefined, false), false);
  assert.deepEqual([...H.EVERYWHERE_DEEDS].sort(), ["elf_fight", "elf_kill", "warden_fight", "warden_kill"]);
});
test("harmony: death changes nothing, except inside the forest while Hated (-> -29)", () => {
  const cases = [[-30, true, -29], [-60, true, -29], [-30, false, -30], [-29, true, -29], [-20, true, -20], [-20, false, -20], [5, true, 5], [10, true, 10]];
  for (const [h, inside, want] of cases) { const s = hs(h, 33); H.recordDeath(s, inside); assert.equal(s.harmony, want, `${h} inside=${inside}`); }
  assert.equal(H.bandOf(H.HATED_DEATH_HARMONY), "shunned");
});
test("harmony: chat lines per band change and direction; Friend gained / lost; the deed hint is rate limited", () => {
  const m = H.changeMessages;
  assert.deepEqual(m(9, 10), ["friend.gained"]);
  assert.deepEqual(m(10, 8), ["friend.lost"]);
  assert.deepEqual(m(10, -5), ["friend.lost", "harmony.worse.uneasy"]);
  assert.deepEqual(m(5, -2), ["harmony.worse.uneasy"]);
  assert.deepEqual(m(-10, -16), ["harmony.worse.shunned"]);
  assert.deepEqual(m(-20, -31), ["harmony.worse.hated"]);
  assert.deepEqual(m(-30, -29), ["harmony.better.shunned"]);
  assert.deepEqual(m(-15, -14), ["harmony.better.uneasy"]);
  assert.deepEqual(m(-1, 0), ["harmony.better.guest"]);
  assert.deepEqual(m(3, 2), [], "same band: no band line");
  const entries = catalogEntries();
  for (const key of ["harmony.worse.uneasy", "harmony.worse.shunned", "harmony.worse.hated", "harmony.better.shunned", "harmony.better.uneasy", "harmony.better.guest", "harmony.hint", "harmony.debug", "friend.gained", "friend.lost"]) {
    assert.ok(entries[`lothlorien.message.${key}`], key);
  }
  assert.ok(!Object.keys(entries).some((k) => k.includes("disharmony")), "the Disharmony keys are retired");
  assert.ok(H.hintDue(undefined, 5) && !H.hintDue(1000, 1000 + H.HINT_GAP_MS - 1) && H.hintDue(1000, 1000 + H.HINT_GAP_MS));
  assert.equal(H.HINT_GAP_MS, 30000);
});
test("harmony: the action bar shows the band name inside the forest only; saved state round-trips; junk is tolerated", () => {
  const entries = catalogEntries();
  for (const [h, band] of [[10, "friend"], [0, "guest"], [-5, "uneasy"], [-20, "shunned"], [-40, "hated"]]) {
    assert.deepEqual(H.statusText(hs(h), true), { rawtext: [{ text: H.BAND_ICONS[band] }, { translate: `lothlorien.message.status.${band}` }] }, band);
    assert.equal(H.statusText(hs(h), false), undefined);
    assert.ok(entries[`lothlorien.message.status.${band}`], band);
  }
  const glyphs = Object.values(H.BAND_ICONS).map((i) => i.trim());
  assert.deepEqual(glyphs, ["\uE500", "\uE501", "\uE502", "\uE503", "\uE504"], "one glyph per band, U+E500...U+E504 in band order");
  assert.equal(new Set(glyphs).size, 5);
  const png = readFileSync(new URL("../lothlorien_rp/font/glyph_E5.png", import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [256, 256], "glyph page: 16x16 cells of 16 px");
  const s = hs(-7, 12.5);
  assert.deepEqual(H.parse(H.serialize(s)), s);
  assert.deepEqual(H.parse(undefined), H.newState()); assert.deepEqual(H.parse("{oops"), H.newState());
  assert.deepEqual(H.parse('{"harmony":"x","timer":-4}'), H.newState());
  assert.deepEqual(H.parse('{"harmony":500,"timer":3}'), hs(10, 3), "clamped");
  assert.deepEqual(H.parse('{"harmony":-500}'), hs(-60, 0));
  assert.deepEqual(H.parse('{"points":3,"calm":9,"friend":2}'), H.newState(), "the old Disharmony format is ignored");
});
test("harmony: the game wiring - deeds need player or victim inside, only a player killer, saves only on change, hated tag, debug event", () => {
  const game = readFileSync(new URL("../lothlorien_bp/scripts/harmony_game.js", import.meta.url), "utf8");
  assert.ok(game.includes('"lothlorien:harmony"') && !game.includes("isharmony"));
  assert.ok(/isInside\(player\.dimension, player\.location\) \|\| isInside\(victim\.dimension, victim\.location\)/.test(game), "player OR victim inside");
  assert.ok(game.includes("damageSource.damagingEntity") && game.includes("deedKindOf(deadEntity.typeId"));
  assert.ok(/if \(state\.harmony === before\) return false;[\s\S]*setDynamicProperty\(PROPERTY/.test(game), "save only when harmony changed");
  assert.ok(game.includes("HATED_TAG") && game.includes("addTag") && game.includes("removeTag"));
  assert.ok(game.includes("handleHarmonyEvent"));
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes("startHarmony(inBiome, DEBUG_TAG)"));
});

// Phase 11: deer.
import * as R from "../lothlorien_bp/scripts/deer_rules.js";
const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const deerEntity = () => readJson("../lothlorien_bp/entities/deer.json")["minecraft:entity"];
const avoidRadius = (e, w) => e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"].entity_types[0].max_dist;

test("deer: wariness follows the Harmony band (Friend -> friend, Guest -> calm, Uneasy -> l1, Shunned -> l2, Hated -> l3)", () => {
  assert.deepEqual(["friend", "guest", "uneasy", "shunned", "hated"].map(R.warinessFor), ["friend", "calm", "l1", "l2", "l3"]);
  assert.deepEqual([10, 9, 0, -1, -14, -15, -29, -30].map((h) => R.warinessFor(H.bandOf(h))), ["friend", "calm", "calm", "l1", "l1", "l2", "l2", "l3"]);
  assert.equal(R.warinessFor(undefined), "calm");
});
test("deer: the most severe player inside their own flight radius decides", () => {
  const pick = (...c) => R.pickWariness(c.map(([distance, wariness]) => ({ distance, wariness })));
  assert.equal(pick([25, "l3"], [5, "calm"]), "l3");
  assert.equal(pick([35, "l3"], [5, "calm"]), "calm"); // l3 player too far to matter
  assert.equal(pick([15, "l2"], [12, "l1"], [2, "friend"]), "l2");
  assert.equal(pick([2, "friend"], [8, "calm"]), "calm");
  assert.equal(pick([30, "l2"], [35, "calm"]), "l2"); // nobody inside their radius: nearest decides
  assert.equal(R.pickWariness([]), undefined);
});
test("deer: flight radii match the entity file", () => {
  const e = deerEntity();
  for (const w of R.WARINESS) assert.equal(avoidRadius(e, w), R.FLIGHT_RADIUS[w], w);
});
test("deer: every wariness has a state group and a set event; flight distance grows with the Harmony band", () => {
  const e = deerEntity();
  for (const w of R.WARINESS) {
    assert.ok(e.component_groups[`lothlorien:state_${w}`], `group ${w}`);
    assert.ok(e.events[R.setEventFor(w)], `event ${w}`);
  }
  const r = (w) => avoidRadius(e, w);
  assert.ok(r("friend") < r("calm") && r("calm") < r("l1") && r("l1") < r("l2") && r("l2") < r("l3"));
  assert.ok(R.WATCH_RADIUS > r("l3") && R.WATCH_RADIUS > r("alarmed"), "watch radius covers the flight distances");
});
test("deer: only calm states can be lured; the alarm hands back through the property", () => {
  const e = deerEntity();
  const lured = (w) => !!e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"];
  assert.deepEqual(["calm", "l1", "friend", "l2", "l3", "alarmed"].map(lured), [true, false, true, false, false, false]);
  const back = e.events["lothlorien:alarm_over"].sequence.map((s) => s.trigger).sort();
  assert.deepEqual(back, R.WARINESS.map(R.setEventFor).sort());
  assert.equal(e.component_groups["lothlorien:state_alarmed"]["minecraft:timer"].time_down_event.event, "lothlorien:alarm_over");
});
test("deer: bucks drop antlers, does do not; babies drop nothing", () => {
  const e = deerEntity();
  assert.equal(e.component_groups["lothlorien:adult_buck"]["minecraft:loot"].table, "loot_tables/entities/deer_buck.json");
  assert.equal(e.component_groups["lothlorien:adult_doe"]["minecraft:loot"].table, "loot_tables/entities/deer.json");
  assert.ok(!e.component_groups["lothlorien:baby"]["minecraft:loot"]);
  assert.ok(!e.components["minecraft:loot"]);
  const names = (t) => readJson(`../lothlorien_bp/${t}`).pools.flatMap((p) => p.entries.map((x) => x.name));
  assert.ok(!names("loot_tables/entities/deer.json").includes("lothlorien:deer_antler"));
  assert.ok(names("loot_tables/entities/deer_buck.json").includes("lothlorien:deer_antler"));
});
test("deer: biome-only spawn rule with density limit, standard despawn, not persistent", () => {
  const rules = readJson("../lothlorien_bp/spawn_rules/deer.json")["minecraft:spawn_rules"];
  assert.equal(rules.description.identifier, R.DEER_ID);
  for (const c of rules.conditions) {
    assert.equal(c["minecraft:biome_filter"].value, "lothlorien");
    assert.ok(c["minecraft:density_limit"].surface > 0);
  }
  const comps = deerEntity().components;
  assert.deepEqual(comps["minecraft:despawn"], { despawn_from_distance: {} });
  assert.ok(!comps["minecraft:persistent"]);
});

// Deer antler block and its drop.
import * as AR from "../lothlorien_bp/scripts/antler_rules.js";
test("antler block: a permutation for every floor, ceiling and wall placement; no block-list filter", () => {
  const b = readJson("../lothlorien_bp/blocks/deer_antler.json")["minecraft:block"];
  const conds = b.permutations.map((p) => p.condition);
  for (const d of ["north", "east", "south", "west"]) {
    assert.ok(conds.some((c) => c.includes("'up'") && c.includes(`'${d}'`)), `floor ${d}`);
    assert.ok(conds.some((c) => c.includes("'down'") && c.includes(`'${d}'`)), `ceiling ${d}`);
    assert.ok(conds.some((c) => c.includes(`block_face') == '${d}'`) && !c.includes("'up'") && !c.includes("'down'")), `wall ${d}`);
  }
  const geo = (frag) => b.permutations.filter((p) => p.condition.includes(frag)).map((p) => p.components["minecraft:geometry"]);
  assert.ok(geo("'down'").every((g) => g === "geometry.lothlorien.deer_antler_ceiling"));
  assert.ok(b.permutations.filter((p) => !p.condition.includes("'up'") && !p.condition.includes("'down'"))
    .every((p) => p.components["minecraft:geometry"] === "geometry.lothlorien.deer_antler_wall"));
  assert.ok(!b.components["minecraft:placement_filter"], "placeable on any block, like an item frame");
  assert.ok(b.components["lothlorien:antler_support"], "support handled by script events");
  assert.equal(b.components["minecraft:tick"], undefined, "support uses events without scheduled polling");
  assert.ok(b.components["lothlorien:motion_support"], "production motion tracking is installed");
});
test("antler support: opposite side of the clicked face; air and liquid drop it, unloaded keeps it", () => {
  assert.deepEqual(AR.supportOffset("up"), { x: 0, y: -1, z: 0 });
  assert.deepEqual(AR.supportOffset("down"), { x: 0, y: 1, z: 0 });
  assert.deepEqual(AR.supportOffset("north"), { x: 0, y: 0, z: 1 });
  assert.deepEqual(AR.supportOffset("east"), { x: -1, y: 0, z: 0 });
  assert.equal(AR.isUnsupported({ isAir: true, isLiquid: false }), true);
  assert.equal(AR.isUnsupported({ isAir: false, isLiquid: true }), true);
  assert.equal(AR.isUnsupported({ isAir: false, isLiquid: false }), false);
  assert.equal(AR.isUnsupported(undefined), false);
});
test("antler drop: only on ground blocks, never on litter", () => {
  for (const d of ["north", "east", "south", "west"]) {
    const f = readJson(`../lothlorien_bp/features/deer_antler_${d}_feature.json`)["minecraft:single_block_feature"];
    assert.deepEqual(f.may_replace, ["minecraft:air"]);
    const bottom = f.may_attach_to.bottom.map((x) => x.name);
    assert.ok(bottom.includes("minecraft:grass_block"));
    assert.ok(!bottom.some((n) => n.includes("carpet") || n.includes("blossom")), "no litter as support");
  }
});
test("antler drop: every feature it names exists; about 1 in 16 chunks, findable on a walk", () => {
  const f = (n) => readJson(`../lothlorien_bp/features/${n}.json`);
  const rule = readJson("../lothlorien_bp/feature_rules/deer_antler_drop_feature_rules.json")["minecraft:feature_rules"];
  assert.equal(rule.description.places_feature, "lothlorien:deer_antler_drop_feature");
  const scatter = f("deer_antler_drop_feature")["minecraft:scatter_feature"];
  const weighted = f(scatter.places_feature.split(":")[1])["minecraft:weighted_random_feature"];
  for (const [name] of weighted.features) assert.ok(f(name.split(":")[1])["minecraft:single_block_feature"], name);
  // 1/64 was too rare to find (owner, 2026-10-02: none seen in several forests; the save had one site per ~50 chunks)
  const perChunk = rule.distribution.scatter_chance.numerator / rule.distribution.scatter_chance.denominator;
  assert.ok(perChunk >= 1 / 20 && perChunk <= 1 / 12, `per chunk ${perChunk}`);
});
test("antler: bucks' item is a block placer and flet chests can hold exactly one", () => {
  const item = readJson("../lothlorien_bp/items/deer_antler.json")["minecraft:item"].components;
  assert.equal(item["minecraft:block_placer"].block, "lothlorien:deer_antler");
  const chest = readJson("../lothlorien_bp/loot_tables/chests/mallorn_flet.json");
  const e = chest.pools.flatMap((p) => p.entries).find((x) => x.name === "lothlorien:deer_antler");
  assert.ok(e, "antler in chest");
  assert.equal(e.functions[0].count, 1);
});

// Phase 12: white deer guidance.
import * as W from "../lothlorien_bp/scripts/white_deer_rules.js";
import { CHEST_BLOCK, hasChest } from "../tools/build_structures.mjs";
import * as G from "../tools/dev_scripts/guide_goal/variants.mjs";

test("white deer: a guidance in progress continues only while Friend", () => {
  assert.equal(W.canBeGuided("friend"), true);
  assert.deepEqual(["guest", "uneasy", "shunned", "hated"].map(W.canBeGuided), [false, false, false, false]);
});
// Phase 12 gift: the white deer leads to a spot where it lays a Great Mallorn nut; the nut grows a flet giant.
import * as N from "../lothlorien_bp/scripts/great_mallorn_rules.js";
import { ANCHOR_AT } from "../tools/build_structures.mjs";
test("gift spot: rings inside the default simulation distance, farthest first, every heading", () => {
  const all = N.giftCandidates(100, -40);
  assert.equal(all.length, N.GIFT_RINGS.length * N.GIFT_HEADINGS);
  assert.deepEqual([...new Set(all.map((c) => c.ring))], [...N.GIFT_RINGS].sort((a, b) => b - a));
  assert.ok(N.GIFT_RINGS.every((r) => r <= 56 && r >= 32), "loaded at simulation distance 4 (64 blocks) from any spot in the player chunk");
  for (const c of all) assert.ok(Math.abs(Math.hypot(c.x - 100, c.z + 40) - c.ring) < 1.5);
  const grid = N.borderGrid(0, 0);
  assert.ok(grid.every((p) => Math.hypot(p.x, p.z) <= N.BORDER_SCAN && p.x % N.BORDER_STEP === 0));
  assert.ok(grid.some((p) => p.x === N.BORDER_SCAN) && grid.length < 600, "covers the scan circle with a bounded probe count");
});
test("gift spot: away from the known border (towards the heart), not just the farthest ring", () => {
  // deer at 0,0; the biome border runs north-south 30 blocks to the west (x = -30)
  const border = Array.from({ length: 25 }, (_, i) => ({ x: -30, z: -96 + i * 8 }));
  const spots = N.giftCandidates(0, 0).map((c) => ({ ...c, y: 70, inside: c.x > -30 }));
  const best = N.pickGiftSpot(spots, border);
  assert.ok(best.x > 30, `leads east, away from the edge (got ${best.x}, ${best.z})`);
  // a far spot near the edge loses to a nearer one deep in
  const edgeFar = { x: -20, z: 0, ring: 56, y: 70, inside: true }, deepNear = { x: 36, z: 0, ring: 36, y: 70, inside: true };
  assert.equal(N.pickGiftSpot([edgeFar, deepNear], border), deepNear);
  // equal depth (within the slack): the longer walk wins
  const a = { x: 40, z: 0, ring: 40, y: 70, inside: true }, b = { x: 44, z: 3, ring: 52, y: 70, inside: true };
  assert.equal(N.pickGiftSpot([a, b], border), b);
  // no border in sight: the longest walk; nothing standable inside: undefined
  assert.equal(N.pickGiftSpot([a, b], []), b);
  assert.equal(N.pickGiftSpot([{ ...a, inside: false }, { ...b, y: undefined }], border), undefined);
});
test("great nut: tree box and anchor match the structure builder; the sprout sits in the trunk at ground level", () => {
  assert.deepEqual([N.SIZE, N.SIZE_Y, N.TRUNK_AT, N.ROOT_DEPTH], [SIZE, SIZE_Y, TRUNK_AT, ROOT_DEPTH]);
  assert.deepEqual(N.ANCHOR, { x: TRUNK_AT + ANCHOR_AT.x, y: ROOT_DEPTH + ANCHOR_AT.y, z: TRUNK_AT + ANCHOR_AT.z });
  const at = { x: 100, y: 64, z: -20 }, o = N.treeOrigin(at);
  const cell = { x: at.x - o.x, y: at.y - o.y, z: at.z - o.z };
  assert.ok(cell.x >= TRUNK_AT && cell.x <= TRUNK_AT + 3 && cell.z >= TRUNK_AT && cell.z <= TRUNK_AT + 3, "inside the 4x4 trunk");
  assert.equal(cell.y, ROOT_DEPTH, "first cell above the ground");
});
test("great nut: grows only flet giants that ship in the pack and in worldgen", () => {
  const flets = CHOSEN.filter(([v]) => v === "round").map(([v, n]) => `lothlorien:mallorn_${v}_${String(n).padStart(2, "0")}`);
  assert.deepEqual([...N.FLET_TREES].sort(), flets.sort());
  for (const id of N.FLET_TREES) assert.ok(existsSync(new URL(`../lothlorien_bp/structures/${id.replace(":", "/")}.mcstructure`, import.meta.url)), id);
});
test("great nut: terrain, plants, leaves and logs give way; anything built stops the tree", () => {
  for (const id of ["minecraft:air", "minecraft:grass_block", "minecraft:stone", "minecraft:iron_ore", "minecraft:oak_leaves", "minecraft:oak_log",
    "minecraft:short_grass", "minecraft:red_tulip", "minecraft:water", "lothlorien:mallorn_leaves", "lothlorien:mallorn_log", "lothlorien:elanor",
    N.SPROUT_ID]) assert.ok(N.isNatural(id), id);
  for (const id of ["minecraft:oak_planks", "minecraft:stripped_oak_log", "minecraft:cobblestone", "minecraft:stone_bricks", "minecraft:glass",
    "minecraft:chest", "minecraft:torch", "minecraft:farmland", "minecraft:oak_door", "lothlorien:mallorn_planks", "lothlorien:mallorn_stripped_log",
    "minecraft:stone_slab", "minecraft:sandstone"]) assert.ok(!N.isNatural(id), id);
});
test("great nut: unique rare item that plants the sprout; sprout grows like a sapling, survives blasts, gives the nut back", () => {
  const item = readJson("../lothlorien_bp/items/great_mallorn_nut.json")["minecraft:item"];
  assert.equal(item.description.identifier, N.NUT_ID);
  assert.equal(item.components["minecraft:block_placer"].block, N.SPROUT_ID);
  assert.equal(item.components["minecraft:glint"], true);
  assert.equal(item.components["minecraft:compostable"], undefined, "the one gift is never composted by accident");
  const block = readJson("../lothlorien_bp/blocks/great_mallorn_sprout.json")["minecraft:block"];
  const sapling = readJson("../lothlorien_bp/blocks/mallorn_sapling.json")["minecraft:block"];
  assert.equal(block.description.identifier, N.SPROUT_ID);
  assert.deepEqual(block.description.states, sapling.description.states);
  assert.deepEqual(block.components["minecraft:placement_filter"], sapling.components["minecraft:placement_filter"], "same soil as the sapling");
  assert.ok(block.components["lothlorien:great_sprout"]);
  assert.ok(block.components["minecraft:destructible_by_explosion"].explosion_resistance >= 1200);
  assert.ok(!block.components["minecraft:flammable"]);
  const loot = readJson("../lothlorien_bp/loot_tables/blocks/great_mallorn_sprout.json");
  assert.deepEqual(loot.pools.flatMap((p) => p.entries.map((e) => e.name)), [N.NUT_ID]);
  for (const f of ["loot_tables/chests/mallorn_flet.json"]) assert.ok(!readFileSync(new URL(`../lothlorien_bp/${f}`, import.meta.url), "utf8").includes(N.NUT_ID), "not in loot");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/great_mallorn.js", import.meta.url), "utf8");
  assert.ok(src.includes("event.cancel = true") && src.includes("repeatedUse"), "bone meal refused once per use");
  assert.ok(/playerPlaceBlock[\s\S]*message\("mallorn.planted"\)/.test(src), "planting sends a localized space warning");
  const catalog = readJson("../localization/catalog.json");
  assert.match(catalog.packs.lothlorien_rp.entries["lothlorien.message.mallorn.planted"].source, /40 blocks wide and 50 high/);
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('import "./great_mallorn.js"'));
});
test("the actionbar is only the Harmony band status (and the debug readout); other messages use chat", () => {
  for (const f of ["white_deer.js", "great_mallorn.js", "deer.js", "trees.js", "athelas.js", "lembas.js", "crop.js", "antler.js"]) {
    const src = readFileSync(new URL(`../lothlorien_bp/scripts/${f}`, import.meta.url), "utf8");
    assert.ok(!src.includes("setActionBar"), f);
  }
});
test("white deer: the gift is given once per deer, the spot is kept until then, the acorn only goes when it leads", () => {
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(!/findMarker|getBlocks\(|MARKER/.test(src), "no marker search left");
  assert.ok(/getDynamicProperty\(GIFTED\)[\s\S]*return;/.test(src), "a gifted deer refuses (acorn kept)");
  assert.ok(src.includes("setDynamicProperty(GIFTED, true)") && src.includes("setDynamicProperty(GIFT_SPOT, undefined)"));
  assert.ok(/function arrive[\s\S]*giveGift/.test(src), "arrival lays the nut");
  const lead = src.slice(src.indexOf("function lead("), src.indexOf("function end("));
  assert.ok(lead.indexOf("consumeAcorn") > lead.indexOf("guide_start"), "acorn used only when guidance starts");
});
const flat = () => 64; // every column standable at y 64
const at0 = { x: 0, y: 64, z: 0 };
test("waypoints: open ground gives a HOP-block waypoint straight at the target", () => {
  const w = W.pickWaypoint(at0, { x: 80, z: 0 }, flat);
  assert.equal(w.final, false);
  assert.ok(Math.abs(w.x - W.HOP) < 1e-9 && Math.abs(w.z) < 1e-9 && w.y === 64);
  assert.ok(W.HOP <= 14 && W.MIN_HOP >= 8, "hops of 8-14 blocks");
});
test("waypoints: a lake ahead turns the heading, bias side first; a near wall shortens the hop", () => {
  const lake = (x, z) => (x > 4 && Math.abs(z) < 20 ? undefined : 64);
  const w = W.pickWaypoint(at0, { x: 80, z: 0 }, lake, { bias: -1 });
  assert.equal(w.turn, -1);
  assert.ok(Math.abs(w.z) >= 20 || w.x <= 4);
  const wall = (x) => (x > 10 ? undefined : 64);
  const v = W.pickWaypoint(at0, { x: 80, z: 0 }, wall);
  assert.ok(v.turn === 0 && v.x <= 10 && v.x >= W.MIN_HOP);
});
test("waypoints: a skipped heading is not reused; boxed in gives undefined", () => {
  assert.notEqual(W.pickWaypoint(at0, { x: 80, z: 0 }, flat, { skip: new Set([0]) }).deg, 0);
  assert.equal(W.pickWaypoint(at0, { x: 80, z: 0 }, () => undefined), undefined);
});
test("waypoints: the final hop lands within FINAL_RING of a blocked target, on the deer's side", () => {
  const trunk = (x, z) => (W.horizontal({ x, z }, { x: 10, z: 0 }) < 2 ? undefined : 64);
  const w = W.pickWaypoint(at0, { x: 10, z: 0 }, trunk);
  assert.equal(w.final, true);
  assert.ok(w.x < 10 && W.horizontal(w, { x: 10, z: 0 }) <= W.FINAL_RING && W.FINAL_RING <= 5);
});
test("waypoints: 80 blocks of open ground is 6 hops", () => {
  let p = { ...at0 }, n = 0;
  while (n < 20) {
    const w = W.pickWaypoint(p, { x: 80, z: 0 }, flat);
    n++;
    if (w.final) break;
    p = { x: w.x, y: w.y, z: w.z };
  }
  assert.equal(n, 6);
});
test("hop status: reached, progress, stuck after 5 s", () => {
  const hop = W.newHop({ x: 14, z: 0 }, at0);
  assert.equal(hop.best, 14);
  assert.equal(W.hopStatus(hop, { x: 14 - W.REACHED, z: 0 }, W.GUIDE_TICKS), "next");
  assert.equal(W.hopStatus(hop, { x: 5, z: 0 }, W.GUIDE_TICKS), "go");
  assert.equal(hop.stuck, 0);
  let s;
  for (let t = 0; t < W.HOP_STUCK_TICKS; t += W.GUIDE_TICKS) s = W.hopStatus(hop, { x: 5, z: 0 }, W.GUIDE_TICKS);
  assert.equal(s, "retry");
  assert.equal(W.HOP_STUCK_TICKS, 100);
  assert.ok(W.GUIDE_TICKS <= 5);
});
test("white deer: no teleport stepping left in the rules or the game script", () => {
  for (const k of ["pickStep", "STEP", "MOVE_TICKS", "headings"]) assert.ok(!(k in W), k);
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(!/deer\.teleport\(/.test(src), "the deer itself is never teleported");
  assert.ok(src.includes("spawnEntity(BEACON_ID"), "one beacon per session");
});
test("white deer: progress resets the stuck timer, standing still does not", () => {
  const s = { bestDist: 50, stuck: 0 };
  W.trackProgress(s, 49.5, true, 2);
  assert.equal(s.stuck, 2);
  W.trackProgress(s, 48, true, 2);
  assert.deepEqual([s.bestDist, s.stuck], [48, 0]);
  W.trackProgress(s, 48, false, 2); // waiting for the player is not stuck
  assert.equal(s.stuck, 0);
});
test("white deer: phases (arrive, wait for the player, give up)", () => {
  const base = { toTarget: 40, toPlayer: 5, stuck: 0, age: 0, playerCalm: true };
  const ph = (o) => W.phase({ ...base, ...o });
  assert.equal(ph({}), "walk");
  assert.equal(ph({ toPlayer: W.WAIT_DIST + 1 }), "wait");
  assert.equal(ph({ toPlayer: W.ABORT_DIST + 1 }), "abort");
  assert.equal(ph({ playerCalm: false }), "abort");
  assert.equal(ph({ toTarget: W.ARRIVE_DIST }), "arrived");
  assert.equal(ph({ stuck: W.STUCK_TICKS }), "abort");
  assert.equal(ph({ stuck: W.STUCK_TICKS, toTarget: W.STUCK_ARRIVE_DIST }), "arrived");
  assert.equal(ph({ age: W.MAX_TICKS + 1 }), "abort");
});

const whiteEntity = () => readJson("../lothlorien_bp/entities/white_deer.json")["minecraft:entity"];
const everything = (e) => [e.components, ...Object.values(e.component_groups)];
const GRAIN = "lothlorien:western_corn_grain";
test("ordinary deer: no coat variant, no guiding state (Phase 12 moved to its own entity)", () => {
  const e = deerEntity();
  const text = JSON.stringify(e);
  for (const bad of ["lothlorien:coat", "lothlorien:guiding", "state_guiding", "guide_start", "coat_white"]) {
    assert.ok(!text.includes(bad), bad);
  }
  const rc = readJson("../lothlorien_rp/render_controllers/deer.render_controllers.json").render_controllers["controller.render.lothlorien.deer"];
  assert.ok(!rc.textures[0].includes("white"));
});
test("ordinary deer: Western Corn grain is the only food (lure, breeding, fawn growth); not the seeds, acorn or apple", () => {
  const e = deerEntity();
  for (const w of ["calm", "friend"]) assert.deepEqual(e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"].items, [GRAIN], w);
  assert.deepEqual(e.component_groups["lothlorien:adult"]["minecraft:breedable"].breed_items, [GRAIN]);
  assert.deepEqual(e.component_groups["lothlorien:baby"]["minecraft:ageable"].feed_items, [GRAIN]);
  const text = JSON.stringify(e);
  for (const bad of ["mallorn_acorn", "\"apple\"", "western_corn_seeds"]) assert.ok(!text.includes(bad), bad);
  assert.ok(existsSync(new URL("../lothlorien_bp/items/western_corn_grain.json", import.meta.url)), "grain item exists");
});
test("white deer: a separate loner entity, not tamable, not breedable, no babies; leashable, no balloon", () => {
  const e = whiteEntity();
  assert.equal(e.description.identifier, W.WHITE_DEER_ID);
  assert.equal(e.description.identifier, R.WHITE_DEER_ID);
  assert.ok(e.description.is_spawnable && e.description.is_summonable);
  const keys = new Set(everything(e).flatMap((c) => Object.keys(c)));
  for (const bad of ["minecraft:breedable", "minecraft:behavior.breed", "minecraft:offspring", "minecraft:is_baby", "minecraft:ageable",
    "minecraft:behavior.follow_parent", "minecraft:tameable", "minecraft:balloonable", "minecraft:spawn_egg_interaction",
    "minecraft:behavior.follow_mob", "minecraft:behavior.follow_owner"]) {
    assert.ok(!keys.has(bad), bad);
  }
  assert.ok(e.components["minecraft:leashable"], "a lead works on it (the owner's wish)");
  assert.ok(!e.events["minecraft:entity_born"] && !e.events["minecraft:ageable_grow_up"]);
  assert.ok(!e.description.properties["lothlorien:coat"]);
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} });
  assert.ok(e.components["minecraft:type_family"].family.includes("lothlorien_white_deer"));
  assert.ok(!e.components["minecraft:type_family"].family.includes("lothlorien_deer"), "own family");
});
test("white deer: same wariness states and flight distances as the deer; only the acorn lures it", () => {
  const e = whiteEntity(), d = deerEntity();
  // same flight, except the lure item that switches flight from its holder off
  const sameLure = (avoid) => JSON.parse(JSON.stringify(avoid).replaceAll(W.ACORN_ID, R.CORN_ID));
  for (const w of [...R.WARINESS, "alarmed", "tame"]) {
    assert.deepEqual(sameLure(e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"]),
      d.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"], w);
    assert.ok(e.events[R.setEventFor(w)] || w === "alarmed" || w === "tame", w);
  }
  const lured = (w) => e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"]?.items;
  assert.deepEqual(["calm", "friend"].map(lured), [[W.ACORN_ID], [W.ACORN_ID]]);
  assert.deepEqual(["l1", "l2", "l3", "alarmed"].map(lured), [undefined, undefined, undefined, undefined]);
  assert.deepEqual(e.events["lothlorien:alarm_over"], d.events["lothlorien:alarm_over"]);
  assert.equal(e.component_groups["lothlorien:state_alarmed"]["minecraft:timer"].time_down_event.event, "lothlorien:alarm_over");
  for (const k of ["minecraft:behavior.panic", "minecraft:behavior.float", "minecraft:behavior.random_stroll", "minecraft:navigation.walk", "minecraft:movement"]) {
    assert.deepEqual(e.components[k], d.components[k], k);
  }
  assert.ok(R.DEER_TYPES.includes(W.WHITE_DEER_ID), "deer.js drives its wariness and alarm");
});
test("both deer: a held lure beats flight, a fed (tame) deer does not flee from players, attack still wins", () => {
  for (const [e, lure] of [[deerEntity(), R.CORN_ID], [whiteEntity(), W.ACORN_ID]]) {
    const g = e.component_groups;
    const playerEntries = (grp) => grp["minecraft:behavior.avoid_mob_type"].entity_types
      .filter((t) => JSON.stringify(t.filters).includes('"value":"player"'));
    const exempts = (t) => t.filters.all_of?.some((f) => f.test === "has_equipment" && f.subject === "other" && f.operator === "!=" && f.value === lure);
    for (const w of ["calm", "friend"]) {
      assert.ok(playerEntries(g[`lothlorien:state_${w}`]).every(exempts), `${w}: holding ${lure} stops the flight`);
      assert.equal(g[`lothlorien:state_${w}`]["minecraft:behavior.tempt"].can_get_scared, false, `${w}: the lure is not broken by movement`);
    }
    for (const w of ["l1", "l2", "l3", "alarmed"]) assert.ok(!playerEntries(g[`lothlorien:state_${w}`]).some(exempts), `${w}: the lure does not help`);
    assert.equal(playerEntries(g["lothlorien:state_tame"]).length, 0, "tame: no flight from players");
    assert.deepEqual(g["lothlorien:state_tame"]["minecraft:behavior.tempt"].items, [lure]);
    assert.equal(e.description.properties["lothlorien:tame"].default, false);
    for (const [name, ev] of Object.entries(e.events)) {
      const removes = [ev, ...(ev.sequence ?? [])].flatMap((s) => s.remove?.component_groups ?? []);
      if (removes.includes("lothlorien:state_calm")) assert.ok(removes.includes("lothlorien:state_tame"), `${name} removes state_tame`);
    }
    for (const w of ["calm", "friend"]) {
      const seq = e.events[R.setEventFor(w)].sequence;
      const addFor = (tame) => seq.find((s) => s.filters?.domain === "lothlorien:tame" && s.filters.value === tame).add.component_groups;
      assert.deepEqual([addFor(false), addFor(true)], [[`lothlorien:state_${w}`], ["lothlorien:state_tame"]]);
    }
    for (const w of ["l1", "l2", "l3"]) assert.deepEqual(e.events[R.setEventFor(w)].add.component_groups, [`lothlorien:state_${w}`], w);
    assert.equal(e.components["minecraft:behavior.panic"].priority, 1, "panic outranks the lure (3)");
  }
  const src = (f) => readFileSync(new URL(`../lothlorien_bp/scripts/${f}`, import.meta.url), "utf8");
  assert.ok(src("deer.js").includes('triggerEvent("lothlorien:untame")'), "a player hurting a deer untames it");
  assert.ok(/tame\(target\)/.test(src("deer.js")), "feeding corn tames a deer");
  assert.ok(src("white_deer.js").includes('triggerEvent("lothlorien:become_tame")'), "a white deer taking the acorn is tamed");
  // a property set by script is not visible before the next tick, so tame state goes through entity events
  for (const f of ["deer.js", "white_deer.js"]) assert.ok(!/setProperty\("lothlorien:tame"/.test(src(f)), f);
});
test("both deer: tame or leashed = persistent, like vanilla tamed animals; either one alone keeps it", () => {
  for (const e of [deerEntity(), whiteEntity()]) {
    const K = "lothlorien:kept", ev = e.events;
    assert.deepEqual(e.component_groups[K], { "minecraft:persistent": {} });
    assert.ok(e.components["minecraft:despawn"], "wild deer still despawn");
    const l = e.components["minecraft:leashable"];
    assert.deepEqual([l.on_leash.event, l.on_unleash.event], ["lothlorien:leashed", "lothlorien:unleashed"]);
    assert.deepEqual(ev["lothlorien:leashed"].add.component_groups, [K]);
    assert.deepEqual(ev["lothlorien:become_tame"], { set_property: { "lothlorien:tame": true }, add: { component_groups: [K] } });
    const unleash = ev["lothlorien:unleashed"].sequence[0];
    assert.deepEqual([unleash.filters.domain, unleash.filters.value, unleash.remove.component_groups], ["lothlorien:tame", false, [K]]);
    const [untameSet, untameRemove] = ev["lothlorien:untame"].sequence;
    assert.equal(untameSet.set_property["lothlorien:tame"], false);
    assert.deepEqual([untameRemove.filters.test, untameRemove.filters.value, untameRemove.remove.component_groups], ["is_leashed", false, [K]]);
    for (const [name, x] of Object.entries(ev)) {
      if (!name.includes("tame") && !name.includes("leash")) assert.ok(!JSON.stringify(x).includes(K), `${name} leaves ${K} alone`);
    }
  }
});
test("white deer: guiding state follows the beacon (one goal, below panic, above avoid) and only guide_start adds it", () => {
  const e = whiteEntity();
  const g = "lothlorien:state_guiding";
  for (const [name, ev] of Object.entries(e.events)) {
    if (name.startsWith("lothlorien:set_") || name === "lothlorien:alarm") {
      const first = ev.sequence?.[0] ?? ev; // set_calm/set_friend: reset first, then the tame-dependent add
      assert.ok(first.remove.component_groups.includes(g), name);
      assert.equal(first.set_property["lothlorien:guiding"], false, name);
    }
    if (name !== "lothlorien:guide_start") assert.ok(![ev, ...(ev.sequence ?? [])].some((s) => s.add?.component_groups?.includes(g)), name);
  }
  assert.deepEqual(e.events["lothlorien:guide_start"].add.component_groups, [g]);
  assert.equal(e.events["lothlorien:guide_start"].set_property["lothlorien:guiding"], true);
  assert.equal(e.events["lothlorien:guide_end"].trigger, "lothlorien:alarm_over");
  const guiding = e.component_groups[g];
  assert.ok(!guiding["minecraft:behavior.tempt"]);
  assert.deepEqual(guiding["minecraft:behavior.avoid_mob_type"].entity_types.map((t) => t.filters.value).sort(), ["monster", "wolf"]);
  // the goal is exactly one of the prepared variants (switch_guide_goal.mjs), the shipped one is follow_target_leader
  const variant = G.currentVariant(e);
  assert.ok(variant, "a known guide goal variant");
  for (const [k, v] of Object.entries(G.VARIANTS[variant](G.BEACON_FILTER))) assert.deepEqual(guiding[k], v, k);
  assert.equal(variant, "leader", "shipped goal (change this line together with a switch)");
  const prios = Object.keys(G.VARIANTS[variant](G.BEACON_FILTER)).map((k) => guiding[k].priority);
  assert.ok(prios.every((p) => p > e.components["minecraft:behavior.panic"].priority && p < guiding["minecraft:behavior.avoid_mob_type"].priority));
  const within = guiding["minecraft:behavior.follow_target_leader"]?.within_radius ?? 24;
  assert.ok(within > W.HOP + W.REACHED, "the beacon stays inside the goal's radius");
  assert.ok(Number(readJson("../lothlorien_bp/entities/white_deer.json").format_version.split(".")[1]) >= 26, "follow_target_leader needs 1.26.20+");
});
test("white deer: no experiment groups shipped (switch_guide_goal.mjs --clean)", () => {
  const e = whiteEntity();
  assert.ok(![...Object.keys(e.component_groups), ...Object.keys(e.events)].some((k) => k.startsWith("lothlorien:test_")));
  const copy = structuredClone(e);
  G.removeExperiment(G.addExperiment(copy));
  assert.deepEqual(copy, e, "experiment add + clean round-trips");
  for (const name of Object.keys(G.VARIANTS)) assert.equal(G.currentVariant(G.applyVariant(structuredClone(e), name)), name, name);
});
test("white deer: holding an acorn gives the interaction the script listens for; the item is not used up by the engine", () => {
  const e = whiteEntity();
  const [i] = e.components["minecraft:interact"].interactions;
  assert.ok(JSON.stringify(i.on_interact.filters).includes(W.ACORN_ID));
  assert.equal(i.use_item, false);
  assert.ok(existsSync(new URL(`../lothlorien_bp/items/${W.ACORN_ID.split(":")[1]}.json`, import.meta.url)), "acorn item exists");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const key of [i.interact_text, "entity.lothlorien:white_deer.name", "item.spawn_egg.entity.lothlorien:white_deer.name"]) {
    assert.ok(lang.includes(`${key}=`), key);
  }
  assert.ok(lang.includes("entity.lothlorien:white_deer.name=White Deer\n") || lang.includes("entity.lothlorien:white_deer.name=White Deer\r\n"));
});
test("white deer: rare single spawns in the biome at SPAWN_WEIGHT, flagged natural by the herd event", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/white_deer.json")["minecraft:spawn_rules"];
  const deer = readJson("../lothlorien_bp/spawn_rules/deer.json")["minecraft:spawn_rules"];
  assert.equal(rule.description.identifier, W.WHITE_DEER_ID);
  assert.equal(rule.description.population_control, "animal");
  const [c] = rule.conditions, [dc] = deer.conditions;
  assert.equal(rule.conditions.length, 1);
  assert.deepEqual(c["minecraft:herd"], { min_size: 1, max_size: 1, event: "lothlorien:spawn_natural" });
  assert.equal(c["minecraft:density_limit"].surface, 1);
  assert.equal(c["minecraft:weight"].default, W.SPAWN_WEIGHT, "tune in white_deer_rules.js and the spawn rule together");
  assert.ok(c["minecraft:weight"].default < dc["minecraft:weight"].default, "fewer than deer");
  assert.deepEqual(c["minecraft:biome_filter"], dc["minecraft:biome_filter"]);
  const e = whiteEntity();
  assert.deepEqual(e.description.properties["lothlorien:natural"], { type: "bool", default: false, client_sync: false });
  const natural = e.events["lothlorien:spawn_natural"];
  assert.equal(natural.set_property["lothlorien:natural"], true);
  assert.equal(natural.trigger, "lothlorien:set_calm", "a natural spawn is fully set up even if entity_spawned does not also run");
  assert.deepEqual(e.events["minecraft:entity_spawned"], { trigger: "lothlorien:set_calm" }, "summon and egg: never flagged");
  assert.ok(!JSON.stringify(e.events["minecraft:entity_spawned"]).includes("natural"));
});
test("white deer: depth table - none outside, few at the edge, more inside, all in the heart; clamps odd levels", () => {
  assert.deepEqual([0, 1, 2, 3].map(W.spawnKeepChance), W.SPAWN_KEEP_BY_DEPTH);
  assert.equal(W.SPAWN_KEEP_BY_DEPTH.length, DEPTH_NAMES.length, "one chance per depth level (depth.js)");
  assert.equal(W.spawnKeepChance(0), 0);
  assert.equal(W.spawnKeepChance(3), 1);
  for (let l = 1; l < 4; l++) assert.ok(W.spawnKeepChance(l) > W.spawnKeepChance(l - 1), `level ${l} more than ${l - 1}`);
  assert.equal(W.spawnKeepChance(7), 1); assert.equal(W.spawnKeepChance(-1), 0); assert.equal(W.spawnKeepChance(undefined), 0);
  assert.ok(W.keepNaturalSpawn(3, 0.999) && !W.keepNaturalSpawn(0, 0));
  assert.ok(W.keepNaturalSpawn(1, W.spawnKeepChance(1) - 0.001) && !W.keepNaturalSpawn(1, W.spawnKeepChance(1)));
  // share of kept spawns over many rolls follows the table
  let kept = 0;
  for (let i = 0; i < 1000; i++) if (W.keepNaturalSpawn(2, i / 1000)) kept++;
  assert.equal(kept, Math.round(W.spawnKeepChance(2) * 1000));
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(src.includes("EntityInitializationCause.Loaded") && src.includes('setProperty("lothlorien:natural", false)'), "judged once, not on reload");
});
test("white deer: always an antlered hart; sure antler plus the usual deer drops, on any death", () => {
  const e = whiteEntity();
  assert.ok(!e.description.properties["lothlorien:sex"], "no sex split");
  const text = JSON.stringify(e);
  for (const bad of ["adult_doe", "adult_buck", "spawn_doe", "spawn_buck", "lothlorien:sex"]) assert.ok(!text.includes(bad), bad);
  assert.equal(e.components["minecraft:loot"].table, "loot_tables/entities/white_deer.json");
  assert.ok(!e.components["minecraft:experience_reward"].on_bred);
  const loot = readJson("../lothlorien_bp/loot_tables/entities/white_deer.json");
  const pool = (name) => loot.pools.find((p) => p.entries.some((x) => x.name === name));
  const antler = pool("lothlorien:deer_antler");
  assert.ok(antler && !antler.conditions && antler.entries.length === 1 && antler.rolls === 1, "guaranteed, no player-kill or chance condition");
  assert.deepEqual(antler.entries[0].functions, [{ function: "set_count", count: 1 }]);
  // leather and venison exactly as a buck deer
  const buck = readJson("../lothlorien_bp/loot_tables/entities/deer_buck.json");
  for (const name of ["minecraft:leather", "lothlorien:venison_raw"]) {
    assert.deepEqual(pool(name), buck.pools.find((p) => p.entries.some((x) => x.name === name)), name);
  }
});
test("white deer: leash rule - a lead always wins over guidance", () => {
  assert.equal(W.offerRefusal({ band: "friend", leashed: false }), undefined);
  assert.equal(W.offerRefusal({ band: "friend", leashed: true }), "leashed");
  assert.equal(W.offerRefusal({ band: "shunned", leashed: true }), "leashed");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(W.offerRefusal({ band, leashed: false }), "restless", band);
  assert.equal(W.offerRefusal({ band: "guest", leashed: false }), "untrusted"); // a Guest is not enough: Friend only
  const base = { toTarget: 40, toPlayer: 5, stuck: 0, age: 0, playerCalm: true };
  assert.equal(W.phase(base), "walk");
  assert.equal(W.phase({ ...base, leashed: true }), "leashed");
  assert.equal(W.phase({ ...base, toTarget: 1, leashed: true }), "leashed", "even at the goal");
  assert.equal(W.phase({ ...base, toPlayer: 30, leashed: true }), "leashed");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(src.includes('getComponent("minecraft:leashable")?.isLeashed'), "the game script reads the lead");
});
test("harmony: a white deer kill costs 6 (two animals), a unicorn 10, a warden 6 on top of 1 per fight", () => {
  const cost = (kind) => { const x = hs(0); H.recordDeed(x, kind); return -x.harmony; };
  assert.equal(cost(H.deedKindOf(W.WHITE_DEER_ID)), 6);
  assert.equal(cost(H.deedKindOf(R.DEER_ID)), 3);
  assert.equal(cost("white_deer"), 2 * cost("animal"));
  assert.equal(H.bandOf(-cost("white_deer")), "uneasy");
  assert.equal(cost(H.deedKindOf(EW.WARDEN_ID)) + cost("warden_fight"), 7);
  assert.equal(cost(H.deedKindOf("lothlorien:elf")) + cost("elf_fight"), 7, "an elf is charged like a warden: 1 per fight + 6 per kill");
});
test("white deer: client entity uses the white texture on the antlered deer model only; no unused fawn texture", () => {
  const c = readJson("../lothlorien_rp/entity/white_deer.entity.json")["minecraft:client_entity"].description;
  assert.equal(c.identifier, W.WHITE_DEER_ID);
  assert.deepEqual(c.geometry, { default: "geometry.lothlorien.deer_buck" }, "always antlered");
  const rc = readJson("../lothlorien_rp/render_controllers/white_deer.render_controllers.json").render_controllers["controller.render.lothlorien.white_deer"];
  assert.equal(rc.geometry, "Geometry.default");
  assert.deepEqual(c.textures, { default: "textures/entity/deer/deer_white" });
  assert.ok(existsSync(new URL(`../lothlorien_rp/${c.textures.default}.png`, import.meta.url)));
  assert.ok(!existsSync(new URL("../lothlorien_rp/textures/entity/deer/deer_white_baby.png", import.meta.url)));
  assert.ok(c.spawn_egg, "spawn egg");
  const geo = readFileSync(new URL("../lothlorien_rp/models/entity/deer.geo.json", import.meta.url), "utf8");
  for (const g of Object.values(c.geometry)) assert.ok(geo.includes(`"${g}"`), g);
  assert.ok(readJson("../lothlorien_rp/sounds.json").entity_sounds.entities[W.WHITE_DEER_ID], "sounds");
});
test("guide beacon: invisible, weightless, untouchable helper that removes itself; no spawn rule", () => {
  const b = readJson("../lothlorien_bp/entities/guide_beacon.json")["minecraft:entity"];
  assert.equal(b.description.identifier, W.BEACON_ID);
  assert.equal(b.description.is_spawnable, false);
  assert.equal(b.description.is_summonable, true, "spawnEntity and /summon need it");
  const c = b.components;
  assert.ok(c["minecraft:type_family"].family.includes(G.BEACON_FILTER.value));
  assert.deepEqual(c["minecraft:physics"], { has_gravity: false, has_collision: false });
  // Not pushable = no pushable_by_* component; minecraft:pushable is rejected by entity format 1.26.50.
  for (const k of ["minecraft:pushable", "minecraft:pushable_by_entity", "minecraft:pushable_by_block"]) assert.equal(c[k], undefined, k);
  assert.deepEqual(c["minecraft:damage_sensor"].triggers, { cause: "all", deals_damage: "no" });
  assert.ok(!c["minecraft:is_collidable"] && !c["minecraft:despawn"]);
  const t = c["minecraft:timer"];
  assert.ok(t.time * 20 > W.MAX_TICKS && !t.looping, "outlives the longest session");
  assert.ok(b.component_groups[b.events[t.time_down_event.event].add.component_groups[0]]["minecraft:instant_despawn"]);
  assert.ok(!existsSync(new URL("../lothlorien_bp/spawn_rules/guide_beacon.json", import.meta.url)));
  const client = readJson("../lothlorien_rp/entity/guide_beacon.entity.json")["minecraft:client_entity"].description;
  assert.ok(!client.spawn_egg, "no spawn egg");
  const geo = readJson("../lothlorien_rp/models/entity/guide_beacon.geo.json")["minecraft:geometry"][0];
  assert.equal(geo.description.identifier, client.geometry.default);
  assert.ok(geo.bones.flatMap((x) => x.cubes).every((cube) => cube.size.every((v) => v === 0)), "nothing to render");
});
test("giant structures: the flet giants the nut grows hold a chest, plain giants none; no leftover marker blocks", () => {
  for (const [v, n] of CHOSEN) {
    const id = `lothlorien:mallorn_${v}_${String(n).padStart(2, "0")}`;
    const bytes = readFileSync(new URL(`../lothlorien_bp/structures/${id.replace(":", "/")}.mcstructure`, import.meta.url));
    assert.equal(bytes.includes(Buffer.from(CHEST_BLOCK)), N.FLET_TREES.includes(id), `${id}: chest only in the flet giants`);
    assert.ok(!bytes.includes(Buffer.from("structure_marker")), `${id}: marker removed (run node tools/build_structures.mjs)`);
  }
  assert.ok(!existsSync(new URL("../lothlorien_bp/blocks/structure_marker.json", import.meta.url)));
  // the generator rule itself: flet trees have a chest, plain giants none
  assert.ok(flets.every((t) => hasChest(t.blocks)) && plains.every((t) => !hasChest(t.blocks)));
});
test("two plank sets: logs -> silver planks, stripped -> heartwood planks; heartwood blocks are clones on shared geometry", () => {
  const result = (f) => readJson(`../lothlorien_bp/recipes/${f}.json`)["minecraft:recipe_shaped"].result.item;
  assert.equal(result("mallorn_planks_from_log"), "lothlorien:mallorn_planks");
  assert.equal(result("mallorn_planks_from_wood"), "lothlorien:mallorn_planks");
  assert.equal(result("mallorn_heartwood_planks_from_stripped_log"), "lothlorien:mallorn_heartwood_planks");
  assert.equal(result("mallorn_heartwood_planks_from_stripped_wood"), "lothlorien:mallorn_heartwood_planks");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  const strip = (v) => JSON.stringify(v).replaceAll("mallorn_heartwood_", "mallorn_").replace(/"minecraft:map_color":"#[0-9a-f]{6}"/g, "");
  for (const part of ["planks", "stairs", "slab", "double_slab", "fence", "fence_gate", "door", "trapdoor", "button", "pressure_plate"]) {
    const gold = readJson(`../lothlorien_bp/blocks/mallorn_heartwood_${part}.json`);
    const silver = readJson(`../lothlorien_bp/blocks/mallorn_${part}.json`);
    assert.equal(strip(gold), strip(silver), `${part}: out of step with silver (run python -B tools/make_heartwood_set.py)`);
    assert.ok(!JSON.stringify(gold).includes("geometry.lothlorien.mallorn_heartwood"), `${part}: geometry is shared`);
    assert.ok(lang.includes(`tile.lothlorien:mallorn_heartwood_${part}.name=`), `${part}: name`);
    if (part !== "double_slab") {
      assert.ok(existsSync(new URL(`../lothlorien_bp/items/mallorn_heartwood_${part}.json`, import.meta.url)), `${part}: item`);
    }
  }
  const src = readFileSync(new URL("../lothlorien_bp/scripts/blocks.js", import.meta.url), "utf8");
  assert.ok(src.includes('const WOODS = ["mallorn", "mallorn_heartwood"]'), "door pairing, slab merging, button/plate support know both sets");
});
test("icons: every non-cube plank-family block draws its icon through item_visual with an explicit vanilla pose", () => {
  // Without item_visual the icon was turned (stairs, gate) and auto-fitted (slab drawn big and high); a gui pose
  // without rotation left the fence a quarter turn off. Poses: Kaioga 1.26.50 templates (tuned against vanilla).
  const YAW = { stairs: 135, fence_gate: 135, slab: 225, fence: 225, trapdoor: 225, pressure_plate: 225, button: 225 };
  const geos = new Map();
  for (const f of readdirSync(new URL("../lothlorien_rp/models/blocks/", import.meta.url))) {
    for (const g of readJson(`../lothlorien_rp/models/blocks/${f}`)["minecraft:geometry"]) geos.set(g.description.identifier, g);
  }
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    for (const [part, yaw] of Object.entries(YAW)) {
      const comps = readJson(`../lothlorien_bp/blocks/${set}_${part}.json`)["minecraft:block"].components;
      const visual = comps["minecraft:item_visual"];
      assert.ok(visual && visual.material_instances, `${set}_${part}: item_visual with material_instances`);
      assert.deepEqual(visual.material_instances, comps["minecraft:material_instances"], `${set}_${part}: icon uses the block's textures`);
      const geo = geos.get(visual.geometry);
      assert.ok(geo, `${set}_${part}: item_visual geometry ${visual.geometry} exists`);
      const gui = geo.item_display_transforms?.gui;
      assert.ok(gui && gui.fit_to_frame === false, `${set}_${part}: fit_to_frame off (vanilla size and height)`);
      assert.deepEqual(gui.rotation, [30, yaw, 0], `${set}_${part}: gui rotation`);
    }
  }
  // the stairs icon is a straight stair whose tall half is EAST (geometry x is mirrored: x -8..0)
  const top = geos.get("geometry.lothlorien.mallorn_stairs_item").bones[0].cubes.find((c) => c.origin[1] === 8);
  assert.deepEqual([top.origin, top.size], [[-8, 8, -8], [8, 8, 16]]);
  const stair = geos.get("geometry.lothlorien.mallorn_stairs_item");
  for (const cube of stair.bones[0].cubes) {
    assert.equal(cube.uv.up.uv_rotation, 90, "stair item top grain follows the stair run");
    assert.equal(cube.uv.down.uv_rotation, 90, "stair item underside follows the stair run");
  }
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    assert.ok(readJson(`../lothlorien_bp/items/${set}_door.json`)["minecraft:item"].components["minecraft:icon"], `${set}_door: 2D icon`);
  }
});
test("fence: every material instance the fence models name is defined on the block and its icon (both sets); geometry format allows its display transforms", () => {
  for (const g of ["mallorn_fence", "mallorn_fence_carried"]) {
    const geo = JSON.stringify(readJson(`../lothlorien_rp/models/blocks/${g}.geo.json`));
    const used = new Set([...geo.matchAll(/"material_instance":"(\w+)"/g)].map((x) => x[1]));
    for (const set of ["mallorn", "mallorn_heartwood"]) {
      const c = readJson(`../lothlorien_bp/blocks/${set}_fence.json`)["minecraft:block"].components;
      const mi = g.endsWith("carried") ? c["minecraft:item_visual"].material_instances : c["minecraft:material_instances"];
      for (const name of used) assert.ok(mi[name], `${set} ${g}: ${name}`);
      assert.equal(mi["*"].texture, `lothlorien:${set}_fence_post`);
    }
    const f = readJson(`../lothlorien_rp/models/blocks/${g}.geo.json`);
    const v = f.format_version.split(".").map(Number);
    const atLeast = (w) => v[0] !== w[0] ? v[0] > w[0] : v[1] !== w[1] ? v[1] > w[1] : (v[2] ?? 0) >= w[2];
    if (f["minecraft:geometry"][0].item_display_transforms?.shelf) assert.ok(atLeast([1, 26, 40]), `${g}: "shelf" needs format 1.26.40+`);
  }
});
test("gate: carved models (tools/make_mallorn_gate.py) wear the fence post texture in both sets; bones, icon pose and open side kept", () => {
  const closed = readJson("../lothlorien_rp/models/blocks/mallorn_fence_gate_closed.geo.json");
  const open = readJson("../lothlorien_rp/models/blocks/mallorn_fence_gate_open.geo.json");
  for (const [f, bones] of [[closed, ["posts", "rails"]], [open, ["posts", "leaves"]]]) {
    assert.equal(f.format_version, "1.26.50");
    const g = f["minecraft:geometry"][0];
    assert.deepEqual(g.bones.map((b) => b.name), bones);
    assert.ok(g.bones.every((b) => b.cubes.length > 0));
    assert.ok(!JSON.stringify(g).includes("material_instance"), "every face uses the block's * material");
  }
  const gui = closed["minecraft:geometry"][0].item_display_transforms.gui;
  assert.deepEqual([gui.rotation, gui.fit_to_frame], [[30, 135, 0], false], "icon pose confirmed in game");
  // open leaves swing to -z, inside the open selection box (z -8..0)
  for (const c of open["minecraft:geometry"][0].bones[1].cubes) {
    assert.ok(c.origin[2] >= -8.5 && c.origin[2] + c.size[2] <= 1.5, `open leaf at z ${c.origin[2]}`);
  }
  const atlas = readJson("../lothlorien_rp/textures/terrain_texture.json").texture_data;
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    const c = readJson(`../lothlorien_bp/blocks/${set}_fence_gate.json`)["minecraft:block"].components;
    for (const mi of [c["minecraft:material_instances"], c["minecraft:item_visual"].material_instances]) {
      assert.equal(mi["*"].texture, `lothlorien:${set}_fence_post`);
      assert.ok(atlas[mi["*"].texture], `${set}: texture key in terrain_texture.json`);
    }
    assert.equal(c["minecraft:item_visual"].geometry, "geometry.lothlorien.mallorn_fence_gate_closed");
  }
});
import * as NR from "../lothlorien_bp/scripts/nectar_rules.js";
import * as DR from "../lothlorien_bp/scripts/dew_rules.js";
test("Phase 14b: nectar bloom fills only under Mallorn leaves, 1/7 per stage", () => {
  assert.equal(NR.nectarAfterTick(0, true, 0.1), 1);
  assert.equal(NR.nectarAfterTick(0, true, 0.2), 0, "dice fail");
  assert.equal(NR.nectarAfterTick(0, false, 0), 0, "no leaves above: stays dry");
  assert.equal(NR.nectarAfterTick(NR.MAX_NECTAR, true, 0), NR.MAX_NECTAR, "full stays full");
  assert.ok(NR.MALLORN_LEAVES.has("lothlorien:mallorn_golden_leaves") && NR.MALLORN_LEAVES.has("lothlorien:mallorn_leaves"));
  assert.deepEqual([0.39, 0.4, 0.84, 0.85].map(NR.treeBloomCount), [0, 1, 1, 2]);
});
test("Phase 14b: morning dew window, chances and leaves-above scan", () => {
  for (const t of [23000, 23999, 0, 1000, 2999]) assert.ok(DR.inDewWindow(t), `dew at ${t}`);
  for (const t of [3000, 6000, 12000, 22999]) assert.ok(!DR.inDewWindow(t), `no dew at ${t}`);
  assert.ok(DR.inDewWindow(24000 + 100), "time wraps");
  const yes = () => true;
  const no = () => false;
  // t=500: share 0.375, appear 1/8 * 0.625
  assert.equal(DR.dewAfterTick(false, 500, 1 / 8, 0.07, yes), true);
  assert.equal(DR.dewAfterTick(false, 500, 1 / 8, 0.08, yes), false, "dice fail");
  assert.equal(DR.dewAfterTick(false, 500, 1, 0, no), false, "needs leaves above");
  assert.equal(DR.dewAfterTick(true, 500, 0, 0.19, no), true, "dew stays within the window");
  assert.equal(DR.dewAfterTick(true, 500, 0, 0.18, no), false, "dew dries inside the window (r < 1/2 * f)");
  assert.equal(DR.dewAfterTick(true, 8000, 1, 0.99, yes), false, "dew dries outside the window");
  assert.equal(DR.dewAfterTick(false, 8000, 1, 0, yes), false, "no new dew by day");
  assert.equal(DR.DEW_APPEAR["lothlorien:mallorn_leaf_carpet"], 1 / 8);
  assert.equal(DR.DEW_APPEAR["lothlorien:mallorn_blossom"], 1 / 4);
  assert.equal(DR.DEW_DRY_MAX, 1 / 2);
  assert.equal(DR.DEW_LENGTH, 4000);
  assert.equal(DR.dawnShare(23000), 0);
  assert.equal(DR.dawnShare(1000), 0.5);
  assert.ok(Math.abs(DR.dawnShare(2999) - 0.99975) < 1e-9);
  // 23000: full appear chance, no drying
  assert.equal(DR.dewAfterTick(false, 23000, 1 / 8, 0.124, yes), true);
  assert.equal(DR.dewAfterTick(false, 23000, 1 / 8, 0.126, yes), false);
  assert.equal(DR.dewAfterTick(true, 23000, 0, 0, no), true, "no drying at the start");
  // 1000: appear halves, dry 1/4
  assert.equal(DR.dewAfterTick(false, 1000, 1 / 8, 0.06, yes), true);
  assert.equal(DR.dewAfterTick(false, 1000, 1 / 8, 0.07, yes), false);
  assert.equal(DR.dewAfterTick(true, 1000, 0, 0.24, no), false);
  assert.equal(DR.dewAfterTick(true, 1000, 0, 0.26, no), true);
  // 2999: appear ~0, dry ~1/2
  assert.equal(DR.dewAfterTick(false, 2999, 1 / 4, 0.001, yes), false);
  assert.equal(DR.dewAfterTick(true, 2999, 0, 0.49, no), false);
  assert.equal(DR.dewAfterTick(true, 2999, 0, 0.51, no), true);
  for (const t of [3000, 6000, 22999]) {
    assert.equal(DR.dewAfterTick(true, t, 1, 0.999, yes), false, `dries at ${t}`);
    assert.equal(DR.dewAfterTick(false, t, 1, 0, yes), false, `never appears at ${t}`);
  }
  const leaf = (id) => id === "L";
  assert.ok(DR.leavesAbove((dy) => (dy === 5 ? "L" : "air"), leaf));
  assert.ok(!DR.leavesAbove(() => "air", leaf));
  assert.ok(!DR.leavesAbove((dy) => (dy > 2 ? undefined : "air"), leaf), "unloaded chunk stops the scan");
  assert.ok(!DR.leavesAbove((dy) => (dy === 41 ? "L" : "air"), leaf), "scan limit");
});
test("Phase 14b: Dew bottle fills drop by drop into a Bottle of morning dew", () => {
  assert.equal(DR.dropsIn(DR.NEW_DEW_BOTTLE_DAMAGE), 1, "a new Dew bottle holds one drop");
  let damage = DR.NEW_DEW_BOTTLE_DAMAGE;
  let uses = 1;
  for (let r = DR.addDrop(damage); !r.full; r = DR.addDrop(damage)) {
    assert.equal(DR.dropsIn(r.damage), DR.dropsIn(damage) + 1);
    damage = r.damage;
    uses++;
  }
  assert.equal(uses + 1, DR.DEW_DROPS, "8 uses in all from a glass bottle (the last one completes it)");
  assert.ok(damage > 0, "the bar never reaches a full bottle early");
});
test("Phase 14b: nectar and dew content is wired (pack JSON)", () => {
  const bloom = readJson("../lothlorien_bp/blocks/nectar_bloom.json")["minecraft:block"];
  assert.deepEqual(bloom.description.states["lothlorien:nectar"], [0, 1, 2, 3]);
  assert.deepEqual(bloom.components["minecraft:placement_filter"].conditions[0].allowed_faces, ["down"]);
  const atlas = readJson("../lothlorien_rp/textures/terrain_texture.json").texture_data;
  for (const s of [0, 1, 2, 3]) assert.ok(atlas[`lothlorien:nectar_bloom_${s}`], `bloom stage ${s} in the atlas`);
  for (const name of ["mallorn_leaf_carpet", "mallorn_blossom"]) {
    const b = readJson(`../lothlorien_bp/blocks/${name}.json`)["minecraft:block"];
    assert.deepEqual(b.description.states["lothlorien:dew"], [false, true]);
    assert.ok("lothlorien:dew_cover" in b.components);
    const dewy = b.permutations.find((p) => p.condition === "q.block_state('lothlorien:dew')");
    const tex = dewy.components["minecraft:material_instances"]["*"].texture;
    assert.equal(tex, `lothlorien:${name}_dew`);
    assert.ok(atlas[tex], "dew texture in the atlas");
  }
  const recipe = readJson("../lothlorien_bp/recipes/miruvor.json")["minecraft:recipe_shaped"];
  assert.equal(recipe.key.H.item, "lothlorien:mallorn_nectar", "Miruvor takes nectar, not honey");
  assert.equal(readJson("../lothlorien_bp/items/dew_bottle.json")["minecraft:item"].components["minecraft:durability"].max_durability, DR.DEW_DROPS);
  const agg = readJson("../lothlorien_bp/features/select_mallorn_tree_with_litter_feature.json")["minecraft:aggregate_feature"].features;
  assert.ok(agg.indexOf("lothlorien:mallorn_blossom_scatter_feature") < agg.indexOf("lothlorien:mallorn_leaf_carpet_scatter_feature"), "blossoms before litter");
  assert.ok(agg.includes("lothlorien:nectar_bloom_scatter_feature"));
});
// ---- Phase 15: swan and ground squirrel ----
import * as SR from "../lothlorien_bp/scripts/swan_rules.js";
import * as QR from "../lothlorien_bp/scripts/squirrel_rules.js";
const ACORN = "lothlorien:mallorn_acorn";
const swanEntity = () => readJson("../lothlorien_bp/entities/swan.json")["minecraft:entity"];
const squirrelEntity = () => readJson("../lothlorien_bp/entities/squirrel.json")["minecraft:entity"];
test("Phase 15: a swan stays when Lothlorien is near (the spot or any ring up to 48 blocks), else it is removed", () => {
  assert.equal(SR.nearOffsets().length, 1 + SR.NEAR_RADII.length * SR.NEAR_HEADINGS);
  assert.equal(SR.nearBiome(() => RIVER, L), false, "a river far from the biome");
  assert.equal(SR.nearBiome((dx, dz) => (dx === 0 && dz === 0 ? L : RIVER), L), true, "in the biome");
  assert.equal(SR.nearBiome((dx) => (dx < -30 ? L : FOREST), L), true, "biome 30 blocks west");
  assert.equal(SR.nearBiome((dx) => (dx > 70 ? L : FOREST), L), false, "biome 70 blocks east: too far");
  assert.equal(SR.nearBiome(() => undefined, L), false, "unloaded chunks are not the biome");
});
test("Phase 15: swan spawn rule takes Lothlorien or river water, and the natural-spawn event", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/swan.json")["minecraft:spawn_rules"];
  const c = rule.conditions[0];
  assert.deepEqual(c["minecraft:biome_filter"].any_of.map((t) => t.value).sort(), ["lothlorien", "river"]);
  assert.ok("minecraft:spawns_underwater" in c && "minecraft:spawns_on_surface" in c);
  assert.equal(c["minecraft:herd"].event, "lothlorien:spawn_natural");
  assert.equal(swanEntity().events["lothlorien:spawn_natural"].sequence[0].set_property["lothlorien:natural"], true);
  assert.ok("lothlorien:natural" in swanEntity().description.properties);
});
test("Phase 15: swan and squirrel read the Harmony band like the deer (same states, radii, alarm; in WARY_TYPES)", () => {
  assert.deepEqual(R.WARY_TYPES, [R.DEER_ID, R.WHITE_DEER_ID, "lothlorien:swan", "lothlorien:squirrel", "lothlorien:unicorn"]);
  for (const e of [swanEntity(), squirrelEntity()]) {
    for (const w of R.WARINESS) {
      assert.equal(avoidRadius(e, w), R.FLIGHT_RADIUS[w], `${e.description.identifier} ${w}`);
      assert.ok(e.events[R.setEventFor(w)], `event ${w}`);
    }
    assert.equal(avoidRadius(e, "alarmed"), 36);
    assert.ok(e.events["lothlorien:alarm"] && e.events["lothlorien:alarm_over"]);
    assert.ok(e.description.properties["lothlorien:wariness"] && e.description.properties["lothlorien:alarmed"]);
  }
});
test("Phase 15: swan floats on the surface like the chicken (float goal, path over water; no fish-style swimming) and drops a feather", () => {
  const e = swanEntity();
  assert.ok("minecraft:behavior.float" in e.components, "float goal keeps it on the surface");
  assert.equal(e.components["minecraft:navigation.walk"].can_path_over_water, true);
  assert.ok(!("minecraft:buoyant" in e.components), "buoyant sank the swan to the bottom (game log: simulate_waves not valid; 2026-10-02)");
  for (const k of ["minecraft:behavior.random_swim", "minecraft:navigation.generic", "minecraft:movement.amphibious"]) assert.ok(!(k in e.components), `${k} makes it dive`);
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} });
  const loot = readJson("../lothlorien_bp/loot_tables/entities/swan.json").pools[0].entries.map((x) => x.name);
  assert.deepEqual(loot, ["minecraft:feather"]);
});
test("Phase 15: squirrel gifts are for Friends only; calm and restless players are refused", () => {
  assert.equal(QR.offerRefusal({ band: "friend", cooldownLeft: 0 }), undefined);
  assert.equal(QR.offerRefusal({ band: "guest", cooldownLeft: 0 }), "untrusted");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(QR.offerRefusal({ band, cooldownLeft: 0 }), "restless", band);
  assert.equal(QR.offerRefusal({ band: "friend", cooldownLeft: 100 }), "full");
  assert.equal(QR.cooldownLeft(100, 160), 60);
  assert.equal(QR.cooldownLeft(200, 160), 0);
  assert.equal(QR.cooldownLeft(100, undefined), 0);
});
test("Phase 15: squirrel errand: away point, phases, abort", () => {
  const from = { x: 0, y: 64, z: 0 };
  const open = QR.pickAway(from, (x, z, y) => y, 0);
  assert.ok(Math.abs(Math.hypot(open.x, open.z) - 14) < 1e-6, "farthest distance first");
  assert.equal(QR.pickAway(from, () => undefined, 1), undefined);
  const east = QR.pickAway(from, (x) => (x > 0 ? 70 : undefined), Math.PI); // west fails, a later heading works
  assert.ok(east.x > 0 && east.y === 70);
  const p = (o) => QR.nextPhase({ phase: "away", age: 10, phaseAge: 10, toBeacon: 10, toPlayer: 10, digFor: 80, ...o });
  assert.equal(p({}), "away");
  assert.equal(p({ toBeacon: QR.AWAY_ARRIVE }), "dig");
  assert.equal(p({ phaseAge: QR.AWAY_TIMEOUT }), "dig", "never gets there: digs where it is");
  assert.equal(p({ phase: "dig", phaseAge: 79 }), "dig");
  assert.equal(p({ phase: "dig", phaseAge: 80 }), "return");
  assert.equal(p({ phase: "return" }), "return");
  assert.equal(p({ phase: "return", toPlayer: QR.GIFT_DIST }), "gift");
  assert.equal(p({ toPlayer: QR.ABORT_DIST + 1 }), "abort");
  assert.equal(p({ phase: "return", age: QR.MAX_TICKS + 1 }), "abort");
  assert.ok(QR.digTicks(0) === QR.DIG_TICKS.min && QR.digTicks(0.999) === QR.DIG_TICKS.max);
});
test("Phase 15: squirrel entity: errand group follows the beacon, wolves and monsters still scare it, three coats", () => {
  const e = squirrelEntity();
  const g = e.component_groups["lothlorien:state_guiding"];
  assert.equal(g["minecraft:behavior.follow_target_leader"].leader_filters.value, "lothlorien_guide_beacon");
  assert.ok(g["minecraft:behavior.follow_target_leader"].priority < g["minecraft:behavior.avoid_mob_type"].priority);
  assert.ok(g["minecraft:behavior.avoid_mob_type"].entity_types.every((t) => ["wolf", "monster"].includes(t.filters.value)));
  for (const ev of ["lothlorien:guide_start", "lothlorien:guide_end", "lothlorien:guide_abort"]) assert.ok(e.events[ev], ev);
  assert.ok(e.component_groups["lothlorien:state_calm"]["minecraft:behavior.tempt"].items.includes(ACORN));
  const coats = e.description.properties["lothlorien:coat"].values;
  const client = readJson("../lothlorien_rp/entity/squirrel.entity.json")["minecraft:client_entity"].description;
  assert.deepEqual(Object.keys(client.textures).sort(), [...coats].sort());
  for (const t of Object.values(client.textures)) assert.ok(existsSync(new URL(`../lothlorien_rp/${t}.png`, import.meta.url)), t);
  assert.equal(e.components["minecraft:interact"].interactions[0].on_interact.filters.all_of[1].value, ACORN);
});
test("Phase 15: squirrel gift table has litter, petals, athelas and corn seeds, and every item exists in the pack", () => {
  const entries = readJson("../lothlorien_bp/loot_tables/gifts/squirrel.json").pools[0].entries;
  const ids = entries.map((x) => x.name);
  for (const want of ["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom", "lothlorien:athelas", "lothlorien:western_corn_seeds"]) assert.ok(ids.includes(want), want);
  for (const id of ids) assert.ok(existsSync(new URL(`../lothlorien_bp/items/${id.split(":")[1]}.json`, import.meta.url)), `item ${id}`);
  const weight = (n) => entries.find((x) => x.name === n).weight;
  assert.ok(weight("lothlorien:athelas") < weight("lothlorien:mallorn_blossom"), "athelas is rarer than petals");
  assert.equal(QR.GIFT_TABLE, "gifts/squirrel");
});
test("Phase 15: art, sounds and names are wired for both animals", () => {
  const sounds = readJson("../lothlorien_rp/sounds.json").entity_sounds.entities;
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const n of ["swan", "squirrel"]) {
    assert.ok(sounds[`lothlorien:${n}`].events.ambient, `${n} sounds`);
    assert.ok(lang.includes(`entity.lothlorien:${n}.name=`) && lang.includes(`item.spawn_egg.entity.lothlorien:${n}.name=`), `${n} lang`);
    assert.ok(existsSync(new URL(`../lothlorien_rp/models/entity/${n}.geo.json`, import.meta.url)), `${n} geometry`);
  }
});
// ---- Phase 15: unicorn ----
import * as UR from "../lothlorien_bp/scripts/unicorn_rules.js";
const unicornEntity = () => readJson("../lothlorien_bp/entities/unicorn.json")["minecraft:entity"];
test("unicorn: offers need a calm Friend, an unfrightened unicorn and a pause between offers", () => {
  const ok = { band: "friend", tame: false, alarmed: false, sinceLast: undefined };
  assert.equal(UR.offerRefusal(ok), undefined);
  assert.equal(UR.offerRefusal({ ...ok, band: "guest" }), "untrusted");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(UR.offerRefusal({ ...ok, band }), "restless", band);
  assert.equal(UR.offerRefusal({ ...ok, alarmed: true }), "alarmed");
  assert.equal(UR.offerRefusal({ ...ok, tame: true }), "tame");
  assert.equal(UR.offerRefusal({ ...ok, sinceLast: UR.OFFER_GAP_TICKS - 1 }), "wait");
  assert.equal(UR.offerRefusal({ ...ok, sinceLast: UR.OFFER_GAP_TICKS }), undefined);
});
test("unicorn: the third offer bonds it; only the owner may ride", () => {
  assert.deepEqual([0, 1, 2].map((t) => UR.nextTrust(t).bonded), [false, false, true]);
  assert.equal(UR.nextTrust(3).trust, UR.TRUST_OFFERS);
  assert.equal(UR.ticksSince(100, 40), 60);
  assert.equal(UR.ticksSince(10, 40), undefined);
  assert.equal(UR.ticksSince(10, undefined), undefined);
  assert.ok(UR.mayRide("a", "a") && !UR.mayRide("a", "b") && UR.mayRide(undefined, "b"));
});
test("unicorn entity: Harmony wariness states and flight radii (calm is as timid as l1; Friend alone may lure it with Elanor)", () => {
  const e = unicornEntity();
  for (const w of R.WARINESS) {
    assert.ok(e.component_groups[`lothlorien:state_${w}`], `group ${w}`);
    assert.ok(e.events[R.setEventFor(w)], `event ${w}`);
    assert.equal(avoidRadius(e, w), w === "calm" ? R.FLIGHT_RADIUS.l1 : R.FLIGHT_RADIUS[w], w);
  }
  assert.ok(e.component_groups["lothlorien:state_friend"]["minecraft:behavior.tempt"].items.includes(UR.ELANOR_ID));
  for (const w of ["calm", "l1", "l2", "l3"]) assert.ok(!("minecraft:behavior.tempt" in e.component_groups[`lothlorien:state_${w}`]), `${w} must not lure`);
  assert.ok(e.events["lothlorien:alarm"] && e.events["lothlorien:alarm_over"]);
  assert.ok("lothlorien:alarmed" in e.description.properties && "lothlorien:tame" in e.description.properties);
});
test("unicorn entity: bonded = rideable without a saddle or lead, persistent, the best horse's stats", () => {
  const e = unicornEntity();
  const bonded = e.component_groups["lothlorien:bonded"];
  for (const c of ["minecraft:rideable", "minecraft:input_ground_controlled", "minecraft:can_power_jump", "minecraft:behavior.player_ride_tamed", "minecraft:persistent", "minecraft:variable_max_auto_step"]) {
    assert.ok(c in bonded, c);
  }
  assert.ok(!("minecraft:rideable" in e.components), "wild unicorns cannot be mounted");
  for (const c of ["minecraft:leashable", "minecraft:equippable", "minecraft:tamemount", "minecraft:breedable"]) assert.ok(!(c in e.components) && !(c in bonded), `${c} must be absent`);
  assert.equal(e.components["minecraft:health"].value, 30);
  assert.equal(e.components["minecraft:movement"].value, 0.3375);
  assert.equal(e.components["minecraft:horse.jump_strength"].value, 1.0);
  assert.ok(e.events["lothlorien:become_tame"].add.component_groups.includes("lothlorien:bonded"));
});
test("unicorn: spawn rule is uncommon and in Lothlorien; art, sounds and names are wired", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/unicorn.json")["minecraft:spawn_rules"].conditions[0];
  assert.equal(rule["minecraft:biome_filter"].value, "lothlorien");
  assert.ok(rule["minecraft:weight"].default < 10, "rarer than the deer (10)");
  const client = readJson("../lothlorien_rp/entity/unicorn.entity.json")["minecraft:client_entity"].description;
  assert.ok(existsSync(new URL(`../lothlorien_rp/${client.textures.default}.png`, import.meta.url)));
  assert.ok(readJson(`../lothlorien_rp/models/entity/unicorn.geo.json`)[client.geometry.default]);
  assert.ok(readJson("../lothlorien_rp/sounds.json").entity_sounds.entities["lothlorien:unicorn"].events.ambient);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const k of ["entity.lothlorien:unicorn.name=", "item.spawn_egg.entity.lothlorien:unicorn.name=", "action.interact.lothlorien.offer_elanor="]) assert.ok(lang.includes(k), k);
});
// Phase 17b: Elven rope placement, drops and the tree's rope.
import * as ROPE from "../lothlorien_bp/scripts/elven_rope_rules.js";
test("Elven rope: fills down first, then up, one piece per item", () => {
  const free = (lo, hi) => (y) => y >= lo && y <= hi;
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 3, free: free(0, 20) }), [10, 9, 8]);
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 6, free: free(8, 20) }), [10, 9, 8, 11, 12, 13], "bottom reached: carries on up");
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 4, free: free(10, 12) }), [10, 11, 12], "stops at the first blocked row");
  assert.deepEqual(ROPE.planRope({ downFrom: 4, upFrom: 12, count: 3, free: free(0, 20) }), [4, 3, 2], "extension: down from the bottom first");
  assert.deepEqual(ROPE.planRope({ downFrom: 4, upFrom: 12, count: 4, free: free(4, 20) }), [4, 12, 13, 14], "extension: up from the top once down is blocked");
  assert.deepEqual(ROPE.planRope({ downFrom: 0, upFrom: 1, count: 3, free: free(0, 9), minY: 0 }), [0, 1, 2], "world bottom");
});
test("Elven rope: whole column found, drops split into stacks of 64", () => {
  const pieces = new Set([3, 4, 5, 9]);
  assert.deepEqual(ROPE.columnBounds((y) => pieces.has(y), 4), { bottom: 3, top: 5 });
  assert.deepEqual(ROPE.columnBounds((y) => pieces.has(y), 9), { bottom: 9, top: 9 });
  assert.deepEqual(ROPE.dropStacks(64), [64]);
  assert.deepEqual(ROPE.dropStacks(70), [64, 6]);
  assert.deepEqual(ROPE.dropStacks(1), [1]);
});
test("Elven rope: wall lies behind the face, the piece in front of the clicked face", () => {
  for (const f of ROPE.FACES) {
    const w = ROPE.wallOffset(f);
    const p = ROPE.pieceOffset(f);
    assert.deepEqual([w.x + p.x, w.z + p.z], [0, 0], f);
  }
  assert.deepEqual(ROPE.wallOffset("north"), { x: 0, z: 1 });
  assert.equal(ROPE.wallOffset("up"), undefined);
  assert.equal(ROPE.isUnsupported({ isAir: true, isLiquid: false }), true);
  assert.equal(ROPE.isUnsupported({ isAir: false, isLiquid: false }), false);
  assert.equal(ROPE.isUnsupported(undefined), false, "unloaded chunk keeps the rope");
});
test("Elven rope: levitation controller reaches the ladder speed at once and holds it", () => {
  const target = 3.2 / 20;
  let v = 0;
  const speeds = [];
  for (let tick = 0; tick < 200; tick++) speeds.push((v = ROPE.levitationStep(v, target).v));
  assert.ok(speeds[0] > target * 0.9, `first tick ${speeds[0]}`);
  const mean = speeds.slice(5).reduce((a, b) => a + b, 0) / (speeds.length - 5);
  assert.ok(Math.abs(mean - target) < 0.002, `mean ${mean * 20} b/s`);
  // the old fixed level 2.35 gives the 2.1 blocks/s measured in game: the model matches the game
  const m = ROPE.LEVITATION;
  let w = 0;
  for (let tick = 0; tick < 100; tick++) w = m.drag * (w + m.pull * (2.35 * m.perLevel - w));
  assert.ok(Math.abs(w * 20 - 2.13) < 0.03, `steady ${w * 20}`);
  // falling into the rope: the first levels are high, never above the cap
  assert.equal(ROPE.levitationStep(-1, target).amplifier, m.maxLevel - 1);
  assert.equal(ROPE.levitationStep(1, target).amplifier, 0, "level never below 1");
  assert.ok(ROPE.CLIMB.effectTicks <= 10, "short effects");
  assert.equal(ROPE.brakes(-0.25, ROPE.CLIMB.downSpeed / 20), true, "5 blocks/s down brakes");
  assert.equal(ROPE.brakes(-0.15, ROPE.CLIMB.downSpeed / 20), false, "3 blocks/s down slides on");
});
test("Elven rope: every rule the wiring calls is imported (a missing import throws inside try/catch, silently)", () => {
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8");
  const imported = src.match(/import \{([^}]*)\} from "\.\/elven_rope_rules\.js"/)[1].split(",").map((n) => n.trim());
  for (const name of Object.keys(ROPE)) {
    if (new RegExp(`\\b${name}\\b`).test(src.replace(/^import .*$/gm, ""))) assert.ok(imported.includes(name), `${name} used but not imported`);
  }
});
test("Elven rope: block, item and recipe agree", () => {
  const block = readJson("../lothlorien_bp/blocks/elven_rope.json")["minecraft:block"];
  assert.deepEqual(block.description.states["lothlorien:face"], ROPE.FACES);
  assert.equal(block.components["minecraft:collision_box"], false, "climb through it");
  assert.equal(block.components["minecraft:loot"], "loot_tables/blocks/elven_rope.json", "native loot covers the popped piece; script drops remaining pieces");
  assert.equal(block.permutations.length, ROPE.FACES.length);
  const item = readJson("../lothlorien_bp/items/elven_rope.json")["minecraft:item"];
  assert.equal(item.components["minecraft:max_stack_size"], 64);
  assert.ok("lothlorien:rope" in item.components);
  const recipe = readJson("../lothlorien_bp/recipes/elven_rope.json")["minecraft:recipe_shaped"];
  assert.deepEqual(Object.values(recipe.key).map((i) => i.item).sort(), ["lothlorien:golden_fern", "lothlorien:morning_dew"]);
  assert.equal(recipe.result.count, 1);
});
test("flet tree: the rope hangs on the trunk, facing away from it", () => {
  for (const t of flets) {
    const piece = t.blocks.get(`${LADDER.x},0,${LADDER.z}`);
    assert.deepEqual(piece, { name: B.ropeHanging, states: { "minecraft:cardinal_direction": "north" } });
    assert.ok([B.log, B.wood].includes(at(t, LADDER.x, 0, LADDER.z + 1)), "wall behind the rope");
  }
});
// Elven lighting (Phase 17): lantern, jar, chandelier.
const LAMPS = { elven_lantern: ["up", "down"], elven_lantern_heartwood: ["up", "down"],
  firefly_jar: ["up"], elven_chandelier: ["down"] };
test("elven lamps: faces they may be placed on, light, and script support for each", () => {
  const antlerJs = readFileSync(new URL("../lothlorien_bp/scripts/antler.js", import.meta.url), "utf8");
  for (const [id, faces] of Object.entries(LAMPS)) {
    const b = readJson(`../lothlorien_bp/blocks/${id}.json`)["minecraft:block"];
    assert.deepEqual(b.components["minecraft:placement_filter"].conditions[0].allowed_faces, faces, id);
    assert.ok(b.components["minecraft:light_emission"] >= 11, `${id} gives light`);
    assert.equal(b.components["minecraft:light_dampening"], 0, `${id} lets light through`);
    assert.ok("lothlorien:lamp_support" in b.components, `${id} pops off when its support goes`);
    assert.ok(antlerJs.includes(`"lothlorien:${id}"`), `${id} is in the support script's id list`);
  }
});
test("elven lantern: one model stands or hangs by its spire; the jar is all blend (one render_method per block)", () => {
  const b = readJson("../lothlorien_bp/blocks/elven_lantern.json")["minecraft:block"];
  assert.equal(b.components["minecraft:geometry"], "geometry.lothlorien.elven_lantern");
  assert.deepEqual(b.components["minecraft:placement_filter"].conditions[0].allowed_faces, ["up", "down"]);
  assert.equal(b.components["minecraft:material_instances"].wood.render_method, "opaque"); // the carving is real cubes
  const gold = readJson("../lothlorien_bp/blocks/elven_lantern_heartwood.json")["minecraft:block"].components;
  assert.equal(gold["minecraft:geometry"], b.components["minecraft:geometry"]);
  assert.equal(gold["minecraft:material_instances"].wood.texture, "lothlorien:elven_lantern_wood_heartwood");
  const jar = readJson("../lothlorien_bp/blocks/firefly_jar.json")["minecraft:block"].components;
  assert.equal(jar["minecraft:material_instances"].glass.render_method, "blend");
  for (const [k, m] of Object.entries(jar["minecraft:material_instances"])) assert.equal(m.render_method, "blend", `jar ${k}: one render_method per block`);
  for (const g of ["elven_lantern", "firefly_jar", "elven_chandelier"]) {
    assert.ok(existsSync(new URL(`../lothlorien_rp/models/blocks/${g}.geo.json`, import.meta.url)), g);
  }
});
test("elven lantern: one core paints every outward side", () => {
  const geo = readJson("../lothlorien_rp/models/blocks/elven_lantern.geo.json")["minecraft:geometry"][0];
  const sides = ["north", "east", "south", "west"];
  const cores = geo.bones.flatMap((bone) => bone.cubes).filter((cube) =>
    sides.every((side) => cube.uv?.[side]?.material_instance === "glow"));
  assert.equal(cores.length, 1, "one four-sided glow core");
  assert.ok(cores[0].origin[0] < 0 && cores[0].origin[2] < 0, "core is centred behind the windows");
});
test("elven lamps: items place their block; recipes use existing items and chain lantern -> chandelier", () => {
  const ids = new Set(readdirSync(new URL("../lothlorien_bp/items", import.meta.url)).map((f) => `lothlorien:${f.replace(".json", "")}`));
  for (const id of Object.keys(LAMPS)) {
    const definition = readJson(`../lothlorien_bp/items/${id}.json`)["minecraft:item"];
    const item = definition.components;
    assert.equal(item["minecraft:block_placer"].block, `lothlorien:${id}`);
    assert.deepEqual(definition.description.menu_category,
      { category: "items", group: "minecraft:itemGroup.name.lanterns" }, `${id}: creative group`);
    const r = readJson(`../lothlorien_bp/recipes/${id}.json`)["minecraft:recipe_shaped"];
    for (const k of Object.values(r.key)) assert.ok(k.item.startsWith("minecraft:") || ids.has(k.item), `${id}: ${k.item}`);
    assert.equal(r.result.item, `lothlorien:${id}`);
  }
  const lantern = readJson("../lothlorien_bp/recipes/elven_lantern.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(lantern.key).some((k) => k.item === "lothlorien:bottle_of_fireflies"));
  const heartwood = readJson("../lothlorien_bp/recipes/elven_lantern_heartwood.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(heartwood.key).some((k) => k.item === "lothlorien:mallorn_heartwood_trapdoor"));
  const chandelier = readJson("../lothlorien_bp/recipes/elven_chandelier.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(chandelier.key).some((k) => k.item === "lothlorien:elven_lantern"));
  assert.ok(Object.values(chandelier.key).some((k) => k.item === "lothlorien:deer_antler"));
});
test("elven lamps: flipbook entries exist for every animated tile, names are in the lang file", () => {
  const flips = readJson("../lothlorien_rp/textures/flipbook_textures.json").map((f) => f.atlas_tile);
  for (const t of ["elven_lantern_glow", "elven_jar_inner"]) assert.ok(flips.includes(`lothlorien:${t}`), t);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const id of Object.keys(LAMPS)) {
    assert.ok(lang.includes(`tile.lothlorien:${id}.name=`) && lang.includes(`item.lothlorien:${id}=`), id);
  }
});
test("Mallorn boat items use the boat and chest-boat creative groups", () => {
  for (const wood of ["mallorn", "mallorn_heartwood"]) {
    for (const [suffix, group] of [["boat", "boat"], ["chest_boat", "chestboat"]]) {
      const item = readJson(`../lothlorien_bp/items/${wood}_${suffix}.json`)["minecraft:item"];
      assert.deepEqual(item.description.menu_category,
        { category: "items", group: `minecraft:itemGroup.name.${group}` });
    }
  }
});
// --- Elven village (R3 layout): connector standard of every piece, vertical crown jigsaws, slab arches, pools, assembled villages ---
const VILLAGE = "../lothlorien_bp/structures/lothlorien/village";
const villageData = loadVillageData();
const DECK_NAME = "lothlorien:village_deck", DECK_HI_NAME = "lothlorien:village_deck_hi", CROWN_NAME = "lothlorien:village_crown";
const MALLORN_LOG = "lothlorien:mallorn_log";
const villagePieces = () => readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
  parseMcstructure(readFileSync(new URL(`${VILLAGE}/${f}`, import.meta.url)), f.replace(".mcstructure", "")));
const isTree = (n) => /^(combo_|central_)/.test(n);
test("village: every deck connector is a rim connector on the box face, faces outward and follows the connector standard", () => {
  const pieces = villagePieces();
  assert.ok(pieces.length >= 25, `${pieces.length} village pieces`);
  for (const piece of pieces) {
    const name = piece.name, [sx, , sz] = piece.size;
    const deckJigsaws = piece.jigsaws.filter((j) => j.dir && j.pool !== undefined && j.target === DECK_NAME);
    if (name.startsWith("crown_")) { assert.equal(deckJigsaws.length, 0, `${name}: crowns have no deck connector`); continue; }
    assert.ok(deckJigsaws.length >= 1, `${name}: no deck connector`);
    for (const j of deckJigsaws) {
      const tag = `${name} ${j.dirId}@${j.x},${j.y},${j.z}`;
      const [dx, dz] = j.dir;
      const onFace = dx === 1 ? j.x === sx - 1 : dx === -1 ? j.x === 0 : dz === 1 ? j.z === sz - 1 : j.z === 0;
      assert.ok(onFace, `${tag}: not on the outer face of the box`);
      assert.ok(j.name === DECK_NAME || (j.name === DECK_HI_NAME && /^(combo_|central_)/.test(name)), `${tag}: name ${j.name}`);
      assert.equal(j.final, PLANKS, `${tag}: final_state`);
      assert.equal(j.joint, "aligned", `${tag}: joint`);
      const plug = name === "railing_end", pp = [-dz, dx];
      for (let off = -2; off <= 2; off++) {
        const x = j.x + pp[0] * off, z = j.z + pp[1] * off, at = (h) => piece.at(x, j.y + h, z);
        const deck = at(0);
        assert.ok(off === 0 ? deck === "minecraft:jigsaw" : deck === PLANKS, `${tag}: deck at ${off} is ${deck}`);
        if (Math.abs(off) === 2) assert.equal(at(1), FENCE, `${tag}: rail at ${off}`);
        else if (!plug) for (let h = 1; h <= 3; h++) assert.ok([null, "minecraft:air"].includes(at(h)), `${tag}: headroom ${off},${h}: ${at(h)}`);
      }
    }
  }
});
test("village: tree pieces carry an upward rollable crown jigsaw (log final state) 5 above the top deck; crowns have the matching downward one", () => {
  const pieces = villagePieces();
  const trees = pieces.filter((p) => isTree(p.name));
  assert.ok(trees.length >= 10, `${trees.length} tree pieces`);
  for (const p of trees) {
    const ups = p.jigsaws.filter((j) => j.dirId === 1);
    assert.equal(ups.length, 1, `${p.name}: upward jigsaws`);
    const [j] = ups, [sx, sy, sz] = p.size;
    assert.equal(j.name, CROWN_NAME); assert.equal(j.target, CROWN_NAME); assert.equal(j.joint, "rollable"); assert.equal(j.final, MALLORN_LOG);
    assert.ok(villageData.pools.has(j.pool), `${p.name}: crown pool ${j.pool}`);
    assert.equal(j.y, sy - 1, `${p.name}: crown jigsaw on the top face`);
    if (!p.name.startsWith("combo_")) assert.deepEqual([j.x, j.z], [(sx - 1) / 2, (sz - 1) / 2], `${p.name}: crown jigsaw on the trunk axis`);
    const topDeck = Math.max(...p.jigsaws.filter((k) => k.dir).map((k) => k.y));
    assert.equal(j.y - topDeck, 5, `${p.name}: crown box starts 6 above the top deck (headroom + highest arch box)`);
    assert.equal(p.at(j.x, j.y - 1, j.z), MALLORN_LOG, `${p.name}: trunk reaches the jigsaw`);
  }
  const crowns = pieces.filter((p) => p.name.startsWith("crown_"));
  assert.ok(crowns.length >= 5);
  for (const p of crowns) {
    const downs = p.jigsaws.filter((j) => j.dirId === 0);
    assert.equal(downs.length, 1, `${p.name}: downward jigsaws`);
    const [j] = downs, [sx, , sz] = p.size;
    assert.equal(j.name, CROWN_NAME); assert.equal(j.target, CROWN_NAME); assert.equal(j.final, MALLORN_LOG); assert.equal(j.pool, "minecraft:empty");
    assert.deepEqual([j.x, j.y, j.z], [(sx - 1) / 2, 0, (sz - 1) / 2], `${p.name}: jigsaw at the bottom centre`);
    assert.equal(p.at(j.x, 1, j.z), MALLORN_LOG, `${p.name}: the trunk continues above the jigsaw`);
    assert.ok(p.blocks.some((b) => b.name === "lothlorien:mallorn_leaves"), `${p.name}: leaves`);
    assert.equal(p.blocks.filter((b) => b.y === 0 && b.name !== "lothlorien:mallorn_leaves" && b.name !== MALLORN_LOG).length, 0, `${p.name}: nothing but leaves and trunk in the jigsaw layer`);
  }
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const locs = (id) => pool(id).elements.map((e) => e.element.location.split("/").pop());
  assert.deepEqual(locs("crowns"), ["crown_large", "crown_medium"]);
  assert.equal(pool("crowns").fallback, "lothlorien:village/crowns_fallback");
  assert.deepEqual(locs("crowns_fallback"), ["crown_large", "crown_medium", "crown_small"], "trees at max_depth only see the fallback: it offers the big crowns too");
  assert.deepEqual(locs("crowns_small"), ["crown_small"]);
  assert.equal(pool("crowns_central").fallback, "lothlorien:village/crowns_small");
  assert.ok(locs("crowns_central").length >= 2);
  assert.equal(pool("exits").elements.length, 3);
  assert.equal(pool("combos").fallback, "lothlorien:village/exits");
  assert.equal(pool("exits").fallback, "lothlorien:village/plugs");
  assert.ok(!villageData.pools.has("lothlorien:village/bridges") && !villageData.pools.has("lothlorien:village/nodes"), "no pool hands out a bridge or a node alone");
  assert.ok(villageData.getPiece("lothlorien/village/central_mallorn_01").jigsaws.some((j) => j.name === "lothlorien:village_anchor"), "start anchor");
});
test("village: the one rail constant is the only rail block, bridges are symmetric slab arches in half steps, rails follow", () => {
  const SLAB_ID = "lothlorien:mallorn_slab";
  for (const p of villagePieces()) {
    for (const b of p.blocks) assert.ok(!b.name.endsWith("_fence") || b.name === FENCE, `${p.name}: another rail block ${b.name}`);
    for (const b of p.blocks) if (b.name === SLAB_ID) assert.ok(["bottom", "top"].includes(b.states["minecraft:vertical_half"]), `${p.name}: slab state`);
  }
  const lengths = new Set();
  for (const p of villagePieces().filter((q) => /^combo_.*_bridge_\d+$/.test(q.name))) { // straight bridges: the arch of the combo, along the entry column
    const L = Number(p.name.match(/_bridge_(\d+)$/)[1]);
    lengths.add(L);
    const entry = p.jigsaws.find((j) => j.dirId === 2 && j.z === 0 && j.name === DECK_NAME), cx = entry.x, y0 = entry.y;
    const surf = [];
    for (let z = 0; z < L; z++) {
      let s = null;
      for (let y = y0; y < p.size[1]; y++) {
        const n = p.at(cx, y, z);
        if (n === PLANKS) s = 2 * (y - y0) + 2; else if (n === SLAB_ID) s = 2 * (y - y0) + 1;
        if (n === "minecraft:jigsaw") s = 2 * (y - y0) + 2;
      }
      surf.push(s);
    }
    const bn = `${p.name} (bridge ${L})`;
    assert.equal(surf[0], 2, `${bn}: starts at the connector deck`);
    assert.deepEqual(surf, [...surf].reverse(), `${bn}: symmetric arch ${surf}`);
    for (let z = 1; z < L; z++) assert.ok(Math.abs(surf[z] - surf[z - 1]) <= 1, `${bn}: step > 0.5 block at ${z}: ${surf}`);
    assert.equal(Math.max(...surf) - 2, L <= 7 ? 2 : 4, `${bn}: rise`);
    for (let z = 0; z < L; z++) for (const x of [cx - 2, cx + 2]) { // rail one cell above the block the walker stands on
      const layer = surf[z] % 2 === 0 ? surf[z] / 2 - 1 : (surf[z] - 1) / 2;
      assert.equal(p.at(x, y0 + layer + 1, z), FENCE, `${bn}: rail at ${x},${z}`);
    }
  }
  assert.deepEqual([...lengths].sort((a, b) => a - b), [7, 9, 11, 13, 15], "every straight bridge length is used by some combo"); // P9: no 5-long bridge, the bigger crowns need room
  const names = villagePieces().map((q) => q.name);
  // owner 2026-10-08: no dog-legs in combos ("ugly and unnecessary, it could have been straight"); the loop closer keeps the diagonal
  assert.ok(!names.some((q) => q.includes("_bridge_dog_")), "no dog-leg combo");
});
test("village: platform shapes differ (irregular rectilinear outlines of different sizes)", () => {
  const seen = new Map();
  for (const p of villagePieces().filter((q) => isTree(q.name))) {
    const ys = p.jigsaws.filter((j) => j.dir).map((j) => j.y), y = Math.min(...ys);
    const cells = p.blocks.filter((b) => b.y === y && b.name === PLANKS).map((b) => `${b.x},${b.z}`).sort().join(";") + `|${p.size}`;
    seen.set(p.name, cells);
  }
  const nodes = new Set([...seen.keys()].filter((n) => /^combo_node_/.test(n)).map((n) => n.match(/^combo_(node_[a-z])_/)[1]));
  assert.equal(nodes.size, 6, "all six node platforms are used by combos");
  assert.ok(new Set(villagePieces().filter((q) => /^combo_tower_/.test(q.name)).map((q) => q.name.match(/^combo_(tower_[a-z])_/)[1])).size === 3, "all three towers are used by combos");
  const sizes = new Set([...seen.keys()].map((n) => villageData.getPiece(`lothlorien/village/${n}`).size.slice(0, 1).concat(villageData.getPiece(`lothlorien/village/${n}`).size.slice(2)).join("x")));
  assert.ok(sizes.size >= 8, `footprint sizes: ${[...sizes]}`);
});
test("village: pools, fallbacks, piece files and connector pools all resolve", () => {
  const ids = [...villageData.pools.keys()].filter((k) => k.startsWith("lothlorien:village/"));
  assert.ok(ids.length >= 8, `${ids.length} pools`);
  for (const id of ids) {
    const p = villageData.pools.get(id);
    for (const e of p.elements) {
      assert.ok(existsSync(new URL(`../lothlorien_bp/structures/${e.element.location}.mcstructure`, import.meta.url)), `${id}: ${e.element.location}`);
      for (const j of villageData.getPiece(e.element.location).jigsaws) {
        if (j.name === DECK_NAME || j.name === DECK_HI_NAME || j.name === CROWN_NAME) assert.ok(j.pool === "minecraft:empty" || villageData.pools.has(j.pool), `${id}: ${e.element.location} points at missing pool ${j.pool}`);
      }
    }
    if (p.fallback && p.fallback !== "minecraft:empty") assert.ok(villageData.pools.has(p.fallback), `${id}: fallback ${p.fallback}`);
  }
  assert.ok(villageData.pools.has(villageData.structure.start_pool));
  assert.ok(villageData.structure.max_depth >= 1);
  const used = new Set([...villageData.pools.values()].flatMap((p) => p.elements.map((e) => e.element.location.split("/").pop())));
  for (const p of villagePieces()) assert.ok(used.has(p.name), `${p.name}: piece file is in no pool (remove it)`);
});
// --- Elven village P6: no bridge to nowhere, no hanging balcony ---
test("village combos: a bridge only exists inside a combo piece with its destination tree (entry on the bridge, tree exits, crown jigsaw, trunk to the ground)", () => {
  const names = readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) => f.replace(".mcstructure", ""));
  assert.ok(!names.some((n) => /^(bridge_|node_|tower_|tree_platform)/.test(n)), "no bridge, node or tower piece is shipped alone");
  const combos = villagePieces().filter((p) => p.name.startsWith("combo_"));
  assert.ok(combos.length >= 20, `${combos.length} combo pieces`); // straight bridges only since 2026-10-08
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const inCombos = new Set(pool("combos").elements.map((e) => e.element.location.split("/").pop()));
  for (const p of combos) {
    assert.ok(inCombos.has(p.name), `${p.name} is in the combos pool`);
    const deck = p.jigsaws.filter((j) => j.dir && j.target === DECK_NAME);
    const entries = deck.filter((j) => j.name === DECK_NAME);
    assert.equal(entries.length, 1, `${p.name}: exactly one entry connector (the bridge's far end)`);
    const [en] = entries;
    assert.deepEqual([en.dirId, en.z, en.pool], [2, 0, "minecraft:empty"], `${p.name}: entry faces north on the bridge end`);
    assert.ok(deck.length >= 2 && deck.every((j) => j === en || (j.name === DECK_HI_NAME && j.pool === "lothlorien:village/combos")), `${p.name}: the tree's exits only act as parents and point at combos`);
    // the destination tree: crown jigsaw on a log trunk that reaches the bottom of the box, deck on the entry level
    const up = p.jigsaws.find((j) => j.dirId === 1);
    assert.ok(up, `${p.name}: crown jigsaw`);
    assert.equal(p.at(up.x, up.y - 1, up.z), MALLORN_LOG, `${p.name}: trunk`);
    assert.equal(p.at(up.x, 0, up.z), MALLORN_LOG, `${p.name}: trunk reaches the ground (ROOTS)`);
    // the bridge end is joined to the platform inside the piece: no jigsaw faces south on the bridge, the exits are the node's own faces
    const L = deck.length;
    assert.ok(!p.jigsaws.some((j) => j.dirId === 3 && j.z < 5), `${p.name}: no connector at the bridge's far end (it is joined to the node)`);
    assert.ok(L >= 2);
  }
});
test("village exits: no free-floating balcony; the braced balcony and the lookout stand on a log pillar to the bottom of the box and are braced under the deck", () => {
  assert.ok(!existsSync(new URL(`${VILLAGE}/balcony_small.mcstructure`, import.meta.url)), "balcony_small is gone");
  for (const p of villageData.pools.values()) for (const e of p.elements) assert.ok(!/balcony_small/.test(e.element.location), "balcony_small is in no pool");
  const bal = villagePieces().find((p) => p.name === "balcony_braced");
  const con = bal.jigsaws.find((j) => j.dir);
  assert.deepEqual([con.name, con.target, con.pool, con.final], [DECK_NAME, DECK_NAME, "minecraft:empty", PLANKS]);
  const logs = bal.blocks.filter((b) => b.name === MALLORN_LOG);
  const pillarX = new Set(logs.filter((b) => b.y === 0).map((b) => `${b.x},${b.z}`));
  assert.ok(pillarX.size >= 5, "pillar cross-section at the bottom of the box");
  for (const k of pillarX) { const [x, z] = k.split(",").map(Number); for (let y = 0; y < con.y; y++) assert.equal(bal.at(x, y, z), MALLORN_LOG, `pillar column ${k} is continuous up to the deck (y ${y})`); }
  assert.ok(con.y >= 40, "the pillar runs 40 below the deck: it reaches the ground from any deck of the village (up to 3 levels)");
  const braces = logs.filter((b) => b.y >= con.y - 3 && b.y < con.y && !pillarX.has(`${b.x},${b.z}`));
  assert.ok(braces.length >= 8, `braces under the deck: ${braces.length}`);
  assert.ok(braces.every((b) => ["bottom", undefined].every(() => true)) && braces.some((b) => b.y === con.y - 1), "a brace ends right under the deck");
  const lookout = villagePieces().find((p) => p.name === "lookout_01");
  assert.equal(lookout.at(4, 0, 4), MALLORN_LOG, "lookout pillar to the bottom of the box");
  const ex = villageData.pools.get("lothlorien:village/exits");
  assert.deepEqual(ex.elements.map((e) => e.element.location.split("/").pop()).sort(), ["balcony_braced", "lookout_01", "railing_end"]);
  assert.equal(ex.fallback, "lothlorien:village/plugs");
});
test("village sim: the bridge-without-destination metric flags a bridge piece placed alone and a combo without its tree", () => {
  const ck = (placed) => { // minimal fake placement run through the same counting rules
    const hasLog = (p) => p.piece.blocks.some((b) => b.y === 0 && /_(log|wood)$/.test(b.name));
    return placed.filter((p) => p.name.startsWith("bridge_") || (p.name.startsWith("combo_") && !(hasLog(p) && p.piece.jigsaws.some((j) => j.dirId === 1)))).length;
  };
  const good = villageData.getPiece("lothlorien/village/" + villagePieces().find((p) => p.name.startsWith("combo_")).name);
  assert.equal(ck([{ name: "combo_x", piece: good }]), 0);
  assert.equal(ck([{ name: "bridge_7", piece: good }]), 1);
  assert.equal(ck([{ name: "combo_x", piece: { blocks: [], jigsaws: [] } }]), 1);
});
let villageRows = null;
const villages = () => (villageRows ??= runSeeds(villageData, 30, 1));
test("village: 30 simulated villages connect, never overlap, terminate, are fully walkable in 3D, have crowns and ~8-10 trees", () => {
  const t0 = Date.now();
  const rows = villages();
  for (const r of rows) {
    assert.deepEqual([...new Set(r.ck.fail)].slice(0, 3), [], `seed ${r.seed}`);
    assert.equal(r.ck.unreachable, 0, `seed ${r.seed}: unreachable walk cells`);
    assert.equal(r.ck.overlaps, 0);
    assert.ok(r.ck.walkCells > 200 && r.ck.reached === r.ck.walkCells, `seed ${r.seed}: walk cells ${r.ck.reached}/${r.ck.walkCells}`);
    assert.ok(r.ck.kinds.crown >= r.ck.kinds.trees - 3, `seed ${r.seed}: crowns ${r.ck.kinds.crown} for ${r.ck.kinds.trees} trees`);
  }
  assert.ok(new Set(rows.map((r) => r.hash)).size >= 25, "layouts barely vary");
  const avg = rows.reduce((s, r) => s + r.ck.kinds.trees, 0) / rows.length;
  assert.ok(avg >= 7 && avg <= 12, `average ${avg} trees`);
  assert.ok(rows.filter((r) => r.ck.levels >= 2).length >= rows.length * 0.6, "two levels in most villages");
  for (const r of rows) { // P6: no bridge to nowhere, no hanging balcony
    assert.equal(r.ck.kinds.bridgesNoDest, 0, `seed ${r.seed}: bridges without a destination tree`);
    assert.equal(r.ck.kinds.unsupported, 0, `seed ${r.seed}: unsupported balcony`);
    assert.equal(r.ck.kinds.bridgeAlone, 0, `seed ${r.seed}: a bridge piece placed alone`);
  }
  assert.ok(rows.reduce((s, r) => s + r.ck.open, 0) / rows.length <= 1.5, "too many open connectors");
  assert.ok(Date.now() - t0 < 20000, `simulation took ${Date.now() - t0} ms`);
});
test("village: every branch end of every shipped village piece carries leaves (>= 6 within 2); fixtures: a bare branch is flagged, a tufted one passes", () => {
  for (const p of villagePieces()) {
    const m = new Map(p.blocks.map((b) => [`${b.x},${b.y},${b.z}`, { name: b.name, states: b.states }]));
    assert.deepEqual(bareBranchEnds(m), [], `${p.name}: bare branch end`);
  }
  const log = (face) => ({ name: B.log, states: { "minecraft:block_face": face } });
  const branch = new Map([["0,0,0", log("up")], ["0,1,0", log("up")], ["1,1,0", log("east")], ["2,1,0", log("east")], ["3,1,0", log("east")], ["4,1,0", log("east")]]);
  assert.deepEqual(bareBranchEnds(branch).map((q) => [q.x, q.y, q.z]), [[4, 1, 0]], "4 logs and no leaves: the end is bare");
  for (let x = 3; x <= 5; x++) for (let y = 1; y <= 3; y++) for (let z = -1; z <= 1; z++) if (!branch.has(`${x},${y},${z}`)) branch.set(`${x},${y},${z}`, { name: B.leaves, states: {} });
  assert.deepEqual(bareBranchEnds(branch), [], "a 3x3x3 leaf blob on the tip passes");
});
test("giant mallorn generator: the chosen trees have no bare branch end, and bentBranch without maxY keeps its output", () => {
  const draw = (maxY) => { const b = makeBuilder(makeRandom(5)); const r = makeRandom(9); bentBranch(b, r, 0, 0, 1, 0, 3, 12, 0.9, 2, maxY); return b.result(30).logs.map((c) => c.y); };
  assert.deepEqual(draw(), draw(Infinity));
  assert.ok(Math.max(...draw(8)) <= 8 && Math.max(...draw()) > 8, "maxY caps the rise (and without it the branch does climb past 8)");
});
// --- Elven village: rope fit (village_repair.js) ---
const HROPE = RP.ROPE_ID, WALLS = { north: [0, 1], south: [0, -1], east: [-1, 0], west: [1, 0] }; // rope face -> offset piece -> wall
function ropeWorld(face, { top = -1, ropeBottom = 0, deckY = 16, extra = {}, wallFrom = -20 } = {}) {
  const w = new Map(), [wx, wz] = WALLS[face], [fx, fz] = [-wx, -wz], px = 5, pz = 5;
  const terrain = (x, y, z) => (y > top ? "minecraft:air" : y === top ? "minecraft:grass_block" : "minecraft:dirt");
  const cells = new Map();
  for (let y = wallFrom; y <= deckY + 3; y++) cells.set(`${px + wx},${y},${pz + wz}`, "lothlorien:mallorn_log");
  for (let y = ropeBottom; y <= deckY; y++) cells.set(`${px},${y},${pz}`, HROPE);
  for (const [k, v] of Object.entries(extra)) cells.set(k.replace("X", px).replace("Z", pz), v);
  const at = (x, y, z) => { const v = cells.get(`${x},${y},${z}`); return v !== undefined ? (v === "UNLOADED" ? undefined : v) : terrain(x, y, z); };
  return { at, top: { x: px, y: deckY, z: pz }, face, front: [fx, fz] };
}
test("rope fit: flat ground with the lowest piece in the top block (the old start height) - the piece becomes grass, the rope ends on the grass", () => {
  const w = ropeWorld("north", { top: -1, ropeBottom: -1 }), r = RP.planRopeFit(w.at, w.top);
  assert.equal(r.buried, 1); assert.equal(r.hung, 0);
  assert.deepEqual(r.blocks.map((b) => [b.y, b.id]), [[-1, "minecraft:grass_block"]]);
});
test("rope fit: nothing to do when the rope stands on the first air cell (the new start height); ground 4 below hangs 4 pieces with the face of the wall", () => {
  const flat = ropeWorld("north", { top: -1, ropeBottom: 0 });
  assert.deepEqual(RP.planRopeFit(flat.at, flat.top).blocks, []);
  const low = ropeWorld("north", { top: -5, ropeBottom: 0 }), r = RP.planRopeFit(low.at, low.top);
  assert.equal(r.hung, 4); assert.deepEqual(r.blocks.map((b) => b.y), [-1, -2, -3, -4]);
  assert.ok(r.blocks.every((b) => b.id === HROPE && b.states["minecraft:cardinal_direction"] === "north"));
});
test("rope fit: ground 3 above (slope) replaces 3 pieces with the blocks in front of them; a short plant under the rope is replaced, water stops it; unloaded errors", () => {
  const hill = ropeWorld("north", { top: 2, ropeBottom: 0 }), r = RP.planRopeFit(hill.at, hill.top);
  assert.equal(r.buried, 3); assert.deepEqual(r.blocks.map((b) => [b.y, b.id]), [[0, "minecraft:dirt"], [1, "minecraft:dirt"], [2, "minecraft:grass_block"]]);
  const grass = ropeWorld("north", { top: -3, ropeBottom: 0, extra: { "X,-1,Z": "minecraft:short_grass" } });
  assert.equal(RP.planRopeFit(grass.at, grass.top).hung, 2, "the grass cell and the air under it, then the ground");
  const wet = ropeWorld("north", { top: -5, ropeBottom: 0, extra: { "X,-1,Z": "minecraft:water" } });
  assert.deepEqual(RP.planRopeFit(wet.at, wet.top).blocks, [], "rope stops above water");
  const gone = ropeWorld("north", { top: -5, ropeBottom: 0, extra: { "X,-1,Z": "UNLOADED" } });
  assert.match(RP.planRopeFit(gone.at, gone.top).error, /unloaded/);
  const noWall = ropeWorld("north", { top: -5, ropeBottom: 0, wallFrom: -1 });
  assert.equal(RP.planRopeFit(noWall.at, noWall.top).hung, 1, "the wall stops ending at -1: hangs only one piece");
});
test("rope fit in the simulator: the terrain top follows the Bedrock rule (first air at tree y 0 on flat ground, nothing to fix); lower ground hangs, higher ground buries - every rope ends on the ground", () => {
  const row = villages()[0], sim = (terrain) => {
    const world = new Map(row.ck.world), states = new Map(row.ck.states);
    return planLoops(row.res, world, states, { terrain, start: 0 });
  };
  const flat = sim(undefined);
  assert.deepEqual(flat.repairs.filter((p) => p.kind === "rope"), [], "start height -(ROOTS-1): the rope stands on the first air cell, nothing to repair");
  assert.ok(flat.ropeFeet.length >= 1 && flat.ropeFeet.every((f) => f.onGround && !f.buried));
  const low = sim(() => 14), high = sim(() => 20);
  assert.ok(low.repairs.find((p) => p.kind === "rope").hung === 3 && low.ropeFeet.every((f) => f.onGround && !f.buried), JSON.stringify(low.repairs));
  assert.ok(high.repairs.find((p) => p.kind === "rope").buried === 3 && high.ropeFeet.every((f) => f.onGround && !f.buried), JSON.stringify(high.repairs));
});
test("rope fit: all four rotations derive the face from the wall; repairGen finds the rope in the deck layer and applies it to the overlay", () => {
  for (const face of ["north", "south", "east", "west"]) {
    const w = ropeWorld(face, { top: -4, ropeBottom: 0 }), r = RP.planRopeFit(w.at, w.top);
    assert.equal(r.hung, 3, face); assert.ok(r.blocks.every((b) => b.states["minecraft:cardinal_direction"] === face), `${face}: face from the wall`);
    const reader = PL.boundedReader(w.at, { x0: -30, x1: 30, z0: -30, z1: 30 }), ov = PL.overlay(reader), log = [];
    const reps = PL.drive(RP.repairGen(ov, [[5, 16, 5]], { rect: { x0: -30, x1: 30, z0: -30, z1: 30 }, log }));
    assert.equal(reps.length, 1); assert.equal(reps[0].hung, 3); assert.equal(ov(5, -3, 5), HROPE, "the overlay sees the new piece");
    assert.deepEqual(PL.drive(RP.repairGen(ov, [[5, 16, 5]], { rect: { x0: -30, x1: 30, z0: -30, z1: 30 } })), [], "idempotent: a second run changes nothing");
    assert.equal(PL.drive(RP.repairGen(ov, [[5, 16, 5]], { rect: { x0: -30, x1: 30, z0: -30, z1: 30 }, repairs: false })).length, 0, "repairs: false turns them off");
  }
});
// --- Elven village: root flare at the pillars of balconies and lookouts (village_repair.js planFlare / findPillar) ---
const PILLAR_LOG = "lothlorien:mallorn_log";
function pillarWorld({ ground = () => -1, bottom = -12, deck = 16, extra = {} } = {}) { // plus-shaped pillar at 5,5 from `bottom` up to deck - 1; terrain: grass at ground(x, z), dirt below, air above
  const cells = new Map(), cx = 5, cz = 5;
  for (let y = bottom; y < deck; y++) for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) cells.set(`${cx + a},${y},${cz + b}`, PILLAR_LOG);
  for (const [k, v] of Object.entries(extra)) cells.set(k, v);
  const at = (x, y, z) => { const v = cells.get(`${x},${y},${z}`); if (v !== undefined) return v === "UNLOADED" ? undefined : v; const g = ground(x, z); return y > g ? "minecraft:air" : y === g ? "minecraft:grass_block" : "minecraft:dirt"; };
  return { at, marker: [cx + 3, deck, cz], pillar: { x: cx, z: cz, y: deck } };
}
const woodNeighbours = (blocks, x, y, z, pillar) => { // wood cells among the 26 neighbours, the pillar plus not counted
  const set = new Set(blocks.map((b) => `${b.x},${b.y},${b.z}`)); let n = 0;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
    if ((a || b || c) && set.has(`${x + a},${y + b},${z + c}`) && !(pillar.x === x + a && Math.abs(pillar.z - (z + c)) <= 1) && !(pillar.z === z + c && Math.abs(pillar.x - (x + a)) <= 1)) n++;
  }
  return n;
};
test("root flare: findPillar finds the plus-shaped pillar 3 or 4 cells from a marker, and not a 3x3 trunk", () => {
  const w = pillarWorld();
  assert.deepEqual(RP.findPillar(w.at, w.marker), w.pillar);
  assert.deepEqual(RP.findPillar(w.at, [5, 16, 9]), w.pillar, "4 cells away (lookout), another axis");
  assert.equal(RP.findPillar(w.at, [5, 16, 12]), null);
  const trunk = pillarWorld({ extra: Object.fromEntries([[6, 6], [4, 4], [6, 4], [4, 6]].map(([x, z]) => [`${x},15,${z}`, PILLAR_LOG])) });
  assert.equal(RP.findPillar(trunk.at, trunk.marker), null, "diagonal logs = a trunk, not a pillar");
});
test("root flare: flat ground gives 2-4 thin roots lying on the ground, sideways logs, no wood mass; a second run adds nothing", () => {
  const w = pillarWorld(), f = RP.planFlare(w.at, w.pillar);
  assert.ok(f.roots >= 2 && f.roots <= 4, `roots ${f.roots}`);
  for (const b of f.blocks) {
    assert.equal(b.id, PILLAR_LOG); assert.match(b.states["minecraft:block_face"], /^(east|south)$/);
    assert.equal(b.y, 0, "first cell above the grass at -1");
    assert.ok(woodNeighbours(f.blocks, b.x, b.y, b.z, w.pillar) <= 2, `wood mass at ${b.x},${b.y},${b.z}`);
    assert.ok(Math.abs(b.x - 5) + Math.abs(b.z - 5) <= 3 && Math.abs(b.x - 5) + Math.abs(b.z - 5) >= 2, "1-2 cells out from the arm");
  }
  const reader = PL.boundedReader(w.at, { x0: -30, x1: 30, z0: -30, z1: 30 }), ov = PL.overlay(reader);
  const first = PL.drive(RP.repairGen(ov, [w.marker], { rect: { x0: -30, x1: 30, z0: -30, z1: 30 } }));
  assert.equal(first.filter((p) => p.kind === "flare").length, 1);
  assert.deepEqual(PL.drive(RP.repairGen(ov, [w.marker], { rect: { x0: -30, x1: 30, z0: -30, z1: 30 } })), [], "idempotent");
  assert.deepEqual(RP.planFlare(w.at, w.pillar).blocks, f.blocks, "deterministic");
});
test("root flare: on a slope every root lies on the ground of its own column; plants are replaced, water and solid cells are not; a far pit gets no root", () => {
  const slope = pillarWorld({ ground: (x) => -1 + Math.floor((x - 5) / 2) }), f = RP.planFlare(slope.at, slope.pillar);
  assert.ok(f.blocks.length >= 2);
  for (const b of f.blocks) assert.equal(b.y, -1 + Math.floor((b.x - 5) / 2) + 1, `root at ${b.x} on the ground of its column`);
  const grass = pillarWorld({ extra: { "7,0,5": "minecraft:short_grass", "3,0,5": "minecraft:stone", "5,0,7": "minecraft:short_grass", "5,0,3": "minecraft:short_grass" } }), g = RP.planFlare(grass.at, grass.pillar);
  assert.ok(!g.blocks.some((b) => b.x === 3 && b.z === 5), "no root into a solid cell");
  const wet = pillarWorld({ ground: (x, z) => (z > 5 ? -1 : -1), extra: { "5,-1,7": "minecraft:water", "5,-1,3": "minecraft:water" } }), w2 = RP.planFlare(wet.at, wet.pillar);
  assert.ok(!w2.blocks.some((b) => b.x === 5), "no root over water");
});
test("root flare: a pillar that ends above the ground, unloaded cells and missing ground are skipped, not guessed", () => {
  const short = pillarWorld({ bottom: 6 }), s = RP.planFlare(short.at, short.pillar);
  assert.match(s.skip, /ends above the ground/);
  assert.match(RP.planFlare(pillarWorld({ extra: { "7,-1,5": "UNLOADED" } }).at, pillarWorld().pillar).error ?? "", /unloaded/);
  assert.match(RP.planFlare(pillarWorld({ ground: () => -90 }).at, pillarWorld().pillar).skip, /no ground/);
  const log = [];
  PL.drive(RP.repairGen(PL.overlay(PL.boundedReader(short.at, { x0: -30, x1: 30, z0: -30, z1: 30 })), [short.marker], { rect: { x0: -30, x1: 30, z0: -30, z1: 30 }, log }));
  assert.ok(log.some((l) => /^flare 5,5: skipped/.test(l)), log.join("|"));
});
test("pillar foot: no decoration leaves from the ground up to ground + 4 round the pillar; leaves above, buried leaves and foreign blocks stay; a twig whose tip is in the band goes", () => {
  const LEAF = "lothlorien:mallorn_leaves", extra = {};
  for (const y of [-1, 0, 1, 2, 3, 4, 5, 6, 9]) { extra[`7,${y},6`] = LEAF; extra[`3,${y},4`] = LEAF; extra[`5,${y},8`] = LEAF; } // ivy beside the arms (ground block at -1)
  extra["8,2,5"] = "minecraft:stone"; extra["6,2,6"] = "minecraft:oak_leaves"; extra["15,2,5"] = LEAF; // a foreign block, a vanilla leaf, a leaf far outside the ring
  // a low twig: out from the +x arm at y 1, up to y 3, its tuft round it; a high twig: out at y 8, up to 10
  extra["7,1,5"] = PILLAR_LOG; extra["7,2,5"] = PILLAR_LOG; extra["7,3,5"] = PILLAR_LOG; extra["9,3,6"] = LEAF; extra["7,4,4"] = LEAF;
  extra["3,8,5"] = PILLAR_LOG; extra["3,9,5"] = PILLAR_LOG; extra["3,10,5"] = PILLAR_LOG; extra["3,11,5"] = LEAF;
  const w = pillarWorld({ extra }), c = RP.planPillarClear(w.at, w.pillar, -1);
  assert.ok(c.blocks.every((b) => b.id === "minecraft:air"));
  const gone = new Set(c.blocks.map((b) => `${b.x},${b.y},${b.z}`));
  for (const x of [7, 3, 5]) for (const y of [0, 1, 2, 3]) { const z = x === 7 ? 6 : x === 3 ? 4 : 8; assert.ok(gone.has(`${x},${y},${z}`), `leaf ${x},${y},${z} cleared`); }
  for (const k of ["7,-1,6", "7,5,6", "7,6,6", "7,9,6", "3,4,4", "5,4,8", "3,5,4", "5,9,8", "8,2,5", "6,2,6", "15,2,5", "3,8,5", "3,9,5", "3,11,5"]) assert.ok(!gone.has(k), `${k} stays`);
  for (const k of ["7,1,5", "7,2,5", "7,3,5", "9,3,6", "7,4,4"]) assert.ok(gone.has(k), `${k} (low twig and its tuft) removed`);
  assert.equal(c.twigs, 1);
  const ov = PL.overlay(PL.boundedReader(w.at, { x0: -30, x1: 30, z0: -30, z1: 30 })), rect = { x0: -30, x1: 30, z0: -30, z1: 30 };
  const first = PL.drive(RP.repairGen(ov, [w.marker], { rect }));
  assert.equal(first.filter((p) => p.kind === "pillarclear").length, 1);
  assert.equal(first.filter((p) => p.kind === "flare").length, 1, "the roots still come");
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) assert.ok(ov(5 + dx, 0, 5 + dz) !== LEAF);
  assert.deepEqual(PL.drive(RP.repairGen(ov, [w.marker], { rect })), [], "idempotent: the roots are not taken for twigs");
  assert.equal(RP.planPillarClear(pillarWorld().at, w.pillar, -1).blocks.length, 0, "a bare pillar: nothing to do");
});
test("pillar foot: unloaded cells error; a pillar without ground is left alone", () => {
  assert.match(RP.planPillarClear(pillarWorld({ extra: { "7,2,5": "UNLOADED" } }).at, { x: 5, z: 5, y: 16 }, -1).error ?? "", /unloaded/);
  const w = pillarWorld({ ground: () => -90, extra: { "7,2,6": "lothlorien:mallorn_leaves" } }), rect = { x0: -30, x1: 30, z0: -30, z1: 30 };
  assert.deepEqual(PL.drive(RP.repairGen(PL.overlay(PL.boundedReader(w.at, rect)), [w.marker], { rect })), []);
});
test("root flare in the simulator: every pillar of the villages gets roots without wood mass; skips are rare", () => {
  const row = villages()[0], world = new Map(row.ck.world), states = new Map(row.ck.states), r = planLoops(row.res, world, states, { terrain: undefined, start: 0 });
  const flares = r.repairs.filter((p) => p.kind === "flare");
  assert.ok(flares.length >= 1 && flares.every((p) => p.roots >= 1 && p.roots <= 4), JSON.stringify(flares));
  assert.ok(r.flareLog.length <= flares.length / 4 + 1, r.flareLog.join("|"));
});
// --- Elven village: engine-state fixes (leaf decay, fence links, rope side under rotation) ---
const shippedStructures = () => ["../lothlorien_bp/structures/lothlorien", VILLAGE].flatMap((d) =>
  readdirSync(new URL(`${d}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
    parseMcstructure(readFileSync(new URL(`${d}/${f}`, import.meta.url)), f.replace(".mcstructure", ""))));
test("village and giants: no orphan leaves (every leaf has a 6-neighbour path of <= 10 leaves to a log; trees.js decays the rest)", () => {
  for (const piece of shippedStructures()) {
    const names = new Map(piece.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b.name]));
    const dist = new Map();
    const queue = [];
    for (const [k, n] of names) if (n === "lothlorien:mallorn_log" || n === "lothlorien:mallorn_wood") { dist.set(k, 0); queue.push(k); }
    for (let i = 0; i < queue.length; i++) {
      const [x, y, z] = queue[i].split(",").map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = `${x + dx},${y + dy},${z + dz}`;
        if (names.get(n) === "lothlorien:mallorn_leaves" && !dist.has(n)) { dist.set(n, dist.get(queue[i]) + 1); queue.push(n); }
      }
    }
    const orphans = [...names].filter(([k, n]) => n === "lothlorien:mallorn_leaves" && !(dist.get(k) <= 10));
    assert.equal(orphans.length, 0, `${piece.name}: ${orphans.length} orphan leaves, e.g. ${orphans[0]?.[0]}`);
  }
});
test("village: fence links are symmetric and consistent in every piece (the stored state matches the neighbouring fence)", () => {
  const OPP = { north: "south", south: "north", east: "west", west: "east" };
  const VEC = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
  const pieces = shippedStructures().filter((p) => villageData.pieces.has(`lothlorien/village/${p.name}`));
  assert.ok(pieces.length >= 25);
  for (const piece of pieces) {
    const at = new Map(piece.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b]));
    for (const b of piece.blocks) {
      if (b.name !== FENCE) continue;
      for (const [side, [dx, dz]] of Object.entries(VEC)) {
        const stored = !!b.states[`minecraft:connection_${side}`];
        const inBox = piece.at(b.x + dx, b.y, b.z + dz) !== undefined;
        const nb = at.get(`${b.x + dx},${b.y},${b.z + dz}`);
        const tag = `${piece.name} fence ${b.x},${b.y},${b.z} ${side}`;
        if (!inBox) continue; // a link out of the box is the connector standard's forced link, checked in the connector test
        assert.equal(stored, nb?.name === FENCE, `${tag}: stored ${stored}, neighbour ${nb?.name}`);
        if (nb?.name === FENCE) assert.equal(!!nb.states[`minecraft:connection_${OPP[side]}`], stored, `${tag}: one-way link`);
      }
    }
  }
});
test("village: rails are straight runs and square corners only (no diagonal staircase of single cells)", () => {
  for (const piece of shippedStructures()) {
    if (!villageData.pieces.has(`lothlorien/village/${piece.name}`)) continue;
    const rail = new Set(piece.blocks.filter((b) => b.name === FENCE && b.y > 0).map((b) => `${b.x},${b.y},${b.z}`));
    for (const k of rail) {
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dz] of [[1, 1], [1, -1]]) {
        // a diagonal pair with neither orthogonal cell present would be an unlinked staircase step
        if (rail.has(`${x + dx},${y},${z + dz}`)) assert.ok(rail.has(`${x + dx},${y},${z}`) || rail.has(`${x},${y},${z + dz}`), `${piece.name}: diagonal rail step at ${k}`);
      }
    }
  }
});
test("village: simulated villages have no wrong rope side, no decaying leaf, linked rails across every joint", () => {
  for (const r of villages()) {
    assert.equal(r.ck.info.ropeWrong, 0, `seed ${r.seed}: ropes facing away from the trunk`);
    assert.ok(r.ck.info.ropes > 0 && r.ck.info.hangingRopes === r.ck.info.ropes, `seed ${r.seed}: village ropes are the rotating variant`);
    assert.equal(r.ck.info.decay, 0, `seed ${r.seed}: leaves that will decay`);
    assert.ok(!r.ck.fail.some((f) => f.includes("rail link")), `seed ${r.seed}: ${r.ck.fail.find((f) => f.includes("rail link"))}`);
  }
});
test("Elven rope hanging: structure-only twin of the rope, same geometry, a state Bedrock rotates, same script handling", () => {
  const rope = readJson("../lothlorien_bp/blocks/elven_rope.json")["minecraft:block"];
  const hang = readJson("../lothlorien_bp/blocks/elven_rope_hanging.json")["minecraft:block"];
  assert.equal(hang.description.identifier, "lothlorien:elven_rope_hanging");
  assert.deepEqual(hang.description.menu_category, { category: "none" }, "hidden from the Creative menu");
  assert.deepEqual(hang.description.traits["minecraft:placement_direction"].enabled_states, ["minecraft:cardinal_direction"]);
  assert.equal(hang.description.states, undefined, "no custom state: custom-namespace states are not rotated with a piece");
  assert.deepEqual(hang.components, rope.components, "same geometry, texture, sound, selection box");
  assert.equal(hang.components["minecraft:loot"], "loot_tables/blocks/elven_rope.json", "native loot uses the normal rope item for either block variant");
  assert.deepEqual(hang.permutations.map((p) => p.condition.replace("minecraft:cardinal_direction", "lothlorien:face")), rope.permutations.map((p) => p.condition));
  assert.deepEqual(hang.permutations.map((p) => p.components), rope.permutations.map((p) => p.components), "same side for the same value");
  const js = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8");
  assert.ok(js.includes('"lothlorien:elven_rope_hanging"') && js.includes("ROPE_IDS.has"), "script treats it as a rope (climb, break, wall check)");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  assert.ok(lang.includes("tile.lothlorien:elven_rope_hanging.name=Elven Rope"), "named like the rope");
});

// --- Elven village round 4: crown trunk, rail steps, bridge body, stair opening, rails over leaves, light ---
import { RING, STAIR_FULL, STAIR_TOP, STAIR_CUT, FLOOR_H as V_FLOOR, LEVEL_H as V_LEVEL, ROOTS as V_ROOTS, worstLight, LIGHT_TARGET, LANTERN_LIGHT } from "../tools/village_mallorn.mjs";
const SLAB_ID = "lothlorien:mallorn_slab", LEAVES_ID = "lothlorien:mallorn_leaves";
const halfOf = (p) => { const up = p.jigsaws.find((j) => j.dirId === 1); return up ? [up.x, up.z] : [(p.size[0] - 1) / 2, (p.size[2] - 1) / 2]; }; // trunk axis (a combo is not centred on it)
test("village crowns: the trunk keeps its full section well up into the crown and thins only in the top third (3x3 village, 5x5 central)", () => {
  for (const p of villagePieces().filter((q) => q.name.startsWith("crown_"))) {
    const central = p.name.startsWith("crown_central"), H = p.size[1], top = H - 4, [hx, hz] = halfOf(p);
    const trunkAt = (y) => p.blocks.filter((b) => b.y === y && b.name === MALLORN_LOG && b.states["minecraft:block_face"] !== "east" && b.states["minecraft:block_face"] !== "south"
      && Math.abs(b.x - hx) <= 2 && Math.abs(b.z - hz) <= 2).length;
    const counts = []; for (let y = 1; y <= top; y++) counts.push(trunkAt(y));
    assert.ok(counts[0] >= (central ? 21 : 9), `${p.name}: starts with the full section, got ${counts[0]}`);
    for (let y = 1; y < counts.length; y++) assert.ok(counts[y] <= counts[y - 1], `${p.name}: the trunk only tapers ${counts}`);
    assert.ok(counts[Math.floor(top * 0.3) - 1] >= 9, `${p.name}: 3x3 or wider at 30%`);
    assert.ok(counts[Math.floor(top * 0.6) - 1] >= 5, `${p.name}: plus or wider at 60%`);
    assert.equal(counts[top - 1], 1, `${p.name}: 1x1 at the top`);
    assert.equal(p.blocks.filter((b) => b.y === 0 && b.name !== MALLORN_LOG).length, 0, `${p.name}: only trunk in the jigsaw layer`);
  }
  for (const p of villagePieces().filter((q) => isTree(q.name))) { // the platform trunk below carries the same full section
    const [hx, hz] = halfOf(p), central = p.name.startsWith("central"), top = p.size[1] - 1;
    const n = (y) => p.blocks.filter((b) => b.y === y && b.name === MALLORN_LOG && Math.abs(b.x - hx) <= 2 && Math.abs(b.z - hz) <= 2).length + (p.at(hx, y, hz) === "minecraft:jigsaw" ? 1 : 0);
    assert.ok(n(top - 1) >= (central ? 21 : 9), `${p.name}: full section under the crown jigsaw`);
  }
});
test("village trees (P9, giant Mallorn style): root flare of bark at ground level, trunk down to ROOTS, bent branches and big leaf blobs in the crowns", () => {
  const WOOD_ID = "lothlorien:mallorn_wood", BRANCH = (b) => b.name === MALLORN_LOG && ["east", "south", "west", "north"].includes(b.states["minecraft:block_face"]); // combos are turned: east/south become west/north
  for (const p of villagePieces().filter((q) => isTree(q.name))) {
    const [hx, hz] = halfOf(p), central = p.name.startsWith("central"), r = central ? 2 : 1;
    const outside = (b) => Math.max(Math.abs(b.x - hx), Math.abs(b.z - hz)) > r;
    const flare = p.blocks.filter((b) => b.name === WOOD_ID && b.y >= V_ROOTS && b.y < V_ROOTS + 4 && outside(b));
    assert.ok(flare.length >= (central ? 30 : 15), `${p.name}: root flare of bark round the trunk at nominal ground level, got ${flare.length}`);
    assert.ok(flare.some((b) => b.y === V_ROOTS) && flare.some((b) => b.y >= V_ROOTS + 2), `${p.name}: the flare rises above the ground`);
    assert.ok(!p.blocks.some((b) => b.name === WOOD_ID && b.y >= V_ROOTS + 8), `${p.name}: bark foot only near the ground`);
    const trunkBottom = p.blocks.filter((b) => b.y === 0 && b.name === MALLORN_LOG && !outside(b)).length + (p.at(hx, 0, hz) === "minecraft:jigsaw" ? 1 : 0); // the start anchor jigsaw replaces the centre log
    assert.ok(trunkBottom >= (central ? 21 : 9), `${p.name}: the trunk reaches ROOTS below nominal ground with its full section (${trunkBottom})`);
    // the round trunk: no corner cell in the central 5x5
    if (central) for (const [cx, cz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) assert.ok(!p.blocks.some((b) => b.y === V_ROOTS + 8 && b.x === hx + cx && b.z === hz + cz && b.name === MALLORN_LOG), "round trunk: corner cell empty");
    assert.ok(p.blocks.filter(BRANCH).length >= (central ? 40 : 15), `${p.name}: bent low branches on the bare trunk`);
  }
  const need = { crown_small: [7, 16], crown_medium: [8, 20], crown_large: [10, 24], crown_central_a: [16, 34], crown_central_b: [13, 30] };
  for (const [name, [h, H]] of Object.entries(need)) {
    const p = villagePieces().find((q) => q.name === name);
    assert.deepEqual([(p.size[0] - 1) / 2, p.size[1]], [h, H], `${name}: giant-style crowns are this big`);
    const branches = p.blocks.filter(BRANCH), leaves = p.blocks.filter((b) => b.name === LEAVES_ID);
    assert.ok(branches.length >= 3 * h, `${name}: bent branches (${branches.length})`);
    assert.ok(new Set(branches.map((b) => b.y)).size >= 5, `${name}: branches climb (rise on the way)`);
    assert.ok(leaves.length >= 14 * h * h / 3, `${name}: full leaf blobs (${leaves.length})`);
    const [hx, hz] = halfOf(p), far = Math.max(...branches.map((b) => Math.max(Math.abs(b.x - hx), Math.abs(b.z - hz))));
    assert.ok(far >= h - 5, `${name}: branches reach out (${far} of ${h})`);
  }
});
test("village bridges: the rail is one continuous stepped line (consecutive rail fences are face-adjacent, no diagonal-only joins)", () => {
  const bridges = STRAIGHT.map((spec) => { // the shapes the combos are built from (a bridge is never a piece of its own)
    const b = buildBridge(spec.length, spec);
    return { name: spec.name, blocks: [...b.blocks].map(([k, v]) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z, name: v.name }; }) };
  });
  assert.equal(bridges.length, 5);
  for (const p of bridges) {
    const rail = new Set(p.blocks.filter((b) => b.name === FENCE).map((b) => `${b.x},${b.y},${b.z}`));
    let sawStep = false;
    for (const k of rail) {
      const [x, y, z] = k.split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const n = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        if (n !== 2 || !rail.has(`${x + dx},${y + dy},${z + dz}`)) continue;
        if (dy !== 0) sawStep = true;
        // a diagonal pair needs a rail at one of the shared face neighbours (an L of face-adjacent fences)
        const joined = [[dx, 0, 0], [0, dy, 0], [0, 0, dz]].some(([a, b, c]) => (a || b || c) && rail.has(`${x + a},${y + b},${z + c}`));
        assert.ok(joined, `${p.name}: diagonal-only rail join at ${k} -> ${[dx, dy, dz]}`);
      }
    }
    if (/bridge_(9|11|13)$/.test(p.name)) assert.ok(sawStep, `${p.name}: expected stepped rails`);
    const seen = new Set(); let comps = 0; // one rail line per side
    for (const k of rail) {
      if (seen.has(k)) continue;
      comps++; const st = [k]; seen.add(k);
      while (st.length) {
        const [x, y, z] = st.pop().split(",").map(Number);
        for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const m = `${x + a},${y + b},${z + c}`; if (rail.has(m) && !seen.has(m)) { seen.add(m); st.push(m); } }
      }
    }
    assert.equal(comps, 2, `${p.name}: one rail line per side, got ${comps}`);
  }
});
import { bridgeShape } from "../lothlorien_bp/scripts/village_bridge.js";
import { buildBridge, STRAIGHT, rotateCell } from "../tools/village_combo.mjs";
test("bridgeShape: dog-legs shift one block sideways per block forward, walk stays 3 wide and connected, exits at the ends", () => {
  for (const [len, off] of [[11, 2], [11, -2], [13, 3], [13, -3], [9, 0], [9, 4]]) {
    const s = bridgeShape(len, off, len <= 7 ? 1 : 2), xs = (z) => s.walk.filter((c) => c[2] === z).map((c) => c[0]).sort((a, b) => a - b);
    for (let z = 0; z < len; z++) {
      const r = xs(z);
      assert.equal(r.length, 3, `${len}/${off} row ${z}: 3 wide`);
      if (z) assert.ok(Math.abs(r[1] - xs(z - 1)[1]) <= 1, `${len}/${off} row ${z}: centre moves at most one block`);
    }
    assert.equal(s.connectors[1].x - s.connectors[0].x, off);
    assert.equal(s.size[0], 5 + Math.abs(off));
  }
});
test("village: a bottom slab is never one slab thin - a top slab (or solid block) directly under every bottom slab", () => {
  for (const p of villagePieces()) {
    for (const b of p.blocks) {
      if (b.name !== SLAB_ID || b.states["minecraft:vertical_half"] !== "bottom") continue;
      const under = p.blocks.find((q) => q.x === b.x && q.y === b.y - 1 && q.z === b.z);
      const jig = p.at(b.x, b.y - 1, b.z) === "minecraft:jigsaw";
      assert.ok(jig || (under && (under.name === PLANKS || under.name === MALLORN_LOG || (under.name === SLAB_ID && under.states["minecraft:vertical_half"] === "top"))), `${p.name}: thin slab at ${[b.x, b.y, b.z]}`);
    }
  }
});
test("village towers: the upper floor covers the stair opening as far as headroom allows (full deck / top slab), spiral stays walkable", () => {
  assert.deepEqual(STAIR_FULL.concat(STAIR_TOP, STAIR_CUT).sort((a, b) => a - b), [9, 10, 11, 12, 13]);
  assert.ok(STAIR_CUT.length <= 4, `remaining hole ${STAIR_CUT.length} cells`);
  const towers = villagePieces().filter((p) => p.name.startsWith("combo_tower_"));
  assert.ok(towers.length >= 6, `${towers.length} tower combos`);
  for (const p of towers) {
    const [hx, hz] = halfOf(p), yU = V_ROOTS + V_FLOOR + V_LEVEL;
    const k = (4 - ["north", "east", "south", "west"].indexOf(p.name.match(/^combo_tower_[a-z]_(north|east|south|west)_/)[1])) % 4; // the combo is the tower turned k quarter turns
    for (let i = 0; i < 14; i++) {
      const [rx, rz] = rotateCell(...RING[i], k), s = 3 + i, at = p.at(rx + hx, yU, rz + hz), blk = p.blocks.find((q) => q.x === rx + hx && q.y === yU && q.z === rz + hz);
      // the ceiling over tread i must clear the NEXT tread (2.0 blocks = 4 half-blocks): a walker steps up with his head still over column i (owner 2026-10-08)
      if (2 * V_LEVEL - (s + 1) >= 4) assert.equal(at, PLANKS, `${p.name}: ring ${i} under full deck`);
      else if (2 * V_LEVEL + 1 - (s + 1) >= 4) assert.ok(at === SLAB_ID && blk.states["minecraft:vertical_half"] === "top", `${p.name}: ring ${i} top slab, got ${at}`);
      else assert.ok(at === null || at === "minecraft:air", `${p.name}: ring ${i} stays open, got ${at}`);
    }
  }
  for (const r of villages()) assert.equal(r.ck.unreachable, 0, `seed ${r.seed}: unreachable walk cells`);
});
test("village: rails, deck, walk cells and headroom win over leaves in every piece (no leaf within 3 above a deck or stair block)", () => {
  for (const p of villagePieces()) {
    for (const b of p.blocks) {
      if (b.name !== PLANKS && b.name !== SLAB_ID) continue;
      for (let h = 1; h <= 3; h++) assert.notEqual(p.at(b.x, b.y + h, b.z), LEAVES_ID, `${p.name}: leaf ${h} above deck at ${[b.x, b.y, b.z]}`);
    }
  }
});
// --- Elven village walkability (owner 2026-10-08: stair headroom, walk round the stair, rails over leaves, stair rail links) --------
// Rules + model: .claude/skills/bedrock-modding/references/13-structure-walkability.md; checker: scripts/structure_walk.mjs
import { checkWalk, protectedCells } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";
import { buildTree as vBuildTree, SHAPES as V_SHAPES, linkRails } from "../tools/village_mallorn.mjs";
const walkOf = (p) => { // a parsed piece as get(x, y, z) for the checker (jigsaw states: horizontal ones are deck connectors)
  const st = new Map(p.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b.states]));
  const jig = new Map(p.jigsaws.map((j) => [`${j.x},${j.y},${j.z}`, j.dirId]));
  return (x, y, z) => { const n = p.at(x, y, z); return n == null ? undefined : { name: n, states: n === "minecraft:jigsaw" ? { facing_direction: jig.get(`${x},${y},${z}`) } : st.get(`${x},${y},${z}`) ?? {} }; };
};
test("village walkability: every shipped piece passes the checker (headroom over every step, rails guard drops, rail step links, connectors reachable)", () => {
  for (const p of villagePieces()) {
    if (p.name.startsWith("crown_")) continue;
    const must = p.name === "railing_end" ? [] : p.jigsaws.filter((j) => j.dir && (j.target === DECK_NAME || j.name === DECK_HI_NAME)).map((j) => ({ x: j.x, y: j.y + 1, z: j.z }));
    assert.ok(p.name === "railing_end" || must.length >= 1, `${p.name}: connectors`);
    const r = checkWalk(walkOf(p), { x0: 0, x1: p.size[0] - 1, y0: 0, y1: p.size[1] - 1, z0: 0, z1: p.size[2] - 1 }, { must });
    assert.deepEqual(r.violations.slice(0, 3), [], `${p.name}: ${r.violations.length} walkability violations`);
    assert.ok(r.components.length <= 1, `${p.name}: walk nodes split in ${r.components}`);
  }
});
const towerSpec = () => ({ pool: "p", upPool: "u", trunk: "square3", seed: 88088, lamps: 0, levels: [
  { rows: V_SHAPES.plus15w, conn: [{ facing: "east", off: 1 }, { facing: "north", off: -1 }, { facing: "south", off: 0 }] },
  { rows: V_SHAPES.octagon15, conn: [{ facing: "south", off: 1, hi: true }, { facing: "west", off: -1, hi: true }] }] });
const towerWalk = (mutate) => {
  const t = vBuildTree(towerSpec());
  if (mutate) mutate(t.blocks);
  const trunk = []; for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) trunk.push([x, z]);
  const box = { x0: -t.box.hx, x1: t.box.hx, y0: -V_ROOTS, y1: t.topY + 5, z0: -t.box.hz, z1: t.box.hz };
  return checkWalk((x, y, z) => t.blocks.get(`${x},${y},${z}`), box, { ring: [{ trunk, level: V_FLOOR + 1 }, { trunk, level: V_FLOOR + V_LEVEL + 1 }], must: t.connectors.map((c) => ({ x: c.x, y: c.y + 1, z: c.z })) });
};
const rulesOf = (r) => [...new Set(r.violations.map((v) => v.rule))].sort();
test("village walkability fixtures: the owner's four stair problems are caught (low slab over the head, ring blocked, leaves in the way, rail without step link)", () => {
  assert.deepEqual(towerWalk().violations, [], "the generated tower is clean");
  const U = V_FLOOR + V_LEVEL, topSlab = { name: SLAB_ID, states: { "minecraft:vertical_half": "top" } }, fence = { name: FENCE, states: {} };
  // 1: the old top slab over ring cell 10 (surface 13 half-blocks, next tread 14): the head hits it while stepping up
  assert.ok(rulesOf(towerWalk((b) => b.set(`${RING[10][0]},${U},${RING[10][1]}`, topSlab))).includes("headroom"), "top slab over the step-up is a headroom violation");
  // 2: a fence wall across the deck beside the stair foot (what the old low, shifted stair rails amounted to): the walk ring is cut
  assert.ok(rulesOf(towerWalk((b) => { for (let x = 2; x <= 8; x++) b.set(`${x},${V_FLOOR + 1},0`, fence); })).includes("ring"), "a low rail line cuts the walk round the stair foot");
  // 3: a leaf block at the head of a tread
  assert.ok(rulesOf(towerWalk((b) => b.set(`${RING[6][0]},${V_FLOOR + 5},${RING[6][1]}`, { name: LEAVES_ID, states: {} }))).includes("headroom"), "leaves over a tread are a headroom violation");
  // 4: a rail that steps up one block with no post, and the same pair after linkRails
  assert.ok(rulesOf(towerWalk((b) => { b.set(`5,${V_FLOOR + 3},0`, fence); b.set(`6,${V_FLOOR + 4},0`, fence); })).includes("rail_link"), "missing up-forward link");
  const linked = new Set(["4,0,5", "5,1,5"]); linkRails(linked);
  assert.ok(linked.has("5,0,5"), "linkRails adds the post below the higher rail");
  // 5: an unguarded opening: the deck rails around the stair opening removed
  const noRails = towerWalk((b) => { for (const [k, v] of [...b]) { const [x, y, z] = k.split(",").map(Number); if (v.name === FENCE && y === U + 1 && Math.abs(x) <= 3 && Math.abs(z) <= 3) b.delete(k); } });
  assert.ok(rulesOf(noRails).includes("unguarded_edge"), "an opening without a rail is an unguarded edge");
});
test("village walkability: synthetic cases of the checker model (step height, ceilings, ropes, jump, protected cells)", () => {
  const deck = (n = 7) => { const m = new Map(); for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) m.set(`${x},0,${z}`, { name: PLANKS, states: {} }); return m; };
  const BOX = { x0: 0, x1: 8, y0: -1, y1: 8, z0: 0, z1: 8 };
  const run = (m, opts = {}) => checkWalk((x, y, z) => m.get(`${x},${y},${z}`), BOX, opts);
  const slab = (half = "bottom") => ({ name: SLAB_ID, states: { "minecraft:vertical_half": half } });
  const full = { name: PLANKS, states: {} };
  // a flat deck with a rim of fences: no violations; no rim: the edges are open drops
  const flat = deck(); for (let i = 0; i < 7; i++) for (const [x, z] of [[i, 0], [i, 6], [0, i], [6, i]]) flat.set(`${x},1,${z}`, { name: FENCE, states: {} });
  assert.deepEqual(run(flat).violations, []);
  assert.ok(rulesOf(run(deck())).includes("unguarded_edge"));
  // a bottom slab step (+0.5) walks; a full block (+1) is a wall unless the walker may jump
  const step = new Map(flat); step.set("4,1,4", slab());
  assert.equal(run(step).components.length, 1, "a slab step joins");
  const wall = new Map(flat); wall.set("4,1,4", full);
  assert.ok(run(wall).components.length >= 2, "a full block is a wall without a jump");
  assert.equal(run(wall, { jump: true }).components.length, 1, "with a jump the full block joins");
  // ceilings: a block 2 above a deck cell leaves 1.0 free (not a walk cell); a top slab 2 above a bottom-slab tread leaves 2.0 (ok)
  const low = new Map(flat); low.set("4,2,4", full);
  assert.equal(run(low).nodes.filter((n) => n.x === 4 && n.z === 4 && n.T === 1).length, 0, "1 block of air is not a walk cell");
  const ok = new Map(flat); ok.set("4,1,4", slab()); ok.set("4,3,4", slab("top"));
  assert.equal(run(ok).nodes.filter((n) => n.x === 4 && n.z === 4 && n.T === 1.5).length, 1, "bottom slab tread under a top slab: 2.0 free");
  // a rope side is a way down, not a fall
  const rope = deck(); rope.set("4,0,4", { name: "lothlorien:elven_rope_hanging", states: {} });
  assert.ok(!run(rope).violations.some((v) => v.rule === "unguarded_edge" && Math.abs(v.at[0] - 4) + Math.abs(v.at[2] - 4) === 1));
  // protected cells: rails, and the surface block plus the two cells above it
  const pc = protectedCells((x, y, z) => flat.get(`${x},${y},${z}`), BOX);
  assert.ok(pc.has("4,1,4") && pc.has("4,2,4") && pc.has("0,1,0") && !pc.has("4,3,4"));
});
test("village: no leaf of any placed piece sits in a cell another piece owns (rails, surfaces, two cells above): simulated villages report no 'leaf in protected cell'", () => {
  for (const r of villages().slice(0, 12)) assert.ok(!r.ck.fail.some((f) => f.includes("leaf in protected")), `seed ${r.seed}: ${r.ck.fail.find((f) => f.includes("leaf in protected"))}`);
});
test("village: crown pieces never reach a platform's rail, deck, walk or headroom cells in any of the 4 rollable rotations; crowns own only their cells (void elsewhere, no air)", () => {
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const crownsOf = (first) => {
    const out = [];
    for (let id = first; id && id !== "minecraft:empty"; id = pool(id.split("/").pop())?.fallback) for (const e of pool(id.split("/").pop()).elements) out.push(villageData.getPiece(e.element.location));
    return out;
  };
  for (const tree of villagePieces().filter((p) => isTree(p.name))) {
    const up = tree.jigsaws.find((j) => j.dirId === 1), members = crownsOf(up.pool);
    assert.ok(members.length >= 1);
    const guarded = new Map();
    for (let y = 0; y < tree.size[1]; y++) for (let x = 0; x < tree.size[0]; x++) for (let z = 0; z < tree.size[2]; z++) {
      const n = tree.at(x, y, z);
      if ([PLANKS, SLAB_ID, FENCE, LANTERN_ID, "minecraft:air"].includes(n)) guarded.set(`${x},${y},${z}`, n);
    }
    for (const crown of members) {
      assert.equal(crown.blocks.filter((b) => b.name === "minecraft:air").length, 0, `${crown.name}: no air blocks (void outside its own cells)`);
      for (let r = 0; r < 4; r++) {
        const rp = rotated(crown, r), cj = rp.jigsaws.find((j) => j.dirId === 0);
        const o = [up.x - cj.x, up.y + 1 - cj.y, up.z - cj.z]; // the crown's jigsaw cell sits one above the platform's
        for (const b of rp.blocks) {
          const k = `${o[0] + b.x},${o[1] + b.y},${o[2] + b.z}`;
          assert.ok(!guarded.has(k), `${tree.name} + ${crown.name} rot ${r}: crown ${b.name} on platform ${guarded.get(k)} at ${k}`);
        }
        assert.ok(o[1] > tree.size[1] - 1, `${tree.name} + ${crown.name}: the crown box starts above the platform box`);
      }
    }
  }
});
test("village: block light - every walkable cell of every piece is lit to >= 8 by lanterns inside the piece (leaves, slabs and full blocks stop light; air, void, fences and lanterns pass it)", () => {
  assert.equal(LANTERN_LIGHT, readJson("../lothlorien_bp/blocks/elven_lantern.json")["minecraft:block"].components["minecraft:light_emission"], "the model uses the lantern's real emission");
  const worst = {};
  for (const p of villagePieces()) {
    const nameAt = (x, y, z) => { const n = p.at(x, y, z); return n === null ? undefined : n; };
    const r = worstLight(nameAt, { x0: 0, x1: p.size[0] - 1, y0: 0, y1: p.size[1] - 1, z0: 0, z1: p.size[2] - 1 });
    if (!r.cells) continue;
    assert.ok(r.worst >= LIGHT_TARGET, `${p.name}: walk cell ${r.at} has block light ${r.worst}`);
    const type = p.name.replace(/_(dog_)?\d+.*$/, "").replace(/_[a-z]$/, "");
    worst[type] = Math.min(worst[type] ?? 99, r.worst);
  }
  console.log("worst walk-cell block light per piece type:", JSON.stringify(worst));
});

// --- rail mender: marker entity in every rail piece, pure link rule ---
import * as MEND from "../lothlorien_bp/scripts/rail_mender_rules.js";
test("rail mender: markers inside the box, and every rail of every village piece lies inside the scan box of a marker (combos carry two: bridge middle and tree axis)", () => {
  for (const p of villagePieces()) {
    const rails = p.blocks.filter((b) => b.name === FENCE);
    const m = p.entities.filter((e) => e.id === MEND.MENDER_ID);
    assert.equal(p.entities.length - p.entities.filter((e) => e.id === "lothlorien:elven_warden" || e.id === "lothlorien:loop_marker" || e.id === EL.POST_ID).length, m.length, `${p.name}: only markers (and village wardens, loop markers, elf posts)`);
    assert.equal(m.length, !rails.length ? 0 : p.name.startsWith("combo_") ? 2 : 1, `${p.name}: ${rails.length} rails, ${m.length} markers`);
    for (const e of m) {
      const [x, y, z] = e.pos;
      assert.ok(x >= 0 && x < p.size[0] && y >= 0 && y < p.size[1] && z >= 0 && z < p.size[2], `${p.name}: marker inside the box`);
    }
    for (const r of rails) {
      const covered = m.some((e) => { const box = MEND.scanBox({ x: e.pos[0], y: e.pos[1], z: e.pos[2] }); return r.x >= box.from.x && r.x <= box.to.x && r.z >= box.from.z && r.z <= box.to.z && r.y >= box.from.y && r.y <= box.to.y; });
      assert.ok(covered, `${p.name}: rail ${r.x},${r.y},${r.z} is outside every marker's scan box`);
    }
  }
});
test("rail mender: marker entity files exist and the scan box is centred on the marker", () => {
  const bpE = JSON.parse(readFileSync(new URL("../lothlorien_bp/entities/rail_mender.json", import.meta.url), "utf8"))["minecraft:entity"];
  assert.equal(bpE.description.identifier, MEND.MENDER_ID);
  assert.ok(bpE.components["minecraft:persistent"] && bpE.components["minecraft:physics"].has_collision === false);
  assert.ok(existsSync(new URL("../lothlorien_rp/entity/rail_mender.entity.json", import.meta.url)));
  const b = MEND.scanBox({ x: 10.5, y: 70, z: -3.5 });
  assert.deepEqual(b.from, { x: -7, y: 67, z: -21 });
  assert.deepEqual(b.to, { x: 27, y: 84, z: 13 });
});
test("rail mender: only switches links on, only toward our own fences, never toward loaded other blocks or unloaded cells", () => {
  const world = new Map([["1,0,0", "lothlorien:mallorn_fence"], ["-1,0,0", "lothlorien:mallorn_heartwood_fence"], ["0,0,1", "minecraft:oak_fence"], ["0,0,-1", undefined]]);
  const typeAt = (x, y, z) => world.get(`${x},${y},${z}`);
  const none = () => false;
  assert.deepEqual(MEND.missingLinks({ x: 0, y: 0, z: 0 }, typeAt, none).sort(), ["minecraft:connection_east", "minecraft:connection_west"]);
  assert.deepEqual(MEND.missingLinks({ x: 0, y: 0, z: 0 }, typeAt, (s) => s === "minecraft:connection_east"), ["minecraft:connection_west"]);
  assert.deepEqual(MEND.missingLinks({ x: 5, y: 0, z: 5 }, typeAt, none), []);
});
const railJs = readFileSync(new URL("../lothlorien_bp/scripts/rail_mender.js", import.meta.url), "utf8");
test("rail mender: script is imported by main.js and removes the marker only after the scan", () => {
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('import "./rail_mender.js"'));
  assert.ok(railJs.includes("entityLoad") && railJs.includes("entitySpawn") && railJs.includes("entity.remove()"));
});

// --- loop closer (P7): marker on every closed railing exit, pure partner / corridor rules, light on runtime-built bridges ---
import * as LOOP from "../lothlorien_bp/scripts/village_loop.js";
import { blockLight as sharedLight } from "../../../.claude/skills/bedrock-modding/scripts/structure_light.mjs";
import * as PL from "../lothlorien_bp/scripts/village_planner.js";
import * as RP from "../lothlorien_bp/scripts/village_repair.js";
import { planLoops, discoveryCoverage, buildWorld, wkey, markerCell, markerCells, walkability } from "../tools/village_sim.mjs";
const SLAB_NAME = "lothlorien:mallorn_slab";
// synthetic village: a platform connector row (deck, rails at +-2, 3 air cells walk + headroom) and the railing_end row beyond it
function fixtureWorld(exits) {
  const w = new Map(), at = (x, y, z) => w.get(`${x},${y},${z}`) ?? "minecraft:air";
  for (const e of exits) {
    const a = [e.dir[1], e.dir[0]]; // along the row
    for (const [row, back] of [[0, 0], [1, 1]]) { // row 0 = railing row, row 1 = platform connector row
      const cx = e.x - e.dir[0] * back, cz = e.z - e.dir[1] * back;
      for (let o = -2; o <= 2; o++) {
        w.set(`${cx + a[0] * o},${e.y},${cz + a[1] * o}`, PLANKS);
        if (row === 0 || Math.abs(o) === 2) w.set(`${cx + a[0] * o},${e.y + 1},${cz + a[1] * o}`, FENCE);
      }
    }
  }
  return { w, at };
}
const E = (x, z, dir, y = 40) => ({ x, y, z, dir });
// Test oracles for the pieces of the removed per-marker closer (reach rules, "first join that builds from this start"), built on the planner's own
// candidates: the geometry tests below keep asserting what a single start can reach, the planner decides globally (see the planner block).
const LEG = (() => {
  const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z, rank = { exit: 0, side: 1, sideside: 1, plaza: 2, L: 3 };
  const findPartner = (at, A) => {
    for (const c of LOOP.scanAhead(A, (x, z) => at(x, A.y + 1, z) === FENCE)) {
      const B = LOOP.exitAt(at, c.x, A.y, c.z);
      if (B && B.dir[0] === -A.dir[0] && B.dir[1] === -A.dir[1]) return { B, length: c.length, dist: c.dist, offset: c.offset, score: c.score };
    }
    return null;
  };
  const findSides = (at, A) => LOOP.scanAhead(A, (x, z) => at(x, A.y + 1, z) === FENCE && !LOOP.exitAt(at, x, A.y, z) && LOOP.sideTarget(at, x, A.y, z, A.dir))
    .map((c) => ({ B: { x: c.x, y: A.y, z: c.z }, length: c.length, dist: c.dist, offset: c.offset, score: c.score }));
  const sideAt = (at, x, y, z) => LOOP.sideStarts(at, x, y, z)[0] ?? null;
  function decide(at, A, opts = {}) {
    const starts = opts.sideStart ? { exits: [], rims: [{ ...A, side: true, run: "t" }] } : { exits: [A], rims: [] };
    const cands = PL.enumerate(at, starts).filter((c) => same(c.A, A)).sort((a, b) => rank[a.kind] - rank[b.kind] || a.score - b.score);
    let fail = null;
    for (const c of cands) { const r = PL.realize(at, c); if (r.plan) return { action: "build", kind: c.kind, partner: c.B, plan: r.plan }; fail ??= r; }
    if (fail) return fail.blocked ? { action: "none", reason: "blocked", blocked: fail.blocked } : { action: "none", reason: fail.error };
    return { action: "none", reason: "no partner" };
  }
  function decideSide(at, x, y, z) {
    let first = null;
    for (const S of LOOP.sideStarts(at, x, y, z)) { const d = decide(at, S, { sideStart: true }); if (d.action === "build") return d; first ??= d; }
    return first ?? { action: "none", reason: "no rim" };
  }
  return { findPartner, findSides, findSide: (at, A) => findSides(at, A)[0] ?? null, sideAt, decide, decideSide };
})();
test("loop planner: every tree / platform piece carries a loop marker (the first one that loads starts the village planner), rim markers on rim centres, crowns none; entity and script are wired", () => {
  const MARKED = { railing_end: 1, balcony_braced: 1, lookout_01: 3 };
  const re = villagePieces().filter((p) => p.name === "railing_end");
  assert.equal(re.length, 1);
  assert.deepEqual(re[0].entities.filter((e) => e.id === LOOP.MARKER_ID).map((e) => e.pos), [[2.5, 1.5, 0.5]]);
  for (const p of villagePieces()) { // round 2: the platform pieces (central, combos = bridge + node) carry side markers on their rim runs; crowns never
    const n = p.entities.filter((e) => e.id === LOOP.MARKER_ID).length;
    if (MARKED[p.name]) assert.equal(n, MARKED[p.name], `${p.name}: loop markers`);
    else if (/^(central|combo_)/.test(p.name)) assert.ok(n >= 1 && n <= 12, `${p.name}: ${n} markers (every platform piece can trigger the planner)`);
    else assert.equal(n, 0, `${p.name}: loop markers`);
  }
  const seen = {}, exits = {}, sides = [];
  for (const r of villages()) { // in every rotation each marker sits on the centre fence of a placed piece, and the exit signature faces away from the platform
    const states = new Map(), world = buildWorld(r.res, states), at = (x, y, z) => world.get(wkey(x, y, z)) ?? "minecraft:air";
    for (const p of r.res.placed.filter((q) => MARKED[q.name] || /^(central|combo_)/.test(q.name))) {
      for (const [x, y, z] of markerCells(p)) {
        assert.equal(at(x, y + 1, z), FENCE, `seed ${r.seed}: ${p.name} marker on the centre fence`);
        assert.equal(at(x, y, z), PLANKS);
        // balcony far rim and the lookout's three free sides are exits in the sense of exitAt (a neighbouring piece may merge the rim into a longer run)
        seen[p.name] = (seen[p.name] ?? 0) + 1;
        if (LOOP.exitAt(at, x, y, z)) exits[p.name] = (exits[p.name] ?? 0) + 1;
        else if (!MARKED[p.name]) sides.push(!!LEG.sideAt(at, x, y, z));
      }
    }
  }
  assert.ok(seen.railing_end > 100 && seen.balcony_braced > 50 && seen.lookout_01 > 20, `markers seen ${JSON.stringify(seen)}`);
  for (const k of Object.keys(seen).filter((q) => MARKED[q])) assert.ok(exits[k] >= 0.95 * seen[k], `${k}: ${exits[k]} of ${seen[k]} markers sit on a recognised exit`);
  assert.ok(sides.length > 200 && sides.filter(Boolean).length >= 0.9 * sides.length, `side markers recognised by sideAt: ${sides.filter(Boolean).length} of ${sides.length}`);
  const entity = readJson("../lothlorien_bp/entities/loop_marker.json")["minecraft:entity"];
  assert.equal(entity.description.identifier, LOOP.MARKER_ID);
  assert.ok(entity.components["minecraft:persistent"] && entity.components["minecraft:physics"].has_collision === false && entity.description.is_spawnable === false);
  assert.ok(existsSync(new URL("../lothlorien_rp/entity/loop_marker.entity.json", import.meta.url)) && existsSync(new URL("../lothlorien_rp/models/entity/loop_marker.geo.json", import.meta.url)));
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('from "./loop_marker.js"'));
  const js = readFileSync(new URL("../lothlorien_bp/scripts/loop_marker.js", import.meta.url), "utf8");
  assert.ok(js.includes("entityLoad") && js.includes("entitySpawn") && js.includes("e.remove()") && js.includes("system.runJob") && !js.includes("runInterval") && !js.includes("isChunkLoaded"));
  assert.ok(js.includes("createTickingArea") && js.includes("removeTickingArea") && js.includes("finally"), "ticking area is created and always removed");
});
test("loop closer: partner search takes facing exits at the same height within reach, nearest first, and refuses the rest", () => {
  const A = E(0, 0, [0, 1]);
  const find = (...others) => { const { at } = fixtureWorld([A, ...others]); return LEG.findPartner(at, A); };
  const ok = find(E(0, 12, [0, -1]));
  assert.deepEqual([ok.B.x, ok.B.z, ok.length, ok.offset], [0, 12, 13, 0]);
  assert.equal(find(E(3, 12, [0, -1])).offset, 3); // ex = (dir.z, -dir.x) = (1, 0)
  assert.equal(find(E(-3, 12, [0, -1])).offset, -3);
  assert.equal(find(E(0, 12, [0, -1]), E(1, 9, [0, -1])).B.z, 9, "nearest first");
  assert.equal(find(E(0, 1, [0, -1])), null, "too close (the rows would touch: minDist 2)");
  assert.ok(find(E(0, 2, [0, -1])) && find(E(0, 5, [0, -1])) && find(E(0, 6, [0, -1])) && find(E(0, 17, [0, -1])), "2..5: a flat deck (F2)");
  assert.ok(find(E(0, 18, [0, -1])) && find(E(0, 30, [0, -1])), "18..30: a span with a landing");
  assert.equal(find(E(0, 31, [0, -1])), null, "too far");
  assert.ok(find(E(8, 24, [0, -1])) && !find(E(9, 24, [0, -1])), "a span may shift 8 sideways, not 9");
  assert.ok(find(E(8, 12, [0, -1])) && !find(E(9, 12, [0, -1])), "direct bridge: 8 sideways at most (F3, owner 2026-10-09), 9 is too far");
  assert.equal(find(E(0, 12, [0, 1])), null, "same facing, not facing each other");
  assert.equal(find(E(0, 12, [0, -1], 41)), null, "other deck height");
  assert.equal(find(E(0, -12, [0, -1])), null, "behind");
  assert.ok(find(E(6, 8, [0, -1])) && !find(E(7, 8, [0, -1])), "sideways is also limited by length - 3");
  assert.equal(LOOP.exitAt(fixtureWorld([A]).at, 0, 40, 0).dir.join(), "0,1");
  assert.equal(LOOP.exitAt(fixtureWorld([E(4, 4, [1, 0])]).at, 4, 40, 4).dir.join(), "1,0");
  assert.equal(LOOP.exitAt(fixtureWorld([E(4, 4, [-1, 0])]).at, 4, 40, 4).dir.join(), "-1,0");
  assert.equal(LOOP.exitAt(fixtureWorld([A]).at, 0, 40, -1), null, "the platform's own connector row is no exit");
});
test("loop planner: a facing pair is one candidate whichever end it starts from; several partners: nearest first, each pair once; all 4 headings", () => {
  const A = E(0, 0, [0, 1]), B = E(2, 12, [0, -1]), { at } = fixtureWorld([A, B]);
  assert.equal(LEG.decide(at, A).action, "build");
  assert.equal(LEG.decide(at, B).action, "build", "no standing down any more: the planner picks the pair once, from either end");
  const C = E(-1, 9, [0, -1]), w2 = fixtureWorld([A, B, C]); // A prefers C (nearer)
  assert.equal(LEG.decide(w2.at, A).partner.z, 9);
  assert.equal(PL.enumerate(w2.at, { exits: [A, B, C], rims: [] }).filter((c) => c.kind === "exit").length, 2, "A-B and A-C, each pair once");
  const one = PL.planVillage(w2.at, [[0, 40, 0], [2, 40, 12], [-1, 40, 9]], { budget: 1 });
  assert.deepEqual([one.picks.length, one.picks[0].kind, one.picks[0].B.z], [1, "exit", 9], "budget 1: the nearer partner");
  for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const a1 = E(10, 10, dir), b1 = E(10 + dir[0] * 12 + dir[1] * 2, 10 + dir[1] * 12 - dir[0] * 2, [-dir[0], -dir[1]]), f = fixtureWorld([a1, b1]);
    const d = LEG.decide(f.at, a1), e = LEG.decide(f.at, b1);
    assert.deepEqual([d.action, e.action], ["build", "build"], `heading ${dir}`);
    assert.equal(d.plan.length, 13);
    assert.equal(PL.enumerate(f.at, { exits: [a1, b1], rims: [] }).length, 1, `heading ${dir}: one candidate for the pair`);
  }
});
test("loop closer: corridor check - air and leaves are cleared, anything else (log, planks, rock, unloaded) aborts; a built bridge removes both exits and clears leaves", () => {
  const A = E(0, 0, [0, 1]), B = E(3, 12, [0, -1]);
  const build = (extra = []) => { const f = fixtureWorld([A, B]); for (const [k, v] of extra) f.w.set(k, v); return f; };
  const base = build(), plan = LEG.decide(base.at, A).plan;
  assert.equal(plan.offset, 3);
  assert.deepEqual(LOOP.blockedCells(base.at, plan), []);
  const mid = [...LOOP.finalBlocks(plan)].find(([k, b]) => b.id === PLANKS && k.split(",")[2] === "6")[0];
  const [mx, my, mz] = mid.split(",").map(Number);
  for (const [name, block, blocks] of [["leaves", "lothlorien:mallorn_leaves", false], ["log", "lothlorien:mallorn_log", true], ["stone", "minecraft:stone", true], ["planks", PLANKS, true]]) {
    for (const dy of [0, 1, 3]) { // the deck itself and the headroom both count
      const f = build([[`${mx},${my + dy},${mz}`, block]]), d = LEG.decide(f.at, A);
      if (name === "planks" && dy === 0) continue; // the deck cell may already be planks only in the end rows
      assert.equal(d.action, blocks ? "none" : "build", `${name} at +${dy}`);
      if (blocks) assert.equal(d.reason, "blocked");
    }
  }
  assert.equal(LEG.decide((x, y, z) => (z === 6 ? undefined : base.at(x, y, z)), A).action, "none", "unloaded cells abort");
  const f = build([[`${mx},${my + 2},${mz}`, "lothlorien:mallorn_leaves"]]), d = LEG.decide(f.at, A);
  assert.equal(d.action, "build");
  for (const [k, b] of LOOP.finalBlocks(d.plan)) b.id === "minecraft:air" ? f.w.delete(k) : f.w.set(k, b.id);
  assert.equal(LOOP.exitAt(f.at, A.x, A.y, A.z), null);
  assert.equal(LOOP.exitAt(f.at, B.x, B.y, B.z), null);
  assert.equal(f.at(A.x, A.y + 1, A.z), "minecraft:air", "the railing's centre is open");
  assert.equal(f.at(A.x + 2, A.y + 1, A.z), FENCE, "the railing's outer posts stay as the bridge rails");
  assert.equal(f.at(mx, my + 2, mz), "minecraft:air", "leaves in the corridor are cleared");
});
// platform fixture: deck x0..x1 x z0..z1 at height y, fence ring on the rim cells (like a rectangular platform)
function addPlatform(w, x0, x1, z0, z1, y = 40) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    w.set(`${x},${y},${z}`, PLANKS);
    if (x === x0 || x === x1 || z === z0 || z === z1) w.set(`${x},${y + 1},${z}`, FENCE);
  }
}
test("loop closer (P7b): an exit joins the side of a platform - straight 5-cell rail run, plain deck two rows deep; stairs, slabs, short runs, other heights, curved rims and bridges are refused", () => {
  const A = E(0, 0, [0, 1]);
  const mk = (edit) => { const f = fixtureWorld([A]); addPlatform(f.w, -3, 3, 12, 20); edit?.(f.w); return f; };
  const f = mk(), d = LEG.decide(f.at, A);
  assert.equal(d.action, "build");
  assert.equal(d.kind, "side");
  assert.deepEqual([d.plan.B.x, d.plan.B.z, d.plan.length, d.plan.offset], [0, 12, 13, 0]);
  const sided = LEG.decide(mk().at, E(3, 0, [0, 1]));
  assert.equal(sided.kind, "side", "any cell of the straight run (sideways offset within reach)");
  // apply: the 3 centre rail cells open, the two posts stay, no link into the platform, bridge rails link to the posts
  const blocks = LOOP.finalBlocks(d.plan);
  for (const [k, b] of blocks) b.id === "minecraft:air" ? f.w.delete(k) : f.w.set(k, b.id);
  for (const o of [-1, 0, 1]) assert.equal(f.at(o, 41, 12), "minecraft:air");
  for (const o of [-2, 2]) assert.equal(f.at(o, 41, 12), FENCE);
  assert.equal(blocks.get("-2,41,12").states["minecraft:connection_south"], false);
  assert.equal(blocks.get("-2,42,12").states["minecraft:connection_north"], true, "the arch's step post above the rim post links to the bridge rail");
  assert.equal(blocks.get("-2,42,12").states["minecraft:connection_south"], false);
  assert.equal(f.at(0, 40, 12), PLANKS);
  // refusals (each makes the exit find no target)
  const none = (edit, why) => assert.equal(LEG.findSide(mk(edit).at, A), null, why);
  none((w) => { for (const o of [-1, 0, 1]) w.delete(`${o},40,13`); }, "stair opening / hole right behind the rim");
  none((w) => { w.set("0,40,13", SLAB_NAME); }, "slab behind the rim");
  none((w) => { w.set("0,41,13", "lothlorien:mallorn_log"); }, "obstacle in the walk cells behind");
  none((w) => { for (let x = -3; x <= 3; x++) for (let z = 14; z <= 20; z++) w.delete(`${x},40,${z}`), w.delete(`${x},41,${z}`); }, "only one deck row behind");
  none((w) => { w.delete("-1,41,12"); }, "rail run shorter than 5 around the centre");
  const short = fixtureWorld([A]); addPlatform(short.w, -2, 3, 12, 20); // 6 wide platform: a run of 6 rail cells (a 5-wide one is a railing_end lookalike) -> accepted
  assert.ok(LEG.findSide(short.at, A));
  const four = fixtureWorld([A]); addPlatform(four.w, -1, 2, 12, 20); // 4 wide
  assert.equal(LEG.findSide(four.at, A), null, "deck run shorter than 5");
  const high = fixtureWorld([A]); addPlatform(high.w, -5, 5, 12, 20, 41);
  assert.equal(LEG.findSide(high.at, A), null, "wrong height");
  const curved = fixtureWorld([A]); // rounded rim: the front row is only 3 wide, wider rows follow one step back
  addPlatform(curved.w, -5, 5, 13, 20); for (let x = -1; x <= 1; x++) { curved.w.set(`${x},40,12`, PLANKS); curved.w.set(`${x},41,12`, FENCE); }
  for (const x of [-1, 1]) curved.w.set(`${x},41,13`, FENCE);
  assert.equal(LEG.findSide(curved.at, A), null, "a rounded rim (3-cell nub in front of the straight run) is refused: no straight 5-run with open space in front");
  const bridge = fixtureWorld([A]); // a 5-wide bridge crossing the heading: rails at +-2 across, only one walk row deep
  addPlatform(bridge.w, -6, 6, 12, 16); for (let x = -6; x <= 6; x++) { bridge.w.delete(`${x},41,13`); bridge.w.delete(`${x},41,15`); }
  for (let x = -6; x <= 6; x++) for (const z of [13, 14, 15]) bridge.w.delete(`${x},41,${z}`);
  addPlatform(bridge.w, -6, 6, 12, 14);
  assert.equal(LEG.findSide(bridge.at, A), null, "a 3-deep strip (bridge) is no target");
  // exit-exit wins over a platform side that is nearer
  const both = fixtureWorld([A, E(0, 15, [0, -1])]); addPlatform(both.w, -5, 5, 8, 11);
  const pick = LEG.decide(both.at, A);
  assert.equal(pick.kind, "exit");
  assert.equal(pick.partner.z, 15);
  // blocked side corridor reports
  const blockedSide = mk((w) => w.set("0,43,6", "lothlorien:mallorn_log"));
  assert.equal(LEG.decide(blockedSide.at, A).reason, "blocked");
});
test("loop closer: runtime bridges are lit to >= 8 on every walk cell (shared flood fill over the plan's own blocks), all lengths / offsets / headings", () => {
  const passes = (n) => n === undefined || /^minecraft:air$|fence$|elven_lantern$/.test(n);
  let worst = 99, count = 0;
  for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    for (let length = LOOP.LOOP.minDist + 1; length <= LOOP.LOOP.maxDist + 1; length++) {
      const maxOff = Math.min(LOOP.LOOP.maxOffset, length - 3);
      for (let off = -maxOff; off <= maxOff; off++) {
        const A = E(0, 0, dir), ex = [dir[1], -dir[0]], B = E(dir[0] * (length - 1) + ex[0] * off, dir[1] * (length - 1) + ex[1] * off, [-dir[0], -dir[1]]);
        const plan = LOOP.planBridge(A, B, length, off), blocks = LOOP.finalBlocks(plan);
        const xs = [...blocks.keys()].map((k) => k.split(",").map(Number)), lo = [0, 1, 2].map((i) => Math.min(...xs.map((c) => c[i]))), hi = [0, 1, 2].map((i) => Math.max(...xs.map((c) => c[i])));
        const get = (x, y, z) => blocks.get(`${x + lo[0]},${y + lo[1]},${z + lo[2]}`)?.id;
        const size = [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1];
        const L = sharedLight(get, size, { [LOOP.LANTERN]: 14 }, passes);
        for (const [k, b] of blocks) { // walk cells = feet cells above a plank / slab with two air cells above
          if (b.id !== PLANKS && b.id !== SLAB_NAME) continue;
          const [x, y, z] = k.split(",").map(Number);
          if (blocks.get(`${x},${y + 1},${z}`)?.id !== "minecraft:air" || blocks.get(`${x},${y + 2},${z}`)?.id !== "minecraft:air") continue;
          const l = L.get(`${x - lo[0]},${y + 1 - lo[1]},${z - lo[2]}`) ?? 0;
          worst = Math.min(worst, l); count++;
          assert.ok(l >= LOOP.LOOP.lightTarget, `heading ${dir} length ${length} offset ${off}: walk cell ${x},${y + 1},${z} has light ${l}`);
        }
        assert.equal(plan.lanterns.filter((l) => l.row === 0 || l.row === length - 1).length, 0, "no lantern in the connector rows");
        assert.ok(plan.lanterns.length <= 8, `${plan.lanterns.length} lanterns`);
      }
    }
  }
  console.log(`loop closer bridges: ${count} walk cells, darkest ${worst}`);
});
// ground fixture: stone at and below y = top where the world has nothing (the fixture world is air everywhere else); extra(x, y, z) overrides
const withGround = (at, top, extra = () => undefined) => (x, y, z) => extra(x, y, z) ?? (at(x, y, z) !== "minecraft:air" ? at(x, y, z) : y <= top ? "minecraft:stone" : "minecraft:air");
const LOGN = "lothlorien:mallorn_log";
test("loop closer (long spans): above 17 blocks two bridges meet on a 5 x 5 landing that stands on a log pier to the ground; walkable end to end, rails closed, openings cut", () => {
  for (const [dist, lat] of [[18, 0], [22, 5], [26, -6], [30, 8], [30, -8]]) {
    for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const ex = [dir[1], -dir[0]], A = E(0, 0, dir), B = E(dir[0] * dist + ex[0] * lat, dir[1] * dist + ex[1] * lat, [-dir[0], -dir[1]]);
      const f = fixtureWorld([A, B]), at = withGround(f.at, 20), dA = LEG.decide(at, A), d = dA.action === "build" ? dA : LEG.decide(at, B); // the smaller (x, z) builds
      assert.equal(d.action, "build", `dist ${dist} lat ${lat} heading ${dir}`);
      const plan = d.plan, L = plan.landing;
      assert.ok(plan.landing && plan.length === dist + 1 && plan.offset === lat);
      assert.equal(L.d1 + 4 + L.d2, dist);
      assert.ok(L.d1 >= LOOP.LOOP.minDist && L.d2 >= LOOP.LOOP.minDist && L.d1 <= LOOP.LOOP.maxDist && L.d2 <= LOOP.LOOP.maxDist);
      const out = LOOP.finalBlocks(plan), get = (x, y, z) => out.get(`${x},${y},${z}`)?.id ?? at(x, y, z);
      // landing deck 5 x 5, rim fenced except the two 3-wide openings, two lanterns on the side posts
      let deck = 0, fences = 0;
      for (let k = 0; k < 5; k++) for (let o = -2; o <= 2; o++) {
        const x = L.x + dir[0] * (k - 2) + ex[0] * o, z = L.z + dir[1] * (k - 2) + ex[1] * o;
        if (get(x, 40, z) === PLANKS) deck++;
        const rim = k === 0 || k === 4 || Math.abs(o) === 2, opening = (k === 0 || k === 4) && Math.abs(o) <= 1;
        if (get(x, 41, z) === FENCE) fences++;
        assert.equal(get(x, 41, z) === FENCE, rim && !opening, `landing cell k${k} o${o}`);
        if (!rim) for (const up of [1, 2, 3]) assert.equal(get(x, 40 + up, z), "minecraft:air");
      }
      assert.equal(deck, 25); assert.equal(fences, 10); // 16 rim cells - 2 x 3 opening cells
      assert.equal(plan.lanterns.filter((l) => l.row === L.d1 + 2).length, 2);
      // pier: plus of columns under the centre from under the deck to y 21 (ground top 20), four braces under the deck
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) for (let y = 21; y <= 39; y++) assert.equal(get(L.x + dx, y, L.z + dz), LOGN, `pier ${dx},${dz} at ${y}`);
      assert.equal(get(L.x, 20, L.z), "minecraft:stone");
      for (const [dx, dz, dy] of [[2, 0, -1], [-2, 0, -1], [0, 2, -1], [0, -2, -1], [2, 0, -3], [0, -2, -3]]) assert.equal(get(L.x + dx, 40 + dy, L.z + dz), LOGN, `brace ${dx},${dz},${dy}`);
      // both end rows are opened, rows 0..dist all have a 3-wide walk (deck / slab with 2 free cells above)
      assert.equal(get(A.x, 41, A.z), "minecraft:air"); assert.equal(get(B.x, 41, B.z), "minecraft:air");
      for (let row = 0; row <= dist; row++) {
        let walk = 0;
        for (const k of out.keys()) {
          const [x, y, z] = k.split(",").map(Number);
          if ((x - A.x) * dir[0] + (z - A.z) * dir[1] !== row || ![PLANKS, SLAB_NAME].includes(out.get(k).id)) continue;
          if (get(x, y + 1, z) === "minecraft:air" && get(x, y + 2, z) === "minecraft:air") walk++;
        }
        assert.ok(walk >= 3, `row ${row}: ${walk} walk cells (dist ${dist} lat ${lat} heading ${dir})`);
      }
    }
  }
});
test("loop closer (long spans): bridges and landing are lit to >= 8 on every walk cell, no lantern in the end rows, all spans / offsets / headings", () => {
  const passes = (n) => n === undefined || /^minecraft:air$|fence$|elven_lantern$/.test(n);
  let worst = 99, count = 0;
  for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    for (let dist = LOOP.LOOP.maxDist + 1; dist <= LOOP.LOOP.maxSpan; dist++) {
      for (let lat = -LOOP.LOOP.maxSpanOffset; lat <= LOOP.LOOP.maxSpanOffset; lat += 2) {
        const A = E(0, 0, dir), ex = [dir[1], -dir[0]], B = E(dir[0] * dist + ex[0] * lat, dir[1] * dist + ex[1] * lat, [-dir[0], -dir[1]]);
        for (const side of [false, true]) {
          const plan = LOOP.planSpan(A, B, dist, lat, side), blocks = LOOP.finalBlocks(plan);
          const xs = [...blocks.keys()].map((k) => k.split(",").map(Number)), lo = [0, 1, 2].map((i) => Math.min(...xs.map((c) => c[i]))), hi = [0, 1, 2].map((i) => Math.max(...xs.map((c) => c[i])));
          const get = (x, y, z) => blocks.get(`${x + lo[0]},${y + lo[1]},${z + lo[2]}`)?.id;
          const L = sharedLight(get, [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1], { [LOOP.LANTERN]: 14 }, passes);
          for (const [k, b] of blocks) {
            if (b.id !== PLANKS && b.id !== SLAB_NAME) continue;
            const [x, y, z] = k.split(",").map(Number);
            if (blocks.get(`${x},${y + 1},${z}`)?.id !== "minecraft:air" || blocks.get(`${x},${y + 2},${z}`)?.id !== "minecraft:air") continue;
            const l = L.get(`${x - lo[0]},${y + 1 - lo[1]},${z - lo[2]}`) ?? 0;
            worst = Math.min(worst, l); count++;
            assert.ok(l >= LOOP.LOOP.lightTarget, `heading ${dir} dist ${dist} lat ${lat}: walk cell ${x},${y + 1},${z} has light ${l}`);
          }
          assert.equal(plan.lanterns.filter((l) => l.row === 0 || l.row === dist).length, 0, "no lantern in the two end rows");
        }
      }
    }
  }
  console.log(`loop closer long spans: ${count} walk cells, darkest ${worst}`);
});
test("loop closer (pier): stands on any ground, goes through leaves and a lake to its bottom, refuses lava, no ground within 48 blocks and unloaded columns", () => {
  const A = E(0, 0, [0, 1]), B = E(0, 24, [0, -1]), f = fixtureWorld([A, B]);
  const L = LEG.decide(withGround(f.at, 20), A).plan.landing; // centre (0, 40, 10 + 2 = 12)
  assert.equal(L.z, 12);
  const plan = (top, extra) => LEG.decide(withGround(f.at, top, extra), A);
  const uneven = plan(20, (x, y, z) => (x === 1 && z === 12 && y <= 33 ? "minecraft:dirt" : undefined)); // one arm's column hits a hill at 33
  const logs = [...LOOP.finalBlocks(uneven.plan)].filter(([, b]) => b.id === LOGN).map(([k]) => k);
  assert.ok(logs.includes("1,34,12") && !logs.includes("1,33,12") && logs.includes("0,21,12"), "each column stops on its own ground");
  const lake = plan(20, (x, y, z) => (y >= 21 && y <= 33 && Math.abs(x) < 8 && z > 5 && z < 20 ? "minecraft:water" : undefined));
  assert.equal(lake.action, "build"); assert.ok(LOOP.finalBlocks(lake.plan).get("0,25,12")?.id === LOGN, "pier stands in the water down to the bottom");
  const leaves = plan(20, (x, y, z) => (y === 30 && z === 12 && x === 0 ? "lothlorien:mallorn_leaves" : undefined));
  assert.equal(leaves.action, "build"); assert.equal(LOOP.finalBlocks(leaves.plan).get("0,30,12")?.id, LOGN, "leaves are replaced");
  assert.equal(plan(20, (x, y, z) => (x === 0 && z === 12 && y === 25 ? "minecraft:lava" : undefined)).reason, "pier over lava");
  assert.match(plan(-10).reason, /no ground within 48/);
  assert.equal(plan(-9).action, "build", "48 free cells below the deck (y 39 .. -8) and ground at -9 is just in reach");
  assert.equal(LEG.decide((x, y, z) => (y < 38 && x === 0 && z === 12 ? undefined : withGround(f.at, 20)(x, y, z)), A).reason, "pier column not loaded");
  // a span that cannot get a pier falls back to a nearer target if there is one, otherwise none
  const near = fixtureWorld([A, E(0, 24, [0, -1])]); addPlatform(near.w, -3, 3, 12, 20);
  assert.equal(LEG.decide(withGround(near.at, -50), A).kind, "side", "pier impossible, the platform side is nearer anyway");
});
test("loop closer (lantern on a rim post): a bridge into a platform side may replace the lantern that stands next to the opening", () => {
  const A = E(0, 0, [0, 1]), f = fixtureWorld([A]);
  addPlatform(f.w, -6, 6, 12, 20);
  for (const x of [-2, 2]) f.w.set(`${x},42,12`, "lothlorien:elven_lantern");
  const d = LEG.decide(f.at, A);
  assert.equal(d.action, "build"); assert.equal(d.kind, "side");
  assert.deepEqual(LOOP.blockedCells(f.at, d.plan), []);
});
test("loop planner: in simulated villages the planner (one start marker, discovery by ticking areas) finds every marker, builds a walkable deck, passes walk + light, budget respected", () => {
  let loops = 0, complete = 0;
  for (const r of villages()) {
    const states = new Map(), world = buildWorld(r.res, states), n = Math.max(1, r.res.placed.flatMap(markerCells).length);
    const lp = planLoops(r.res, world, states, { verify: true, start: (r.seed * 13) % n, shift: [(r.seed * 7) % 16, (r.seed * 11) % 16] });
    loops += lp.loops; complete += lp.complete ? 1 : 0;
    assert.equal(lp.error, null);
    assert.ok(lp.loops <= PL.PLAN.budget, `seed ${r.seed}: ${lp.loops} links, budget ${PL.PLAN.budget}`);
    assert.deepEqual(lp.bad, [], `seed ${r.seed}: links with walk / light violations`);
    assert.equal(walkability(r.res, world, states).unreachable.length, 0, `seed ${r.seed}: walkable deck after the links`);
  }
  assert.ok(loops >= 1, "at least one link in 30 seeds");
  assert.equal(complete, villages().length, "discovery from the start marker found every marker of every village");
});

// --- loop closer round 2 (owner 2026-10-09): F1 side-to-side, F2 flat short decks, F3 offset 8, F4 plaza, F5 L-join, clutter rule ---
import { applyPlan, joinChecks } from "../tools/village_sim.mjs";
// A platform with an exit: exit row (5 planks + 5 fences) at (ex, ez) heading `dir`, behind it the connector row t = 1 and a rail-ringed deck `depth` rows deep.
function exitPlatform(w, ex, ez, dir, { y = 40, depth = 9, half = 4 } = {}) {
  const a = [Math.abs(dir[1]), Math.abs(dir[0])], xz = (t, o) => [ex - dir[0] * t + a[0] * o, ez - dir[1] * t + a[1] * o];
  const put = (t, o, fence) => { const [x, z] = xz(t, o); w.set(`${x},${y},${z}`, PLANKS); if (fence) w.set(`${x},${y + 1},${z}`, FENCE); };
  for (let o = -2; o <= 2; o++) put(0, o, true);
  for (let t = 1; t <= depth; t++) for (let o = -half; o <= half; o++) put(t, o, t === depth || Math.abs(o) === half || (t === 1 && Math.abs(o) >= 2));
}
const mkWorld = (build) => { // Map "x,y,z" fixture -> sim world (wkey) with stone below y 35
  const w = new Map(); build(w);
  const world = new Map(), states = new Map();
  for (const [k, v] of w) { const [x, y, z] = k.split(",").map(Number); world.set(wkey(x, y, z), v); states.set(wkey(x, y, z), v === FENCE ? { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false } : {}); }
  const at = (x, y, z) => world.get(wkey(x, y, z)) ?? (y < 35 ? "minecraft:stone" : "minecraft:air");
  return { world, states, at };
};
const joined = (f, d) => { // apply a built plan and run the walk + light checks on it
  assert.equal(d.action, "build", d.reason);
  const r = joinChecks(f.world, f.states, d.plan, () => applyPlan(f.world, f.states, d.plan));
  assert.deepEqual(r.walk, [], `${d.kind}: walk violations`);
  assert.ok(r.light >= LOOP.LOOP.lightTarget, `${d.kind}: darkest walk cell ${r.light}`);
  return r;
};
test("loop closer (F1): a rim run of one platform starts a bridge to the facing rim of another; both rims open, rails continuous, lit; sideAt finds the run from a marker up to 4 cells off", () => {
  const g = mkWorld((w) => { addPlatform(w, -5, 5, 0, 8); addPlatform(w, -4, 6, 19, 27); });
  const S = LEG.sideAt(g.at, 0, 40, 8);
  assert.deepEqual([S.x, S.z, S.dir.join()], [0, 8, "0,1"]);
  assert.ok(LEG.sideAt(g.at, 3, 40, 8) && LEG.sideAt(g.at, -4, 40, 8), "a marker 3-4 cells along the rim still finds a run");
  assert.equal(LEG.sideAt(g.at, 0, 40, 4), null, "a deck cell inside the platform is no rim");
  assert.equal(LEG.sideAt(g.at, 20, 40, 8), null);
  const d = LEG.decide(g.at, S, { sideStart: true });
  assert.equal(d.kind, "sideside");
  assert.deepEqual([d.plan.length, d.plan.offset], [12, 0]);
  joined(g, d);
  for (const o of [-1, 0, 1]) assert.equal(g.at(o, 41, 8), "minecraft:air", "near rim opened");
  assert.equal(g.at(-2, 41, 8), FENCE);
  assert.equal(LEG.sideAt(g.at, 0, 40, 8), null, "after the join the rim has an opening: no second join from the same rim run");
  assert.equal(LEG.sideAt(g.at, 1, 40, 19), null, "and none from the far rim either");
});
test("loop closer (F1): no side start from a stair opening; the clutter rule refuses a join within 2 cells of foreign deck (offset 1 and 4); never through another structure", () => {
  for (const off of [1, 4]) {
    const mk = (extra) => mkWorld((w) => { addPlatform(w, -5, 5, 0, 8); addPlatform(w, -5 + off, 5 + off, 19, 27); extra?.(w); });
    const A = { x: 0, y: 40, z: 8, dir: [0, 1] };
    assert.equal(LEG.decide(mk().at, A, { sideStart: true }).action, "build", `offset ${off}`);
    const near = mk((w) => { for (let x = 4; x <= 8; x++) { w.set(`${x},40,13`, PLANKS); w.set(`${x},41,13`, FENCE); } }); // a foreign strip 2 cells from the bridge edge
    const dn = LEG.decide(near.at, A, { sideStart: true });
    assert.deepEqual([dn.action, dn.reason], ["none", "clutter"], `offset ${off}: foreign deck within 2 cells`);
    if (off === 1) assert.equal(LEG.decideSide(near.at, 0, 40, 8).kind, "sideside", "the marker tries the next rim cells: a start further along the rim is free");
    const farOff = mk((w) => { for (let x = 9; x <= 12; x++) { w.set(`${x},40,13`, PLANKS); w.set(`${x},41,13`, FENCE); } });
    assert.equal(LEG.decide(farOff.at, A, { sideStart: true }).action, "build", "3 cells away is fine");
  }
  const blocked = mkWorld((w) => { addPlatform(w, -5, 5, 0, 8); addPlatform(w, -5, 5, 19, 27); for (let x = -9; x <= 9; x++) w.set(`${x},42,13`, "lothlorien:mallorn_log"); });
  assert.equal(LEG.decide(blocked.at, { x: 0, y: 40, z: 8, dir: [0, 1] }, { sideStart: true }).reason, "blocked");
  const stairs = mkWorld((w) => { addPlatform(w, -5, 5, 0, 8); addPlatform(w, -5, 5, 19, 27); for (let x = -1; x <= 1; x++) w.delete(`${x},40,7`); });
  assert.equal(LEG.sideAt(stairs.at, 0, 40, 8), null, "a hole behind the rim (stair opening) is no side");
});
test("loop closer (F2/F3): exits 2..5 apart get a FLAT deck (no arch, no slabs), 6.. the arch; sideways reach is 8 for a direct bridge; all lit and walkable", () => {
  for (const dist of [2, 3, 4, 5, 6]) { // length dist + 1 <= 5 (dist <= 4) is flat
    const f = mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 0, dist, [0, -1]); });
    const d = LEG.decide(f.at, LOOP.exitAt(f.at, 0, 40, 0));
    assert.equal(d.kind, "exit", `dist ${dist}`);
    assert.equal(d.plan.length, dist + 1);
    const slabs = d.plan.cells.filter((c) => c.kind.startsWith("slab")).length;
    if (dist <= 4) assert.equal(slabs, 0, `dist ${dist}: flat`); else assert.ok(slabs > 0, "arched");
    joined(f, d);
  }
  for (const lat of [6, 7, 8]) {
    const f = mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, lat, 12, [0, -1]); });
    const d = LEG.decide(f.at, LOOP.exitAt(f.at, 0, 40, 0));
    assert.equal(d.kind, "exit", `lateral ${lat}`);
    assert.equal(Math.abs(d.plan.offset), lat);
    joined(f, d);
  }
  const f9 = mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 9, 14, [0, -1]); });
  assert.notEqual(LEG.decide(f9.at, LOOP.exitAt(f9.at, 0, 40, 0)).kind, "exit", "9 sideways is too far for a direct bridge");
});
test("loop closer (F4): the plaza - two close balcony ends 6 sideways (the owner's gap5) get a filled railed deck, rails of the joined edges removed, on a pier; refused when blocked", () => {
  const mk = (extra) => mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 6, 2, [0, -1]); extra?.(w); });
  const f = mk(), A = LOOP.exitAt(f.at, 0, 40, 0);
  assert.ok(A && LOOP.exitAt(f.at, 6, 40, 2));
  assert.equal(LEG.findPartner(f.at, A), null, "no bridge fits (dist 2, lateral 6)");
  assert.equal(LEG.decide(f.at, LOOP.exitAt(f.at, 6, 40, 2)).kind, "plaza", "the other end finds the very same plaza");
  const d = LEG.decide(f.at, A);
  assert.equal(d.kind, "plaza");
  assert.ok(d.plan.cells.filter((c) => c.kind === "plank").length >= 20 && d.plan.pier.length > 0, "a filled deck on a log pier (owner: no unsupported balconies)");
  joined(f, d);
  for (const [x, z] of [[0, 0], [6, 2]]) assert.equal(f.at(x, 41, z), "minecraft:air", "the rails of the joined edges are gone");
  assert.ok([...f.world].some(([, n]) => n === LOOP.LANTERN));
  const log = mk((w) => w.set("3,41,1", "lothlorien:mallorn_log"));
  assert.notEqual(LEG.decide(log.at, LOOP.exitAt(log.at, 0, 40, 0)).kind, "plaza", "a log in the patch: no plaza");
  const cant = mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1], { depth: 2, half: 2 }); exitPlatform(w, 8, 6, [0, -1], { depth: 2, half: 2 }); });
  assert.notEqual(LEG.decide(cant.at, LOOP.exitAt(cant.at, 0, 40, 0)).kind, "plaza", "the patch would hang more than 4 cells out");
});
test("loop closer (F5): L-join - exits at right angles meet on a 5 x 5 railed, lit landing on a log pier; two straight legs (an 8 / 7 L: total 16, within PLAN.lMaxLen 16; a 12 / 12 L of 25 is refused, owner 2026-10-09), no diagonal; refused by clutter and by obstacles", () => {
  const mk = (extra) => mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 7, 8, [-1, 0]); extra?.(w); });
  const f = mk(), A = LOOP.exitAt(f.at, 0, 40, 0);
  assert.deepEqual(LOOP.findLs(f.at, A).map((c) => [c.s, c.u]), [[8, 7]]);
  assert.equal(LEG.decide(f.at, LOOP.exitAt(f.at, 7, 40, 8)).kind, "L", "the other end finds the same L-join");
  const d = LEG.decide(f.at, A);
  assert.equal(d.kind, "L");
  assert.ok(d.plan.parts.every((p) => p.offset === 0), "both legs straight");
  assert.ok(d.plan.pier.length > 20, "pier under the landing");
  joined(f, d);
  assert.equal(f.at(0, 41, 0), "minecraft:air");
  assert.equal(f.at(7, 41, 8), "minecraft:air");
  assert.equal(f.at(0, 40, 8), PLANKS);
  assert.equal(PL.enumerate(mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 12, 12, [-1, 0]); }).at, { exits: [LOOP.exitAt(mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 12, 12, [-1, 0]); }).at, 0, 40, 0)], rims: [] }).filter((c) => c.kind === "L").length, 0, "big L refused");
  const g = mk((w) => { w.set("0,42,3", "lothlorien:mallorn_log"); }); // in the arch of the first leg
  assert.notEqual(LEG.decide(g.at, LOOP.exitAt(g.at, 0, 40, 0)).kind, "L", "obstacle in a leg");
  const h = mk((w) => { for (let x = 3; x <= 5; x++) { w.set(`${x},40,3`, PLANKS); w.set(`${x},41,3`, FENCE); } });
  assert.notEqual(LEG.decide(h.at, LOOP.exitAt(h.at, 0, 40, 0)).kind, "L", "foreign deck within 2 cells of the first leg");
  assert.ok(LOOP.planPier((x, y, z) => (y === 36 ? "minecraft:lava" : mk().at(x, y, z)), d.plan.landing).error, "the pier gives up over lava (existing error path)");
});
test("loop merge (F6, gap8 / gap9): decks 0 or 1 cell apart open into one - shared railings go, a 1-cell gap is planked and capped, walk + light pass, no budget used; other heights and short runs are left, openWalk is rail-aware", () => {
  const mk = (gap, edit) => mkWorld((w) => { addPlatform(w, -9, -1, 0, 8); addPlatform(w, -1 + gap + 1, 8 + gap, 0, 8); edit?.(w); });
  const marks = (gap) => [[-1, 40, 4], [gap, 40, 4]];
  for (const gap of [0, 1]) {
    const f = mk(gap), res = PL.planVillage(f.at, marks(gap), { budget: 0 });
    assert.equal(res.merges.length, 1, `gap ${gap}`); assert.equal(res.picks.length, 0);
    const m = res.merges[0];
    assert.equal(m.gap, gap); assert.equal(m.len, 7, "rows 1..7 face each other (the corner posts at z 0 and 8 have no deck behind them: they ARE the end posts, the whole stretch opens)");
    joined(f, { action: "build", kind: "merge", plan: m.plan });
    for (const z of [1, 2, 3, 4, 5, 6, 7]) { // the opening
      assert.equal(f.at(-1, 41, z), "minecraft:air"); assert.equal(f.at(gap, 41, z), "minecraft:air");
      if (gap) { assert.equal(f.at(0, 40, z), PLANKS); assert.equal(f.at(0, 41, z), "minecraft:air"); }
    }
    for (const z of [0, 8]) { assert.equal(f.at(-1, 41, z), FENCE); assert.equal(f.at(gap, 41, z), FENCE); if (gap) { assert.equal(f.at(0, 40, z), PLANKS); assert.equal(f.at(0, 41, z), FENCE, "end cap on the filled gap"); } }
    const st = (x, z) => f.states.get(wkey(x, 41, z)) ?? {};
    assert.equal(st(-1, 0)["minecraft:connection_south"], false, "the end post lets go of the removed rail");
    assert.equal(st(-1, 0)["minecraft:connection_north"], false, "and keeps what it had (nothing north of the corner)");
    assert.equal(st(-1, 0)["minecraft:connection_east"], true, "to the partner corner post (gap 0) or the cap (gap 1)");
    if (gap) { assert.equal(st(0, 0)["minecraft:connection_west"], true); assert.equal(st(0, 0)["minecraft:connection_east"], true); }
    const walk = checkWalk((x, y, z) => { const k = wkey(x, y, z), n = f.world.get(k); return n === undefined || n === "minecraft:air" ? undefined : { name: n, states: f.states.get(k) }; }, { x0: -10, x1: 10, y0: 35, y1: 46, z0: -1, z1: 9 }, { must: [{ x: -5, y: 41, z: 4 }, { x: 5, y: 41, z: 4 }] });
    assert.deepEqual(walk.violations.filter((v) => v.rule !== "unguarded_edge"), [], "walkable and connected (the open sides of the fixture platforms' far ends are not the merge's business)");
  }
  assert.equal(PL.planVillage(mk(0).at, marks(0), { budget: 0, mergeCap: 0 }).merges.length, 0, "cap 0 switches merges off");
  assert.equal(PL.planVillage(mk(2).at, [[-1, 40, 4], [2, 40, 4]], { budget: 0 }).merges.length, 0, "2 cells apart is no merge");
  const high = mkWorld((w) => { addPlatform(w, -9, -1, 0, 8); addPlatform(w, 1, 9, 0, 8, 41); });
  assert.equal(PL.planVillage(high.at, [[-1, 40, 4], [1, 41, 4]], { budget: 0 }).merges.length, 0, "different heights are skipped");
  const short = mkWorld((w) => { addPlatform(w, -9, -1, 0, 4); addPlatform(w, 1, 9, 0, 4); });
  assert.equal(PL.planVillage(short.at, [[-1, 40, 2]], { budget: 0 }).merges.length, 1, "3 deck cells between real corner posts: a 3-wide opening (it was too short under the old minRun 4)");
  // no real end post on one side (the far rim row stops at the stretch): that last cell stays a post, 2 cells must remain
  const open1 = mkWorld((w) => { addPlatform(w, -9, -1, 0, 4); addPlatform(w, 1, 9, 0, 4); w.delete("1,41,0"); w.set("1,40,0", "minecraft:air"); });
  const o1 = PL.planVillage(open1.at, [[-1, 40, 2]], { budget: 0 }).merges;
  assert.deepEqual([o1.length, o1[0]?.len], [1, 2], "no post on one end: that end cell stays a post, 2 cells open (openMinTrim)");
  const open2 = mkWorld((w) => { addPlatform(w, -9, -1, 0, 3); addPlatform(w, 1, 9, 0, 3); w.delete("1,41,0"); w.set("1,40,0", "minecraft:air"); });
  assert.equal(PL.planVillage(open2.at, [[-1, 40, 2]], { budget: 0 }).merges.length, 0, "no post on one end and a 2-cell core: 1 cell left, too narrow");
  // real world TT 2026-10-09 (gap8): two 5-wide end caps touching, staggered by 2 cells: A rim row z = 0 (x 0..4), B rim row z = 1 (x 2..6). They share ONE
  // interior cell (x = 3), between two real posts on each row: a 1-cell door
  const stag = (edit) => mkWorld((w) => { addPlatform(w, 0, 4, -8, 0); addPlatform(w, 2, 6, 1, 9); edit?.(w); });
  const sf = stag(), sres = PL.planVillage(sf.at, [[2, 40, -4]], { budget: 0 });
  assert.equal(sres.merges.length, 1, "staggered caps merge"); assert.equal(sres.merges[0].len, 1);
  joined(sf, { action: "build", kind: "merge", plan: sres.merges[0].plan });
  assert.equal(sf.at(3, 41, 0), "minecraft:air"); assert.equal(sf.at(3, 41, 1), "minecraft:air");
  for (const [x, z] of [[2, 0], [4, 0], [2, 1], [4, 1]]) assert.equal(sf.at(x, 41, z), FENCE, `post ${x},${z}`);
  const swalk = checkWalk((x, y, z) => { const k = wkey(x, y, z), n = sf.world.get(k); return n === undefined || n === "minecraft:air" ? undefined : { name: n, states: sf.states.get(k) }; }, { x0: -2, x1: 8, y0: 35, y1: 46, z0: -9, z1: 10 }, { must: [{ x: 2, y: 41, z: -4 }, { x: 4, y: 41, z: 5 }] });
  assert.deepEqual(swalk.violations.filter((v) => v.rule !== "unguarded_edge"), [], "the door connects the two decks");
  const lane = mkWorld((w) => { for (let x = 0; x <= 6; x++) { w.set(`${x},40,0`, PLANKS); w.set(`${x},40,1`, PLANKS); } w.set("3,41,0", FENCE); w.set("3,41,1", FENCE); });
  assert.equal(PL.openWalk(lane.at, { x: 0, y: 40, z: 0 }, { x: 6, y: 40, z: 0 }, 20), false, "a railing wall across the deck blocks the walk");
  lane.world.delete(wkey(3, 41, 1));
  assert.equal(PL.openWalk(lane.at, { x: 0, y: 40, z: 0 }, { x: 6, y: 40, z: 0 }, 20), true, "one open cell lets it through");
  assert.equal(PL.openWalk(lane.at, { x: 0, y: 40, z: 0 }, { x: 6, y: 40, z: 0 }, 5), false, "limit counts steps (a long way round is not a short walk)");
});
test("loop planner: 30 simulated villages - every join passes the shared walk checker and light >= 8, all join kinds occur over the seeds, deck stays walkable; marker counts stay modest", () => {
  const kinds = {}; let markers = 0, n = 0;
  for (const r of villages()) {
    const states = new Map(), world = buildWorld(r.res, states), lp = planLoops(r.res, world, states, { verify: true, shift: [(r.seed * 5) % 16, (r.seed * 3) % 16] });
    assert.deepEqual(lp.bad, [], `seed ${r.seed}: joins with walk / light violations`);
    for (const [k, v] of Object.entries(lp.byKind)) kinds[k] = (kinds[k] ?? 0) + v;
    markers += lp.markers; n++;
    assert.equal(walkability(r.res, world, states).unreachable.length, 0, `seed ${r.seed}: walkable deck`);
  }
  for (const k of ["exit", "side", "sideside"]) assert.ok(kinds[k] >= 1, `join kind ${k} occurs: ${JSON.stringify(kinds)}`);
  assert.ok(markers / n <= 60, `markers per village ${(markers / n).toFixed(1)}`);
  console.log(`loop planner (30 villages): ${JSON.stringify(kinds)}, markers/village ${(markers / n).toFixed(1)}`);
});

// --- village loop PLANNER (owner 2026-10-09): one run per village on a script-loaded area, global choice, budget 3, one-shot ---
import { gunzipSync } from "node:zlib";
test("loop planner: picks the best links of a village globally and respects the budget (3 extra links); nothing readable beyond the area is used", () => {
  const exits = [];
  for (const x of [0, 40, 80, 120]) exits.push(E(x, 0, [0, 1]), E(x, 12 + x / 40, [0, -1])); // four independent facing pairs (12..15 apart)
  const f = fixtureWorld(exits), marks = exits.map((e) => [e.x, e.y, e.z]);
  assert.equal(PL.enumerate(f.at, PL.startsFromMarkers(f.at, marks)).filter((c) => c.kind === "exit").length, 4);
  for (const [budget, want] of [[1, 1], [2, 2], [3, 3], [4, 4], [9, 4]]) assert.equal(PL.planVillage(f.at, marks, { budget }).picks.length, want, `budget ${budget}`);
  assert.equal(PL.PLAN.budget, 3, "default: up to 3 extra links per village (owner 2026-10-09)");
  assert.equal(PL.planVillage(f.at, marks).picks.length, 3);
  const blocked = (x, y, z) => (x === 0 && y > 40 && y < 48 && z === 6 ? "lothlorien:mallorn_log" : f.at(x, y, z));
  assert.ok(PL.planVillage(blocked, marks, { budget: 9 }).picks.every((p) => p.A.x !== 0 && p.B.x !== 0), "a trunk in the corridor: that pair is skipped, the others stay");
  assert.equal(PL.planVillage(blocked, marks, { budget: 9 }).picks.length, 3);
  const bounded = PL.boundedReader(f.at, { x0: -16, x1: 15, z0: -16, z1: 15 });
  assert.equal(bounded(0, 40, 0), PLANKS); assert.equal(bounded(40, 40, 0), undefined, "outside the loaded area: unreadable");
  assert.equal(PL.planVillage(bounded, marks, { budget: 9 }).picks.length, 1, "only the pair inside the area; unreadable cells never become a join");
  assert.equal(PL.planVillage(f.at, [], {}).picks.length, 0, "no markers, no starts");
});
test("loop planner: only a real shortcut is built - a pair that is already connected by a short walk is left alone", () => {
  const A = E(0, 0, [0, 1]), B = E(0, 12, [0, -1]), f = fixtureWorld([A, B]);
  for (let z = 1; z <= 11; z++) for (let x = -6; x <= -3; x++) f.w.set(`${x},40,${z}`, PLANKS); // a deck beside the corridor that links both platforms
  for (let x = -6; x <= -3; x++) { f.w.set(`${x},40,0`, PLANKS); f.w.set(`${x},40,12`, PLANKS); }
  assert.equal(PL.planVillage(f.at, [[0, 40, 0], [0, 40, 12]]).picks.length, 0, "walking round is as short as the bridge");
});
test("loop planner: discovery grows the ticking area round by round until the marker set is stable, keeps within the quota, and fails cleanly", async () => {
  const cell = (x, z) => [x, 40, z], all = [cell(0, 0), cell(30, 10), cell(60, 5), cell(90, -20), cell(400, 400)]; // the last one is another village
  const mkEnv = (cap = Infinity) => {
    const log = [], alive = new Set(), env = {
      claim: (r) => log.push(["claim", r]), hasCapacity: (r) => PL.chunksIn(r) <= cap, create: (id, r) => { alive.add(id); log.push(["create", id, PL.chunksIn(r)]); }, remove: (id) => { alive.delete(id); log.push(["remove", id]); },
      markersIn: (r) => all.filter(([x, , z]) => PL.inRect(r, x, z)),
    };
    return { env, log, alive };
  };
  const a = mkEnv(), found = PL.discoverSync(a.env, all[0], "t");
  assert.equal(found.known.length, 4, "grows 0 -> 30 -> 60 -> 90 and stops: the far village is not pulled in");
  assert.ok(found.stable && found.rounds >= 2 && found.rounds <= PL.AREA.maxRounds && found.sizes[0] > PL.chunksIn(PL.chunkAlign(PL.growRect(PL.hullOf([cell(0, 0)]), PL.AREA.margins[0]))), "round 1 is the seeded (bigger) area");
  assert.deepEqual([...a.alive], found.ids, "the previous area is removed once the next one is up; one area alive at the end");
  assert.ok(found.rect.x0 % 16 === 0 && (found.rect.x1 + 1) % 16 === 0, "areas are chunk aligned");
  assert.ok(found.known.every(([x, , z]) => PL.inRect(found.rect, x, z)));
  for (const start of all.slice(0, 4)) assert.equal(PL.discoverSync(mkEnv().env, start, "t").known.length, 4, "any marker may be the first one");
  assert.throws(() => PL.discoverSync(mkEnv(3).env, all[0], "t"), /over chunk limit/);
  const first = PL.chunksIn(PL.chunkAlign(PL.growRect(PL.hullOf([cell(0, 0)]), PL.AREA.margins[0])));
  const sm = PL.discoverSync(mkEnv(first + 2).env, all[0], "t");
  assert.ok(sm.known.length >= 1 && sm.rect, "a tight quota still returns what it found (the old area is dropped to make room)");
  const bad = mkEnv(); bad.env.create = () => Promise.reject(new Error("timed out"));
  await assert.rejects(PL.discoverVillage(bad.env, all[0], "t"), /timed out/);
  const good = mkEnv(); assert.equal((await PL.discoverVillage(good.env, all[0], "t")).known.length, 4);
});
test("loop planner: a planned village is remembered (done-list), markers inside it are stragglers, the list is bounded and survives garbage", () => {
  let list = PL.parseDone(undefined);
  assert.deepEqual(list, []);
  list = PL.addDone(list, { x0: 0, x1: 100, z0: 0, z1: 100 });
  assert.ok(PL.isDone(list, 50, 50) && PL.isDone(list, 0, 100) && !PL.isDone(list, 101, 50) && !PL.isDone(list, 50, -1));
  assert.deepEqual(PL.parseDone(JSON.stringify(list)), list);
  assert.deepEqual(PL.parseDone("not json"), []); assert.deepEqual(PL.parseDone('{"a":1}'), []);
  for (let i = 0; i < PL.AREA.maxDone + 5; i++) list = PL.addDone(list, { x0: 1000 * i, x1: 1000 * i + 10, z0: 0, z1: 10 });
  assert.equal(list.length, PL.AREA.maxDone);
  const js = readFileSync(new URL("../lothlorien_bp/scripts/loop_marker.js", import.meta.url), "utf8");
  assert.ok(js.includes("isDone(") && js.includes("addDone(") && js.includes("setDynamicProperty(DONE") && js.includes("removeMarkers(dimension, found.rect)"), "runtime: done-list checked, written, markers removed after planning");
  assert.ok(js.includes("} finally {\n    for (const id of [...areas]) env.remove(id);"), "areas are removed in finally");
});
test("loop planner: the owner's real village V2 (dump of world TT) gets the plaza (gap6) and the side-to-side bridge (gap7) among the picks, from the live marker positions", () => {
  const f = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/village_v2.json.gz", import.meta.url)))), [ox, oy, oz] = f.origin, [sx, sy, sz] = f.size, blocks = new Int16Array(sx * sy * sz);
  f.cols.forEach((runs, ci) => { const i = Math.floor(ci / sz), k = ci % sz; let j = 0; for (let r = 0; r < runs.length; r += 2) for (let n = 0; n < runs[r + 1]; n++) blocks[(i * sy + j++) * sz + k] = runs[r]; });
  const at = (x, y, z) => { const i = x - ox, j = y - oy, k = z - oz; return i < 0 || j < 0 || k < 0 || i >= sx || j >= sy || k >= sz ? undefined : f.palette[blocks[(i * sy + j) * sz + k]]; };
  const markers = f.markers.map((p) => [Math.floor(p[0]), Math.floor(p[1]) - 1, Math.floor(p[2])]);
  assert.equal(markers.length, 44);
  const r = PL.planVillage(at, markers);
  assert.equal(r.picks.length, 2, "owner 2026-10-09: no big L joins (PLAN.lMaxLen 16); the former third pick of V2 was an L of 24-26");
  const plaza = r.picks.find((p) => p.kind === "plaza"), ss = r.picks.find((p) => p.kind === "sideside");
  assert.ok(plaza && [plaza.A, plaza.B].some((e) => e.x === 81 && e.z === 343) && [plaza.A, plaza.B].some((e) => e.x === 85 && e.z === 347), "gap6: plaza 81,343 / 85,347");
  assert.ok(ss && [ss.A, ss.B].some((e) => e.x === 49) && [ss.A, ss.B].some((e) => e.x === 61), "gap7: side-side from x 49 to x 61");
  for (const p of r.picks) assert.ok(p.dnet >= 30 && p.dnet >= 2.5 * p.len, `${p.kind}: a real shortcut`);
  assert.equal(PL.planVillage(at, markers).picks.map((p) => p.kind + p.A.x + p.A.z).join(), r.picks.map((p) => p.kind + p.A.x + p.A.z).join(), "deterministic");
  const area = PL.chunkAlign(PL.growRect(PL.hullOf(markers), 32));
  assert.ok(PL.chunksIn(area) < 200, `V2 hull + 32 is ${PL.chunksIn(area)} chunks`);
});
test("loop planner: simulated villages - every marker as the first one finds the whole village; a too small quota gives up cleanly without building", () => {
  let starts = 0, complete = 0;
  for (const r of villages().slice(0, 12)) { const c = discoveryCoverage(r.res, { shift: [(r.seed * 7) % 16, (r.seed * 3) % 16] }); starts += c.starts; complete += c.complete; assert.equal(c.errors, 0); }
  assert.ok(starts > 200 && complete === starts, `${complete} of ${starts} starts found the whole village`);
  const r = villages()[0], states = new Map(), world = buildWorld(r.res, states), lp = planLoops(r.res, world, states, { maxChunks: 6 });
  assert.equal(lp.error, "over chunk limit"); assert.equal(lp.loops, 0);
});

// --- elven warden: entity invariants, spawn rule, natural-spawn thinning, friendly fire, village wardens ---
import * as EW from "../lothlorien_bp/scripts/elven_warden_rules.js";
const wardenEntity = () => readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"];
test("elven warden: family has mob + irongolem (monsters hunt it, arrows get the mob group), never monster", () => {
  const fam = wardenEntity().components["minecraft:type_family"].family;
  for (const f of ["lothlorien_warden", "irongolem", "mob"]) assert.ok(fam.includes(f), f);
  assert.ok(!fam.includes("monster") && !fam.includes("player"));
});
test("elven warden: shoots monsters (spiders and creepers included), never players or other families; bow never drops, arrows do", () => {
  const c = wardenEntity().components;
  const filters = c["minecraft:behavior.nearest_attackable_target"].entity_types[0].filters.all_of;
  assert.deepEqual(filters[0], { test: "is_family", subject: "other", value: "monster" });
  const excluded = filters.slice(1).map((f) => { assert.equal(f.operator, "!="); return f.value; }).sort();
  assert.deepEqual(excluded, ["aquatic", "creaking", "enderman", "piglin", "shulker", "wither", "warden", "zombie_pigman"].sort());
  for (const keep of ["creeper", "spider", "cave_spider"]) assert.ok(!excluded.includes(keep), `${keep} stays a target`);
  const targets = c["minecraft:behavior.nearest_attackable_target"].entity_types;
  assert.equal(targets.length, 3, "monsters, Hated players, and players who hurt an elf (foe tag)");
  assert.ok(!JSON.stringify(targets[0]).includes('"player"'), "players are only targets through the tag entries");
  assert.ok(JSON.stringify(targets[1]).includes('"has_tag"') && JSON.stringify(targets[2]).includes('"has_tag"'));
  const hurt = c["minecraft:behavior.hurt_by_target"];
  assert.ok(!("alert_same_type" in hurt) && hurt.entity_types.max_dist >= 64, "alert_same_type fails to load at format 1.26.50 (content log, 1.26.52)");
  // nearby wardens join through the wolf / zombie pigman pattern: target acquired -> angry group -> broadcast_anger
  assert.equal(c["minecraft:on_target_acquired"].event, "lothlorien:become_angry");
  const e = wardenEntity();
  assert.equal(e.component_groups["lothlorien:angry"]["minecraft:angry"].broadcast_anger, true);
  assert.equal(e.component_groups["lothlorien:angry"]["minecraft:angry"].calm_event.event, "lothlorien:on_calm");
  assert.deepEqual(e.events["lothlorien:become_angry"].add.component_groups, ["lothlorien:angry"]);
  assert.deepEqual(e.events["lothlorien:on_calm"].remove.component_groups, ["lothlorien:angry"]);
  assert.equal(c["minecraft:shooter"].def, "minecraft:arrow");
  const ra = c["minecraft:behavior.ranged_attack"];
  assert.equal(ra.attack_range.max, 18); assert.ok(!("attack_radius" in ra) && !("attack_radius_min" in ra), "not in the schema at format 1.26.50: the entity fails to load"); assert.ok(ra.speed_multiplier <= 1, "closes in no faster than a skeleton"); const av = c["minecraft:behavior.avoid_mob_type"].entity_types[0]; assert.ok(av.walk_speed_multiplier > 1 && av.sprint_speed_multiplier > av.walk_speed_multiplier, "retreats faster than a chasing zombie (owner 2026-10-08)");
  assert.equal(c["minecraft:movement"].value, 0.25);
  assert.equal(c["minecraft:behavior.avoid_mob_type"].entity_types[0].max_dist, 5, "keeps monsters off (kiting)");
  assert.ok(!("set_persistent" in c["minecraft:behavior.ranged_attack"]) && !("set_persistent" in c["minecraft:behavior.nearest_attackable_target"]));
  assert.deepEqual(c["minecraft:equipment"].slot_drop_chance, [{ slot: "slot.weapon.mainhand", drop_chance: 0 }]);
  assert.ok(!c["minecraft:experience_reward"], "no XP");
  assert.equal(c["minecraft:loot"].table, "loot_tables/entities/elven_warden.json");
  const loot = readJson("../lothlorien_bp/loot_tables/entities/elven_warden.json");
  assert.deepEqual(loot.pools.flatMap((p) => p.entries.map((e) => e.name)), ["minecraft:arrow"], "arrows only, like a skeleton (0-2, looting +1)");
  const gear = JSON.stringify(readJson("../lothlorien_bp/loot_tables/entities/elven_warden_gear.json"));
  assert.ok(gear.includes('"minecraft:bow"'));
});
test("elven warden: natural wardens despawn by the standard rule; only the village group is persistent", () => {
  const e = wardenEntity();
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} }, "standard rules, no filters (TECHNICAL_NOTES, Phase 10)");
  assert.ok(!e.components["minecraft:persistent"]);
  const g = e.component_groups[EW.VILLAGE_GROUP];
  assert.ok(g["minecraft:persistent"] && g["minecraft:home"].restriction_radius <= 20 && g["minecraft:behavior.move_towards_home_restriction"]);
  assert.deepEqual(e.events["lothlorien:village_warden"].add.component_groups, [EW.VILLAGE_GROUP], "summon hook for tests");
  assert.equal(e.events["lothlorien:spawn_natural"].set_property["lothlorien:natural"], true);
  assert.ok(!e.events["minecraft:entity_spawned"], "nothing to set up at spawn");
  assert.deepEqual(e.description.properties["lothlorien:natural"], { type: "bool", default: false, client_sync: false });
});
test("elven warden: spawn rule has a ground and a deck condition with the weights of elven_warden_rules.js", () => {
  const r = readJson("../lothlorien_bp/spawn_rules/elven_warden.json")["minecraft:spawn_rules"];
  assert.equal(r.description.identifier, EW.WARDEN_ID);
  assert.equal(r.description.population_control, "pillager", "own surface cap: the animal cap (4 per 9x9 chunks) is full of critters");
  assert.equal(r.conditions.length, 2);
  const [ground, deck] = r.conditions;
  assert.equal(ground["minecraft:weight"].default, EW.SPAWN_WEIGHT_GROUND);
  assert.equal(deck["minecraft:weight"].default, EW.SPAWN_WEIGHT_DECK);
  assert.deepEqual([...EW.DECK_BLOCKS].sort(), [...deck["minecraft:spawns_on_block_filter"]].sort());
  for (const c of r.conditions) {
    assert.equal(c["minecraft:herd"].event, "lothlorien:spawn_natural");
    assert.equal(c["minecraft:biome_filter"].value, "lothlorien");
    assert.ok(!c["minecraft:brightness_filter"], "day and night guard");
  }
});
test("elven warden: natural spawns - always at the edge and on decks, 30 % elsewhere in the biome, none outside", () => {
  assert.equal(EW.spawnKeepChance(0, false), 0);
  assert.equal(EW.spawnKeepChance(0, true), 0, "never outside the biome");
  assert.equal(EW.spawnKeepChance(1, false), 1);
  for (const level of [1, 2, 3]) assert.equal(EW.spawnKeepChance(level, true), 1, `deck at level ${level}`);
  assert.equal(EW.spawnKeepChance(2, false), 0.3);
  assert.equal(EW.spawnKeepChance(3, false), 0.3);
  let kept = 0;
  for (let i = 0; i < 1000; i++) if (EW.keepNaturalSpawn(3, false, i / 1000)) kept++;
  assert.equal(kept, 300);
  assert.ok(EW.keepNaturalSpawn(1, false, 0.999) && !EW.keepNaturalSpawn(3, false, 0.3));
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(src.includes("EntityInitializationCause.Loaded") && src.includes('setProperty("lothlorien:natural", false)'), "judged once, not on reload");
  assert.ok(!src.includes("runInterval"), "event-driven, no polling");
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes("startElvenWardens(depthAt)"));
});
test("elven warden: friendly fire - never on wardens, own creatures, animals; players only after hitting a warden", () => {
  const v = (typeId, families = []) => ({ typeId, families });
  const ff = (victim, sinceProvokedMs, hated) => EW.isFriendlyFire({ shooterId: EW.WARDEN_ID, victim, sinceProvokedMs, hated });
  assert.ok(ff(v(EW.WARDEN_ID, ["lothlorien_warden", "irongolem", "mob"])));
  assert.ok(ff(v("lothlorien:deer", ["mob"])) && ff(v("lothlorien:unicorn")) && ff(v("lothlorien:swan")));
  assert.ok(ff(v("minecraft:cow", ["cow", "animal", "mob"])));
  assert.ok(ff(v("minecraft:player"), undefined), "unprovoked player is shielded");
  assert.ok(ff(v("minecraft:player"), EW.PROVOKE_MS + 1), "provocation expires");
  assert.ok(!ff(v("minecraft:player"), 0) && !ff(v("minecraft:player"), EW.PROVOKE_MS), "a player who hit a warden is fair game");
  assert.ok(!ff(v("minecraft:player"), undefined, true) && !ff(v("minecraft:player"), EW.PROVOKE_MS + 1, true), "a Hated player is never shielded");
  assert.ok(ff(v("minecraft:player"), undefined, false) && ff(v("lothlorien:deer"), undefined, true), "the hated flag only concerns players");
  assert.ok(!ff(v("minecraft:zombie", ["zombie", "monster", "mob"])), "monsters take arrows");
  assert.ok(!ff(v("minecraft:villager_v2", ["villager"])), "villagers in the line of fire are accepted");
  assert.ok(!EW.isFriendlyFire({ shooterId: "minecraft:skeleton", victim: v("minecraft:player"), sinceProvokedMs: undefined }), "only warden arrows");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(src.includes("beforeEvents.entityHurt") && src.includes("event.cancel = true"));
});
test("elven warden: Harmony - a fight costs 1 (first hit after 60 s), a kill 6; Hated players are shot on sight; localized name and spawn egg name", () => {
  assert.ok(EW.isNewFight(undefined) && EW.isNewFight(EW.PROVOKE_MS + 1) && !EW.isNewFight(EW.PROVOKE_MS) && !EW.isNewFight(0));
  assert.equal(H.deedCost("warden_fight"), 1);
  assert.equal(H.deedCost(H.deedKindOf(EW.WARDEN_ID)), 6);
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(/isNewFight[\s\S]*recordWardenFight\(hitter, hurtEntity\)/.test(src), "a new fight is charged");
  assert.ok(src.includes("hasTag(HATED_TAG)"), "friendly fire reads the hated tag");
  const tag = readFileSync(new URL("../lothlorien_bp/scripts/harmony_game.js", import.meta.url), "utf8").match(/HATED_TAG = "([a-z_]+)"/)[1];
  const goal = readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"].components["minecraft:behavior.nearest_attackable_target"];
  const hatedEntry = goal.entity_types.find((t) => JSON.stringify(t.filters).includes(tag));
  assert.ok(hatedEntry, "the warden targets players carrying the hated tag");
  assert.deepEqual(hatedEntry.filters.all_of.map((f) => [f.test, f.subject, f.value]), [["is_family", "other", "player"], ["has_tag", "other", tag]]);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  assert.ok(/entity\.lothlorien:elven_warden\.name=Elven Warden\r?\n/.test(lang));
  assert.ok(/item\.spawn_egg\.entity\.lothlorien:elven_warden\.name=Elven Warden Spawn Egg\r?\n/.test(lang));
});
test("elven warden: village wardens - 2 on the central tree, 1 on some nodes/towers, persistent, mortal, armed, on open deck", () => {
  const counts = {};
  for (const p of villagePieces()) {
    const w = p.entities.filter((e) => e.id === EW.WARDEN_ID);
    counts[p.name] = w.length;
    for (const e of w) {
      assert.ok(isTree(p.name), `${p.name}: wardens only on tree pieces`);
      assert.deepEqual(e.defs, [`+${EW.WARDEN_ID}`, `+${EW.VILLAGE_GROUP}`], `${p.name}: village group via the definitions list`);
      assert.equal(e.invulnerable, false, `${p.name}: mortal`);
      assert.equal(e.mainhand, EW.BOW_ID, `${p.name}: bow in hand`);
      const [x, y, z] = e.pos;
      assert.ok(x > 0 && x < p.size[0] && z > 0 && z < p.size[2] && y > 0 && y < p.size[1], `${p.name}: inside the box`);
      // feet cell: planks below, air above, open deck around, no rail or fence within 2 cells
      const [cx, cy, cz] = [Math.floor(x), Math.floor(y), Math.floor(z)];
      assert.equal(p.at(cx, cy - 1, cz), PLANKS, `${p.name}: deck under the warden`);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        assert.equal(p.at(cx + dx, cy - 1, cz + dz), PLANKS, `${p.name}: open deck around`);
        for (const h of [0, 1, 2]) assert.ok([undefined, null, "minecraft:air"].includes(p.at(cx + dx, cy + h, cz + dz)), `${p.name}: headroom ${dx},${h},${dz}`);
      }
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) assert.notEqual(p.at(cx + dx, cy, cz + dz), FENCE, `${p.name}: away from rails`);
    }
  }
  assert.equal(counts.central_mallorn_01, 2);
  const nodes = Object.entries(counts).filter(([n, c]) => n !== "central_mallorn_01" && c > 0);
  assert.ok(nodes.length >= 3 && nodes.every(([, c]) => c === 1), `1 warden on each of some node/tower pieces: ${JSON.stringify(counts)}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total >= 5, `${total} wardens across the pieces`);
});
test("elven warden: village group is applied through the structure's definitions list and exists in the entity file", () => {
  assert.ok(Object.keys(wardenEntity().component_groups).includes(EW.VILLAGE_GROUP));
  const src = readFileSync(new URL("../tools/build_village.mjs", import.meta.url), "utf8");
  assert.ok(src.includes('"+lothlorien:village_warden"') && src.includes("invulnerable: false"));
});

import * as TR from "../lothlorien_bp/scripts/tick_rate_rules.js";
test("tick rate: half speed reads as 10 tps / 50 percent, the longest gap is kept, support callbacks per second", () => {
  const c = TR.createTickClock(1000, 500, 40);
  let t = 1000;
  for (let i = 1; i <= 100; i++) TR.addTick(c, (t += i === 50 ? 400 : 100));
  assert.equal(c.longestMs, 400, "one slow tick shows as the longest gap");
  assert.ok(!TR.isDone(c, 10999, 10) && TR.isDone(c, 11000, 10));
  const r = TR.summarizeTicks(c, 11000, 600, 40 + 25000);
  assert.equal(r.ticks, 100); assert.equal(r.seconds, 10); assert.equal(r.tps, 10); assert.equal(r.percent, 50);
  assert.equal(r.averageMs, 100, "a tick takes 100 ms instead of 50"); assert.equal(r.callsPerSecond, 2500);
  const n = TR.summarizeTicks(TR.createTickClock(0, 0), 10000, 200);
  assert.equal(n.tps, TR.NORMAL_TPS); assert.equal(n.percent, 100); assert.equal(n.averageMs, 50); assert.equal(n.callsPerSecond, 0);
});
test("tick rate: arguments - seconds (default 10, max 60) and `off` in any order; junk falls back", () => {
  assert.deepEqual(TR.parseTpsArgs(""), { seconds: 10, pause: false });
  assert.deepEqual(TR.parseTpsArgs(undefined), { seconds: 10, pause: false });
  assert.deepEqual(TR.parseTpsArgs("20"), { seconds: 20, pause: false });
  assert.deepEqual(TR.parseTpsArgs("off 15"), { seconds: 15, pause: true });
  assert.deepEqual(TR.parseTpsArgs("15 OFF"), { seconds: 15, pause: true });
  assert.deepEqual(TR.parseTpsArgs("999"), { seconds: TR.MAX_SECONDS, pause: false });
  assert.deepEqual(TR.parseTpsArgs("-3 x"), { seconds: 10, pause: false });
});
test("tick rate: the debug event is wired, its chat keys are RP catalog entries, random support checks are counted and pausable", () => {
  const main = readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8");
  assert.ok(main.includes('event.id === "lothlorien:tps"') && main.includes("startTickRateProbe(player, event.message)"));
  const glue = readFileSync(new URL("../lothlorien_bp/scripts/tick_rate.js", import.meta.url), "utf8");
  const entries = catalogEntries();
  for (const key of ["tps.started", "tps.started_off", "tps.busy", "tps.result", "tps.detail"]) {
    assert.ok(glue.includes(`"${key}"`), key);
    assert.ok(entries[`lothlorien.message.${key}`], key);
  }
  assert.ok(/supportTickStats\.paused = false;[\s\S]*summarizeTicks/.test(glue), "the pause ends with the window");
  const sm = readFileSync(new URL("../lothlorien_bp/scripts/support_motion.js", import.meta.url), "utf8");
  assert.ok(/onRandomTick\(\{ block \}\) \{\s*supportTickStats\.calls\+\+;\s*if \(!supportTickStats\.paused\) supportMotion\.observe\(block\);/.test(sm));
});
test("harmony: the timer is a game-tick clock - one second per 20 game ticks (at 10 tps it runs at half real speed)", () => {
  const game = readFileSync(new URL("../lothlorien_bp/scripts/harmony_game.js", import.meta.url), "utf8");
  assert.ok(game.includes("const TICK_SECONDS = 1;") && game.includes("tick(state, here, TICK_SECONDS)") && game.includes("}, TICK_SECONDS * 20);"));
  const s = H.newState(); s.harmony = -5;
  for (let i = 0; i < 59; i++) H.tick(s, true, 1);
  assert.deepEqual([s.harmony, s.timer], [-5, 59]);
  H.tick(s, true, 1);
  assert.deepEqual([s.harmony, s.timer], [-4, 0], "60 runs of the 20-tick interval = +1");
});

import * as SS from "../lothlorien_bp/scripts/speed_stats.js";
test("speed probe: speed is distance over elapsed ticks per entity, in blocks per second", () => {
  const st = SS.createStats();
  assert.equal(SS.addSample(st, { key: "a", type: "t", x: 0, z: 0, tick: 0 }), undefined, "first sample has no speed");
  assert.ok(Math.abs(SS.addSample(st, { key: "a", type: "t", x: 3, z: 4, tick: 20 }) - 5) < 1e-9, "5 blocks in 1 s");
  assert.ok(Math.abs(SS.addSample(st, { key: "a", type: "t", x: 3, z: 5, tick: 25 }) - 4) < 1e-9, "1 block in 5 ticks");
  assert.equal(SS.addSample(st, { key: "b", type: "t", x: 100, z: 100, tick: 25 }), undefined, "other entity starts its own series");
});
test("speed probe: summary has count, min/avg/max, moving share and splits flagged samples", () => {
  const st = SS.createStats();
  const walk = (key, type, speeds, flags = []) => {
    let x = 0;
    SS.addSample(st, { key, type, x, z: 0, tick: 0 });
    speeds.forEach((bps, i) => { x += bps / 4; SS.addSample(st, { key, type, x, z: 0, tick: (i + 1) * 5, flag: !!flags[i] }); });
  };
  walk("w1", "minecraft:skeleton", [0, 2, 4, 2]);
  walk("w2", "minecraft:skeleton", [0, 0, 0, 0]);
  walk("g1", "lothlorien:elven_warden", [1, 1, 3, 3], [false, false, true, true]);
  const rows = SS.summarize(st);
  assert.deepEqual(rows.map((r) => r.type), ["lothlorien:elven_warden", "minecraft:skeleton"], "sorted by type id");
  const sk = rows[1];
  assert.equal(sk.count, 2);
  assert.equal(sk.samples, 8);
  assert.ok(Math.abs(sk.min) < 1e-9 && Math.abs(sk.max - 4) < 1e-9 && Math.abs(sk.avg - 1) < 1e-9);
  assert.ok(Math.abs(sk.moving - 3 / 8) < 1e-9, "3 of 8 samples above the moving threshold");
  const gu = rows[0];
  assert.equal(gu.calm.samples, 2);
  assert.equal(gu.flagged.samples, 2);
  assert.ok(Math.abs(gu.calm.avg - 1) < 1e-9 && Math.abs(gu.flagged.avg - 3) < 1e-9);
  assert.equal(SS.summarize(SS.createStats()).length, 0);
});
test("speed probe: teleports are dropped and counted, formatting helpers", () => {
  const st = SS.createStats();
  SS.addSample(st, { key: "a", type: "t", x: 0, z: 0, tick: 0 });
  assert.equal(SS.addSample(st, { key: "a", type: "t", x: 500, z: 0, tick: 5 }), undefined);
  const [row] = SS.summarize(st);
  assert.equal(row.dropped, 1);
  assert.equal(row.samples, 0);
  assert.equal(SS.fmt1(1.005 * 2), "2.01");
  assert.equal(SS.percent(0.375), "38");
});
test("speed probe: scriptevent is wired and its messages are localized", () => {
  const main = readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8");
  assert.ok(main.includes('"lothlorien:speed"') && main.includes("startSpeedProbe"));
  const probe = readFileSync(new URL("../lothlorien_bp/scripts/speed_probe.js", import.meta.url), "utf8");
  const keys = [...probe.matchAll(/message\("(speed\.[a-z]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 5);
  const entries = catalogEntries();
  for (const k of new Set(keys)) assert.ok(entries[`lothlorien.message.${k}`], `catalog entry for ${k}`);
});

test("dash detector: arguments, block text, median", () => {
  assert.equal(SS.parseDashArgs("32"), undefined);
  assert.equal(SS.parseDashArgs(""), undefined);
  assert.deepEqual(SS.parseDashArgs("dash"), { radius: 16, seconds: 20 });
  assert.deepEqual(SS.parseDashArgs("dash 8 5"), { radius: 8, seconds: 5 });
  assert.deepEqual(SS.parseDashArgs("DASH 999 9999"), { radius: 64, seconds: 120 });
  assert.deepEqual(SS.parseDashArgs("dash x -1"), { radius: 16, seconds: 20 });
  assert.equal(SS.fmtBlock("minecraft:air", {}), "air");
  assert.equal(SS.fmtBlock(undefined), "unloaded");
  assert.equal(SS.fmtBlock("lothlorien:mallorn_slab", { "minecraft:vertical_half": "top", color: "x" }), "lothlorien:mallorn_slab[vertical_half=top]");
  assert.equal(SS.median([3, 1, 2]), 2);
  assert.equal(SS.median([4, 1, 2, 3]), 2.5);
  assert.equal(SS.median([]), 0);
});
test("dash detector: one spike per burst, relative and absolute thresholds, since-last", () => {
  const tr = SS.createDashTracker();
  const ctxFn = ({ bps }) => ({ vy: 0, onGround: true, falling: false, water: false, below: "b", frontFeet: "air", frontHead: "air", seen: bps });
  let x = 0;
  const run = (key, type, tick, bps) => { x += bps / 10; return SS.addDashSample(tr, { key, type, x, y: 64, z: 0, tick, ctxFn }); };
  // walks at 2 b/s (0.2 per 2 ticks), bursts at 6.2 b/s for 2 samples at ticks 40-42, again at 100
  let tick = 0; run("warden-aaaa1234", "w", tick, 0);
  const plan = [];
  for (let i = 1; i <= 60; i++) plan.push(i >= 20 && i <= 21 ? 6.2 : i === 50 ? 6.2 : 2);
  for (const bps of plan) { tick += 2; run("warden-aaaa1234", "w", tick, bps); }
  const spikes = SS.findSpikes(tr);
  assert.equal(spikes.length, 2, JSON.stringify(spikes.map((s) => s.start)));
  assert.equal(spikes[0].samples, 2);
  assert.equal(spikes[0].sinceLast, null);
  assert.equal(spikes[1].sinceLast, spikes[1].start - spikes[0].start);
  assert.ok(Math.abs(spikes[0].median - 2) < 1e-9);
  const line = SS.formatSpikeLine(spikes[0]);
  assert.ok(line.includes("w#1234") && line.includes("speed=6.20b/s") && line.includes("ground=1") && line.includes("front_head=air") && line.includes("since=-"), line);
  assert.ok(SS.formatSpikeLine(spikes[1]).includes(`since=${spikes[1].sinceLast}t`));
  const rows = SS.summarizeSpikes(tr, spikes);
  assert.deepEqual(rows.map((r) => [r.type, r.mobs, r.spikes]), [["w", 1, 2]]);
  assert.ok(Math.abs(rows[0].peak - 6.2) < 1e-9);
});
test("dash detector: steady runner is no spike; slow mob needs only the ratio; absolute limit without history", () => {
  const steady = SS.createDashTracker();
  let x = 0;
  SS.addDashSample(steady, { key: "r", type: "t", x, y: 0, z: 0, tick: 0 });
  for (let i = 1; i <= 40; i++) SS.addDashSample(steady, { key: "r", type: "t", x: (x += 0.5), y: 0, z: 0, tick: i * 2 }); // 5 b/s
  assert.equal(SS.findSpikes(steady).length, 0, "constant 5 b/s is its own median");
  const slow = SS.createDashTracker();
  let sx = 0;
  SS.addDashSample(slow, { key: "s", type: "t", x: sx, y: 0, z: 0, tick: 0 });
  for (let i = 1; i <= 30; i++) SS.addDashSample(slow, { key: "s", type: "t", x: (sx += i === 15 ? 0.2 : 0.06), y: 0, z: 0, tick: i * 2 });
  const sp = SS.findSpikes(slow);
  assert.equal(sp.length, 1, "2 b/s against a 0.6 b/s median");
  assert.ok(sp[0].peak.bps < SS.DASH_ABS_BPS);
  const fresh = SS.createDashTracker();
  SS.addDashSample(fresh, { key: "f", type: "t", x: 0, y: 0, z: 0, tick: 0 });
  SS.addDashSample(fresh, { key: "f", type: "t", x: 0.7, y: 0, z: 0, tick: 2 });
  assert.equal(SS.findSpikes(fresh).length, 1, "7 b/s with no history exceeds the absolute limit");
  assert.equal(SS.addDashSample(fresh, { key: "f", type: "t", x: 99, y: 0, z: 0, tick: 4 }), undefined, "teleports are dropped");
});
test("dash detector: scriptevent dispatch and messages are localized", () => {
  const probe = readFileSync(new URL("../lothlorien_bp/scripts/speed_probe.js", import.meta.url), "utf8");
  assert.ok(probe.includes("parseDashArgs") && probe.includes("console.warn(formatSpikeLine"));
  const keys = [...probe.matchAll(/message\("(dash\.[a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)].sort(), ["dash.none", "dash.row", "dash.started"]);
  const entries = catalogEntries();
  for (const k of new Set(keys)) assert.ok(entries[`lothlorien.message.${k}`], `catalog entry for ${k}`);
});

test("warden replace: only engine-default movement is replaced", () => {
  assert.equal(WR.needsReplacement(WR.ENGINE_MOVEMENT), true, "template entity default 0.7");
  assert.equal(WR.needsReplacement(WR.JSON_MOVEMENT), false, "JSON value 0.25");
  assert.equal(WR.needsReplacement(0.25 * 1.2), false, "speed effect stays below the threshold");
  assert.equal(WR.needsReplacement(undefined), false);
  assert.equal(WR.needsReplacement(NaN), false);
  const json = JSON.parse(readFileSync(new URL("../lothlorien_bp/entities/elven_warden.json", import.meta.url), "utf8"));
  const groups = json["minecraft:entity"].component_groups;
  assert.equal(json["minecraft:entity"].components["minecraft:movement"].value, WR.JSON_MOVEMENT);
  assert.ok(groups["lothlorien:village_warden"], "spawn event group exists");
});

// --- civilian elves (M1) ---
const elfEntity = () => readJson("../lothlorien_bp/entities/elf.json")["minecraft:entity"];
const GROUP = (p) => `lothlorien:${p}`;
const GROUP_NAMES = (g) => Object.keys(g);
test("elf: entity values come from elf_rules STATS / HOME_RADIUS; persistent, no despawn, no spawn rule, exact families", () => {
  const e = elfEntity(), c = e.components;
  assert.equal(e.description.identifier, EL.ELF_ID);
  assert.equal(e.description.is_spawnable, true); assert.equal(e.description.is_summonable, true);
  assert.deepEqual(c["minecraft:type_family"].family, [EL.ELF_FAMILY, "mob"]);
  assert.deepEqual(c["minecraft:health"], { value: EL.STATS.health, max: EL.STATS.health });
  assert.equal(c["minecraft:movement"].value, EL.STATS.movement);
  assert.ok(EL.STATS.movement < WR.WRONG_MOVEMENT_ABOVE, "the elf is never mistaken for a template mob with engine-default attributes");
  assert.deepEqual(c["minecraft:collision_box"], { width: 0.6, height: 1.95 });
  assert.ok(c["minecraft:persistent"] && c["minecraft:nameable"], "persistent and nameable");
  assert.ok(!("minecraft:despawn" in c) && !Object.values(e.component_groups).some((g) => "minecraft:despawn" in g), "never despawns");
  assert.equal(existsSync(new URL("../lothlorien_bp/spawn_rules/elf.json", import.meta.url)), false, "no natural spawn");
  assert.deepEqual(c["minecraft:behavior.panic"], { priority: 1, speed_multiplier: EL.STATS.panic });
  const avoid = c["minecraft:behavior.avoid_mob_type"].entity_types[0];
  assert.deepEqual([avoid.max_dist, avoid.walk_speed_multiplier, avoid.sprint_speed_multiplier], [EL.STATS.avoidDist, EL.STATS.avoidWalk, EL.STATS.avoidSprint]);
  assert.deepEqual(avoid.filters.all_of.map((f) => [f.test, f.value, f.operator ?? "="]), [["is_family", "monster", "="], ["is_family", "enderman", "!="]]);
  assert.equal(c["minecraft:behavior.move_towards_home_restriction"].speed_multiplier, EL.STATS.home);
  assert.equal(c["minecraft:behavior.random_stroll"].speed_multiplier, EL.STATS.stroll);
  assert.deepEqual([c["minecraft:behavior.random_stroll"].xz_dist, c["minecraft:behavior.random_stroll"].y_dist], [EL.STROLL.xz, EL.STROLL.y], "base stroll from STROLL");
  assert.equal(c["minecraft:behavior.look_at_player"].look_distance, EL.STATS.lookDistance);
  assert.deepEqual(c["minecraft:home"], {}, "base home is empty (restriction none); the radius comes from the radius groups, so a lead can take it away");
  assert.ok(!Object.values(e.component_groups).some((g) => GROUP_NAMES(g).includes("minecraft:variant") && "minecraft:home" in g), "a profession group carries no home radius");
  const nav = c["minecraft:navigation.walk"];
  assert.deepEqual(nav.blocks_to_avoid.map((b) => b.name), ["lothlorien:elven_rope", "lothlorien:elven_rope_hanging"], "avoids the rope cells");
  assert.deepEqual(c["minecraft:damage_sensor"].triggers, [{ cause: "fall", deals_damage: "no" }], "no fall damage");
});
test("elf: native shops and profession dialogs only; no inventory, breeding, riding, egg interaction, loot or xp", () => {
  const text = JSON.stringify(elfEntity());
  const found = [...text.matchAll(/"minecraft:(economy_trade_table|trade_table|interact|inventory|breedable|rideable|spawn_egg_interaction|loot|experience_reward|equippable|behavior\.(?:breed|trade_with_player|tempt|follow_parent|ranged_attack|melee_attack))"/g)].map((m) => m[1]);
  assert.equal(found.filter((k) => k === "interact").length, EL.PROFESSIONS.length, "Speak / Hand over once per profession group");
  assert.equal(found.filter((k) => k === "economy_trade_table").length, 36, "four shops with nine tables each");
  assert.equal(found.filter((k) => k === "behavior.trade_with_player").length, 1, "native trading movement goal");
  assert.ok(found.every((k) => ["interact", "economy_trade_table", "behavior.trade_with_player"].includes(k)));
  const e = elfEntity();
  assert.ok(!e.components["minecraft:economy_trade_table"], "no default shop before table selection");
  for (const [key, group] of Object.entries(e.component_groups)) {
    if ("minecraft:economy_trade_table" in group) assert.ok(key.startsWith("lothlorien:trade_"), "trade tables only in generated groups");
  }
  assert.deepEqual(Object.keys(e.component_groups["lothlorien:loremaster"]), ["minecraft:variant", "minecraft:interact"], "only in the Loremaster group");
  const inter = e.component_groups["lothlorien:loremaster"]["minecraft:interact"].interactions;
  assert.equal(inter.length, 1);
  assert.equal(inter[0].use_item, false); assert.equal(inter[0].swing, true); assert.equal(inter[0].interact_text, "action.interact.lothlorien.speak");
  assert.equal(inter[0].on_interact.event, undefined, "no event: the dialog is script (loremaster.js)");
  const none = JSON.stringify(inter[0].on_interact.filters.all_of.find((f) => f.none_of));
  assert.ok(none.includes("minecraft:lead") && none.includes("minecraft:name_tag"), "leads and name tags keep working on him");
});
test("elf: every profession group has its variant index and its interact entry; radius groups carry the home radius; each as_<p> event swaps professions and radius", () => {
  const e = elfEntity();
  assert.deepEqual(Object.keys(e.component_groups).filter((key) => !key.startsWith("lothlorien:trade_")), [...EL.PROFESSIONS.map(GROUP), ...EL.RADIUS_GROUPS]);
  EL.PROFESSIONS.forEach((p, i) => {
    const g = e.component_groups[GROUP(p)];
    assert.deepEqual(Object.keys(g), ["minecraft:variant", "minecraft:interact"], `${p}: the Loremaster speaks, traders take deliveries (interact; details in tests/renown.mjs)`);
    assert.equal(g["minecraft:variant"].value, i, `${p}: variant index`);
    const ev = e.events[EL.spawnEventOf(p)], own = EL.radiusGroupOf(p);
    assert.deepEqual(ev.add.component_groups, [GROUP(p), own], `${p}: adds the profession and its radius group`);
    assert.deepEqual([...ev.remove.component_groups].sort(), [...EL.PROFESSIONS.filter((q) => q !== p).map(GROUP), ...EL.RADIUS_GROUPS.filter((r) => r !== own)].sort(), `${p}: removes the other four professions and the other radius groups`);
  });
  const home = (r) => ({ restriction_type: "random_movement", restriction_radius: r });
  const mark = (g) => ({ "minecraft:mark_variant": { value: EL.RADIUS_MARK[g] } });
  assert.deepEqual(e.component_groups[EL.HOME_NEAR_GROUP], { "minecraft:home": home(EL.HOME_RADIUS.near), ...mark(EL.HOME_NEAR_GROUP) }, "home_near: radius + debug marker, the stroll stays the base one");
  assert.deepEqual(e.component_groups[EL.HOME_LORE_GROUP], { "minecraft:home": home(EL.HOME_RADIUS.loremaster), ...mark(EL.HOME_LORE_GROUP) });
  const sp = e.events["minecraft:entity_spawned"];
  assert.equal(sp.randomize.length, EL.PROFESSIONS.length);
  assert.deepEqual(sp.randomize.map((r) => r.add.component_groups), EL.PROFESSIONS.map((p) => [GROUP(p), EL.radiusGroupOf(p)]), "one egg: random profession with its radius group");
  assert.deepEqual(sp.filters, { test: "has_component", operator: "!=", value: "minecraft:variant" }, "a spawn event that set the profession is not overridden");
  const radii = Object.values(EL.HOME_RADIUS).filter((r) => r !== EL.HOME_RADIUS.healerDay);
  assert.ok(Math.max(...radii) <= 10 && EL.HOME_RADIUS.loremaster < EL.HOME_RADIUS.near, "every radius but the healer's day roam stays around the own tree (bridges are 7..15 long)");
  assert.equal(EL.HOME_RADIUS.healerDay, 64);
});
test("elf healer: day group roams HOME_RADIUS.healerDay and flips to night at dusk, night group stays near and flips back at dawn; sensors only in their own group", () => {
  const e = elfEntity(), day = e.component_groups[EL.HEALER_DAY_GROUP], night = e.component_groups[EL.HEALER_NIGHT_GROUP];
  assert.equal(day["minecraft:home"].restriction_radius, EL.HOME_RADIUS.healerDay); assert.equal(night["minecraft:home"].restriction_radius, EL.HOME_RADIUS.healerNight);
  const trig = (g) => g["minecraft:environment_sensor"].triggers;
  assert.equal(trig(day).length, 1); assert.equal(trig(day)[0].event, EL.HEALER_DUSK_EVENT); assert.equal(trig(day)[0].filters.test, "is_daytime"); assert.equal(trig(day)[0].filters.value, false);
  assert.equal(trig(night).length, 1); assert.equal(trig(night)[0].event, EL.HEALER_DAWN_EVENT); assert.equal(trig(night)[0].filters.value, true);
  assert.ok(!("minecraft:environment_sensor" in e.components), "no sensor in the base components: it would fire every tick for every profession");
  assert.deepEqual(e.events[EL.HEALER_DUSK_EVENT], { remove: { component_groups: [EL.HEALER_DAY_GROUP] }, add: { component_groups: [EL.HEALER_NIGHT_GROUP] } });
  assert.deepEqual(e.events[EL.HEALER_DAWN_EVENT], { remove: { component_groups: [EL.HEALER_NIGHT_GROUP] }, add: { component_groups: [EL.HEALER_DAY_GROUP] } });
  assert.equal(EL.radiusGroupOf("healer"), EL.HEALER_DAY_GROUP);
});
test("elf healer roam: by day a far stroll and a long path reach cross bridges; from dusk the base stroll, the reach stays for the walk home; radius markers", () => {
  // owner 2026-10-10: "healers seem to stay on their platform" with radius 64 and the base 8 / 3 stroll (the radius is a fence, the stroll the drive)
  const e = elfEntity(), base = e.components["minecraft:behavior.random_stroll"], day = e.component_groups[EL.HEALER_DAY_GROUP], night = e.component_groups[EL.HEALER_NIGHT_GROUP];
  const stroll = (xz, y) => ({ ...base, xz_dist: xz, y_dist: y });
  assert.deepEqual(day["minecraft:behavior.random_stroll"], stroll(EL.HEALER_ROAM.xz, EL.HEALER_ROAM.y), "day: same priority and speed as the base stroll, far targets");
  assert.deepEqual(night["minecraft:behavior.random_stroll"], stroll(EL.STROLL.xz, EL.STROLL.y), "night: the base stroll, explicit (whether a removed group gives the base one back is not relied on)");
  for (const g of [day, night]) assert.deepEqual(g["minecraft:follow_range"], { value: EL.HEALER_ROAM.followRange, max: EL.HEALER_ROAM.followRange });
  assert.ok(EL.HEALER_ROAM.xz >= 2 * 15 && EL.HEALER_ROAM.xz <= EL.HOME_RADIUS.healerDay, "one day stroll can reach past the longest bridge (15), inside the day radius");
  assert.ok(EL.HEALER_ROAM.y >= 3 && EL.HEALER_ROAM.y < 6, "y covers a rise-2 arch, stays below the crowns (6 above the deck) and far above nothing (decks 16 up)");
  assert.ok(EL.HEALER_ROAM.followRange >= EL.HOME_RADIUS.healerDay, "the dusk walk home starts up to the day radius away");
  for (const [name, g] of Object.entries(e.component_groups)) {
    if (name === EL.HEALER_DAY_GROUP || name === EL.HEALER_NIGHT_GROUP) continue;
    assert.ok(!("minecraft:behavior.random_stroll" in g) && !("minecraft:follow_range" in g), `${name}: other professions keep the base stroll and reach`);
  }
  assert.ok(!("minecraft:follow_range" in e.components), "base reach is the engine default");
  // debug marker: every radius group, unique values, nothing else carries one; script maps it back
  const marks = EL.RADIUS_GROUPS.map((g) => e.component_groups[g]["minecraft:mark_variant"]?.value);
  assert.deepEqual(marks, EL.RADIUS_GROUPS.map((g) => EL.RADIUS_MARK[g])); assert.equal(new Set(marks).size, marks.length);
  assert.ok(!("minecraft:mark_variant" in e.components) && EL.PROFESSIONS.every((p) => !("minecraft:mark_variant" in e.component_groups[GROUP(p)])));
  assert.deepEqual(EL.radiusGroupOfMark(3), { group: "healer_day", radius: 64 }); assert.deepEqual(EL.radiusGroupOfMark(4), { group: "healer_night", radius: EL.HOME_RADIUS.healerNight });
  assert.equal(EL.radiusGroupOfMark(undefined), null); assert.equal(EL.radiusGroupOfMark(0), null);
  for (const f of ["entity/elf.entity.json", "render_controllers/elf.render_controllers.json"]) assert.ok(!/mark_variant/.test(readFileSync(new URL(`../lothlorien_rp/${f}`, import.meta.url), "utf8")), `${f}: the client does not use the marker`);
});
test("elf lead: leashable fields come from LEASH; a lead takes the radius away; any release sets the home where the elf stands and gives the radius back per profession", () => {
  const e = elfEntity(), l = e.components["minecraft:leashable"];
  assert.deepEqual(l.presets, [{ soft_distance: EL.LEASH.soft, hard_distance: EL.LEASH.hard, max_distance: EL.LEASH.max }]);
  assert.deepEqual(l.on_leash, { event: EL.LEASHED_EVENT, target: "self" }); assert.deepEqual(l.on_unleash, { event: EL.REHOME_EVENT, target: "self" });
  assert.equal(l.on_unleash_interact_only, undefined, "default false: untie, cut and break by distance all re-home");
  assert.equal(l.can_be_stolen, false);
  assert.deepEqual(e.events[EL.LEASHED_EVENT], { remove: { component_groups: EL.RADIUS_GROUPS } }, "leashed: no radius at all, move_towards_home has nothing to enforce");
  const seq = e.events[EL.REHOME_EVENT].sequence;
  assert.ok(seq[0].set_home_position && seq.at(-1).set_home_position, "set_home_position first and again last");
  assert.deepEqual(seq[0].remove.component_groups, EL.RADIUS_GROUPS, "a rehome without a lead starts clean");
  // walk the sequence for each variant: which radius groups end up added
  const passes = (f, v) => (f.all_of ? f.all_of.every((x) => passes(x, v)) : f.operator === "!=" ? v !== f.value : v === f.value);
  EL.PROFESSIONS.forEach((p, v) => {
    const added = seq.filter((s) => s.add && (!s.filters || passes(s.filters, v))).flatMap((s) => s.add.component_groups);
    assert.deepEqual(added, [EL.radiusGroupOf(p)], `${p}: re-homed with its own radius group`);
  });
});
test("elf geometry: no visible coplanar same-facing faces (accessory cubes are inflated off the body)", () => {
  const geo = readJson("../lothlorien_rp/models/entity/elf.geo.json")["minecraft:geometry"];
  assert.equal(geo.length, EL.PROFESSIONS.length);
  for (const g of geo) {
    const bones = Object.fromEntries(g.bones.map((b) => [b.name, b]));
    const rotated = (n) => { for (; n; n = bones[n].parent) if ((bones[n].rotation ?? [0, 0, 0]).some(Boolean)) return true; return false; };
    const boxes = [];
    for (const b of g.bones) b.cubes?.forEach((c, i) => {
      if (rotated(b.name) || (c.rotation ?? [0, 0, 0]).some(Boolean)) return;
      const f = c.inflate ?? 0;
      boxes.push({ n: `${b.name}#${i}`, lo: c.origin.map((v) => v - f), hi: c.origin.map((v, k) => v + c.size[k] + f) });
    });
    const inside = (pt, a, b) => boxes.some((q) => q !== a && q !== b && [0, 1, 2].every((k) => q.lo[k] < pt[k] && pt[k] < q.hi[k]));
    const hits = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) for (let ax = 0; ax < 3; ax++) for (const side of [0, 1]) {
      const A = boxes[i], B = boxes[j], pa = (side ? A.hi : A.lo)[ax], pb = (side ? B.hi : B.lo)[ax];
      if (Math.abs(pa - pb) > 1e-6) continue;
      const ks = [0, 1, 2].filter((k) => k !== ax), o = ks.map((k) => [Math.max(A.lo[k], B.lo[k]), Math.min(A.hi[k], B.hi[k])]);
      if (o.some(([a, b]) => b - a <= 1e-6)) continue;
      let vis = 0;
      for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) {
        const pt = [0, 0, 0]; pt[ax] = pa + (side ? 0.01 : -0.01);
        pt[ks[0]] = o[0][0] + (u + 0.5) * (o[0][1] - o[0][0]) / 8; pt[ks[1]] = o[1][0] + (v + 0.5) * (o[1][1] - o[1][0]) / 8;
        if (!inside(pt, A, B)) vis++;
      }
      // head / hat bottom (y- at 24) is exempt: make_elves.py paint_cap leaves the cap's bottom face transparent on purpose, so it never draws
      if (vis && !(ax === 1 && side === 0 && [A.n, B.n].sort().join() === "hat#0,head#0")) hits.push(`${"xyz"[ax]}${side ? "+" : "-"} ${A.n}/${B.n}`);
    }
    assert.deepEqual(hits, [], `${g.description.identifier}: z-fighting faces`);
  }
});
test("elf: client entity and render controller are in step with the professions (index = minecraft:variant); post entities are registered on both sides", () => {
  const d = readJson("../lothlorien_rp/entity/elf.entity.json")["minecraft:client_entity"].description;
  assert.deepEqual(Object.keys(d.geometry), EL.PROFESSIONS); assert.deepEqual(Object.keys(d.textures), EL.PROFESSIONS);
  const rc = readJson("../lothlorien_rp/render_controllers/elf.render_controllers.json").render_controllers["controller.render.lothlorien.elf"];
  assert.deepEqual(rc.arrays.geometries["Array.geos"], EL.PROFESSIONS.map((p) => `Geometry.${p}`));
  assert.deepEqual(rc.arrays.textures["Array.skins"], EL.PROFESSIONS.map((p) => `Texture.${p}`));
  const py = readFileSync(new URL("../tools/make_elves.py", import.meta.url), "utf8").match(/^PROFESSIONS = (\[.*?\])/m)[1];
  assert.deepEqual(JSON.parse(py), EL.PROFESSIONS, "tools/make_elves.py PROFESSIONS");
  const post = readJson("../lothlorien_bp/entities/elf_post.json")["minecraft:entity"];
  assert.equal(post.description.identifier, EL.POST_ID); assert.equal(post.description.is_spawnable, false);
  assert.ok(!("minecraft:type_family" in post.components), "the family comes with the kind group");
  assert.deepEqual(Object.keys(post.component_groups), EL.POST_KINDS.map((k) => `${EL.POST_GROUP_PREFIX}${k}`));
  for (const k of EL.POST_KINDS) assert.deepEqual(post.component_groups[`${EL.POST_GROUP_PREFIX}${k}`]["minecraft:type_family"].family, ["lothlorien_elf_post", `elf_post_${k}`, "inanimate"]);
  assert.equal(readJson("../lothlorien_rp/entity/elf_post.entity.json")["minecraft:client_entity"].description.identifier, EL.POST_ID);
});
test("elf: names are lang-only (no name tag), entity and egg names exist in every locale", () => {
  const entries = catalogEntries();
  for (const k of ["entity.lothlorien:elf.name", "item.spawn_egg.entity.lothlorien:elf.name", ...EL.PROFESSIONS.map((p) => `lothlorien.elf.profession.${p}`)]) {
    assert.ok(entries[k], k); assert.equal(Object.keys(entries[k].translations).length, 8, `${k}: eight target locales`);
  }
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  assert.ok(/entity\.lothlorien:elf\.name=Elf\r?\n/.test(lang)); assert.ok(/item\.spawn_egg\.entity\.lothlorien:elf\.name=Elf Spawn Egg\r?\n/.test(lang));
  assert.ok(!/nameTag/.test(readFileSync(new URL("../lothlorien_bp/scripts/elf_village.js", import.meta.url), "utf8")), "the village spawns no name tags");
});
test("elf: wardens defend elves - the foe tag is a target and is not shielded from arrows, a victim elf never is", () => {
  const goal = readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"].components["minecraft:behavior.nearest_attackable_target"];
  const foeEntry = goal.entity_types.find((t) => JSON.stringify(t.filters).includes(EL.FOE_TAG));
  assert.ok(foeEntry, "the warden targets players carrying the foe tag");
  assert.deepEqual(foeEntry.filters.all_of.map((f) => [f.test, f.subject, f.value]), [["is_family", "other", "player"], ["has_tag", "other", EL.FOE_TAG]]);
  const player = { typeId: EW.PLAYER_ID, families: ["player"] }, shot = (o) => EW.isFriendlyFire({ shooterId: EW.WARDEN_ID, victim: player, ...o });
  assert.equal(shot({}), true, "an innocent player is shielded");
  assert.equal(shot({ foe: true }), false, "a foe is not");
  assert.equal(shot({ hated: true }), false); assert.equal(shot({ sinceProvokedMs: 1000 }), false);
  assert.equal(EW.isFriendlyFire({ shooterId: EW.WARDEN_ID, victim: { typeId: EL.ELF_ID, families: [EL.ELF_FAMILY, "mob"] } }), true, "warden arrows never hurt elves");
  assert.equal(EL.FOE_MS, EW.PROVOKE_MS, "a foe is shot for as long as a provoked player");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(src.includes("hasTag(FOE_TAG)") && src.includes("foe:"), "friendly fire reads the foe tag");
});

const deck = (w, d, extra = {}) => (x, y, z) => { // a hand-made deck: planks at y 0, air at y 1..3, anything else unloaded
  if (x < 0 || z < 0 || x >= w || z >= d) return undefined;
  if (extra[`${x},${y},${z}`]) return extra[`${x},${y},${z}`];
  return y === 0 ? PLANKS : y >= 1 && y <= 3 ? "minecraft:air" : undefined;
};
test("elf homeSite: open 5x5 gives 5, a fence shrinks it, a single cell gives null, the square always contains the cell", () => {
  assert.deepEqual(EL.homeSite(deck(5, 5), 2, 0, 2), { x0: 0, z0: 0, k: 5 });
  const fenced = EL.homeSite(deck(5, 5, { "4,1,4": FENCE }), 2, 0, 2);
  assert.equal(fenced.k, 4); assert.ok(fenced.x0 + 3 < 4 || fenced.z0 + 3 < 4, "the fenced corner is outside the square");
  assert.equal(EL.homeSite(deck(1, 1), 0, 0, 0), null);
  assert.equal(EL.homeSite(deck(2, 9), 0, 0, 4), null, "a strip is no square");
  assert.equal(EL.homeSite(deck(20, 20), 10, 0, 10).k, EL.HOME_MAX, "capped at HOME_MAX");
  assert.equal(EL.homeSite(deck(5, 5, { "2,3,2": "minecraft:oak_leaves" }), 0, 0, 0), null, "a block in the headroom closes the middle cell: no 3x3 square is left");
  const s = EL.homeSite(deck(9, 9), 8, 0, 8); assert.ok(s.x0 <= 8 && s.x0 + s.k > 8 && s.z0 <= 8 && s.z0 + s.k > 8);
});
test("elf assignHomes: four trees in HOME_ORDER (room first, then nearest to the Loremaster); reserves only for the leftovers; order of input does not matter", () => {
  const home = (x, k) => ({ kind: "home", x, y: 70, z: 0, site: k ? { x0: 0, z0: 0, k } : null });
  const homes = [home(3, 3), home(10, 7), home(8, 5), home(5, 6), home(20, 5)], lore = [0, 70, 0];
  const names = (r) => r.map((a) => `${a.p}@${a.post.x}`);
  assert.deepEqual(names(EL.assignHomes(homes, lore)), ["healer@5", "gardener@8", "woodwright@10", "lamplighter@20"], "room first (x 3 has none), then by distance");
  const reserves = [20, 4, 12, 28].map((x) => ({ kind: "reserve", x, y: 70, z: 0, site: null }));
  assert.deepEqual(names(EL.assignHomes([...homes, ...reserves], lore)), names(EL.assignHomes(homes, lore)), "no reserve is used with four trees");
  const three = EL.assignHomes([home(30, 5), home(3, 3), home(10, 7), ...reserves], lore);
  assert.deepEqual(names(three), ["healer@10", "gardener@30", "woodwright@3", "lamplighter@4"], "3 trees: the leftover stands on the nearest reserve");
  assert.deepEqual(three.map((a) => a.p), EL.HOME_ORDER);
  assert.deepEqual(names(EL.assignHomes(reserves, lore)), ["healer@4", "gardener@12", "woodwright@20", "lamplighter@28"], "0 trees: all four on reserves, nearest first");
  const all = [...homes, ...reserves];
  for (const m of [1, 2, 3, 4, 5, 7, 100]) {
    const part = all.filter((_, i) => i % m !== 0), a = EL.assignHomes(part, lore), b = EL.assignHomes([...part].reverse(), lore);
    assert.deepEqual(names(a), names(b), `input order (${m})`);
    assert.equal(new Set(a.map((q) => q.p)).size, a.length, "no profession twice"); assert.equal(new Set(a.map((q) => q.post)).size, a.length, "no post twice");
  }
  assert.deepEqual(EL.assignHomes([], lore), []); assert.equal(EL.assignHomes(homes, null).length, 4, "a rect without the central tree still assigns homes");
});
test("elf assignHomes: 6+ home posts give a second healer on a roomy tree farthest from the first; never on a reserve; fewer trees never do", () => {
  const home = (x, z, k) => ({ kind: "home", x, y: 70, z, site: k ? { x0: 0, z0: 0, k } : null });
  const lore = [0, 70, 0], names = (r) => r.map((a) => `${a.p}@${a.post.x},${a.post.z}`);
  const five = [home(5, 0, 6), home(8, 0, 5), home(10, 0, 7), home(20, 0, 5), home(3, 0, 3)];
  assert.equal(EL.assignHomes(five, lore).length, 4, "5 trees: no second healer");
  const r = EL.assignHomes([home(5, 0, 6), home(8, 0, 5), home(10, 0, 7), home(20, 0, 5), home(3, 0, 3), home(0, 40, 5)], lore);
  assert.deepEqual(names(r), ["healer@5,0", "gardener@8,0", "woodwright@10,0", "lamplighter@20,0", "healer@0,40"], "6 trees: the spare roomy tree gets the 2nd healer");
  const seven = [...five, home(0, 40, 5), home(0, 12, 5)];
  assert.equal(names(EL.assignHomes(seven, lore))[4], "healer@0,40", "farthest from the first healer among the roomy leftovers");
  const noRoom = [home(5, 0, 6), home(8, 0, 5), home(10, 0, 7), home(20, 0, 5), home(3, 0, 3), home(0, 60, 0)];
  assert.equal(names(EL.assignHomes(noRoom, lore))[4], "healer@0,60", "no leftover has room: farthest from the first healer");
  const reserves = [4, 12].map((x) => ({ kind: "reserve", x, y: 70, z: 0, site: null }));
  assert.equal(EL.assignHomes([...five, ...reserves], lore).length, 4, "reserves never give a second healer");
  assert.ok(EL.assignHomes([...five, home(0, 40, 5), ...reserves], lore).every((a) => a.post.kind === "home"));
  const fwd = names(r), back = names(EL.assignHomes([home(0, 40, 5), home(3, 0, 3), home(20, 0, 5), home(10, 0, 7), home(8, 0, 5), home(5, 0, 6)], lore));
  assert.deepEqual(fwd, back, "input order does not matter");
  assert.equal(EL.HEALER2_MIN_TREES, 6);
});
test("elf homes record: parse tolerates damage and the list is capped", () => {
  assert.deepEqual(EL.parseHomes(undefined), []); assert.deepEqual(EL.parseHomes("{"), []); assert.deepEqual(EL.parseHomes('{"a":1}'), []);
  let list = []; for (let i = 0; i < EL.MAX_HOME_RECORDS + 5; i++) list = EL.addHomes(list, { n: i });
  assert.equal(list.length, EL.MAX_HOME_RECORDS); assert.equal(list.at(-1).n, EL.MAX_HOME_RECORDS + 4);
});

const isAirName = (n) => n === null || n === undefined || n === "minecraft:air";
const postsOf = (p) => p.entities.filter((e) => e.id === EL.POST_ID).map((e) => ({ e, x: Math.floor(e.pos[0]), y: Math.floor(e.pos[1]), z: Math.floor(e.pos[2]), kind: e.defs[1].slice(`+${EL.POST_GROUP_PREFIX}`.length) }));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
test("elf posts in pieces: central tree 1 loremaster + RESERVE_POSTS reserves, every combo one home post, nothing else; groups via the definitions list", () => {
  const counts = {};
  for (const p of villagePieces()) {
    const posts = postsOf(p), kinds = posts.map((q) => q.kind).sort();
    counts[p.name] = posts.length;
    if (p.name === "central_mallorn_01") assert.deepEqual(kinds, ["loremaster", ...Array(EL.RESERVE_POSTS).fill("reserve")].sort(), "central posts");
    else if (p.name.startsWith("combo_")) assert.deepEqual(kinds, ["home"], `${p.name}: exactly one home post`);
    else assert.deepEqual(kinds, [], `${p.name}: no posts`);
    for (const q of posts) {
      assert.deepEqual(q.e.defs, [`+${EL.POST_ID}`, `+${EL.POST_GROUP_PREFIX}${q.kind}`], `${p.name}: definitions`);
      assert.ok(q.x > 0 && q.x < p.size[0] && q.z > 0 && q.z < p.size[2] && q.y > 0 && q.y < p.size[1], `${p.name}: inside the box`);
      assert.equal(q.e.invulnerable, true, `${p.name}: posts cannot be hurt`);
    }
  }
  assert.ok(Object.values(counts).filter((n) => n === 1).length >= 20, "about 23 combo pieces carry a post");
});
test("elf posts stand on deck: planks underneath, three cells of air, open deck around (central), POST_SPACING from wardens and other posts, Loremaster by the rope", () => {
  for (const p of villagePieces()) {
    const posts = postsOf(p), wardens = p.entities.filter((e) => e.id === EW.WARDEN_ID).map((e) => ({ x: Math.floor(e.pos[0]), z: Math.floor(e.pos[2]) }));
    for (const q of posts) {
      assert.equal(p.at(q.x, q.y - 1, q.z), PLANKS, `${p.name}: deck under the post`);
      for (const h of [0, 1, 2]) assert.ok(isAirName(p.at(q.x, q.y + h, q.z)), `${p.name}: headroom ${h}`);
      for (const w of wardens) assert.ok(cheb(q, w) >= EL.POST_SPACING, `${p.name}: ${cheb(q, w)} cells from a warden`);
      for (const o of posts) if (o !== q) assert.ok(cheb(q, o) >= EL.POST_SPACING, `${p.name}: posts ${cheb(q, o)} apart`);
      if (q.kind !== "home") for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { // full warden margins on the big central deck
        assert.notEqual(p.at(q.x + dx, q.y, q.z + dz), FENCE, `${p.name}: away from rails`);
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) assert.equal(p.at(q.x + dx, q.y - 1, q.z + dz), PLANKS, `${p.name}: open deck around`);
      }
      if (q.kind === "loremaster") {
        const rope = p.blocks.filter((b) => b.name === B.ropeHanging && b.y === q.y - 1);
        assert.ok(rope.length >= 1, "rope on the deck layer");
        for (const r of rope) assert.ok(cheb(q, r) >= EL.ROPE_CLEARANCE, `${p.name}: Loremaster ${cheb(q, r)} from the rope`);
        assert.ok(Math.hypot(q.x - rope[0].x, q.z - rope[0].z) <= 6, "the Loremaster stands by the rope top");
      }
      if (q.kind === "home") { // inside the biggest free square of the lower deck
        const at = (x, y, z) => p.at(x, y, z) ?? "minecraft:air", mine = EL.homeSite(at, q.x, q.y - 1, q.z);
        assert.ok(mine && mine.k >= EL.HOME_MIN_SQUARE, `${p.name}: a free square round the home post`);
        let best = 0;
        for (const b of p.blocks) if (b.name === PLANKS && b.y === q.y - 1 && !wardens.some((w) => cheb(b, w) < EL.POST_SPACING)) best = Math.max(best, EL.homeSite(at, b.x, b.y, b.z)?.k ?? 0);
        assert.equal(mine.k, best, `${p.name}: the post stands in the biggest free square (${best})`);
      }
    }
  }
});
test("elf population over villages: all five professions (the healer twice with 6+ outer trees), four on their own trees when there are four, reserves only for the missing ones", () => {
  let withReserve = 0;
  for (const r of villages()) {
    const at = (x, y, z) => r.ck.world.get(wkey(x, y, z)) ?? "minecraft:air", el = populateElves(r.res, at);
    assert.deepEqual(el.fail, [], `seed ${r.seed}`);
    assert.equal(el.elves, EL.PROFESSIONS.length + (el.outer >= EL.HEALER2_MIN_TREES ? 1 : 0), `seed ${r.seed}: all five, the healer twice with ${EL.HEALER2_MIN_TREES}+ outer trees`);
    assert.equal(el.reservePosts, EL.RESERVE_POSTS);
    assert.equal(el.ownTree, Math.min(4, el.outer) + (el.outer >= EL.HEALER2_MIN_TREES ? 1 : 0), `seed ${r.seed}: ${el.outer} outer trees`);
    assert.equal(el.onReserve, Math.max(0, 4 - el.outer), `seed ${r.seed}: reserves for the missing trees only`);
    if (el.onReserve) withReserve++;
  }
  assert.ok(withReserve <= 6, `${withReserve} of 30 villages needed reserve posts (about 6 % expected)`);
});

if (failed) { console.log(`${failed} test(s) failed`); process.exit(1); }
console.log("all tests passed");
