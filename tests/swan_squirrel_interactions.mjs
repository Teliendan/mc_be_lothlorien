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
    addBeaconSource: h.mod.addBeaconSource, consumeAcorn: h.mod.consumeAcorn, stand: h.mod.stand,
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
  trust: h => h.player.band = "guest", outside: h => h.depth = { level: 0, complete: true },
};
for (const [name, prepare] of Object.entries(changes)) await test(`ordinary offer input rejects ${name}`, async () => {
  const h = await squirrel(); prepare(h); h.click();
  assert.equal(h.q.isErrand(h.s.id), false); assert.equal(h.s.getProperty("lothlorien:guiding"), undefined);
  assert.equal(h.s.getDynamicProperty("lothlorien:gift_ready_at"), undefined); assert.equal(h.deeds, 0);
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
await test("an errand that cannot finish ends at the time cap with a message", async () => {
  const h = await squirrel(); h.click(); const s = h.returning(), beacon = h.world.getEntity(s.beaconId);
  h.player.location.y += 8; // a platform the squirrel cannot reach
  h.advance(Q.MAX_TICKS + Q.SQUIRREL_TICKS);
  assert.equal(h.q.isErrand(h.s.id), false); assert.equal(beacon.isValid, false); assert.equal(h.dimension.drops.length, 0);
  assert.ok(h.messages.includes("squirrel.abort"));
  assert.equal([...h.timers.values()].filter(t => t.period === Q.SQUIRREL_TICKS).length, 0);
});
await test("the gift is handed over horizontally near, within a small height difference", async () => {
  const h = await squirrel(); h.click(); h.returning(); h.player.location.y += Q.GIFT_HEIGHT + 1; h.q.tickSessions();
  assert.equal(h.q.isErrand(h.s.id), true); assert.equal(h.dimension.drops.length, 0);
  h.player.location.y -= 2; h.q.tickSessions(); assert.equal(h.dimension.drops.length, 1);
});
await test("every rolled stack is delivered unchanged once and the cooldown is kept", async () => {
  for (const loot of [[new Item("lothlorien:mallorn_leaf_carpet", 4)], [new Item("lothlorien:athelas", 1), new Item("lothlorien:mallorn_blossom", 2)]]) {
    const h = await squirrel(); h.loot = loot; h.dimension.particleError = true; h.click(); h.returning(); h.q.tickSessions(); h.q.tickSessions();
    assert.deepEqual(h.dimension.drops.map(d => d.item), loot); assert.equal(h.rolls, 1);
    assert.equal(h.s.getDynamicProperty("lothlorien:gift_ready_at"), Q.COOLDOWN_TICKS); assert.ok(h.messages.includes("squirrel.gift"));
    h.click(); assert.equal(h.q.isErrand(h.s.id), false); assert.ok(h.messages.includes("squirrel.full")); assert.equal(h.player.slot.item.amount, 2);
  }
});
console.log(`Passed ${scenarios} production swan/squirrel interaction scenarios.`);
