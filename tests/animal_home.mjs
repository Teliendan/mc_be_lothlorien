// Exercise the real interaction handlers with inventory, health and biome changes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as foods from "../lothlorien_bp/scripts/animal_food_rules.js";
import * as guideRules from "../lothlorien_bp/scripts/white_deer_rules.js";
import * as giftRules from "../lothlorien_bp/scripts/great_mallorn_rules.js";
import * as squirrelRules from "../lothlorien_bp/scripts/squirrel_rules.js";
import * as swanRules from "../lothlorien_bp/scripts/swan_rules.js";
import * as unicornRules from "../lothlorien_bp/scripts/unicorn_rules.js";
import { message as localizedMessage } from "../lothlorien_bp/scripts/messages.js";

const ACORN = guideRules.ACORN_ID, BOTTLE = "lothlorien:bottle_of_fireflies";
const EMPTY = "minecraft:glass_bottle";
const entityJson = name => JSON.parse(readFileSync(new URL(`../lothlorien_bp/entities/${name}.json`, import.meta.url)))["minecraft:entity"];
let serial = 0;
class TestItem {
  constructor(typeId, amount = 1) { Object.assign(this, { typeId, amount }); }
  clone() { const copy=new TestItem(this.typeId,this.amount);copy.nameTag=this.nameTag;copy.lore=structuredClone(this.lore);return copy; }
  getComponent() {} getRawLore() { return structuredClone(this.lore??[]); } getCanPlaceOn() { return []; } getCanDestroy() { return []; }
  getDynamicPropertyIds() { return []; }
  setLore(lines) { this.lore = structuredClone(lines); }
}
async function load(name, bindings) {
  if (["fireflies", "white_deer", "squirrel"].includes(name) && !bindings.captureHand) {
    const cover = await load("cover_use", { ...bindings, readBlock: (d, p) => d.getBlock(p), SUPPORT_POLICIES: {} });
    const hand = await load("interaction_use", { ...bindings, ...cover });
    bindings = { ...bindings, ...cover, ...hand };
  }
  if (name === "fireflies") bindings = { ...bindings, ...await load("firefly_bottle",{...bindings,message:localizedMessage}) };
  globalThis.__animalHome = bindings;
  const source = readFileSync(new URL(`../lothlorien_bp/scripts/${name}.js`, import.meta.url), "utf8")
    .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__animalHome;");
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${serial++}`);
  delete globalThis.__animalHome;
  return module;
}

function engine() {
  const callbacks = new Map(), timers = new Map(), entities = new Map(), deeds = [];
  let tick = 0, nextId = 0;
  const events = phase => new Proxy({}, { get: (_, name) => ({ subscribe(fn) {
    const key = `${phase}:${name}`;
    if (!callbacks.has(key)) callbacks.set(key, []);
    callbacks.get(key).push(fn);
  } }) });
  const fire = (phase, name, event) => {
    if (event.itemStack && !event.itemStack.clone) event.itemStack = new TestItem(event.itemStack.typeId, event.player.slot.amount);
    if (event.block) event.block = { ...dimension.getBlock(event.block.location), ...event.block,
      center: () => ({ ...event.block.location, x: event.block.location.x + .5, y: event.block.location.y + .5, z: event.block.location.z + .5 }) };
    for (const fn of callbacks.get(`${phase}:${name}`) || []) fn(event);
  };
  const schedule = (fn, delay, repeat = false) => {
    const id = ++nextId; timers.set(id, { fn, at: tick + delay, delay, repeat }); return id;
  };
  const system = { get currentTick() { return tick; }, run: fn => schedule(fn, 1),
    runTimeout: (fn, delay) => schedule(fn, delay), runInterval: (fn, delay) => schedule(fn, delay, true),
    clearRun: id => timers.delete(id) };
  const dimension = { id: "overworld", spawned: [], drops: [], blocked: false,
    getBlock(location) {
      const typeId = dimension.blocked ? "minecraft:stone" : "minecraft:air";
      return { dimension, location, typeId, isAir: typeId === "minecraft:air", isWaterlogged: false,
        permutation: { matches: id => id === typeId, getAllStates: () => ({}) } };
    },
    getEntities: ({ type }) => [...entities.values()].filter(e => e.typeId === type),
    spawnParticle() {}, playSound() {},
    spawnItem(item) { dimension.drops.push(item); },
    spawnEntity(typeId, location, options) {
      const e = entity(typeId); e.location = location; e.spawnEvent = options?.spawnEvent;
      if (e.spawnEvent) e.triggerEvent(e.spawnEvent);
      dimension.spawned.push(e); return e;
    } };
  const world = { beforeEvents: events("before"), afterEvents: events("after"), players: [],
    getAbsoluteTime: () => tick, getPlayers: () => world.players,
    getDimension: () => dimension, getEntity: id => entities.get(id) };
  function entity(typeId, hp = 3, max = 8) {
    const properties = new Map(), dynamic = new Map();
    const health = { currentValue: hp, effectiveMax: max, setCurrentValue: value => { health.currentValue = value; } };
    const e = { id: `e${++nextId}`, typeId, dimension, location: { x: 0, y: 64, z: 0 }, isValid: true,
      events: [], health, leashed: false, baby: false, hasTag: () => false,
      getProperty: k => properties.get(k), setProperty: (k, v) => properties.set(k, v),
      getDynamicProperty: k => dynamic.get(k), setDynamicProperty: (k, v) => dynamic.set(k, v),
      getComponent: k => k === "minecraft:health" ? health : k === "minecraft:leashable" ? { isLeashed: e.leashed } :
        k === "minecraft:is_baby" ? (e.baby ? {} : undefined) : undefined,
      triggerEvent(name) {
        e.events.push(name);
        if (typeId === swanRules.SWAN_ID)
          for (const [key, value] of Object.entries(entityJson("swan").events[name]?.set_property || {}))
            if (typeof value === "boolean") properties.set(key, value);
        if (name === "lothlorien:guide_start") properties.set("lothlorien:guiding", true);
        if (name === "lothlorien:guide_end") properties.set("lothlorien:guiding", false);
      },
      remove() { e.isValid = false; entities.delete(e.id); }, teleport(p) { e.location = p; } };
    properties.set("lothlorien:wariness", "calm"); entities.set(e.id, e); return e;
  }
  function player(typeId, amount = 1, creative = false, fullInventory = false) {
    const p = entity("minecraft:player"), slot = { item: new TestItem(typeId, amount), getItem() { return this.item; },
      hasItem() { return !!this.item; }, get typeId() { return this.item?.typeId; },
      get amount() { return this.item?.amount; }, set amount(n) { this.item.amount = n; }, setItem(item) { this.item = item; } };
    p.slot = slot; p.inventory = []; p.messages = []; p.band = "friend";
    p.selectedSlotIndex = 0; p.getHeadLocation = () => ({ ...p.location, y: p.location.y + 1.6 });
    p.sendMessage = m => p.messages.push(m);
    p.getGameMode = () => creative ? "creative" : "survival";
    p.getComponent = k => k === "minecraft:health" ? p.health : k === "equippable" ? { getEquipmentSlot: () => slot } : k === "inventory" ? {
      container: { addItem(item) { if (fullInventory) return item; p.inventory.push(item); } } } : undefined;
    world.players.push(p); return p;
  }
  const advance = n => { for (let i = 0; i < n; i++) {
    tick++;
    for (const [id, task] of [...timers]) if (timers.has(id) && task.at <= tick) {
      if (task.repeat) task.at += task.delay; else timers.delete(id);
      task.fn();
    }
  } };
  const last = new Map();
  const bindings = { system, world, EquipmentSlot: { Mainhand: "mainhand" }, GameMode: { Survival: "survival", Adventure: "adventure", Creative: "creative", Spectator: "spectator" },
    EntityInitializationCause: { Loaded: "Loaded" }, ItemStack: TestItem,
    harmonyOf: p => ({ harmony: p.band }), bandOf: b => b, message: key => key,
    noteDeed: (...args) => deeds.push(args), repeatedUse(p, action) {
      const key = p.id + action, previous = last.get(key);
      if (previous !== undefined && tick - previous < 10) return true;
      last.set(key, tick); return false;
    } };
  return { world, system, dimension, entity, player, fire, advance, bindings, deeds, timers };
}

// Native contracts: healing only non-breeders; lures use requested grain/flowers;
// babies cannot breed or drop adult loot, and the grow event actually swaps groups.
for (const name of ["deer", "swan"]) assert.equal(entityJson(name).components["minecraft:healable"], undefined);
for (const name of ["songbird", "butterfly"]) {
  const e = entityJson(name), expected = name === "songbird" ? foods.GRAIN_ITEMS : foods.FLOWER_ITEMS;
  assert.deepEqual(e.components["minecraft:behavior.tempt"].items, expected);
  assert.deepEqual(e.components["minecraft:healable"].items.map(i => i.item), expected);
  assert.ok(e.components["minecraft:behavior.tempt"].can_tempt_vertically);
}
for (const name of ["squirrel", "butterfly"]) assert.ok(entityJson(name).components["minecraft:leashable"]);
const swan = entityJson("swan");
assert.deepEqual(swan.component_groups["lothlorien:adult"]["minecraft:breedable"].breed_items, foods.GRAIN_ITEMS);
const baby = swan.component_groups["lothlorien:baby"];
assert.ok(baby["minecraft:is_baby"]); assert.equal(baby["minecraft:loot"], undefined);
assert.equal(baby["minecraft:breedable"], undefined); assert.equal(baby["minecraft:ageable"].duration, 1200);
assert.deepEqual(swan.components["minecraft:offspring"].offspring_pairs, { "lothlorien:swan": "lothlorien:swan" });
for (const state of ["calm", "friend"]) {
  const group = swan.component_groups[`lothlorien:state_${state}`];
  assert.deepEqual(group["minecraft:behavior.tempt"].items, foods.GRAIN_ITEMS);
  assert.deepEqual(group["minecraft:behavior.avoid_mob_type"].entity_types[0].filters.all_of.at(-1).none_of.map(f => f.value), foods.GRAIN_ITEMS);
}
const natural = swan.events["lothlorien:spawn_natural"].sequence[1].randomize;
assert.equal(natural.find(r => r.trigger === "lothlorien:spawn_cygnet").weight, 10);
assert.deepEqual(swan.events["minecraft:ageable_grow_up"].remove.component_groups, ["lothlorien:baby"]);
assert.deepEqual(swan.events["minecraft:ageable_grow_up"].add.component_groups, ["lothlorien:adult"]);
assert.ok(entityJson("firefly").component_groups["lothlorien:released"]["minecraft:persistent"]);
assert.equal(entityJson("firefly").components["minecraft:healable"], undefined);

// Bottle inventories: survival single/stack/full inventory, creative, duplicate
// interaction, changed hands, blocked release, and a catch race between players.
for (const [amount, creative, full] of [[1,false,false], [3,false,false], [3,false,true], [1,true,false]]) {
  const h = engine(), bottles = await load("bottles", h.bindings);
  await load("fireflies", { ...h.bindings, ...bottles });
  const p = h.player(BOTTLE, amount, creative, full);
  const release = () => { const ev = { player:p, itemStack:{ typeId:BOTTLE }, block:{ dimension:h.dimension, location:{x:4,y:64,z:2} }, blockFace:"Up" };
    h.fire("before", "playerInteractWithBlock", ev); assert.equal(ev.cancel, true); };
  release(); release(); h.advance(1);
  assert.equal(h.dimension.spawned.length, 1); assert.equal(h.dimension.spawned[0].spawnEvent, "lothlorien:released");
  assert.deepEqual(h.dimension.spawned[0].location, {x:4.5,y:65.4,z:2.5});
  if (creative) { assert.equal(p.slot.typeId, BOTTLE); assert.equal(p.inventory[0].typeId, EMPTY); }
  else if (amount === 1) assert.equal(p.slot.typeId, EMPTY);
  else { assert.equal(p.slot.amount, amount-1); assert.equal((full?h.dimension.drops:p.inventory)[0].typeId, EMPTY); }
  assert.equal(h.deeds.length, 0, "releasing never grants a catch deed");
}
for (const blocked of [false,true]) {
  const h=engine(), bottles=await load("bottles",h.bindings); await load("fireflies",{...h.bindings,...bottles});
  const p=h.player(BOTTLE); h.dimension.blocked=blocked;
  h.fire("before","playerInteractWithBlock",{player:p,itemStack:{typeId:BOTTLE},block:{dimension:h.dimension,location:{x:0,y:64,z:0}},blockFace:"Up"});
  if (!blocked) p.slot.setItem({typeId:"minecraft:diamond",amount:1});
  h.advance(1); assert.equal(h.dimension.spawned.length,0); assert.equal(p.slot.amount,1);
}
{
  const h=engine(), bottles=await load("bottles",h.bindings); await load("fireflies",{...h.bindings,...bottles});
  const p=h.player(BOTTLE), read=h.dimension.getBlock.bind(h.dimension);
  const destination=read({x:0,y:65,z:0});
  h.fire("before","playerInteractWithBlock",{player:p,itemStack:{typeId:BOTTLE},block:{dimension:h.dimension,location:{x:0,y:64,z:0}},blockFace:"Up"});
  h.dimension.blocked=true;
  h.dimension.getBlock=at=>at.y===65?destination:read(at);
  h.advance(1);
  assert.equal(h.dimension.spawned.length,0,"changed clicked block rejects release even while destination remains air");
  assert.equal(p.slot.typeId,BOTTLE,"changed clicked block preserves the full bottle");
}
{
  const h=engine(), bottles=await load("bottles",h.bindings); await load("fireflies",{...h.bindings,...bottles});
  const bug=h.entity("lothlorien:firefly"), p=h.player(EMPTY), q=h.player(EMPTY);
  for(const player of [p,q]) h.fire("before","playerInteractWithEntity",{player,target:bug,itemStack:{typeId:EMPTY}});
  h.advance(1); assert.equal(bug.isValid,false); assert.equal(p.slot.typeId,BOTTLE); assert.equal(q.slot.typeId,EMPTY);
  assert.equal(h.deeds.length,1);
  const other=h.entity("lothlorien:firefly");h.advance(10);
  h.fire("before","playerInteractWithEntity",{player:q,target:other,itemStack:{typeId:EMPTY}});
  q.slot.setItem({typeId:"minecraft:diamond",amount:1});h.advance(1);assert.ok(other.isValid);
}

// Outside acorns heal and keep wildlife even for an unfriendly player, but they
// never create a beacon, grant a gift, or alter existing gift progress/cooldowns.
for (const name of ["white_deer","squirrel"]) {
  const h=engine(), food=await load("animal_food",{...h.bindings,...foods});
  let inside=false, unknown=false;
  const depth=()=>({level:inside?3:0,complete:!unknown});
  const bindings={...h.bindings,...food,...guideRules,...giftRules,...squirrelRules,
    consumeAcorn:p=>food.eatHeldFood(p,h.target,ACORN),addBeaconSource(){},stand(){},
    pickAway:()=>({x:12,y:64,z:0}), pickWaypoint:()=>({x:10,y:64,z:0}),hopStatus:()=>"go"};
  const mod=await load(name,bindings);
  if(name==="white_deer")mod.startWhiteDeer(depth,{});else mod.startSquirrels(depth);
  const target=h.entity(`lothlorien:${name}`), p=h.player(ACORN,5);h.target=target;p.band="hated";
  target.setDynamicProperty("lothlorien:gifted",true);target.setDynamicProperty("lothlorien:gift_ready_at",12000);
  const offer=()=>h.fire("after","playerInteractWithEntity",{player:p,target,itemStack:{typeId:ACORN}});
  offer();assert.equal(p.slot.amount,4);assert.equal(target.health.currentValue,5);
  assert.ok(target.events.includes(name==="white_deer"?"lothlorien:become_tame":"lothlorien:fed"));
  assert.equal(h.dimension.spawned.length,0);assert.equal(h.deeds.length,0);
  assert.equal(target.getDynamicProperty("lothlorien:gifted"),true);
  assert.equal(target.getDynamicProperty("lothlorien:gift_ready_at"),12000);
  h.advance(10);target.health.currentValue=7;offer();assert.equal(target.health.currentValue,8,"heal is capped");
  h.advance(10);unknown=true;offer();assert.equal(p.slot.amount,3,"unreadable biome does not permit outside food");
  h.advance(10);inside=true;unknown=false;offer();assert.equal(p.slot.amount,3,"inside still needs Friend");
}

// A lead cancels the squirrel errand and removes its beacon without a gift.
{
  const h=engine(), food=await load("animal_food",{...h.bindings,...foods});
  const mod=await load("squirrel",{...h.bindings,...food,...guideRules,...squirrelRules,
    consumeAcorn(){},addBeaconSource(){},stand(){},pickAway:()=>({x:12,y:64,z:0})});
  mod.startSquirrels(()=>({level:3}));const p=h.player(ACORN),s=h.entity(squirrelRules.SQUIRREL_ID,8,8);
  h.fire("after","playerInteractWithEntity",{player:p,target:s,itemStack:{typeId:ACORN}});
  assert.ok(mod.isErrand(s.id));const beacon=h.dimension.spawned[0];s.leashed=true;h.advance(10);
  assert.equal(mod.isErrand(s.id),false);assert.equal(beacon.isValid,false);
  assert.equal(s.getDynamicProperty("lothlorien:gift_ready_at"),undefined);
}

// Existing adult migration preserves babies, and natural river judging never
// removes a player-bred cygnet simply because the home is outside Lothlorien.
{
  const h=engine(), mod=await load("swan",{...h.bindings,...swanRules});
  mod.startSwans({id:"lothlorien:lothlorien",at:()=>"minecraft:plains"});
  const adult=h.entity(swanRules.SWAN_ID),cygnet=h.entity(swanRules.SWAN_ID);cygnet.baby=true;
  adult.setProperty("lothlorien:adult_ready", true); // retired guard from the temporary-test build
  for(const entity of [adult,cygnet])h.fire("after","entityLoad",{entity});
  assert.ok(adult.events.includes("minecraft:ageable_grow_up"));assert.equal(cygnet.events.length,0);
  assert.equal(adult.getProperty("lothlorien:adult_initialized"), true);
  const migratedEvents = adult.events.length;
  h.fire("after","entityLoad",{entity:adult});
  assert.equal(adult.events.length, migratedEvents, "reloading an adult must not restart its feather timer");
  h.fire("after","entitySpawn",{entity:cygnet,cause:"Born"});h.advance(1);assert.ok(cygnet.isValid);
  const wild=h.entity(swanRules.SWAN_ID);wild.setProperty("lothlorien:natural",true);
  h.fire("after","entitySpawn",{entity:wild,cause:"Spawned"});h.advance(1);assert.equal(wild.isValid,false);
}

// Bonded owner interactions go through native healable/rideable unchanged.
// These callbacks do not emulate native healing or prove mount precedence.
{
  const h=engine(), food=await load("animal_food",{...h.bindings,...foods});
  const mod=await load("unicorn",{...h.bindings,...food,...unicornRules,setEventFor:s=>`lothlorien:set_${s}`});mod.startUnicorns();
  const p=h.player(unicornRules.ELANOR_ID,2),q=h.player(unicornRules.ELANOR_ID),u=h.entity(unicornRules.UNICORN_ID);
  u.setProperty("lothlorien:tame",true);u.setDynamicProperty("lothlorien:owner",p.id);
  for(const health of [3,8]) {
    u.health.currentValue=health;
    const ev={player:p,target:u,itemStack:{typeId:unicornRules.ELANOR_ID}};
    h.fire("before","playerInteractWithEntity",ev);assert.notEqual(ev.cancel,true);
    assert.equal(h.timers.size,0,"owner healing adds no deferred script whose later context could revoke it");
    h.fire("after","playerInteractWithEntity",ev);h.advance(1);
    assert.equal(u.health.currentValue,health,"native owns bonded healing; no duplicate scripted heal");
    assert.equal(p.slot.amount,2,"native owns bonded food consumption; no duplicate script charge");
  }
  const stranger={player:q,target:u,itemStack:{typeId:unicornRules.ELANOR_ID}};
  h.fire("before","playerInteractWithEntity",stranger);h.advance(1);assert.equal(stranger.cancel,true);
  assert.equal(u.health.currentValue,8);assert.equal(q.slot.amount,1);
  for (const [player,denied] of [[p,false],[q,true]]) {
    const naming={player,target:u,itemStack:{typeId:"minecraft:name_tag"}};
    h.fire("before","playerInteractWithEntity",naming);assert.equal(naming.cancel===true,denied,"bonded naming remains owner-only");
  }
}
// Wild trust offerings still consume/heal synchronously, with native healable
// absent until the actual bond. This tests script integration, not native feeding.
for(const creative of [false,true]) {
  const h=engine(), food=await load("animal_food",{...h.bindings,...foods});
  const mod=await load("unicorn",{...h.bindings,...food,...unicornRules,setEventFor:s=>`lothlorien:set_${s}`});mod.startUnicorns();
  const p=h.player(unicornRules.ELANOR_ID,3,creative),u=h.entity(unicornRules.UNICORN_ID,20,30);
  u.setProperty("lothlorien:trust",0); // native description-property default
  for(let offer=1;offer<=3;offer++) {
    h.fire("after","playerInteractWithEntity",{player:p,target:u,itemStack:{typeId:unicornRules.ELANOR_ID}});
    assert.equal(u.health.currentValue,20+2*offer);assert.equal(u.getProperty("lothlorien:trust"),offer);
    assert.equal(p.slot.amount,creative?3:offer<3?3-offer:undefined);
    h.advance(unicornRules.OFFER_GAP_TICKS);
  }
  assert.equal(u.getDynamicProperty("lothlorien:owner"),p.id);assert.ok(u.events.includes("lothlorien:become_tame"));
}
console.log("ok   animal home: bottles, outside care/gifts, leads, swan migration, native unicorn healing handoff and trust consumption");
