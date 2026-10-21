// forest floor regression tests; run independently or via tests/run.mjs.
import { test, finish } from './test_helpers.mjs';
import assert from "node:assert/strict";
import * as PL from "../lothlorien_bp/scripts/village_planner.js";
import * as RP from "../lothlorien_bp/scripts/village_repair.js";

const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
const PILLAR_LOG = "lothlorien:mallorn_log";
function floorWorld({ ground = () => 0, water = () => false, extra = {} } = {}) { // trunk of 5x5 logs at 0,0 up to y 40; grass at ground(x, z), dirt below, air above; water(x, z): a pool instead of grass
  const at = (x, y, z) => {
    const k = `${x},${y},${z}`;
    if (extra[k] !== undefined) return extra[k] === "UNLOADED" ? undefined : extra[k];
    if (Math.abs(x) <= 2 && Math.abs(z) <= 2 && y >= -10) return "lothlorien:mallorn_log";
    const g = ground(x, z);
    if (y > g) return "minecraft:air";
    if (water(x, z) && y === g) return "minecraft:water";
    return y === g ? "minecraft:grass_block" : "minecraft:dirt";
  };
  return at;
}
const FLOOR_RECT = { x0: -40, x1: 40, z0: -40, z1: 40 };

test("forest floor: findTrunksGen finds the 5x5 trunk (a balcony plus of 5 cells is not a trunk)", () => {
  const at = floorWorld({ extra: { "20,5,20": PILLAR_LOG, "21,5,20": PILLAR_LOG, "19,5,20": PILLAR_LOG, "20,5,21": PILLAR_LOG, "20,5,19": PILLAR_LOG } });
  const t = PL.drive(RP.findTrunksGen(at, FLOOR_RECT, 5));
  assert.equal(t.length, 1);
  assert.ok(Math.abs(t[0].x) < 0.01 && Math.abs(t[0].z) < 0.01 && t[0].size === 25 && Math.abs(t[0].r - 2.82) < 0.05, JSON.stringify(t));
});

test("forest floor: only on real ground, one cell above it, never at the rope foot's 3x3, deterministic, budgeted, density falls off", () => {
  const water = (x, z) => x >= 6 && x <= 9 && z >= -4 && z <= 4, ground = (x, z) => x >= 10 ? 3 : 0; // a pool and a step up of 3
  const at = floorWorld({ ground, water, extra: { "5,1,5": "lothlorien:mallorn_log", "-6,0,-6": "minecraft:stone", "-7,1,-6": "UNLOADED", "-8,1,-6": "minecraft:short_grass" } });
  const foot = [{ x: 3, z: 0 }], trunks = [{ x: 0, z: 0, r: 2.82, central: true }], run = (seed) => RP.planForestFloor(at, FLOOR_RECT, trunks, foot, seed, { y0: 30 });
  const a = run(7), b = run(7), c = run(8);
  assert.ok(a.blocks.length > 120 && a.blocks.length <= RP.FLOOR.maxBlocks, `${a.blocks.length} blocks`);
  assert.deepEqual(a.blocks, b.blocks, "deterministic");
  assert.notDeepEqual(a.blocks, c.blocks, "another seed, another floor");
  const seen = new Set();
  for (const p of a.blocks) {
    const k = `${p.x},${p.z}`;
    assert.ok(!seen.has(k), `one block per column ${k}`); seen.add(k);
    assert.equal(p.y, ground(p.x, p.z) + 1, `${k} on the first cell above the ground`);
    assert.ok(/grass_block|dirt/.test(at(p.x, p.y - 1, p.z)), `${k} has ground below`);
    assert.ok(["minecraft:air", "minecraft:short_grass", "minecraft:fern"].includes(at(p.x, p.y, p.z)), `${k} goes into a free cell`);
    assert.ok(Math.abs(p.x - 3) > 1 || Math.abs(p.z) > 1, `${k} is in the landing`);
    assert.ok(!water(p.x, p.z), `${k} is over water`);
    assert.ok(Math.hypot(p.x, p.z) <= RP.FLOOR.rCentral + 0.5 && Math.hypot(p.x, p.z) > 3, `${k} within the disc`);
    assert.ok(!(p.x === -6 && p.z === -6) && !(p.x === -7 && p.z === -6) && !(p.x === 5 && p.z === 5), `${k} on stone, unloaded or a root`);
    if (p.id.startsWith("lothlorien:")) assert.equal(typeof (p.states["lothlorien:on_grass"]), "boolean");
  }
  const ids = new Set(a.blocks.map((p) => p.id));
  for (const id of ["lothlorien:mallorn_leaf_carpet", "minecraft:fern", "minecraft:firefly_bush"]) assert.ok(ids.has(id), `${id} placed`);
  assert.ok(!ids.has("minecraft:leaf_litter"), "no vanilla leaf litter under the village trees");
  assert.ok(a.blocks.filter((p) => /elanor|niphredil|wildflowers|golden_fern/.test(p.id)).length < a.blocks.length * 0.2, "few flowers");
  assert.ok(a.blocks.filter((p) => p.id === "minecraft:firefly_bush").length >= 2 && a.blocks.filter((p) => p.id === "minecraft:firefly_bush").length <= 5);
  const nearN = a.blocks.filter((p) => Math.hypot(p.x, p.z) < 7).length, farN = a.blocks.filter((p) => Math.hypot(p.x, p.z) >= 10).length;
  const ringArea = (r0, r1) => Math.PI * (r1 * r1 - r0 * r0); // density per area: inner ring [3, 7) against the outer ring [10, 14.5]
  assert.ok(nearN / ringArea(2.8, 7) > 1.5 * farN / ringArea(10, 14.5), `density near ${nearN} vs far ${farN}`);
  let nearF = 0, nearAll = 0, farF = 0, farAll = 0; // over six seeds: flowers are a bigger share of the plants near the trunk than far out
  for (let sd = 1; sd <= 6; sd++) for (const p of run(sd).blocks) {
    const flower = /elanor|niphredil|wildflowers/.test(p.id), d = Math.hypot(p.x, p.z);
    if (d < 7) { nearAll++; if (flower) nearF++; } else if (d >= 9) { farAll++; if (flower) farF++; }
  }
  assert.ok(nearF / nearAll > 1.3 * farF / farAll, `flower share near ${nearF}/${nearAll}, far ${farF}/${farAll}`);
  assert.equal(RP.planForestFloor(at, FLOOR_RECT, [], foot, 7, { y0: 30 }).blocks.length, 0, "no trunk, no floor");
});

test("forest floor: no ground (all water / stone / unloaded) gives no blocks; the budget keeps the cells nearest the trunk", () => {
  assert.equal(RP.planForestFloor(floorWorld({ water: () => true }), FLOOR_RECT, [{ x: 0, z: 0, r: 2.8 }], [], 1, { y0: 30 }).blocks.length, 0);
  assert.equal(RP.planForestFloor(() => undefined, FLOOR_RECT, [{ x: 0, z: 0, r: 2.8 }], [], 1, { y0: 30 }).blocks.length, 0);
  const saved = RP.FLOOR.maxBlocks;
  RP.FLOOR.maxBlocks = 40;
  try {
    const f = RP.planForestFloor(floorWorld(), FLOOR_RECT, [{ x: 0, z: 0, r: 2.8 }], [], 1, { y0: 30 });
    assert.equal(f.blocks.length, 40);
    assert.ok(Math.max(...f.blocks.map((p) => Math.hypot(p.x, p.z))) < RP.FLOOR.rCentral - 1);
  } finally { RP.FLOOR.maxBlocks = saved; }
});

finish();
