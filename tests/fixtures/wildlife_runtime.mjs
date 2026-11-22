// Shared wildlife API fixture: no test bodies or worlds run on import.
import { readFileSync } from "node:fs";
import { createEntityRouter } from "../../lothlorien_bp/scripts/entity_events_rules.js";
import * as deerRules from "../../lothlorien_bp/scripts/deer_rules.js";
import * as rules from "../../lothlorien_bp/scripts/white_deer_rules.js";
import * as giftRules from "../../lothlorien_bp/scripts/great_mallorn_rules.js";
import { entityUtilFake } from "./entity_util_fake.mjs";
let serial = 0;
async function load(name, bindings, expose = "") {
  bindings = { ...entityUtilFake(bindings), ...bindings };
  globalThis.__deerInteractions = bindings;
  const src = readFileSync(new URL(`../../lothlorien_bp/scripts/${name}.js`, import.meta.url), "utf8")
    .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__deerInteractions;");
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src + expose).toString("base64")}#${serial++}`);
  delete globalThis.__deerInteractions; return mod;
}
class Item {
  constructor(typeId, amount = 1) { Object.assign(this, { typeId, amount, isStackable: true }); }
  clone() { const copy = new Item(this.typeId, this.amount); copy.nameTag = this.nameTag; return copy; }
  getComponent() {} getRawLore() { return []; } getCanPlaceOn() { return []; } getCanDestroy() { return []; }
  getDynamicPropertyIds() { return []; } isStackableWith(other) { return this.typeId === other.typeId && this.nameTag === other.nameTag; }
  setLore(lore) { this.lore = lore; }
}
function engine() {
  const callbacks = new Map(), timers = new Map(), entities = new Map(), jobs = [];
  let id = 0, tick = 0;
  const events = new Proxy({}, { get: (_, name) => ({ subscribe(fn) {
    if (!callbacks.has(name)) callbacks.set(name, []); callbacks.get(name).push(fn);
  } }) });
  const fire = (name, event) => { for (const fn of callbacks.get(name) || []) fn(event); };
  const system = { get currentTick() { return tick; }, run(fn) { return this.runTimeout(fn, 1); },
    runTimeout(fn, ticks) { const key = ++id; timers.set(key, { fn, at: tick + ticks }); return key; },
    runInterval(fn, period) { const key = ++id; timers.set(key, { fn, at: tick + period, period }); return key; },
    clearRun(key) { timers.delete(key); }, runJob(job) { jobs.push(job); } };
  const dimension = { id: "overworld", drops: [], particles: 0, blocked: new Map(),
    getBlock(p) { const y = Math.floor(p.y), typeId = this.blocked.get(`${Math.floor(p.x)},${y},${Math.floor(p.z)}`) || (y === 64 ? "minecraft:grass_block" : y < 64 ? "minecraft:dirt" : "minecraft:air");
      return { typeId, y, isAir: typeId === "minecraft:air", isLiquid: ["minecraft:water", "minecraft:lava"].includes(typeId),
        isWaterlogged: this.waterlogged === `${Math.floor(p.x)},${y},${Math.floor(p.z)}`,
        below: () => this.getBlock({ ...p, y: y - 1 }) }; }, // the Block members of @minecraft/server 2.8.0 only (no beta isSolid)
    // vertical block raycast: air and passable plants let the ray through, liquids stop it only with includeLiquidBlocks; the start cell counts.
    // Optional `shapes` (typeId -> top height in blocks, default 1): a downward ray meets such a block only within maxDistance of its top.
    getBlockFromRay(from, direction, { maxDistance = 64, includeLiquidBlocks = false } = {}) {
      const x = Math.floor(from.x), z = Math.floor(from.z), step = direction.y < 0 ? -1 : 1, end = from.y + step * maxDistance;
      for (let y = Math.floor(from.y); step < 0 ? y + 1 > end : y < end; y += step) {
        const block = this.getBlock({ x, y, z });
        if (block.isLiquid ? !includeLiquidBlocks : ["minecraft:air", "minecraft:short_grass"].includes(block.typeId)) continue;
        const h = block.isLiquid ? 1 : this.shapes?.get(block.typeId) ?? 1;
        if (h < 1 && step < 0 && !(from.y >= y && from.y < y + h) && from.y - (y + h) > maxDistance) return undefined;
        return { block };
      }
      return undefined;
    },
    // `tops` ("x,z" -> y) gives single columns their own topmost block, like a crown over a deck; `top` is the default
    getTopmostBlock(p) { return this.getBlock({ ...p, y: this.tops?.get(`${Math.floor(p.x)},${Math.floor(p.z)}`) ?? this.top ?? 64 }); },
    getEntities({ type, location, maxDistance } = {}) { return [...entities.values()].filter(e => e.isValid && (!type || e.typeId === type) &&
      (!location || Math.hypot(e.location.x - location.x, e.location.y - location.y, e.location.z - location.z) <= maxDistance)); },
    spawnParticle() { this.particles++; if (this.particleError) throw Error("particle"); },
    spawnItem(item, at) { this.drops.push({ item, at }); return {}; },
    spawnEntity(typeId, at) { return entity(typeId, at); } };
  const world = { afterEvents: events, beforeEvents: events, players: [], getPlayers() { return this.players; },
    getDimension: () => dimension, getEntity: key => entities.get(key) };
  function entity(typeId, location = { x: 0, y: 65, z: 0 }) {
    const props = new Map(), dyn = new Map(), health = { currentValue: 14, effectiveMax: 14, setCurrentValue(n) { this.currentValue = n; } };
    const e = { id: `e${++id}`, typeId, location, dimension, isValid: true, events: [], health, band: "friend", mode: "survival", leashed: false,
      selectedSlotIndex: 0, slot: { item: new Item(rules.ACORN_ID, 3), getItem() { return this.item; }, hasItem() { return !!this.item; },
        get typeId() { return this.item?.typeId; }, get amount() { return this.item?.amount; }, set amount(n) { this.item.amount = n; }, setItem(item) { this.item = item; } },
      getGameMode() { return this.mode; }, getHeadLocation() { return { ...this.location, y: this.location.y + 1.6 }; },
      getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value),
      getDynamicProperty: key => dyn.get(key), setDynamicProperty: (key, value) => dyn.set(key, value),
      getComponent(key) { return key === "minecraft:health" ? health : key === "minecraft:leashable" ? { isLeashed: e.leashed } :
        key === "equippable" ? { getEquipmentSlot: () => e.slot } : undefined; },
      triggerEvent(name) { this.events.push(name); if (name === "lothlorien:guide_start") props.set("lothlorien:guiding", true);
        if (name === "lothlorien:guide_end") props.set("lothlorien:guiding", false); },
      hasTag: () => false, sendMessage() {}, remove() { this.isValid = false; entities.delete(this.id); }, teleport(at) { this.location = at; } };
    entities.set(e.id, e); return e;
  }
  function advance(n) { for (let i = 0; i < n; i++) { tick++; for (const [key, task] of [...timers]) if (timers.has(key) && task.at <= tick) {
    if (task.period) task.at += task.period; else timers.delete(key); task.fn();
  } } }
  const flush = () => { for (const job of jobs.splice(0)) while (!job.next().done) {} };
  return { world, system, dimension, entity, fire, advance, flush, timers, jobs, onEntity: createEntityRouter(world).on };
}
// `realWalk`: keep the real pickWaypoint and hopStatus (the default mocks both: a waypoint 14 ahead, always "go"); `h.debug` is the debug switch.
async function setup({ realWalk = false } = {}) {
  const h = engine(); h.debug = false;
  const base = { ...h, ...deerRules, ...rules, ...giftRules,
    EquipmentSlot: { Mainhand: "mainhand" }, GameMode: { Survival: "survival", Adventure: "adventure", Creative: "creative", Spectator: "spectator" },
    EntityInitializationCause: { Loaded: "Loaded" }, ItemStack: Item, harmonyOf: e => ({ harmony: e.band }), bandOf: b => b,
    message: s => s, repeatedUse: () => false, isGuiding: () => false, isErrand: () => false,
    villageDebug: () => h.debug,
    ...(realWalk ? {} : { pickWaypoint: () => ({ x: 14, y: 65, z: 0, final: false }), hopStatus: () => "go" }) };
  const food = await load("animal_food", { ...base, FOOD_HEALTH: 2, FLOWER_ITEMS: [], GRAIN_ITEMS: [] });
  h.base = { ...base, ...food }; h.depth = { level: 3, complete: true };
  h.biome = { id: "lothlorien", transparent: new Set(), at: () => "lothlorien" };
  h.mod = await load("white_deer", h.base, "\nexport { groundFeet, giveGift, sessions, tickSessions, judgeNaturalSpawn };\n");
  h.mod.startWhiteDeer(() => h.depth, () => h.depth.level > 0, h.biome);
  h.player = h.entity("minecraft:player"); h.world.players.push(h.player);
  h.deer = h.entity(rules.WHITE_DEER_ID);
  h.offer = () => h.fire("playerInteractWithEntity", { player: h.player, target: h.deer, itemStack: h.player.slot.item.clone() });
  return h;
}

export { setup, load, Item };
