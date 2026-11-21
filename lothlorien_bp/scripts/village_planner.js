// Village loop PLANNER (owner decision 2026-10-09): ONE planner run per village replaces the per-marker loop closer. Pure JS (no fs, no Node or
// Bedrock imports): scripts/loop_marker.js runs it in game, tools/village_sim.mjs runs the very same functions on the simulated village,
// tests/run.mjs checks them. The plan builders (planSpan / planPlaza / planL / planPier / lanterns / clutter / blockedCells) stay in village_loop.js.
//
// Inputs are exactly what the runtime has: a block reader `at(x, y, z)` over a box that a script ticking area keeps loaded (undefined outside it)
// and the loop_marker cells (deck cell under each marker) that discoverVillage() collected.
//   1 starts      exit markers -> exitAt; rim markers -> sideStarts (<= LOOP.sideStarts rim cells within LOOP.sideSearch)
//   2 candidates  every exit-exit / exit-side / side-side / plaza / L target in reach (geometry only)
//   3 score       value = shortcut gained (walking distance through the existing deck network) - cost of the new link
//   4 greedy      take the best, build its real plan, apply it to an overlay world, enumerate and score again; stop at the budget
import { hullOf, chunkAlign, growRect, inRect, chunksIn, drive, pace, sortXZ } from "./village_geom.js";
import { repairGen } from "./village_repair.js";
import { PLANKS, SLAB, FENCE, isPlank, LOOP, exitAt, sideTarget, sideStarts, scanAhead, findPlazaPartnersGen, findLsGen, fenceTest, sideStartsGen, planSpanGen, planPlazaGen, planLGen, planMergeGen, blockedCellsGen, clutterGen, planPierGen, finalBlocks, isNewKind, MERGE, findMerges, finalBlocksGen } from "./village_loop.js";

export { hullOf, chunkAlign, growRect, inRect, chunksIn, drive }; // their home is village_geom.js; existing importers keep working

// budget: extra links per village (owner 2026-10-09: up to 3). minNet/minRatio: a link must save at least 30 cells of walking and be 2.5 times shorter
// than the way round. value = min(dnet, maxNet) - 2 len - kindCost - landingCost - 0.5 |offset|; spread: a candidate within 12 blocks of a chosen end loses 15.
// mergeCap: merges (touching / nearly touching decks opened into one, village_loop.js MERGE) per village; they are NOT part of `budget` (they add no bridge,
// they repair a jigsaw artefact: owner screenshots gap8 / gap9 2026-10-09).
// L-joins (owner 2026-10-09 after the in-game run built L joins of total length 26 and 24: "I think we may exclude big L shapes"): total length
// (both legs and the landing, = c.len) <= lMaxLen, each leg (bridge blocks between the exit and the landing edge, s - 2) <= lMaxLeg.
export const PLAN = { mergeCap: 6, lMaxLen: 16, lMaxLeg: 10, budget: 3, minNet: 30, minRatio: 2.5, minValue: 10, spread: 12, kindCost: { exit: 0, plaza: 3, side: 3, sideside: 6, L: 8 }, landingCost: 6, maxNet: 140 };
// Ticking area: margin = blocks added round the known markers each round (a village piece is at most ~40 blocks from the next marker), maxRounds,
// and the smaller margins tried when the pack's chunk quota (TickingAreaManager.maxChunkCount) does not fit the first one.
// seed = blocks added round the FIRST marker only, in round 1 (owner 2026-10-09: the 4-round run took ~13 s; villages are ~100 x 100 blocks, at most ~155), so a typical village is
// found in 1-2 rounds instead of 4; later rounds grow from the known markers as before. Dropped when the quota does not fit it.
export const AREA = { seed: 48, margins: [32, 28, 24], maxRounds: 8, minPad: 12, maxDone: 256, maxTries: 3 };

const isWalk = (n) => isPlank(n) || n === SLAB || (typeof n === "string" && /_stairs?$/.test(n));
const key = (x, y, z) => `${x},${y},${z}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], DY = [0, 1, -1]; // BFS steps, hoisted out of the per-cell loops
const WX = [], WY = [], WZ = []; // the 12 walk steps (4 sides x dy 0, +1, -1) as flat number arrays, same order as before
for (const [a, b] of N4) for (const dy of DY) { WX.push(a); WY.push(dy); WZ.push(b); }

// shortest walking distance (cells) from A over deck cells (4-neighbours, |dy| <= 1: arched slab bridges, stairs) to every cell, up to `limit`.
// Allocation-free per pop (QuickJS GC pauses of 20+ ms landed in these steps, owner DIAG 0.8.9): numeric cell keys (walkKey), the queue is three plain number
// arrays, the neighbour loops are unrolled over constants. `goals` (optional Set of walkKeys): the search stops once every goal has a distance (a BFS
// distance never changes after its first visit), so a candidate pair does not flood the whole deck network. `work` (optional { dist, qx, qy, qz }) is reused.
export const walkKey = (x, y, z) => ((x + 32768) * 65536 + (z + 32768)) * 1024 + (y + 256);
export function walkDist(at, A, limit = 400) {
  return drive(walkDistGen(at, A, limit));
}
export function* walkDistGen(at, A, limit = 400, goals = null, work = null) {
  const dist = work?.dist ?? new Map(), qx = work?.qx ?? [], qy = work?.qy ?? [], qz = work?.qz ?? [];
  dist.clear(); qx.length = qy.length = qz.length = 0;
  dist.set(walkKey(A.x, A.y, A.z), 0); qx.push(A.x); qy.push(A.y); qz.push(A.z);
  let left = goals ? goals.size : -1;
  if (goals?.has(walkKey(A.x, A.y, A.z))) left--;
  for (let i = 0; i < qx.length && left !== 0; i++) {
    if (i % 8 === 0) yield "walkDist";
    const x = qx[i], y = qy[i], z = qz[i], d = dist.get(walkKey(x, y, z));
    if (d >= limit) continue;
    for (let n = 0; n < 12; n++) {
      const nx = x + WX[n], ny = y + WY[n], nz = z + WZ[n], k = walkKey(nx, ny, nz);
      if (dist.has(k) || !isWalk(at(nx, ny, nz))) continue;
      dist.set(k, d + 1); qx.push(nx); qy.push(ny); qz.push(nz);
      if (goals?.has(k)) left--;
    }
  }
  return dist;
}

// can a walker get from A to B (deck cells of one height, no railing on top, 4-neighbours) in at most `limit` steps? (merges: are the two decks joined already)
export function openWalk(at, A, B, limit) {
  const dist = new Map([[key(A.x, A.y, A.z), 0]]), q = [[A.x, A.z]];
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i], d = dist.get(key(x, A.y, z));
    if (x === B.x && z === B.z) return true;
    if (d >= limit) continue;
    for (const [a, b] of N4) {
      const k = key(x + a, A.y, z + b);
      if (dist.has(k) || !isPlank(at(x + a, A.y, z + b)) || at(x + a, A.y + 1, z + b) === FENCE) continue;
      dist.set(k, d + 1); q.push([x + a, z + b]);
    }
  }
  return false;
}

// Starts from the marker cells: an exit marker is an exit start; a marker on a plain rim gives up to LOOP.sideStarts rim starts.
export const startsFromMarkers = (at, markers) => drive(startsFromMarkersGen(at, markers));
export function* startsFromMarkersGen(at, markers) {
  const exits = [], rims = [], seenE = new Set(), seenR = new Set(), due = pace(at);
  for (const [x, y, z] of markers) {
    const e = exitAt(at, x, y, z);
    if (e) { if (!seenE.has(key(e.x, e.y, e.z))) { seenE.add(key(e.x, e.y, e.z)); exits.push(e); } continue; }
    const sides = yield* sideStartsGen(at, x, y, z);
    for (const A of sides) {
      const k = key(A.x, A.y, A.z) + A.dir; if (seenR.has(k)) continue; seenR.add(k);
      rims.push({ ...A, run: `${x},${y},${z}|${A.dir}` });
    }
    if (due()) yield "starts";
  }
  return { exits, rims };
}

const pairKey = (a, b) => (a.x < b.x || (a.x === b.x && a.z < b.z) ? `${key(a.x, a.y, a.z)}~${key(b.x, b.y, b.z)}` : `${key(b.x, b.y, b.z)}~${key(a.x, a.y, a.z)}`);

// every raw candidate (geometry only, nothing built yet)
export const enumerate = (at, starts) => drive(enumerateGen(at, starts));
export function* enumerateGen(at, starts) {
  const out = new Map(), add = (c) => { const k = c.kind + "|" + pairKey(c.A, c.B); if (!out.has(k) || out.get(k).score > c.score) out.set(k, c); };
  const fences = new Map(), due = pace(at); // the fence set of each level, from the native layer query (a fan reads hundreds of cells)
  const fenceOf = function* (y) { if (!fences.has(y)) fences.set(y, yield* fenceTest(at, y + 1)); return fences.get(y); };
  for (const A of starts.exits) {
    yield "enumerate";
    const d = A.dir, isF = yield* fenceOf(A.y);
    for (const c of scanAhead(A, isF)) {
      const B = exitAt(at, c.x, A.y, c.z);
      if (B && B.dir[0] === -d[0] && B.dir[1] === -d[1]) add({ kind: "exit", A, B, dist: c.dist, offset: c.offset, len: c.length, score: c.score });
      else if (!B && sideTarget(at, c.x, A.y, c.z, d)) add({ kind: "side", A, B: { x: c.x, y: A.y, z: c.z }, dist: c.dist, offset: c.offset, len: c.length, score: c.score });
      if (due()) yield "scanAhead";
    }
    yield "plazaPartners";
    const partners = yield* findPlazaPartnersGen(at, A, isF);
    for (const c of partners) {
      const back = yield* findPlazaPartnersGen(at, c.B, yield* fenceOf(c.B.y));
      if (back.some((q) => q.B.x === A.x && q.B.z === A.z)) add({ kind: "plaza", A, B: c.B, dist: c.dist, offset: c.lat, len: c.dist + 1, score: c.score });
    }
    yield "findLs";
    const ls = yield* findLsGen(at, A, isF);
    for (const c of ls) {
      if (!(c.s + c.u + 1 <= PLAN.lMaxLen && c.s - 2 <= PLAN.lMaxLeg && c.u - 2 <= PLAN.lMaxLeg)) continue;
      const back = yield* findLsGen(at, c.B, yield* fenceOf(c.B.y));
      if (back.some((q) => q.B.x === A.x && q.B.z === A.z)) add({ kind: "L", A, B: c.B, s: c.s, u: c.u, dist: c.s + c.u, offset: 0, len: c.s + c.u + 1, score: c.score });
    }
  }
  // side-to-side: per rim start and per 7 x 7 cell of the far side only the best (shortest, least sideways) pair of start cells
  const grp = new Map();
  for (const A of starts.rims) {
    yield "sideSide";
    const isF = yield* fenceOf(A.y);
    for (const c of scanAhead(A, isF)) {
      if (exitAt(at, c.x, A.y, c.z) || !sideTarget(at, c.x, A.y, c.z, A.dir)) { if (due()) yield "scanAhead"; continue; }
      const B = { x: c.x, y: A.y, z: c.z }, cand = { kind: "sideside", A, B, dist: c.dist, offset: c.offset, len: c.length, score: c.score };
      const g = `${A.run}|${Math.floor(B.x / 7)},${Math.floor(B.z / 7)}`;
      if (!grp.has(g) || grp.get(g).score > cand.score) grp.set(g, cand);
      if (due()) yield "scanAhead";
    }
  }
  for (const c of grp.values()) add(c);
  return [...out.values()];
}

// the real build of one candidate: same checks as the old closer (blocked corridor, clutter for new kinds, pier for landings, lanterns inside the plan)
export const realize = (at, c) => drive(realizeGen(at, c));
export function* realizeGen(at, c) {
  try {
    if (c.kind === "plaza") { const plan = yield* planPlazaGen(at, c.A, c.B); return plan.error ? { error: plan.error, blocked: plan.blocked } : { plan }; }
    if (c.kind === "L") {
      const plan = yield* planLGen(c.A, c.B, c.s, c.u), blocked = yield* blockedCellsGen(at, plan);
      if (blocked.length) return { error: "blocked", blocked };
      if (yield* clutterGen(at, plan)) return { error: "clutter" };
      const pier = yield* planPierGen(at, plan.landing);
      if (pier.error) return { error: pier.error };
      plan.pier = pier.blocks; return { plan };
    }
    const sideStart = c.kind === "sideside", side = c.kind !== "exit";
    const plan = yield* planSpanGen(c.A, c.B, c.dist, c.offset, side, sideStart), blocked = yield* blockedCellsGen(at, plan);
    if (blocked.length) return { error: "blocked", blocked };
    if (isNewKind(sideStart, c.dist, c.offset) && (yield* clutterGen(at, plan))) return { error: "clutter" };
    if (plan.landing) { const pier = yield* planPierGen(at, plan.landing); if (pier.error) return { error: pier.error }; plan.pier = pier.blocks; }
    return { plan };
  } catch (e) { return { error: String(e.message ?? e) }; }
}

export function* scoreGen(at, cands, opts) {
  const o = { ...PLAN, ...opts };
  // one walk per distinct start A, run once with all its targets as goals; the distance maps are not kept (heap), only the wanted distances
  const goalsOf = new Map(), dnetOf = new Map(), work = { dist: new Map(), qx: [], qy: [], qz: [] };
  for (const c of cands) {
    const k = walkKey(c.A.x, c.A.y, c.A.z);
    let g = goalsOf.get(k); if (!g) goalsOf.set(k, g = { A: c.A, goals: new Set() });
    g.goals.add(walkKey(c.B.x, c.B.y, c.B.z));
  }
  for (const [k, g] of goalsOf) {
    const dist = yield* walkDistGen(at, g.A, 500, g.goals, work);
    const got = new Map(); for (const bk of g.goals) got.set(bk, dist.get(bk));
    dnetOf.set(k, got);
  }
  const list = [];
  for (const c of cands) {
    yield "scoreGen";
    const got = dnetOf.get(walkKey(c.A.x, c.A.y, c.A.z)).get(walkKey(c.B.x, c.B.y, c.B.z)); // B is on the same deck level; it is a plank cell
    const dnet = got === undefined ? 999 : got;
    const landing = c.dist > LOOP.maxDist || c.kind === "L" ? 1 : 0;
    const value = Math.min(dnet, o.maxNet) - 2 * c.len - o.kindCost[c.kind] - o.landingCost * landing - 0.5 * Math.abs(c.offset);
    if (dnet < o.minNet || dnet < o.minRatio * c.len) continue;
    list.push({ ...c, dnet, value, landing });
  }
  return list.sort((a, b) => b.value - a.value);
}

// overlay world: writes of chosen plans on top of the snapshot
// Over a boundedReader (at.nkey / at.rect) the lookups use numeric keys (no string building per read); `over` keeps the string keys for tools.
export function overlay(at) {
  const over = new Map(), byY = new Map(), nkey = at.nkey, rect = at.rect;
  const f = (x, y, z) => {
    const v = nkey && inRect(rect, x, z) ? byY.get(y)?.get((x - rect.x0) * 65536 + (z - rect.z0)) : over.get(key(x, y, z)); // one entry per cell: the per-level map (heap)
    return v !== undefined ? v : at(x, y, z);
  };
  // Heap (F7): over a boundedReader every cell inside the rect lives only in the per-level numeric map `byY` (no string key, no [x, z, id] array per cell);
  // `over` keeps the string keys of the cells outside the rect and of every cell when the reader has no nkey (the tools).
  const lk = (x, z) => (nkey && inRect(rect, x, z) ? (x - rect.x0) * 65536 + (z - rect.z0) : `${x},${z}`);
  const put = (k, b) => {
    const [x, y, z] = k.split(",").map(Number);
    if (!(nkey && inRect(rect, x, z))) over.set(k, b.id);
    let level = byY.get(y);
    if (!level) byY.set(y, level = new Map());
    level.set(lk(x, z), b.id);
  };
  f.apply = (plan) => { for (const [k, b] of finalBlocks(plan)) put(k, b); };
  f.applyGen = function* (plan) { // the same, a yield after every 32 cells (a plan is up to thousands of blocks)
    const fb = yield* finalBlocksGen(plan);
    let n = 0;
    for (const [k, b] of fb) { put(k, b); if (++n % 32 === 0) yield "apply"; }
  };
  // the base layer with this overlay's writes at height y taken out or added, x then z like a plain loop over the rect
  if (at.layer) f.layer = function* (y, ids, r) {
    const want = new Set(ids), level = byY.get(y), base = yield* at.layer(y, ids, r);
    const out = level ? base.filter(([x, z]) => !level.has(lk(x, z))) : base; // the base list is sorted and nobody mutates it: no copy
    let added = false;
    if (level) for (const [k, id] of level) {
      if (!want.has(id)) continue;
      const x = typeof k === "number" ? rect.x0 + Math.floor(k / 65536) : +k.split(",")[0], z = typeof k === "number" ? rect.z0 + (k % 65536) : +k.split(",")[1];
      if (inRect(r, x, z)) { out.push([x, z]); added = true; }
    }
    return added ? sortXZ(out) : out;
  };
  f.over = over;
  f.rect = rect; f.nkey = nkey; f.size = at.size;
  return f;
}

// planVillage(at0, markers, opts) -> { merges: [{ kind: "merge", A, B, plan, len, gap }], picks: [{ kind, A, B, plan, dnet, len, value }], repairs: [plan], nRaw, log, at }
//   markers: [[x, y, z]] deck cells under the loop markers. opts: PLAN overrides (budget ...).
export const planVillage = (at0, markers, opts = {}) => drive(planGen(at0, markers, opts));
export function* planGen(at0, markers, opts = {}) {
  const o = { ...PLAN, ...opts }, at = overlay(at0), picks = [], log = [], merges = [];
  // merges first: they change the deck network the links are scored on. Level = every deck height a marker stands on, area = opts.rect or the markers' hull + 24.
  if (markers.length && o.mergeCap > 0) {
    const rect = o.rect ?? growRect(hullOf(markers), 24), ys = [...new Set(markers.map((m) => m[1]))].sort((p, q) => p - q);
    for (const y of ys) {
      const found = yield* findMerges(at, y, rect);
      for (const m of found) {
        if (merges.length >= o.mergeCap) break;
        yield "merge";
        const r = yield* planMergeGen(at, m);
        if (!r.plan) { log.push(`merge ${m.run[0][0]},${m.run[0][1]} (${m.run.length}, gap ${m.g}): ${r.error}`); continue; }
        if (openWalk(at, r.plan.A, r.plan.B, MERGE.minNet - 1)) { log.push(`merge ${m.run[0][0]},${m.run[0][1]}: decks already joined by a short walk`); continue; }
        yield* at.applyGen(r.plan);
        merges.push({ kind: "merge", A: r.plan.A, B: r.plan.B, plan: r.plan, len: m.span[1] - m.span[0] + 1, gap: m.g });
      }
    }
  }
  const startsOf = function* () { return yield* startsFromMarkersGen(at, markers); };
  let cands = yield* enumerateGen(at, yield* startsOf());
  const nRaw = cands.length, tried = new Set();
  for (let round = 0; round < o.budget + 6 && picks.length < o.budget; round++) {
    const scored = (yield* scoreGen(at, cands, o)).filter((c) => !tried.has(c.kind + pairKey(c.A, c.B)));
    for (const c of scored) for (const p of picks) {
      if ([c.A, c.B].some((e) => [p.A, p.B].some((f) => Math.hypot(e.x - f.x, e.z - f.z) < o.spread))) c.value -= 15;
    }
    scored.sort((a, b) => b.value - a.value);
    let done = false;
    for (const c of scored.slice(0, 12)) {
      if (c.value < o.minValue) break;
      tried.add(c.kind + pairKey(c.A, c.B));
      yield "realize";
      const r = yield* realizeGen(at, c);
      if (!r.plan) { log.push(`${c.kind} ${c.A.x},${c.A.z}->${c.B.x},${c.B.z}: ${r.error}${r.blocked ? ` (${r.blocked[0].block} at ${r.blocked[0].x},${r.blocked[0].y},${r.blocked[0].z})` : ""}`); continue; }
      yield* at.applyGen(r.plan);
      picks.push({ kind: c.kind, A: c.A, B: c.B, plan: r.plan, dnet: c.dnet, len: c.len, value: Math.round(c.value) });
      done = true; break;
    }
    if (!done) break;
    yield "pick";
    cands = yield* enumerateGen(at, yield* startsOf()); // the network and the rims changed
  }
  // repairs last, on the finished network (village_repair.js: the rope fit); opts.repairs === false turns them off
  const repairs = yield* repairGen(at, markers, { ...o, log });
  return { picks, merges, repairs, nRaw, log, at };
}

// ---- ticking area discovery ---------------------------------------------------------------------------------------------------------

// Done-list (world dynamic property, JSON): rectangles of villages that were planned. A marker inside one is removed without planning.
export const parseDone = (s) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };
export const addDone = (list, r) => [...list, { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }].slice(-AREA.maxDone);
export const isDone = (list, x, z) => list.some((r) => inRect(r, x, z));
export const VILLAGE_PLANS = "lothlorien:village_plans"; // the world property that holds the done-list (loop_marker.js writes it)
// Owner 2026-10-20: a village on the biome edge counts as Lothlorien for gameplay. read() -> the done-list JSON; -> (x, z) => inside a planned
// village area. Parses again only when the property changed.
export function villageAreaTest(read) {
  let raw, list = [];
  return (x, z) => { const r = read(); if (r !== raw) { raw = r; list = parseDone(r); } return isDone(list, Math.floor(x), Math.floor(z)); };
}

// discoverVillage(env, first): load the village with script ticking areas and collect every loop marker of it. Starts at the marker `first`
// ([x, y, z] deck cell) and repeats: area = chunk-aligned hull of the known markers + margin; create it, wait, ask which markers lie in it;
// stop when the set no longer grows (at most AREA.maxRounds rounds). The previous area is removed once the next one is up.
//   env.claim(rect)          reserve the rectangle (markers that load inside it do not start another planner)
//   env.hasCapacity(rect)    the quota allows an area of this size (counting the areas that exist now)
//   env.create(id, rect)     Promise (the sim: nothing): all chunks loaded and ticking (rejects on error / timeout)
//   env.remove(id)           remove an area (never throws on a missing id)
//   env.markersIn(rect)      [[x, y, z]] deck cells under all live markers in the rect
// -> { rect, known, rounds, stable, ids: [the id still alive], sizes: [chunks per round] }; the caller removes env areas in finally.
export function* discoverGen(env, first, baseId) { // yields the promise of env.create: the runtime awaits it (discoverVillage), the simulator does not (discoverSync)
  const known = new Map([[key(...first), first]]), sizes = [];
  let alive = null, rect = null, stable = false, rounds = 0;
  const hull = () => hullOf([...known.values()]);
  const fit = () => {
    for (const seed of rounds === 0 ? [AREA.seed, 0] : [0]) for (const m of AREA.margins) { const r = chunkAlign(growRect(hull(), m + seed)); if (env.hasCapacity(r)) return r; }
    return null;
  };
  for (; rounds < AREA.maxRounds;) {
    let next = fit();
    if (!next && alive) { env.remove(alive); alive = null; next = fit(); } // the old area counts against the quota: drop it first
    if (!next) { if (!rect) throw new Error("over chunk limit"); break; }
    if (rect && next.x0 >= rect.x0 && next.x1 <= rect.x1 && next.z0 >= rect.z0 && next.z1 <= rect.z1) { stable = true; break; } // the loaded area already holds everything the next one would ask for
    env.claim(next);
    const id = `${baseId}_${++rounds}`;
    yield env.create(id, next);
    if (alive) env.remove(alive);
    alive = id; rect = next; sizes.push(chunksIn(next));
    let grew = 0;
    for (const c of env.markersIn(next)) if (!known.has(key(...c))) { known.set(key(...c), c); grew++; }
    if (!grew) { stable = true; break; }
  }
  return { rect, known: [...known.values()], rounds, stable, ids: alive ? [alive] : [], sizes };
}

export async function discoverVillage(env, first, baseId) {
  const g = discoverGen(env, first, baseId);
  let r = g.next();
  while (!r.done) { try { await r.value; } catch (e) { r = g.throw(e); continue; } r = g.next(); }
  return r.value;
}
export const discoverSync = (env, first, baseId) => drive(discoverGen(env, first, baseId));

// a block reader that sees only what the ticking area holds: `get(x, y, z)` for cells inside the rect, undefined outside (and memoised)
// Memo: a palette of the names read (a few dozen per village) and one Uint16Array per 16 x 16 column slice and height (0 = not read yet,
// 1 = unloaded). A Map entry per cell was ~150-180 B in QuickJS, 30-65 MB per village (watchdog warning, owner 2026-10-27); this is ~1 MB.
// `.size()` = distinct reads so far (the planner's timing log), `.rect` / `.nkey` are used by overlay().
export function boundedReader(get, rect, layer) {
  const nkey = (x, y, z) => ((x - rect.x0) * 4096 + (z - rect.z0)) * 1024 + (y + 256);
  const pages = new Map(), names = [undefined, undefined], codes = new Map();
  let reads = 0;
  const reader = (x, y, z) => {
    if (!inRect(rect, x, z)) return undefined;
    const dx = x - rect.x0, dz = z - rect.z0, pk = ((dx >> 4) * 4096 + (dz >> 4)) * 1024 + (y + 256);
    let page = pages.get(pk);
    if (!page) { page = new Uint16Array(256); pages.set(pk, page); }
    const i = (dx & 15) * 16 + (dz & 15), c = page[i];
    if (c) return names[c];
    const v = get(x, y, z);
    reads++;
    let code = v === undefined ? 1 : codes.get(v);
    if (code === undefined) { code = names.length; names.push(v); codes.set(v, code); }
    page[i] = code;
    return v;
  };
  reader.size = () => reads; reader.rect = rect; reader.nkey = nkey;
  // layer (optional): generator (y, ids, r) -> [[x, z]] of the world's cells in r; clipped to this reader's rect, which is all the reader can see
  if (layer) reader.layer = function* (y, ids, r) {
    const clip = { x0: Math.max(r.x0, rect.x0), x1: Math.min(r.x1, rect.x1), z0: Math.max(r.z0, rect.z0), z1: Math.min(r.z1, rect.z1) };
    return clip.x0 > clip.x1 || clip.z0 > clip.z1 ? [] : yield* layer(y, ids, clip);
  };
  return reader;
}

// one-line description of a pick for logs / chat
export const describeMerge = (m) => `merge ${m.A.x},${m.A.y},${m.A.z} <-> ${m.B.x},${m.B.z} (${m.len} cells, gap ${m.gap})`;
export const describePick = (p) => `${p.kind} ${p.A.x},${p.A.y},${p.A.z} -> ${p.B.x},${p.B.z} (length ${p.len}${p.plan.landing ? ", landing" : ""}, saves ${p.dnet})`;
