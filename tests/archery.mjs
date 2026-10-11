// Production event glue with a fake camera/scheduler. Native shooting and rendering need Minecraft.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rules from "../lothlorien_bp/scripts/gift_rules.js";

const source = readFileSync(new URL("../lothlorien_bp/scripts/archery.js", import.meta.url), "utf8")
  .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__archery;");
let serial = 0;
async function scenario(name, body) {
  const handlers = new Map(), timers = new Map(), players = [], drops = [];
  let tick = 0, next = 0;
  const system = { get currentTick() { return tick; },
    runInterval(fn, ticks) { const id = ++next; timers.set(id, { fn, ticks, at: tick + ticks }); return id; },
    clearRun: id => timers.delete(id) };
  const world = { getPlayers: () => players, afterEvents: new Proxy({}, { get: (_, name) => ({
    subscribe(fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); }
  }) }) };
  const dimension = { id: "overworld", spawnItem: (item, location) => drops.push({ item, location }) };
  globalThis.__archery = { ...rules, system, world,
    ItemStack: class { constructor(typeId, amount) { Object.assign(this, { typeId, amount }); } } };
  const { startArchery } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${++serial}`);
  delete globalThis.__archery;
  const fire = (name, event) => { for (const fn of handlers.get(name) || []) fn(event); };
  const advance = n => { for (let i = 0; i < n; i++) {
    tick++;
    for (const [id, t] of [...timers]) if (timers.has(id) && t.at <= tick) { t.at += t.ticks; t.fn(); }
  } };
  function player() {
    const props = new Map(), cameraCalls = [], hand = { typeId: rules.BOW_ID }, hp = { currentValue: 20 };
    const p = { id: `p${++next}`, typeId: "minecraft:player", isValid: true, dimension,
      selectedSlotIndex: 0, hand, hp, cameraCalls,
      getDynamicProperty: key => props.get(key),
      setDynamicProperty(key, value) { if (value === undefined) props.delete(key); else props.set(key, value); },
      camera: { setFov(options) { if (p.cameraBroken) throw Error("camera unavailable"); cameraCalls.push(options); } },
      getComponent(key) { return key === "minecraft:health" ? hp : key === "minecraft:equippable" ? {
        getEquipmentSlot(slot) { assert.equal(slot, "Mainhand"); return hand; }
      } : undefined; } };
    players.push(p); return p;
  }
  const begin = p => fire("itemStartUse", { source: p, itemStack: { typeId: rules.BOW_ID } });
  await body({ startArchery, fire, advance, player, begin, timers, drops, dimension, handlers });
  console.log(`ok   archery: ${name}`);
}

await scenario("only bow draws zoom; release/stop restore defaults; no idle timer", async e => {
  const p = e.player(); e.startArchery(); e.startArchery();
  assert.equal(e.handlers.get("itemStartUse").length, 1);
  assert.equal(e.timers.size, 0);
  e.fire("itemStartUse", { source: p, itemStack: { typeId: "minecraft:bow" } });
  assert.equal(p.cameraCalls.length, 0);
  e.begin(p); e.begin(p);
  assert.equal(e.timers.size, 1); assert.equal(p.cameraCalls.length, 1);
  assert.deepEqual(p.cameraCalls[0], { fov: rules.BOW.zoomFov,
    easeOptions: { easeTime: rules.BOW.zoomEaseSeconds, easeType: "linear" } });
  e.advance(rules.BOW.watchTicks); assert.equal(p.cameraCalls.length, 1);
  e.fire("itemReleaseUse", { source: p }); assert.equal(p.cameraCalls.at(-1), undefined);
  assert.equal(e.timers.size, 0);
  e.begin(p); e.fire("itemStopUse", { source: p });
  assert.equal(p.cameraCalls.at(-1), undefined); assert.equal(e.timers.size, 0);
  const count = p.cameraCalls.length; e.fire("itemStopUse", { source: p });
  assert.equal(p.cameraCalls.length, count, "unowned FOV is never cleared");
});

await scenario("separate players share one timer; slot, hand, death, dimension and leave clean up", async e => {
  e.startArchery(); const a = e.player(), b = e.player(); e.begin(a); e.begin(b);
  a.selectedSlotIndex = 1; e.advance(rules.BOW.watchTicks);
  assert.equal(a.cameraCalls.at(-1), undefined); assert.equal(e.timers.size, 1);
  b.hand.typeId = "minecraft:stick"; e.advance(rules.BOW.watchTicks); assert.equal(e.timers.size, 0);
  a.selectedSlotIndex = 0; e.begin(a); a.hp.currentValue = 0;
  e.advance(rules.BOW.watchTicks); assert.equal(e.timers.size, 0);
  a.hp.currentValue = 20; e.begin(a); a.dimension = { id: "nether" };
  e.advance(rules.BOW.watchTicks); assert.equal(e.timers.size, 0);
  e.begin(a); e.fire("playerDimensionChange", { player: a }); assert.equal(e.timers.size, 0);
  e.begin(a); e.fire("entityDie", { deadEntity: a }); assert.equal(e.timers.size, 0);
  e.begin(a); e.fire("playerLeave", { playerId: a.id }); assert.equal(e.timers.size, 0);
  e.fire("playerSpawn", { player: a }); assert.equal(a.cameraCalls.at(-1), undefined);
});

await scenario("reload marker is cleared; unavailable camera is retried on spawn", async e => {
  const p = e.player(); p.setDynamicProperty("lothlorien:bow_zoom", true);
  e.startArchery(); assert.deepEqual(p.cameraCalls, [undefined]);
  p.cameraBroken = true; e.begin(p); assert.equal(e.timers.size, 0);
  assert.equal(p.getDynamicProperty("lothlorien:bow_zoom"), true);
  p.cameraBroken = false; e.fire("playerSpawn", { player: p });
  assert.equal(p.getDynamicProperty("lothlorien:bow_zoom"), undefined);
  e.begin(p); p.isValid = false; e.advance(rules.BOW.watchTicks); assert.equal(e.timers.size, 0);
});

await scenario("a missing native stop event cannot hold zoom past the item use duration", async e => {
  e.startArchery(); const p = e.player(); e.begin(p);
  e.advance(rules.BOW.useSeconds * 20);
  assert.equal(p.cameraCalls.at(-1), undefined); assert.equal(e.timers.size, 0);
});

await scenario("entity hits recover exactly one custom arrow at hit position, without stale entity reads", async e => {
  e.startArchery();
  const location = { x: 4.25, y: 70.4, z: -9.1 };
  const projectile = { id: "shot1", typeId: rules.ARROW_ID, isValid: false,
    get location() { throw Error("stale location"); }, getComponent() { throw Error("stale component"); } };
  const hit = { projectile, dimension: e.dimension, location };
  e.fire("projectileHitEntity", hit); e.fire("projectileHitEntity", hit);
  assert.equal(e.drops.length, 1); assert.deepEqual(e.drops[0].location, location);
  assert.equal(e.drops[0].item.typeId, rules.ARROW_ID); assert.equal(e.drops[0].item.amount, 1);
  e.fire("projectileHitEntity", { ...hit, projectile: { id: "vanilla", typeId: "minecraft:arrow", isValid: false } });
  e.fire("projectileHitEntity", { ...hit, projectile: { id: "bounce", typeId: rules.ARROW_ID, isValid: true } });
  e.fire("projectileHitBlock", hit);
  assert.equal(e.drops.length, 1, "vanilla arrows, bouncing arrows and ground pickup remain native");
  assert.equal(e.timers.size, 0, "recovery never creates a polling loop");
});

const json = (pack, file) => JSON.parse(readFileSync(new URL(`../${pack}/${file}`, import.meta.url)));
const bow = json("lothlorien_bp", "items/bow.json")["minecraft:item"];
assert.equal(bow.description.identifier, rules.BOW_ID);
assert.equal(bow.components["minecraft:shooter"].max_draw_duration, rules.BOW.drawSeconds);
assert.equal(bow.components["minecraft:durability"].max_durability, rules.BOW.durability);
assert.deepEqual(bow.components["minecraft:shooter"].ammunition.map(x => x.item), [rules.ARROW_ID, "minecraft:arrow"]);
assert.equal(bow.components["minecraft:enchantable"].slot, "bow");
const arrow = json("lothlorien_bp", "entities/galadhrim_arrow.json")["minecraft:entity"];
const vanilla = JSON.parse(readFileSync(new URL("../../../reference/vanilla/current/behavior_packs/vanilla_1.26.50/entities/arrow.json", import.meta.url)))["minecraft:entity"];
assert.deepEqual(arrow.components, vanilla.components, "same native flight and damage");
for (const [name, group] of Object.entries(arrow.component_groups)) assert.deepEqual(group, vanilla.component_groups[name]);
assert.deepEqual(arrow.events["minecraft:entity_spawned"].first_valid,
  vanilla.events["minecraft:entity_spawned"].first_valid.filter(e => !e.add.component_groups[0].includes("crossbow")));
const attachable = json("lothlorien_rp", "attachables/bow.json")["minecraft:attachable"].description;
assert.equal(attachable.identifier, rules.BOW_ID);
assert.ok(attachable.scripts.pre_animation[0].includes(`/ ${rules.BOW.drawSeconds * 20}.0,`));
assert.equal(Object.keys(attachable.geometry).length, 4);
assert.equal(new Set(Object.values(attachable.geometry)).size, 4);
console.log("ok   archery: native projectile parity, balance and four pull frame bindings");
