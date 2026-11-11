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
  h.advance(20); // the first one-second tick checks the tags of a player who just joined
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "10" }, h.player);
  assert.equal(h.player.hasTag(h.game.FRIEND_TAG), true);
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "9" }, h.player);
  assert.equal(h.player.hasTag(h.game.FRIEND_TAG), false);
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "-30" }, h.player);
  assert.equal(h.player.hasTag(h.game.HATED_TAG), true);
});
await test("band tags are checked once per join and then only when the band changes (no per-second hasTag)", async () => {
  const h = await service(); let tagReads = 0;
  for (const p of [h.player, h.guest, h.hated]) { const has = p.hasTag; p.hasTag = (tag) => { tagReads++; return has(tag); }; }
  h.advance(20); assert.ok(tagReads > 0, "the first tick after joining reads the tags");
  tagReads = 0; h.advance(20 * 30); assert.equal(tagReads, 0, "a steady state costs no tag read");
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "5" }, h.player); // Friend -> Guest: a band change
  assert.ok(tagReads > 0 && !h.player.hasTag(h.game.FRIEND_TAG));
  tagReads = 0; h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "6" }, h.player); assert.equal(tagReads, 0, "a change inside a band costs none");
  h.fire("playerLeave", { playerId: h.guest.id }); h.guest.addTag(h.game.FRIEND_TAG); // a stale tag from an older state
  tagReads = 0; h.advance(20); assert.equal(h.guest.hasTag(h.game.FRIEND_TAG), false, "rejoin: corrected on the first tick");
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
  if (filter.test === "has_equipment") return filter.domain === "hand" && (player.held === filter.value) === (filter.operator !== "!=");
  throw Error(`unhandled filter ${filter.test}`);
}
await test("in the Friend state it keeps 3 blocks (2 sneaking) from players without Elanor, none from Elanor holders", async () => {
  const avoid = entity.component_groups["lothlorien:state_friend"]["minecraft:behavior.avoid_mob_type"].entity_types.slice(0, 2);
  assert.deepEqual(avoid.map(e => e.max_dist), [3, 2]);
  const h = await service();
  for (const held of [ELANOR_ID, undefined]) for (const sneaking of [false, true]) {
    h.player.held = held; h.player.isSneaking = sneaking;
    assert.equal(avoid.some(e => matches(e.filters, h.player)), held !== ELANOR_ID);
  }
});
await test("the lure is vanilla tempt in its own group, added only to a wild, ready Friend-state unicorn", async () => {
  const lure = entity.component_groups["lothlorien:lure"];
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
  assert.equal(entity.events["lothlorien:lure_off"], undefined, "the pause removes the lure through offer_taken");
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
    offerRefusal: () => undefined, setEventFor: () => "", healAnimal() {} });
  const other = h.entity("minecraft:player"); h.world.players.push(other);
  const sent = []; h.player.sendMessage = m => sent.push(["owner", m]); other.sendMessage = m => sent.push(["other", m]);
  mod.startUnicorns();
  const unicorn = h.entity(UNICORN_ID); unicorn.setDynamicProperty("lothlorien:owner", h.player.id);
  h.fire("entityDie", { deadEntity: unicorn }); assert.deepEqual(sent, [["owner", "unicorn.died"]]);
  sent.length = 0; h.fire("entityDie", { deadEntity: h.entity(UNICORN_ID) }); assert.deepEqual(sent, []);
});
// The ten-second offer pause is native (group lothlorien:offer_wait, written by tools/make_unicorn.py); the script only reads
// the property lothlorien:offer_ready and triggers offer_taken. The mock has no engine timer, so the entity JSON is checked as data.
await test("the offer pause is a native non-looping timer group that equals OFFER_GAP_TICKS and ends with offer_ready", async () => {
  const wait = entity.component_groups["lothlorien:offer_wait"];
  assert.deepEqual(wait, { "minecraft:timer": { time: UR.OFFER_GAP_TICKS / 20, looping: false, time_down_event: { event: "lothlorien:offer_ready", target: "self" } } });
  for (const name of Object.keys(entity.component_groups)) if (name !== "lothlorien:offer_wait" && name !== "lothlorien:state_alarmed") {
    assert.equal(entity.component_groups[name]["minecraft:timer"], undefined, `${name}: only the alarm and the pause own a timer`);
  }
  const taken = entity.events["lothlorien:offer_taken"].sequence;
  assert.equal(taken.length, 1);
  assert.deepEqual(taken[0], { filters: { test: "bool_property", domain: "lothlorien:alarmed", value: false },
    set_property: { "lothlorien:offer_ready": false }, remove: { component_groups: ["lothlorien:lure"] }, add: { component_groups: ["lothlorien:offer_wait"] } });
  const ready = entity.events["lothlorien:offer_ready"].sequence;
  assert.deepEqual(ready[0], { set_property: { "lothlorien:offer_ready": true }, remove: { component_groups: ["lothlorien:offer_wait"] } });
  assert.deepEqual(ready[1], { trigger: "lothlorien:lure_on" });
  // The alarm timer and the pause timer never share an entity: an alarm ends the pause (and frees offer_ready), the state events keep it.
  const alarm = entity.events["lothlorien:alarm"];
  assert.ok(alarm.remove.component_groups.includes("lothlorien:offer_wait")); assert.equal(alarm.set_property["lothlorien:offer_ready"], true);
  for (const n of ["calm", "l1", "l2", "l3", "friend"]) assert.ok(!entity.events[`lothlorien:set_${n}`].sequence[0].remove.component_groups.includes("lothlorien:offer_wait"), `set_${n} must not cancel the pause`);
  assert.equal(entity.description.properties["lothlorien:offer_ready"].default, true);
});
async function offerService() {
  const h = await setup();
  h.unicorn = h.entity(UNICORN_ID); h.unicorn.setProperty("lothlorien:trust", 0); h.unicorn.setProperty("lothlorien:wariness", "friend");
  const unicorn = await load("unicorn", { ...h.base, ...UR });
  unicorn.startUnicorns(); h.player.slot.item = new Item(ELANOR_ID, 5);
  h.feed = () => h.fire("playerInteractWithEntity", { player: h.player, target: h.unicorn, itemStack: h.player.slot.item.clone() });
  return h;
}
await test("an accepted offer asks the entity for the native pause; while offer_ready is false an offer is refused and costs nothing", async () => {
  const h = await offerService(); h.feed();
  assert.equal(h.player.slot.amount, 4); assert.equal(h.unicorn.getProperty("lothlorien:trust"), 1);
  assert.deepEqual(h.unicorn.events.filter(e => e.startsWith("lothlorien:offer") || e.startsWith("lothlorien:lure")), ["lothlorien:offer_taken"]);
  h.unicorn.setProperty("lothlorien:offer_ready", false); // what the entity event does
  h.advance(150); h.feed(); assert.equal(h.player.slot.amount, 4); assert.equal(h.unicorn.getProperty("lothlorien:trust"), 1);
  h.unicorn.setProperty("lothlorien:offer_ready", true); // the pause timer ran out
  h.feed(); assert.equal(h.player.slot.amount, 3); assert.equal(h.unicorn.getProperty("lothlorien:trust"), 2);
});
await test("the script keeps no pause state of its own: no timer, no last_offer property, no readiness hook", async () => {
  const h = await offerService(); const before = h.timers.size; h.feed();
  assert.equal(h.timers.size, before); assert.equal(h.unicorn.getDynamicProperty("lothlorien:last_offer"), undefined);
  assert.ok(!/watchUnicornReadiness|unicornReadiness/.test(readFileSync(new URL("../lothlorien_bp/scripts/deer.js", import.meta.url), "utf8")));
  assert.equal(UR.ticksSince, undefined); assert.equal(UR.offerWaitTicks, undefined);
});
console.log(`Passed ${cases} unicorn luring/Harmony production and filter scenarios.`);
