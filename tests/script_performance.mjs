// Exercise the production event/timer lifecycles, including unload/reload races.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEntityRouter } from "../lothlorien_bp/scripts/entity_events_rules.js";
import * as deerRules from "../lothlorien_bp/scripts/deer_rules.js";
import * as guideRules from "../lothlorien_bp/scripts/white_deer_rules.js";
import * as giftRules from "../lothlorien_bp/scripts/great_mallorn_rules.js";
import * as squirrelRules from "../lothlorien_bp/scripts/squirrel_rules.js";
import * as ropeRules from "../lothlorien_bp/scripts/elven_rope_rules.js";
import { entityUtilFake } from "./fixtures/entity_util_fake.mjs";
class TestItem {
  constructor(typeId = guideRules.ACORN_ID, amount = 1) { Object.assign(this, { typeId, amount }); }
  clone() { return new TestItem(this.typeId, this.amount); }
  getComponent() {} getRawLore() { return []; } getCanPlaceOn() { return []; } getCanDestroy() { return []; }
  getDynamicPropertyIds() { return []; }
}

function engine() {
  const callbacks = new Map(), timers = new Map(), entities = new Map(), dimensions = new Map();
  let tick = 0, serial = 0, queries = 0, reads = 0;
  const events = new Proxy({}, { get: (_, name) => ({ subscribe(fn) {
    if (!callbacks.has(name)) callbacks.set(name, []);
    callbacks.get(name).push(fn);
  } }) });
  const fire = (name, value) => {
    if (value.itemStack && !value.itemStack.clone) value.itemStack = new TestItem(value.itemStack.typeId);
    for (const fn of callbacks.get(name) || []) fn(value);
  };
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
    }, getBlock(p) { reads++; return { typeId: dimension.rope ? "lothlorien:elven_rope" : p.y < 0 ? "minecraft:stone" : "minecraft:air",
      isAir: p.y >= 0, isLiquid: false, isWaterlogged: false, y: Math.floor(p.y) }; },
    getTopmostBlock(p) { return this.getBlock({ x: p.x, y: -1, z: p.z }); }, // the stone floor ends at y -1
    getBlockFromRay(from, direction, { maxDistance = 64 } = {}) { // vertical rays only: stone below y 0 (Block members of server 2.8.0, no isSolid)
      const step = direction.y < 0 ? -1 : 1, end = from.y + step * maxDistance;
      for (let y = Math.floor(from.y); step < 0 ? y + 1 > end : y < end; y += step) {
        const block = this.getBlock({ x: from.x, y, z: from.z });
        if (!block.isAir) return { block };
      }
      return undefined;
    },
    spawnEntity(typeId, location) {
      const e = entity(typeId, dimension, location); fire("entitySpawn", { entity: e }); return e;
    } };
    dimensions.set(id, dimension);
  }
  function entity(typeId, dimension = dimensions.get("overworld"), location = { x: 0, y: 0, z: 0 }) {
    const properties = new Map(), dynamic = new Map();
    const held = new TestItem(), slot = { getItem: () => held, typeId: held.typeId, hasItem: () => true, amount: 1, setItem() {} };
    const e = { id: `e${++serial}`, typeId, dimension, location, isValid: true, events: [], selectedSlotIndex: 0,
      getHeadLocation: () => ({ ...e.location, y: e.location.y + 1.6 }),
      getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value),
      getDynamicProperty: key => dynamic.get(key), setDynamicProperty: (key, value) => dynamic.set(key, value),
      getComponent(component) {
        if (component === "minecraft:health") return { currentValue: 20, effectiveMax: 20 };
        if (component === "equippable" && typeId === "minecraft:player")
          return { getEquipmentSlot: () => slot };
      }, hasTag: tag => e.tag === tag, sendMessage() {}, getGameMode: () => "survival",
      triggerEvent(name) {
        e.events.push(name);
        if (name === "lothlorien:guide_start") properties.set("lothlorien:guiding", true);
        if (name === "lothlorien:guide_end") properties.set("lothlorien:guiding", false);
      }, remove() { e.isValid = false; entities.delete(e.id); }, teleport(p) { e.location = p; } };
    entities.set(e.id, e); return e;
  }
  const advance = n => {
    for (let i = 0; i < n; i++) {
      tick++;
      for (const entity of entities.values()) for (const [name, effect] of entity.ropeEffects ?? []) {
        if (--effect.duration <= 0) entity.ropeEffects.delete(name);
      }
      for (const [id, task] of [...timers]) {
        if (!timers.has(id) || task.at > tick) continue;
        if (task.repeat) task.at += task.period; else timers.delete(id);
        task.fn();
      }
    }
  };
  return { system, world, entity, fire, advance, dimensions, entities, timers,
    intervals: period => [...timers.values()].filter(t => t.repeat && t.period === period).length,
    get queries() { return queries; }, get reads() { return reads; } };
}

let imports = 0;
async function load(name, bindings) {
  bindings = { ...entityUtilFake(bindings), ...bindings };
  globalThis.__scriptPerformance = bindings;
  const source = readFileSync(new URL(`../lothlorien_bp/scripts/${name}.js`, import.meta.url), "utf8")
    .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__scriptPerformance;");
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${imports++}`);
  delete globalThis.__scriptPerformance;
  return mod;
}
const common = h => ({ system: h.system, world: h.world, onEntity: (h.onEntity ??= createEntityRouter(h.world).on), harmonyOf: p => ({ harmony: p.band || "friend" }),
  GameMode: { Survival: "survival", Adventure: "adventure", Creative: "creative", Spectator: "spectator" }, EquipmentSlot: { Mainhand: "mainhand" },
  bandOf: b => b, repeatedUse: () => false, message: () => "", noteDeed() {},
  readBlock: (dimension, location) => dimension.getBlock(location),
  healAnimal() {}, isInjured: () => false, eatHeldFood: () => true });

{
  const h = engine();
  const mod = await load("deer", { ...common(h), ...deerRules, isGuiding: () => false, isErrand: () => false });
  mod.startDeer();
  assert.equal(h.queries, 6, "one bootstrap for the two guiding types in three dimensions");
  h.advance(100);
  assert.equal(h.timers.size, 0, "deer.js registers no interval");
  const dim = h.dimensions.get("nether");
  const hostile = h.entity("minecraft:player", dim, { x: 25, y: 0, z: 0 });
  hostile.band = "hated"; h.world.players = [hostile];
  const deer = h.entity(deerRules.UNICORN_ID, dim);
  h.fire("entitySpawn", { entity: deer }); h.fire("entityLoad", { entity: deer });
  h.advance(400);
  assert.deepEqual(deer.events, [], "a band never reaches the animal through script");
  assert.equal(h.queries, 6, "no recurring entity queries");
  deer.setProperty("lothlorien:guiding", true); h.advance(40);
  assert.ok(!deer.events.includes("lothlorien:guide_end"), "only the types that guide are released, and only when they load");
  for (const type of [guideRules.WHITE_DEER_ID, deerRules.SQUIRREL_ID]) {
    const orphan = h.entity(type, dim); orphan.setProperty("lothlorien:guiding", true);
    h.fire("entityLoad", { entity: orphan });
    assert.ok(orphan.events.includes("lothlorien:guide_end"), `${type}: an orphaned guide is released when it loads`);
    const idle = h.entity(type, dim); h.fire("entityLoad", { entity: idle });
    assert.ok(!idle.events.includes("lothlorien:guide_end"), `${type}: a loaded animal that is not guiding is left alone`);
  }
}

{
  const h = engine(), dim = h.dimensions.get("overworld");
  const mod = await load("white_deer", { ...common(h), ...guideRules, ...giftRules,
    EntityInitializationCause: { Loaded: "Loaded" }, ItemStack: TestItem,
    pickWaypoint: () => ({ x: 10, y: 0, z: 0 }), hopStatus: () => "go" });
  mod.startWhiteDeer(() => ({ level: 3, complete: true }), () => true, { id: "lothlorien", at: () => "lothlorien" });
  assert.equal(h.intervals(5), 0);
  const player = h.entity("minecraft:player"); h.world.players = [player];
  const deer = h.entity(guideRules.WHITE_DEER_ID);
  deer.setDynamicProperty("lothlorien:gift_spot", JSON.stringify({ x: 40, y: 0, z: 0, dim: dim.id }));
  h.fire("playerInteractWithEntity", { player, target: deer, itemStack: { typeId: guideRules.ACORN_ID } });
  assert.ok(mod.isGuiding(deer.id)); assert.equal(h.intervals(5), 1);
  h.advance(1);
  const owned = [...h.entities.values()].find(e => e.typeId === guideRules.BEACON_ID);
  assert.ok(owned?.isValid, "spawn-before-session race preserves owned helper");
  h.world.players = []; player.isValid = false; h.advance(5); // a player who left: not listed, and world.getEntity no longer finds a valid one
  assert.equal(h.intervals(5), 0); assert.equal(owned.isValid, false);
  assert.equal(mod.isGuiding(deer.id), false);
}

{
  const h = engine();
  const mod = await load("squirrel", { ...common(h), ...guideRules, ...squirrelRules,
    consumeHeld() {}, stand() {},
    pickAway: () => ({ x: 12, y: 0, z: 0 }) });
  mod.startSquirrels(); assert.equal(h.intervals(10), 0);
  const player = h.entity("minecraft:player"); h.world.players = [player];
  player.getGameMode = () => "creative"; // lifecycle test can start two errands without inventory charges
  const first = h.entity(squirrelRules.SQUIRREL_ID), second = h.entity(squirrelRules.SQUIRREL_ID);
  const offer = target => h.fire("playerInteractWithEntity", { player, target, itemStack: { typeId: guideRules.ACORN_ID } });
  offer(first); offer(second); assert.equal(h.intervals(10), 1); assert.equal([...h.entities.values()].filter(e => e.typeId === guideRules.BEACON_ID).length, 2);
  h.entities.delete(first.id); h.advance(10);
  assert.equal(mod.isErrand(first.id), false); assert.equal(h.intervals(10), 1, "other session survives");
  h.world.players = []; player.isValid = false; h.advance(10); assert.equal(h.intervals(10), 0);
  h.world.players = [player]; player.isValid = true; offer(second); assert.equal(h.intervals(10), 1, "later offer restarts timer");
  second.setProperty("lothlorien:alarmed", true); h.advance(10); assert.equal(h.intervals(10), 0);
}

{
  const h = engine(), dim = h.dimensions.get("overworld");
  const mod = await load("elven_rope", { ...common(h), ...ropeRules,
    BlockPermutation: {}, EquipmentSlot: {}, GameMode: {}, ItemStack: class {} });
  const player = h.entity("minecraft:player"); h.world.players = [player];
  const effects = new Map(); player.ropeEffects = effects;
  Object.assign(player, { inputInfo: { getButtonState: () => "Pressed", getMovementVector: () => ({ y: 0 }) },
    getVelocity: () => ({ y: 0 }), getEffect: name => effects.get(name),
    addEffect: (name, duration, options) => effects.set(name, { duration, ...options }),
    removeEffect: name => effects.delete(name) });
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
