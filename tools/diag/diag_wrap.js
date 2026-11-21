// DIAGNOSTIC BUILD ONLY (built by tools/diag/make_diag.mjs, never shipped). Times every Lothlorien script callback per source file and reports long ticks
// ("freezes") in chat and in the content log, so a tester can tell whether a freeze is spent in Lothlorien scripts or in
// the engine. Every pack file imports `system` / `world` through __diagSystem / __diagWorld (rewritten by make_diag.mjs).
import { system as realSystem, world as realWorld } from "@minecraft/server";

const GAP1 = 150, GAP2 = 300, GAP3 = 700; // tick-gap classes (ms) counted per minute; every gap >= GAP1 is reported
const MAX_LINES = 5;          // immediate chat lines per minute (the summary carries the counts)
const MINUTE_MS = 60000;      // a "minute" is wall clock (Date.now()), so slow ticks do not stretch it
const TOP = 5;

let bucket = new Map();       // label -> [ms, calls, longest single call] since the last monitor tick
let minute = new Map();       // label -> [ms, calls, longest single call] since the last summary
const add = (map, label, ms) => {
  const e = map.get(label);
  if (e) { e[0] += ms; e[1]++; if (ms > e[2]) e[2] = ms; } else map.set(label, [ms, 1, ms]);
};

function timed(label, fn) {
  return function (...args) {
    const t0 = Date.now();
    try { return fn.apply(this, args); }
    finally { const ms = Date.now() - t0; add(bucket, label, ms); add(minute, label, ms); }
  };
}
// A job generator may yield a string label (loop_marker.js sliced() yields the label of its slowest inner step, "from>to"): the call is
// recorded as `<label>[<yielded label>]`, so a long job call names the planner phase and function that ran.
function* timedGen(label, gen) {
  let input;
  for (;;) {
    const t0 = Date.now();
    let r;
    try { r = gen.next(input); }
    finally {
      const ms = Date.now() - t0;
      const named = r && !r.done && typeof r.value === "string" ? `${label}[${r.value}]` : label;
      add(bucket, named, ms); add(minute, named, ms);
    }
    if (r.done) return r.value;
    input = yield r.value;
  }
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
  for (const src of [a, b]) for (const [k, [ms, n, max]] of src) {
    const e = m.get(k);
    if (e) { e[0] += ms; e[1] += n; if (max > e[2]) e[2] = max; } else m.set(k, [ms, n, max]);
  }
  return m;
};
const top = (map, n = TOP, min = -1) => [...map].filter(([, [ms]]) => ms > min).sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1]).slice(0, n)
  .map(([k, [ms, calls, max]]) => `${k} ${ms}ms/${calls}x (max ${max})`).join("; ");
// The single slowest call: [label, ms]. A long one points at one callback; many short ones (or a slow call in a cheap
// callback) point at garbage collection or the engine pausing inside a script call.
const slowest = (map) => { let best = ["none", 0]; for (const [k, [, , max]] of map) if (max > best[1]) best = [k, max]; return best; };
const short = (label) => label.replace(/\.js /, " ").replace(/^(\S+) (?:system\.)?(?:after|before)\./, "$1 ");

function where() { // text for logs + entity count near the FIRST player (null if no player)
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
  const thisTick = bucket;
  bucket = new Map();
  if (pending) { // report a gap one tick later, so script work that ran after the monitor in the long tick is counted
    const all = merge(pending.work, thisTick), lotho = total(all);
    const mins = ((now - startedAt) / 60000).toFixed(1);
    const [slowLabel, slowMs] = slowest(all), calls = [...all.values()].reduce((n, e) => n + e[1], 0);
    const text = `[lothlorien DIAG] ${pending.gap >= GAP3 ? "FREEZE" : "gap"} ${pending.gap} ms at tick ${pending.tick} (${mins} min after load, time ${pending.time}). Lothlorien scripts in it: ${lotho} ms in ${calls} calls; slowest single call ${slowLabel} ${slowMs} ms. Top: ${top(all, TOP, 0) || "none"}. ${pending.where}`;
    if (pending.gap >= GAP3) console.error(text); else console.warn(text);
    chat(`§e[Lothlorien DIAG] ${pending.gap >= GAP3 ? "freeze" : "gap"} ${pending.gap} ms, scripts ${lotho} ms${lotho >= pending.gap / 2 ? " §c(script!)" : " §7(engine)"}, time ${pending.time}`);
    if (lotho >= 100) chat(`§e  slowest: ${short(slowLabel)} ${slowMs} ms; ${calls} calls`);
    pending = null;
  }
  if (gap > 0) {
    ticks++;
    if (gap > longest) longest = gap;
    if (gap >= GAP1) {
      g1++; if (gap >= GAP2) g2++; if (gap >= GAP3) g3++;
      if (lines < MAX_LINES) { lines++; pending = { gap, tick: realSystem.currentTick, work: thisTick, where: where().text, time: timeOfDay() }; }
    }
  }
  if (now - minStart >= MINUTE_MS) {
    minNo++;
    const w = where(), sc = total(minute), time = timeOfDay();
    const types = [...spawnTypes].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k.replace("minecraft:", "")} ${n}`).join(", ") || "none";
    console.warn(`[lothlorien DIAG] summary min ${minNo}: ${ticks} ticks, longest gap ${longest} ms, gaps >=${GAP1}: ${g1}, >=${GAP2}: ${g2}, >=${GAP3}: ${g3}; Lothlorien scripts ${sc} ms. Top: ${top(minute) || "none"}. dew flips ${dew}; spawned ${spawned} (top: ${types}), removed ${removed}; time ${time}. ${w.text}`);
    chat(`§e[Lothlorien DIAG] min ${minNo}: longest gap ${longest} ms; gaps >=${GAP1}: ${g1}, >=${GAP2}: ${g2}, >=${GAP3}: ${g3}; scripts ${sc} ms; dew ${dew}; spawned ${spawned}, removed ${removed}; ents ${w.ents ?? "-"}; time ${time}`);
    ticks = 0; longest = 0; g1 = 0; g2 = 0; g3 = 0; lines = 0; dew = 0; spawned = 0; removed = 0;
    spawnTypes = new Map(); minute = new Map(); minStart = now;
  }
}

realWorld.afterEvents.worldLoad.subscribe(() => {
  startedAt = minStart = Date.now();
  realSystem.runInterval(monitor, 1);
  console.warn(`[lothlorien DIAG] diagnostic build loaded: gap reports ON (>=${GAP1} ms), ${registered}/${EXPECTED} custom components registered`);
  if (registered !== EXPECTED) console.error(`[lothlorien DIAG] SCRIPT LOAD BROKEN: only ${registered}/${EXPECTED} custom components registered`);
});
realWorld.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn) realSystem.runTimeout(() => { try { player.sendMessage(registered === EXPECTED
    ? `§e[Lothlorien DIAG] diagnostic build active (${registered}/${EXPECTED} OK): a summary line appears every minute.`
    : `§c[Lothlorien DIAG] BROKEN LOAD: ${registered}/${EXPECTED} components. Please send a screenshot.`); } catch { /* */ } }, 60);
});
