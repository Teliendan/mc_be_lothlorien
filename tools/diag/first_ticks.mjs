// Loads the whole behaviour pack (main.js) into QuickJS (quickjs-emscripten, the engine family Bedrock scripts run on) with a mock server module,
// fires startup + worldLoad, then runs the first minute of ticks with one player and times every timer callback, plus the live allocation count
// before/after load and per tick (a drop between two ticks = a garbage-collection pass). The tool behind "the first 20-tick call after world load".
//   node tools/diag/first_ticks.mjs [--ticks 1200] [--river] [--debug] [--heap] [--check] [--pack <dir holding lothlorien_bp>]
//   --river  the player stands in a river (centre biome minecraft:river: the 83-probe depth fallback of isInside)
//   --debug  the player carries the lothlorien_debug tag (showDebug draws the HUD)
//   --gc-probe  after the load, allocate cyclic garbage in small slices and print the longest slice = the pause one garbage collection of THIS heap costs
//   --check  exit 1 when a callback in the first minute takes more than CHECK_MS (env, default 8)
// Needs quickjs-emscripten 0.31 in QJS_DIR (see tools/village_steps.mjs).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2), flag = (n) => args.includes(`--${n}`), opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const PACK = resolve(opt("pack", fileURLToPath(new URL("../../", import.meta.url))), "lothlorien_bp/scripts");
const QJS_DIR = process.env.QJS_DIR ?? resolve(fileURLToPath(import.meta.url), "../../../../../temp/village-memory/qjs");
const CHECK_MS = +(process.env.CHECK_MS ?? 8);
let QJSmod;
try { QJSmod = createRequire(QJS_DIR + "/package.json")("quickjs-emscripten"); } catch (e) { console.error(`quickjs-emscripten not found in ${QJS_DIR} (set QJS_DIR): ${e.message}`); process.exit(2); }
const { newQuickJSWASMModule, RELEASE_SYNC } = QJSmod;

const SERVER = `
const deep = (name) => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => name : k === "then" ? undefined : deep(name + "." + String(k)), apply: () => deep(name + "()"), construct: () => deep("new " + name) });
export const state = { subs: {}, intervals: [], timeouts: [], jobs: [], tick: 0, props: new Map(), river: __RIVER__, debug: __DEBUG__ };
const signal = (name) => ({ subscribe(cb) { (state.subs[name] ??= []).push(cb); return cb; }, unsubscribe() {} });
const signals = (kind) => new Proxy({}, { get: (t, k) => signal(kind + "." + String(k)) });
export const system = {
  beforeEvents: signals("system.before"), afterEvents: signals("system.after"),
  runInterval(fn, ticks) { state.intervals.push({ fn, n: ticks ?? 1, at: state.tick }); return state.intervals.length; },
  runTimeout(fn, t) { state.timeouts.push({ fn, at: state.tick + (t ?? 1) }); return 0; }, run(fn) { state.timeouts.push({ fn, at: state.tick + 1 }); return 0; },
  runJob(g) { state.jobs.push(g); return 0; }, clearRun() {}, clearJob() {}, get currentTick() { return state.tick; },
};
const dimension = {
  id: "minecraft:overworld", heightRange: { min: -64, max: 320 },
  getBiome(l) { return { id: state.river && Math.hypot(l.x - 100, l.z - 100) < 3 ? "minecraft:river" : "lothlorien:lothlorien" }; },
  getTopmostBlock(l) { return { location: { x: l.x, y: 70, z: l.z } }; },
  getBlock() { return undefined; }, containsBlock() { return false; }, getEntities() { return []; }, getPlayers() { return []; },
  getBlockFromRay() { return undefined; }, getBlocks() { return deep("blocks"); }, spawnParticle() {}, playSound() {},
};
const tags = new Set(state.debug ? ["lothlorien_debug"] : []);
export const player = {
  id: "-123456789", name: "T", typeId: "minecraft:player", isValid: true, dimension, location: { x: 100.5, y: 71, z: 100.5 }, velocity: { x: 0, y: 0, z: 0 },
  hasTag: (t) => tags.has(t), addTag: (t) => tags.add(t), removeTag: (t) => tags.delete(t), getTags: () => [...tags],
  getDynamicProperty: (k) => state.props.get("p" + k), setDynamicProperty: (k, v) => { state.props.set("p" + k, v); }, getDynamicPropertyIds: () => [],
  sendMessage() {}, onScreenDisplay: { setActionBar() {}, setTitle() {} }, getComponent: () => undefined, getRotation: () => ({ x: 0, y: 0 }), getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
  isSneaking: false, isSprinting: false, isOnGround: true, isInWater: false, getGameMode: () => "Survival", gameMode: "Survival", addEffect() {}, getEffect() {},
  selectedSlotIndex: 0, runCommand() {}, playSound() {}, getHeadLocation: () => ({ x: 100.5, y: 72.6, z: 100.5 }), getEntitiesFromViewDirection: () => [], getItemCooldown: () => 0, isFlying: false, isGliding: false, isClimbing: false, isFalling: false,
};
export const world = {
  beforeEvents: signals("before"), afterEvents: signals("after"),
  getPlayers: () => [player], getAllPlayers: () => [player], sendMessage() {}, getTimeOfDay: () => 6000, getAbsoluteTime: () => state.tick, getDay: () => 5,
  getDynamicProperty: (k) => state.props.get(k), setDynamicProperty: (k, v) => { state.props.set(k, v); }, getDynamicPropertyIds: () => [...state.props.keys()],
  getDimension: () => dimension, getEntity: () => undefined, tickingAreaManager: deep("tam"), structureManager: deep("sm"), scoreboard: deep("sb"), gameRules: deep("gr"),
};
export const BlockPermutation = deep("BlockPermutation"), BlockVolume = class { constructor(a, b) { this.from = a; this.to = b; } }, EasingType = deep("EasingType"),
  EntityInitializationCause = { Loaded: "Loaded", Spawned: "Spawned", Born: "Born" }, EquipmentSlot = deep("EquipmentSlot"),
  GameMode = { Creative: "Creative", Survival: "Survival", Adventure: "Adventure", Spectator: "Spectator" }, ItemStack = deep("ItemStack");
`;
const UI = `export class ActionFormData { title() { return this; } body() { return this; } button() { return this; } show() { return Promise.resolve({ canceled: true }); } }; export class MessageFormData {}; export class ModalFormData {};`;
const MAIN = `
import { state, player } from "./mock_server.js";
import "./main.js";
globalThis.__fire = (name, ev) => { for (const cb of state.subs[name] ?? []) { try { cb(ev); } catch (e) { __err(name + ": " + e); } } };
const reg = { registerCustomComponent() {} };
globalThis.__startup = () => __fire("system.before.startup", { blockComponentRegistry: reg, itemComponentRegistry: reg, customCommandRegistry: { registerCommand() {}, registerEnum() {} } });
globalThis.__worldLoad = () => __fire("after.worldLoad", {});
globalThis.__spawn = () => __fire("after.playerSpawn", { player, initialSpawn: true });
// One tick: fires the due timers and one step of every job, timing each (label = timer kind, period, registration index, start of the function text).
globalThis.__tick = () => {
  state.tick++;
  const due = [];
  for (const [i, t] of state.intervals.entries()) if ((state.tick - t.at) % t.n === 0) due.push(["interval(" + t.n + ")#" + i + " " + String(t.fn).replace(/\\s+/g, " ").slice(0, 60), t.fn]);
  const keep = [];
  for (const t of state.timeouts) if (t.at <= state.tick) due.push(["timeout " + String(t.fn).replace(/\\s+/g, " ").slice(0, 60), t.fn]); else keep.push(t);
  state.timeouts = keep;
  const out = [];
  for (const [label, fn] of due) { const t0 = __now(); try { fn(); } catch (e) { __err(label + ": " + e); } out.push([label, __now() - t0]); }
  for (const g of state.jobs.slice()) { const t0 = __now(); let r; try { r = g.next(); } catch (e) { __err("job: " + e); r = { done: true }; } out.push(["job step", __now() - t0]); if (r.done) state.jobs.splice(state.jobs.indexOf(g), 1); }
  return JSON.stringify(out);
};
`;

const QJS = await newQuickJSWASMModule(RELEASE_SYNC);
const rt = QJS.newRuntime(); rt.setMaxStackSize(1 << 20);
const river = flag("river"), debug = flag("debug");
rt.setModuleLoader((name) => {
  if (name === "mock_server.js") return SERVER.replace("__RIVER__", String(river)).replace("__DEBUG__", String(debug));
  if (name === "mock_server_ui.js") return UI;
  return readFileSync(resolve(PACK, name.replace(/^.*\//, "")), "utf8");
}, (base, name) => name === "@minecraft/server" ? "mock_server.js" : name === "@minecraft/server-ui" ? "mock_server_ui.js" : name.replace(/^\.\//, ""));
const ctx = rt.newContext();
const live = () => { const h = rt.computeMemoryUsage(), o = ctx.dump(h); h.dispose(); return o; };
ctx.setProp(ctx.global, "__now", ctx.newFunction("__now", () => ctx.newNumber(performance.now())));
const errs = [];
ctx.setProp(ctx.global, "__err", ctx.newFunction("__err", (m) => { errs.push(ctx.getString(m)); }));
const call = (code) => { const t = performance.now(); const r = ctx.evalCode(code, "call.js"); const ms = performance.now() - t; if (r.error) { console.log("ERROR", JSON.stringify(ctx.dump(r.error))); r.error.dispose(); return { ms }; } const v = ctx.dump(r.value); r.value.dispose(); return { v, ms }; };

const before = live();
const t0 = performance.now();
const h = ctx.evalCode(MAIN, "main_harness.js", { type: "module" });
if (h.error) { console.log("LOAD ERROR", JSON.stringify(ctx.dump(h.error))); process.exit(1); } h.value.dispose();
rt.executePendingJobs();
const loadMs = performance.now() - t0;
const afterLoad = live();
const startupMs = call("__startup()").ms;
const wl = call("__worldLoad()");
rt.executePendingJobs();
const afterWorld = live();
call("__spawn()");
console.log(`load ${loadMs.toFixed(0)} ms, startup ${startupMs.toFixed(1)} ms; live allocations: before ${before.malloc_count}, after modules ${afterLoad.malloc_count}, after worldLoad ${afterWorld.malloc_count}; worldLoad ${wl.ms.toFixed(1)} ms; ${afterWorld.memory_used_size} bytes`);
if (flag("heap")) console.log("heap after load", JSON.stringify(afterWorld));
if (flag("gc-probe")) {
  const r = call(`(() => { const ms = []; for (let i = 0; i < 6000; i++) { const t = __now(); const a = []; for (let k = 0; k < 20; k++) { const o = { k, a }; o.self = o; a.push(o); } ms.push(__now() - t); } ms.sort((x, y) => x - y); return [ms[ms.length >> 1], ms[ms.length - 1], ms[ms.length - 2], ms.filter((x) => x > 0.5).length]; })()`);
  console.log(`gc probe over the loaded pack (${afterWorld.malloc_count} live allocations): median slice ${r.v[0].toFixed(3)} ms, longest ${r.v[1].toFixed(2)} ms, second longest ${r.v[2].toFixed(2)} ms, slices over 0.5 ms: ${r.v[3]}`);
}
const N = +opt("ticks", 1200);
const stats = new Map(); let prevAlloc = afterWorld.malloc_count; const drops = []; let worst = { ms: 0 };
for (let i = 1; i <= N; i++) {
  const r = call("__tick()");
  if (!r.v) break;
  for (const [label, ms] of JSON.parse(r.v)) {
    const e = stats.get(label) ?? { calls: 0, ms: 0, max: 0, first: ms, maxTick: i, second: undefined }; e.calls++; e.ms += ms;
    if (e.calls === 2) e.second = ms;
    if (ms > e.max) { e.max = ms; e.maxTick = i; }
    stats.set(label, e); if (ms > worst.ms) worst = { ms, label, tick: i };
  }
  if (i <= 60 || i % 20 === 0) { const a = live().malloc_count; if (a < prevAlloc - 500) drops.push(`tick ${i}: ${prevAlloc} -> ${a}`); prevAlloc = a; }
}
const rows = [...stats].map(([label, e]) => ({ label, calls: e.calls, firstMs: +e.first.toFixed(2), secondMs: e.second === undefined ? "" : +e.second.toFixed(2), maxMs: +e.max.toFixed(2), maxTick: e.maxTick, totalMs: +e.ms.toFixed(1) }))
  .sort((a, b) => b.maxMs - a.maxMs).slice(0, +opt("rows", 12));
console.table(rows);
console.log(`worst callback ${worst.ms.toFixed(2)} ms (${worst.label}, tick ${worst.tick}); allocation drops (GC) in the first ticks: ${drops.length ? drops.join("; ") : "none"}; errors ${errs.length}${errs.length ? " e.g. " + errs.slice(0, 3).join(" | ") : ""}`);
if (flag("check")) { const bad = worst.ms > CHECK_MS; console.log(bad ? `CHECK FAILED: ${worst.label} ${worst.ms.toFixed(1)} ms > ${CHECK_MS} ms` : "CHECK OK"); process.exitCode = bad ? 1 : 0; }
