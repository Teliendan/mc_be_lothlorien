// elves regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson, catalogEntries } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { B } from "../tools/flet_mallorn.mjs";
import { existsSync } from "node:fs";
import * as WR from "../lothlorien_bp/scripts/warden_replace_rules.js";
import { rotated, PLANKS, FENCE } from "../tools/village_sim.mjs";
import * as EL from "../lothlorien_bp/scripts/elf_rules.js";
import * as EW from "../lothlorien_bp/scripts/elven_warden_rules.js";

const elfEntity = () => readJson("../lothlorien_bp/entities/elf.json")["minecraft:entity"];
const GROUP = (p) => `lothlorien:${p}`;
const GROUP_NAMES = (g) => Object.keys(g);
const deck = (w, d, extra = {}) => (x, y, z) => { // a hand-made deck: planks at y 0, air at y 1..3, anything else unloaded
  if (x < 0 || z < 0 || x >= w || z >= d) return undefined;
  if (extra[`${x},${y},${z}`]) return extra[`${x},${y},${z}`];
  return y === 0 ? PLANKS : y >= 1 && y <= 3 ? "minecraft:air" : undefined;
};

test("elf: entity values come from elf_rules STATS / HOME_RADIUS; persistent, no despawn, no spawn rule, exact families", () => {
  const e = elfEntity(), c = e.components;
  assert.equal(e.description.identifier, EL.ELF_ID);
  assert.equal(e.description.is_spawnable, true); assert.equal(e.description.is_summonable, true);
  assert.deepEqual(c["minecraft:type_family"].family, [EL.ELF_FAMILY, "wandering_trader", "mob"]);
  assert.deepEqual(c["minecraft:health"], { value: EL.STATS.health, max: EL.STATS.health });
  assert.equal(c["minecraft:movement"].value, EL.STATS.movement);
  assert.ok(EL.STATS.movement < WR.WRONG_MOVEMENT_ABOVE, "the elf is never mistaken for a template mob with engine-default attributes");
  assert.deepEqual(c["minecraft:collision_box"], { width: 0.6, height: 1.95 });
  assert.ok(c["minecraft:persistent"] && c["minecraft:nameable"], "persistent and nameable");
  assert.ok(!("minecraft:despawn" in c) && !Object.values(e.component_groups).some((g) => "minecraft:despawn" in g), "never despawns");
  assert.equal(existsSync(new URL("../lothlorien_bp/spawn_rules/elf.json", import.meta.url)), false, "no natural spawn");
  assert.deepEqual(c["minecraft:behavior.panic"], { priority: 1, speed_multiplier: EL.STATS.panic });
  const avoid = c["minecraft:behavior.avoid_mob_type"].entity_types[0];
  assert.deepEqual([avoid.max_dist, avoid.walk_speed_multiplier, avoid.sprint_speed_multiplier], [EL.STATS.avoidDist, EL.STATS.avoidWalk, EL.STATS.avoidSprint]);
  assert.deepEqual(avoid.filters.all_of.map((f) => [f.test, f.value, f.operator ?? "="]), [["is_family", "monster", "="], ["is_family", "enderman", "!="]]);
  assert.equal(c["minecraft:behavior.move_towards_home_restriction"].speed_multiplier, EL.STATS.home);
  assert.equal(c["minecraft:behavior.random_stroll"].speed_multiplier, EL.STATS.stroll);
  assert.deepEqual([c["minecraft:behavior.random_stroll"].xz_dist, c["minecraft:behavior.random_stroll"].y_dist], [EL.STROLL.xz, EL.STROLL.y], "base stroll from STROLL");
  assert.equal(c["minecraft:behavior.look_at_player"].look_distance, EL.STATS.lookDistance);
  assert.deepEqual(c["minecraft:home"], {}, "base home is empty (restriction none); the radius comes from the radius groups, so a lead can take it away");
  assert.ok(!Object.values(e.component_groups).some((g) => GROUP_NAMES(g).includes("minecraft:variant") && "minecraft:home" in g), "a profession group carries no home radius");
  const nav = c["minecraft:navigation.walk"];
  assert.deepEqual(nav.blocks_to_avoid.map((b) => b.name), ["lothlorien:elven_rope", "lothlorien:elven_rope_hanging"], "avoids the rope cells");
  assert.deepEqual(c["minecraft:damage_sensor"].triggers, [{ cause: "fall", deals_damage: "no" }], "no fall damage");
});

test("elf: native shops and profession dialogs only; no inventory, breeding, riding, egg interaction, loot or xp", () => {
  const text = JSON.stringify(elfEntity());
  const found = [...text.matchAll(/"minecraft:(economy_trade_table|trade_table|interact|inventory|breedable|rideable|spawn_egg_interaction|loot|experience_reward|equippable|behavior\.(?:breed|trade_with_player|tempt|follow_parent|ranged_attack|melee_attack))"/g)].map((m) => m[1]);
  assert.equal(found.filter((k) => k === "interact").length, EL.PROFESSIONS.length, "Speak / Hand over once per profession group");
  assert.equal(found.filter((k) => k === "economy_trade_table").length, 36, "four shops with nine tables each");
  assert.equal(found.filter((k) => k === "behavior.trade_with_player").length, 1, "native trading movement goal");
  assert.ok(found.every((k) => ["interact", "economy_trade_table", "behavior.trade_with_player"].includes(k)));
  const e = elfEntity();
  assert.ok(!e.components["minecraft:economy_trade_table"], "no default shop before table selection");
  for (const [key, group] of Object.entries(e.component_groups)) {
    if ("minecraft:economy_trade_table" in group) assert.ok(key.startsWith("lothlorien:trade_"), "trade tables only in generated groups");
  }
  assert.deepEqual(Object.keys(e.component_groups["lothlorien:loremaster"]), ["minecraft:variant", "minecraft:interact"], "only in the Loremaster group");
  const inter = e.component_groups["lothlorien:loremaster"]["minecraft:interact"].interactions;
  assert.equal(inter.length, 1);
  assert.equal(inter[0].use_item, false); assert.equal(inter[0].swing, true); assert.equal(inter[0].interact_text, "action.interact.lothlorien.speak");
  assert.equal(inter[0].on_interact.event, undefined, "no event: the dialog is script (loremaster.js)");
  const none = JSON.stringify(inter[0].on_interact.filters.all_of.find((f) => f.none_of));
  assert.ok(none.includes("minecraft:lead") && none.includes("minecraft:name_tag"), "leads and name tags keep working on him");
});

test("elf: every profession group has its variant index and its interact entry; radius groups carry the home radius; each as_<p> event swaps professions and radius", () => {
  const e = elfEntity();
  assert.deepEqual(Object.keys(e.component_groups).filter((key) => !key.startsWith("lothlorien:trade_")), [...EL.PROFESSIONS.map(GROUP), ...EL.RADIUS_GROUPS]);
  EL.PROFESSIONS.forEach((p, i) => {
    const g = e.component_groups[GROUP(p)];
    assert.deepEqual(Object.keys(g), ["minecraft:variant", "minecraft:interact"], `${p}: the Loremaster speaks, traders take deliveries (interact; details in tests/renown.mjs)`);
    assert.equal(g["minecraft:variant"].value, i, `${p}: variant index`);
    const ev = e.events[EL.spawnEventOf(p)], own = EL.radiusGroupOf(p);
    assert.deepEqual(ev.add.component_groups, [GROUP(p), own], `${p}: adds the profession and its radius group`);
    assert.deepEqual([...ev.remove.component_groups].sort(), [...EL.PROFESSIONS.filter((q) => q !== p).map(GROUP), ...EL.RADIUS_GROUPS.filter((r) => r !== own)].sort(), `${p}: removes the other four professions and the other radius groups`);
  });
  const home = (r) => ({ restriction_type: "random_movement", restriction_radius: r });
  const mark = (g) => ({ "minecraft:mark_variant": { value: EL.RADIUS_MARK[g] } });
  assert.deepEqual(e.component_groups[EL.HOME_NEAR_GROUP], { "minecraft:home": home(EL.HOME_RADIUS.near), ...mark(EL.HOME_NEAR_GROUP) }, "home_near: radius + debug marker, the stroll stays the base one");
  assert.deepEqual(e.component_groups[EL.HOME_LORE_GROUP], { "minecraft:home": home(EL.HOME_RADIUS.loremaster), ...mark(EL.HOME_LORE_GROUP) });
  const sp = e.events["minecraft:entity_spawned"];
  assert.equal(sp.randomize.length, EL.PROFESSIONS.length);
  assert.deepEqual(sp.randomize.map((r) => r.add.component_groups), EL.PROFESSIONS.map((p) => [GROUP(p), EL.radiusGroupOf(p)]), "one egg: random profession with its radius group");
  assert.deepEqual(sp.filters, { test: "has_component", operator: "!=", value: "minecraft:variant" }, "a spawn event that set the profession is not overridden");
  const radii = Object.values(EL.HOME_RADIUS).filter((r) => r !== EL.HOME_RADIUS.healerDay);
  assert.ok(Math.max(...radii) <= 10 && EL.HOME_RADIUS.loremaster < EL.HOME_RADIUS.near, "every radius but the healer's day roam stays around the own tree (bridges are 7..15 long)");
  assert.equal(EL.HOME_RADIUS.healerDay, 64);
});

test("elf healer: day group roams HOME_RADIUS.healerDay and flips to night at dusk, night group stays near and flips back at dawn; sensors only in their own group", () => {
  const e = elfEntity(), day = e.component_groups[EL.HEALER_DAY_GROUP], night = e.component_groups[EL.HEALER_NIGHT_GROUP];
  assert.equal(day["minecraft:home"].restriction_radius, EL.HOME_RADIUS.healerDay); assert.equal(night["minecraft:home"].restriction_radius, EL.HOME_RADIUS.healerNight);
  const trig = (g) => g["minecraft:environment_sensor"].triggers;
  assert.equal(trig(day).length, 1); assert.equal(trig(day)[0].event, EL.HEALER_DUSK_EVENT); assert.equal(trig(day)[0].filters.test, "is_daytime"); assert.equal(trig(day)[0].filters.value, false);
  assert.equal(trig(night).length, 1); assert.equal(trig(night)[0].event, EL.HEALER_DAWN_EVENT); assert.equal(trig(night)[0].filters.value, true);
  assert.ok(!("minecraft:environment_sensor" in e.components), "no sensor in the base components: it would fire every tick for every profession");
  assert.deepEqual(e.events[EL.HEALER_DUSK_EVENT], { remove: { component_groups: [EL.HEALER_DAY_GROUP] }, add: { component_groups: [EL.HEALER_NIGHT_GROUP] } });
  assert.deepEqual(e.events[EL.HEALER_DAWN_EVENT], { remove: { component_groups: [EL.HEALER_NIGHT_GROUP] }, add: { component_groups: [EL.HEALER_DAY_GROUP] } });
  assert.equal(EL.radiusGroupOf("healer"), EL.HEALER_DAY_GROUP);
});

test("elf healer roam: by day a far stroll and a long path reach cross bridges; from dusk the base stroll, the reach stays for the walk home; radius markers", () => {
  // owner 2026-10-10: "healers seem to stay on their platform" with radius 64 and the base 8 / 3 stroll (the radius is a fence, the stroll the drive)
  const e = elfEntity(), base = e.components["minecraft:behavior.random_stroll"], day = e.component_groups[EL.HEALER_DAY_GROUP], night = e.component_groups[EL.HEALER_NIGHT_GROUP];
  const stroll = (xz, y) => ({ ...base, xz_dist: xz, y_dist: y });
  assert.deepEqual(day["minecraft:behavior.random_stroll"], stroll(EL.HEALER_ROAM.xz, EL.HEALER_ROAM.y), "day: same priority and speed as the base stroll, far targets");
  assert.deepEqual(night["minecraft:behavior.random_stroll"], stroll(EL.STROLL.xz, EL.STROLL.y), "night: the base stroll, explicit (whether a removed group gives the base one back is not relied on)");
  for (const g of [day, night]) assert.deepEqual(g["minecraft:follow_range"], { value: EL.HEALER_ROAM.followRange, max: EL.HEALER_ROAM.followRange });
  assert.ok(EL.HEALER_ROAM.xz >= 2 * 15 && EL.HEALER_ROAM.xz <= EL.HOME_RADIUS.healerDay, "one day stroll can reach past the longest bridge (15), inside the day radius");
  assert.ok(EL.HEALER_ROAM.y >= 3 && EL.HEALER_ROAM.y < 6, "y covers a rise-2 arch, stays below the crowns (6 above the deck) and far above nothing (decks 16 up)");
  assert.ok(EL.HEALER_ROAM.followRange >= EL.HOME_RADIUS.healerDay, "the dusk walk home starts up to the day radius away");
  for (const [name, g] of Object.entries(e.component_groups)) {
    if (name === EL.HEALER_DAY_GROUP || name === EL.HEALER_NIGHT_GROUP) continue;
    assert.ok(!("minecraft:behavior.random_stroll" in g) && !("minecraft:follow_range" in g), `${name}: other professions keep the base stroll and reach`);
  }
  assert.ok(!("minecraft:follow_range" in e.components), "base reach is the engine default");
  // debug marker: every radius group, unique values, nothing else carries one; script maps it back
  const marks = EL.RADIUS_GROUPS.map((g) => e.component_groups[g]["minecraft:mark_variant"]?.value);
  assert.deepEqual(marks, EL.RADIUS_GROUPS.map((g) => EL.RADIUS_MARK[g])); assert.equal(new Set(marks).size, marks.length);
  assert.ok(!("minecraft:mark_variant" in e.components) && EL.PROFESSIONS.every((p) => !("minecraft:mark_variant" in e.component_groups[GROUP(p)])));
  assert.deepEqual(EL.radiusGroupOfMark(3), { group: "healer_day", radius: 64 }); assert.deepEqual(EL.radiusGroupOfMark(4), { group: "healer_night", radius: EL.HOME_RADIUS.healerNight });
  assert.equal(EL.radiusGroupOfMark(undefined), null); assert.equal(EL.radiusGroupOfMark(0), null);
  for (const f of ["entity/elf.entity.json", "render_controllers/elf.render_controllers.json"]) assert.ok(!/mark_variant/.test(readFileSync(new URL(`../lothlorien_rp/${f}`, import.meta.url), "utf8")), `${f}: the client does not use the marker`);
});

test("elf lead: leashable fields come from LEASH; a lead takes the radius away; any release sets the home where the elf stands and gives the radius back per profession", () => {
  const e = elfEntity(), l = e.components["minecraft:leashable"];
  assert.deepEqual(l.presets, [{ soft_distance: EL.LEASH.soft, hard_distance: EL.LEASH.hard, max_distance: EL.LEASH.max }]);
  assert.deepEqual(l.on_leash, { event: EL.LEASHED_EVENT, target: "self" }); assert.deepEqual(l.on_unleash, { event: EL.REHOME_EVENT, target: "self" });
  assert.equal(l.on_unleash_interact_only, undefined, "default false: untie, cut and break by distance all re-home");
  assert.equal(l.can_be_stolen, false);
  assert.deepEqual(e.events[EL.LEASHED_EVENT], { remove: { component_groups: EL.RADIUS_GROUPS } }, "leashed: no radius at all, move_towards_home has nothing to enforce");
  const seq = e.events[EL.REHOME_EVENT].sequence;
  assert.ok(seq[0].set_home_position && seq.at(-1).set_home_position, "set_home_position first and again last");
  assert.deepEqual(seq[0].remove.component_groups, EL.RADIUS_GROUPS, "a rehome without a lead starts clean");
  // walk the sequence for each variant: which radius groups end up added
  const passes = (f, v) => (f.all_of ? f.all_of.every((x) => passes(x, v)) : f.operator === "!=" ? v !== f.value : v === f.value);
  EL.PROFESSIONS.forEach((p, v) => {
    const added = seq.filter((s) => s.add && (!s.filters || passes(s.filters, v))).flatMap((s) => s.add.component_groups);
    assert.deepEqual(added, [EL.radiusGroupOf(p)], `${p}: re-homed with its own radius group`);
  });
});

test("elf geometry: no visible coplanar same-facing faces (accessory cubes are inflated off the body)", () => {
  const geo = readJson("../lothlorien_rp/models/entity/elf.geo.json")["minecraft:geometry"];
  assert.equal(geo.length, EL.PROFESSIONS.length);
  for (const g of geo) {
    const bones = Object.fromEntries(g.bones.map((b) => [b.name, b]));
    const rotated = (n) => { for (; n; n = bones[n].parent) if ((bones[n].rotation ?? [0, 0, 0]).some(Boolean)) return true; return false; };
    const boxes = [];
    for (const b of g.bones) b.cubes?.forEach((c, i) => {
      if (rotated(b.name) || (c.rotation ?? [0, 0, 0]).some(Boolean)) return;
      const f = c.inflate ?? 0;
      boxes.push({ n: `${b.name}#${i}`, lo: c.origin.map((v) => v - f), hi: c.origin.map((v, k) => v + c.size[k] + f) });
    });
    const inside = (pt, a, b) => boxes.some((q) => q !== a && q !== b && [0, 1, 2].every((k) => q.lo[k] < pt[k] && pt[k] < q.hi[k]));
    const hits = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) for (let ax = 0; ax < 3; ax++) for (const side of [0, 1]) {
      const A = boxes[i], B = boxes[j], pa = (side ? A.hi : A.lo)[ax], pb = (side ? B.hi : B.lo)[ax];
      if (Math.abs(pa - pb) > 1e-6) continue;
      const ks = [0, 1, 2].filter((k) => k !== ax), o = ks.map((k) => [Math.max(A.lo[k], B.lo[k]), Math.min(A.hi[k], B.hi[k])]);
      if (o.some(([a, b]) => b - a <= 1e-6)) continue;
      let vis = 0;
      for (let u = 0; u < 8; u++) for (let v = 0; v < 8; v++) {
        const pt = [0, 0, 0]; pt[ax] = pa + (side ? 0.01 : -0.01);
        pt[ks[0]] = o[0][0] + (u + 0.5) * (o[0][1] - o[0][0]) / 8; pt[ks[1]] = o[1][0] + (v + 0.5) * (o[1][1] - o[1][0]) / 8;
        if (!inside(pt, A, B)) vis++;
      }
      // head / hat bottom (y- at 24) is exempt: make_elves.py paint_cap leaves the cap's bottom face transparent on purpose, so it never draws
      if (vis && !(ax === 1 && side === 0 && [A.n, B.n].sort().join() === "hat#0,head#0")) hits.push(`${"xyz"[ax]}${side ? "+" : "-"} ${A.n}/${B.n}`);
    }
    assert.deepEqual(hits, [], `${g.description.identifier}: z-fighting faces`);
  }
});

test("elf: client entity and render controller are in step with the professions (index = minecraft:variant); post entities are registered on both sides", () => {
  const d = readJson("../lothlorien_rp/entity/elf.entity.json")["minecraft:client_entity"].description;
  assert.deepEqual(Object.keys(d.geometry), EL.PROFESSIONS); assert.deepEqual(Object.keys(d.textures), EL.PROFESSIONS);
  const rc = readJson("../lothlorien_rp/render_controllers/elf.render_controllers.json").render_controllers["controller.render.lothlorien.elf"];
  assert.deepEqual(rc.arrays.geometries["Array.geos"], EL.PROFESSIONS.map((p) => `Geometry.${p}`));
  assert.deepEqual(rc.arrays.textures["Array.skins"], EL.PROFESSIONS.map((p) => `Texture.${p}`));
  const py = readFileSync(new URL("../tools/make_elves.py", import.meta.url), "utf8").match(/^PROFESSIONS = (\[.*?\])/m)[1];
  assert.deepEqual(JSON.parse(py), EL.PROFESSIONS, "tools/make_elves.py PROFESSIONS");
  const post = readJson("../lothlorien_bp/entities/elf_post.json")["minecraft:entity"];
  assert.equal(post.description.identifier, EL.POST_ID); assert.equal(post.description.is_spawnable, false);
  assert.ok(!("minecraft:type_family" in post.components), "the family comes with the kind group");
  assert.deepEqual(Object.keys(post.component_groups), EL.POST_KINDS.map((k) => `${EL.POST_GROUP_PREFIX}${k}`));
  for (const k of EL.POST_KINDS) assert.deepEqual(post.component_groups[`${EL.POST_GROUP_PREFIX}${k}`]["minecraft:type_family"].family, ["lothlorien_elf_post", `elf_post_${k}`, "inanimate"]);
  assert.equal(readJson("../lothlorien_rp/entity/elf_post.entity.json")["minecraft:client_entity"].description.identifier, EL.POST_ID);
});

test("elf: names are lang-only (no name tag), entity and egg names exist in every locale", () => {
  const entries = catalogEntries();
  for (const k of ["entity.lothlorien:elf.name", "item.spawn_egg.entity.lothlorien:elf.name", ...EL.PROFESSIONS.map((p) => `lothlorien.elf.profession.${p}`)]) {
    assert.ok(entries[k], k); assert.equal(Object.keys(entries[k].translations).length, 8, `${k}: eight target locales`);
  }
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  assert.ok(/entity\.lothlorien:elf\.name=Elf\r?\n/.test(lang)); assert.ok(/item\.spawn_egg\.entity\.lothlorien:elf\.name=Elf Spawn Egg\r?\n/.test(lang));
  assert.ok(!/nameTag/.test(readFileSync(new URL("../lothlorien_bp/scripts/elf_village.js", import.meta.url), "utf8")), "the village spawns no name tags");
});

test("elf: wardens defend elves - the foe tag is a target and is not shielded from arrows, a victim elf never is", () => {
  const goal = readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"].components["minecraft:behavior.nearest_attackable_target"];
  const foeEntry = goal.entity_types.find((t) => JSON.stringify(t.filters).includes(EL.FOE_TAG));
  assert.ok(foeEntry, "the warden targets players carrying the foe tag");
  assert.deepEqual(foeEntry.filters.all_of.map((f) => [f.test, f.subject, f.value]), [["is_family", "other", "player"], ["has_tag", "other", EL.FOE_TAG]]);
  const player = { typeId: EW.PLAYER_ID, families: ["player"] }, shot = (o) => EW.isFriendlyFire({ shooterId: EW.WARDEN_ID, victim: player, ...o });
  assert.equal(shot({}), true, "an innocent player is shielded");
  assert.equal(shot({ foe: true }), false, "a foe is not");
  assert.equal(shot({ hated: true }), false); assert.equal(shot({ sinceProvokedMs: 1000 }), false);
  assert.equal(EW.isFriendlyFire({ shooterId: EW.WARDEN_ID, victim: { typeId: EL.ELF_ID, families: [EL.ELF_FAMILY, "mob"] } }), true, "warden arrows never hurt elves");
  assert.equal(EL.FOE_MS, EW.PROVOKE_MS, "a foe is shot for as long as a provoked player");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_warden.js", import.meta.url), "utf8");
  assert.ok(src.includes("hasTag(FOE_TAG)") && /isFriendlyFire\(\{[^)]*\bfoe\b/.test(src), "friendly fire reads the foe tag");
});

test("elf homeSite: open 5x5 gives 5, a fence shrinks it, a single cell gives null, the square always contains the cell", () => {
  assert.deepEqual(EL.homeSite(deck(5, 5), 2, 0, 2), { x0: 0, z0: 0, k: 5 });
  const fenced = EL.homeSite(deck(5, 5, { "4,1,4": FENCE }), 2, 0, 2);
  assert.equal(fenced.k, 4); assert.ok(fenced.x0 + 3 < 4 || fenced.z0 + 3 < 4, "the fenced corner is outside the square");
  assert.equal(EL.homeSite(deck(1, 1), 0, 0, 0), null);
  assert.equal(EL.homeSite(deck(2, 9), 0, 0, 4), null, "a strip is no square");
  assert.equal(EL.homeSite(deck(20, 20), 10, 0, 10).k, EL.HOME_MAX, "capped at HOME_MAX");
  assert.equal(EL.homeSite(deck(5, 5, { "2,3,2": "minecraft:oak_leaves" }), 0, 0, 0), null, "a block in the headroom closes the middle cell: no 3x3 square is left");
  const s = EL.homeSite(deck(9, 9), 8, 0, 8); assert.ok(s.x0 <= 8 && s.x0 + s.k > 8 && s.z0 <= 8 && s.z0 + s.k > 8);
});

test("elf assignHomes: four trees in HOME_ORDER (room first, then nearest to the Loremaster); reserves only for the leftovers; order of input does not matter", () => {
  const home = (x, k) => ({ kind: "home", x, y: 70, z: 0, site: k ? { x0: 0, z0: 0, k } : null });
  const homes = [home(3, 3), home(10, 7), home(8, 5), home(5, 6), home(20, 5)], lore = [0, 70, 0];
  const names = (r) => r.map((a) => `${a.p}@${a.post.x}`);
  assert.deepEqual(names(EL.assignHomes(homes, lore)), ["healer@5", "gardener@8", "woodwright@10", "lamplighter@20"], "room first (x 3 has none), then by distance");
  const reserves = [20, 4, 12, 28].map((x) => ({ kind: "reserve", x, y: 70, z: 0, site: null }));
  assert.deepEqual(names(EL.assignHomes([...homes, ...reserves], lore)), names(EL.assignHomes(homes, lore)), "no reserve is used with four trees");
  const three = EL.assignHomes([home(30, 5), home(3, 3), home(10, 7), ...reserves], lore);
  assert.deepEqual(names(three), ["healer@10", "gardener@30", "woodwright@3", "lamplighter@4"], "3 trees: the leftover stands on the nearest reserve");
  assert.deepEqual(three.map((a) => a.p), EL.HOME_ORDER);
  assert.deepEqual(names(EL.assignHomes(reserves, lore)), ["healer@4", "gardener@12", "woodwright@20", "lamplighter@28"], "0 trees: all four on reserves, nearest first");
  const all = [...homes, ...reserves];
  for (const m of [1, 2, 3, 4, 5, 7, 100]) {
    const part = all.filter((_, i) => i % m !== 0), a = EL.assignHomes(part, lore), b = EL.assignHomes([...part].reverse(), lore);
    assert.deepEqual(names(a), names(b), `input order (${m})`);
    assert.equal(new Set(a.map((q) => q.p)).size, a.length, "no profession twice"); assert.equal(new Set(a.map((q) => q.post)).size, a.length, "no post twice");
  }
  assert.deepEqual(EL.assignHomes([], lore), []); assert.equal(EL.assignHomes(homes, null).length, 4, "a rect without the central tree still assigns homes");
});

test("elf assignHomes: 6+ home posts give a second healer on a roomy tree farthest from the first; never on a reserve; fewer trees never do", () => {
  const home = (x, z, k) => ({ kind: "home", x, y: 70, z, site: k ? { x0: 0, z0: 0, k } : null });
  const lore = [0, 70, 0], names = (r) => r.map((a) => `${a.p}@${a.post.x},${a.post.z}`);
  const five = [home(5, 0, 6), home(8, 0, 5), home(10, 0, 7), home(20, 0, 5), home(3, 0, 3)];
  assert.equal(EL.assignHomes(five, lore).length, 4, "5 trees: no second healer");
  const r = EL.assignHomes([home(5, 0, 6), home(8, 0, 5), home(10, 0, 7), home(20, 0, 5), home(3, 0, 3), home(0, 40, 5)], lore);
  assert.deepEqual(names(r), ["healer@5,0", "gardener@8,0", "woodwright@10,0", "lamplighter@20,0", "healer@0,40"], "6 trees: the spare roomy tree gets the 2nd healer");
  const seven = [...five, home(0, 40, 5), home(0, 12, 5)];
  assert.equal(names(EL.assignHomes(seven, lore))[4], "healer@0,40", "farthest from the first healer among the roomy leftovers");
  const noRoom = [home(5, 0, 6), home(8, 0, 5), home(10, 0, 7), home(20, 0, 5), home(3, 0, 3), home(0, 60, 0)];
  assert.equal(names(EL.assignHomes(noRoom, lore))[4], "healer@0,60", "no leftover has room: farthest from the first healer");
  const reserves = [4, 12].map((x) => ({ kind: "reserve", x, y: 70, z: 0, site: null }));
  assert.equal(EL.assignHomes([...five, ...reserves], lore).length, 4, "reserves never give a second healer");
  assert.ok(EL.assignHomes([...five, home(0, 40, 5), ...reserves], lore).every((a) => a.post.kind === "home"));
  const fwd = names(r), back = names(EL.assignHomes([home(0, 40, 5), home(3, 0, 3), home(20, 0, 5), home(10, 0, 7), home(8, 0, 5), home(5, 0, 6)], lore));
  assert.deepEqual(fwd, back, "input order does not matter");
  assert.equal(EL.HEALER2_MIN_TREES, 6);
});

test("elf homes record: parse tolerates damage and the list is capped", () => {
  assert.deepEqual(EL.parseHomes(undefined), []); assert.deepEqual(EL.parseHomes("{"), []); assert.deepEqual(EL.parseHomes('{"a":1}'), []);
  let list = []; for (let i = 0; i < EL.MAX_HOME_RECORDS + 5; i++) list = EL.addHomes(list, { n: i });
  assert.equal(list.length, EL.MAX_HOME_RECORDS); assert.equal(list.at(-1).n, EL.MAX_HOME_RECORDS + 4);
});

finish();
