// Village REPAIRS, run by the loop planner (village_planner.js planGen) on the loaded village, after the links. Pure JS (no Bedrock imports):
// loop_marker.js writes the result in game, tools/village_sim.mjs and tests/run.mjs run the very same functions.
//
// Rope fit (owner screenshot 2026-10-10, flat world "ET"): the central tree hangs `elven_rope_hanging` from tree y 0 to its lower deck. Bedrock's
// `world_surface` start height counts from the TOP SOLID block, so with the old start height the lowest rope piece replaced the top block of the
// ground (a hole in the grass), and on uneven ground the rope is buried or ends in the air: the rope is 3 blocks from the trunk axis where the
// height was sampled. The fit reads the real ground and (a) turns buried rope pieces back into the terrain block in front of them, (b) hangs
// more pieces down to the ground. The face of the rope is derived from the wall it hangs on, never hard-coded (a piece can be rotated).
//
// Root flare (owner 2026-10-10): the balcony and lookout pillars are plus-shaped log columns that run down into the terrain. Where a pillar meets the
// REAL ground it gets 2-4 thin roots: from the first cell beside an arm of the pillar, 1-2 cells out, each a single mallorn log lying on the ground
// (block_face sideways), only into air or plants. No wood mass: no root cell has more than 2 wood neighbours (the pillar not counted). The pillars are
// found from the loop markers (a balcony / lookout marker stands 3 / 4 cells from its pillar axis), no layer scan. Not verified in game.
//
// Forest floor (style guide 7.8): after the rope fit and the flares, planForestFloor lays a living floor on the REAL ground round every trunk: leaf litter and
// leaf carpets, ferns, golden ferns, elanor, niphredil, wildflowers, a few firefly bushes and small moss patches. Blobs (a jittered grid, nearest point wins)
// pick a theme each, so the floor reads as patches and drifts, not confetti; flowers lie near the trunk feet, litter and ferns farther out; the central tree
// (the one nearest the rope) gets the widest and densest disc. Pure and deterministic (hash of cell and village seed). Not verified in game.
import { hullOf, growRect, drive } from "./village_planner.js";

export const ROPE_ID = "lothlorien:elven_rope_hanging";
export const REPAIR = { maxHang: 24, minAbove: 2, scanChunk: 512, flareScan: 48, flareStep: 1, PILLAR_LEAF_CLEAR: 4 };
const LEAF_ID = "lothlorien:mallorn_leaves";
const LOGS = new Set(["lothlorien:mallorn_log", "lothlorien:mallorn_wood"]);
const FACE_OF = { "1,0": "west", "-1,0": "east", "0,1": "north", "0,-1": "south" }; // wall offset from the piece -> rope face (the wall lies opposite)
const OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AIRS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);
const WET = (n) => n === "minecraft:water" || n === "minecraft:flowing_water" || n === "minecraft:lava" || n === "minecraft:flowing_lava" || /seagrass|kelp|bubble_column/.test(n ?? "");
const SOFT = /short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|daisy|orchid|allium|bluet|cornflower|lily|bush|sapling|snow_layer|leaf_litter|petals|vine|mushroom|dead_bush|sweet_berry|azalea/;
const VILLAGE = /^lothlorien:(mallorn_((heartwood_)?(planks|slab|fence|stairs|trapdoor)|log|wood|stripped_log|stripped_wood|leaves|golden_leaves)|elven_)/;
const TERRAIN = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|mycelium|stone|sand|red_sand|gravel|moss_block|mud|clay|sandstone|red_sandstone|snow|dirt_path|deepslate|andesite|diorite|granite|terracotta|.*_terracotta)$/;
const isAir = (n) => AIRS.has(n);
const isPlant1 = (n) => n === "minecraft:short_grass" || n === "minecraft:fern" || n === "minecraft:tallgrass";

// ground(n): a block the rope may not occupy because it is the terrain (an undefined read is not ground: the caller errors out first)
export const isGround = (n) => n !== undefined && n !== null && !isAir(n) && !WET(n) && !SOFT.test(n) && !/leaves/.test(n) && !VILLAGE.test(n);

// Rope pieces of the layer y (the deck cell row) inside the rect. A generator, so the runtime job can yield: yields every REPAIR.scanChunk reads.
export function* findRopesGen(at, rect, y) {
  const out = [];
  let n = 0;
  for (let x = rect.x0; x <= rect.x1; x++) for (let z = rect.z0; z <= rect.z1; z++) {
    if (at(x, y, z) === ROPE_ID) out.push({ x, y, z });
    if (++n % REPAIR.scanChunk === 0) yield;
  }
  return out;
}

// The fit of the rope column that has `top` as its upper piece (in the deck layer). -> { blocks: [{ x, y, z, id, states }], buried, hung, face } | { error }
export function planRopeFit(at, top) {
  const wall = OFFSETS.filter(([a, b]) => LOGS.has(at(top.x + a, top.y, top.z + b)) && LOGS.has(at(top.x + a, top.y - 1, top.z + b)));
  const w = wall.find(([a, b]) => isAir(at(top.x - a, top.y, top.z - b))) ?? wall[0];
  if (!w) return { error: "no wall behind the rope" };
  const [wx, wz] = w, face = FACE_OF[`${wx},${wz}`], fx = -wx, fz = -wz; // front = beyond the rope
  let bottom = top.y;
  while (at(top.x, bottom - 1, top.z) === ROPE_ID) bottom--;
  const blocks = [], mark = (y, id, states = {}) => blocks.push({ x: top.x, y, z: top.z, id, states });
  let buried = 0, hung = 0;
  // buried: the piece stands where the terrain is (the cell in front of it is ground)
  while (bottom < top.y - REPAIR.minAbove) {
    const front = at(top.x + fx, bottom, top.z + fz);
    if (front === undefined) return { error: `unloaded cell at ${top.x + fx},${bottom},${top.z + fz}` };
    if (!isGround(front)) break;
    mark(bottom, TERRAIN.test(front) ? front : "minecraft:dirt");
    bottom++; buried++;
  }
  if (!buried) {
    // hanging: more pieces while the cell below is open and the wall carries them
    let y = bottom;
    while (hung < REPAIR.maxHang) {
      const below = at(top.x, y - 1, top.z), wallBelow = at(top.x + wx, y - 1, top.z + wz);
      if (below === undefined || wallBelow === undefined) return { error: `unloaded cell under the rope at ${top.x},${y - 1},${top.z}` };
      if (!(isAir(below) || isPlant1(below)) || isAir(wallBelow) || WET(wallBelow)) break;
      mark(y - 1, ROPE_ID, { "minecraft:cardinal_direction": face });
      y--; hung++;
    }
  }
  return { blocks, buried, hung, face, bottom };
}

// ---- root flare -----------------------------------------------------------------------------------------------------------------------
const isLog = (n) => LOGS.has(n);
const freeForRoot = (n) => isAir(n) || SOFT.test(n ?? "");
// The pillar a loop marker belongs to: a plus of mallorn logs (centre + 4 arms, no diagonals: the village trunks are 3x3 or round) just under the deck,
// 3 (balcony) or 4 (lookout) cells from the marker along an axis. m = [x, y, z] deck cell. -> { x, z, y } (y = the deck cell) or null.
export function findPillar(at, m) {
  const [mx, my, mz] = m, y = my - 1;
  for (const dist of [3, 4]) for (const [dx, dz] of OFFSETS) {
    const x = mx + dx * dist, z = mz + dz * dist;
    if (!isLog(at(x, y, z)) || !OFFSETS.every(([a, b]) => isLog(at(x + a, y, z + b)))) continue;
    if ([[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => isLog(at(x + a, y, z + b)))) continue;
    return { x, z, y: my };
  }
  return null;
}
// The first terrain surface cell (isGround) of a column, scanning down from y0: -> { y } | { error } (unloaded) | { none: true } (no ground within reach)
function surfaceBelow(at, x, z, y0) {
  for (let y = y0; y > y0 - REPAIR.flareScan; y--) {
    const n = at(x, y, z);
    if (n === undefined) return { error: `unloaded cell at ${x},${y},${z}` };
    if (isGround(n) || WET(n)) return { y, wet: WET(n) };
  }
  return { none: true };
}
// A tiny deterministic hash for the choice of sides and lengths (the same village always gets the same roots)
const hash = (x, z, i) => { let h = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ Math.imul(i + 1, 83492791)) >>> 0; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; return (h ^ (h >>> 15)) >>> 0; };

// The roots of one pillar. -> { blocks: [{ x, y, z, id, states }], roots, x, z } | { error } | { skip: reason }
export function planFlare(at, pillar) {
  const { x: cx, z: cz, y: deck } = pillar;
  const sides = [];
  for (let i = 0; i < 4; i++) {
    const [dx, dz] = OFFSETS[i], sx = cx + dx * 2, sz = cz + dz * 2;
    const g = surfaceBelow(at, sx, sz, deck - 2);
    if (g.error) return { error: g.error };
    if (g.none) return { skip: "no ground under the pillar within reach" };
    if (g.wet) { sides.push(null); continue; }
    sides.push({ dx, dz, sx, sz, ground: g.y });
  }
  // a side whose ground is far from the others (a pit, a cliff, a carved cell) gets no root; the median ground height is the pillar's
  const sorted = sides.filter(Boolean).map((q) => q.ground).sort((a, b) => a - b);
  if (!sorted.length) return { skip: "water all round" };
  const med = sorted[Math.floor(sorted.length / 2)];
  sides.forEach((q, i) => { if (q && Math.abs(q.ground - med) > 2) sides[i] = null; });
  // the pillar must reach the ground: its centre column is a log from the ground height of the arms down (else it ends above the ground: skip)
  const ys = sides.filter(Boolean).map((q) => q.ground);
  const gMin = Math.min(...ys), gMax = Math.max(...ys);
  for (let y = gMax; y >= gMin - 1; y--) if (!isLog(at(cx, y, cz))) return { skip: `pillar ends above the ground (no log at ${cx},${y},${cz})`, ground: med };
  // 2-4 sides, by hash; roots lie on the ground of their own column (first cell above it), 1 or 2 cells out
  const want = 2 + (hash(cx, cz, 0) % 3), order = [0, 1, 2, 3].sort((a, b) => hash(cx, cz, 1 + a) - hash(cx, cz, 1 + b));
  const blocks = [];
  let roots = 0;
  for (const i of order) {
    if (roots >= want) break;
    const s = sides[i];
    if (!s) continue;
    const y1 = s.ground + 1, c1 = at(s.sx, y1, s.sz);
    if (c1 === undefined) return { error: `unloaded cell at ${s.sx},${y1},${s.sz}` };
    if (isLog(c1)) { roots++; continue; } // already there (a second run)
    if (!freeForRoot(c1) || !isGround(at(s.sx, s.ground, s.sz))) continue;
    const face = s.dx ? "east" : "south", put = (x, y, z) => blocks.push({ x, y, z, id: "lothlorien:mallorn_log", states: { "minecraft:block_face": face } });
    put(s.sx, y1, s.sz);
    if (hash(cx, cz, 9 + i) % 2) { // a second cell further out, on the ground of its own column when that is within a step of the first
      const tx = s.sx + s.dx, tz = s.sz + s.dz, g2 = surfaceBelow(at, tx, tz, y1 + REPAIR.flareStep + 1);
      if (!g2.error && !g2.none && !g2.wet && Math.abs(g2.y + 1 - y1) <= REPAIR.flareStep && freeForRoot(at(tx, g2.y + 1, tz))) put(tx, g2.y + 1, tz);
    }
    roots++;
  }
  return { blocks, roots, x: cx, z: cz, ground: med };
}

// Bare pillar foot (owner 2026-10-10: "the leaves shouldn't start at the ground level, like trees, 4 blocks or such"): the ivy is baked into the piece, which does
// not know the real ground, so the leaves of the pillar's own ring (cells within 3 of the pillar axis, i.e. 2 of its outer faces) from ground + 1 to ground +
// REPAIR.PILLAR_LEAF_CLEAR become air. A twig (a log component of the ring with more than one level, no root: roots lie on one level) whose top is within one
// block above the band loses its tuft, so it is removed whole, with the leaves within 2 of it (in the band). -> { blocks, leaves, twigs } | { error }
export function planPillarClear(at, pillar, ground) {
  const { x: cx, z: cz } = pillar, top = ground + REPAIR.PILLAR_LEAF_CLEAR, blocks = [], k = (x, y, z) => `${x},${y},${z}`;
  const cleared = new Set(), air = (x, y, z) => { if (cleared.has(k(x, y, z))) return; cleared.add(k(x, y, z)); blocks.push({ x, y, z, id: "minecraft:air", states: {} }); };
  const logs = new Map();
  let leaves = 0, twigs = 0;
  for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 3; z <= cz + 3; z++) {
    if ((x === cx && Math.abs(z - cz) <= 1) || (z === cz && Math.abs(x - cx) <= 1)) continue;
    for (let y = ground + 1; y <= top + 2; y++) {
      const n = at(x, y, z);
      if (n === undefined) return { error: `unloaded cell at ${x},${y},${z}` };
      if (n === LEAF_ID && y <= top) { air(x, y, z); leaves++; } else if (isLog(n)) logs.set(k(x, y, z), [x, y, z]);
    }
  }
  const seen = new Set();
  for (const [key0, start] of logs) {
    if (seen.has(key0)) continue;
    const comp = [], todo = [start];
    seen.add(key0);
    while (todo.length) {
      const [x, y, z] = todo.pop();
      comp.push([x, y, z]);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const q = k(x + a, y + b, z + c);
        if ((a || b || c) && logs.has(q) && !seen.has(q)) { seen.add(q); todo.push(logs.get(q)); }
      }
    }
    const ys = comp.map((c) => c[1]);
    if (Math.max(...ys) > top + 1 || Math.min(...ys) === Math.max(...ys)) continue; // a tip above the band keeps its tuft; one level = a root
    twigs++;
    for (const [x, y, z] of comp) {
      air(x, y, z);
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
        const ly = y + c;
        if (ly < ground + 1 || ly > top + 1 || (a === 0 && b === 0 && c === 0)) continue;
        if (at(x + a, ly, z + b) === LEAF_ID && !cleared.has(k(x + a, ly, z + b))) { air(x + a, ly, z + b); leaves++; }
      }
    }
  }
  return { blocks, leaves, twigs };
}

// ---- forest floor (style guide 7.8) -------------------------------------------------------------------------------------------------------
// Tunables. rCentral / rTree: disc radius round the trunk axis; pCentral / pTree: density at the trunk edge (falls to pEdge at the disc edge);
// blob: size of a theme patch; clear: Chebyshev radius round the rope foot that stays bare (the landing); maxBlocks: budget per village.
export const FLOOR = { rCentral: 14, rTree: 9, pCentral: 0.62, pTree: 0.5, pEdge: 0.08, blob: 5, clear: 1, minTrunk: 9, maxBlocks: 1500, fireflies: [2, 4], mossCentral: 3, mossTree: [1, 2] };
const FLOOR_GROUND = /^minecraft:(grass_block|dirt|podzol|moss_block|coarse_dirt|rooted_dirt)$/;
// blocks the downward ground scan looks through: air, plants, leaves, anything of the mod (decks, roots, our own plants), hanging bits
const SEE_THROUGH = (n) => isAir(n) || SOFT.test(n) || /leaves|light_block|moss_carpet|hanging_moss|hanging_roots|glow_lichen|cave_vines/.test(n) || n.startsWith("lothlorien:");
const FLOOR_OPEN = new Set(["minecraft:short_grass", "minecraft:tallgrass", "minecraft:fern"]); // the cell above the ground may hold these (replaced)
const DIRS4 = ["north", "east", "south", "west"];
const U = (x, z, k) => hash(x, z, k) / 4294967296;
function vnoise(x, z, scale, k) { // smooth value noise in [0, 1)
  const gx = x / scale, gz = z / scale, x0 = Math.floor(gx), z0 = Math.floor(gz), fx = gx - x0, fz = gz - z0, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = U(x0, z0, k), b = U(x0 + 1, z0, k), c = U(x0, z0 + 1, k), d = U(x0 + 1, z0 + 1, k);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

// Trunks of the village trees: connected mallorn log cells of the layer y (just under the lowest deck) with at least FLOOR.minTrunk cells (a balcony pillar
// is a plus of 5). -> [{ x, z, r, size }] (x, z = centre of the cells, r = radius of equal area)
export function* findTrunksGen(at, rect, y) {
  const logs = new Map();
  let n = 0;
  for (let x = rect.x0; x <= rect.x1; x++) for (let z = rect.z0; z <= rect.z1; z++) {
    if (isLog(at(x, y, z))) logs.set(`${x},${z}`, [x, z]);
    if (++n % REPAIR.scanChunk === 0) yield;
  }
  const seen = new Set(), out = [];
  for (const [k0, s] of logs) {
    if (seen.has(k0)) continue;
    const comp = [], todo = [s];
    seen.add(k0);
    while (todo.length) {
      const [x, z] = todo.pop();
      comp.push([x, z]);
      for (const [a, b] of OFFSETS) { const q = `${x + a},${z + b}`; if (logs.has(q) && !seen.has(q)) { seen.add(q); todo.push(logs.get(q)); } }
    }
    if (comp.length < FLOOR.minTrunk) continue;
    out.push({ x: comp.reduce((a, c) => a + c[0], 0) / comp.length, z: comp.reduce((a, c) => a + c[1], 0) / comp.length, r: Math.sqrt(comp.length / Math.PI), size: comp.length });
  }
  return out.sort((a, b) => a.x - b.x || a.z - b.z);
}

// The forest floor of a village. trunks: [{ x, z, r }] (central: true marks the central tree, else the one nearest a rope foot, else the biggest);
// ropeFoot: [{ x, z }] rope columns (the 3x3 round each stays bare); seed: any integer; o.y0: the cell row the ground scan starts from (just under the deck).
// -> { blocks: [{ x, y, z, id, states }], counts: { id: n }, skipped: n, reads: n }; every block stands on the first free cell above grass / dirt / podzol /
// moss / coarse / rooted dirt (the ground is the first such block under the scan start; water, stone, sand, a vanilla tree or an unloaded cell: no block).
export function* planForestFloorGen(at, rect, trunks, ropeFoot, seed, o = {}) {
  const feet = Array.isArray(ropeFoot) ? ropeFoot : ropeFoot ? [ropeFoot] : [];
  const out = { blocks: [], counts: {}, skipped: 0, reads: 0 };
  if (!trunks.length) return out;
  const nearest = (px, pz, list) => { let best = null; for (const f of list) { const d = Math.hypot(f.x - px, f.z - pz); if (!best || d < best.d) best = { f, d }; } return best; };
  let central = trunks.find((t) => t.central);
  if (!central) {
    const c = feet.length ? trunks.map((t) => ({ t, d: nearest(t.x, t.z, feet).d })).sort((a, b) => a.d - b.d)[0] : null;
    central = c && c.d <= 12 ? c.t : [...trunks].sort((a, b) => b.r - a.r)[0];
  }
  const rOf = (t) => t === central ? FLOOR.rCentral : FLOOR.rTree, pOf = (t) => t === central ? FLOOR.pCentral : FLOOR.pTree, r0Of = (t) => Math.max(1.5, t.r);
  const S = (seed | 0) * 7919;
  // candidate cells: the disc round every trunk; a cell belongs to the trunk it is closest to (in disc fractions)
  const cells = new Map();
  for (const t of trunks) {
    const R = rOf(t), r0 = r0Of(t);
    for (let x = Math.floor(t.x - R); x <= Math.ceil(t.x + R); x++) for (let z = Math.floor(t.z - R); z <= Math.ceil(t.z + R); z++) {
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < r0 + 0.5 || d > R || x < rect.x0 || x > rect.x1 || z < rect.z0 || z > rect.z1) continue;
      if (feet.some((f) => Math.abs(f.x - x) <= FLOOR.clear && Math.abs(f.z - z) <= FLOOR.clear)) continue;
      const frac = (d - r0) / (R - r0), k = `${x},${z}`, cur = cells.get(k);
      if (!cur || frac < cur.t) cells.set(k, { x, z, t: frac, d, trunk: t });
    }
  }
  const list = [...cells.values()].sort((a, b) => a.x - b.x || a.z - b.z);
  // the ground of each column (memoised): { gy, id } | null. A neighbour's ground height is the hint for the next scan.
  const ground = new Map();
  let hint = null;
  const scan = (c, y0, stop) => {
    for (let y = y0; y > stop; y--) {
      const n = at(c.x, y, c.z);
      out.reads++;
      if (n === undefined) return null; // unloaded: no block
      if (SEE_THROUGH(n)) continue;
      return FLOOR_GROUND.test(n) ? { gy: y, id: n } : null;
    }
    return null;
  };
  const groundOf = (c) => {
    const k = `${c.x},${c.z}`;
    if (ground.has(k)) return ground.get(k);
    const start = hint === null ? undefined : at(c.x, hint + 4, c.z);
    const res = start !== undefined && SEE_THROUGH(start) ? scan(c, hint + 4, hint - REPAIR.flareScan) : scan(c, o.y0, o.y0 - REPAIR.flareScan);
    if (res) hint = res.gy;
    ground.set(k, res);
    return res;
  };
  const free = (c, g) => { const n = at(c.x, g.gy + 1, c.z); return n !== undefined && (isAir(n) || FLOOR_OPEN.has(n)); };
  const put = new Map(); // "x,z" -> { x, y, z, id, states, d }
  const place = (c, g, b) => put.set(`${c.x},${c.z}`, { x: c.x, y: g.gy + 1, z: c.z, id: b.id, states: b.states, d: c.d });
  const onGrass = (g) => g.id === "minecraft:grass_block";
  const dirOf = (c, k) => DIRS4[Math.floor(U(c.x, c.z, k) * 4)];
  const make = (c, g, kind) => {
    const grow = Math.floor(U(c.x, c.z, S + 7) * 4); // 0-3: valid whether `growth` counts segments from 0 or from 1 (not verified in game)
    switch (kind) {
      case "litter": return { id: "minecraft:leaf_litter", states: { growth: grow, "minecraft:cardinal_direction": dirOf(c, S + 8) } };
      case "wild": return { id: "minecraft:wildflowers", states: { growth: grow, "minecraft:cardinal_direction": dirOf(c, S + 8) } };
      case "carpet": return { id: "lothlorien:mallorn_leaf_carpet", states: { "lothlorien:amount": Math.min(4, 1 + Math.floor(U(c.x, c.z, S + 9) * 3 + (c.t < 0.4 ? 1 : 0))), "lothlorien:on_grass": onGrass(g), "minecraft:cardinal_direction": dirOf(c, S + 8) } };
      case "fern": return { id: "minecraft:fern", states: {} };
      default: return { id: `lothlorien:${kind}`, states: { "lothlorien:on_grass": onGrass(g) } };
    }
  };
  // themes: a jittered grid of blobs; the nearest blob point of a cell gives its theme and its fill. Flowers round the trunk feet, litter and ferns outside.
  const B = FLOOR.blob, blobs = new Map();
  const blobOf = (gx, gz) => {
    const k = `${gx},${gz}`;
    let b = blobs.get(k);
    if (!b) {
      const px = gx * B + U(gx, gz, S + 1) * B, pz = gz * B + U(gx, gz, S + 2) * B, nt = trunks.map((t) => ({ t, d: Math.hypot(t.x - px, t.z - pz) })).sort((p, q) => p.d - q.d)[0];
      const R = rOf(nt.t), r0 = r0Of(nt.t), t = Math.min(1, Math.max(0, (nt.d - r0) / (R - r0)));
      const w = [["flower", t < 0.4 ? 0.1 + 0.85 * (1 - t / 0.4) ** 1.5 : 0], ["litter", 0.7 + 0.8 * t], ["drift", 0.6], ["fern", 0.25 + 1.0 * t], ["bare", 0.45 + 0.5 * t]];
      let u = U(gx, gz, S + 3) * w.reduce((a, q) => a + q[1], 0), theme = "bare";
      for (const q of w) { if (u < q[1]) { theme = q[0]; break; } u -= q[1]; }
      b = { px, pz, theme, fill: 0.45 + 1.1 * U(gx, gz, S + 4) };
      blobs.set(k, b);
    }
    return b;
  };
  const blobAt = (x, z) => {
    let best = null;
    for (let gx = Math.floor(x / B) - 1; gx <= Math.floor(x / B) + 1; gx++) for (let gz = Math.floor(z / B) - 1; gz <= Math.floor(z / B) + 1; gz++) {
      const b = blobOf(gx, gz), d = (b.px - x) ** 2 + (b.pz - z) ** 2;
      if (!best || d < best.d) best = { b, d };
    }
    return { b: best.b, d: Math.sqrt(best.d) };
  };
  let n = 0;
  for (const c of list) {
    if (++n % 64 === 0) yield;
    const g = groundOf(c);
    if (!g || !free(c, g)) { out.skipped++; continue; }
    const p = FLOOR.pEdge + (pOf(c.trunk) - FLOOR.pEdge) * (1 - c.t) ** 1.7, { b, d: bd } = blobAt(c.x, c.z);
    if (b.theme === "bare") continue;
    // a patch: full in the blob core, thinning to its edge (so the plants lie in drifts); the blob's fill and the distance to the trunk scale it
    const core = Math.max(0, 1 - (bd / (B * 0.85)) ** 2), pc = Math.min(1, p * b.fill * 2.2) * (0.75 + 0.5 * vnoise(c.x, c.z, 3, S + 5));
    if (U(c.x, c.z, S + 5) >= core * pc * 1.4) continue;
    const u = U(c.x, c.z, S + 10);
    let kind;
    // owner 2026-10-15: no vanilla leaf litter under the village trees (mallorn carpets only), few flowers, in small clusters near the trunk feet
    if (b.theme === "litter" || b.theme === "drift") kind = u < 0.88 ? "carpet" : "fern";
    else if (b.theme === "fern") kind = u < 0.9 ? "fern" : u < 0.96 ? "golden_fern" : "carpet";
    else kind = u < 0.3 ? "elanor" : u < 0.58 ? "niphredil" : u < 0.8 ? "wild" : u < 0.9 ? "golden_fern" : "carpet";
    place(c, g, make(c, g, kind));
  }
  // fireflies (2-4 per tree) and small moss patches (2-4 cells): explicit, over whatever the blobs chose
  const eligible = (x, z) => { const c = cells.get(`${x},${z}`); if (!c) return null; const g = groundOf(c); return g && free(c, g) ? { c, g } : null; };
  const isBush = (e) => put.get(`${e.c.x},${e.c.z}`)?.id === "minecraft:firefly_bush";
  const ring = (t, R, lo, hi, i, k) => { const a = U(i, k, S + 21) * Math.PI * 2, d = t.r + lo + (R - t.r - lo - 1) * (hi * U(i, k, S + 22)); return eligible(Math.round(t.x + Math.cos(a) * d), Math.round(t.z + Math.sin(a) * d)); };
  for (const [ti, t] of trunks.entries()) {
    yield;
    const R = rOf(t), h = hash(Math.round(t.x), Math.round(t.z), S + 20), want = t === central ? FLOOR.fireflies[1] + 1 : FLOOR.fireflies[0] + (h % (FLOOR.fireflies[1] - FLOOR.fireflies[0] + 1));
    for (let i = 0, got = 0; i < 60 && got < want; i++) {
      const e = ring(t, R, 2.5, 1, ti, i);
      if (!e || isBush(e)) continue;
      place(e.c, e.g, { id: "minecraft:firefly_bush", states: {} }); got++;
    }
    const patches = t === central ? FLOOR.mossCentral : FLOOR.mossTree[0] + (h % (FLOOR.mossTree[1] - FLOOR.mossTree[0] + 1));
    for (let m = 0; m < patches; m++) {
      const size = 2 + Math.floor(U(ti, m, S + 24) * 3);
      let first = null;
      for (let i = 0; i < 30 && !first; i++) { const e = ring(t, R, 3, 1, ti, 100 + m * 31 + i); if (e && !isBush(e)) first = e; }
      if (!first) continue;
      const patch = [first];
      for (let i = 0; i < 14 && patch.length < size; i++) {
        const from = patch[Math.floor(U(ti, m * 17 + i, S + 27) * patch.length)], [dx, dz] = OFFSETS[Math.floor(U(ti, m * 17 + i, S + 28) * 4)], e = eligible(from.c.x + dx, from.c.z + dz);
        if (e && !isBush(e) && !patch.some((q) => q.c === e.c)) patch.push(e);
      }
      for (const e of patch) place(e.c, e.g, { id: "minecraft:moss_carpet", states: {} });
    }
  }
  // budget: the cells nearest a trunk win
  const all = [...put.values()].sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z).slice(0, FLOOR.maxBlocks).sort((a, b) => a.x - b.x || a.z - b.z);
  for (const b of all) { out.blocks.push({ x: b.x, y: b.y, z: b.z, id: b.id, states: b.states }); out.counts[b.id] = (out.counts[b.id] ?? 0) + 1; }
  return out;
}
export const planForestFloor = (at, rect, trunks, ropeFoot, seed, o) => drive(planForestFloorGen(at, rect, trunks, ropeFoot, seed, o));

// All repairs of a village (the planner calls this after the links): -> [{ kind: "rope", x, z, buried, hung, cells: [], rails: [], lanterns: [], blocks }]
export function* repairGen(at, markers, o = {}) {
  if (o.repairs === false || !markers.length) return [];
  const rect = o.rect ?? growRect(hullOf(markers), 24), y = Math.min(...markers.map((m) => m[1])), out = [];
  const ropes = yield* findRopesGen(at, rect, y);
  const columns = ropes.filter((r) => at(r.x, r.y + 1, r.z) !== ROPE_ID); // the top piece of each column only (no rope above it)
  const feet = columns.map((r) => ({ x: r.x, z: r.z }));
  for (const top of columns) {
    yield;
    const fit = planRopeFit(at, top);
    if (fit.error) { o.log?.push(`rope ${top.x},${top.z}: ${fit.error}`); continue; }
    if (!fit.blocks.length) continue;
    const plan = { kind: "rope", x: top.x, z: top.z, buried: fit.buried, hung: fit.hung, cells: [], rails: [], lanterns: [], blocks: fit.blocks };
    at.apply(plan);
    out.push(plan);
  }
  // root flares: every pillar of a balcony / lookout (found once from the markers), at the real ground
  const seen = new Set();
  for (const m of markers) {
    yield;
    const pillar = findPillar(at, m);
    if (!pillar || seen.has(`${pillar.x},${pillar.z}`)) continue;
    seen.add(`${pillar.x},${pillar.z}`);
    let fl = planFlare(at, pillar);
    if (fl.ground !== undefined) { // bare foot first (the leaves would block the roots), then the roots on the cleared ground
      const cl = planPillarClear(at, pillar, fl.ground);
      if (cl.error) o.log?.push(`pillar clear ${pillar.x},${pillar.z}: ${cl.error}`);
      else if (cl.blocks.length) {
        const cp = { kind: "pillarclear", x: pillar.x, z: pillar.z, leaves: cl.leaves, twigs: cl.twigs, roots: 0, buried: 0, hung: 0, cells: [], rails: [], lanterns: [], blocks: cl.blocks };
        at.apply(cp);
        out.push(cp);
        fl = planFlare(at, pillar);
      }
    }
    if (fl.error) { o.log?.push(`flare ${pillar.x},${pillar.z}: ${fl.error}`); continue; }
    if (fl.skip) { o.log?.push(`flare ${pillar.x},${pillar.z}: skipped, ${fl.skip}`); continue; }
    if (!fl.blocks.length) continue;
    const plan = { kind: "flare", x: pillar.x, z: pillar.z, roots: fl.roots, buried: 0, hung: 0, cells: [], rails: [], lanterns: [], blocks: fl.blocks };
    at.apply(plan);
    out.push(plan);
  }
  // forest floor (7.8): the trunks of the trees (a layer scan just under the lowest deck), the real ground round them; o.floor === false turns it off
  if (o.floor !== false) {
    const trunks = yield* findTrunksGen(at, rect, y - 1);
    if (!trunks.length) o.log?.push("forest floor: no trunk found");
    else {
      const seed = hash(rect.x0 * 31 + rect.x1, rect.z0 * 31 + rect.z1, 77) >>> 4, fl = yield* planForestFloorGen(at, rect, trunks, feet, seed, { y0: y - 2 });
      if (fl.blocks.length) {
        const plan = { kind: "floor", x: Math.round(trunks[0].x), z: Math.round(trunks[0].z), trunks: trunks.length, counts: fl.counts, buried: 0, hung: 0, cells: [], rails: [], lanterns: [], blocks: fl.blocks };
        at.apply(plan);
        out.push(plan);
      }
    }
  }
  return out;
}

export const describeRepair = (p) => p.kind === "floor" ? `forest floor: ${p.blocks.length} blocks round ${p.trunks} trunks (${Object.entries(p.counts).map(([k, v]) => `${k.replace(/^.*:/, "")} ${v}`).join(", ")})` : p.kind === "pillarclear" ? `pillar at ${p.x},${p.z}: ${p.leaves} leaves, ${p.twigs} twigs cleared at the foot` : p.kind === "flare" ? `pillar at ${p.x},${p.z}: ${p.roots} roots (${p.blocks.length} logs)` : `rope at ${p.x},${p.z}: -${p.buried} buried, +${p.hung} hung`;
