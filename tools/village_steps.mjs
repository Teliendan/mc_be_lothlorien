// Times every inner step of the village build job (village_build.js planAndBuild + clearShield) inside QuickJS (quickjs-emscripten, the engine family
// Bedrock scripts run on) on simulated villages, with a mock dimension that counts the native calls per step. The tool of docs/SCRIPT_PERFORMANCE.md.
//   node tools/village_steps.mjs [--seeds N=10] [--first K=1] [--fixtures] [--check] [--json out.json]
//   --fixtures  also run the deep-terrain fixtures (valley seed 3 and 12, lake seed 7 and 15)
//   --check     assert the budget over the villages: no inner step over 10 ms, at most 0.1 % of the steps over 3 ms, native reads per step <= 128,
//               peak live QuickJS allocations <= HEAP_CAP; exit code 1 otherwise. Not in the normal verify (minutes: about 12 s per village).
// Needs quickjs-emscripten 0.31: `npm i quickjs-emscripten@0.31` in a folder and QJS_DIR=<folder> (default temp/village-memory/qjs of this workspace).
// Treat QuickJS-wasm ms on the PC as roughly game ms on the PC (docs/SCRIPT_PERFORMANCE.md): native block reads cost extra in game.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadVillageData } from "./village_sim.mjs";
import { makeWorld } from "./village_budget_world.mjs";
import { PLAN } from "../lothlorien_bp/scripts/village_planner.js";

const args = process.argv.slice(2), flag = (n) => args.includes(`--${n}`), opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const SCRIPTS = new URL("../lothlorien_bp/scripts/", import.meta.url);
const QJS_DIR = process.env.QJS_DIR ?? resolve(fileURLToPath(import.meta.url), "../../../../temp/village-memory/qjs");
export const STEP_MS = 3, STEP_MAX_MS = 10, OVER_FRACTION = 0.001, READS = 128, HEAP_CAP = null; // HEAP_CAP: live allocations; set from the post-fix measurement
let QJSmod;
try { QJSmod = createRequire(QJS_DIR + "/package.json")("quickjs-emscripten"); } catch (e) { console.error(`quickjs-emscripten not found in ${QJS_DIR} (set QJS_DIR): ${e.message}`); process.exit(2); }
const { newQuickJSWASMModule, RELEASE_SYNC } = QJSmod;

const MOCK = `
const perm = (id, states) => ({ type: { id }, id, states: { ...(states ?? {}) }, getState(k) { return this.states[k]; }, withState(k, v) { return perm(id, { ...this.states, [k]: v }); } });
export const BlockPermutation = { resolve: (id, states) => perm(id, states) };
export class BlockVolume { constructor(from, to) { this.from = from; this.to = to; } }
export const c = { getBlock: 0, set: 0, getBlocks: 0, fill: 0 };
export function makeDimension() {
  const block = (x, y, z) => ({
    get typeId() { return __get(x, y, z); },
    get permutation() { return perm(__get(x, y, z), JSON.parse(__states(x, y, z))); },
    setType(id) { c.set++; __set(x, y, z, id, "{}"); },
    setPermutation(p) { c.set++; __set(x, y, z, p.id, JSON.stringify(p.states)); },
  });
  return {
    id: "minecraft:overworld",
    getBlock(l) { c.getBlock++; return block(l.x, l.y, l.z); },
    getBlocks(v, f) { c.getBlocks++; const xs = JSON.parse(__layer(v.from.x, v.from.z, v.to.x, v.to.z, v.from.y, f.includeTypes.join("|")));
      return { getBlockLocationIterator: () => xs.map(([x, z]) => ({ x, y: v.from.y, z })) }; },
    fillBlocks(v, id, o) { c.fill++; const n = __fill(v.from.x, v.from.y, v.from.z, v.to.x, v.to.y, v.to.z, o.blockFilter.includeTypes.join("|"), id); return { getCapacity: () => n }; },
  };
}`;
const MAIN = `
import { planAndBuild, clearShield } from "./village_build.js";
import { clearBand } from "./village_clear.js";
import { BlockPermutation, BlockVolume, makeDimension, c } from "./mock_server.js";
const engine = { BlockPermutation, BlockVolume }, found = JSON.parse(globalThis.__found), dim = makeDimension();
const stats = { steps: 0, cpu: 0, native: 0, reads: () => 0, writeCells: 0 };
const run = (gen) => {
  let prev = "start", r;
  for (;;) {
    const g0 = c.getBlock, s0 = c.set, t = __now();
    r = gen.next();
    const d = __now() - t, lab = r.done ? "done" : r.value;
    __step(d, prev + ">" + lab, c.getBlock - g0, c.set - s0);
    prev = lab;
    if (r.done) return r.value;
  }
};
const res = run(planAndBuild(dim, found, __BUDGET__, stats, engine));
const band = clearBand(found.known, { min: -64, max: 319 });
if (band) run(clearShield(dim, found.rect, band, { slices: 0, cells: 0, failed: 0, steps: 0, cpu: 0 }, engine, () => {}));
__result(JSON.stringify({ blocks: res.blocks, merges: res.merges.length, picks: res.picks.length, repairs: res.repairs.length }));
`;

const data = loadVillageData();
const count = +opt("seeds", 10), first = +opt("first", 1);
const cases = Array.from({ length: count }, (_, i) => ({ seed: first + i, fixture: "flat" }));
if (flag("fixtures")) cases.push({ seed: 3, fixture: "valley" }, { seed: 12, fixture: "valley" }, { seed: 7, fixture: "lake" }, { seed: 15, fixture: "lake" });
const QJS = await newQuickJSWASMModule(RELEASE_SYNC);
const all = [], byLabel = new Map();
let nSteps = 0, over3 = 0, over10 = 0, worstMs = { ms: 0 }, worstReads = { n: 0 }, peakHeap = 0;
for (const cs of cases) {
  const w = makeWorld(data, cs.seed, cs.fixture);
  if (!w) continue;
  const rt = QJS.newRuntime(); rt.setMaxStackSize(1 << 20);
  rt.setModuleLoader((name) => { const f = name.replace(/^.*\//, ""); return f === "mock_server.js" ? MOCK : readFileSync(new URL(f, SCRIPTS), "utf8"); });
  const ctx = rt.newContext();
  const fn = (n, f) => ctx.setProp(ctx.global, n, ctx.newFunction(n, f));
  const num = (h) => ctx.getNumber(h), str = (h) => ctx.getString(h);
  let result = null, steps = 0, villageWorst = 0;
  const mem = () => { const h = rt.computeMemoryUsage(), o = ctx.dump(h); h.dispose(); return o.malloc_count; };
  fn("__get", (x, y, z) => ctx.newString(w.nameAt(num(x), num(y), num(z))));
  fn("__states", (x, y, z) => ctx.newString(JSON.stringify(w.statesAt(num(x), num(y), num(z)))));
  fn("__set", (x, y, z, id, st) => { w.set(num(x), num(y), num(z), str(id), JSON.parse(str(st))); });
  fn("__layer", (x0, z0, x1, z1, y, ids) => ctx.newString(JSON.stringify(w.layer(num(x0), num(z0), num(x1), num(z1), num(y), str(ids).split("|")))));
  fn("__fill", (x0, y0, z0, x1, y1, z1, ids, id) => {
    const want = str(ids).split("|"); let hit = 0;
    for (let x = num(x0); x <= num(x1); x++) for (let y = num(y0); y <= num(y1); y++) for (let z = num(z0); z <= num(z1); z++) if (want.includes(w.nameAt(x, y, z))) { w.set(x, y, z, str(id), {}); hit++; }
    return ctx.newNumber(hit);
  });
  fn("__now", () => ctx.newNumber(performance.now()));
  fn("__step", (ms, label, reads, sets) => {
    const d = num(ms), l = str(label), r = num(reads);
    nSteps++; steps++; if (d > STEP_MS) over3++; if (d > STEP_MAX_MS) over10++; if (d > villageWorst) villageWorst = d;
    if (d > worstMs.ms) worstMs = { ms: d, label: l, seed: cs };
    if (r > worstReads.n) worstReads = { n: r, label: l, seed: cs };
    const e = byLabel.get(l) ?? { n: 0, ms: 0, max: 0, reads: 0 }; e.n++; e.ms += d; if (d > e.max) e.max = d; if (r > e.reads) e.reads = r; byLabel.set(l, e);
    if (steps % 250 === 0) peakHeap = Math.max(peakHeap, mem());
  });
  fn("__result", (j) => { result = JSON.parse(str(j)); });
  ctx.setProp(ctx.global, "__found", ctx.newString(JSON.stringify({ rect: w.found.rect, known: w.found.known })));
  const t0 = performance.now();
  const h = ctx.evalCode(MAIN.replace("__BUDGET__", String(PLAN.budget)), "main.js", { type: "module" });
  if (h.error) { console.log(cs.seed, JSON.stringify(ctx.dump(h.error))); h.error.dispose(); } else h.value.dispose();
  rt.executePendingJobs();
  peakHeap = Math.max(peakHeap, mem());
  /* no dispose: quickjs-emscripten asserts on leftover GC objects */
  if (result) all.push({ ...cs, markers: w.markers, steps, worst: villageWorst, wall: Math.round(performance.now() - t0) });
  console.log(`${cs.fixture}-${cs.seed}: ${w.markers} markers, ${steps} steps, worst step ${villageWorst.toFixed(1)} ms, ${Math.round(performance.now() - t0)} ms wall`);
}
const table = [...byLabel].map(([label, e]) => ({ label, steps: e.n, totalMs: Math.round(e.ms), worstMs: +e.max.toFixed(1), mostReads: e.reads })).filter((x) => x.worstMs > STEP_MS || x.mostReads > READS).sort((a, b) => b.worstMs - a.worstMs).slice(0, 25);
if (table.length) console.table(table);
const summary = { villages: all.length, steps: nSteps, over3ms: over3, over10ms: over10, worstMs: +worstMs.ms.toFixed(1), worstLabel: worstMs.label, worstReads: worstReads.n, worstReadsLabel: worstReads.label, peakLiveAllocations: peakHeap };
console.log("summary", JSON.stringify(summary));
const outFile = opt("json", null);
if (outFile) writeFileSync(outFile, JSON.stringify({ summary, all, table }), "utf8");
if (flag("check")) {
  const fails = [];
  if (over10) fails.push(`${over10} step(s) over ${STEP_MAX_MS} ms (worst ${worstMs.ms.toFixed(1)} ms ${worstMs.label})`);
  if (over3 > nSteps * OVER_FRACTION) fails.push(`${over3} of ${nSteps} steps over ${STEP_MS} ms (limit ${(OVER_FRACTION * 100).toFixed(1)} %)`);
  if (worstReads.n > READS) fails.push(`${worstReads.n} native reads in one step (limit ${READS}, ${worstReads.label})`);
  if (HEAP_CAP !== null && peakHeap > HEAP_CAP) fails.push(`peak live allocations ${peakHeap} over the cap ${HEAP_CAP}`);
  console.log(fails.length ? `CHECK FAILED: ${fails.join("; ")}` : "CHECK OK");
  process.exitCode = fails.length ? 1 : 0;
}
