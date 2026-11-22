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
    stand: h.mod.stand,
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
await test("natural swan surface rule: deep open water moves up, bank removes, surface and land keep", async () => {
  const column = (water, over = {}) => y => over[y] ?? (water.includes(y) ? "minecraft:water" : y > Math.max(...water) ? "minecraft:air" : "minecraft:dirt");
  assert.deepEqual(S.surfaceAction(62.3, column([60, 61, 62, 63, 64])), { action: "move", y: 64 });
  assert.deepEqual(S.surfaceAction(60.5, column([60, 61, 62, 63, 64], { 62: "minecraft:flowing_water" })), { action: "move", y: 64 });
  assert.deepEqual(S.surfaceAction(62.5, column([60, 61, 62], { 64: "minecraft:stone" })), { action: "remove" });
  assert.deepEqual(S.surfaceAction(61.5, column([60, 61, 62], { 63: "minecraft:oak_leaves" })), { action: "remove" });
  assert.deepEqual(S.surfaceAction(61.5, column([60, 61, 62], { 64: "minecraft:stone" })), { action: "remove" });
  assert.deepEqual(S.surfaceAction(62.5, column([60, 61, 62])), { action: "keep" });
  assert.deepEqual(S.surfaceAction(63.0, column([60, 61, 62])), { action: "keep" });
  assert.deepEqual(S.surfaceAction(65, column([])), { action: "keep" });
  const deep = Array.from({ length: 40 }, (_, i) => 10 + i); // scan stops at the cap
  assert.equal(S.surfaceAction(10.5, column(deep)).action, "remove");
  const h = await setup(), m = await load("swan", { ...h.base, ...S }, "\nexport { judgeNaturalSpawn };\n");
  const biome = { id: "lothlorien", at: () => "lothlorien" };
  const water = (...ys) => { for (const y of ys) h.dimension.blocked.set(`0,${y},0`, "minecraft:water"); };
  const deepSwan = h.entity(S.SWAN_ID, { x: 0.5, y: 62.2, z: 0.5 }); deepSwan.setProperty("lothlorien:natural", true);
  h.dimension.blocked.clear(); water(62, 63, 64); // air above, grass block y=64 replaced by water
  m.judgeNaturalSpawn(deepSwan, biome); assert.equal(deepSwan.isValid, true); assert.equal(deepSwan.location.y, 64);
  assert.equal(deepSwan.location.x, 0.5); assert.equal(deepSwan.location.z, 0.5);
  const bank = h.entity(S.SWAN_ID, { x: 0.5, y: 62.2, z: 0.5 }); bank.setProperty("lothlorien:natural", true);
  h.dimension.blocked.set("0,65,0", "minecraft:stone");
  m.judgeNaturalSpawn(bank, biome); assert.equal(bank.isValid, false);
  const land = h.entity(S.SWAN_ID, { x: 20.5, y: 65, z: 20.5 }); land.setProperty("lothlorien:natural", true);
  m.judgeNaturalSpawn(land, biome); assert.equal(land.isValid, true); assert.equal(land.location.y, 65);
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
await test("owner limits domestication to outside/leashed feeding; an injured squirrel inside runs its errand (R8, D1)", async () => {
  for (const kind of ["inside", "outside", "leashed"]) {
    const h = await squirrel(); h.s.health.currentValue = 2;
    if (kind === "outside") { h.depth = { level: 0, complete: true }; h.player.band = "hated"; }
    if (kind === "leashed") { h.s.leashed = true; h.player.band = "hated"; }
    h.click(); assert.equal(h.s.health.currentValue, 4); assert.equal(h.player.slot.item.amount, 2);
    assert.equal(h.s.events.includes("lothlorien:fed"), kind !== "inside"); assert.equal(h.q.isErrand(h.s.id), kind === "inside");
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
  leash: h => h.s.leashed = true,
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
// R8 (2026-11-22): the owner's third errand "lost its way" and later offers were met with silence. No state survives an abort,
// and every refusal and exit now answers (squirrel.md, "R8").
const fresh = h => { const q = h.entity(Q.SQUIRREL_ID); q.health.currentValue = q.health.effectiveMax = 4; return q; };
const offerTo = (h, target) => { const before = h.messages.length, acorns = h.player.slot.item?.amount ?? 0;
  h.fire("playerInteractWithEntity", { player: h.player, target, itemStack: h.player.slot.item?.clone() });
  return { said: h.messages.slice(before), eaten: acorns - (h.player.slot.item?.amount ?? 0), errand: h.q.isErrand(target.id) }; };
await test("R8: no lock after any abort: two gifts, a third errand that ends by cap, distance or band, and a fresh squirrel still answers accept", async () => {
  const routes = {
    cap: h => { h.returning(); h.player.location.y += 8; h.advance(Q.MAX_TICKS + 2 * Q.SQUIRREL_TICKS); },
    distance: h => { h.player.location = { x: 60, y: 65, z: 0 }; h.advance(Q.SQUIRREL_TICKS); },
    band: h => { h.player.band = "guest"; h.advance(Q.SQUIRREL_TICKS); },
  };
  for (const [route, end] of Object.entries(routes)) {
    const h = await squirrel(); h.player.slot.item.amount = 64;
    for (let i = 0; i < 2; i++) { const q = fresh(h); h.s = q; offerTo(h, q); h.returning(); h.q.tickSessions(); assert.equal(h.q.isErrand(q.id), false); }
    const lost = fresh(h); h.s = lost; offerTo(h, lost); end(h);
    assert.equal(h.q.isErrand(lost.id), false, route); assert.ok(h.messages.includes("squirrel.abort"), route);
    h.player.location = { x: 0, y: 65, z: 0 }; h.player.band = "friend";
    const r = offerTo(h, fresh(h)); assert.deepEqual(r.said, ["squirrel.accept"], route); assert.equal(r.eaten, 1);
  }
});
await test("R8: every exit says something: a lead says stop_leashed, a vanished squirrel says abort, a dead squirrel and a gone player are silent, a throwing tick aborts at once", async () => {
  const run = async (mutate) => { const h = await squirrel(); h.click(); const beacon = h.world.getEntity(h.returning().beaconId), before = h.messages.length;
    mutate(h, beacon); h.q.tickSessions(); return { h, beacon, said: h.messages.slice(before) }; };
  let r = await run(h => h.s.leashed = true); assert.deepEqual(r.said, ["squirrel.stop_leashed"]); assert.equal(r.h.q.isErrand(r.h.s.id), false);
  r = await run(h => h.s.remove()); assert.deepEqual(r.said, ["squirrel.abort"]); assert.equal(r.beacon.isValid, false);
  r = await run(h => h.s.health.currentValue = 0); assert.deepEqual(r.said, []); assert.equal(r.h.q.isErrand(r.h.s.id), false);
  r = await run(h => h.player.isValid = false); assert.deepEqual(r.said, []); assert.equal(r.h.q.isErrand(r.h.s.id), false);
  r = await run(h => h.s.setProperty("lothlorien:alarmed", true)); assert.deepEqual(r.said, ["squirrel.alarmed"]);
  const h = await squirrel(); h.click(); const s = h.returning(), get = h.world.getEntity.bind(h.world), ev = [...h.s.events];
  h.world.getEntity = id => { if (id === s.beaconId) throw Error("boom"); return get(id); };
  const before = h.messages.length; h.q.tickSessions();
  assert.equal(h.q.isErrand(h.s.id), false, "the session is gone at once, no silent retry"); assert.deepEqual(h.messages.slice(before), ["squirrel.abort"]);
  assert.ok(h.s.events.includes("lothlorien:guide_end") && h.s.events.length > ev.length);
});
await test("R8: an offer to a squirrel on its errand answers busy and keeps the acorn; an alarmed squirrel answers startled and keeps it", async () => {
  const h = await squirrel(); h.click(); const r = offerTo(h, h.s);
  assert.deepEqual(r.said, ["squirrel.busy"]); assert.equal(r.eaten, 0);
  const calm = fresh(h); calm.setProperty("lothlorien:alarmed", true); const a = offerTo(h, calm);
  assert.deepEqual(a.said, ["squirrel.startled"]); assert.equal(a.eaten, 0); assert.equal(a.errand, false);
});
await test("R8: an injured Friend's acorn starts the errand and heals it, one acorn (D1); on cooldown a hurt squirrel eats, heals and says fed", async () => {
  const h = await squirrel(); h.player.slot.item.amount = 64; h.s.health.currentValue = 2;
  const r = offerTo(h, h.s); assert.deepEqual(r.said, ["squirrel.accept"]); assert.equal(r.eaten, 1); assert.equal(h.s.health.currentValue, 4); assert.equal(r.errand, true);
  h.returning(); h.q.tickSessions(); assert.equal(h.q.isErrand(h.s.id), false); h.s.health.currentValue = 2;
  const f = offerTo(h, h.s); assert.deepEqual(f.said, ["squirrel.fed"]); assert.equal(f.eaten, 1); assert.equal(h.s.health.currentValue, 4); assert.equal(f.errand, false);
  const full = offerTo(h, h.s); assert.deepEqual(full.said, ["squirrel.full"]); assert.equal(full.eaten, 0, "a healthy squirrel on cooldown keeps the acorn");
});
await test("R8: feeding outside the forest eats one acorn and says outside; an errand squirrel clicked outside ends with abort first", async () => {
  const h = await squirrel(); h.depth = { level: 0, complete: true };
  const r = offerTo(h, h.s); assert.deepEqual(r.said, ["squirrel.outside"]); assert.equal(r.eaten, 1); assert.ok(h.s.events.includes("lothlorien:fed")); assert.equal(r.errand, false);
  const g = await squirrel(); g.click(); g.depth = { level: 0, complete: true }; const beacon = g.world.getEntity(g.returning().beaconId);
  const e = offerTo(g, g.s); assert.deepEqual(e.said, ["squirrel.abort", "squirrel.outside"]); assert.equal(e.errand, false); assert.equal(beacon.isValid, false);
});
await test("R8: a failing start keeps the acorn, releases the squirrel and says no_path", async () => {
  for (const failAt of ["spawn", "event"]) {
    const h = await squirrel();
    if (failAt === "spawn") h.dimension.spawnEntity = () => { throw Error("spawn"); };
    else h.s.triggerEvent = () => { throw Error("event"); };
    const r = offerTo(h, h.s); assert.deepEqual(r.said, ["squirrel.no_path"], failAt); assert.equal(r.eaten, 0, failAt); assert.equal(r.errand, false);
    assert.equal(h.s.getProperty("lothlorien:guiding"), undefined, failAt); assert.equal(h.q.sessions.size, 0);
    assert.equal([...h.timers.values()].filter(t => t.period === Q.SQUIRREL_TICKS).length, 0);
  }
});
await test("R8: an errand that runs out of the biome still delivers; leaving the forest is no ending", async () => {
  const h = await squirrel(); h.click(); h.returning(); h.depth = { level: 0, complete: true };
  h.q.tickSessions(); assert.equal(h.dimension.drops.length, 1); assert.ok(h.messages.includes("squirrel.gift")); assert.ok(!h.messages.includes("squirrel.abort"));
});
await test("R8: debug lines only while the switch is on: none when off; offer, accept, phases, gift and end lines when on, never per tick", async () => {
  const run = async debug => {
    const h = await squirrel(), warn = console.warn, lines = []; console.warn = l => lines.push(String(l)); h.debug = debug;
    try {
      h.click(); h.click(); h.q.tickSessions(); h.q.tickSessions(); // busy offer, then ticks while it runs
      h.q.sessions.get(h.s.id).phase = "away"; h.player.location = { x: 12, y: 65, z: 0 }; h.s.location = { x: 12, y: 65, z: 0 };
      for (let i = 0; i < 40; i++) { h.advance(Q.SQUIRREL_TICKS); if (!h.q.isErrand(h.s.id)) break; }
      const sq2 = fresh(h); h.player.band = "guest"; h.fire("playerInteractWithEntity", { player: h.player, target: sq2, itemStack: h.player.slot.item.clone() });
      return lines;
    } finally { console.warn = warn; }
  };
  assert.deepEqual((await run(false)).filter(l => l.includes("squirrel:")), []);
  const on = await run(true);
  for (const re of [/offer e\d+: refused \(busy\)/, /accept e\d+: away /, /phase away->dig/, /gift at /, /end \(gift\): squirrel\.gift/, /offer e\d+: refused \(untrusted\)/])
    assert.ok(on.some(l => re.test(l)), `${re}\n${on.join("\n")}`);
  assert.ok(on.every(l => l.startsWith("[lothlorien] squirrel: (debug) ")), on.join("\n"));
});
console.log(`Passed ${scenarios} production swan/squirrel interaction scenarios.`);
