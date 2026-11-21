// A simulated world for the village build job (village_build.js planAndBuild), shared by tests/village_build_budget.mjs (Node, counts native calls per step)
// and tools/village_steps.mjs (QuickJS, times the steps). Villages come from tools/village_sim.mjs (flat ground at y = -1); the deep fixtures carve a valley
// (or a lake) under the village so that trunk carries and pillar repairs have to read far down.
//   const w = makeWorld(data, seed, "flat" | "valley" | "lake");  w.found (discoverSync result), w.nameAt / w.statesAt / w.set / w.layer, w.hash()
import { simulate, check, markerCells, wkey } from "./village_sim.mjs";
import { discoverSync, chunksIn, inRect } from "../lothlorien_bp/scripts/village_planner.js";

export const FIXTURES = { valley: { drop: 30, radius: 26, water: null }, lake: { drop: 24, radius: 26, water: -9 } };
export const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

export function makeWorld(data, seed, fixture = "flat") {
  const res = simulate(data, seed), ck = check(data, res);
  const cells = [...new Map(res.placed.flatMap(markerCells).map((c) => [c.join(","), c])).values()];
  if (!cells.length) return null;
  const env = { claim() {}, remove() {}, create() {}, hasCapacity: (r) => chunksIn(r) <= 300, markersIn: (r) => cells.filter(([x, , z]) => inRect(r, x, z)) };
  const found = discoverSync(env, cells[(seed * 13) % cells.length], "m");
  const over = new Map(), overSt = new Map(), fx = FIXTURES[fixture];
  let cx = 0, cz = 0;
  for (const c of cells) { cx += c[0]; cz += c[2]; }
  cx /= cells.length; cz /= cells.length;
  // top of the terrain at (x, z): -1 on flat ground; the fixtures sink it into a bowl round the village centre
  const top = (x, z) => fx ? -1 - Math.round(fx.drop * Math.min(1, Math.max(0, 1 - Math.hypot(x - cx, z - cz) / fx.radius) * 2)) : -1;
  const ground = (x, y, z) => {
    const t = top(x, z);
    if (y > t) return fx && fx.water !== null && y <= fx.water ? "minecraft:water" : "minecraft:air";
    return y === t ? "minecraft:grass_block" : y >= t - 3 ? "minecraft:dirt" : "minecraft:stone";
  };
  const nameAt = (x, y, z) => { const k = wkey(x, y, z); if (over.has(k)) return over.get(k); const w = ck.world.get(k); return w !== undefined ? w : ground(x, y, z); };
  const statesAt = (x, y, z) => { const k = wkey(x, y, z); return over.has(k) ? overSt.get(k) : ck.states.get(k) ?? {}; };
  const set = (x, y, z, id, st) => { const k = wkey(x, y, z); over.set(k, id); overSt.set(k, st ?? {}); };
  const layer = (x0, z0, x1, z1, y, ids) => { const want = new Set(ids), out = []; for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (want.has(nameAt(x, y, z))) out.push([x, z]); return out; };
  // every cell the job wrote, with its final block and states, in a fixed order: the regression oracle for "writes stay identical"
  const written = () => [...over].map(([k, id]) => [k, id, JSON.stringify(overSt.get(k))]).sort((a, b) => a[0] - b[0]);
  const hash = (skip) => { let h = 2166136261 >>> 0, n = 0; for (const [k, id, st] of written()) { if (skip && skip(id)) continue; n++; for (const ch of `${k}|${id}|${st};`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; } return { hash: h.toString(16), cells: n }; };
  return { seed, fixture, found, nameAt, statesAt, set, layer, written, hash, markers: found.known.length, chunks: chunksIn(found.rect), top };
}

// ---- Node side: a dimension that counts the native calls of every job step ---------------------------------------------------------------------------
import { planAndBuild, clearShield } from "../lothlorien_bp/scripts/village_build.js";
import { PLAN } from "../lothlorien_bp/scripts/village_planner.js";
import { clearBand } from "../lothlorien_bp/scripts/village_clear.js";

const perm = (id, states) => ({ type: { id }, id, states: { ...(states ?? {}) }, getState(k) { return this.states[k]; }, withState(k, v) { return perm(id, { ...this.states, [k]: v }); } });
export const nodeEngine = { BlockPermutation: { resolve: (id, states) => perm(id, states) }, BlockVolume: class { constructor(from, to) { this.from = from; this.to = to; } } };
export const COUNTERS = ["getBlock", "set", "getBlocks", "layerCells", "fill", "fillCells", "structure", "spawn", "entityQuery", "remove"];
export const zeroCounters = () => ({ ...Object.fromEntries(COUNTERS.map((k) => [k, 0])), maxLayer: 0, maxFill: 0 });

// c: counters (mutated). Volumes seen: c.maxLayer = the largest getBlocks volume, c.maxFill = the largest fillBlocks volume.
export function countingDimension(w, c) {
  const block = (x, y, z) => ({
    get typeId() { return w.nameAt(x, y, z); },
    get permutation() { return perm(w.nameAt(x, y, z), w.statesAt(x, y, z)); },
    setType(id) { c.set++; w.set(x, y, z, id, {}); },
    setPermutation(p) { c.set++; w.set(x, y, z, p.id, p.states); },
  });
  return {
    id: "minecraft:overworld",
    getBlock(l) { c.getBlock++; return block(l.x, l.y, l.z); },
    getBlocks(v, f) {
      const n = (v.to.x - v.from.x + 1) * (v.to.y - v.from.y + 1) * (v.to.z - v.from.z + 1);
      c.getBlocks++; c.layerCells += n; c.maxLayer = Math.max(c.maxLayer ?? 0, n);
      const xs = w.layer(v.from.x, v.from.z, v.to.x, v.to.z, v.from.y, f.includeTypes);
      return { getBlockLocationIterator: () => xs.map(([x, z]) => ({ x, y: v.from.y, z })) };
    },
    fillBlocks(v, id, o) {
      const n = (v.to.x - v.from.x + 1) * (v.to.y - v.from.y + 1) * (v.to.z - v.from.z + 1);
      c.fill++; c.fillCells += n; c.maxFill = Math.max(c.maxFill ?? 0, n);
      let hit = 0;
      for (let x = v.from.x; x <= v.to.x; x++) for (let y = v.from.y; y <= v.to.y; y++) for (let z = v.from.z; z <= v.to.z; z++) if (o.blockFilter.includeTypes.includes(w.nameAt(x, y, z))) { w.set(x, y, z, id, {}); hit++; }
      return { getCapacity: () => hit };
    },
  };
}

// Runs the production job (plan + build + mend, then the shield clear) step by step. -> { result, steps: [{ label, ms, d: counter deltas }], total }
export function runVillageJob(w, { budget = PLAN.budget, engine = nodeEngine, extra } = {}) {
  const c = zeroCounters(), dim = countingDimension(w, c), steps = [], stats = { steps: 0, cpu: 0, native: 0, reads: () => 0, writeCells: 0 };
  const run = (gen) => {
    let prev = "start", r;
    for (;;) {
      const before = { ...c }, t0 = performance.now();
      r = gen.next();
      const ms = performance.now() - t0, d = {};
      for (const k of COUNTERS) d[k] = c[k] - before[k];
      steps.push({ label: `${prev}>${r.done ? "done" : r.value}`, ms, d, layer: c.maxLayer, fill: c.maxFill });
      c.maxLayer = 0; c.maxFill = 0;
      if (r.done) return r.value;
      prev = r.value;
    }
  };
  const result = run(planAndBuild(dim, w.found, budget, stats, engine));
  const range = { min: -64, max: 319 }, band = clearBand(w.found.known, range);
  if (band) run(clearShield(dim, w.found.rect, band, { slices: 0, cells: 0, failed: 0, steps: 0, cpu: 0 }, engine, () => {}));
  if (extra) extra(dim, run, c);
  return { result, steps, counters: c };
}
