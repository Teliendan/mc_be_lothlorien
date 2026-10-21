// Production Harmony tag updates plus native filter contracts; no native AI simulation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setup, load, Item } from "./fixtures/wildlife_runtime.mjs";
import * as H from "../lothlorien_bp/scripts/harmony.js";
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
  if (filter.none_of) return !filter.none_of.some(f => matches(f, player));
  assert.equal(filter.subject, "other");
  if (filter.test === "is_family") return filter.value === "player" && player.typeId === "minecraft:player";
  if (filter.test === "has_tag") return player.hasTag(filter.value);
  if (filter.test === "has_equipment") { assert.equal(filter.domain, "hand"); return player.slot.item?.typeId === filter.value; }
  if (filter.test === "is_sneaking") return !!player.isSneaking === filter.value;
  throw Error(`unhandled filter ${filter.test}`);
}
await test("the same actual Friend+Elanor predicate selects leaders and exempts flight", async () => {
  const h = await service(); h.advance(20);
  const group = entity.component_groups["lothlorien:state_friend"], goal = group["minecraft:behavior.follow_target_leader"];
  assert.equal(group["minecraft:behavior.tempt"], undefined);
  assert.deepEqual(goal.leader_filters, { all_of: [
    { test: "is_family", subject: "other", value: "player" },
    { test: "has_tag", subject: "other", value: h.game.FRIEND_TAG },
    { test: "has_equipment", subject: "other", domain: "hand", value: ELANOR_ID },
  ] });
  const avoid = group["minecraft:behavior.avoid_mob_type"].entity_types.slice(0, 2);
  for (const entry of avoid) assert.deepEqual(entry.filters.all_of.at(-1), { none_of: [goal.leader_filters] });
  for (const p of [h.player, h.guest, h.hated]) for (const item of [ELANOR_ID, "minecraft:stick"]) for (const sneaking of [false, true]) {
    p.slot.item = new Item(item); p.isSneaking = sneaking;
    const eligible = p === h.player && item === ELANOR_ID;
    assert.equal(matches(goal.leader_filters, p), eligible);
    assert.equal(avoid.some(e => matches(e.filters, p)), !eligible);
  }
});
await test("nearer Guest with Elanor is excluded while the actual Friend remains eligible", async () => {
  const h = await service(); h.advance(20); h.player.slot.item = new Item(ELANOR_ID); h.guest.slot.item = new Item(ELANOR_ID);
  h.player.location.x = 6; h.guest.location.x = 1;
  const filter = entity.component_groups["lothlorien:state_friend"]["minecraft:behavior.follow_target_leader"].leader_filters;
  assert.deepEqual([h.guest,h.player].filter(p => matches(filter,p)).map(p => p.id), [h.player.id]);
  h.game.handleHarmonyEvent({ id: "lothlorien:harmony", message: "9" }, h.player);
  assert.equal(matches(filter,h.player), false);
});
await test("lure stays in Friend state with bounded native search and unchanged danger/ownership policies", async () => {
  const g=entity.component_groups["lothlorien:state_friend"], goal=g["minecraft:behavior.follow_target_leader"];
  assert.equal(entity.description.identifier,UNICORN_ID);
  assert.equal(goal.priority,3); assert.equal(goal.speed_multiplier,1); assert.equal(goal.follow_distance,1.5);
  assert.equal(goal.within_radius,10); assert.equal(goal.search_cooldown,20); assert.equal(goal.always_look_for_leader,true);
  for (const [name,group] of Object.entries(entity.component_groups)) {
    assert.equal(group["minecraft:behavior.tempt"],undefined);
    if (name!=="lothlorien:state_friend") assert.equal(group["minecraft:behavior.follow_target_leader"],undefined);
  }
  assert.deepEqual(g["minecraft:behavior.avoid_mob_type"].entity_types.slice(2).map(e=>[e.filters.value,e.max_dist]),[["wolf",12],["monster",8]]);
  assert.equal(entity.component_groups["lothlorien:bonded"]["minecraft:inventory"],undefined);
  assert.equal(entity.component_groups["lothlorien:bonded"]["minecraft:equippable"],undefined);
});
console.log(`Passed ${cases} unicorn luring/Harmony production and filter scenarios.`);
