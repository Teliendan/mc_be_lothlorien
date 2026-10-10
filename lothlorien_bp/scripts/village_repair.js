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
import { hullOf, growRect } from "./village_planner.js";

export const ROPE_ID = "lothlorien:elven_rope_hanging";
export const REPAIR = { maxHang: 24, minAbove: 2, scanChunk: 512, flareScan: 48, flareStep: 1, PILLAR_LEAF_CLEAR: 4 };
const LEAF_ID = "lothlorien:mallorn_leaves";
const LOGS = new Set(["lothlorien:mallorn_log", "lothlorien:mallorn_wood"]);
const FACE_OF = { "1,0": "west", "-1,0": "east", "0,1": "north", "0,-1": "south" }; // wall offset from the piece -> rope face (the wall lies opposite)
const OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AIRS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);
const WET = (n) => n === "minecraft:water" || n === "minecraft:flowing_water" || n === "minecraft:lava" || n === "minecraft:flowing_lava" || /seagrass|kelp|bubble_column/.test(n ?? "");
const SOFT = /short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|daisy|orchid|allium|bluet|cornflower|lily|bush|sapling|snow_layer|leaf_litter|petals|vine|mushroom|dead_bush|sweet_berry|azalea/;
const VILLAGE = /^lothlorien:(mallorn_(planks|slab|fence|log|wood|stairs|leaves)|elven_)/;
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

// All repairs of a village (the planner calls this after the links): -> [{ kind: "rope", x, z, buried, hung, cells: [], rails: [], lanterns: [], blocks }]
export function* repairGen(at, markers, o = {}) {
  if (o.repairs === false || !markers.length) return [];
  const rect = o.rect ?? growRect(hullOf(markers), 24), y = Math.min(...markers.map((m) => m[1])), out = [];
  const ropes = yield* findRopesGen(at, rect, y);
  const columns = ropes.filter((r) => at(r.x, r.y + 1, r.z) !== ROPE_ID); // the top piece of each column only (no rope above it)
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
  return out;
}

export const describeRepair = (p) => p.kind === "pillarclear" ? `pillar at ${p.x},${p.z}: ${p.leaves} leaves, ${p.twigs} twigs cleared at the foot` : p.kind === "flare" ? `pillar at ${p.x},${p.z}: ${p.roots} roots (${p.blocks.length} logs)` : `rope at ${p.x},${p.z}: -${p.buried} buried, +${p.hung} hung`;
