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
import { repairGen } from "./village_repair.js";
import { PLANKS, SLAB, FENCE, isPlank, LOOP, exitAt, sideTarget, sideStarts, scanAhead, findPlazaPartners, findLs, planSpan, planPlaza, planL, blockedCells, clutter, planPier, finalBlocks, isNewKind, MERGE, findMerges, planMerge } from "./village_loop.js";

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
export const AREA = { seed: 48, margins: [32, 28, 24], maxRounds: 8, minPad: 12, maxDone: 64, maxTries: 3 };

const isWalk = (n) => isPlank(n) || n === SLAB || (typeof n === "string" && /_stairs?$/.test(n));
const key = (x, y, z) => `${x},${y},${z}`;

// shortest walking distance (cells) from A over deck cells (4-neighbours, |dy| <= 1: arched slab bridges, stairs) to every cell, up to `limit`
export function walkDist(at, A, limit = 400) {
  const dist = new Map([[key(A.x, A.y, A.z), 0]]), q = [[A.x, A.y, A.z]];
  for (let i = 0; i < q.length; i++) {
    const [x, y, z] = q[i], d = dist.get(key(x, y, z));
    if (d >= limit) continue;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const dy of [0, 1, -1]) {
      const nx = x + a, ny = y + dy, nz = z + b, k = key(nx, ny, nz);
      if (dist.has(k) || !isWalk(at(nx, ny, nz))) continue;
      dist.set(k, d + 1); q.push([nx, ny, nz]);
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
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(x + a, A.y, z + b);
      if (dist.has(k) || !isPlank(at(x + a, A.y, z + b)) || at(x + a, A.y + 1, z + b) === FENCE) continue;
      dist.set(k, d + 1); q.push([x + a, z + b]);
    }
  }
  return false;
}

// Starts from the marker cells: an exit marker is an exit start; a marker on a plain rim gives up to LOOP.sideStarts rim starts.
export function startsFromMarkers(at, markers) {
  const exits = [], rims = [], seenE = new Set(), seenR = new Set();
  for (const [x, y, z] of markers) {
    const e = exitAt(at, x, y, z);
    if (e) { if (!seenE.has(key(e.x, e.y, e.z))) { seenE.add(key(e.x, e.y, e.z)); exits.push(e); } continue; }
    for (const A of sideStarts(at, x, y, z)) {
      const k = key(A.x, A.y, A.z) + A.dir; if (seenR.has(k)) continue; seenR.add(k);
      rims.push({ ...A, run: `${x},${y},${z}|${A.dir}` });
    }
  }
  return { exits, rims };
}

const pairKey = (a, b) => (a.x < b.x || (a.x === b.x && a.z < b.z) ? `${key(a.x, a.y, a.z)}~${key(b.x, b.y, b.z)}` : `${key(b.x, b.y, b.z)}~${key(a.x, a.y, a.z)}`);

// every raw candidate (geometry only, nothing built yet)
export function enumerate(at, starts) {
  const out = new Map(), add = (c) => { const k = c.kind + "|" + pairKey(c.A, c.B); if (!out.has(k) || out.get(k).score > c.score) out.set(k, c); };
  for (const A of starts.exits) {
    const d = A.dir;
    for (const c of scanAhead(A, (x, z) => at(x, A.y + 1, z) === FENCE)) {
      const B = exitAt(at, c.x, A.y, c.z);
      if (B && B.dir[0] === -d[0] && B.dir[1] === -d[1]) add({ kind: "exit", A, B, dist: c.dist, offset: c.offset, len: c.length, score: c.score });
      else if (!B && sideTarget(at, c.x, A.y, c.z, d)) add({ kind: "side", A, B: { x: c.x, y: A.y, z: c.z }, dist: c.dist, offset: c.offset, len: c.length, score: c.score });
    }
    for (const c of findPlazaPartners(at, A)) if (findPlazaPartners(at, c.B).some((q) => q.B.x === A.x && q.B.z === A.z)) add({ kind: "plaza", A, B: c.B, dist: c.dist, offset: c.lat, len: c.dist + 1, score: c.score });
    for (const c of findLs(at, A)) if (c.s + c.u + 1 <= PLAN.lMaxLen && c.s - 2 <= PLAN.lMaxLeg && c.u - 2 <= PLAN.lMaxLeg && findLs(at, c.B).some((q) => q.B.x === A.x && q.B.z === A.z)) add({ kind: "L", A, B: c.B, s: c.s, u: c.u, dist: c.s + c.u, offset: 0, len: c.s + c.u + 1, score: c.score });
  }
  // side-to-side: per rim start and per 7 x 7 cell of the far side only the best (shortest, least sideways) pair of start cells
  const grp = new Map();
  for (const A of starts.rims) {
    for (const c of scanAhead(A, (x, z) => at(x, A.y + 1, z) === FENCE && !exitAt(at, x, A.y, z) && sideTarget(at, x, A.y, z, A.dir))) {
      const B = { x: c.x, y: A.y, z: c.z }, cand = { kind: "sideside", A, B, dist: c.dist, offset: c.offset, len: c.length, score: c.score };
      const g = `${A.run}|${Math.floor(B.x / 7)},${Math.floor(B.z / 7)}`;
      if (!grp.has(g) || grp.get(g).score > cand.score) grp.set(g, cand);
    }
  }
  for (const c of grp.values()) add(c);
  return [...out.values()];
}

// the real build of one candidate: same checks as the old closer (blocked corridor, clutter for new kinds, pier for landings, lanterns inside the plan)
export function realize(at, c) {
  try {
    if (c.kind === "plaza") { const plan = planPlaza(at, c.A, c.B); return plan.error ? { error: plan.error, blocked: plan.blocked } : { plan }; }
    if (c.kind === "L") {
      const plan = planL(c.A, c.B, c.s, c.u), blocked = blockedCells(at, plan);
      if (blocked.length) return { error: "blocked", blocked };
      if (clutter(at, plan)) return { error: "clutter" };
      const pier = planPier(at, plan.landing);
      if (pier.error) return { error: pier.error };
      plan.pier = pier.blocks; return { plan };
    }
    const sideStart = c.kind === "sideside", side = c.kind !== "exit";
    const plan = planSpan(c.A, c.B, c.dist, c.offset, side, sideStart), blocked = blockedCells(at, plan);
    if (blocked.length) return { error: "blocked", blocked };
    if (isNewKind(sideStart, c.dist, c.offset) && clutter(at, plan)) return { error: "clutter" };
    if (plan.landing) { const pier = planPier(at, plan.landing); if (pier.error) return { error: pier.error }; plan.pier = pier.blocks; }
    return { plan };
  } catch (e) { return { error: String(e.message ?? e) }; }
}

// Generators (`function*`) yield now and then so the runtime can run a planner inside system.runJob without one long tick; `drive` runs one to the end.
export function drive(gen) { let r = gen.next(); while (!r.done) r = gen.next(); return r.value; }

export function* scoreGen(at, cands, opts) {
  const o = { ...PLAN, ...opts }, maps = new Map();
  const dm = (A) => { const k = key(A.x, A.y, A.z); if (!maps.has(k)) maps.set(k, walkDist(at, A, 500)); return maps.get(k); };
  const list = [];
  for (const c of cands) {
    yield;
    const got = dm(c.A).get(key(c.B.x, c.B.y, c.B.z)); // B is on the same deck level; it is a plank cell
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
  const over = new Map(), fast = new Map(), nkey = at.nkey, rect = at.rect;
  const f = (x, y, z) => {
    const v = nkey && inRect(rect, x, z) ? fast.get(nkey(x, y, z)) : over.get(key(x, y, z));
    return v !== undefined ? v : at(x, y, z);
  };
  f.apply = (plan) => {
    for (const [k, b] of finalBlocks(plan)) {
      over.set(k, b.id);
      if (nkey) { const [x, y, z] = k.split(",").map(Number); if (inRect(rect, x, z)) fast.set(nkey(x, y, z), b.id); }
    }
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
        yield;
        const r = planMerge(at, m);
        if (!r.plan) { log.push(`merge ${m.run[0][0]},${m.run[0][1]} (${m.run.length}, gap ${m.g}): ${r.error}`); continue; }
        if (openWalk(at, r.plan.A, r.plan.B, MERGE.minNet - 1)) { log.push(`merge ${m.run[0][0]},${m.run[0][1]}: decks already joined by a short walk`); continue; }
        at.apply(r.plan);
        merges.push({ kind: "merge", A: r.plan.A, B: r.plan.B, plan: r.plan, len: m.span[1] - m.span[0] + 1, gap: m.g });
      }
    }
  }
  const startsOf = () => startsFromMarkers(at, markers);
  let cands = enumerate(at, startsOf());
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
      yield;
      const r = realize(at, c);
      if (!r.plan) { log.push(`${c.kind} ${c.A.x},${c.A.z}->${c.B.x},${c.B.z}: ${r.error}${r.blocked ? ` (${r.blocked[0].block} at ${r.blocked[0].x},${r.blocked[0].y},${r.blocked[0].z})` : ""}`); continue; }
      at.apply(r.plan);
      picks.push({ kind: c.kind, A: c.A, B: c.B, plan: r.plan, dnet: c.dnet, len: c.len, value: Math.round(c.value) });
      done = true; break;
    }
    if (!done) break;
    yield;
    cands = enumerate(at, startsOf()); // the network and the rims changed
  }
  // repairs last, on the finished network (village_repair.js: the rope fit); opts.repairs === false turns them off
  const repairs = yield* repairGen(at, markers, { ...o, log });
  return { picks, merges, repairs, nRaw, log, at };
}

// ---- ticking area discovery ---------------------------------------------------------------------------------------------------------
// A rectangle is { x0, x1, z0, z1 } in blocks (inclusive). Areas load whole chunks, so boxes are chunk aligned.
export const hullOf = (cells) => ({ x0: Math.min(...cells.map((c) => c[0])), x1: Math.max(...cells.map((c) => c[0])), z0: Math.min(...cells.map((c) => c[2])), z1: Math.max(...cells.map((c) => c[2])) });
export const chunkAlign = (r) => ({ x0: (r.x0 >> 4) << 4, x1: ((r.x1 >> 4) << 4) + 15, z0: (r.z0 >> 4) << 4, z1: ((r.z1 >> 4) << 4) + 15 });
export const growRect = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });
export const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
export const chunksIn = (r) => ((r.x1 - r.x0 + 1) >> 4) * ((r.z1 - r.z0 + 1) >> 4);

// Done-list (world dynamic property, JSON): rectangles of villages that were planned. A marker inside one is removed without planning.
export const parseDone = (s) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };
export const addDone = (list, r) => [...list, { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }].slice(-AREA.maxDone);
export const isDone = (list, x, z) => list.some((r) => inRect(r, x, z));

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
// Numeric memo keys (a village rect is a few hundred blocks wide; y within -256..767): about a fifth of the time of string keys in node.
// `.size()` = distinct reads so far (the planner's timing log), `.rect` / `.nkey` are used by overlay().
export function boundedReader(get, rect) {
  const cache = new Map(), nkey = (x, y, z) => ((x - rect.x0) * 4096 + (z - rect.z0)) * 1024 + (y + 256);
  const reader = (x, y, z) => {
    if (!inRect(rect, x, z)) return undefined;
    const k = nkey(x, y, z);
    let v = cache.get(k);
    if (v === undefined && !cache.has(k)) { v = get(x, y, z); cache.set(k, v); }
    return v;
  };
  reader.size = () => cache.size; reader.rect = rect; reader.nkey = nkey;
  return reader;
}

// one-line description of a pick for logs / chat
export const describeMerge = (m) => `merge ${m.A.x},${m.A.y},${m.A.z} <-> ${m.B.x},${m.B.z} (${m.len} cells, gap ${m.gap})`;
export const describePick = (p) => `${p.kind} ${p.A.x},${p.A.y},${p.A.z} -> ${p.B.x},${p.B.z} (length ${p.len}${p.plan.landing ? ", landing" : ""}, saves ${p.dnet})`;
