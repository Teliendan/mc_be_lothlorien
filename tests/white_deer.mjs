// white deer regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEPTH_NAMES } from "../lothlorien_bp/scripts/depth.js";
import { existsSync } from "node:fs";
import * as R from "../lothlorien_bp/scripts/deer_rules.js";
import * as W from "../lothlorien_bp/scripts/white_deer_rules.js";
import * as G from "../tools/dev_scripts/guide_goal/variants.mjs";
import * as N from "../lothlorien_bp/scripts/great_mallorn_rules.js";

const deerEntity = () => readJson("../lothlorien_bp/entities/deer.json")["minecraft:entity"];
const flat = () => 64;
const at0 = { x: 0, y: 64, z: 0 };
const whiteEntity = () => readJson("../lothlorien_bp/entities/white_deer.json")["minecraft:entity"];
const everything = (e) => [e.components, ...Object.values(e.component_groups)];
const GRAIN = "lothlorien:western_corn_grain";

test("white deer: a guidance in progress continues only while Friend", () => {
  assert.equal(W.canBeGuided("friend"), true);
  assert.deepEqual(["guest", "uneasy", "shunned", "hated"].map(W.canBeGuided), [false, false, false, false]);
});

test("gift spot: rings inside the default simulation distance, farthest first, every heading", () => {
  const all = N.giftCandidates(100, -40);
  assert.equal(all.length, N.GIFT_RINGS.length * N.GIFT_HEADINGS);
  assert.deepEqual([...new Set(all.map((c) => c.ring))], [...N.GIFT_RINGS].sort((a, b) => b - a));
  assert.ok(N.GIFT_RINGS.every((r) => r <= 56 && r >= 32), "loaded at simulation distance 4 (64 blocks) from any spot in the player chunk");
  for (const c of all) assert.ok(Math.abs(Math.hypot(c.x - 100, c.z + 40) - c.ring) < 1.5);
  const grid = N.borderGrid(0, 0);
  assert.ok(grid.every((p) => Math.hypot(p.x, p.z) <= N.BORDER_SCAN && p.x % N.BORDER_STEP === 0));
  assert.ok(grid.some((p) => p.x === N.BORDER_SCAN) && grid.length < 600, "covers the scan circle with a bounded probe count");
});

test("gift spot: away from the known border (towards the heart), not just the farthest ring", () => {
  // deer at 0,0; the biome border runs north-south 30 blocks to the west (x = -30)
  const border = Array.from({ length: 25 }, (_, i) => ({ x: -30, z: -96 + i * 8 }));
  const spots = N.giftCandidates(0, 0).map((c) => ({ ...c, y: 70, inside: c.x > -30 }));
  const best = N.pickGiftSpot(spots, border);
  assert.ok(best.x > 30, `leads east, away from the edge (got ${best.x}, ${best.z})`);
  // a far spot near the edge loses to a nearer one deep in
  const edgeFar = { x: -20, z: 0, ring: 56, y: 70, inside: true }, deepNear = { x: 36, z: 0, ring: 36, y: 70, inside: true };
  assert.equal(N.pickGiftSpot([edgeFar, deepNear], border), deepNear);
  // equal depth (within the slack): the longer walk wins
  const a = { x: 40, z: 0, ring: 40, y: 70, inside: true }, b = { x: 44, z: 3, ring: 52, y: 70, inside: true };
  assert.equal(N.pickGiftSpot([a, b], border), b);
  // no border in sight: the longest walk; nothing standable inside: undefined
  assert.equal(N.pickGiftSpot([a, b], []), b);
  assert.equal(N.pickGiftSpot([{ ...a, inside: false }, { ...b, y: undefined }], border), undefined);
});

test("the actionbar is only the Harmony band status (and the debug readout); other messages use chat", () => {
  for (const f of ["white_deer.js", "great_mallorn.js", "deer.js", "trees.js", "athelas.js", "lembas.js", "crop.js", "antler.js"]) {
    const src = readFileSync(new URL(`../lothlorien_bp/scripts/${f}`, import.meta.url), "utf8");
    assert.ok(!src.includes("setActionBar"), f);
  }
});

test("white deer: the gift is given once per deer, the spot is kept until then, the acorn only goes when it leads", () => {
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(!/findMarker|getBlocks\(|MARKER/.test(src), "no marker search left");
  assert.ok(/getDynamicProperty\(GIFTED\)[\s\S]*return;/.test(src), "a gifted deer refuses (acorn kept)");
  assert.ok(src.includes("setDynamicProperty(GIFTED, true)") && src.includes("setDynamicProperty(GIFT_SPOT, undefined)"));
  assert.ok(/function arrive[\s\S]*giveGift/.test(src), "arrival lays the nut");
  const lead = src.slice(src.indexOf("function lead("), src.indexOf("function end("));
  assert.ok(lead.indexOf("consumeAcorn") > lead.indexOf("guide_start"), "acorn used only when guidance starts");
});

test("waypoints: open ground gives a HOP-block waypoint straight at the target", () => {
  const w = W.pickWaypoint(at0, { x: 80, z: 0 }, flat);
  assert.equal(w.final, false);
  assert.ok(Math.abs(w.x - W.HOP) < 1e-9 && Math.abs(w.z) < 1e-9 && w.y === 64);
  assert.ok(W.HOP <= 14 && W.MIN_HOP >= 8, "hops of 8-14 blocks");
});

test("waypoints: a lake ahead turns the heading, bias side first; a near wall shortens the hop", () => {
  const lake = (x, z) => (x > 4 && Math.abs(z) < 20 ? undefined : 64);
  const w = W.pickWaypoint(at0, { x: 80, z: 0 }, lake, { bias: -1 });
  assert.equal(w.turn, -1);
  assert.ok(Math.abs(w.z) >= 20 || w.x <= 4);
  const wall = (x) => (x > 10 ? undefined : 64);
  const v = W.pickWaypoint(at0, { x: 80, z: 0 }, wall);
  assert.ok(v.turn === 0 && v.x <= 10 && v.x >= W.MIN_HOP);
});

test("waypoints: a skipped heading is not reused; boxed in gives undefined", () => {
  assert.notEqual(W.pickWaypoint(at0, { x: 80, z: 0 }, flat, { skip: new Set([0]) }).deg, 0);
  assert.equal(W.pickWaypoint(at0, { x: 80, z: 0 }, () => undefined), undefined);
});

test("waypoints: the final hop lands within FINAL_RING of a blocked target, on the deer's side", () => {
  const trunk = (x, z) => (W.horizontal({ x, z }, { x: 10, z: 0 }) < 2 ? undefined : 64);
  const w = W.pickWaypoint(at0, { x: 10, z: 0 }, trunk);
  assert.equal(w.final, true);
  assert.ok(w.x < 10 && W.horizontal(w, { x: 10, z: 0 }) <= W.FINAL_RING && W.FINAL_RING <= 5);
});

test("waypoints: 80 blocks of open ground is 6 hops", () => {
  let p = { ...at0 }, n = 0;
  while (n < 20) {
    const w = W.pickWaypoint(p, { x: 80, z: 0 }, flat);
    n++;
    if (w.final) break;
    p = { x: w.x, y: w.y, z: w.z };
  }
  assert.equal(n, 6);
});

test("hop status: reached, progress, stuck after 5 s", () => {
  const hop = W.newHop({ x: 14, z: 0 }, at0);
  assert.equal(hop.best, 14);
  assert.equal(W.hopStatus(hop, { x: 14 - W.REACHED, z: 0 }, W.GUIDE_TICKS), "next");
  assert.equal(W.hopStatus(hop, { x: 5, z: 0 }, W.GUIDE_TICKS), "go");
  assert.equal(hop.stuck, 0);
  let s;
  for (let t = 0; t < W.HOP_STUCK_TICKS; t += W.GUIDE_TICKS) s = W.hopStatus(hop, { x: 5, z: 0 }, W.GUIDE_TICKS);
  assert.equal(s, "retry");
  assert.equal(W.HOP_STUCK_TICKS, 100);
  assert.ok(W.GUIDE_TICKS <= 5);
});

test("white deer: no teleport stepping left in the rules or the game script", () => {
  for (const k of ["pickStep", "STEP", "MOVE_TICKS", "headings"]) assert.ok(!(k in W), k);
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(!/deer\.teleport\(/.test(src), "the deer itself is never teleported");
  assert.ok(src.includes("spawnEntity(BEACON_ID"), "one beacon per session");
});

test("white deer: progress resets the stuck timer, standing still does not", () => {
  const s = { bestDist: 50, stuck: 0 };
  W.trackProgress(s, 49.5, true, 2);
  assert.equal(s.stuck, 2);
  W.trackProgress(s, 48, true, 2);
  assert.deepEqual([s.bestDist, s.stuck], [48, 0]);
  W.trackProgress(s, 48, false, 2); // waiting for the player is not stuck
  assert.equal(s.stuck, 0);
});

test("white deer: phases (arrive, wait for the player, give up)", () => {
  const base = { toTarget: 40, toPlayer: 5, stuck: 0, age: 0, playerCalm: true };
  const ph = (o) => W.phase({ ...base, ...o });
  assert.equal(ph({}), "walk");
  assert.equal(ph({ toPlayer: W.WAIT_DIST + 1 }), "wait");
  assert.equal(ph({ toPlayer: W.ABORT_DIST + 1 }), "abort");
  assert.equal(ph({ playerCalm: false }), "abort");
  assert.equal(ph({ toTarget: W.ARRIVE_DIST }), "arrived");
  assert.equal(ph({ stuck: W.STUCK_TICKS }), "abort");
  assert.equal(ph({ stuck: W.STUCK_TICKS, toTarget: W.STUCK_ARRIVE_DIST }), "arrived");
  assert.equal(ph({ age: W.MAX_TICKS + 1 }), "abort");
});

test("ordinary deer: no coat variant, no guiding state (Phase 12 moved to its own entity)", () => {
  const e = deerEntity();
  const text = JSON.stringify(e);
  for (const bad of ["lothlorien:coat", "lothlorien:guiding", "state_guiding", "guide_start", "coat_white"]) {
    assert.ok(!text.includes(bad), bad);
  }
  const rc = readJson("../lothlorien_rp/render_controllers/deer.render_controllers.json").render_controllers["controller.render.lothlorien.deer"];
  assert.ok(!rc.textures[0].includes("white"));
});

test("ordinary deer: Western Corn grain is the only food (lure, breeding, fawn growth); not the seeds, acorn or apple", () => {
  const e = deerEntity();
  for (const w of ["calm", "friend"]) assert.deepEqual(e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"].items, [GRAIN], w);
  assert.deepEqual(e.component_groups["lothlorien:adult"]["minecraft:breedable"].breed_items, [GRAIN]);
  assert.deepEqual(e.component_groups["lothlorien:baby"]["minecraft:ageable"].feed_items, [GRAIN]);
  const text = JSON.stringify(e);
  for (const bad of ["mallorn_acorn", "\"apple\"", "western_corn_seeds"]) assert.ok(!text.includes(bad), bad);
  assert.ok(existsSync(new URL("../lothlorien_bp/items/western_corn_grain.json", import.meta.url)), "grain item exists");
});

test("white deer: a separate loner entity, not tamable, not breedable, no babies; leashable, no balloon", () => {
  const e = whiteEntity();
  assert.equal(e.description.identifier, W.WHITE_DEER_ID);
  assert.equal(e.description.identifier, R.WHITE_DEER_ID);
  assert.ok(e.description.is_spawnable && e.description.is_summonable);
  const keys = new Set(everything(e).flatMap((c) => Object.keys(c)));
  for (const bad of ["minecraft:breedable", "minecraft:behavior.breed", "minecraft:offspring", "minecraft:is_baby", "minecraft:ageable",
    "minecraft:behavior.follow_parent", "minecraft:tameable", "minecraft:balloonable", "minecraft:spawn_egg_interaction",
    "minecraft:behavior.follow_mob", "minecraft:behavior.follow_owner"]) {
    assert.ok(!keys.has(bad), bad);
  }
  assert.ok(e.components["minecraft:leashable"], "a lead works on it (the owner's wish)");
  assert.ok(!e.events["minecraft:entity_born"] && !e.events["minecraft:ageable_grow_up"]);
  assert.ok(!e.description.properties["lothlorien:coat"]);
  assert.deepEqual(e.components["minecraft:despawn"], { despawn_from_distance: {} });
  assert.ok(e.components["minecraft:type_family"].family.includes("lothlorien_white_deer"));
  assert.ok(!e.components["minecraft:type_family"].family.includes("lothlorien_deer"), "own family");
});

test("white deer: same wariness states and flight distances as the deer; only the acorn lures it", () => {
  const e = whiteEntity(), d = deerEntity();
  // same flight, except the lure item that switches flight from its holder off
  const sameLure = (avoid) => JSON.parse(JSON.stringify(avoid).replaceAll(W.ACORN_ID, R.CORN_ID));
  for (const w of [...R.WARINESS, "alarmed", "tame"]) {
    assert.deepEqual(sameLure(e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"]),
      d.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.avoid_mob_type"], w);
    assert.ok(e.events[R.setEventFor(w)] || w === "alarmed" || w === "tame", w);
  }
  const lured = (w) => e.component_groups[`lothlorien:state_${w}`]["minecraft:behavior.tempt"]?.items;
  assert.deepEqual(["calm", "friend"].map(lured), [[W.ACORN_ID], [W.ACORN_ID]]);
  assert.deepEqual(["l1", "l2", "l3", "alarmed"].map(lured), [undefined, undefined, undefined, undefined]);
  assert.deepEqual(e.events["lothlorien:alarm_over"], d.events["lothlorien:alarm_over"]);
  assert.equal(e.component_groups["lothlorien:state_alarmed"]["minecraft:timer"].time_down_event.event, "lothlorien:alarm_over");
  for (const k of ["minecraft:behavior.panic", "minecraft:behavior.float", "minecraft:behavior.random_stroll", "minecraft:navigation.walk", "minecraft:movement"]) {
    assert.deepEqual(e.components[k], d.components[k], k);
  }
  assert.ok(R.DEER_TYPES.includes(W.WHITE_DEER_ID), "deer.js drives its wariness and alarm");
});

test("both deer: a held lure beats flight, a fed (tame) deer does not flee from players, attack still wins", () => {
  for (const [e, lure] of [[deerEntity(), R.CORN_ID], [whiteEntity(), W.ACORN_ID]]) {
    const g = e.component_groups;
    const playerEntries = (grp) => grp["minecraft:behavior.avoid_mob_type"].entity_types
      .filter((t) => JSON.stringify(t.filters).includes('"value":"player"'));
    const exempts = (t) => t.filters.all_of?.some((f) => f.test === "has_equipment" && f.subject === "other" && f.operator === "!=" && f.value === lure);
    for (const w of ["calm", "friend"]) {
      assert.ok(playerEntries(g[`lothlorien:state_${w}`]).every(exempts), `${w}: holding ${lure} stops the flight`);
      assert.equal(g[`lothlorien:state_${w}`]["minecraft:behavior.tempt"].can_get_scared, false, `${w}: the lure is not broken by movement`);
    }
    for (const w of ["l1", "l2", "l3", "alarmed"]) assert.ok(!playerEntries(g[`lothlorien:state_${w}`]).some(exempts), `${w}: the lure does not help`);
    assert.equal(playerEntries(g["lothlorien:state_tame"]).length, 0, "tame: no flight from players");
    assert.deepEqual(g["lothlorien:state_tame"]["minecraft:behavior.tempt"].items, [lure]);
    assert.equal(e.description.properties["lothlorien:tame"].default, false);
    for (const [name, ev] of Object.entries(e.events)) {
      const removes = [ev, ...(ev.sequence ?? [])].flatMap((s) => s.remove?.component_groups ?? []);
      if (removes.includes("lothlorien:state_calm")) assert.ok(removes.includes("lothlorien:state_tame"), `${name} removes state_tame`);
    }
    for (const w of ["calm", "friend"]) {
      const seq = e.events[R.setEventFor(w)].sequence;
      const addFor = (tame) => seq.find((s) => s.filters?.domain === "lothlorien:tame" && s.filters.value === tame).add.component_groups;
      assert.deepEqual([addFor(false), addFor(true)], [[`lothlorien:state_${w}`], ["lothlorien:state_tame"]]);
    }
    for (const w of ["l1", "l2", "l3"]) assert.deepEqual(e.events[R.setEventFor(w)].add.component_groups, [`lothlorien:state_${w}`], w);
    assert.equal(e.components["minecraft:behavior.panic"].priority, 1, "panic outranks the lure (3)");
  }
  const src = (f) => readFileSync(new URL(`../lothlorien_bp/scripts/${f}`, import.meta.url), "utf8");
  assert.ok(src("deer.js").includes('triggerEvent("lothlorien:untame")'), "a player hurting a deer untames it");
  assert.ok(/tame\(target\)/.test(src("deer.js")), "feeding corn tames a deer");
  assert.ok(src("white_deer.js").includes('triggerEvent("lothlorien:become_tame")'), "a white deer taking the acorn is tamed");
  // a property set by script is not visible before the next tick, so tame state goes through entity events
  for (const f of ["deer.js", "white_deer.js"]) assert.ok(!/setProperty\("lothlorien:tame"/.test(src(f)), f);
});

test("both deer: tame or leashed = persistent, like vanilla tamed animals; either one alone keeps it", () => {
  for (const e of [deerEntity(), whiteEntity()]) {
    const K = "lothlorien:kept", ev = e.events;
    assert.deepEqual(e.component_groups[K], { "minecraft:persistent": {} });
    assert.ok(e.components["minecraft:despawn"], "wild deer still despawn");
    const l = e.components["minecraft:leashable"];
    assert.deepEqual([l.on_leash.event, l.on_unleash.event], ["lothlorien:leashed", "lothlorien:unleashed"]);
    assert.deepEqual(ev["lothlorien:leashed"].add.component_groups, [K]);
    assert.deepEqual(ev["lothlorien:become_tame"], { set_property: { "lothlorien:tame": true }, add: { component_groups: [K] } });
    const unleash = ev["lothlorien:unleashed"].sequence[0];
    assert.deepEqual([unleash.filters.domain, unleash.filters.value, unleash.remove.component_groups], ["lothlorien:tame", false, [K]]);
    const [untameSet, untameRemove] = ev["lothlorien:untame"].sequence;
    assert.equal(untameSet.set_property["lothlorien:tame"], false);
    assert.deepEqual([untameRemove.filters.test, untameRemove.filters.value, untameRemove.remove.component_groups], ["is_leashed", false, [K]]);
    for (const [name, x] of Object.entries(ev)) {
      if (!name.includes("tame") && !name.includes("leash")) assert.ok(!JSON.stringify(x).includes(K), `${name} leaves ${K} alone`);
    }
  }
});

test("white deer: guiding state follows the beacon (one goal, below panic, above avoid) and only guide_start adds it", () => {
  const e = whiteEntity();
  const g = "lothlorien:state_guiding";
  for (const [name, ev] of Object.entries(e.events)) {
    if (name.startsWith("lothlorien:set_") || name === "lothlorien:alarm") {
      const first = ev.sequence?.[0] ?? ev; // set_calm/set_friend: reset first, then the tame-dependent add
      assert.ok(first.remove.component_groups.includes(g), name);
      assert.equal(first.set_property["lothlorien:guiding"], false, name);
    }
    if (name !== "lothlorien:guide_start") assert.ok(![ev, ...(ev.sequence ?? [])].some((s) => s.add?.component_groups?.includes(g)), name);
  }
  assert.deepEqual(e.events["lothlorien:guide_start"].add.component_groups, [g]);
  assert.equal(e.events["lothlorien:guide_start"].set_property["lothlorien:guiding"], true);
  assert.equal(e.events["lothlorien:guide_end"].trigger, "lothlorien:alarm_over");
  const guiding = e.component_groups[g];
  assert.ok(!guiding["minecraft:behavior.tempt"]);
  assert.deepEqual(guiding["minecraft:behavior.avoid_mob_type"].entity_types.map((t) => t.filters.value).sort(), ["monster", "wolf"]);
  // the goal is exactly one of the prepared variants (switch_guide_goal.mjs), the shipped one is follow_target_leader
  const variant = G.currentVariant(e);
  assert.ok(variant, "a known guide goal variant");
  for (const [k, v] of Object.entries(G.VARIANTS[variant](G.BEACON_FILTER))) assert.deepEqual(guiding[k], v, k);
  assert.equal(variant, "leader", "shipped goal (change this line together with a switch)");
  const prios = Object.keys(G.VARIANTS[variant](G.BEACON_FILTER)).map((k) => guiding[k].priority);
  assert.ok(prios.every((p) => p > e.components["minecraft:behavior.panic"].priority && p < guiding["minecraft:behavior.avoid_mob_type"].priority));
  const within = guiding["minecraft:behavior.follow_target_leader"]?.within_radius ?? 24;
  assert.ok(within > W.HOP + W.REACHED, "the beacon stays inside the goal's radius");
  assert.ok(Number(readJson("../lothlorien_bp/entities/white_deer.json").format_version.split(".")[1]) >= 26, "follow_target_leader needs 1.26.20+");
});

test("white deer: no experiment groups shipped (switch_guide_goal.mjs --clean)", () => {
  const e = whiteEntity();
  assert.ok(![...Object.keys(e.component_groups), ...Object.keys(e.events)].some((k) => k.startsWith("lothlorien:test_")));
  const copy = structuredClone(e);
  G.removeExperiment(G.addExperiment(copy));
  assert.deepEqual(copy, e, "experiment add + clean round-trips");
  for (const name of Object.keys(G.VARIANTS)) assert.equal(G.currentVariant(G.applyVariant(structuredClone(e), name)), name, name);
});

test("white deer: holding an acorn gives the interaction the script listens for; the item is not used up by the engine", () => {
  const e = whiteEntity();
  const [i] = e.components["minecraft:interact"].interactions;
  assert.ok(JSON.stringify(i.on_interact.filters).includes(W.ACORN_ID));
  assert.equal(i.use_item, false);
  assert.ok(existsSync(new URL(`../lothlorien_bp/items/${W.ACORN_ID.split(":")[1]}.json`, import.meta.url)), "acorn item exists");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const key of [i.interact_text, "entity.lothlorien:white_deer.name", "item.spawn_egg.entity.lothlorien:white_deer.name"]) {
    assert.ok(lang.includes(`${key}=`), key);
  }
  assert.ok(lang.includes("entity.lothlorien:white_deer.name=White Deer\n") || lang.includes("entity.lothlorien:white_deer.name=White Deer\r\n"));
});

test("white deer: rare single spawns in the biome at SPAWN_WEIGHT, flagged natural by the herd event", () => {
  const rule = readJson("../lothlorien_bp/spawn_rules/white_deer.json")["minecraft:spawn_rules"];
  const deer = readJson("../lothlorien_bp/spawn_rules/deer.json")["minecraft:spawn_rules"];
  assert.equal(rule.description.identifier, W.WHITE_DEER_ID);
  assert.equal(rule.description.population_control, "animal");
  const [c] = rule.conditions, [dc] = deer.conditions;
  assert.equal(rule.conditions.length, 1);
  assert.deepEqual(c["minecraft:herd"], { min_size: 1, max_size: 1, event: "lothlorien:spawn_natural" });
  assert.equal(c["minecraft:density_limit"].surface, 1);
  assert.equal(c["minecraft:weight"].default, W.SPAWN_WEIGHT, "tune in white_deer_rules.js and the spawn rule together");
  assert.ok(c["minecraft:weight"].default < dc["minecraft:weight"].default, "fewer than deer");
  assert.deepEqual(c["minecraft:biome_filter"], dc["minecraft:biome_filter"]);
  const e = whiteEntity();
  assert.deepEqual(e.description.properties["lothlorien:natural"], { type: "bool", default: false, client_sync: false });
  const natural = e.events["lothlorien:spawn_natural"];
  assert.equal(natural.set_property["lothlorien:natural"], true);
  assert.equal(natural.trigger, "lothlorien:set_calm", "a natural spawn is fully set up even if entity_spawned does not also run");
  assert.deepEqual(e.events["minecraft:entity_spawned"], { trigger: "lothlorien:set_calm" }, "summon and egg: never flagged");
  assert.ok(!JSON.stringify(e.events["minecraft:entity_spawned"]).includes("natural"));
});

test("white deer: depth table - none outside, few at the edge, more inside, all in the heart; clamps odd levels", () => {
  assert.deepEqual([0, 1, 2, 3].map(W.spawnKeepChance), W.SPAWN_KEEP_BY_DEPTH);
  assert.equal(W.SPAWN_KEEP_BY_DEPTH.length, DEPTH_NAMES.length, "one chance per depth level (depth.js)");
  assert.equal(W.spawnKeepChance(0), 0);
  assert.equal(W.spawnKeepChance(3), 1);
  for (let l = 1; l < 4; l++) assert.ok(W.spawnKeepChance(l) > W.spawnKeepChance(l - 1), `level ${l} more than ${l - 1}`);
  assert.equal(W.spawnKeepChance(7), 1); assert.equal(W.spawnKeepChance(-1), 0); assert.equal(W.spawnKeepChance(undefined), 0);
  assert.ok(W.keepNaturalSpawn(3, 0.999) && !W.keepNaturalSpawn(0, 0));
  assert.ok(W.keepNaturalSpawn(1, W.spawnKeepChance(1) - 0.001) && !W.keepNaturalSpawn(1, W.spawnKeepChance(1)));
  // share of kept spawns over many rolls follows the table
  let kept = 0;
  for (let i = 0; i < 1000; i++) if (W.keepNaturalSpawn(2, i / 1000)) kept++;
  assert.equal(kept, Math.round(W.spawnKeepChance(2) * 1000));
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(src.includes("EntityInitializationCause.Loaded") && src.includes('setProperty("lothlorien:natural", false)'), "judged once, not on reload");
});

test("white deer: always an antlered hart; sure antler plus the usual deer drops, on any death", () => {
  const e = whiteEntity();
  assert.ok(!e.description.properties["lothlorien:sex"], "no sex split");
  const text = JSON.stringify(e);
  for (const bad of ["adult_doe", "adult_buck", "spawn_doe", "spawn_buck", "lothlorien:sex"]) assert.ok(!text.includes(bad), bad);
  assert.equal(e.components["minecraft:loot"].table, "loot_tables/entities/white_deer.json");
  assert.ok(!e.components["minecraft:experience_reward"].on_bred);
  const loot = readJson("../lothlorien_bp/loot_tables/entities/white_deer.json");
  const pool = (name) => loot.pools.find((p) => p.entries.some((x) => x.name === name));
  const antler = pool("lothlorien:deer_antler");
  assert.ok(antler && !antler.conditions && antler.entries.length === 1 && antler.rolls === 1, "guaranteed, no player-kill or chance condition");
  assert.deepEqual(antler.entries[0].functions, [{ function: "set_count", count: 1 }]);
  // leather and venison exactly as a buck deer
  const buck = readJson("../lothlorien_bp/loot_tables/entities/deer_buck.json");
  for (const name of ["minecraft:leather", "lothlorien:venison_raw"]) {
    assert.deepEqual(pool(name), buck.pools.find((p) => p.entries.some((x) => x.name === name)), name);
  }
});

test("white deer: leash rule - a lead always wins over guidance", () => {
  assert.equal(W.offerRefusal({ band: "friend", leashed: false }), undefined);
  assert.equal(W.offerRefusal({ band: "friend", leashed: true }), "leashed");
  assert.equal(W.offerRefusal({ band: "shunned", leashed: true }), "leashed");
  for (const band of ["uneasy", "shunned", "hated"]) assert.equal(W.offerRefusal({ band, leashed: false }), "restless", band);
  assert.equal(W.offerRefusal({ band: "guest", leashed: false }), "untrusted"); // a Guest is not enough: Friend only
  const base = { toTarget: 40, toPlayer: 5, stuck: 0, age: 0, playerCalm: true };
  assert.equal(W.phase(base), "walk");
  assert.equal(W.phase({ ...base, leashed: true }), "leashed");
  assert.equal(W.phase({ ...base, toTarget: 1, leashed: true }), "leashed", "even at the goal");
  assert.equal(W.phase({ ...base, toPlayer: 30, leashed: true }), "leashed");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/white_deer.js", import.meta.url), "utf8");
  assert.ok(src.includes('getComponent("minecraft:leashable")?.isLeashed'), "the game script reads the lead");
});

test("white deer: client entity uses the white texture on the antlered deer model only; no unused fawn texture", () => {
  const c = readJson("../lothlorien_rp/entity/white_deer.entity.json")["minecraft:client_entity"].description;
  assert.equal(c.identifier, W.WHITE_DEER_ID);
  assert.deepEqual(c.geometry, { default: "geometry.lothlorien.deer_buck" }, "always antlered");
  const rc = readJson("../lothlorien_rp/render_controllers/white_deer.render_controllers.json").render_controllers["controller.render.lothlorien.white_deer"];
  assert.equal(rc.geometry, "Geometry.default");
  assert.deepEqual(c.textures, { default: "textures/entity/deer/deer_white" });
  assert.ok(existsSync(new URL(`../lothlorien_rp/${c.textures.default}.png`, import.meta.url)));
  assert.ok(!existsSync(new URL("../lothlorien_rp/textures/entity/deer/deer_white_baby.png", import.meta.url)));
  assert.ok(c.spawn_egg, "spawn egg");
  const geo = readFileSync(new URL("../lothlorien_rp/models/entity/deer.geo.json", import.meta.url), "utf8");
  for (const g of Object.values(c.geometry)) assert.ok(geo.includes(`"${g}"`), g);
  assert.ok(readJson("../lothlorien_rp/sounds.json").entity_sounds.entities[W.WHITE_DEER_ID], "sounds");
});

test("guide beacon: invisible, weightless, untouchable helper that removes itself; no spawn rule", () => {
  const b = readJson("../lothlorien_bp/entities/guide_beacon.json")["minecraft:entity"];
  assert.equal(b.description.identifier, W.BEACON_ID);
  assert.equal(b.description.is_spawnable, false);
  assert.equal(b.description.is_summonable, true, "spawnEntity and /summon need it");
  const c = b.components;
  assert.ok(c["minecraft:type_family"].family.includes(G.BEACON_FILTER.value));
  assert.deepEqual(c["minecraft:physics"], { has_gravity: false, has_collision: false });
  // Not pushable = no pushable_by_* component; minecraft:pushable is rejected by entity format 1.26.50.
  for (const k of ["minecraft:pushable", "minecraft:pushable_by_entity", "minecraft:pushable_by_block"]) assert.equal(c[k], undefined, k);
  assert.deepEqual(c["minecraft:damage_sensor"].triggers, { cause: "all", deals_damage: "no" });
  assert.ok(!c["minecraft:is_collidable"] && !c["minecraft:despawn"]);
  const t = c["minecraft:timer"];
  assert.ok(t.time * 20 > W.MAX_TICKS && !t.looping, "outlives the longest session");
  assert.ok(b.component_groups[b.events[t.time_down_event.event].add.component_groups[0]]["minecraft:instant_despawn"]);
  assert.ok(!existsSync(new URL("../lothlorien_bp/spawn_rules/guide_beacon.json", import.meta.url)));
  const client = readJson("../lothlorien_rp/entity/guide_beacon.entity.json")["minecraft:client_entity"].description;
  assert.ok(!client.spawn_egg, "no spawn egg");
  const geo = readJson("../lothlorien_rp/models/entity/guide_beacon.geo.json")["minecraft:geometry"][0];
  assert.equal(geo.description.identifier, client.geometry.default);
  assert.ok(geo.bones.flatMap((x) => x.cubes).every((cube) => cube.size.every((v) => v === 0)), "nothing to render");
});

finish();
