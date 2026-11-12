// unicorn regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import * as R from "../lothlorien_bp/scripts/deer_rules.js";
import * as UR from "../lothlorien_bp/scripts/unicorn_rules.js";

const unicornEntity = () => readJson("../lothlorien_bp/entities/unicorn.json")["minecraft:entity"];

test("unicorn: native horse float/buoyancy settings retain drowning and lava damage", () => {
  const c = unicornEntity().components;
  assert.deepEqual(c["minecraft:behavior.float"], { priority: 0, chance_per_tick_to_float: 0, time_under_water_to_dismount_passengers: 2 });
  assert.deepEqual(c["minecraft:buoyant"], { base_buoyancy: 1, apply_gravity: false, can_auto_step_from_liquid: true,
    movement_type: "bobbing", liquid_blocks: ["minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava"] });
  assert.deepEqual(c["minecraft:breathable"], { total_supply: 15, suffocate_time: 0 });
  assert.ok(c["minecraft:hurt_on_condition"].damage_conditions.some(x => x.cause === "lava" && x.damage_per_tick === 4));
  assert.equal(c["minecraft:fire_immune"], undefined);
});

test("unicorn: offers need a calm Friend, an unfrightened unicorn and a pause between offers", () => {
  const ok = { band: "friend", tame: false, ready: true };
  assert.equal(UR.offerRefusal(ok), undefined);
  assert.equal(UR.offerRefusal({ ...ok, band: "guest" }), "untrusted");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(UR.offerRefusal({ ...ok, band }), "restless", band);
  assert.equal(UR.offerRefusal({ ...ok, tame: true }), "tame");
  assert.equal(UR.offerRefusal({ ...ok, ready: false }), "wait");
});

test("unicorn: the third offer bonds it; only the owner may ride", () => {
  assert.deepEqual([0, 1, 2].map((t) => UR.nextTrust(t).bonded), [false, false, true]);
  assert.equal(UR.nextTrust(3).trust, UR.TRUST_OFFERS);
  assert.ok(UR.mayRide("a", "a") && !UR.mayRide("a", "b") && UR.mayRide(undefined, "b"));
});

test("unicorn entity: native band-tag flight in state_wild (a Guest is as timid as Uneasy; only a Friend with Elanor comes close)", () => {
  const e = unicornEntity();
  assert.ok(!("lothlorien:wariness" in e.description.properties) && !JSON.stringify(e).includes("wariness"));
  assert.deepEqual(Object.keys(e.component_groups).filter((n) => /state_(calm|l\d|friend|tame)/.test(n)), [], "the poll-era groups are gone");
  assert.ok(!Object.keys(e.events).some((n) => n.startsWith("lothlorien:set_")));
  const entries = e.component_groups["lothlorien:state_wild"]["minecraft:behavior.avoid_mob_type"].entity_types;
  const dist = (tag) => entries.filter((t) => t.filters.all_of?.some((f) => f.test === "has_tag" && f.operator !== "!=" && `"${f.value}"` === tag)).map((t) => t.max_dist);
  assert.deepEqual([dist('"lothlorien_friend"'), dist('"lothlorien_uneasy"'), dist('"lothlorien_shunned"'), dist('"lothlorien_hated"')], [[3, 2], [13, 6], [20, 10], [30, 15]]);
  assert.deepEqual(entries.filter((t) => t.filters.all_of?.some((f) => f.operator === "!=" && f.test === "has_tag")).map((t) => t.max_dist), [13, 6], "Guest: 13/6");
  assert.equal(e.component_groups["lothlorien:state_wild"]["minecraft:behavior.avoid_mob_type"].priority, 3);
  assert.equal(e.component_groups["lothlorien:state_alarmed"]["minecraft:behavior.avoid_mob_type"].entity_types[0].max_dist, 36);
  // the Elanor tempt lives in its own group (tests/unicorn_luring.mjs)
  assert.deepEqual(e.component_groups["lothlorien:lure"]["minecraft:behavior.tempt"].items, [UR.ELANOR_ID]);
  assert.ok(!("minecraft:behavior.tempt" in e.component_groups["lothlorien:state_wild"]), "the lure group alone owns tempt");
  assert.ok(e.events["lothlorien:alarm"] && e.events["lothlorien:alarm_over"]);
  assert.ok("lothlorien:alarmed" in e.description.properties && "lothlorien:tame" in e.description.properties);
});

test("unicorn entity: bonded = rideable without a saddle or lead, persistent, the best horse's stats", () => {
  const e = unicornEntity();
  const bonded = e.component_groups["lothlorien:bonded"];
  for (const c of ["minecraft:rideable", "minecraft:input_ground_controlled", "minecraft:can_power_jump", "minecraft:behavior.player_ride_tamed", "minecraft:persistent", "minecraft:variable_max_auto_step"]) {
    assert.ok(c in bonded, c);
  }
  assert.ok(!("minecraft:rideable" in e.components), "wild unicorns cannot be mounted");
  assert.equal(e.components["minecraft:healable"], undefined, "wild trust offerings retain one scripted charge/heal");
  assert.deepEqual(bonded["minecraft:healable"], { force_use: false, items: [{ item: UR.ELANOR_ID, heal_amount: 2 }] },
    "native injured-only bonded healing; no full-health forced food use");
  for (const c of ["minecraft:leashable", "minecraft:equippable", "minecraft:tamemount", "minecraft:breedable"]) assert.ok(!(c in e.components) && !(c in bonded), `${c} must be absent`);
  assert.equal(e.components["minecraft:health"].value, 30);
  assert.equal(e.components["minecraft:movement"].value, 0.3375);
  assert.equal(e.components["minecraft:horse.jump_strength"].value, 1.0);
  assert.ok(e.events["lothlorien:become_tame"].sequence[0].add.component_groups.includes("lothlorien:bonded"));
});

test("unicorn: spawn rule is uncommon and in Lothlorien; art, sounds and names are wired", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/unicorn.json")["minecraft:spawn_rules"].conditions[0];
  assert.equal(rule["minecraft:biome_filter"].value, "lothlorien");
  assert.ok(rule["minecraft:weight"].default < 10, "rarer than the deer (10)");
  const client = readJson("../lothlorien_rp/entity/unicorn.entity.json")["minecraft:client_entity"].description;
  assert.ok(existsSync(new URL(`../lothlorien_rp/${client.textures.default}.png`, import.meta.url)));
  assert.ok(readJson(`../lothlorien_rp/models/entity/unicorn.geo.json`)[client.geometry.default]);
  assert.ok(readJson("../lothlorien_rp/sounds.json").entity_sounds.entities["lothlorien:unicorn"].events.ambient);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const k of ["entity.lothlorien:unicorn.name=", "item.spawn_egg.entity.lothlorien:unicorn.name=", "action.interact.lothlorien.offer_elanor="]) assert.ok(lang.includes(k), k);
});

finish();
