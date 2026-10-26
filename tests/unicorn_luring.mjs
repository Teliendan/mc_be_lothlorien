// Production Harmony tag updates plus native filter contracts; no native AI simulation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setup, load, Item } from "./fixtures/wildlife_runtime.mjs";
import * as H from "../lothlorien_bp/scripts/harmony.js";
import * as UR from "../lothlorien_bp/scripts/unicorn_rules.js";
import { ELANOR_ID, UNICORN_ID } from "../lothlorien_bp/scripts/unicorn_rules.js";
const entity = JSON.parse(readFileSync(new URL("../lothlorien_bp/entities/unicorn.json", import.meta.url)))["minecraft:entity"];
let cases = 0;
async function test(name, body) { await body(); cases++; console.log(`ok   unicorn luring: ${name}`); }
async function service() {
  const h = await setup(); h.inside = false;
  const game = await load("harmony_game", { ...h.base, ...H });
  h.playerFor = (harmony, mode = "survival", timer = 0) => {
    const p = h.entity("minecraft:player"), tags = new Set(); p.mode = mode;
    p.setDynamicProperty("lothlorien:harmony", JSON.stringify({ harmony, timer }));
    p.hasTag = tag => tags.has(tag); p.addTag = tag => { tags.add(tag); }; p.removeTag = tag => tags.delete(tag);
    p.onScreenDisplay = { setActionBar() {} }; p.sendMessage = () => {};
    h.world.players.push(p); return p;
  };
  h.world.players = [];
  h.player = h.playerFor(10); h.guest = h.playerFor(0); h.hated = h.playerFor(-30);
  game.startHarmony(() => h.inside, "debug"); h.game = game; return h;
}

await test("existing20-tick Harmony service refreshes persisted Friend/Hated and stale tags", async () => {
  const h = await service(); h.guest.addTag(h.game.FRIEND_TAG); h.player.addTag(h.game.HATED_TAG);
  assert.equal([...h.timers.values()].filter(t => t.period).length, 1);
  h.advance(20);
  assert.equal(h.player.hasTag(h.game.FRIEND_TAG), true); assert.equal(h.player.hasTag(h.game.HATED_TAG), false);
  assert.equal(h.guest.hasTag(h.game.FRIEND_TAG), false); assert.equal(h.hated.hasTag(h.game.HATED_TAG), true);
  assert.equal(h.hated.hasTag(h.game.FRIEND_TAG), false);
});
await test("debug changes update Friend immediately without redefining it by game mode", async () => {
  const h = await service(); h.player.mode = "creative";
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "10" }, h.player);
  assert.equal(h.player.hasTag(h.game.FRIEND_TAG), true);
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "9" }, h.player);
  assert.equal(h.player.hasTag(h.game.FRIEND_TAG), false);
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "-30" }, h.player);
  assert.equal(h.player.hasTag(h.game.HATED_TAG), true);
});
await test("ordinary deed removes Friend immediately and recovery reacquires it in existing service", async () => {
  const h = await service(); h.inside = true; h.advance(20);
  const victim = h.entity("lothlorien:deer");
  h.fire("entityDie", { deadEntity: victim, damageSource: { damagingEntity: h.player } });
  assert.equal(h.player.hasTag(h.game.FRIEND_TAG), false);
  assert.ok(h.game.harmonyOf(h.player).harmony < H.FRIEND_FROM);
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "9" }, h.player);
  h.game.harmonyOf(h.player).timer = H.RECOVER_SECONDS_INSIDE - 1;
  h.advance(20); assert.equal(h.player.hasTag(h.game.FRIEND_TAG), true);
});
await test("warden fight and hated-player death retain both band-tag policies", async () => {
  const h = await service(); h.advance(20);
  h.game.recordWardenFight(h.player, h.entity("lothlorien:elven_warden"));
  assert.equal(h.player.hasTag(h.game.FRIEND_TAG), false);
  h.inside = true;
  h.fire("entityDie", { deadEntity: h.hated, damageSource: {} });
  assert.equal(h.hated.hasTag(h.game.HATED_TAG), false); assert.equal(h.hated.hasTag(h.game.FRIEND_TAG), false);
});
await test("leave/rejoin reads fresh persisted Harmony and repairs stale Friend membership", async () => {
  const h = await service(); h.advance(20); assert.equal(h.player.hasTag(h.game.FRIEND_TAG), true);
  h.fire("playerLeave", { playerId: h.player.id });
  h.player.setDynamicProperty("lothlorien:harmony", JSON.stringify({ harmony: 0, timer: 0 }));
  h.advance(20); assert.equal(h.player.hasTag(h.game.FRIEND_TAG), false);
});

// Evaluate just the declared filter contract against explicit players. This
// checks membership/exemption data, not native pathfinding/retarget timing.
function matches(filter, player) {
  if (filter.all_of) return filter.all_of.every(f => matches(f, player));
  assert.equal(filter.subject, "other");
  if (filter.test === "is_family") return filter.value === "player" && player.typeId === "minecraft:player";
  if (filter.test === "has_tag") return player.hasTag(filter.value) === (filter.operator !== "!=");
  if (filter.test === "is_sneaking") return !!player.isSneaking === filter.value;
  throw Error(`unhandled filter ${filter.test}`);
}
await test("a Friend is never fled from in the Friend state; Guests and worse still are", async () => {
  const h = await service(); h.advance(20);
  const avoid = entity.component_groups["lothlorien:state_friend"]["minecraft:behavior.avoid_mob_type"].entity_types.slice(0, 2);
  // flat "!=" like the deer lure exemption; the nested none_of/all_of form let it flee a Friend holding Elanor in game
  for (const entry of avoid) assert.deepEqual(entry.filters.all_of.at(-1), { test: "has_tag", subject: "other", operator: "!=", value: h.game.FRIEND_TAG });
  for (const p of [h.player, h.guest, h.hated]) for (const sneaking of [false, true]) {
    p.isSneaking = sneaking;
    assert.equal(avoid.some(e => matches(e.filters, p)), p !== h.player);
  }
});
await test("the lure is vanilla tempt in its own group, added only to a wild, ready Friend-state unicorn", async () => {
  const lure = entity.component_groups["lothlorien:lure"];
  // the follow_target_leader goal with a bool_property "self" leader filter never followed in game
  assert.deepEqual(lure, { "minecraft:behavior.tempt": { priority: 3, speed_multiplier: 1, items: [ELANOR_ID], within_radius: 10, can_get_scared: false } });
  for (const [name, group] of Object.entries(entity.component_groups)) {
    assert.equal(group["minecraft:behavior.follow_target_leader"], undefined);
    if (name !== "lothlorien:lure") assert.equal(group["minecraft:behavior.tempt"], undefined);
  }
  const adds = ev => ev.sequence.filter(step => step.add?.component_groups.includes("lothlorien:lure"));
  for (const n of ["calm", "l1", "l2", "l3", "friend"]) {
    const ev = entity.events[`lothlorien:set_${n}`];
    assert.ok(ev.sequence[0].remove.component_groups.includes("lothlorien:lure"));
    assert.equal(adds(ev).length, n === "friend" ? 1 : 0);
  }
  assert.deepEqual(adds(entity.events["lothlorien:set_friend"])[0].filters, { all_of: [
    { test: "bool_property", domain: "lothlorien:tame", value: false },
    { test: "bool_property", domain: "lothlorien:offer_ready", value: true },
  ] });
  assert.ok(entity.events["lothlorien:alarm"].remove.component_groups.includes("lothlorien:lure"));
  assert.deepEqual(adds(entity.events["lothlorien:lure_on"])[0].filters, { all_of: [
    { test: "enum_property", domain: "lothlorien:wariness", value: "friend" },
    { test: "bool_property", domain: "lothlorien:alarmed", value: false },
    { test: "bool_property", domain: "lothlorien:tame", value: false },
  ] });
  assert.deepEqual(entity.events["lothlorien:lure_off"], { remove: { component_groups: ["lothlorien:lure"] } });
});
await test("a Guest inside the lure radius turns the state calm, so only Friends can lure", async () => {
  const R = await import("../lothlorien_bp/scripts/deer_rules.js");
  const radius = entity.component_groups["lothlorien:lure"]["minecraft:behavior.tempt"].within_radius;
  assert.ok(radius <= R.FLIGHT_RADIUS.calm);
  assert.equal(R.pickWariness([{ distance: 2, wariness: "friend" }, { distance: radius, wariness: "calm" }]), "calm");
});
await test("Friend state keeps its danger flight and the bond keeps no inventory", async () => {
  const g=entity.component_groups["lothlorien:state_friend"];
  assert.equal(entity.description.identifier,UNICORN_ID);
  assert.deepEqual(g["minecraft:behavior.avoid_mob_type"].entity_types.slice(2).map(e=>[e.filters.value,e.max_dist]),[["wolf",12],["monster",8]]);
  assert.equal(entity.component_groups["lothlorien:bonded"]["minecraft:inventory"],undefined);
  assert.equal(entity.component_groups["lothlorien:bonded"]["minecraft:equippable"],undefined);
});
await test("a bonded unicorn's death is reported to its owner only", async () => {
  const h = await setup(), mod = await load("unicorn", { ...h.base, ELANOR_ID, UNICORN_ID, mayRide: () => true, nextTrust: () => ({}),
    offerRefusal: () => undefined, ticksSince: () => undefined, setEventFor: () => "", healAnimal() {} });
  const other = h.entity("minecraft:player"); h.world.players.push(other);
  const sent = []; h.player.sendMessage = m => sent.push(["owner", m]); other.sendMessage = m => sent.push(["other", m]);
  mod.startUnicorns();
  const unicorn = h.entity(UNICORN_ID); unicorn.setDynamicProperty("lothlorien:owner", h.player.id);
  h.fire("entityDie", { deadEntity: unicorn }); assert.deepEqual(sent, [["owner", "unicorn.died"]]);
  sent.length = 0; h.fire("entityDie", { deadEntity: h.entity(UNICORN_ID) }); assert.deepEqual(sent, []);
});
async function cooldownService(lastOffer, offset = 0) {
  const h=await setup(); h.clockOffset=offset;
  h.world.getAbsoluteTime=()=>h.clockOffset+h.system.currentTick;
  h.unicorn=h.entity(UNICORN_ID); h.unicorn.setProperty('lothlorien:trust',0);
  h.unicorn.setProperty('lothlorien:wariness','friend');
  if (lastOffer !== undefined) h.unicorn.setDynamicProperty('lothlorien:last_offer',lastOffer);
  const deer=await load('deer',h.base); deer.startDeer();
  const unicorn=await load('unicorn',{...h.base,...UR,watchUnicornReadiness:deer.watchUnicornReadiness});
  unicorn.startUnicorns(); h.player.slot.item=new Item(ELANOR_ID,5);
  h.feed=()=>h.fire('playerInteractWithEntity',{player:h.player,target:h.unicorn,itemStack:h.player.slot.item.clone()});
  return h;
}
await test('accepted offering stops native lure for exactly the same ten-second refusal window',async()=>{
  const h=await cooldownService(); assert.equal(h.unicorn.getProperty('lothlorien:offer_ready'),true);
  h.feed(); assert.equal(h.player.slot.amount,4); assert.equal(h.unicorn.getProperty('lothlorien:offer_ready'),false);
  assert.equal(h.unicorn.events.at(-1),'lothlorien:lure_off');
  h.advance(199); h.feed(); assert.equal(h.player.slot.amount,4);
  assert.equal(h.unicorn.getProperty('lothlorien:offer_ready'),false);
  h.advance(1); assert.equal(h.unicorn.getProperty('lothlorien:offer_ready'),true);
  assert.equal(h.unicorn.events.at(-1),'lothlorien:lure_on');
  h.feed(); assert.equal(h.player.slot.amount,3); assert.equal(h.unicorn.getProperty('lothlorien:offer_ready'),false);
});
await test('unload cancels the one-shot wait; load restores only its remaining world-time pause',async()=>{
  const h=await cooldownService(); h.feed(); h.advance(70);
  h.unicorn.isValid=false; h.fire('entityRemove',{removedEntityId:h.unicorn.id});
  h.advance(80); h.unicorn.isValid=true; h.fire('entityLoad',{entity:h.unicorn});
  assert.equal(h.unicorn.getProperty('lothlorien:offer_ready'),false);
  h.advance(49); assert.equal(h.unicorn.getProperty('lothlorien:offer_ready'),false);
  h.advance(1); assert.equal(h.unicorn.getProperty('lothlorien:offer_ready'),true);
});
await test('existing lifecycle bootstrap restores persisted pause and follows existing clock-reset semantics',async()=>{
  const pending=await cooldownService(900,1000);
  assert.equal(pending.unicorn.getProperty('lothlorien:offer_ready'),false);
  pending.advance(99); assert.equal(pending.unicorn.getProperty('lothlorien:offer_ready'),false);
  pending.advance(1); assert.equal(pending.unicorn.getProperty('lothlorien:offer_ready'),true);
  const elapsed=await cooldownService(600,1000); assert.equal(elapsed.unicorn.getProperty('lothlorien:offer_ready'),true);
  const reset=await cooldownService(1100,1000); assert.equal(reset.unicorn.getProperty('lothlorien:offer_ready'),true);
  assert.equal(UR.offerRefusal({band:'friend',tame:false,sinceLast:UR.ticksSince(1000,1100)}),undefined);
});
console.log(`Passed ${cases} unicorn luring/Harmony production and filter scenarios.`);
