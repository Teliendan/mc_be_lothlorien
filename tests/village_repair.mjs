// village repair regression tests; run independently or via tests/run.mjs.
import { test, finish } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { PLANKS } from "../tools/village_sim.mjs";
import * as PL from "../lothlorien_bp/scripts/village_planner.js";
import * as RP from "../lothlorien_bp/scripts/village_repair.js";

const LEAF = "lothlorien:mallorn_leaves", AIR = "minecraft:air";
const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
const flat = () => 64;
const HROPE = RP.ROPE_ID, WALLS = { north: [0, 1], south: [0, -1], east: [-1, 0], west: [1, 0] };
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
const deck = (w, d, extra = {}) => (x, y, z) => { // a hand-made deck: planks at y 0, air at y 1..3, anything else unloaded
  if (x < 0 || z < 0 || x >= w || z >= d) return undefined;
  if (extra[`${x},${y},${z}`]) return extra[`${x},${y},${z}`];
  return y === 0 ? PLANKS : y >= 1 && y <= 3 ? "minecraft:air" : undefined;
};

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

test("root flare: findPillar finds the plus-shaped pillar 3 or 4 cells from a marker, and not a 3x3 trunk", () => {
  const w = pillarWorld();
  assert.deepEqual(RP.findPillar(w.at, w.marker), w.pillar);
  assert.deepEqual(RP.findPillar(w.at, [5, 16, 9]), w.pillar, "4 cells away (the 9-wide lookout), another axis");
  assert.deepEqual(RP.findPillar(w.at, [5, 16, 10]), w.pillar, "5 cells away (the 11-wide lookout)");
  assert.equal(RP.findPillar(w.at, [5, 16, 13]), null);
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
  // the repair pass no longer skips it: root down carries the short pillar to the ground first (owner, Test G 2026-10-20), then it flares
  const log = [], out = PL.drive(RP.repairGen(PL.overlay(PL.boundedReader(short.at, { x0: -30, x1: 30, z0: -30, z1: 30 })), [short.marker], { rect: { x0: -30, x1: 30, z0: -30, z1: 30 }, log }));
  assert.ok(out.some((p) => p.kind === "rootdown") && out.some((p) => p.kind === "flare") && !log.some((l) => /^flare 5,5: skipped/.test(l)), log.join("|"));
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

// root down (owner, Test G 2026-10-20): a 3x3 trunk from `bottom` up to y 30 with a 5x5 collar at bottom..bottom+3; terrain: ground(x, z) grass,
// dirt below; water from the ground up to `water` (if given), air above
const TRUNK3 = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) TRUNK3.push([a, b]);
function trunkWorld({ bottom = 10, ground = () => 0, water = null, extra = {} } = {}) {
  const cells = new Map();
  for (let y = bottom; y <= 30; y++) for (const [a, b] of TRUNK3) cells.set(`${a},${y},${b}`, PILLAR_LOG);
  for (let y = bottom; y <= bottom + 3; y++) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) cells.set(`${a},${y},${b}`, PILLAR_LOG);
  for (const [k, v] of Object.entries(extra)) cells.set(k, v);
  const at = (x, y, z) => {
    if (Math.abs(x) > 40 || Math.abs(z) > 40) return undefined;
    const v = cells.get(`${x},${y},${z}`); if (v !== undefined) return v === "UNLOADED" ? undefined : v;
    const g = ground(x, z);
    return y < g ? "minecraft:dirt" : y === g ? "minecraft:grass_block" : water !== null && y <= water ? "minecraft:water" : "minecraft:air";
  };
  return { at, cells: TRUNK3.map(([a, b]) => [a, b]) };
}
const faceLinked = (blocks, base) => { // every new log reaches the trunk through face-adjacent logs
  const all = new Set([...blocks.map((b) => `${b.x},${b.y},${b.z}`), ...base]), seen = new Set(base), todo = [...base];
  while (todo.length) { const [x, y, z] = todo.pop().split(",").map(Number); for (const [a, b, c] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) { const k = `${x+a},${y+b},${z+c}`; if (all.has(k) && !seen.has(k)) { seen.add(k); todo.push(k); } } }
  return blocks.every((b) => seen.has(`${b.x},${b.y},${b.z}`));
};
const trunkBase = (bottom) => { const out = []; for (let y = bottom; y <= 30; y++) for (const [a, b] of TRUNK3) out.push(`${a},${y},${b}`); for (let y = bottom; y <= bottom + 3; y++) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) out.push(`${a},${y},${b}`); return out; };

test("root down: a trunk planted in the ground is left alone", () => {
  const w = trunkWorld({ bottom: -5 }), r = RP.planRootDown(w.at, w.cells, 30);
  assert.equal(r.blocks.length, 0);
});

test("root down: a trunk ending 10 above the ground is carried down at collar width into the top ground block and gets lying roots", () => {
  const w = trunkWorld({ bottom: 10 }), r = RP.planRootDown(w.at, w.cells, 30);
  assert.equal(r.columns, 25); assert.equal(r.drop, 9); assert.equal(r.wet, false);
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let y = 0; y <= 9; y++) assert.ok(r.blocks.some((q) => q.x === a && q.y === y && q.z === b && q.states["minecraft:block_face"] === "up"), `column ${a},${b} at ${y}`);
  const roots = r.blocks.filter((q) => Math.max(Math.abs(q.x), Math.abs(q.z)) > 2);
  assert.ok(r.roots >= 4 && roots.length >= 4, `roots ${r.roots}`);
  assert.ok(roots.every((q) => q.y === 1 && q.states["minecraft:block_face"] !== "up"), "roots lie on the ground");
  assert.ok(faceLinked(r.blocks, trunkBase(10)), "every log is face-linked to the trunk");
  assert.ok(!r.blocks.some((q) => /leaves/.test(q.id)), "no leaves");
});

test("root down: on a cliff each column goes to its own ground, columns on the ground stay, roots follow the terrain within a step", () => {
  const w = trunkWorld({ bottom: 10, ground: (x) => (x >= 1 ? 9 : x >= -1 ? 4 : 0) }), r = RP.planRootDown(w.at, w.cells, 30);
  assert.ok(!r.blocks.some((q) => q.x >= 1 && q.x <= 2 && Math.abs(q.z) <= 2 && q.y < 10), "the x >= 1 columns stand on the ground already");
  assert.ok(r.blocks.some((q) => q.x === -2 && q.y === 0) && r.blocks.some((q) => q.x === 0 && q.y === 4) && !r.blocks.some((q) => q.x === 0 && Math.abs(q.z) <= 2 && q.y < 3));
  assert.ok(faceLinked(r.blocks, trunkBase(10)));
});

test("root down: through water to the bed; prop roots leave the trunk 2 above the water, two blocks per step, then drop to the bed", () => {
  const w = trunkWorld({ bottom: 20, ground: () => 0, water: 12 }), r = RP.planRootDown(w.at, w.cells, 30);
  assert.equal(r.wet, true); assert.equal(r.drop, 19);
  for (const [a, b] of TRUNK3) for (let y = 0; y <= 19; y++) assert.ok(r.blocks.some((q) => q.x === a && q.y === y && q.z === b), `trunk column ${a},${b} at ${y}`);
  const props = r.blocks.filter((q) => Math.max(Math.abs(q.x), Math.abs(q.z)) > 2);
  assert.ok(r.roots >= 4 && props.length, `roots ${r.roots}`);
  assert.ok(props.every((q) => q.y <= 14), "a prop root starts 2 above the water");
  const feet = props.filter((p) => p.y === 1);
  assert.ok(feet.length >= 4, "prop roots reach the bed");
  for (const q of feet) { const col = props.filter((p) => p.x === q.x && p.z === q.z).map((p) => p.y).sort((a, b) => a - b); assert.equal(col[col.length - 1] - col[0] + 1, col.length, "a prop root drops in one piece to the bed"); }
  assert.ok(faceLinked(r.blocks, trunkBase(20)), "no thin diagonal: every log is face-linked");
  assert.ok(!r.blocks.some((q) => /leaves/.test(q.id)), "no leaves under water");
});

test("root down: too deep is skipped, unloaded is an error, a village block under a column keeps that column", () => {
  assert.ok(RP.planRootDown(trunkWorld({ bottom: 10, ground: () => -60 }).at, TRUNK3, 30).skip);
  assert.ok(RP.planRootDown(trunkWorld({ bottom: 10, extra: { "0,5,0": "UNLOADED" } }).at, TRUNK3, 30).error);
  const r = RP.planRootDown(trunkWorld({ bottom: 10, extra: { "2,6,2": PLANKS } }).at, TRUNK3, 30);
  assert.ok(!r.blocks.some((q) => q.x === 2 && q.z === 2 && q.y < 10));
  assert.equal(r.columns, 24);
});

test("root down in the repair pass: a balcony pillar over a drop is carried to the ground, then gets its root flare", () => {
  const w = pillarWorld({ ground: () => -30, bottom: -12 }), rect = { x0: -30, x1: 30, z0: -30, z1: 30 };
  const out = PL.drive(RP.repairGen(PL.overlay(PL.boundedReader(w.at, rect)), [w.marker], { rect }));
  const rd = out.find((p) => p.kind === "rootdown");
  assert.ok(rd && rd.columns === 5 && rd.drop === 17, JSON.stringify(rd && { c: rd.columns, d: rd.drop }));
  assert.ok(out.some((p) => p.kind === "flare"), "the pillar then gets its root flare");
  assert.match(RP.describeRepair(rd), /carried 17 down/);
});

finish();
