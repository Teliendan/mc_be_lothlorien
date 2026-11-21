// DIAGNOSTIC BUILD ONLY (built by tools/diag/make_diag.mjs, never shipped). Times every Lothlorien script callback per source file and reports long ticks
// ("freezes") in chat and in the content log, so a tester can tell whether a freeze is spent in Lothlorien scripts or in
// the engine. Every pack file imports `system` / `world` through __diagSystem / __diagWorld (rewritten by make_diag.mjs).
import * as mc from "@minecraft/server";
const realSystem = mc.system, realWorld = mc.world;

const GAP1 = 150, GAP2 = 300, GAP3 = 700; // tick-gap classes (ms) counted per minute; every gap >= GAP1 is reported
const MAX_LINES = 5;          // immediate chat lines per minute (the summary carries the counts)
const MINUTE_MS = 60000;      // a "minute" is wall clock (Date.now()), so slow ticks do not stretch it
const TOP = 5;

let bucket = new Map();       // label -> [ms, calls, longest single call, native calls inside, native ms inside] since the last monitor tick
let minute = new Map();       // the same since the last summary
const add = (map, label, ms, n = 0, nms = 0) => {
  const e = map.get(label);
  if (e) { e[0] += ms; e[1]++; if (ms > e[2]) e[2] = ms; e[3] += n; e[4] += nms; } else map.set(label, [ms, 1, ms, n, nms]);
};
// Every callback also counts the wrapped native calls made inside it (nativeN, nativeMs below), so a slow callback shows whether it made a few slow natives,
// many cheap ones (Date.now() has 1 ms resolution: the ms of cheap calls round to 0, so read the COUNT) or none at all (time spent in plain script / GC / engine).
// A callback of >= CALLBACK_LOG_MS is also logged at once with its label, call number, tick and native count (the "one 130 ms runInterval(20) after load" case).
const CALLBACK_LOG_MS = 25, CALLBACK_LOG_PER_MINUTE = 10;
let callbackLogs = 0; const calledBefore = new Set();
function record(label, ms, n, nms) {
  add(bucket, label, ms, n, nms); add(minute, label, ms, n, nms);
  const first = !calledBefore.has(label);
  if (first) calledBefore.add(label);
  if (ms >= CALLBACK_LOG_MS && callbackLogs < CALLBACK_LOG_PER_MINUTE) {
    callbackLogs++;
    console.warn(`[lothlorien DIAG] slow callback ${label} ${ms} ms${first ? " (its FIRST call)" : ""}: ${n} native calls inside took ${nms} ms, so ${ms - nms} ms were plain script, uncounted natives, garbage collection or the engine (tick ${realSystem.currentTick}, ${((Date.now() - startedAt) / 1000).toFixed(1)} s after load)`);
  }
}

function timed(label, fn) {
  return function (...args) {
    const t0 = Date.now(), n0 = nativeN, m0 = nativeMs;
    try { return fn.apply(this, args); }
    finally { record(label, Date.now() - t0, nativeN - n0, nativeMs - m0); }
  };
}
// A job generator may yield a string label (loop_marker.js sliced() yields the label of its slowest inner step, "from>to"): the call is
// recorded as `<label>[<yielded label>]`, so a long job call names the planner phase and function that ran.
function* timedGen(label, gen) {
  let input;
  for (;;) {
    const t0 = Date.now(), n0 = nativeN, m0 = nativeMs;
    let r;
    try { r = gen.next(input); }
    finally {
      const ms = Date.now() - t0;
      const named = r && !r.done && typeof r.value === "string" ? `${label}[${r.value}]` : label;
      record(named, ms, nativeN - n0, nativeMs - m0);
    }
    if (r.done) return r.value;
    input = yield r.value;
  }
}

// --- native call timing (0.8.10) ---------------------------------------------------------------------------------------
// The engine's own methods that the mod calls are wrapped on their prototypes, so a gap or freeze report can name the slowest SINGLE native call
// ("slowest native getBiome 134 ms") and the minute summary lists the natives by total time. Two runs showed one ~135 ms call of a runInterval(20)
// shortly after world load (harmony_game.js once, main.js showDebug once); both read biomes, so a first-call warm-up of getBiome is the suspect:
// the first call of every native is also logged when it takes >= NATIVE_LOG_MS. The monitor's own natives (where()) are not timed (`muted`).
const NATIVE_LOG_MS = 25, NATIVE_LOG_PER_MINUTE = 10;
// "@name" wraps a property GETTER (0.8.12: the harmony and showDebug intervals read player.location, player.dimension and player.onScreenDisplay, which no
// method wrapper saw; hot getters such as Block.typeId stay unwrapped so the DIAG overhead stays small).
const NATIVE = {
  Dimension: ["getBiome", "getBlock", "getBlocks", "fillBlocks", "getEntities", "getEntitiesAtBlockLocation", "spawnEntity", "spawnItem", "spawnParticle", "playSound",
    "getBlockFromRay", "getTopmostBlock", "containsBlock", "isChunkLoaded", "runCommand", "getPlayers", "@heightRange"],
  Block: ["setPermutation", "setType", "getComponent"],
  Entity: ["remove", "kill", "teleport", "applyImpulse", "setDynamicProperty", "getDynamicProperty", "addEffect", "getComponent", "hasTag", "addTag", "removeTag", "@location", "@dimension"],
  Player: ["sendMessage", "@onScreenDisplay"],
  ScreenDisplay: ["setActionBar", "setTitle"],
  World: ["setDynamicProperty", "getDynamicProperty", "getPlayers", "getAllPlayers", "getDimension"],
  StructureManager: ["place", "get", "createFromWorld", "delete"],
  TickingAreaManager: ["createTickingArea", "removeTickingArea", "hasTickingArea"],
};
let muted = false, nativeCount = 0, nativeLogs = 0, nativeN = 0, nativeMs = 0; // nativeN / nativeMs: running totals of all timed native calls, diffed per callback
const natives = new Map();     // label -> { calls, ms, max } since the last summary
let tickNative = ["none", 0];  // the slowest single native call since the last monitor tick: [label, ms]
let minNative = ["none", 0];   // ... since the last summary
const nativeTop = (n = 4) => [...natives].filter(([, e]) => e.ms > 0 || e.max > 0).sort((a, b) => b[1].ms - a[1].ms).slice(0, n)
  .map(([k, e]) => `${k} ${e.ms}ms/${e.calls}x (max ${e.max})`).join("; ");
function wrapNative(proto, cls, name) {
  const getter = name[0] === "@";
  if (getter) name = name.slice(1);
  const desc = Object.getOwnPropertyDescriptor(proto, name);
  if (!desc || (getter ? typeof desc.get !== "function" : typeof desc.value !== "function")) return false;
  const orig = getter ? desc.get : desc.value, label = getter ? `${cls}.${name}(get)` : `${cls}.${name}`, e = { calls: 0, ms: 0, max: 0 };
  natives.set(label, e);
  const wrapped = function (...args) {
    if (muted) return orig.apply(this, args);
    const t0 = Date.now();
    try { return orig.apply(this, args); }
    finally {
      const ms = Date.now() - t0;
      nativeN++; nativeMs += ms;
      e.calls++; e.ms += ms;
      if (ms > e.max) e.max = ms;
      if (ms > tickNative[1]) tickNative = [label, ms];
      if (ms > minNative[1]) minNative = [label, ms];
      if (ms >= NATIVE_LOG_MS && nativeLogs < NATIVE_LOG_PER_MINUTE) {
        nativeLogs++;
        console.warn(`[lothlorien DIAG] slow native call ${label} ${ms} ms (call #${e.calls} of this method, tick ${realSystem.currentTick}${e.calls === 1 ? ", its FIRST call" : ""})`);
      }
    }
  };
  try {
    Object.defineProperty(proto, name, getter ? { get: wrapped, set: desc.set, configurable: true, enumerable: desc.enumerable } : { value: wrapped, writable: true, configurable: true, enumerable: desc.enumerable });
    return true;
  }
  catch { natives.delete(label); return false; }
}
for (const [cls, methods] of Object.entries(NATIVE)) {
  const proto = mc[cls]?.prototype;
  if (!proto) continue;
  for (const m of methods) if (wrapNative(proto, cls, m)) nativeCount++;
}

const bindAll = (t, k) => { const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v; };
// Every wrapper is a Proxy over its OWN empty object that forwards reads to the native one. A Proxy over the native
// object itself may not return a substitute for a read-only, non-configurable property (Proxy invariant), and in the
// game `world.afterEvents` is one: the 0.8.1 DIAG threw a TypeError at the first `world.afterEvents` read (blocks.js),
// module loading stopped, and every block whose custom component was registered later became an unknown block.
const SKIP = Symbol("forward");
const EXPECTED = 0; // replaced by make_diag.mjs with the number of registerCustomComponent calls in the pack
let registered = 0;
function facade(real, override) {
  return new Proxy({}, {
    get(_, k) { const v = override(k); return v === SKIP ? bindAll(real, k) : v; },
    has(_, k) { return k in real; },
  });
}

function wrapSignals(signals, file, kind) {
  return facade(signals, (name) => {
    const signal = Reflect.get(signals, name);
    if (!signal || typeof signal.subscribe !== "function") return SKIP;
    const label = `${file} ${kind}.${String(name)}`;
    return facade(signal, (k) => k !== "subscribe" ? SKIP : (cb, ...rest) => {
      const inner = name === "startup" && kind === "system.before" ? (ev) => cb(wrapStartup(ev, file)) : cb;
      signal.subscribe(timed(label, inner), ...rest);
      return cb;
    });
  });
}

function wrapComponent(comp, label) {
  const out = {};
  for (let o = comp; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const k of Object.getOwnPropertyNames(o)) {
      if (k === "constructor" || k in out) continue;
      const v = comp[k];
      out[k] = typeof v === "function" ? timed(`${label}.${k}`, v.bind(comp)) : v;
    }
  }
  return out;
}
function wrapRegistry(reg, file, kind) {
  if (!reg) return reg;
  return facade(reg, (k) => k !== "registerCustomComponent" ? SKIP :
    (name, comp) => { reg.registerCustomComponent(name, wrapComponent(comp, `${file} ${kind} ${name}`)); registered++; });
}
function wrapStartup(ev, file) {
  return facade(ev, (k) => k === "blockComponentRegistry" ? wrapRegistry(ev.blockComponentRegistry, file, "block")
    : k === "itemComponentRegistry" ? wrapRegistry(ev.itemComponentRegistry, file, "item") : SKIP);
}

export function __diagSystem(file) {
  const t = realSystem;
  return facade(t, (k) => {
    if (k === "run") return (fn) => t.run(timed(`${file} run`, fn));
    if (k === "runTimeout") return (fn, ticks) => t.runTimeout(timed(`${file} runTimeout`, fn), ticks);
    if (k === "runInterval") return (fn, ticks) => t.runInterval(timed(`${file} runInterval(${ticks ?? 1})`, fn), ticks);
    if (k === "runJob") return (gen) => t.runJob(timedGen(`${file} runJob`, gen));
    if (k === "beforeEvents") return wrapSignals(t.beforeEvents, file, "system.before");
    if (k === "afterEvents") return wrapSignals(t.afterEvents, file, "system.after");
    return SKIP;
  });
}
export function __diagWorld(file) {
  const t = realWorld;
  return facade(t, (k) => k === "beforeEvents" ? wrapSignals(t.beforeEvents, file, "before")
    : k === "afterEvents" ? wrapSignals(t.afterEvents, file, "after") : SKIP);
}

// --- monitor ------------------------------------------------------------------------------------------------------

const total = (map) => { let s = 0; for (const [ms] of map.values()) s += ms; return s; };
const merge = (a, b) => {
  const m = new Map();
  for (const src of [a, b]) for (const [k, [ms, n, max, nn, nms]] of src) {
    const e = m.get(k);
    if (e) { e[0] += ms; e[1] += n; if (max > e[2]) e[2] = max; e[3] += nn; e[4] += nms; } else m.set(k, [ms, n, max, nn, nms]);
  }
  return m;
};
const top = (map, n = TOP, min = -1) => [...map].filter(([, [ms]]) => ms > min).sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1]).slice(0, n)
  .map(([k, [ms, calls, max, nn, nms]]) => `${k} ${ms}ms/${calls}x (max ${max}; ${nn} natives ${nms}ms)`).join("; ");
// The single slowest call: [label, ms]. A long one points at one callback; many short ones (or a slow call in a cheap
// callback) point at garbage collection or the engine pausing inside a script call.
const slowest = (map) => { let best = ["none", 0]; for (const [k, [, , max]] of map) if (max > best[1]) best = [k, max]; return best; };
const nativesIn = (map) => { let n = 0, ms = 0; for (const e of map.values()) { n += e[3]; ms += e[4]; } return [n, ms]; };
const short = (label) => label.replace(/\.js /, " ").replace(/^(\S+) (?:system\.)?(?:after|before)\./, "$1 ");

function where() { // text for logs + entity count near the FIRST player (null if no player)
  muted = true;
  try { return whereInner(); } finally { muted = false; }
}
function whereInner() {
  const out = []; let first = null;
  for (const p of realWorld.getPlayers()) {
    try {
      const l = p.location, d = p.dimension;
      let biome = "?";
      try { biome = d.getBiome(l).id.replace("minecraft:", ""); } catch { /* unloaded */ }
      let ents = 0, items = 0;
      try { for (const e of d.getEntities({ location: l, maxDistance: 64 })) { ents++; if (e.typeId === "minecraft:item") items++; } } catch { /* */ }
      if (first === null) first = ents;
      out.push(`${p.name} @${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)} ${biome}, ${ents} entities<64 (${items} items)`);
    } catch { /* player gone */ }
  }
  return { text: out.join(" | "), ents: first };
}
function chat(text) { try { realWorld.sendMessage(text); } catch { /* */ } }
const timeOfDay = () => { try { return realWorld.getTimeOfDay(); } catch { return -1; } };

// per-minute counters (plain numbers; no allocation per tick)
let dew = 0, spawned = 0, removed = 0, spawnTypes = new Map();
globalThis.__diagDew = () => { dew++; }; // called from the patched dew.js on every dew state flip
try {
  realWorld.afterEvents.entitySpawn.subscribe((ev) => {
    spawned++;
    try { const t = ev.entity.typeId; spawnTypes.set(t, (spawnTypes.get(t) ?? 0) + 1); } catch { /* */ }
  });
  realWorld.beforeEvents.entityRemove.subscribe(() => { removed++; });
} catch (e) { console.error(`[lothlorien DIAG] spawn/remove counters unavailable: ${e}`); }

let last = 0, ticks = 0, longest = 0, g1 = 0, g2 = 0, g3 = 0, lines = 0, minNo = 0;
let minStart = 0, startedAt = 0, pending = null;

function monitor() {
  const now = Date.now(), gap = last ? now - last : 0;
  last = now;
  const thisTick = bucket, thisNative = tickNative;
  bucket = new Map(); tickNative = ["none", 0];
  if (pending) { // report a gap one tick later, so script work that ran after the monitor in the long tick is counted
    const all = merge(pending.work, thisTick), lotho = total(all);
    const mins = ((now - startedAt) / 60000).toFixed(1);
    const [slowLabel, slowMs] = slowest(all), allNat = nativesIn(all), slowNat = all.get(slowLabel)?.slice(3) ?? [0, 0], calls = [...all.values()].reduce((n, e) => n + e[1], 0);
    const nat = pending.native[1] >= thisNative[1] ? pending.native : thisNative;
    const text = `[lothlorien DIAG] ${pending.gap >= GAP3 ? "FREEZE" : "gap"} ${pending.gap} ms at tick ${pending.tick} (${mins} min after load, time ${pending.time}). Lothlorien scripts in it: ${lotho} ms in ${calls} calls; slowest single call ${slowLabel} ${slowMs} ms (${slowNat[0]} natives ${slowNat[1]} ms inside it); natives inside all of them: ${allNat[0]} calls ${allNat[1]} ms; slowest native ${nat[0]} ${nat[1]} ms. Top: ${top(all, TOP, 0) || "none"}. ${pending.where}`;
    if (pending.gap >= GAP3) console.error(text); else console.warn(text);
    chat(`§e[Lothlorien DIAG] ${pending.gap >= GAP3 ? "freeze" : "gap"} ${pending.gap} ms, scripts ${lotho} ms${lotho >= pending.gap / 2 ? " §c(script!)" : " §7(engine)"}, time ${pending.time}`);
    if (lotho >= 100) chat(`§e  slowest: ${short(slowLabel)} ${slowMs} ms; ${calls} calls`);
    if (nat[1] >= 10) chat(`§e  slowest native: ${nat[0]} ${nat[1]} ms`);
    pending = null;
  }
  if (gap > 0) {
    ticks++;
    if (gap > longest) longest = gap;
    if (gap >= GAP1) {
      g1++; if (gap >= GAP2) g2++; if (gap >= GAP3) g3++;
      if (lines < MAX_LINES) { lines++; pending = { gap, tick: realSystem.currentTick, work: thisTick, native: thisNative, where: where().text, time: timeOfDay() }; }
    }
  }
  if (now - minStart >= MINUTE_MS) {
    minNo++;
    const w = where(), sc = total(minute), time = timeOfDay();
    const types = [...spawnTypes].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k.replace("minecraft:", "")} ${n}`).join(", ") || "none";
    console.warn(`[lothlorien DIAG] summary min ${minNo}: ${ticks} ticks, longest gap ${longest} ms, gaps >=${GAP1}: ${g1}, >=${GAP2}: ${g2}, >=${GAP3}: ${g3}; Lothlorien scripts ${sc} ms (${nativesIn(minute)[0]} native calls inside, ${nativesIn(minute)[1]} ms). Top: ${top(minute) || "none"}. Natives: slowest ${minNative[0]} ${minNative[1]} ms; ${nativeTop() || "none"}. dew flips ${dew}; spawned ${spawned} (top: ${types}), removed ${removed}; time ${time}. ${w.text}`);
    if (minNative[1] >= 10) chat(`§e  slowest native this minute: ${minNative[0]} ${minNative[1]} ms`);
    chat(`§e[Lothlorien DIAG] min ${minNo}: longest gap ${longest} ms; gaps >=${GAP1}: ${g1}, >=${GAP2}: ${g2}, >=${GAP3}: ${g3}; scripts ${sc} ms; dew ${dew}; spawned ${spawned}, removed ${removed}; ents ${w.ents ?? "-"}; time ${time}`);
    ticks = 0; longest = 0; g1 = 0; g2 = 0; g3 = 0; lines = 0; dew = 0; spawned = 0; removed = 0;
    spawnTypes = new Map(); minute = new Map(); minStart = now;
    minNative = ["none", 0]; nativeLogs = 0; callbackLogs = 0; for (const e of natives.values()) { e.calls = 0; e.ms = 0; e.max = 0; }
  }
}

realWorld.afterEvents.worldLoad.subscribe(() => {
  startedAt = minStart = Date.now();
  realSystem.runInterval(monitor, 1);
  console.warn(`[lothlorien DIAG] diagnostic build loaded: gap reports ON (>=${GAP1} ms), ${registered}/${EXPECTED} custom components registered, native call timing on ${nativeCount} methods`);
  if (nativeCount === 0) console.error("[lothlorien DIAG] native call timing unavailable: no engine prototype method could be wrapped");
  if (registered !== EXPECTED) console.error(`[lothlorien DIAG] SCRIPT LOAD BROKEN: only ${registered}/${EXPECTED} custom components registered`);
});
realWorld.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) realSystem.runTimeout(() => { try { player.sendMessage(registered === EXPECTED
    ? `§e[Lothlorien DIAG] diagnostic build active (${registered}/${EXPECTED} OK): a summary line appears every minute.`
    : `§c[Lothlorien DIAG] BROKEN LOAD: ${registered}/${EXPECTED} components. Please send a screenshot.`); } catch { /* */ } }, 60);
});
