// Production wariness and white-deer callbacks; native navigation remains in-game acceptance.
import assert from "node:assert/strict";
import * as deerRules from "../lothlorien_bp/scripts/deer_rules.js";
import * as rules from "../lothlorien_bp/scripts/white_deer_rules.js";
import * as giftRules from "../lothlorien_bp/scripts/great_mallorn_rules.js";
import * as wardenRules from "../lothlorien_bp/scripts/elven_warden_rules.js";
import { estimateDepth } from "../lothlorien_bp/scripts/depth.js";
import { setup, load, Item } from "./fixtures/wildlife_runtime.mjs";
let scenarios = 0;
async function test(name, body) { await body(); scenarios++; console.log(`ok   deer interactions: ${name}`); }

await test("all five wary species ignore Creative/Spectator/dead/unreadable players", async () => {
  const h = await setup(); const mod = await load("deer", h.base); mod.startDeer();
  const friend = h.player;
  for (const mode of ["creative", "spectator", "dead", "unreadable"]) {
    const hostile = h.entity("minecraft:player"); hostile.band = "hated";
    if (mode === "dead") hostile.health.currentValue = 0;
    else if (mode === "unreadable") Object.defineProperty(hostile, "dimension", { get() { throw Error("unreadable"); } });
    else hostile.mode = mode;
    h.world.players.push(hostile);
  }
  const animals = deerRules.WARY_TYPES.map(type => h.entity(type));
  for (const animal of animals) h.fire("entityLoad", { entity: animal });
  h.advance(40); for (const animal of animals) assert.ok(animal.events.includes("lothlorien:set_friend"));
  friend.mode = "adventure"; friend.band = "hated"; h.advance(40);
  for (const animal of animals) assert.ok(animal.events.includes("lothlorien:set_l3"));
});
await test("a valid unreadable animal recovers; removed actors stop the 40-tick service", async () => {
  const h = await setup(); const mod = await load("deer", h.base); mod.startDeer();
  let fail = true; const read = h.deer.getProperty;
  h.deer.getProperty = k => { if (fail) throw Error("temporary"); return read(k); };
  h.advance(40); assert.equal(h.deer.events.length, 0);
  fail = false; h.advance(40); assert.ok(h.deer.events.includes("lothlorien:set_friend"));
  for (const actor of [h.deer]) h.fire("entityRemove", { removedEntityId: actor.id });
  assert.equal([...h.timers.values()].filter(t => t.period === 40).length, 0);
});
await test("gift particles cannot duplicate delivery and a gifted deer cannot repeat it", async () => {
  const h = await setup(); h.dimension.particleError = true; const s = { spot: { x: 40, y: 65, z: 0 } };
  assert.equal(h.mod.giveGift(h.deer, s), true); assert.equal(h.mod.giveGift(h.deer, s), false);
  assert.equal(h.dimension.drops.length, 1); assert.equal(h.deer.getDynamicProperty("lothlorien:gifted"), true);
});
await test("known successful spawn is guarded even if persisting completion throws", async () => {
  const h = await setup(); h.deer.setDynamicProperty = () => { throw Error("property"); };
  const s = { spot: { x: 40, y: 65, z: 0 } };
  assert.throws(() => h.mod.giveGift(h.deer, s)); assert.equal(h.mod.giveGift(h.deer, s), false);
  assert.equal(h.dimension.drops.length, 1);
});
await test("a thrown item spawn has no speculative fallback or permanent claim", async () => {
  const h = await setup(); h.dimension.spawnError = true;
  assert.throws(() => h.mod.giveGift(h.deer, { spot: { x: 40, y: 65, z: 0 } }));
  assert.equal(h.dimension.drops.length, 0); assert.equal(h.deer.getDynamicProperty("lothlorien:gifted"), undefined);
});
await test("grass blocks are ground, passable plants are skipped, both body cells must be clear", async () => {
  const h = await setup(); assert.equal(h.mod.groundFeet(h.dimension, 0, 0), 65);
  h.dimension.top = 65; h.dimension.blocked.set("0,65,0", "minecraft:short_grass");
  assert.equal(h.mod.groundFeet(h.dimension, 0, 0), 65);
  h.dimension.waterlogged = "0,65,0"; assert.equal(h.mod.groundFeet(h.dimension, 0, 0), undefined);
  h.dimension.waterlogged = undefined;
  h.dimension.blocked.set("0,66,0", "minecraft:stone"); assert.equal(h.mod.groundFeet(h.dimension, 0, 0), undefined);
  h.dimension.blocked.set("0,66,0", "minecraft:air"); h.dimension.blocked.set("0,65,0", "minecraft:water");
  assert.equal(h.mod.groundFeet(h.dimension, 0, 0), undefined);
});
await test("a newly obstructed or foreign-biome gift spot is never used", async () => {
  const h = await setup(), s = { spot: { x: 40, y: 65, z: 0 } };
  h.dimension.blocked.set("40,65,0", "minecraft:stone"); assert.equal(h.mod.giveGift(h.deer, s), false);
  h.dimension.blocked.clear(); h.biome.at = () => "plains"; assert.equal(h.mod.giveGift(h.deer, s), false);
  assert.equal(h.dimension.drops.length, 0); assert.equal(h.deer.getDynamicProperty("lothlorien:gifted"), undefined);
});
const changes = {
  hand: h => h.player.slot.item = new Item("minecraft:diamond"),
  metadata: h => h.player.slot.item.nameTag = "changed", count: h => h.player.slot.item.amount++,
  slot: h => h.player.selectedSlotIndex++, mode: h => h.player.mode = "creative",
  playerDimension: h => h.player.dimension = { id: "nether" }, deerDimension: h => h.deer.dimension = { id: "nether" },
  range: h => h.player.location.x = 20, trust: h => h.player.band = "guest", leash: h => h.deer.leashed = true,
  alarm: h => h.deer.setProperty("lothlorien:alarmed", true), gift: h => h.deer.setDynamicProperty("lothlorien:gifted", true),
  savedSpot: h => h.deer.setDynamicProperty("lothlorien:gift_spot", "changed"),
  incomplete: h => h.depth = { level: 0, complete: false }, outside: h => h.depth = { level: 0, complete: true },
  dead: h => h.player.health.currentValue = 0,
  deadDeer: h => h.deer.health.currentValue = 0,
};
for (const [name, mutate] of Object.entries(changes)) await test(`yielded offer rejects changed ${name}`, async () => {
  const h = await setup(); h.offer(); assert.equal(h.jobs.length, 1); mutate(h); h.flush();
  assert.equal(h.mod.isGuiding(h.deer.id), false); assert.equal(h.deer.getDynamicProperty("lothlorien:gift_spot"), name === "savedSpot" ? "changed" : undefined);
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
