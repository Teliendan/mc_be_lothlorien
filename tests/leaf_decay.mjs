// Event-driven leaf decay rules (leaf_decay.js) on small grid worlds: reach, carriers, unreadable cells, the search cap,
// frontier continuation and one read per cell. trees.js wiring is covered in leaf_tree_interactions.mjs.
import assert from 'node:assert/strict';
import { findDecay, findRescue, LEAF_REACH, MAX_SEARCH_LEAVES, OTHER, LEAF, DECAYABLE, WOOD, UNKNOWN, DECAYING } from '../lothlorien_bp/scripts/leaf_decay.js';

function world(cells = {}) {
  const map = new Map(Object.entries(cells)), reads = new Map();
  const classify = (x, y, z) => {
    const k = `${x},${y},${z}`;
    reads.set(k, (reads.get(k) ?? 0) + 1);
    return map.get(k) ?? OTHER;
  };
  return { map, reads, classify, set: (x, y, z, kind) => map.set(`${x},${y},${z}`, kind) };
}
const run = (w, origins, find = findDecay) => {
  const gen = find(w.classify, origins, 4);
  for (;;) { const r = gen.next(); if (r.done) return r.value; }
};
const keys = (out) => out.map(({ x, y, z }) => `${x},${y},${z}`).sort();
const row = (w, from, to, kind, y = 0, z = 0) => { for (let x = from; x <= to; x++) w.set(x, y, z, kind); };
let groups = 0;
const test = (name, body) => { body(); groups++; console.log(`ok   leaf decay: ${name}`); };

test('a leaf next to remaining wood stays; a crown cut off from its wood decays', () => {
  const w = world();
  row(w, 1, 5, DECAYABLE); w.set(6, 0, 0, WOOD); // origin 0,0,0 was a log; another log at x=6
  assert.deepEqual(run(w, [{ x: 0, y: 0, z: 0 }]), []);
  w.set(6, 0, 0, OTHER);
  assert.deepEqual(keys(run(w, [{ x: 0, y: 0, z: 0 }])), ['1,0,0', '2,0,0', '3,0,0', '4,0,0', '5,0,0']);
});

test(`wood exactly ${LEAF_REACH} steps away keeps a leaf; ${LEAF_REACH + 1} steps lets it decay`, () => {
  const w = world();
  row(w, 1, LEAF_REACH, DECAYABLE); w.set(LEAF_REACH + 1, 0, 0, WOOD);
  assert.deepEqual(run(w, [{ x: 0, y: 0, z: 0 }]), [], 'leaf at x=1 is 10 steps from wood at x=11');
  const v = world();
  row(v, 1, LEAF_REACH + 1, DECAYABLE); v.set(LEAF_REACH + 2, 0, 0, WOOD);
  assert.deepEqual(keys(run(v, [{ x: 0, y: 0, z: 0 }])), ['1,0,0'], 'only the leaf 11 steps from wood decays');
});

test('persistent and other species leaves carry the path but never decay; unreadable cells count as wood', () => {
  const w = world();
  w.set(1, 0, 0, DECAYABLE); w.set(2, 0, 0, LEAF); w.set(3, 0, 0, WOOD);
  assert.deepEqual(run(w, [{ x: 0, y: 0, z: 0 }]), []);
  w.set(3, 0, 0, OTHER);
  assert.deepEqual(keys(run(w, [{ x: 0, y: 0, z: 0 }])), ['1,0,0'], 'the carrier leaf itself stays');
  w.set(3, 0, 0, UNKNOWN);
  assert.deepEqual(run(w, [{ x: 0, y: 0, z: 0 }]), [], 'an unloaded neighbour never strips a tree');
});

test('a destroyed leaf splits a branch: only the side without wood decays', () => {
  const w = world();
  w.set(-3, 0, 0, WOOD); row(w, -2, -1, DECAYABLE); row(w, 1, 4, DECAYABLE); // origin 0,0,0 was the bridging leaf
  assert.deepEqual(keys(run(w, [{ x: 0, y: 0, z: 0 }])), ['1,0,0', '2,0,0', '3,0,0', '4,0,0']);
});

test('the leaf at the edge of what a search decides is a frontier; inner ones are not', () => {
  const w = world();
  row(w, 1, 30, DECAYABLE); // a long cut-off branch, no wood anywhere
  const out = run(w, [{ x: 0, y: 0, z: 0 }]);
  assert.equal(out.length, LEAF_REACH);
  assert.deepEqual(out.filter((l) => l.frontier).map((l) => l.x), [LEAF_REACH]);
  // the continuation from the frontier (its own removal) decides the next stretch
  for (const l of out) w.set(l.x, l.y, l.z, OTHER);
  const next = run(w, [{ x: LEAF_REACH, y: 0, z: 0 }]);
  assert.deepEqual(next.map((l) => l.x).sort((a, b) => a - b), Array.from({ length: LEAF_REACH }, (_, i) => LEAF_REACH + 1 + i));
});

test('several origins share one search and every cell is read once', () => {
  const w = world();
  row(w, 1, 3, DECAYABLE); row(w, 1, 3, DECAYABLE, 0, 2); row(w, 1, 3, DECAYABLE, 0, 1);
  const out = run(w, [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }]);
  assert.equal(out.length, 9);
  assert.ok([...w.reads.values()].every((n) => n === 1), 'classify is called at most once per cell');
});

test(`a search past ${MAX_SEARCH_LEAVES} leaves keeps everything; one origin never gets there`, () => {
  const origins = [[0, 0, 0], [60, 0, 0], [0, 60, 0], [0, 0, 60]].map(([x, y, z]) => ({ x, y, z }));
  const solid = (x, y, z) => (origins.some((o) => o.x === x && o.y === y && o.z === z) ? OTHER : DECAYABLE);
  const all = (o) => { const gen = findDecay(solid, o, 4096); let r; do r = gen.next(); while (!r.done); return r.value; };
  assert.deepEqual(all(origins), [], 'four full canopies in one batch pass the cap');
  assert.ok(all(origins.slice(0, 1)).length > 0, 'a single origin in a solid leaf mass with no wood still decides');
});

test('no origins, or leaves that are not next to an origin, start nothing', () => {
  const w = world();
  row(w, 2, 4, DECAYABLE);
  assert.deepEqual(run(w, []), []);
  assert.deepEqual(run(w, [{ x: 0, y: 0, z: 0 }]), []);
  assert.ok(w.reads.size <= 7, 'only the origin and its six neighbours were read');
});

test(`a placed log rescues marked leaves over the whole reach (${LEAF_REACH}), through marked leaves`, () => {
  const w = world();
  row(w, 1, LEAF_REACH + 3, DECAYING); w.set(0, 0, 0, WOOD); // the placed log at the origin
  assert.deepEqual(run(w, [{ x: 0, y: 0, z: 0 }], findRescue).map((l) => l.x).sort((a, b) => a - b),
    Array.from({ length: LEAF_REACH }, (_, i) => i + 1));
});

test('a placed leaf that bridges to wood rescues the marked leaves behind it, minus its own steps', () => {
  const w = world();
  w.set(-2, 0, 0, WOOD); w.set(-1, 0, 0, LEAF); // the placed (persistent) leaf at -1 is 1 step from wood
  row(w, 0, 14, DECAYING);
  assert.deepEqual(run(w, [{ x: -1, y: 0, z: 0 }], findRescue).map((l) => l.x).sort((a, b) => a - b),
    Array.from({ length: LEAF_REACH - 1 }, (_, i) => i));
  const v = world(); row(v, 0, 5, DECAYING); v.set(-1, 0, 0, LEAF);
  assert.deepEqual(run(v, [{ x: -1, y: 0, z: 0 }], findRescue), [], 'a bridge to nothing rescues nothing');
});

test('marked leaves count as gone for a later decay search', () => {
  const w = world();
  w.set(1, 0, 0, DECAYABLE); w.set(2, 0, 0, DECAYING); w.set(3, 0, 0, WOOD);
  assert.deepEqual(keys(run(w, [{ x: 0, y: 0, z: 0 }])), ['1,0,0']);
});

console.log(`ok   leaf decay: ${groups} groups`);
