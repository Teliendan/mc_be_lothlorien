// Production alarm, taming and white-deer callbacks; native navigation remains in-game acceptance.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import * as deerRules from "../lothlorien_bp/scripts/deer_rules.js";
import * as rules from "../lothlorien_bp/scripts/white_deer_rules.js";
import * as giftRules from "../lothlorien_bp/scripts/great_mallorn_rules.js";
import * as wardenRules from "../lothlorien_bp/scripts/elven_warden_rules.js";
import { estimateDepth } from "../lothlorien_bp/scripts/depth.js";
import { setup, load, Item } from "./fixtures/wildlife_runtime.mjs";
let scenarios = 0;
async function test(name, body) { await body(); scenarios++; console.log(`ok   deer interactions: ${name}`); }

await test("no script polls wildlife: no interval, no per-entity subscription, no events from players' bands", async () => {
  const h = await setup(); const mod = await load("deer", h.base); mod.startDeer();
  const animals = deerRules.WARY_TYPES.map(type => h.entity(type));
  for (const animal of animals) { h.fire("entitySpawn", { entity: animal }); h.fire("entityLoad", { entity: animal }); }
  h.player.band = "hated"; h.advance(400);
  assert.equal([...h.timers.values()].filter(t => t.period).length, 0, "no recurring timer");
  for (const animal of animals) assert.deepEqual(animal.events, [], `${animal.typeId} receives no event from the script`);
});
await test("a hurt animal alarms every wary animal within 20 blocks, once, and nothing else", async () => {
  const h = await setup(); const mod = await load("deer", h.base); mod.startDeer();
  const at = x => ({ x, y: 65, z: 0 });
  const hurt = h.entity(deerRules.DEER_ID, at(0));
  const near = deerRules.WARY_TYPES.map((type, i) => h.entity(type, at(5 + i * 3)));
  const far = h.entity(deerRules.SWAN_ID, at(21)), cow = h.entity("minecraft:cow", at(3));
  const events = e => e.events.filter(name => name === "lothlorien:alarm").length;
  h.fire("entityHurt", { hurtEntity: hurt, damageSource: { damagingEntity: h.player } });
  for (const animal of [hurt, ...near]) assert.equal(events(animal), 1, animal.typeId);
  assert.equal(events(far), 0, "21 blocks is outside"); assert.equal(events(cow), 0, "a cow is not a wary animal");
  const querying = h.dimension.getEntities; let queries = 0;
  h.dimension.getEntities = function (...args) { queries++; return querying.apply(this, args); };
  h.fire("entityHurt", { hurtEntity: hurt, damageSource: { damagingEntity: h.entity("minecraft:cow") } });
  assert.equal(queries, 0, "only a player's blow alarms");
  h.fire("entityDie", { deadEntity: hurt, damageSource: { damagingEntity: h.player } });
  assert.equal(queries, 1, "one query per alarm");
});
await test("feeding corn tames a deer with one event and no re-applied state; a second feeding does nothing", async () => {
  const h = await setup(); const mod = await load("deer", h.base); mod.startDeer();
  const deer = h.entity(deerRules.DEER_ID);
  h.fire("playerInteractWithEntity", { player: h.player, target: deer, itemStack: new Item(deerRules.CORN_ID) });
  h.advance(5); assert.deepEqual(deer.events, ["lothlorien:become_tame"]);
  deer.setProperty("lothlorien:tame", true);
  h.fire("playerInteractWithEntity", { player: h.player, target: deer, itemStack: new Item(deerRules.CORN_ID) });
  assert.equal(deer.events.length, 1);
});
await test("the gift is laid once, whatever the particles do", async () => {
  const h = await setup(); h.dimension.particleError = true;
  assert.equal(h.mod.giveGift(h.deer, { spot: { x: 40, y: 65, z: 0 } }), true);
  assert.equal(h.dimension.drops.length, 1); assert.equal(h.deer.getDynamicProperty("lothlorien:gifted"), true);
});
await test("grass blocks are ground, passable plants are skipped, both body cells must be clear", async () => {
  const h = await setup(); assert.equal(h.mod.groundFeet(h.dimension, 0, 0), 65);
  h.dimension.top = 65; h.dimension.blocked.set("0,65,0", "minecraft:short_grass");
  assert.equal(h.mod.groundFeet(h.dimension, 0, 0), 65);
  h.dimension.waterlogged = "0,65,0"; assert.equal(h.mod.groundFeet(h.dimension, 0, 0), undefined);
  h.dimension.waterlogged = undefined;
  h.dimension.top = 66; h.dimension.blocked.set("0,66,0", "lothlorien:mallorn_leaves"); // a crown at head height: looked through, no headroom
  assert.equal(h.mod.groundFeet(h.dimension, 0, 0), undefined);
  h.dimension.top = 65; h.dimension.blocked.set("0,66,0", "minecraft:air"); h.dimension.blocked.set("0,65,0", "minecraft:water");
  assert.equal(h.mod.groundFeet(h.dimension, 0, 0), undefined);
});
await test("K36: a Friend's acorn in the forest finds a gift spot on plain ground (stable Block API only, no beta isSolid)", async () => {
  const h = await setup(), said = []; h.player.sendMessage = (text) => said.push(text);
  h.offer(); h.flush();
  assert.deepEqual(said, ["deer.accept"], "not deer.no_spot (\"nowhere to lead you\")");
  assert.equal(h.mod.isGuiding(h.deer.id), true);
  const scripts = new URL("../lothlorien_bp/scripts/", import.meta.url);
  for (const name of readdirSync(scripts).filter((n) => n.endsWith(".js")))
    assert.doesNotMatch(readFileSync(new URL(name, scripts), "utf8"), /\.isSolid\b/, `${name}: Block.isSolid is beta-only (not in @minecraft/server 2.8.0)`);
});
await test("a newly obstructed or foreign-biome gift spot is never used and is forgotten", async () => {
  const h = await setup(), s = { spot: { x: 40, y: 65, z: 0 } };
  for (const spoil of [() => h.dimension.blocked.set("40,65,0", "minecraft:stone"), () => h.biome.at = () => "plains"]) {
    h.deer.setDynamicProperty("lothlorien:gift_spot", "kept"); spoil();
    assert.equal(h.mod.giveGift(h.deer, s), false); assert.equal(h.deer.getDynamicProperty("lothlorien:gift_spot"), undefined);
    h.dimension.blocked.clear(); h.biome.at = () => "lothlorien";
  }
  assert.equal(h.dimension.drops.length, 0); assert.equal(h.deer.getDynamicProperty("lothlorien:gifted"), undefined);
});
await test("R6: a gift spot found on a thin leaf carpet that rays stop at is laid on arrival", async () => {
  const h = await setup(); h.dimension.shapes = new Map([["lothlorien:mallorn_leaf_carpet", 1 / 16]]);
  h.dimension.blocked.set("40,65,0", "lothlorien:mallorn_leaf_carpet"); h.dimension.top = 65;
  const y = h.mod.groundFeet(h.dimension, 40, 0); assert.equal(y, 66, "the search finds the carpet as ground");
  assert.equal(h.mod.giveGift(h.deer, { spot: { x: 40, y, z: 0 } }), true);
  assert.equal(h.dimension.drops.length, 1);
});
await test("a kept gift spot that is no longer clear is dropped and a new one is searched", async () => {
  const h = await setup();
  h.deer.setDynamicProperty("lothlorien:gift_spot", JSON.stringify({ x: 40, y: 65, z: 0, dim: "overworld" }));
  h.dimension.blocked.set("40,65,0", "minecraft:stone");
  h.offer(); assert.equal(h.jobs.length, 1); assert.equal(h.deer.getDynamicProperty("lothlorien:gift_spot"), undefined);
  h.flush(); assert.equal(h.mod.isGuiding(h.deer.id), true); assert.ok(h.deer.getDynamicProperty("lothlorien:gift_spot"));
});
const changes = {
  hand: h => h.player.slot.item = new Item("minecraft:diamond"),
  slot: h => h.player.selectedSlotIndex++,
  deadDeer: h => h.deer.health.currentValue = 0,
};
for (const [name, mutate] of Object.entries(changes)) await test(`yielded offer rejects changed ${name}`, async () => {
  const h = await setup(); h.offer(); assert.equal(h.jobs.length, 1); mutate(h); h.flush();
  assert.equal(h.mod.isGuiding(h.deer.id), false); assert.equal(h.deer.getDynamicProperty("lothlorien:gift_spot"), undefined);
  assert.equal(h.dimension.drops.length, 0); assert.ok(!h.deer.events.includes("lothlorien:become_tame"));
});
await test("unchanged Survival and Creative Friend offers start with their own consumption rules", async () => {
  for (const creative of [false, true]) {
    const h = await setup(); if (creative) h.player.mode = "creative";
    h.offer(); h.flush(); assert.equal(h.mod.isGuiding(h.deer.id), true);
    assert.equal(h.player.slot.amount, creative ? 3 : 2); assert.ok(h.deer.events.includes("lothlorien:guide_start"));
  }
});
await test("positive partial depth remains known inside and permits guidance", async () => {
  const h = await setup(); h.depth = { level: 1, complete: false };
  h.offer(); h.flush(); assert.equal(h.mod.isGuiding(h.deer.id), true);
});
for (const [name, mutate] of Object.entries({ dead: h => h.player.health.currentValue = 0,
  deadDeer: h => h.deer.health.currentValue = 0,
  spectator: h => h.player.mode = "spectator", trust: h => h.player.band = "guest",
  dimensions: h => { const d = { ...h.dimension, id: "nether" }; h.player.dimension = d; h.deer.dimension = d; } })) {
  await test(`active session ends for ${name} even at the gift target`, async () => {
    const h = await setup(); h.offer(); h.flush(); const s = h.mod.sessions.get(h.deer.id);
    h.deer.location = { x: s.target.x, y: 65, z: s.target.z }; mutate(h); h.mod.tickSessions();
    assert.equal(h.mod.isGuiding(h.deer.id), false); assert.equal(h.dimension.drops.length, 0);
  });
}
await test("natural white deer uses optimistic partial heart with its unchanged rarity table", async () => {
  const h = await setup();
  assert.deepEqual(rules.SPAWN_KEEP_BY_DEPTH, [0, .15, .5, 1]);
  const heart = estimateDepth((x, z) => x === 0 && z === 0 ? "lothlorien" : undefined, "lothlorien", new Set());
  assert.equal(heart.level, 3); assert.equal(heart.complete, false);
  h.deer.setProperty("lothlorien:natural", true);
  const random = Math.random; Math.random = () => .99;
  try { h.mod.judgeNaturalSpawn(h.deer, () => heart); } finally { Math.random = random; }
  assert.equal(h.deer.isValid, true); assert.equal(h.deer.getProperty("lothlorien:natural"), false);
  const egg = h.entity(rules.WHITE_DEER_ID);
  let eggSamples = 0;
  h.mod.judgeNaturalSpawn(egg, () => { eggSamples++; return heart; });
  assert.equal(egg.isValid, true); assert.equal(eggSamples, 0);
});
await test("natural warden consumes the same partial-heart estimate without changing its chances", async () => {
  const h = await setup(), mod = await load("elven_warden", { ...h.base, ...wardenRules }, "\nexport { judgeNaturalSpawn };\n");
  assert.equal(wardenRules.spawnKeepChance(1, false), 1);
  assert.equal(wardenRules.spawnKeepChance(3, false), .3);
  const warden = h.entity(wardenRules.WARDEN_ID); warden.setProperty("lothlorien:natural", true);
  const partial = estimateDepth((x, z) => x === 0 && z === 0 ? "lothlorien" : undefined, "lothlorien", new Set());
  const random = Math.random; Math.random = () => .9;
  try { mod.judgeNaturalSpawn(warden, () => partial); } finally { Math.random = random; }
  assert.equal(warden.isValid, false); assert.equal(warden.getProperty("lothlorien:natural"), false);
});
console.log(`Passed ${scenarios} production deer interaction scenarios.`);
