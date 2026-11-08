// Event-driven leaf decay rules (owner 2026-11-08; replaces a script random tick on every natural leaf, which cost a
// script call per leaf tick and a growing memo). Pure: no @minecraft/server, so tests can run it offline; trees.js
// wires it to the onBreak hooks and events.
//
// Rule: a natural (non-persistent) Mallorn leaf stays while tree wood is at most LEAF_REACH leaf steps away (a leaf next to
// wood is 1 step). Leaves of any species carry the path. Leaves only re-check when a log, wood or leaf next to them is
// destroyed (findDecay) or placed (findRescue), so a standing forest costs nothing. A leaf found cut off is only marked
// as decaying; the game's own random tick breaks it later, at vanilla pace (owner 2026-11-08).

export const LEAF_REACH = 10;
// A leaf whose wood path can change through a cell is at most LEAF_REACH steps from it, and the rest of its path to wood
// is at most LEAF_REACH - 1 steps longer, so a search this far around the changed cells decides it exactly.
export const SEARCH_STEPS = 2 * LEAF_REACH - 1;
// Origins of one search lie within BATCH_SPAN blocks of the first one (trees.js groups them; farther ones wait for the
// next search). One origin can reach at most ~9,900 cells, so only a dense batch can pass MAX_SEARCH_LEAVES; such a
// search changes nothing (like an unloaded neighbour): a canopy is never stripped by a guess.
export const BATCH_SPAN = 6;
export const MAX_SEARCH_LEAVES = 30000;
// Hard limit for the numeric cell keys; origins farther than this from the first are ignored.
const ORIGIN_SPAN = 512;

// Cell kinds returned by classify(x, y, z). DECAYING = a natural leaf already marked to decay: gone for findDecay,
// a path leaf for findRescue (it is still there and can carry a restored connection).
export const OTHER = 0, LEAF = 1, DECAYABLE = 2, WOOD = 3, UNKNOWN = 4, DECAYING = 5;
const isLeaf = (kind) => kind === LEAF || kind === DECAYABLE || kind === DECAYING;
const STEPS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const SPAN = 2048, HALF = SPAN / 2;

// Leaves within SEARCH_STEPS of the origins (an origin that is itself a leaf counts as step 0), each with its steps to
// wood inside the searched set when that is at most LEAF_REACH (`reach`). Wood and unreadable cells count as wood.
// Returns undefined past MAX_SEARCH_LEAVES.
function* survey(classify, origins, yieldEvery) {
  const o = origins[0];
  const key = (x, y, z) => ((x - o.x + HALF) * SPAN + (y - o.y + HALF)) * SPAN + (z - o.z + HALF);
  const kinds = new Map();
  let sinceYield = 0;
  const kindAt = (x, y, z, k) => {
    let kind = kinds.get(k);
    if (kind === undefined) { kind = classify(x, y, z); kinds.set(k, kind); sinceYield++; }
    return kind;
  };

  // 1. Leaves by steps through leaves; `near` = touches wood or an unreadable cell.
  const steps = new Map(), cells = [], near = new Set();
  let layer = [];
  const visit = (x, y, z, d, into) => {
    const k = key(x, y, z);
    if (steps.has(k) || !isLeaf(kindAt(x, y, z, k))) return;
    steps.set(k, d); cells.push(x, y, z, k); into.push(cells.length - 4);
  };
  const first = [];
  for (const p of origins) {
    if (Math.abs(p.x - o.x) > ORIGIN_SPAN || Math.abs(p.y - o.y) > ORIGIN_SPAN || Math.abs(p.z - o.z) > ORIGIN_SPAN) continue;
    visit(p.x, p.y, p.z, 0, first);
  }
  for (const p of origins) {
    if (Math.abs(p.x - o.x) > ORIGIN_SPAN || Math.abs(p.y - o.y) > ORIGIN_SPAN || Math.abs(p.z - o.z) > ORIGIN_SPAN) continue;
    for (const [dx, dy, dz] of STEPS) visit(p.x + dx, p.y + dy, p.z + dz, 1, layer);
  }
  layer = [...first, ...layer];
  while (layer.length) {
    const next = [];
    for (const i of layer) {
      const x = cells[i], y = cells[i + 1], z = cells[i + 2], k = cells[i + 3], d = steps.get(k);
      for (const [dx, dy, dz] of STEPS) {
        const nx = x + dx, ny = y + dy, nz = z + dz, nk = key(nx, ny, nz), kind = kindAt(nx, ny, nz, nk);
        if (kind === WOOD || kind === UNKNOWN) near.add(k);
        else if (isLeaf(kind) && d < SEARCH_STEPS && !steps.has(nk)) {
          steps.set(nk, d + 1); cells.push(nx, ny, nz, nk); next.push(cells.length - 4);
          if (steps.size > MAX_SEARCH_LEAVES) return undefined;
        }
      }
      if (sinceYield >= yieldEvery) { sinceYield = 0; yield; }
    }
    layer = next;
  }

  // 2. Steps to wood inside the searched leaves (only up to LEAF_REACH matters).
  const reach = new Map(), index = new Map();
  let wave = [], work = 0;
  for (let i = 0; i < cells.length; i += 4) {
    index.set(cells[i + 3], i);
    if (near.has(cells[i + 3])) { reach.set(cells[i + 3], 1); wave.push(i); }
  }
  for (let d = 1; d < LEAF_REACH && wave.length; d++) {
    const next = [];
    for (const i of wave) {
      for (const [dx, dy, dz] of STEPS) {
        const nk = key(cells[i] + dx, cells[i + 1] + dy, cells[i + 2] + dz);
        if (steps.has(nk) && !reach.has(nk)) { reach.set(nk, d + 1); next.push(index.get(nk)); }
      }
      if (++work % (yieldEvery * 8) === 0) yield;
    }
    wave = next;
  }
  return { key, kinds, steps, cells, reach };
}

// Generator: the natural leaves that lost their wood after a block at each of `origins` ({x, y, z}) was destroyed.
// Leaves already DECAYING count as gone. Yields every `yieldEvery` reads. Returns [{x, y, z, frontier}]: `frontier`
// marks a decaying leaf next to a leaf this search could not decide (one cut off before, e.g. a crown left by a decay-off
// test build); its own break starts the next search, so such a crown still clears step by step.
export function* findDecay(classify, origins, yieldEvery = 128) {
  if (!origins.length) return [];
  const gone = (x, y, z) => { const kind = classify(x, y, z); return kind === DECAYING ? OTHER : kind; };
  const s = yield* survey(gone, origins, yieldEvery);
  if (!s) return [];
  const { key, kinds, steps, cells, reach } = s;
  // Every searched leaf had all six neighbours read, so a leaf neighbour beyond LEAF_REACH steps that did not reach
  // wood is the only undecided case.
  const out = [];
  for (let i = 0; i < cells.length; i += 4) {
    const x = cells[i], y = cells[i + 1], z = cells[i + 2], k = cells[i + 3];
    if (steps.get(k) > LEAF_REACH || reach.has(k) || kinds.get(k) !== DECAYABLE) continue;
    const frontier = STEPS.some(([dx, dy, dz]) => {
      const nk = key(x + dx, y + dy, z + dz);
      return isLeaf(kinds.get(nk)) && steps.get(nk) > LEAF_REACH && !reach.has(nk);
    });
    out.push({ x, y, z, frontier });
  }
  return out;
}

// Generator: the DECAYING leaves that reach wood again after a log, wood or leaf was placed at each of `origins`.
// Decaying leaves carry the path like any leaf, so the restored connection spreads the whole LEAF_REACH through them.
// A marked leaf whose new path to wood is at most LEAF_REACH steps lies within LEAF_REACH steps of the placed cell, and
// so does its whole path: the search range covers it exactly. Returns [{x, y, z}].
export function* findRescue(classify, origins, yieldEvery = 128) {
  if (!origins.length) return [];
  const s = yield* survey(classify, origins, yieldEvery);
  if (!s) return [];
  const out = [];
  for (let i = 0; i < s.cells.length; i += 4) {
    const k = s.cells[i + 3];
    if (s.kinds.get(k) === DECAYING && s.reach.has(k)) out.push({ x: s.cells[i], y: s.cells[i + 1], z: s.cells[i + 2] });
  }
  return out;
}
