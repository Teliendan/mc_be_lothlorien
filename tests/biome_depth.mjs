// biome depth regression tests; run independently or via tests/run.mjs.
import { test, finish } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { estimateDepth, probeCount, ringOffsets, DEPTH_RADII } from "../lothlorien_bp/scripts/depth.js";

const L = "lothlorien:lothlorien", RIVER = "minecraft:river", FOREST = "minecraft:forest";
const T = new Set([RIVER]);
const depth = (fn) => estimateDepth(fn, L, T);
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

test("unavailable outer probes permit optimistic heart but retain uncertainty", () => {
  const r = depth(dx => dx >= 12 ? undefined : L);
  assert.deepEqual(r, { level: 3, distance: Infinity, beyond: 40, complete: false });
  assert.deepEqual(depth((x, z) => x === 0 && z === 0 ? L : undefined), r);
});

test("a missing point on every ring does not prevent scanning the remaining points", () => {
  const missing = new Set(DEPTH_RADII.map(r => ringOffsets(r)[0].join(",")));
  const visited = new Set();
  const r = depth((x, z) => { visited.add(`${x},${z}`); return missing.has(`${x},${z}`) ? undefined : L; });
  assert.equal(visited.size, probeCount());
  assert.equal(r.level, 3); assert.equal(r.complete, false); assert.equal(r.beyond, 40);
});

test("a loaded foreign point after an earlier unavailable ring still sets the border", () => {
  for (const [foreignRing, expected] of [[16, 1], [24, 2], [32, 2], [40, 2]]) {
    const missing = new Set(ringOffsets(8).map(p => p.join(",")));
    const foreign = ringOffsets(foreignRing)[0].join(",");
    const r = depth((x, z) => missing.has(`${x},${z}`) ? undefined : `${x},${z}` === foreign ? FOREST : L);
    assert.deepEqual(r, { level: expected, distance: foreignRing, complete: false });
  }
});

test("unavailable points in a border ring do not hide its loaded foreign point", () => {
  const ring = ringOffsets(16), missing = ring[0].join(","), foreign = ring[1].join(",");
  const r = depth((x, z) => `${x},${z}` === missing ? undefined : `${x},${z}` === foreign ? FOREST : L);
  assert.deepEqual(r, { level: 1, distance: 16, complete: false });
});

test("unknown centre never borrows known forest from outer rings", () => {
  let calls = 0;
  const r = depth((x, z) => { calls++; return x === 0 && z === 0 ? undefined : L; });
  assert.deepEqual(r, { level: 0, distance: 0, complete: false }); assert.equal(calls, 1);
});

test("river-only partial samples do not invent inside or confirmed outside", () => {
  assert.deepEqual(depth((x, z) => x > 0 ? undefined : RIVER), { level: 0, distance: 0, complete: false });
  const foreign = ringOffsets(24)[0].join(",");
  assert.deepEqual(depth((x, z) => `${x},${z}` === foreign ? FOREST : x < 0 ? undefined : RIVER),
    { level: 0, distance: 0, complete: false });
  assert.deepEqual(depth(() => RIVER), { level: 0, distance: 0, complete: true });
});

test("a river can find forest after missing samples and use the later observed border", () => {
  const missing = new Set(ringOffsets(8).map(p => p.join(",")));
  const forest = ringOffsets(16)[0].join(","), foreign = ringOffsets(32)[0].join(",");
  const r = depth((x, z) => missing.has(`${x},${z}`) ? undefined : `${x},${z}` === forest ? L : `${x},${z}` === foreign ? FOREST : RIVER);
  assert.deepEqual(r, { level: 2, distance: 32, complete: false });
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

finish();
