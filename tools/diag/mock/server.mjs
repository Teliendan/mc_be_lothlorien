// throwaway mock for the diag load test
const deep = (name) => new Proxy(function () {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => name : k === "then" ? undefined : deep(`${name}.${String(k)}`),
  apply: () => deep(`${name}()`), construct: () => deep(`new ${name}`),
});
export const subs = {}, intervals = [], timeouts = [], jobs = [], chat = [];
const signal = (name) => ({ subscribe(cb) { (subs[name] ??= []).push(cb); return cb; }, unsubscribe() {} });
const signals = (kind) => new Proxy({}, { get: (t, k) => signal(`${kind}.${String(k)}`) });
export const system = {
  beforeEvents: signals("system.before"), afterEvents: signals("system.after"),
  runInterval(fn, ticks) { intervals.push([fn, ticks ?? 1]); return intervals.length; },
  runTimeout(fn) { timeouts.push(fn); return 0; }, run(fn) { timeouts.push(fn); return 0; },
  runJob(g) { jobs.push(g); return 0; }, clearRun() {}, clearJob() {}, currentTick: 0,
};
export const world = {
  beforeEvents: signals("before"), afterEvents: signals("after"),
  getPlayers: () => [], getAllPlayers: () => [], sendMessage: (m) => chat.push(m),
  getDynamicProperty: () => undefined, setDynamicProperty() {}, getDimension: () => deep("dim"),
  tickingAreaManager: deep("tam"), structureManager: deep("sm"), scoreboard: deep("sb"),
};
export const BlockPermutation = deep("BlockPermutation"), BlockVolume = deep("BlockVolume"), EasingType = deep("EasingType"),
  EntityInitializationCause = { Loaded: "Loaded", Spawned: "Spawned", Born: "Born" }, EquipmentSlot = deep("EquipmentSlot"),
  GameMode = { Creative: "Creative", Survival: "Survival" }, ItemStack = deep("ItemStack");

// STRICT_NATIVE=1: model engine properties that are read-only and non-configurable on the world object
if (process.env.STRICT_NATIVE) for (const o of [world, system]) for (const k of ["beforeEvents", "afterEvents"])
  Object.defineProperty(o, k, { value: o[k], writable: false, configurable: false });
