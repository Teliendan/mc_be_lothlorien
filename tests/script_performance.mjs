// Exercise the production event/timer lifecycles, including unload/reload races.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as deerRules from "../lothlorien_bp/scripts/deer_rules.js";
import * as guideRules from "../lothlorien_bp/scripts/white_deer_rules.js";
import * as giftRules from "../lothlorien_bp/scripts/great_mallorn_rules.js";
import * as squirrelRules from "../lothlorien_bp/scripts/squirrel_rules.js";
import * as ropeRules from "../lothlorien_bp/scripts/elven_rope_rules.js";

function engine() {
  const callbacks = new Map(), timers = new Map(), entities = new Map(), dimensions = new Map();
  let tick = 0, serial = 0, queries = 0, reads = 0;
  const events = new Proxy({}, { get: (_, name) => ({ subscribe(fn) {
    if (!callbacks.has(name)) callbacks.set(name, []);
    callbacks.get(name).push(fn);
  } }) });
  const fire = (name, value) => { for (const fn of callbacks.get(name) || []) fn(value); };
  const schedule = (fn, period, repeat) => {
    const id = ++serial; timers.set(id, { fn, period, repeat, at: tick + period }); return id;
  };
  const system = { beforeEvents: { startup: events.startup }, get currentTick() { return tick; },
    run: fn => schedule(fn, 1, false), runTimeout: (fn, delay) => schedule(fn, delay, false),
    runInterval: (fn, period) => schedule(fn, period, true), clearRun: id => timers.delete(id) };
  const world = { afterEvents: events, players: [], getPlayers() { return this.players; },
    getEntity: id => entities.get(id), getAbsoluteTime: () => tick,
    getDimension: id => dimensions.get(id) };
  for (const id of ["overworld", "nether", "the_end"]) {
    const dimension = { id, getEntities({ type }) {
      queries++;
      return [...entities.values()].filter(e => e.isValid && e.dimension === dimension && e.typeId === type);
    }, getBlock() { reads++; return { typeId: dimension.rope ? "lothlorien:elven_rope" : "minecraft:air" }; },
    spawnEntity(typeId, location) {
      const e = entity(typeId, dimension, location); fire("entitySpawn", { entity: e }); return e;
    } };
    dimensions.set(id, dimension);
  }
  function entity(typeId, dimension = dimensions.get("overworld"), location = { x: 0, y: 0, z: 0 }) {
    const properties = new Map(), dynamic = new Map();
    const e = { id: `e${++serial}`, typeId, dimension, location, isValid: true, events: [],
      getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value),
      getDynamicProperty: key => dynamic.get(key), setDynamicProperty: (key, value) => dynamic.set(key, value),
      getComponent(component) {
        if (component === "equippable" && typeId === "minecraft:player")
          return { getEquipmentSlot: () => ({ typeId: guideRules.ACORN_ID }) };
      }, hasTag: tag => e.tag === tag, sendMessage() {}, getGameMode: () => "creative",
      triggerEvent(name) {
        e.events.push(name);
        if (name === "lothlorien:guide_start") properties.set("lothlorien:guiding", true);
        if (name === "lothlorien:guide_end") properties.set("lothlorien:guiding", false);
        if (name.startsWith("lothlorien:set_")) properties.set("lothlorien:wariness", name.slice(15));
      }, remove() { e.isValid = false; entities.delete(e.id); }, teleport(p) { e.location = p; } };
    entities.set(e.id, e); return e;
  }
  const advance = n => {
    for (let i = 0; i < n; i++) {
      tick++;
      for (const [id, task] of [...timers]) {
        if (!timers.has(id) || task.at > tick) continue;
        if (task.repeat) task.at += task.period; else timers.delete(id);
        task.fn();
      }
    }
  };
  return { system, world, entity, fire, advance, dimensions, entities,
    intervals: period => [...timers.values()].filter(t => t.repeat && t.period === period).length,
    get queries() { return queries; }, get reads() { return reads; } };
}

let imports = 0;
async function load(name, bindings) {
  globalThis.__scriptPerformance = bindings;
  const source = readFileSync(new URL(`../lothlorien_bp/scripts/${name}.js`, import.meta.url), "utf8")
    .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__scriptPerformance;");
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${imports++}`);
  delete globalThis.__scriptPerformance;
  return mod;
}
const common = h => ({ system: h.system, world: h.world, harmonyOf: p => ({ harmony: p.band || "friend" }),
  bandOf: b => b, repeatedUse: () => false, message: () => "", noteDeed() {},
  healAnimal() {}, isInjured: () => false, eatHeldFood: () => true });

{
  const h = engine();
  const mod = await load("deer", { ...common(h), ...deerRules, isGuiding: () => false, isErrand: () => false });
  mod.startDeer();
  assert.equal(h.queries, 15, "one bootstrap, five types in three dimensions");
  h.advance(100);
  assert.equal(h.intervals(40), 0, "no wariness loop without loaded wildlife");
  const dim = h.dimensions.get("nether");
  const friend = h.entity("minecraft:player", dim), hostile = h.entity("minecraft:player", dim, { x: 25, y: 0, z: 0 });
  hostile.band = "hated"; h.world.players = [friend, hostile];
  const deer = h.entity(deerRules.DEER_ID, dim);
  h.fire("entitySpawn", { entity: deer }); h.fire("entityLoad", { entity: deer });
  assert.equal(h.intervals(40), 1, "duplicate load does not start a second timer");
  h.advance(40);
  assert.ok(deer.events.includes("lothlorien:set_l3"), "severe player wins outside Lothlorien too");
  assert.equal(h.queries, 15, "no recurring entity queries");
  const before = deer.events.length;
  friend.location.y = hostile.location.y = 41; h.advance(40);
  assert.equal(deer.events.length, before, "same 3D watch radius as original queries");
  friend.location.y = hostile.location.y = 0;
  deer.setProperty("lothlorien:alarmed", true); h.advance(40);
  assert.equal(deer.events.length, before, "alarm retains native state");
  deer.setProperty("lothlorien:alarmed", false); deer.setProperty("lothlorien:guiding", true); h.advance(40);
  assert.ok(deer.events.includes("lothlorien:guide_end"), "orphaned guide is released");
  h.fire("entityRemove", { removedEntityId: deer.id });
  assert.equal(h.intervals(40), 0, "last unload stops timer");
  h.fire("entityLoad", { entity: deer }); assert.equal(h.intervals(40), 1, "reload restarts timer");
  deer.isValid = false; h.advance(40); assert.equal(h.intervals(40), 0, "invalid-handle fallback stops timer");
}

{
  const h = engine(), dim = h.dimensions.get("overworld");
  const stray = h.entity(guideRules.BEACON_ID), dev = h.entity(guideRules.BEACON_ID); dev.tag = "guide_beacon";
  const mod = await load("white_deer", { ...common(h), ...guideRules, ...giftRules,
    EntityInitializationCause: { Loaded: "Loaded" }, EquipmentSlot: {}, GameMode: { Creative: "creative" }, ItemStack: class {},
    pickWaypoint: () => ({ x: 10, y: 0, z: 0 }), hopStatus: () => "go" });
  mod.startWhiteDeer(() => ({ level: 3 }), {});
  assert.equal(stray.isValid, false); assert.equal(dev.isValid, true);
  assert.equal(h.intervals(5), 0);
  const bootstrap = h.queries;
  h.advance(400); assert.equal(h.queries, bootstrap, "beacon sweeps do not recur");
  const player = h.entity("minecraft:player"); h.world.players = [player];
  const deer = h.entity(guideRules.WHITE_DEER_ID);
  deer.setDynamicProperty("lothlorien:gift_spot", JSON.stringify({ x: 40, y: 0, z: 0, dim: dim.id }));
  h.fire("playerInteractWithEntity", { player, target: deer, itemStack: { typeId: guideRules.ACORN_ID } });
  assert.ok(mod.isGuiding(deer.id)); assert.equal(h.intervals(5), 1);
  h.advance(1);
  const owned = [...h.entities.values()].find(e => e.typeId === guideRules.BEACON_ID && e !== dev);
  assert.ok(owned?.isValid, "spawn-before-session race preserves owned helper");
  const external = h.entity(guideRules.BEACON_ID);
  mod.addBeaconSource(() => [external.id]); h.fire("entityLoad", { entity: external });
  const lateStray = h.entity(guideRules.BEACON_ID); h.fire("entityLoad", { entity: lateStray }); h.advance(1);
  assert.ok(external.isValid); assert.equal(lateStray.isValid, false);
  h.world.players = []; h.advance(5);
  assert.equal(h.intervals(5), 0); assert.equal(owned.isValid, false);
  assert.equal(mod.isGuiding(deer.id), false);
}

{
  const h = engine(), sources = [];
  const mod = await load("squirrel", { ...common(h), ...guideRules, ...squirrelRules,
    addBeaconSource: fn => sources.push(fn), consumeAcorn() {}, stand() {},
    pickAway: () => ({ x: 12, y: 0, z: 0 }) });
  mod.startSquirrels(); assert.equal(h.intervals(10), 0);
  const player = h.entity("minecraft:player"); h.world.players = [player];
  const first = h.entity(squirrelRules.SQUIRREL_ID), second = h.entity(squirrelRules.SQUIRREL_ID);
  const offer = target => h.fire("playerInteractWithEntity", { player, target, itemStack: { typeId: guideRules.ACORN_ID } });
  offer(first); offer(second); assert.equal(h.intervals(10), 1); assert.equal(sources[0]().length, 2);
  h.entities.delete(first.id); h.advance(10);
  assert.equal(mod.isErrand(first.id), false); assert.equal(h.intervals(10), 1, "other session survives");
  h.world.players = []; h.advance(10); assert.equal(h.intervals(10), 0);
  h.world.players = [player]; offer(second); assert.equal(h.intervals(10), 1, "later offer restarts timer");
  second.setProperty("lothlorien:alarmed", true); h.advance(10); assert.equal(h.intervals(10), 0);
}

{
  const h = engine(), dim = h.dimensions.get("overworld");
  const mod = await load("elven_rope", { ...common(h), ...ropeRules,
    BlockPermutation: {}, EquipmentSlot: {}, GameMode: {}, ItemStack: class {} });
  const player = h.entity("minecraft:player"); h.world.players = [player];
  const effects = new Set();
  Object.assign(player, { inputInfo: { getButtonState: () => "Pressed", getMovementVector: () => ({ y: 0 }) },
    getVelocity: () => ({ y: 0 }), addEffect: name => effects.add(name), removeEffect: name => effects.delete(name) });
  mod.startRopeClimbing(); h.advance(20);
  assert.equal(h.intervals(1), 0, "no per-tick loop away from ropes");
  assert.equal(h.reads, 10, "idle entry reads reduced from 40 to 10 per second");
  dim.rope = true; h.advance(4);
  assert.equal(h.intervals(1), 1); assert.ok(effects.has("levitation"));
  player.isSneaking = true; const held = player.location.y; h.advance(1);
  assert.equal(player.location.y, held); assert.equal(effects.size, 0);
  player.isSneaking = false; h.advance(1); assert.ok(effects.has("levitation"));
  dim.rope = false; h.advance(1);
  assert.equal(h.intervals(1), 0, "contact ends fast timer"); assert.equal(effects.size, 0);
  dim.rope = true; h.advance(4); assert.equal(h.intervals(1), 1);
  h.world.players = []; h.fire("playerLeave", { playerId: player.id }); assert.equal(h.intervals(1), 0);
}
console.log("ok   script performance: creature load lifecycle, active sessions, beacon ownership, rope entry/exit");
