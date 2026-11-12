// swan squirrel regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import * as R from "../lothlorien_bp/scripts/deer_rules.js";
import * as SR from "../lothlorien_bp/scripts/swan_rules.js";
import * as QR from "../lothlorien_bp/scripts/squirrel_rules.js";

const L = "lothlorien:lothlorien", RIVER = "minecraft:river", FOREST = "minecraft:forest";
const ACORN = "lothlorien:mallorn_acorn";
const swanEntity = () => readJson("../lothlorien_bp/entities/swan.json")["minecraft:entity"];
const squirrelEntity = () => readJson("../lothlorien_bp/entities/squirrel.json")["minecraft:entity"];

test("a swan stays when Lothlorien is near (the spot or any ring up to 48 blocks), else it is removed", () => {
  assert.equal(SR.nearOffsets().length, 1 + SR.NEAR_RADII.length * SR.NEAR_HEADINGS);
  assert.equal(SR.nearBiome(() => RIVER, L), false, "a river far from the biome");
  assert.equal(SR.nearBiome((dx, dz) => (dx === 0 && dz === 0 ? L : RIVER), L), true, "in the biome");
  assert.equal(SR.nearBiome((dx) => (dx < -30 ? L : FOREST), L), true, "biome 30 blocks west");
  assert.equal(SR.nearBiome((dx) => (dx > 70 ? L : FOREST), L), false, "biome 70 blocks east: too far");
  assert.equal(SR.nearBiome(() => undefined, L), false, "unloaded chunks are not the biome");
});

test("swan spawn rule takes Lothlorien or river water, and the natural-spawn event", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/swan.json")["minecraft:spawn_rules"];
  const c = rule.conditions[0];
  assert.deepEqual(c["minecraft:biome_filter"].any_of.map((t) => t.value).sort(), ["lothlorien", "river"]);
  assert.ok("minecraft:spawns_underwater" in c && "minecraft:spawns_on_surface" in c);
  assert.equal(c["minecraft:herd"].event, "lothlorien:spawn_natural");
  assert.equal(swanEntity().events["lothlorien:spawn_natural"].sequence[0].set_property["lothlorien:natural"], true);
  assert.ok("lothlorien:natural" in swanEntity().description.properties);
});

test("LM-01: swan and squirrel fly natively by band tag (state_wild, state_alarmed; no poll states, set events or wariness property)", () => {
  assert.deepEqual(R.WARY_TYPES, [R.DEER_ID, R.WHITE_DEER_ID, "lothlorien:swan", "lothlorien:squirrel", "lothlorien:unicorn"]);
  for (const [e, lures] of [[swanEntity(), ["minecraft:wheat", R.CORN_ID]], [squirrelEntity(), [ACORN]]]) {
    const id = e.description.identifier, g = e.component_groups;
    assert.deepEqual(Object.keys(g).filter((n) => /state_(calm|l\d|friend|tame)/.test(n)), [], `${id}: no retired groups`);
    assert.ok(!JSON.stringify(e).includes("wariness") && !Object.keys(e.events).some((n) => n.startsWith("lothlorien:set_")), id);
    const tagged = (grp) => grp["minecraft:behavior.avoid_mob_type"].entity_types.filter((t) => JSON.stringify(t.filters).includes("lothlorien_")).length;
    assert.equal(tagged(g["lothlorien:state_wild"]), 10, id);
    assert.equal(g["lothlorien:state_alarmed"]["minecraft:behavior.avoid_mob_type"].entity_types[0].max_dist, 36, id);
    const tempt = g["lothlorien:state_wild"]["minecraft:behavior.tempt"];
    assert.deepEqual([tempt.priority, tempt.items, tempt.within_radius, tempt.can_get_scared], [4, lures, 10, false], id);
    const over = e.events["lothlorien:alarm_over"];
    assert.deepEqual([over.set_property["lothlorien:alarmed"], over.add.component_groups, over.remove.component_groups], [false, ["lothlorien:state_wild"], ["lothlorien:state_wild", "lothlorien:state_alarmed"]], id);
    assert.equal(e.events["lothlorien:alarm"].add.component_groups[0], "lothlorien:state_alarmed");
    assert.equal(g["lothlorien:state_alarmed"]["minecraft:timer"].time_down_event.event, "lothlorien:alarm_over");
    assert.ok(e.description.properties["lothlorien:alarmed"]);
    const adds = (ev) => JSON.stringify(ev).includes("lothlorien:state_wild");
    assert.ok(adds(e.events["minecraft:entity_spawned"]), `${id}: a spawn is wild`);
  }
  const swan = swanEntity().events;
  assert.ok(adds2(swan["lothlorien:spawn_natural"]) && adds2(swan["minecraft:entity_born"]), "swan: natural spawns and cygnets are wild");
  // a swan lure exemption is one flat `!=` test per item (no nested none_of)
  const swanFriend = swanEntity().component_groups["lothlorien:state_wild"]["minecraft:behavior.avoid_mob_type"].entity_types[0].filters.all_of;
  assert.equal(swanFriend.filter((f) => f.test === "has_equipment" && f.operator === "!=").length, 2);
  assert.ok(!JSON.stringify(swanEntity().component_groups["lothlorien:state_wild"]).includes("none_of"));
});
function adds2(ev) { return JSON.stringify(ev).includes("lothlorien:state_wild"); }

test("swan floats on the surface like the chicken (float goal, path over water; no fish-style swimming) and drops a feather", () => {
  const e = swanEntity();
  assert.ok("minecraft:behavior.float" in e.components, "float goal keeps it on the surface");
  assert.equal(e.components["minecraft:navigation.walk"].can_path_over_water, true);
  assert.ok(!("minecraft:buoyant" in e.components), "buoyant sank the swan to the bottom (game log: simulate_waves not valid; 2026-10-02)");
  for (const k of ["minecraft:behavior.random_swim", "minecraft:navigation.generic", "minecraft:movement.amphibious"]) assert.ok(!(k in e.components), `${k} makes it dive`);
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} });
  const loot = readJson("../lothlorien_bp/loot_tables/entities/swan.json").pools[0].entries.map((x) => x.name);
  assert.deepEqual(loot, ["minecraft:feather"]);
});

test("squirrel gifts are for Friends only; calm and restless players are refused", () => {
  assert.equal(QR.offerRefusal({ band: "friend", cooldownLeft: 0 }), undefined);
  assert.equal(QR.offerRefusal({ band: "guest", cooldownLeft: 0 }), "untrusted");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(QR.offerRefusal({ band, cooldownLeft: 0 }), "restless", band);
  assert.equal(QR.offerRefusal({ band: "friend", cooldownLeft: 100 }), "full");
  assert.equal(QR.cooldownLeft(100, 160), 60);
  assert.equal(QR.cooldownLeft(200, 160), 0);
  assert.equal(QR.cooldownLeft(100, undefined), 0);
});

test("squirrel errand: away point, phases, abort", () => {
  const from = { x: 0, y: 64, z: 0 };
  const open = QR.pickAway(from, (x, z, y) => y, 0);
  assert.ok(Math.abs(Math.hypot(open.x, open.z) - 14) < 1e-6, "farthest distance first");
  assert.equal(QR.pickAway(from, () => undefined, 1), undefined);
  const east = QR.pickAway(from, (x) => (x > 0 ? 70 : undefined), Math.PI); // west fails, a later heading works
  assert.ok(east.x > 0 && east.y === 70);
  const p = (o) => QR.nextPhase({ phase: "away", age: 10, phaseAge: 10, toBeacon: 10, toPlayer: 10, digFor: 80, ...o });
  assert.equal(p({}), "away");
  assert.equal(p({ toBeacon: QR.AWAY_ARRIVE }), "dig");
  assert.equal(p({ phaseAge: QR.AWAY_TIMEOUT }), "dig", "never gets there: digs where it is");
  assert.equal(p({ phase: "dig", phaseAge: 79 }), "dig");
  assert.equal(p({ phase: "dig", phaseAge: 80 }), "return");
  assert.equal(p({ phase: "return" }), "return");
  assert.equal(p({ phase: "return", toPlayer: QR.GIFT_DIST }), "gift");
  assert.equal(p({ toPlayer: QR.ABORT_DIST + 1 }), "abort");
  assert.equal(p({ phase: "return", age: QR.MAX_TICKS + 1 }), "abort");
  assert.ok(QR.digTicks(0) === QR.DIG_TICKS.min && QR.digTicks(0.999) === QR.DIG_TICKS.max);
});

test("squirrel entity: errand group follows the beacon, wolves and monsters still scare it, three coats", () => {
  const e = squirrelEntity();
  const g = e.component_groups["lothlorien:state_guiding"];
  assert.equal(g["minecraft:behavior.follow_target_leader"].leader_filters.value, "lothlorien_guide_beacon");
  assert.ok(g["minecraft:behavior.follow_target_leader"].priority < g["minecraft:behavior.avoid_mob_type"].priority);
  assert.ok(g["minecraft:behavior.avoid_mob_type"].entity_types.every((t) => ["wolf", "monster"].includes(t.filters.value)));
  for (const ev of ["lothlorien:guide_start", "lothlorien:guide_end", "lothlorien:guide_abort"]) assert.ok(e.events[ev], ev);
  assert.ok(e.component_groups["lothlorien:state_wild"]["minecraft:behavior.tempt"].items.includes(ACORN));
  const coats = e.description.properties["lothlorien:coat"].values;
  const client = readJson("../lothlorien_rp/entity/squirrel.entity.json")["minecraft:client_entity"].description;
  assert.deepEqual(Object.keys(client.textures).sort(), [...coats].sort());
  for (const t of Object.values(client.textures)) assert.ok(existsSync(new URL(`../lothlorien_rp/${t}.png`, import.meta.url)), t);
  assert.equal(e.components["minecraft:interact"].interactions[0].on_interact.filters.all_of[1].value, ACORN);
});

test("squirrel gift table has litter, petals, athelas and corn seeds, and every item exists in the pack", () => {
  const entries = readJson("../lothlorien_bp/loot_tables/gifts/squirrel.json").pools[0].entries;
  const ids = entries.map((x) => x.name);
  for (const want of ["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom", "lothlorien:athelas", "lothlorien:western_corn_seeds"]) assert.ok(ids.includes(want), want);
  for (const id of ids) assert.ok(existsSync(new URL(`../lothlorien_bp/items/${id.split(":")[1]}.json`, import.meta.url)), `item ${id}`);
  const weight = (n) => entries.find((x) => x.name === n).weight;
  assert.ok(weight("lothlorien:athelas") < weight("lothlorien:mallorn_blossom"), "athelas is rarer than petals");
  assert.equal(QR.GIFT_TABLE, "gifts/squirrel");
});

test("art, sounds and names are wired for both animals", () => {
  const sounds = readJson("../lothlorien_rp/sounds.json").entity_sounds.entities;
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const n of ["swan", "squirrel"]) {
    assert.ok(sounds[`lothlorien:${n}`].events.ambient, `${n} sounds`);
    assert.ok(lang.includes(`entity.lothlorien:${n}.name=`) && lang.includes(`item.spawn_egg.entity.lothlorien:${n}.name=`), `${n} lang`);
    assert.ok(existsSync(new URL(`../lothlorien_rp/models/entity/${n}.geo.json`, import.meta.url)), `${n} geometry`);
  }
});

finish();
