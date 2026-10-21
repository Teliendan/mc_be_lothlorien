// wardens regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "../lothlorien_bp/scripts/harmony.js";
import { readdirSync } from "node:fs";
import * as WR from "../lothlorien_bp/scripts/warden_replace_rules.js";
import { parseMcstructure, PLANKS, FENCE } from "../tools/village_sim.mjs";
import * as EW from "../lothlorien_bp/scripts/elven_warden_rules.js";

const VILLAGE = "../lothlorien_bp/structures/lothlorien/village";
const villagePieces = () => readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
  parseMcstructure(readFileSync(new URL(`${VILLAGE}/${f}`, import.meta.url)), f.replace(".mcstructure", "")));
const isTree = (n) => /^(combo_|central_)/.test(n);
const wardenEntity = () => readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"];
const deck = (w, d, extra = {}) => (x, y, z) => { // a hand-made deck: planks at y 0, air at y 1..3, anything else unloaded
  if (x < 0 || z < 0 || x >= w || z >= d) return undefined;
  if (extra[`${x},${y},${z}`]) return extra[`${x},${y},${z}`];
  return y === 0 ? PLANKS : y >= 1 && y <= 3 ? "minecraft:air" : undefined;
};

test("elven warden: family has mob + irongolem (monsters hunt it, arrows get the mob group), never monster", () => {
  const fam = wardenEntity().components["minecraft:type_family"].family;
  for (const f of ["lothlorien_warden", "irongolem", "mob"]) assert.ok(fam.includes(f), f);
  assert.ok(!fam.includes("monster") && !fam.includes("player"));
});

test("elven warden: shoots monsters (spiders and creepers included), never players or other families; bow never drops, arrows do", () => {
  const c = wardenEntity().components;
  const filters = c["minecraft:behavior.nearest_attackable_target"].entity_types[0].filters.all_of;
  assert.deepEqual(filters[0], { test: "is_family", subject: "other", value: "monster" });
  const excluded = filters.slice(1).map((f) => { assert.equal(f.operator, "!="); return f.value; }).sort();
  assert.deepEqual(excluded, ["aquatic", "creaking", "enderman", "piglin", "shulker", "wither", "warden", "zombie_pigman"].sort());
  for (const keep of ["creeper", "spider", "cave_spider"]) assert.ok(!excluded.includes(keep), `${keep} stays a target`);
  const targets = c["minecraft:behavior.nearest_attackable_target"].entity_types;
  assert.equal(targets.length, 3, "monsters, Hated players, and players who hurt an elf (foe tag)");
  assert.ok(!JSON.stringify(targets[0]).includes('"player"'), "players are only targets through the tag entries");
  assert.ok(JSON.stringify(targets[1]).includes('"has_tag"') && JSON.stringify(targets[2]).includes('"has_tag"'));
  const hurt = c["minecraft:behavior.hurt_by_target"];
  assert.ok(!("alert_same_type" in hurt) && hurt.entity_types.max_dist >= 64, "alert_same_type fails to load at format 1.26.50 (content log, 1.26.52)");
  // nearby wardens join through the wolf / zombie pigman pattern: target acquired -> angry group -> broadcast_anger
  assert.equal(c["minecraft:on_target_acquired"].event, "lothlorien:become_angry");
  const e = wardenEntity();
  assert.equal(e.component_groups["lothlorien:angry"]["minecraft:angry"].broadcast_anger, true);
  assert.equal(e.component_groups["lothlorien:angry"]["minecraft:angry"].calm_event.event, "lothlorien:on_calm");
  assert.deepEqual(e.events["lothlorien:become_angry"].add.component_groups, ["lothlorien:angry"]);
  assert.deepEqual(e.events["lothlorien:on_calm"].remove.component_groups, ["lothlorien:angry"]);
  assert.equal(c["minecraft:shooter"].def, "minecraft:arrow");
  const ra = c["minecraft:behavior.ranged_attack"];
  assert.equal(ra.attack_range.max, 18); assert.ok(!("attack_radius" in ra) && !("attack_radius_min" in ra), "not in the schema at format 1.26.50: the entity fails to load"); assert.ok(ra.speed_multiplier <= 1, "closes in no faster than a skeleton"); const av = c["minecraft:behavior.avoid_mob_type"].entity_types[0]; assert.ok(av.walk_speed_multiplier > 1 && av.sprint_speed_multiplier > av.walk_speed_multiplier, "retreats faster than a chasing zombie (owner 2026-10-08)");
  assert.equal(c["minecraft:movement"].value, 0.25);
  assert.equal(c["minecraft:behavior.avoid_mob_type"].entity_types[0].max_dist, 5, "keeps monsters off (kiting)");
  assert.ok(!("set_persistent" in c["minecraft:behavior.ranged_attack"]) && !("set_persistent" in c["minecraft:behavior.nearest_attackable_target"]));
  assert.deepEqual(c["minecraft:equipment"].slot_drop_chance, [{ slot: "slot.weapon.mainhand", drop_chance: 0 }]);
  assert.ok(!c["minecraft:experience_reward"], "no XP");
  assert.equal(c["minecraft:loot"].table, "loot_tables/entities/elven_warden.json");
  const loot = readJson("../lothlorien_bp/loot_tables/entities/elven_warden.json");
  assert.deepEqual(loot.pools.flatMap((p) => p.entries.map((e) => e.name)), ["minecraft:arrow"], "arrows only, like a skeleton (0-2, looting +1)");
  const gear = JSON.stringify(readJson("../lothlorien_bp/loot_tables/entities/elven_warden_gear.json"));
  assert.ok(gear.includes('"minecraft:bow"'));
});

test("elven warden: untouched natural wardens use standard despawn; village and deliberately led guards persist", () => {
  const e = wardenEntity();
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} }, "standard rules, no filters (TECHNICAL_NOTES, Phase 10)");
  assert.ok(!e.components["minecraft:persistent"]);
  assert.deepEqual(e.components["minecraft:home"], {}, "an untouched natural guard has no home restriction");
  assert.deepEqual(e.component_groups["lothlorien:kept_warden"], { "minecraft:persistent": {} }, "leading retains the guard without a home tugging against the lead");
  const g = e.component_groups[EW.VILLAGE_GROUP];
  assert.ok(g["minecraft:persistent"] && g["minecraft:home"].restriction_radius <= 20 && g["minecraft:behavior.move_towards_home_restriction"]);
  assert.deepEqual(e.events["lothlorien:village_warden"].add.component_groups, [EW.VILLAGE_GROUP], "summon hook for tests");
  assert.equal(e.events["lothlorien:spawn_natural"].set_property["lothlorien:natural"], true);
  assert.ok(!e.events["minecraft:entity_spawned"], "nothing to set up at spawn");
  assert.deepEqual(e.description.properties["lothlorien:natural"], { type: "bool", default: false, client_sync: false });
});

test("elven warden: spawn rule has a ground and a deck condition with the weights of elven_warden_rules.js", () => {
  const r = readJson("../lothlorien_bp/spawn_rules/elven_warden.json")["minecraft:spawn_rules"];
  assert.equal(r.description.identifier, EW.WARDEN_ID);
  assert.equal(r.description.population_control, "pillager", "own surface cap: the animal cap (4 per 9x9 chunks) is full of critters");
  assert.equal(r.conditions.length, 2);
  const [ground, deck] = r.conditions;
  assert.equal(ground["minecraft:weight"].default, EW.SPAWN_WEIGHT_GROUND);
  assert.equal(deck["minecraft:weight"].default, EW.SPAWN_WEIGHT_DECK);
  assert.deepEqual([...EW.DECK_BLOCKS].sort(), [...deck["minecraft:spawns_on_block_filter"]].sort());
  for (const c of r.conditions) {
    assert.equal(c["minecraft:herd"].event, "lothlorien:spawn_natural");
    assert.equal(c["minecraft:biome_filter"].value, "lothlorien");
    assert.ok(!c["minecraft:brightness_filter"], "day and night guard");
  }
});

test("elven warden: natural spawns - always at the edge and on decks, 30 % elsewhere in the biome, none outside", () => {
  assert.equal(EW.spawnKeepChance(0, false), 0);
  assert.equal(EW.spawnKeepChance(0, true), 0, "never outside the biome");
  assert.equal(EW.spawnKeepChance(1, false), 1);
  for (const level of [1, 2, 3]) assert.equal(EW.spawnKeepChance(level, true), 1, `deck at level ${level}`);
  assert.equal(EW.spawnKeepChance(2, false), 0.3);
  assert.equal(EW.spawnKeepChance(3, false), 0.3);
  let kept = 0;
  for (let i = 0; i < 1000; i++) if (EW.keepNaturalSpawn(3, false, i / 1000)) kept++;
  assert.equal(kept, 300);
  assert.ok(EW.keepNaturalSpawn(1, false, 0.999) && !EW.keepNaturalSpawn(3, false, 0.3));
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(src.includes("EntityInitializationCause.Loaded") && src.includes('setProperty("lothlorien:natural", false)'), "judged once, not on reload");
  assert.ok(!src.includes("runInterval"), "event-driven, no polling");
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes("startElvenWardens(depthAt)"));
});

test("elven warden: friendly fire - never on wardens, own creatures, animals; players only after hitting a warden", () => {
  const v = (typeId, families = []) => ({ typeId, families });
  const ff = (victim, sinceProvokedMs, hated) => EW.isFriendlyFire({ shooterId: EW.WARDEN_ID, victim, sinceProvokedMs, hated });
  assert.ok(ff(v(EW.WARDEN_ID, ["lothlorien_warden", "irongolem", "mob"])));
  assert.ok(ff(v("lothlorien:deer", ["mob"])) && ff(v("lothlorien:unicorn")) && ff(v("lothlorien:swan")));
  assert.ok(ff(v("minecraft:cow", ["cow", "animal", "mob"])));
  assert.ok(ff(v("minecraft:player"), undefined), "unprovoked player is shielded");
  assert.ok(ff(v("minecraft:player"), EW.PROVOKE_MS + 1), "provocation expires");
  assert.ok(!ff(v("minecraft:player"), 0) && !ff(v("minecraft:player"), EW.PROVOKE_MS), "a player who hit a warden is fair game");
  assert.ok(!ff(v("minecraft:player"), undefined, true) && !ff(v("minecraft:player"), EW.PROVOKE_MS + 1, true), "a Hated player is never shielded");
  assert.ok(ff(v("minecraft:player"), undefined, false) && ff(v("lothlorien:deer"), undefined, true), "the hated flag only concerns players");
  assert.ok(!ff(v("minecraft:zombie", ["zombie", "monster", "mob"])), "monsters take arrows");
  assert.ok(!ff(v("minecraft:villager_v2", ["villager"])), "villagers in the line of fire are accepted");
  assert.ok(!EW.isFriendlyFire({ shooterId: "minecraft:skeleton", victim: v("minecraft:player"), sinceProvokedMs: undefined }), "only warden arrows");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(src.includes("beforeEvents.entityHurt") && src.includes("event.cancel = true"));
});

test("elven warden: Harmony - a fight costs 1 (first hit after 60 s), a kill 6; Hated players are shot on sight; localized name and spawn egg name", () => {
  assert.ok(EW.isNewFight(undefined) && EW.isNewFight(EW.PROVOKE_MS + 1) && !EW.isNewFight(EW.PROVOKE_MS) && !EW.isNewFight(0));
  assert.equal(H.deedCost("warden_fight"), 1);
  assert.equal(H.deedCost(H.deedKindOf(EW.WARDEN_ID)), 6);
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(/isNewFight[\s\S]*recordWardenFight\(hitter, hurtEntity\)/.test(src), "a new fight is charged");
  assert.ok(src.includes("hasTag(HATED_TAG)"), "friendly fire reads the hated tag");
  const tag = readFileSync(new URL("../lothlorien_bp/scripts/harmony_game.js", import.meta.url), "utf8").match(/HATED_TAG = "([a-z_]+)"/)[1];
  const goal = readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"].components["minecraft:behavior.nearest_attackable_target"];
  const hatedEntry = goal.entity_types.find((t) => JSON.stringify(t.filters).includes(tag));
  assert.ok(hatedEntry, "the warden targets players carrying the hated tag");
  assert.deepEqual(hatedEntry.filters.all_of.map((f) => [f.test, f.subject, f.value]), [["is_family", "other", "player"], ["has_tag", "other", tag]]);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  assert.ok(/entity\.lothlorien:elven_warden\.name=Elven Warden\r?\n/.test(lang));
  assert.ok(/item\.spawn_egg\.entity\.lothlorien:elven_warden\.name=Elven Warden Spawn Egg\r?\n/.test(lang));
});

test("elven warden: village wardens - 2 on the central tree, 1 on some nodes/towers, persistent, mortal, armed, on open deck", () => {
  const counts = {};
  for (const p of villagePieces()) {
    const w = p.entities.filter((e) => e.id === EW.WARDEN_ID);
    counts[p.name] = w.length;
    for (const e of w) {
      assert.ok(isTree(p.name), `${p.name}: wardens only on tree pieces`);
      assert.deepEqual(e.defs, [`+${EW.WARDEN_ID}`, `+${EW.VILLAGE_GROUP}`], `${p.name}: village group via the definitions list`);
      assert.equal(e.invulnerable, false, `${p.name}: mortal`);
      assert.equal(e.mainhand, EW.BOW_ID, `${p.name}: bow in hand`);
      const [x, y, z] = e.pos;
      assert.ok(x > 0 && x < p.size[0] && z > 0 && z < p.size[2] && y > 0 && y < p.size[1], `${p.name}: inside the box`);
      // feet cell: planks below, air above, open deck around, no rail or fence within 2 cells
      const [cx, cy, cz] = [Math.floor(x), Math.floor(y), Math.floor(z)];
      assert.equal(p.at(cx, cy - 1, cz), PLANKS, `${p.name}: deck under the warden`);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        assert.ok([PLANKS, "lothlorien:mallorn_heartwood_planks"].includes(p.at(cx + dx, cy - 1, cz + dz)), `${p.name}: open deck around`); // the heartwood ring round a trunk is deck
        for (const h of [0, 1, 2]) assert.ok([undefined, null, "minecraft:air"].includes(p.at(cx + dx, cy + h, cz + dz)) || /^minecraft:light_block_\d+$/.test(p.at(cx + dx, cy + h, cz + dz)), `${p.name}: headroom ${dx},${h},${dz}`); // a hidden light block is air to stand in
      }
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) assert.notEqual(p.at(cx + dx, cy, cz + dz), FENCE, `${p.name}: away from rails`);
    }
  }
  assert.equal(counts.central_mallorn_01, 2);
  const nodes = Object.entries(counts).filter(([n, c]) => n !== "central_mallorn_01" && c > 0);
  assert.ok(nodes.length >= 3 && nodes.every(([, c]) => c === 1), `1 warden on each of some node/tower pieces: ${JSON.stringify(counts)}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total >= 5, `${total} wardens across the pieces`);
});

test("elven warden: village group is applied through the structure's definitions list and exists in the entity file", () => {
  assert.ok(Object.keys(wardenEntity().component_groups).includes(EW.VILLAGE_GROUP));
  const src = readFileSync(new URL("../tools/build_village.mjs", import.meta.url), "utf8");
  assert.ok(src.includes('"+lothlorien:village_warden"') && src.includes("invulnerable: false"));
});

test("warden replace: only engine-default movement is replaced", () => {
  assert.equal(WR.needsReplacement(WR.ENGINE_MOVEMENT), true, "template entity default 0.7");
  assert.equal(WR.needsReplacement(WR.JSON_MOVEMENT), false, "JSON value 0.25");
  assert.equal(WR.needsReplacement(0.25 * 1.2), false, "speed effect stays below the threshold");
  assert.equal(WR.needsReplacement(undefined), false);
  assert.equal(WR.needsReplacement(NaN), false);
  const json = JSON.parse(readFileSync(new URL("../lothlorien_bp/entities/elven_warden.json", import.meta.url), "utf8"));
  const groups = json["minecraft:entity"].component_groups;
  assert.equal(json["minecraft:entity"].components["minecraft:movement"].value, WR.JSON_MOVEMENT);
  assert.ok(groups["lothlorien:village_warden"], "spawn event group exists");
});

finish();
