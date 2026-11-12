// deer regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import * as R from "../lothlorien_bp/scripts/deer_rules.js";

const deerEntity = () => readJson("../lothlorien_bp/entities/deer.json")["minecraft:entity"];
const G = (e, name) => e.component_groups[`lothlorien:${name}`];
const events = (ev) => [ev, ...(ev.sequence ?? [])];
const bandTagEntries = (group) => group["minecraft:behavior.avoid_mob_type"].entity_types.filter((t) => JSON.stringify(t.filters).includes("lothlorien_"));

test("deer: native band-tag flight - state_wild, state_tame and state_alarmed replace the five wariness groups, set events and property", () => {
  const e = deerEntity();
  assert.deepEqual(Object.keys(e.component_groups).filter((n) => n.includes("state_")), ["lothlorien:state_wild", "lothlorien:state_tame", "lothlorien:state_alarmed"]);
  assert.ok(!("lothlorien:wariness" in e.description.properties));
  assert.ok(!Object.keys(e.events).some((n) => n.startsWith("lothlorien:set_")));
  assert.ok(!JSON.stringify(e).includes("wariness"));
  // wild: ten band entries (five bands x walking/sneaking); tame: Uneasy, Shunned, Hated only; alarmed: no tag at all
  assert.equal(bandTagEntries(G(e, "state_wild")).length, 10);
  assert.equal(bandTagEntries(G(e, "state_tame")).length, 6);
  assert.equal(bandTagEntries(G(e, "state_alarmed")).length, 0);
  for (const name of ["state_wild", "state_tame", "state_alarmed"]) assert.equal(G(e, name)["minecraft:behavior.avoid_mob_type"].priority, 3, name);
});

test("deer: the lure is native tempt in wild and tame, below flight (4 > 3); the alarm hands back through alarm_over", () => {
  const e = deerEntity();
  for (const name of ["state_wild", "state_tame"]) {
    const t = G(e, name)["minecraft:behavior.tempt"];
    assert.deepEqual([t.priority, t.items, t.within_radius, t.can_get_scared], [4, [R.CORN_ID], 10, false], name);
  }
  assert.ok(!G(e, "state_alarmed")["minecraft:behavior.tempt"]);
  assert.equal(G(e, "state_alarmed")["minecraft:timer"].time_down_event.event, "lothlorien:alarm_over");
  const over = e.events["lothlorien:alarm_over"].sequence;
  assert.deepEqual(over.map((s) => s.add?.component_groups?.[0]), [undefined, "lothlorien:state_wild", "lothlorien:state_tame"]);
  assert.deepEqual(over.map((s) => s.filters?.value), [undefined, false, true], "wild unless tame");
  assert.deepEqual(over[0].remove.component_groups, ["lothlorien:state_wild", "lothlorien:state_tame", "lothlorien:state_alarmed"]);
  assert.equal(over[0].set_property["lothlorien:alarmed"], false);
  const alarm = e.events["lothlorien:alarm"];
  assert.deepEqual([alarm.set_property["lothlorien:alarmed"], alarm.add.component_groups], [true, ["lothlorien:state_alarmed"]]);
  assert.deepEqual(alarm.remove.component_groups, ["lothlorien:state_wild", "lothlorien:state_tame", "lothlorien:state_alarmed"]);
  const tame = e.events["lothlorien:become_tame"].sequence;
  assert.deepEqual([tame[1].filters.domain, tame[1].filters.value, tame[1].remove.component_groups, tame[1].add.component_groups],
    ["lothlorien:alarmed", false, ["lothlorien:state_wild"], ["lothlorien:state_tame"]], "an alarmed deer stays alarmed until alarm_over");
});

test("deer: every way in adds state_wild (spawn, summon, birth); nothing else adds it but the alarm and tame events", () => {
  const e = deerEntity();
  for (const name of ["minecraft:entity_spawned", "minecraft:entity_born"]) {
    assert.ok(events(e.events[name]).some((s) => s.add?.component_groups?.includes("lothlorien:state_wild")), name);
  }
  for (const [name, ev] of Object.entries(e.events)) {
    if (!["minecraft:entity_spawned", "minecraft:entity_born", "lothlorien:alarm_over"].includes(name)) assert.ok(!events(ev).some((s) => s.add?.component_groups?.includes("lothlorien:state_wild")), name);
  }
});

test("deer: bucks drop antlers, does do not; babies drop nothing", () => {
  const e = deerEntity();
  assert.equal(e.component_groups["lothlorien:adult_buck"]["minecraft:loot"].table, "loot_tables/entities/deer_buck.json");
  assert.equal(e.component_groups["lothlorien:adult_doe"]["minecraft:loot"].table, "loot_tables/entities/deer.json");
  assert.ok(!e.component_groups["lothlorien:baby"]["minecraft:loot"]);
  assert.ok(!e.components["minecraft:loot"]);
  const names = (t) => readJson(`../lothlorien_bp/${t}`).pools.flatMap((p) => p.entries.map((x) => x.name));
  assert.ok(!names("loot_tables/entities/deer.json").includes("lothlorien:deer_antler"));
  assert.ok(names("loot_tables/entities/deer_buck.json").includes("lothlorien:deer_antler"));
});

test("deer: biome-only spawn rule with density limit, standard despawn, not persistent", () => {
  const rules = readJson("../lothlorien_bp/spawn_rules/deer.json")["minecraft:spawn_rules"];
  assert.equal(rules.description.identifier, R.DEER_ID);
  for (const c of rules.conditions) {
    assert.equal(c["minecraft:biome_filter"].value, "lothlorien");
    assert.ok(c["minecraft:density_limit"].surface > 0);
  }
  const comps = deerEntity().components;
  assert.deepEqual(comps["minecraft:despawn"], { despawn_from_distance: {} });
  assert.ok(!comps["minecraft:persistent"]);
});

finish();
