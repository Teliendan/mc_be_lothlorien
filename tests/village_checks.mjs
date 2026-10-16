// Village checks and the hidden light layer (WP1 of the M7 showcase; style guide docs/design/village_style.md sections 2 (principle 10), 5, 8):
// keep-clear cells + deco(), supportCheck, waterCheck, hidden lights, light model, rotateStates of vanilla orientation states, sim check().
// Everything here is generator / simulator logic; none of it is verified in game (2026-10-14).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { keepClearCells, keepClearViolations, deco, supportCheck, waterCheck, placementFilter } from "../tools/village_checks.mjs";
import { EMITTERS, emission, lightBlock, isLightBlock, lightField, worstLight, addHiddenLights, walkCells, buildTree, SHAPES, FLOOR_H, LEVEL_H, RING, stairLayer, RAIL, LIGHT_TARGET } from "../tools/village_mallorn.mjs";
import * as spawnApi from "../tools/village_mallorn.mjs";
import { rotateStates, loadVillageData, simulate, check, parseMcstructure } from "../tools/village_sim.mjs";
import { rotateBlocks } from "../tools/village_combo.mjs";
import { checkWalk, defaultCollision } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";

let failed = 0;
function test(name, fn) { try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); } }
const key = (x, y, z) => `${x},${y},${z}`;
const PL = "lothlorien:mallorn_planks", LOG = "lothlorien:mallorn_log", LANT = "lothlorien:elven_lantern";
const blk = (name, states = {}) => ({ name, states });
const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
// a flat deck of planks (size x size, centre at 0,0, deck layer y 0), 3 cells of air above it
function flatDeck(half = 4, y = 0) {
  const b = new Map();
  for (let x = -half; x <= half; x++) for (let z = -half; z <= half; z++) { b.set(key(x, y, z), blk(PL)); for (let h = 1; h <= 3; h++) b.set(key(x, y + h, z), blk("minecraft:air")); }
  return b;
}
const boxOf = (half = 4) => ({ x0: -half, x1: half, y0: -3, y1: 5, z0: -half, z1: half });
const nameAtOf = (b) => (x, y, z) => b.get(key(x, y, z))?.name;

// ---- light model and the walk checker -------------------------------------------------------------------------------------
test("hidden light: ids, levels and the one emitter table (mod emitters equal their block JSON, vanilla by the style guide)", () => {
  for (const [id, level] of Object.entries(EMITTERS)) if (id.startsWith("lothlorien:")) {
    assert.equal(readJson(`../lothlorien_bp/blocks/${id.slice(11)}.json`)["minecraft:block"].components["minecraft:light_emission"], level, id);
  }
  for (let n = 0; n <= 15; n++) assert.equal(emission(`minecraft:light_block_${n}`), n);
  assert.deepEqual([0, 1, 2, 3].map((c) => emission("minecraft:sea_pickle", { cluster_count: c })), [6, 9, 12, 15]);
  assert.equal(emission("minecraft:sea_pickle", { cluster_count: 3, dead_bit: true }), 0);
  assert.equal(emission("minecraft:white_candle", { candles: 2, lit: true }), 9, "lit candles: 3 per candle");
  assert.equal(emission("minecraft:white_candle", { candles: 2, lit: false }), 0);
  assert.equal(emission("minecraft:white_candle"), 0, "no state reader: the safe value (unlit)");
  assert.equal(emission("lothlorien:mallorn_planks"), 0);
  assert.ok(isLightBlock("minecraft:light_block_8") && !isLightBlock("minecraft:light_block") && !isLightBlock(LANT));
  assert.ok(emission("minecraft:verdant_froglight") === 15 && emission("minecraft:end_rod") === 14 && emission("minecraft:cave_vines_body_with_berries") === 14);
});
test("hidden light: a light block lights a walk cell, passes through light-transparent decor, and is walkable (no collision, no headroom violation)", () => {
  const b = flatDeck();
  b.set(key(0, 3, 0), lightBlock(15)); // deck + 3 over the centre
  const r = worstLight(nameAtOf(b), boxOf(), (x, y, z) => b.get(key(x, y, z))?.states);
  assert.ok(r.cells > 40 && r.worst >= 0, "walk cells counted");
  const L = lightField(nameAtOf(b), boxOf());
  assert.equal(L.get(key(0, 1, 0)), 13, "two steps under a level-15 light");
  assert.equal(L.get(key(0, 3, 0)), 15);
  // a banner / carpet / candle / pot between the light and the cell does not stop the light; a log does
  const c = flatDeck(); c.set(key(0, 3, 0), lightBlock(15)); c.set(key(0, 2, 0), blk("minecraft:white_banner")); c.set(key(0, 1, 0), blk("minecraft:white_carpet"));
  assert.equal(lightField(nameAtOf(c), boxOf()).get(key(0, 1, 0)), 13);
  const d = flatDeck(); d.set(key(0, 3, 0), lightBlock(15)); d.set(key(0, 2, 0), blk(LOG));
  assert.ok((lightField(nameAtOf(d), boxOf()).get(key(0, 1, 0)) ?? 0) < 13, "a log stops it");
  // collision: light blocks and hanging decor do not collide, so a light at +3 leaves the headroom intact
  for (const n of ["minecraft:light_block_15", "minecraft:light_block_0", "minecraft:pale_hanging_moss", "minecraft:cave_vines_body_with_berries", "minecraft:glow_lichen", "minecraft:wall_banner", "minecraft:spore_blossom"]) assert.equal(defaultCollision(blk(n)), null, n);
  assert.deepEqual(defaultCollision(blk(LOG)), [0, 1]);
  const walkOf = (m) => checkWalk((x, y, z) => m.get(key(x, y, z)), { x0: -4, x1: 4, y0: 0, y1: 4, z0: -4, z1: 4 }, {}).violations;
  assert.equal(walkOf(b).length, 0, "plain deck is clean");
  const withLight = flatDeck(); withLight.set(key(1, 2, 0), lightBlock(15)); withLight.set(key(1, 3, 0), lightBlock(15)); withLight.set(key(1, 1, 0), lightBlock(15));
  assert.equal(walkOf(withLight).length, 0, "light blocks in the body cells do not make a violation");
  // a step (planks, then a bottom slab one cell on: +0.5) with a blocker at +3 over the slab: a log gives a headroom violation, a light block none
  const step = (blocker) => { const m = flatDeck(); m.set(key(0, 1, 0), blk("lothlorien:mallorn_slab", { "minecraft:vertical_half": "bottom" })); for (let h = 2; h <= 3; h++) m.set(key(0, h, 0), blk("minecraft:air")); m.set(key(0, 3, 0), blocker); return m; };
  assert.ok(walkOf(step(blk(LOG))).some((v) => v.rule === "headroom"), "a log over the step is a headroom violation");
  assert.equal(walkOf(step(lightBlock(15))).length, 0, "a light block over the step is not");
  assert.equal(walkCells(nameAtOf(withLight), boxOf()).length, walkCells(nameAtOf(b), boxOf()).length, "a light block in the feet or head cell leaves the walk cell a walk cell");
});
test("addHiddenLights: lights every walk cell to the target with hidden blocks only, at deck + 3 or under the deck, lowers levels, respects avoid", () => {
  for (const half of [1, 4, 7]) {
    const b = flatDeck(half), box = { x0: -half, x1: half, y0: -3, y1: 5, z0: -half, z1: half };
    const avoid = (x, y, z) => x === 0 && z === 0; // never over the centre column
    const lights = addHiddenLights(b, box, avoid);
    assert.ok(lights.length >= 1, "at least one light");
    assert.ok(worstLight(nameAtOf(b), box).worst >= LIGHT_TARGET, `half ${half}: every walk cell >= ${LIGHT_TARGET}`);
    for (const l of lights) {
      assert.ok(l.level >= 1 && l.level <= 15);
      assert.ok(isLightBlock(b.get(key(l.x, l.y, l.z)).name), "the block is a light block");
      assert.ok(l.y === 3 || l.y < 0, `light at deck + 3 or under the deck, got y ${l.y}`);
      assert.ok(!avoid(l.x, l.y, l.z));
    }
    const placed = [...b.values()].filter((v) => isLightBlock(v.name)).length;
    assert.equal(placed, lights.length, "no stray (removed) light block is left behind");
    assert.ok(![...b.values()].some((v) => v.name === LANT), "no visible lantern");
  }
  // a tiny deck needs only a dimmed light: 3 x 3, the corner cell is 4 steps from the light at deck + 3
  const small = flatDeck(1), l = addHiddenLights(small, { x0: -1, x1: 1, y0: -3, y1: 5, z0: -1, z1: 1 });
  assert.equal(l.length, 1);
  assert.ok(l[0].level < 15 && l[0].level >= 11, `lowered to ${l[0].level}`);
});
test("village pieces: real lamps plus hidden gap-fill keep every walk cell >= 8", () => {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  let withLights = 0;
  for (const f of readdirSync(dir).filter((q) => q.endsWith(".mcstructure"))) {
    const p = parseMcstructure(readFileSync(new URL(f, dir)), f.replace(".mcstructure", ""));
    const grid = new Map(p.blocks.map(b => [key(b.x, b.y, b.z), b]));
    const nameAt = (x, y, z) => p.at(x, y, z) ?? undefined;
    const r = worstLight(nameAt, { x0: 0, x1: p.size[0] - 1, y0: 0, y1: p.size[1] - 1, z0: 0, z1: p.size[2] - 1 }, (x,y,z) => grid.get(key(x,y,z))?.states);
    if (!r.cells) continue;
    assert.ok(r.worst >= LIGHT_TARGET, `${p.name}: walk cell ${r.at} has light ${r.worst}`);
    if (p.blocks.some((q) => isLightBlock(q.name))) withLights++;
  }
  assert.ok(withLights > 0, `${withLights} pieces still need hidden gap-fill`);
});

// ---- keep-clear cells and deco() -----------------------------------------------------------------------------------------------
const nodeB = () => buildTree({ pool: "p", upPool: "u", trunk: "square3", seed: 22022, levels: [{ rows: SHAPES.octagon15, conn: [{ facing: "west", off: 1 }, { facing: "east", off: -1 }, { facing: "south", off: 0 }] }] });
test("keepClearCells: the corridor of every connector (3 wide, 4 deep), the main path to the walk ring, the ring, the trunk is not in it", () => {
  const t = nodeB(), D = FLOOR_H;
  assert.ok(t.keep.size > 50);
  for (const c of t.connectors) {
    const d = c.d, p = [-d[1], d[0]];
    for (let depth = 0; depth < 4; depth++) for (let o = -1; o <= 1; o++) for (let h = 1; h <= 3; h++) {
      assert.ok(t.keep.has(key(c.x - d[0] * depth + p[0] * o, D + h, c.z - d[1] * depth + p[1] * o)), `${c.facing}: corridor cell depth ${depth} off ${o} h ${h}`);
    }
    assert.ok(!t.keep.has(key(c.x + p[0] * 2, D + 1, c.z + p[1] * 2)), "the rail post beside the corridor is not keep-clear");
  }
  for (const [x, z] of [[2, 2], [2, 0], [-2, 1], [0, -2]]) for (let h = 1; h <= 3; h++) assert.ok(t.keep.has(key(x, D + h, z)), `ring cell ${x},${z}`); // Chebyshev distance 2 from a 3 x 3 trunk
  assert.ok(!t.keep.has(key(0, D + 1, 0)), "no trunk cell");
  assert.ok(![...t.keep].some((k) => Number(k.split(",")[1]) < D + 1), "keep-clear cells are over the deck only");
});
test("keepClearCells: two-level tree - the walk ring sits outside the stair (lower deck) and round the railed opening (upper deck); treads have their headroom column; posts and rope", () => {
  const t = buildTree({ pool: "p", upPool: "u", trunk: "square3", seed: 77077, levels: [{ rows: SHAPES.octagon15, conn: [{ facing: "south", off: -1 }, { facing: "west", off: 1 }] }, { rows: SHAPES.octagon15, conn: [{ facing: "north", off: 1, hi: true }], clip: (x, z) => z >= 6 }] });
  const D = FLOOR_H;
  assert.ok(t.keep.has(key(3, D + 1, 0)) && t.keep.has(key(3, D + 2, 0)), "lower deck ring at distance 3");
  assert.ok(t.keep.has(key(4, D + LEVEL_H + 1, 0)), "upper deck ring at distance 4");
  RING.forEach(([x, z], i) => { for (let h = 1; h <= 3; h++) assert.ok(t.keep.has(key(x, D + stairLayer(i) + h, z)), `tread ${i} headroom ${h}`); });
  const k = keepClearCells(new Map(), { posts: [{ x: 5, z: -4 }], rope: { x: 0, z: -3, y: D }, deckY: D });
  assert.ok(k.has(key(5, D + 1, -4)) && k.has(key(5, D + 2, -4)) && !k.has(key(5, D + 3, -4)), "post: +1 and +2");
  assert.ok(k.has(key(0, D + 2, -3)) && k.has(key(0, D + 2, -4)), "rope column and the cell in front of it");
  assert.ok(keepClearViolations(t.blocks, t.keep).length === 0, "the built tree has nothing in its keep-clear cells");
});
test("deco(): put refuses keep-clear cells and non-air targets, can() agrees; keepClearViolations finds a lamp in a corridor, allows carpet and light", () => {
  const b = flatDeck(3), keep = new Set([key(0, 1, 0)]);
  const d = deco(b, keep);
  assert.equal(d.can(0, 1, 0), false, "keep-clear");
  assert.equal(d.can(1, 1, 0), true);
  assert.equal(d.can(1, 0, 0), false, "deck is not air");
  assert.throws(() => d.put(0, 1, 0, blk(LANT)), /keep-clear/);
  assert.throws(() => d.put(1, 0, 0, blk(LANT)), /replace/);
  d.put(1, 1, 0, blk(LANT, { "minecraft:block_face": "up" }));
  assert.equal(b.get(key(1, 1, 0)).name, LANT);
  assert.throws(() => d.put(1, 1, 0, blk(LANT)), /replace/, "twice");
  d.put(5, 1, 5, blk(LANT)); // void target outside the deck: allowed (nothing there)
  const bad = flatDeck(3); bad.set(key(0, 1, 0), blk(LANT));
  assert.equal(keepClearViolations(bad, keep).length, 1, "a lantern in the corridor");
  bad.set(key(0, 1, 0), blk("lothlorien:mallorn_leaf_carpet")); assert.equal(keepClearViolations(bad, keep).length, 0);
  bad.set(key(0, 1, 0), lightBlock(9)); assert.equal(keepClearViolations(bad, keep).length, 0);
});

// ---- supportCheck: nothing floats -------------------------------------------------------------------------------------------------
const why = (b) => supportCheck(b).map((v) => `${v.name}@${v.at}`);
test("supportCheck: lanterns - standing on a rail post or the deck is fine, floating or hanging from air is not, hanging under a block or a cord is fine", () => {
  const b = flatDeck(3);
  b.set(key(3, 1, 0), blk(RAIL, { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false }));
  b.set(key(3, 2, 0), blk(LANT, { "minecraft:block_face": "up" })); // on the post
  b.set(key(0, 1, 0), blk(LANT, { "minecraft:block_face": "up" })); // on the deck
  assert.deepEqual(why(b), []);
  b.set(key(-2, 3, 0), blk(LANT, { "minecraft:block_face": "up" })); // floating
  b.set(key(-1, 3, 1), blk(LANT, { "minecraft:block_face": "down" })); // hangs from air
  assert.deepEqual(why(b).sort(), [`${LANT}@-1,3,1`, `${LANT}@-2,3,0`].sort());
  const c = flatDeck(3);
  c.set(key(0, 4, 0), blk(PL)); c.set(key(0, 3, 0), blk(LANT, { "minecraft:block_face": "down" })); // under a plank
  c.set(key(1, 4, 0), blk(PL)); c.set(key(1, 3, 0), blk("lothlorien:elven_rope_hanging", { "minecraft:cardinal_direction": "north" })); c.set(key(1, 2, 0), blk(LANT, { "minecraft:block_face": "down" })); // under a cord under a plank
  c.set(key(2, 4, 0), blk("lothlorien:mallorn_leaves")); c.set(key(2, 3, 0), blk("lothlorien:elven_chandelier", { "minecraft:block_face": "down" })); // chandelier from a leaf blob
  assert.deepEqual(why(c), []);
  c.set(key(2, 4, 0), blk("minecraft:air")); // the leaf is gone
  assert.deepEqual(why(c), [`lothlorien:elven_chandelier@2,3,0`]);
});
test("supportCheck: wall things (banner, rope, open trapdoor, lichen), hanging plants, soil plants and the placement_filter of mod blocks", () => {
  const b = flatDeck(3);
  for (let y = 1; y <= 4; y++) b.set(key(3, y, 3), blk(LOG)); // a trunk column
  b.set(key(2, 3, 3), blk("minecraft:wall_banner", { facing_direction: 4 })); // faces west (-x), fixed to the log on its east side
  b.set(key(3, 5, 2), blk("minecraft:air"));
  assert.deepEqual(why(b), [], "banner on a log");
  b.set(key(0, 3, 3), blk("minecraft:wall_banner", { facing_direction: 4 })); // nothing behind
  b.set(key(-1, 2, -3), blk("lothlorien:mallorn_trapdoor", { "lothlorien:open": true, "minecraft:cardinal_direction": "north" })); // attached south: nothing
  assert.deepEqual(why(b).sort(), [`lothlorien:mallorn_trapdoor@-1,2,-3`, `minecraft:wall_banner@0,3,3`].sort());
  const m = flatDeck(3);
  m.set(key(0, 4, 0), blk(PL)); m.set(key(0, 3, 0), blk("minecraft:pale_hanging_moss")); m.set(key(0, 2, 0), blk("minecraft:pale_hanging_moss")); // a strand of two
  m.set(key(1, 3, 0), blk("minecraft:pale_hanging_moss")); // from air
  assert.deepEqual(why(m), [`minecraft:pale_hanging_moss@1,3,0`]);
  // a flower pot on a rail post and a plant in a moss planter are fine; a fern or an elanor on planks is not (plants need soil; the mod blocks' placement_filter says so too)
  const f = flatDeck(3);
  f.set(key(0, 1, 0), blk("minecraft:moss_block")); f.set(key(0, 2, 0), blk("minecraft:fern")); f.set(key(0, 3, 0), blk("lothlorien:elanor")); // elanor on a fern: bad
  f.set(key(1, 1, 0), blk("minecraft:moss_block")); f.set(key(1, 2, 0), blk("lothlorien:elanor", { "lothlorien:on_grass": false }));
  f.set(key(2, 1, 0), blk("minecraft:fern")); // on planks
  f.set(key(-1, 1, 0), blk("lothlorien:mallorn_leaf_carpet", { "lothlorien:amount": 2 })); // WP3: leaf drifts on planks are fine (the filter lists planks and heartwood planks)
  f.set(key(-3, 1, -3), blk("minecraft:stone_bricks")); f.set(key(-3, 2, -3), blk("lothlorien:mallorn_leaf_carpet", { "lothlorien:amount": 2 })); // stone bricks: not in the filter
  f.set(key(-2, 1, 0), blk("minecraft:moss_block")); f.set(key(-2, 2, 0), blk("lothlorien:mallorn_leaf_carpet", { "lothlorien:amount": 2 })); // on moss: fine
  assert.deepEqual(why(f).sort(), [`lothlorien:elanor@0,3,0`, `lothlorien:mallorn_leaf_carpet@-3,2,-3`, `minecraft:fern@2,1,0`].sort());
  assert.deepEqual(supportCheck(f, { filters: false }).map((v) => v.name).sort(), ["lothlorien:elanor", "minecraft:fern"], "the leaf carpet on stone bricks is flagged by the filter only");
  assert.ok(placementFilter("lothlorien:mallorn_leaf_carpet") && !placementFilter("lothlorien:mallorn_planks"));
  const carpetOn = placementFilter("lothlorien:mallorn_leaf_carpet")[0].blocks;
  assert.ok(carpetOn.has("lothlorien:mallorn_planks") && carpetOn.has("lothlorien:mallorn_heartwood_planks"), "WP3: leaf drifts stand on planks and heartwood planks");
  const hw = flatDeck(2); hw.set(key(0, 0, 0), blk("lothlorien:mallorn_heartwood_planks")); hw.set(key(0, 1, 0), blk("lothlorien:mallorn_leaf_carpet", { "lothlorien:amount": 3 }));
  assert.deepEqual(why(hw), [], "a leaf drift on a heartwood ring cell");
  // an open trapdoor stands on edge on the block below it (a screen panel on a deck, a planter box) or on the block it is attached to; in the air it is flagged
  const td = flatDeck(2);
  td.set(key(0, 1, 0), blk("lothlorien:mallorn_trapdoor", { "lothlorien:open": true, "minecraft:cardinal_direction": "north" })); td.set(key(0, 2, 0), blk("lothlorien:mallorn_trapdoor", { "lothlorien:open": true, "minecraft:cardinal_direction": "north" })); // a stacked screen
  td.set(key(2, 3, 2), blk("lothlorien:mallorn_trapdoor", { "lothlorien:open": true, "minecraft:cardinal_direction": "north" })); // floating
  assert.deepEqual(why(td), [`lothlorien:mallorn_trapdoor@2,3,2`]);
  // unknown blocks are STAND; tree blocks and structure blocks are skipped
  const u = flatDeck(2); u.set(key(0, 3, 0), blk("minecraft:barrel")); u.set(key(1, 9, 1), blk(LOG)); u.set(key(2, 9, 2), blk("lothlorien:mallorn_leaves")); u.set(key(0, 7, 0), lightBlock(5));
  assert.deepEqual(why(u), [`minecraft:barrel@0,3,0`]);
  assert.ok(supportCheck(new Map([[key(0, 0, 0), blk("minecraft:air")]])).length === 0);
});
test("supportCheck: the village rope hangs on the trunk behind it (cardinal_direction) and the rope fixture with nothing behind is flagged", () => {
  const b = new Map();
  for (let y = 0; y <= 5; y++) b.set(key(0, y, 1), blk(LOG));
  for (let y = 0; y <= 5; y++) b.set(key(0, y, 0), blk("lothlorien:elven_rope_hanging", { "minecraft:cardinal_direction": "north" })); // the log is south of it: behind a rope facing north
  assert.deepEqual(why(b), []);
  b.set(key(3, 2, 0), blk("lothlorien:elven_rope_hanging", { "minecraft:cardinal_direction": "north" }));
  assert.equal(why(b).length, 1);
});

// ---- waterCheck -------------------------------------------------------------------------------------------------------------------------
const water = (depth = 0) => blk(depth ? "minecraft:flowing_water" : "minecraft:water", { liquid_depth: depth });
test("waterCheck: a source on an open floor, a source with an open side and a stream into the open are caught; a closed vessel and a contained trough with a fall are not", () => {
  const floor = flatDeck(3); floor.set(key(0, 1, 0), water());
  assert.ok(waterCheck(floor).length > 0, "a source lying on the floor (vessel rule + it spreads)");
  assert.ok(waterCheck(floor).some((v) => /without a wall/.test(v.detail)) && waterCheck(floor).some((v) => /flows into/.test(v.detail)));
  const vessel = flatDeck(3); // 1-cell basin: planks on the four sides
  vessel.set(key(0, 1, 0), water());
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) vessel.set(key(x, 1, z), blk("lothlorien:mallorn_heartwood_planks"));
  assert.deepEqual(waterCheck(vessel), []);
  const open = flatDeck(3); open.set(key(0, 1, 0), water());
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1]]) open.set(key(x, 1, z), blk(PL)); // the fourth side (0, -1) is open
  assert.ok(waterCheck(open).some((v) => v.at.join() === "0,1,-1"), "flows out of the open side");
  // trough of sources on posts, the last one open towards a declared fall down into a basin: nothing leaks
  const t = new Map();
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) { t.set(key(x, 0, z), blk(PL)); }
  for (let x = 0; x <= 3; x++) { t.set(key(x, 5, 0), water()); t.set(key(x, 4, 0), blk(PL)); for (const z of [-1, 1]) t.set(key(x, 5, z), blk(PL)); } // trough at y 5 on a plank floor at y 4
  t.set(key(-1, 5, 0), blk(PL)); // back wall; the open end is x = 4: fall column
  for (let y = 1; y <= 5; y++) t.set(key(4, y, 0), water(8)); // falling water down to the basin floor at y 0
  assert.ok(waterCheck(t).some((v) => /flows into/.test(v.detail)), "the fall lands on the open deck and spreads: caught");
  for (const [x, z] of [[3, 0], [5, 0], [4, 1], [4, -1]]) { t.set(key(x, 1, z), blk(PL)); } // basin of one cell round the landing at y 1
  t.set(key(4, 1, 0), water()); for (let y = 2; y <= 5; y++) t.set(key(4, y, 0), water(8)); // basin source at y 1, fall above it
  for (const z of [-1, 1]) for (let y = 2; y <= 4; y++) t.set(key(4, y, z), blk(PL)); // the fall is walled
  t.set(key(5, 5, 0), blk(PL)); for (let y = 2; y <= 4; y++) t.set(key(5, y, 0), blk(PL));
  for (const z of [-1, 1]) t.set(key(4, 5, z), blk(PL));
  t.set(key(3, 1, 0), blk(PL));
  for (let y = 2; y <= 4; y++) t.set(key(3, y, 0), blk(PL));
  assert.deepEqual(waterCheck(t), []);
  assert.deepEqual(waterCheck(flatDeck(3)), [], "no water: nothing to report");
  // allowed cells: the declared water may reach them (a channel cell with walls round it); the vessel rule still holds for the source
  const al = flatDeck(3); al.set(key(0, 1, 0), water());
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1], [0, -2]]) al.set(key(x, 1, z), blk(PL));
  assert.ok(waterCheck(al).some((v) => /flows into/.test(v.detail)), "the open side leaks");
  const okd = waterCheck(al, { allowed: new Set([key(0, 1, -1)]) });
  assert.ok(!okd.some((v) => /flows into/.test(v.detail)), "the declared cell may take the water");
  assert.equal(okd.filter((v) => /without a wall/.test(v.detail)).length, 1, "the source's open side is still a vessel-rule violation");
});
test("shipped pieces: support, water and keep-clear checks pass on every piece (the generator throws otherwise); the sim check() reports a floating lantern and a source on a floor in an assembled village", () => {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  for (const f of readdirSync(dir).filter((q) => q.endsWith(".mcstructure"))) {
    const p = parseMcstructure(readFileSync(new URL(f, dir)), f);
    const m = new Map(p.blocks.map((q) => [key(q.x, q.y, q.z), { name: q.name, states: q.states }]));
    assert.deepEqual(supportCheck(m), [], `${f}: support`);
    assert.deepEqual(waterCheck(m), [], `${f}: water`);
  }
  const data = loadVillageData(), res = simulate(data, 3);
  assert.deepEqual(check(data, res).fail, [], "the plain village");
  const dirty = (extra) => ({ ...res, placed: res.placed.map((p, i) => (i === 0 ? { ...p, rp: { ...p.rp, blocks: [...p.rp.blocks, ...extra] } } : p)), start: res.start });
  const at = res.start.rp.blocks.find((q) => q.name === PL && q.y > 10);
  const bad = check(data, dirty([{ x: at.x, y: at.y + 3, z: at.z, name: LANT, states: { "minecraft:block_face": "up" } }]));
  assert.ok(bad.fail.some((f) => /unsupported/.test(f)), `floating lantern: ${bad.fail}`);
  const wet = check(data, dirty([{ x: at.x, y: at.y + 1, z: at.z, name: "minecraft:water", states: { liquid_depth: 0 } }]));
  assert.ok(wet.fail.some((f) => /water/.test(f)), `source on a floor: ${wet.fail}`);
});

// ---- rotateStates: vanilla orientation states turn with the piece -----------------------------------------------------------------
test("rotateStates: facing_direction (2..5 turn N -> E -> S -> W, 0 and 1 stay), weirdo_direction (stairs), direction (beds, doors; trapdoors number like stairs); other namespaces stay", () => {
  const turn = (n, s, k = 1) => { let st = s; for (let i = 0; i < k; i++) st = rotateStates(n, st); return st; };
  assert.deepEqual([2, 5, 3, 4].map((f) => turn("minecraft:wall_banner", { facing_direction: f }).facing_direction), [5, 3, 4, 2]);
  assert.equal(turn("minecraft:end_rod", { facing_direction: 0 }).facing_direction, 0);
  assert.equal(turn("minecraft:end_rod", { facing_direction: 1 }).facing_direction, 1);
  assert.equal(turn("minecraft:ladder", { facing_direction: 2 }, 4).facing_direction, 2, "four turns are the identity");
  assert.deepEqual([0, 1, 2, 3].map((w) => turn("minecraft:oak_stairs", { weirdo_direction: w, "minecraft:vertical_half": "top" }).weirdo_direction), [2, 3, 1, 0], "east -> south, west -> north, south -> west, north -> east");
  assert.equal(turn("minecraft:oak_stairs", { weirdo_direction: 0, "minecraft:vertical_half": "top" })["minecraft:vertical_half"], "top");
  assert.deepEqual([0, 1, 2, 3].map((d) => turn("minecraft:white_bed", { direction: d, head_piece_bit: true }).direction), [1, 2, 3, 0], "south -> west -> north -> east");
  assert.equal(turn("minecraft:white_bed", { direction: 1, head_piece_bit: true }).head_piece_bit, true);
  assert.deepEqual([0, 1, 2, 3].map((d) => turn("minecraft:oak_trapdoor", { direction: d, open_bit: true }).direction), [2, 3, 1, 0], "trapdoors: 0 east, 1 west, 2 south, 3 north");
  assert.deepEqual([0, 1, 2, 3].map((d) => turn("minecraft:oak_door", { direction: d }).direction), [1, 2, 3, 0], "doors: east -> south -> west -> north");
  for (const n of ["minecraft:oak_stairs", "minecraft:oak_trapdoor", "minecraft:white_bed"]) for (let d = 0; d < 4; d++) {
    const st = n.endsWith("stairs") ? { weirdo_direction: d } : { direction: d };
    assert.deepEqual(turn(n, st, 4), st, `${n} ${d}: four turns`);
  }
  assert.deepEqual(turn("lothlorien:something", { facing_direction: 2, direction: 0, weirdo_direction: 1, "lothlorien:face": "north" }), { facing_direction: 5, direction: 0, weirdo_direction: 1, "lothlorien:face": "north" }, "custom states and non-minecraft integer states stay");
  assert.deepEqual(turn("minecraft:oak_log", { "minecraft:block_face": "north", "minecraft:cardinal_direction": "east" }), { "minecraft:block_face": "east", "minecraft:cardinal_direction": "south" }, "the existing string states still turn");
  // the combo's jigsaw path and rotateStates agree
  const jig = new Map([[key(1, 0, 0), { name: "minecraft:jigsaw", states: { facing_direction: 2, rotation: 0 } }], [key(0, 1, 0), { name: "minecraft:wall_banner", states: { facing_direction: 3 } }]]);
  const r = rotateBlocks(jig, 1);
  assert.equal(r.get(key(0, 0, 1)).states.facing_direction, 5, "jigsaw north -> east");
  assert.equal(r.get(key(0, 1, 0)).states.facing_direction, 4, "banner south -> west");
});


// ---- WP3: dressing (village_dress.mjs) ------------------------------------------------------------------------------------------------
import { homeFrame, frameCell, frameInterior, frameDoorLane, framePost, frameLamp, frameArea, rotateFrame, relinkFences } from "../tools/village_dress.mjs";
test("homeFrame: a pavilion square on open deck against a trunk face; frame helpers: interior, door lane, post, lamp, furnishing area, rotation", () => {
  const t = buildTree({ pool: "p", upPool: "u", trunk: "square3", seed: 22022, levels: [{ rows: SHAPES.octagon15, conn: [{ facing: "west", off: 1 }, { facing: "east", off: -1 }, { facing: "south", off: 0 }] }] });
  const f = t.home;
  assert.ok(f && f.k >= 4, "node_b gets a pavilion");
  const cells = new Set(); for (let u = 0; u < f.k; u++) for (let v = 0; v < f.k; v++) cells.add(frameCell(f, u, v).join(","));
  assert.equal(cells.size, f.k * f.k);
  const [px, pz] = frameCell(f, ...framePost(f));
  assert.ok(frameInterior(f).some(([u, v]) => frameCell(f, u, v).join() === `${px},${pz}`), "the post is an interior cell");
  assert.ok(!frameDoorLane(f).some(([u, v]) => frameCell(f, u, v).join() === `${px},${pz}`) && !frameArea(f).some(([u, v]) => frameCell(f, u, v).join() === `${px},${pz}`));
  const [lu, lv] = frameLamp(f), [lx, lz] = frameCell(f, lu, lv);
  assert.equal(t.blocks.get(key(lx, f.y + 3, lz))?.name, "lothlorien:elven_lantern_heartwood", "the marker lantern hangs at +3");
  for (const [u, v] of frameArea(f)) for (const h of [1, 2]) { const [x, z] = frameCell(f, u, v); assert.ok(["minecraft:air"].includes(t.blocks.get(key(x, f.y + h, z))?.name) || /light_block/.test(t.blocks.get(key(x, f.y + h, z))?.name), "furnishing area is free"); assert.ok(t.keep.has(key(x, f.y + h, z)), "and kept clear"); }
  const r = rotateFrame(f, 1, 5, 7), [rx, rz] = frameCell(r, 1, 2), [ox, oz] = frameCell(f, 1, 2);
  assert.deepEqual([rx, rz], [-oz + 5, ox + 7], "a quarter turn clockwise (x, z) -> (-z, x), then moved");
  // keep-clear and the pavilion never collide
  assert.deepEqual(keepClearViolations(t.blocks, t.keep), []);
});
test("dressTree: every connector has lamp posts within the budget, banners hang on the trunk, nothing outside the box, no leaf within 3 above the deck, no pocket", () => {
  const t = nodeB();
  const lanterns = [...t.blocks].filter(([k, b]) => b.name === LANT && b.states["minecraft:block_face"] === "up");
  assert.ok(lanterns.length >= 3 && lanterns.length <= 6, `${lanterns.length} standing lamps`);
  assert.ok([...t.blocks.values()].some((b) => b.name === "minecraft:wall_banner" && b.banner), "banners carry their pattern data");
  for (const k of t.blocks.keys()) { const [x, y, z] = k.split(",").map(Number); assert.ok(Math.abs(x) <= t.box.hx && Math.abs(z) <= t.box.hz, `${k} inside the box`); }
  for (const [k, b] of t.blocks) if (b.name === "lothlorien:mallorn_leaves") { const [x, y, z] = k.split(",").map(Number); for (let h = 1; h <= 3; h++) assert.notEqual(t.blocks.get(key(x, y - h, z))?.name, PL, `leaf ${h} above a deck at ${k}`); }
  assert.deepEqual(supportCheck(t.blocks), []);
});
test("relinkFences: fences side by side link both ways without touching a shared block object", () => {
  const F = "lothlorien:mallorn_fence", st = () => ({ "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false });
  const shared = { name: F, states: st() }, m = new Map([[key(0, 5, 0), shared], [key(0, 5, 1), blk(F, st())]]);
  relinkFences(m);
  assert.equal(m.get(key(0, 5, 0)).states["minecraft:connection_south"], true);
  assert.equal(m.get(key(0, 5, 1)).states["minecraft:connection_north"], true);
  assert.equal(shared.states["minecraft:connection_south"], false, "the original object is untouched");
});

test("supportCheck (WP3 revision): a wall banner needs a full block behind it (log, stripped log, planks), not a fence; upside-down eave stairs lean on the roof beside them", () => {
  const b = flatDeck(3);
  b.set(key(0, 1, 0), blk("lothlorien:mallorn_stripped_log", { "minecraft:block_face": "up" })); b.set(key(1, 1, 0), blk("minecraft:wall_banner", { facing_direction: 5 })); // faces east, hangs on the log at x 0
  b.set(key(0, 1, 2), blk("lothlorien:mallorn_fence")); b.set(key(1, 1, 2), blk("minecraft:wall_banner", { facing_direction: 5 })); // on a fence
  assert.deepEqual(why(b), [`minecraft:wall_banner@1,1,2`]);
  const e = new Map(); // an eave: stairs at +4 beside a roof log and a leaf, one far from any roof
  e.set(key(0, 4, 0), blk(LOG, { "minecraft:block_face": "east" })); e.set(key(-1, 4, 0), blk("lothlorien:mallorn_stairs", { "minecraft:cardinal_direction": "east", "minecraft:vertical_half": "top" }));
  e.set(key(5, 4, 5), blk("lothlorien:mallorn_stairs", { "minecraft:cardinal_direction": "east", "minecraft:vertical_half": "top" }));
  assert.deepEqual(why(e), [`lothlorien:mallorn_stairs@5,4,5`]);
});

test("shipped pieces (review 2026-10-15): no leaf drifts, every wall banner on a full block, standing banners on fences, no lantern hangs lower than deck + 3, stair seats are gone", () => {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  let standing = 0, cushions = 0;
  for (const f of readdirSync(dir).filter((q) => q.endsWith(".mcstructure"))) {
    const p = parseMcstructure(readFileSync(new URL(f, dir)), f.replace(".mcstructure", ""));
    cushions += p.entities.filter((e) => e.id === "minecraft:cushion").length;
    for (const b of p.blocks) {
      assert.ok(!/leaf_carpet|leaf_litter/.test(b.name), `${p.name}: leaf drift ${b.name} at ${b.x},${b.y},${b.z}`);
      if (b.name === "minecraft:wall_banner") { const v = { 2: [0, -1], 3: [0, 1], 4: [-1, 0], 5: [1, 0] }[b.states.facing_direction], q = p.at(b.x - v[0], b.y, b.z - v[1]); assert.ok(/_log$|_wood$|planks$/.test(q ?? ""), `${p.name}: banner on ${q}`); }
      if (b.name === "minecraft:standing_banner") { standing++; assert.match(p.at(b.x, b.y - 1, b.z) ?? "", /fence$/, `${p.name}: standing banner on a fence`); }
      if (/elven_lantern/.test(b.name) && b.states["minecraft:block_face"] === "down") {
        let y = b.y - 1; while (y >= 0 && !/planks$|slab$/.test(p.at(b.x, y, b.z) ?? "")) y--;
        const gap = b.y - y; // lantern cell over a deck block: deck + gap
        if (y >= 0 && gap < 3) assert.ok(/fence$|_log$|planks$|leaves$/.test(p.at(b.x, y + 1, b.z) ?? "") || b.y - y === 0, `${p.name}: lantern hangs ${gap} over the deck at ${b.x},${b.y},${b.z}`);
      }
    }
    if (!/^(central|combo_tower)/.test(p.name)) assert.equal(p.blocks.filter((b) => /mallorn_stairs$/.test(b.name) && b.states["minecraft:vertical_half"] !== "top" && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => p.at(b.x + dx, b.y, b.z + dz) === "minecraft:water")).length, 0, `${p.name}: no stair seats (the walls of a stair basin are no seats)`);
  }
  assert.ok(standing >= 3 && cushions >= 30, `${standing} flags, ${cushions} cushions`);
});

test("spawn-proof (owner 2026-10-16): no spawnable surface (full solid top, two clear cells above) with block light 0 in any shipped piece (from deck - 6 up, crowns entirely: ground and root mobs are fine)", () => {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  const { darkSpawnCells } = spawnApi;
  for (const f of readdirSync(dir).filter((q) => q.endsWith(".mcstructure") && !q.startsWith("railing_end"))) {
    const p = parseMcstructure(readFileSync(new URL(f, dir)), f.replace(".mcstructure", ""));
    const grid = new Map(p.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b]));
    const nameAt = (x, y, z) => grid.get(`${x},${y},${z}`)?.name, stateAt = (x, y, z) => grid.get(`${x},${y},${z}`)?.states;
    const y0 = /^crown/.test(p.name) ? 0 : p.name === "balcony_braced" ? 40 - 6 : 18 + 16 - 6; // crowns entirely; else from deck - 6 (piece y = tree y + 18, the balcony's deck is at piece y 40)
    const dark = darkSpawnCells(nameAt, stateAt, { x0: 0, x1: p.size[0] - 1, y0, y1: p.size[1] - 1, z0: 0, z1: p.size[2] - 1 });
    assert.deepEqual(dark.slice(0, 3), [], `${p.name}: ${dark.length} dark spawnable surfaces`);
  }
});

test("supportCheck (rev4): a standing banner needs its cell and the cell above free; a decorated pot (vase) never stands on a fence; shipped pieces keep to it, lamps keep off fences", () => {
  const b = flatDeck(3);
  b.set(key(0, 1, 0), blk("lothlorien:mallorn_fence")); b.set(key(0, 2, 0), blk("lothlorien:mallorn_fence")); b.set(key(0, 3, 0), blk("minecraft:standing_banner", { ground_sign_direction: 4 }));
  assert.deepEqual(why(b), [], "a standing banner on a 2-high fence post with air above");
  b.set(key(0, 4, 0), blk("lothlorien:mallorn_planks")); // a ceiling right over it
  assert.deepEqual(why(b), [`minecraft:standing_banner@0,3,0`]);
  const v = flatDeck(3);
  v.set(key(1, 1, 1), blk("lothlorien:mallorn_fence")); v.set(key(1, 2, 1), blk("minecraft:decorated_pot")); v.set(key(2, 1, 2), blk("minecraft:decorated_pot"));
  assert.deepEqual(why(v), [`minecraft:decorated_pot@1,2,1`], "the vase on the fence is flagged, the one on the deck is fine");
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  for (const f of readdirSync(dir).filter((q) => q.endsWith(".mcstructure"))) {
    const p = parseMcstructure(readFileSync(new URL(f, dir)), f.replace(".mcstructure", ""));
    for (const q of p.blocks) {
      if (/elven_lantern/.test(q.name)) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(!/fence$/.test(p.at(q.x + dx, q.y, q.z + dz) ?? ""), `${p.name}: lantern at ${q.x},${q.y},${q.z} beside a fence`);
      if (q.name === "minecraft:decorated_pot") assert.ok(!/fence$/.test(p.at(q.x, q.y - 1, q.z) ?? ""), `${p.name}: vase on a fence`);
    }
  }
});

test("waterCheck (stair basin): four mallorn stairs with their tall backs to the water hold a source; a stair turned the wrong way is caught", () => {
  const stair = (facing, half = "bottom") => blk("lothlorien:mallorn_stairs", { "minecraft:cardinal_direction": facing, "minecraft:vertical_half": half });
  const mk = (f) => { const b = flatDeck(3); b.set(key(0, 1, 0), water()); b.set(key(0, 1, -1), stair(f.n)); b.set(key(0, 1, 1), stair(f.s)); b.set(key(1, 1, 0), stair(f.e)); b.set(key(-1, 1, 0), stair(f.w)); return b; };
  assert.deepEqual(waterCheck(mk({ n: "south", s: "north", e: "west", w: "east" })), [], "tall backs toward the water: a closed basin");
  const bad = waterCheck(mk({ n: "north", s: "north", e: "west", w: "east" }));
  assert.equal(bad.length, 1); assert.match(bad[0].detail, /steps toward the water/);
  assert.equal(waterCheck(mk({ n: "south", s: "north", e: "west", w: "east" }).set(key(0, 1, -1), stair("south", "top"))).length, 1, "an upside-down stair is not a basin wall");
});

test("phase 3 dressing in the shipped pieces: lamp cords are green waxed copper chains (vertical, carrying a lantern or a crown lamp), stair basins hold their water with the tall backs inward, towers have a lookout bay, lookouts a seat roof", () => {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  const CHAIN = "minecraft:waxed_oxidized_copper_chain";
  let chains = 0, basins = 0, bays = 0;
  for (const f of readdirSync(dir).filter((q) => q.endsWith(".mcstructure"))) {
    const p = parseMcstructure(readFileSync(new URL(f, dir)), f.replace(".mcstructure", ""));
    const ys = p.blocks.filter((q) => /planks$/.test(q.name)).map((q) => q.y), top = ys.length ? Math.max(...ys) : null;
    for (const q of p.blocks) {
      assert.ok(!/(^|:)(iron_)?chain$/.test(q.name), `${p.name}: iron chain at ${q.x},${q.y},${q.z} (the palette has no black iron: use the waxed oxidized copper chain)`);
      if (q.name === CHAIN) {
        chains++;
        assert.equal(q.states.pillar_axis, "y", `${p.name}: chain is vertical`);
        const up = p.at(q.x, q.y + 1, q.z) ?? "", dn = p.at(q.x, q.y - 1, q.z) ?? "";
        assert.ok(/log|wood|leaves|planks|slab|stairs|chain/.test(up) && !/air$/.test(up), `${p.name}: chain at ${q.x},${q.y},${q.z} hangs from ${up}`);
        assert.ok(/lantern|chain|elven/.test(dn) || /crown_/.test(p.name), `${p.name}: chain at ${q.x},${q.y},${q.z} carries ${dn}`);
      }
      if (q.name === "minecraft:water" && /^combo_/.test(p.name)) {
        basins++;
        for (const [dx, dz, want] of [[1, 0, "west"], [-1, 0, "east"], [0, 1, "north"], [0, -1, "south"]]) {
          const n = p.blocks.find((b) => b.x === q.x + dx && b.y === q.y && b.z === q.z + dz);
          assert.ok(n && /mallorn_stairs$/.test(n.name) && n.states["minecraft:cardinal_direction"] === want && n.states["minecraft:vertical_half"] === "bottom", `${p.name}: basin wall ${dx},${dz} is a stair with its tall back to the water`);
        }
        assert.match(p.at(q.x, q.y - 1, q.z) ?? "", /planks/, `${p.name}: the basin stands on a solid deck floor`);
      }
    }
    if (/^combo_tower_/.test(p.name)) { // the upper deck: cushions and a slab roof (+3) in the bay
      const cu = p.entities.filter((e) => /cushion/.test(e.id) && e.pos[1] > top - 0.5);
      assert.ok(cu.length >= 2, `${p.name}: lookout bay cushions on the upper deck (${cu.length})`); bays++;
      assert.ok(p.blocks.some((b) => /slab$/.test(b.name) && b.states["minecraft:vertical_half"] === "top" && b.y === top + 3), `${p.name}: the bay has its seat roof (top slabs at +3)`);
    }
    if (p.name === "lookout_01") {
      assert.ok(p.blocks.some((b) => /slab$/.test(b.name) && b.states["minecraft:vertical_half"] === "top" && b.y === top + 3), "lookout: seat roof of top slabs at +3");
      assert.ok(p.blocks.some((b) => /wall_banner/.test(b.name)) && p.blocks.some((b) => /firefly_jar/.test(b.name)) && p.entities.filter((e) => /cushion/.test(e.id)).length >= 2, "lookout: flag, jar, cushions");
    }
  }
  assert.ok(chains >= 12, `lamp cords: ${chains} chain blocks in the pieces`);
  assert.ok(basins >= 3, `stair basins: ${basins}`);
  assert.equal(bays, 6, "every tower combo has its lookout bay");
});

if (failed) throw new Error(`${failed} village check test(s) failed`);
