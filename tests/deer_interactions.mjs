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
  assert.ok(h.mod.giveGift(h.deer, { spot: { x: 40, y: 65, z: 0 } }));
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
await test("arrival lays the nut at the deer's feet and re-checks nothing: an obstructed or foreign-biome spot does not refuse it", async () => {
  const h = await setup(), s = { spot: { x: 40, y: 65, z: 0 } }; h.deer.location = { x: 12.5, y: 70, z: -3.5 };
  for (const spoil of [() => h.dimension.blocked.set("40,65,0", "minecraft:stone"), () => h.biome.at = () => "plains"]) {
    h.deer.setDynamicProperty("lothlorien:gift_spot", "kept"); spoil();
    assert.ok(h.mod.giveGift(h.deer, s)); assert.equal(h.deer.getDynamicProperty("lothlorien:gift_spot"), undefined);
    assert.deepEqual(h.dimension.drops.at(-1).at, { x: 12.5, y: 70.3, z: -3.5 }, "at the deer's feet, y + 0.3");
    h.deer.setDynamicProperty("lothlorien:gifted", undefined); h.dimension.blocked.clear(); h.biome.at = () => "lothlorien";
  }
  assert.equal(h.dimension.drops.length, 2);
});
await test("R6: a gift spot found on a thin leaf carpet that rays stop at is laid on arrival", async () => {
  const h = await setup(); h.dimension.shapes = new Map([["lothlorien:mallorn_leaf_carpet", 1 / 16]]);
  h.dimension.blocked.set("40,65,0", "lothlorien:mallorn_leaf_carpet"); h.dimension.top = 65;
  const y = h.mod.groundFeet(h.dimension, 40, 0); assert.equal(y, 66, "the search finds the carpet as ground");
  assert.ok(h.mod.giveGift(h.deer, { spot: { x: 40, y, z: 0 } }));
  assert.equal(h.dimension.drops.length, 1);
});
await test("a kept gift spot that is no longer clear is dropped and a new one is searched", async () => {
  const h = await setup();
  h.deer.setDynamicProperty("lothlorien:gift_spot", JSON.stringify({ x: 40, y: 65, z: 0, dim: "overworld" }));
  h.dimension.blocked.set("40,65,0", "minecraft:stone");
  h.offer(); assert.equal(h.jobs.length, 1); assert.equal(h.deer.getDynamicProperty("lothlorien:gift_spot"), undefined);
  h.flush(); assert.equal(h.mod.isGuiding(h.deer.id), true); assert.ok(h.deer.getDynamicProperty("lothlorien:gift_spot"));
});
// R7 (2026-11-22): a ray lands on planks, carpets and decks up in the crown (flets, village bridges); the gift spot must be natural
// ground, the nut lies at the deer's feet, a stuck last hop ends the walk, and every exit tells the player.
const said = h => { const out = []; h.player.sendMessage = t => out.push(t); return out; };
const crownOver = (h, x, z, floor = "lothlorien:mallorn_planks") => { // a deck at y 80 under a crown at 84-86, topmost block 86
  h.dimension.blocked.set(`${x},80,${z}`, floor);
  for (const y of [84, 85, 86]) h.dimension.blocked.set(`${x},${y},${z}`, "lothlorien:mallorn_leaves");
  h.dimension.tops = new Map([...(h.dimension.tops ?? []), [`${x},${z}`, 86]]);
};
await test("R7: a plank deck under a crown is not ground; grass, leaf carpet and blossom columns still are", async () => {
  const h = await setup(), tally = { n: 0 }; crownOver(h, 40, 0);
  assert.equal(h.mod.groundFeet(h.dimension, 40, 0, tally), undefined); assert.equal(tally.why, "built"); assert.equal(tally.ground, "lothlorien:mallorn_planks");
  h.dimension.tops = new Map(h.dimension.tops);
  for (const [id, x] of [["lothlorien:mallorn_leaf_carpet", 41], ["lothlorien:mallorn_blossom", 42]]) {
    h.dimension.blocked.set(`${x},65,0`, id); h.dimension.tops.set(`${x},0`, 65);
    assert.equal(h.mod.groundFeet(h.dimension, x, 0, tally), 66, id); assert.equal(tally.why, "ground");
  }
  assert.equal(h.mod.groundFeet(h.dimension, 43, 0, tally), 65); assert.equal(tally.ground, "minecraft:grass_block");
  for (const [i, id] of ["minecraft:green_carpet", "minecraft:oak_slab", "minecraft:lantern", "minecraft:chest", "minecraft:froglight"].entries()) {
    crownOver(h, 50 + i, 0, id);
    assert.equal(h.mod.groundFeet(h.dimension, 50 + i, 0), undefined, id);
  }
});
await test("R7: the nut is laid at the deer's feet whatever the spot's height, and arrival always says deer.gift", async () => {
  const h = await setup(), out = said(h); h.offer(); h.flush();
  const s = h.mod.sessions.get(h.deer.id); s.spot = { ...s.spot, y: 81 }; // a spot on a flet, 16 blocks over the floor
  h.deer.location = { x: s.target.x - 1.5, y: 65, z: s.target.z }; h.mod.tickSessions();
  assert.deepEqual(h.dimension.drops[0].at, { x: s.target.x - 1.5, y: 65.3, z: s.target.z }); assert.deepEqual(out, ["deer.accept", "deer.gift"]);
  assert.equal(h.mod.isGuiding(h.deer.id), false); assert.equal(h.deer.getDynamicProperty("lothlorien:gifted"), true);
});
// The navigator walks 1 block per 5 ticks toward the beacon; `blockAt`: the deer cannot get closer than that to the spot.
function walkDeer(h, { blockAt = 0, limit = 7000 } = {}) {
  const s = h.mod.sessions.get(h.deer.id); let ticks = 0, frozen;
  while (h.mod.isGuiding(h.deer.id) && ticks < limit) {
    const b = h.world.getEntity(s.beaconId), toSpot = Math.hypot(h.deer.location.x - s.spot.x, h.deer.location.z - s.spot.z);
    if (blockAt && toSpot <= blockAt) frozen ??= ticks;
    else if (b) {
      const dx = b.location.x - h.deer.location.x, dz = b.location.z - h.deer.location.z, d = Math.hypot(dx, dz), step = Math.min(1, d);
      if (d > 0) h.deer.location = { x: h.deer.location.x + dx / d * step, y: 65, z: h.deer.location.z + dz / d * step };
    }
    h.player.location = { x: h.deer.location.x - 2, y: 65, z: h.deer.location.z };
    h.advance(5); ticks += 5;
  }
  return { ticks, frozen };
}
await test("R7: a deer stuck at its last hop lays the gift within 5 s", async () => {
  const h = await setup({ realWalk: true }), out = said(h); h.deer.location = { x: 0, y: 65, z: 0 }; h.player.location = { x: -2, y: 65, z: 0 };
  h.offer(); h.flush();
  const { ticks, frozen } = walkDeer(h, { blockAt: 6 }); // the last waypoint is picked 9 blocks out; the deer stops 6 from the spot, 5 from it
  assert.ok(frozen !== undefined, "the deer got within 6 blocks");
  assert.ok(out.includes("deer.gift"), "arrived"); assert.equal(h.dimension.drops.length, 1);
  assert.ok(ticks - frozen <= rules.HOP_STUCK_TICKS + 2 * rules.GUIDE_TICKS, `${ticks - frozen} ticks after the deer stopped`);
  assert.equal(h.dimension.drops[0].at.x, h.deer.location.x, "at the deer's feet, not at the spot");
});
await test("R7: an acorn offered to a guiding deer answers deer.leading and is kept", async () => {
  const h = await setup(), out = said(h); h.offer(); h.flush(); const left = h.player.slot.amount, beacon = h.mod.sessions.get(h.deer.id).beaconId;
  h.offer(); h.flush();
  assert.deepEqual(out, ["deer.accept", "deer.leading"]); assert.equal(h.player.slot.amount, left); assert.equal(h.jobs.length, 0);
  assert.equal(h.mod.sessions.get(h.deer.id).beaconId, beacon); assert.equal(h.mod.isGuiding(h.deer.id), true);
});
await test("R7: a failing session tick releases the deer, removes the beacon and says deer.abort", async () => {
  const h = await setup(), out = said(h); h.offer(); h.flush();
  h.world.getEntity(h.mod.sessions.get(h.deer.id).beaconId).remove(); h.dimension.spawnEntity = () => { throw Error("cannot spawn"); };
  h.mod.tickSessions();
  assert.equal(h.mod.isGuiding(h.deer.id), false); assert.ok(h.deer.events.includes("lothlorien:guide_end")); assert.deepEqual(out, ["deer.accept", "deer.abort"]);
});
await test("R7: a failed lead releases the deer, keeps the acorn and says deer.abort", async () => {
  const h = await setup(), out = said(h); h.dimension.spawnEntity = () => { throw Error("cannot spawn"); };
  h.offer(); h.flush();
  assert.equal(h.mod.isGuiding(h.deer.id), false); assert.deepEqual(out, ["deer.abort"]); assert.equal(h.player.slot.amount, 3, "acorn kept");
});
await test("R7: every unexpected exit tells an active player: alarm, band and a lost deer say deer.abort; a dead deer is silent", async () => {
  for (const [name, mutate, expected] of [["alarm", h => h.deer.setProperty("lothlorien:guiding", false), ["deer.accept", "deer.abort"]],
    ["band", h => h.player.band = "guest", ["deer.accept", "deer.abort"]], ["deer gone", h => h.deer.remove(), ["deer.accept", "deer.abort"]],
    ["dead deer", h => h.deer.health.currentValue = 0, ["deer.accept"]]]) {
    const h = await setup(), out = said(h); h.offer(); h.flush(); mutate(h); h.mod.tickSessions();
    assert.equal(h.mod.isGuiding(h.deer.id), false, name); assert.deepEqual(out, expected, name);
  }
});
await test("a gift-spot search that throws clears the search and answers no_spot; the next offer searches again", async () => {
  const h = await setup(), out = said(h), at = h.biome.at; h.biome.at = () => { throw Error("boom"); };
  h.offer(); assert.equal(h.jobs.length, 1); h.flush();
  assert.deepEqual(out, ["deer.no_spot"]); assert.equal(h.mod.isGuiding(h.deer.id), false);
  h.biome.at = at; h.offer(); assert.equal(h.jobs.length, 1, "searching was cleared"); h.flush(); assert.equal(h.mod.isGuiding(h.deer.id), true);
});
await test("R7: decks under a crown everywhere 30+ blocks out leave no spot: no_spot, and the debug summary names the planks", async () => {
  const h = await setup(), out = said(h), warn = console.warn, lines = []; console.warn = l => lines.push(String(l)); h.debug = true;
  const base = h.dimension.getBlock.bind(h.dimension), decked = p => Math.hypot(Math.floor(p.x), Math.floor(p.z)) >= 30;
  h.dimension.getBlock = p => {
    const y = Math.floor(p.y);
    if (decked(p) && y === 80) return { ...base({ ...p, y: 200 }), typeId: "lothlorien:mallorn_planks", y, isAir: false };
    if (decked(p) && y >= 84 && y <= 86) return { ...base({ ...p, y: 200 }), typeId: "lothlorien:mallorn_leaves", y, isAir: false };
    return base(p);
  };
  h.dimension.getTopmostBlock = p => h.dimension.getBlock({ ...p, y: decked(p) ? 86 : 64 });
  try { h.offer(); h.flush(); } finally { console.warn = warn; }
  assert.deepEqual(out, ["deer.no_spot"]); assert.equal(h.mod.isGuiding(h.deer.id), false);
  assert.ok(lines.some(l => /white deer: \(debug\) search from .*: 96 candidates: 0 outside, 96 built \(lothlorien:mallorn_planks\), 0 water, 0 headroom, 0 none, 0 ground; none; \d+ steps/.test(l)), lines.join("\n"));
});
await test("debug lines only while the switch is on: none when off; offer, search, lead, hop, arrive and end lines when on, never per tick", async () => {
  const run = async debug => {
    const h = await setup({ realWalk: true }), warn = console.warn, lines = []; console.warn = l => lines.push(String(l)); h.debug = debug;
    try {
      h.deer.location = { x: 0, y: 65, z: 0 }; h.player.location = { x: -2, y: 65, z: 0 }; h.offer(); h.flush(); h.offer();
      return { lines, ticks: walkDeer(h, { blockAt: 10 }).ticks };
    } finally { console.warn = warn; }
  };
  const off = await run(false), on = await run(true);
  assert.deepEqual(off.lines.filter(l => l.includes("white deer")), []);
  for (const re of [/offer e\d+: ignored \(guiding\)/, /search from/, /lead to/, /hop (next|retry)/, /arrive \(/, /end \(arrived/])
    assert.ok(on.lines.some(l => re.test(l)), String(re));
  assert.ok(on.lines.every(l => l.startsWith("[lothlorien] white deer: (debug) ")));
  assert.ok(on.lines.length < on.ticks / rules.GUIDE_TICKS / 4, `${on.lines.length} lines in ${on.ticks} ticks`);
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
