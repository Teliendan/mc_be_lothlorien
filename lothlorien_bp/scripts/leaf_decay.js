// Event-driven leaf decay rules (owner 2026-11-08; replaces a script random tick on every natural leaf, which cost a
// script call per leaf tick and a growing memo). Pure: no @minecraft/server, so tests can run it offline; trees.js
// wires it to the onBreak hooks and events.
//
// Rule: a natural (non-persistent) Mallorn leaf stays while tree wood is at most LEAF_REACH leaf steps away (a leaf next to
// wood is 1 step). Leaves of any species carry the path. Leaves only re-check when a log, wood or leaf next to them is
// destroyed, so a standing forest costs nothing.

export const LEAF_REACH = 10;
// A leaf that can lose its wood through a destroyed cell is at most LEAF_REACH steps from it, and its remaining path to wood
// is at most LEAF_REACH - 1 steps longer, so a search this far around the destroyed cells decides it exactly.
export const SEARCH_STEPS = 2 * LEAF_REACH - 1;
// Origins of one search lie within BATCH_SPAN blocks of the first one (trees.js groups them; farther ones wait for the
// next search). One origin can reach at most ~9,900 cells, so only a dense batch can pass MAX_SEARCH_LEAVES; such a
// search keeps everything (like an unloaded neighbour): a canopy is never stripped by a guess.
export const BATCH_SPAN = 6;
export const MAX_SEARCH_LEAVES = 30000;
// Hard limit for the numeric cell keys; origins farther than this from the first are ignored.
const ORIGIN_SPAN = 512;

export const OTHER = 0, LEAF = 1, DECAYABLE = 2, WOOD = 3, UNKNOWN = 4;
const isLeaf = (kind) => kind === LEAF || kind === DECAYABLE;
const STEPS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const SPAN = 2048, HALF = SPAN / 2;

// Generator: the natural leaves that lost their wood after a block at each of `origins` ({x, y, z}) was destroyed.
// classify(x, y, z) returns OTHER, LEAF (carries the path, never decays), DECAYABLE, WOOD or UNKNOWN (unreadable: counts
// as wood); it is called at most once per cell. Yields every `yieldEvery` reads. Returns [{x, y, z, frontier}]:
// `frontier` marks a decaying leaf next to a leaf this search could not decide (one that was cut off before, e.g. a crown
// left by a decay-off test build). Its own removal starts the next search, so such a crown still clears step by step.
export function* findDecay(classify, origins, yieldEvery = 128) {
  if (!origins.length) return [];
  const o = origins[0];
  const key = (x, y, z) => ((x - o.x + HALF) * SPAN + (y - o.y + HALF)) * SPAN + (z - o.z + HALF);
  const kinds = new Map();
  let reads = 0, sinceYield = 0;
  const kindAt = (x, y, z, k) => {
    let kind = kinds.get(k);
    if (kind === undefined) { kind = classify(x, y, z); kinds.set(k, kind); reads++; sinceYield++; }
    return kind;
  };

  // 1. Leaves within SEARCH_STEPS of the origins, by steps through leaves; `near` = touches wood or an unreadable cell.
  const steps = new Map(), cells = [], near = new Set();
  let layer = [];
  for (const p of origins) {
    if (Math.abs(p.x - o.x) > ORIGIN_SPAN || Math.abs(p.y - o.y) > ORIGIN_SPAN || Math.abs(p.z - o.z) > ORIGIN_SPAN) continue;
    for (const [dx, dy, dz] of STEPS) {
      const x = p.x + dx, y = p.y + dy, z = p.z + dz, k = key(x, y, z);
      if (steps.has(k) || !isLeaf(kindAt(x, y, z, k))) continue;
      steps.set(k, 1); cells.push(x, y, z, k); layer.push(cells.length - 4);
    }
  }
  for (let d = 1; layer.length; d++) {
    const next = [];
    for (const i of layer) {
      const x = cells[i], y = cells[i + 1], z = cells[i + 2], k = cells[i + 3];
      for (const [dx, dy, dz] of STEPS) {
        const nx = x + dx, ny = y + dy, nz = z + dz, nk = key(nx, ny, nz), kind = kindAt(nx, ny, nz, nk);
        if (kind === WOOD || kind === UNKNOWN) near.add(k);
        else if (isLeaf(kind) && d < SEARCH_STEPS && !steps.has(nk)) {
          steps.set(nk, d + 1); cells.push(nx, ny, nz, nk); next.push(cells.length - 4);
          if (steps.size > MAX_SEARCH_LEAVES) return [];
        }
      }
      if (sinceYield >= yieldEvery) { sinceYield = 0; yield; }
    }
    layer = next;
  }

  // 2. Steps to wood inside the searched leaves (only up to LEAF_REACH matters).
  const reach = new Map();
  let wave = [];
  for (let i = 0; i < cells.length; i += 4) if (near.has(cells[i + 3])) { reach.set(cells[i + 3], 1); wave.push(i); }
  const index = new Map();
  for (let i = 0; i < cells.length; i += 4) index.set(cells[i + 3], i);
  let work = 0;
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

  // 3. Decide the leaves this search can decide: natural ones within LEAF_REACH of an origin with no wood in reach.
  // Every searched leaf had all six neighbours read, so a leaf neighbour beyond LEAF_REACH steps that did not reach wood
  // is the only undecided case.
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
