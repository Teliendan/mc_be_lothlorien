// Production callbacks with real shared hand/food helpers; native navigation needs the game.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setup, load, Item } from "./fixtures/wildlife_runtime.mjs";
import * as Q from "../lothlorien_bp/scripts/squirrel_rules.js";
import * as W from "../lothlorien_bp/scripts/white_deer_rules.js";
import * as S from "../lothlorien_bp/scripts/swan_rules.js";
let scenarios = 0;
async function test(name, body) { await body(); scenarios++; console.log(`ok   swan/squirrel interactions: ${name}`); }
async function squirrel() {
  const h = await setup(); h.world.getAbsoluteTime = () => h.system.currentTick;
  h.s = h.entity(Q.SQUIRREL_ID); h.s.health.currentValue = h.s.health.effectiveMax = 4;
  h.messages = []; h.player.sendMessage = text => h.messages.push(text); h.deeds = 0; h.rolls = 0;
  h.loot = [new Item("lothlorien:mallorn_leaf_carpet", 3)];
  h.manager = { getLootTable(path) { assert.equal(path, Q.GIFT_TABLE); return h.table; },
    generateLootFromTable(table) { assert.equal(table, h.table); h.rolls++; return h.loot; } };
  h.table = {}; h.world.getLootTableManager = () => h.manager;
  h.q = await load("squirrel", { ...h.base, ...Q,
    addBeaconSource: h.mod.addBeaconSource, stand: h.mod.stand,
    pickAway: (...args) => h.pickAway(...args), noteDeed: () => { h.deeds++; if (h.deedError) throw Error("deed"); } },
    "\nexport { giveGift, sessions, tickSessions };\n");
  h.pickAway = () => ({ x: 12, y: 65, z: 0 });
  h.q.startSquirrels(() => h.depth);
  h.click = (item = h.player.slot.item?.clone()) => h.fire("playerInteractWithEntity", { player: h.player, target: h.s, itemStack: item });
  h.returning = () => { const session = h.q.sessions.get(h.s.id); assert.ok(session); session.phase = "return"; return session; };
  return h;
}

await test("owner keeps exact four-entry gift table and native hazard/lead policies", async () => {
  const json = name => JSON.parse(readFileSync(new URL(`../lothlorien_bp/${name}`, import.meta.url)));
  const entries = json("loot_tables/gifts/squirrel.json").pools[0]; assert.equal(entries.rolls, 1);
  assert.deepEqual(entries.entries.map(e => [e.name, e.weight, e.functions[0].count]), [
    ["lothlorien:mallorn_leaf_carpet", 28, { min: 2, max: 4 }], ["lothlorien:mallorn_blossom", 28, { min: 2, max: 4 }],
    ["lothlorien:western_corn_seeds", 14, { min: 1, max: 3 }], ["lothlorien:athelas", 8, { min: 1, max: 2 }],
  ]);
  const q = json("entities/squirrel.json")["minecraft:entity"].components;
  assert.deepEqual(q["minecraft:can_stand_on_powder_snow"], {}); assert.deepEqual(q["minecraft:leashable_to"], {});
  assert.equal(q["minecraft:freezing_immune"], undefined);
  const s = json("entities/swan.json")["minecraft:entity"].components;
  assert.deepEqual(s["minecraft:damage_sensor"], { triggers: { cause: "fall", deals_damage: "no" } });
  assert.equal(s["minecraft:breathable"].breathes_air, true); assert.equal(s["minecraft:breathable"].breathes_water, true);
});
await test("swans need an actually readable nearby Lothlorien sample, once only", async () => {
  for (const forest of [false, true]) {
    const h = await setup(), m = await load("swan", { ...h.base, ...S }, "\nexport { judgeNaturalSpawn };\n");
    const swan = h.entity(S.SWAN_ID); swan.setProperty("lothlorien:natural", true); let probes = 0;
    const biome = { id: "lothlorien", at() { probes++; return forest && probes === 25 ? "lothlorien" : undefined; } };
    m.judgeNaturalSpawn(swan, biome);
    assert.equal(swan.isValid, forest); assert.equal(probes, 25); assert.equal(swan.getProperty("lothlorien:natural"), false);
    m.judgeNaturalSpawn(swan, biome); assert.equal(probes, 25);
  }
});
await test("swan eggs/summons and born cygnets are not filtered without the natural flag", async () => {
  const h = await setup(), m = await load("swan", { ...h.base, ...S }); let probes = 0;
  m.startSwans({ id: "lothlorien", at: () => { probes++; return undefined; } });
  for (const cause of ["Spawned", "Born"]) { const swan = h.entity(S.SWAN_ID); h.fire("entitySpawn", { entity: swan, cause }); h.advance(1); assert.equal(swan.isValid, true); }
  assert.equal(probes, 0);
});
const changes = {
  hand: h => h.player.slot.item = new Item("minecraft:diamond"),
  spectator: h => h.player.mode = "spectator", dead: h => h.player.health.currentValue = 0,
  deadAnimal: h => h.s.health.currentValue = 0, dimension: h => h.player.dimension = { id: "nether" },
  actorDimension: h => h.s.dimension = { id: "nether" }, range: h => h.player.location.x = 20,
  trust: h => h.player.band = "guest",
  unknown: h => h.depth = { level: 0, complete: false }, outside: h => h.depth = { level: 0, complete: true },
};
for (const [name, prepare] of Object.entries(changes)) await test(`ordinary offer input rejects ${name}`, async () => {
  const h = await squirrel(); prepare(h); h.click();
  assert.equal(h.q.isErrand(h.s.id), false); assert.equal(h.s.getProperty("lothlorien:guiding"), undefined);
  assert.equal(h.s.getDynamicProperty("lothlorien:gift_ready_at"), undefined); assert.equal(h.deeds, 0);
});
await test("non-acorn food and unknown centre never authorize an errand or healing", async () => {
  for (const changedHand of [false, true]) {
    const h = await squirrel(); h.s.health.currentValue = 2;
    if (changedHand) h.player.slot.item = new Item("minecraft:diamond"); else h.depth = { level: 0, complete: false };
    h.click(); assert.equal(h.q.isErrand(h.s.id), false); assert.equal(h.s.health.currentValue, 2);
    assert.ok(!h.s.events.includes("lothlorien:fed"));
  }
});
await test("accepted current named acorns preserve metadata in Survival and Adventure", async () => {
  for (const mode of ["survival", "adventure"]) {
    const h = await squirrel(); h.player.mode = mode; h.player.selectedSlotIndex = 3; h.player.slot.item.nameTag = "Winter stash";
    h.click(); assert.equal(h.q.isErrand(h.s.id), true); assert.equal(h.player.slot.item.amount, 2);
    assert.equal(h.player.slot.item.nameTag, "Winter stash");
  }
});
await test("Survival last acorn, stacked acorns and Creative Friend have correct charge policy", async () => {
  for (const [amount, creative] of [[1, false], [3, false], [3, true]]) {
    const h = await squirrel(); h.player.slot.item.amount = amount; if (creative) h.player.mode = "creative";
    h.depth = { level: 3, complete: false }; h.click(); assert.equal(h.q.isErrand(h.s.id), true);
    assert.equal(h.player.slot.item?.amount, creative ? amount : amount > 1 ? amount - 1 : undefined);
    assert.ok(!h.s.events.includes("lothlorien:fed"), "wild inside errand is not domestication");
  }
});
await test("owner limits domestication to outside/leashed feeding, not inside healing", async () => {
  for (const kind of ["inside", "outside", "leashed"]) {
    const h = await squirrel(); h.s.health.currentValue = 2;
    if (kind === "outside") { h.depth = { level: 0, complete: true }; h.player.band = "hated"; }
    if (kind === "leashed") { h.s.leashed = true; h.player.band = "hated"; }
    h.click(); assert.equal(h.s.health.currentValue, 4); assert.equal(h.player.slot.item.amount, 2);
    assert.equal(h.s.events.includes("lothlorien:fed"), kind !== "inside"); assert.equal(h.q.isErrand(h.s.id), false);
  }
});
await test("optional deed failure preserves the accepted session and only one charge", async () => {
  const h = await squirrel(); h.deedError = true; h.click(); h.click();
  assert.equal(h.q.isErrand(h.s.id), true); assert.equal(h.s.getProperty("lothlorien:guiding"), true);
  assert.equal(h.player.slot.item.amount, 2); assert.equal(h.deeds, 1);
});
const endings = {
  dead: h => h.player.health.currentValue = 0, deadAnimal: h => h.s.health.currentValue = 0,
  spectator: h => h.player.mode = "spectator", trust: h => h.player.band = "guest",
  bothDimensions: h => { const d = { ...h.dimension, id: "nether" }; h.player.dimension = d; h.s.dimension = d; },
  outside: h => h.depth = { level: 0, complete: true }, leash: h => h.s.leashed = true,
  stoppedGuiding: h => h.s.setProperty("lothlorien:guiding", false),
};
for (const [name, mutate] of Object.entries(endings)) await test(`return eligibility rejects ${name} before gift`, async () => {
  const h = await squirrel(); h.click(); const s = h.returning(), beacon = h.world.getEntity(s.beaconId);
  mutate(h); h.q.tickSessions(); assert.equal(h.q.isErrand(h.s.id), false); assert.equal(beacon.isValid, false);
  assert.equal(h.dimension.drops.length, 0); assert.equal(h.s.getDynamicProperty("lothlorien:gift_ready_at"), undefined);
});
await test("unknown biome centre pauses a paid return then recovers without another acorn", async () => {
  const h = await squirrel(); h.click(); h.returning(); h.depth = { level: 0, complete: false }; h.advance(10);
  assert.equal(h.q.isErrand(h.s.id), true); assert.equal(h.dimension.drops.length, 0);
  h.depth = { level: 2, complete: false }; h.advance(10); assert.equal(h.dimension.drops.length, 1);
  assert.equal(h.q.isErrand(h.s.id), false); assert.equal(h.player.slot.item.amount, 2);
});
await test("repeated unknown/read failures still expire at the existing time cap", async () => {
  for (const throws of [false, true]) {
    const h = await squirrel(); h.click(); const s = h.returning(), beacon = h.world.getEntity(s.beaconId);
    if (throws) { const read = h.s.getComponent; h.s.getComponent = key => { if (key === "minecraft:health") throw Error("transient"); return read(key); }; }
    else h.depth = { level: 0, complete: false };
    h.advance(Q.MAX_TICKS + Q.SQUIRREL_TICKS);
    assert.equal(h.q.isErrand(h.s.id), false); assert.equal(beacon.isValid, false); assert.equal(h.dimension.drops.length, 0);
    assert.equal([...h.timers.values()].filter(t => t.period === Q.SQUIRREL_TICKS).length, 0);
  }
});
await test("one actor read failure does not erase another squirrel session", async () => {
  const h = await squirrel(); h.click(); const first = h.s;
  h.s = h.entity(Q.SQUIRREL_ID); h.s.health.currentValue = h.s.health.effectiveMax = 4; h.click();
  const read = first.getComponent; first.getComponent = key => { if (key === "minecraft:health") throw Error("temporary"); return read(key); };
  h.returning(); h.q.tickSessions(); assert.equal(h.q.isErrand(first.id), true); assert.equal(h.q.isErrand(h.s.id), false);
  assert.equal(h.dimension.drops.length, 1);
});
await test("stacked floors are not near enough for return delivery", async () => {
  const h = await squirrel(); h.click(); h.returning(); h.player.location.y += 8; h.q.tickSessions();
  assert.equal(h.q.isErrand(h.s.id), true); assert.equal(h.dimension.drops.length, 0); assert.equal(h.rolls, 0);
  h.player.location.y -= 8; h.q.tickSessions(); assert.equal(h.dimension.drops.length, 1);
});
for (const kind of ["solid", "water", "waterlogged", "unreadable"]) await test(`gift waits for ${kind} drop space to clear`, async () => {
  const h = await squirrel(); h.click(); h.returning(); const read = h.dimension.getBlock.bind(h.dimension);
  h.dimension.getBlock = p => kind === "unreadable" ? undefined : kind === "waterlogged" ? { ...read(p), isWaterlogged: true } :
    kind === "water" ? { ...read(p), isLiquid: true } : { ...read(p), isAir: false, isSolid: true };
  h.q.tickSessions(); assert.equal(h.dimension.drops.length, 0); assert.equal(h.rolls, 0); assert.equal(h.q.isErrand(h.s.id), true);
  h.dimension.getBlock = read; h.q.tickSessions(); assert.equal(h.dimension.drops.length, 1);
});
for (const kind of ["missingTable", "emptyRoll", "undefinedRoll", "rollThrows", "spawnThrows", "unconfirmedSpawn"]) await test(`failed ${kind} does not charge cooldown or claim a gift`, async () => {
  const h = await squirrel(); h.click(); h.returning();
  if (kind === "missingTable") h.table = undefined;
  if (kind === "emptyRoll") h.loot = [];
  if (kind === "undefinedRoll") h.loot = undefined;
  if (kind === "rollThrows") h.manager.generateLootFromTable = () => { throw Error("roll"); };
  if (kind === "spawnThrows") h.dimension.spawnError = true;
  if (kind === "unconfirmedSpawn") h.dimension.spawnItem = () => undefined;
  h.q.tickSessions(); assert.equal(h.q.isErrand(h.s.id), false); assert.equal(h.dimension.drops.length, 0);
  assert.equal(h.s.getDynamicProperty("lothlorien:gift_ready_at"), undefined); assert.ok(!h.messages.includes("squirrel.gift"));
});
await test("each native gift stack is delivered unchanged once and particles are optional", async () => {
  for (const item of [new Item("lothlorien:mallorn_leaf_carpet", 4), new Item("lothlorien:mallorn_blossom", 2),
    new Item("lothlorien:western_corn_seeds", 3), new Item("lothlorien:athelas", 1)]) {
    const h = await squirrel(); h.loot = [item]; h.dimension.particleError = true; h.click(); h.returning(); h.q.tickSessions(); h.q.tickSessions();
    assert.equal(h.dimension.drops.length, 1); assert.equal(h.dimension.drops[0].item, item); assert.equal(h.rolls, 1);
    assert.equal(h.s.getDynamicProperty("lothlorien:gift_ready_at"), Q.COOLDOWN_TICKS); assert.ok(h.messages.includes("squirrel.gift"));
  }
});
await test("known delivery survives a cooldown persistence failure without a repeat gift", async () => {
  const h = await squirrel(); h.click(); h.returning(); h.s.setDynamicProperty = () => { throw Error("persistent write"); };
  h.q.tickSessions(); assert.equal(h.dimension.drops.length, 1); assert.equal(h.q.isErrand(h.s.id), false);
  h.click(); assert.equal(h.q.isErrand(h.s.id), false); assert.equal(h.player.slot.item.amount, 2);
  assert.ok(h.messages.includes("squirrel.full")); assert.equal(h.dimension.drops.length, 1);
});
console.log(`Passed ${scenarios} production swan/squirrel interaction scenarios.`);
