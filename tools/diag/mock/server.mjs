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

// Engine classes with prototype methods, like the real module: diag_wrap.js wraps them to time native calls. globalThis.__nativeCost(name) lets a test
// advance its fake clock inside a call ("a native call that takes 135 ms").
const cost = (n) => globalThis.__nativeCost?.(n);
export class Dimension {
  getBiome() { cost("Dimension.getBiome"); return { id: "minecraft:forest" }; }
  getBlock() { cost("Dimension.getBlock"); return undefined; }
  getBlocks() { cost("Dimension.getBlocks"); return undefined; }
  fillBlocks() { cost("Dimension.fillBlocks"); return undefined; }
  getEntities() { cost("Dimension.getEntities"); return []; }
  spawnEntity() { cost("Dimension.spawnEntity"); return undefined; }
  get heightRange() { cost("Dimension.heightRange"); return { min: -64, max: 320 }; }
}
export class Block { setPermutation() { cost("Block.setPermutation"); } }
export class Entity {
  remove() { cost("Entity.remove"); }
  hasTag() { cost("Entity.hasTag"); return false; }
  get location() { cost("Entity.location"); return { x: 1, y: 64, z: 2 }; }
  get dimension() { cost("Entity.dimension"); return new Dimension(); }
}
export class ScreenDisplay { setActionBar() { cost("ScreenDisplay.setActionBar"); } }
export class Player extends Entity { get onScreenDisplay() { cost("Player.onScreenDisplay"); return new ScreenDisplay(); } }
export class StructureManager { place() { cost("StructureManager.place"); } }
export class TickingAreaManager { createTickingArea() { cost("TickingAreaManager.createTickingArea"); return Promise.resolve(); } }

// STRICT_NATIVE=1: model engine properties that are read-only and non-configurable on the world object
if (process.env.STRICT_NATIVE) for (const o of [world, system]) for (const k of ["beforeEvents", "afterEvents"])
  Object.defineProperty(o, k, { value: o[k], writable: false, configurable: false });
