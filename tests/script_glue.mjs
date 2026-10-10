// Runtime GLUE tests: the scripts run against a mocked @minecraft/server (shared mock in .claude/skills/bedrock-scripting/scripts/mock_server.mjs)
// with a fake tick clock. Unit tests of the pure planner never exercised the event / timer / job / ticking-area wiring, which is where the
// 2026-10-09 bug lived (`done?.(await planVillageAt(...))` never called the planner for automatic triggers).
// Imported by tests/run.mjs; assertions throw. Every scenario re-imports the script with a fresh `?run=n` so its module state is new.
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

register(new URL("../../../.claude/skills/bedrock-scripting/scripts/mock_loader.mjs", import.meta.url));
const { __mock: mock, world } = await import("@minecraft/server");
const PL = await import("../lothlorien_bp/scripts/village_planner.js");
const SRC = new URL("../lothlorien_bp/scripts/", import.meta.url).href;
const MARKER = "lothlorien:loop_marker";

// the owner's real village V2 as block map + live marker positions
const f = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/village_v2.json.gz", import.meta.url)))), [ox, oy, oz] = f.origin, [sx, sy, sz] = f.size, blocks = new Int16Array(sx * sy * sz);
f.cols.forEach((runs, ci) => { const i = Math.floor(ci / sz), k = ci % sz; let j = 0; for (let r = 0; r < runs.length; r += 2) for (let n = 0; n < runs[r + 1]; n++) blocks[(i * sy + j++) * sz + k] = runs[r]; });
const v2At = (x, y, z) => { const i = x - ox, j = y - oy, k = z - oz; return i < 0 || j < 0 || k < 0 || i >= sx || j >= sy || k >= sz ? undefined : f.palette[blocks[(i * sy + j) * sz + k]]; };
const direct = PL.planVillage(v2At, f.markers.map((p) => [Math.floor(p[0]), Math.floor(p[1]) - 1, Math.floor(p[2])]));

let runNo = 0;
const lines = [];
const realWarn = console.warn;
console.warn = (...a) => { lines.push(a.join(" ")); }; // captured; printed only on failure
async function scenario(name, body) {
  lines.length = 0; mock.reset(); runNo++;
  try { await body(); } catch (e) { console.warn = realWarn; console.log(`log of the failed scenario "${name}":\n  ${lines.join("\n  ")}`); throw e; }
  assert.deepEqual(mock.errors, [], `${name}: no uncaught error in a timer or job`);
  console.warn = realWarn; console.log(`ok   script glue: ${name}`); console.warn = (...a) => { lines.push(a.join(" ")); };
}
const grep = (re) => lines.filter((l) => re.test(l));
const loadScript = (file) => import(`${SRC}${file}?run=${runNo}`);
function setupV2() {
  mock.strictLoading = true; // blocks only readable inside a ready ticking area: the planner must have loaded the village itself
  mock.setBlocks(v2At);
  return f.markers.map((p) => mock.addEntity(MARKER, { x: p[0], y: p[1], z: p[2] }));
}
const markersLeft = () => mock.dimension().getEntities({ type: MARKER }).length;

await scenario("an automatic entityLoad plans the village once, removes the markers, writes the done-list", async () => {
  const markers = setupV2();
  await loadScript("loop_marker.js");
  assert.equal(mock.subscribers("after", "entityLoad"), 1); assert.equal(mock.subscribers("after", "entitySpawn"), 1);
  for (const i of [0, 7, 30]) mock.fire("entityLoad", { entity: markers[i] }); // several trees of one village load in the same moment
  mock.fire("entitySpawn", { entity: markers[1] });
  await mock.settle();
  assert.equal(grep(/planner: start for village/).length, 1, "exactly one planner run per village");
  assert.match(grep(/planner: start for village/)[0], /trigger entityLoad/);
  assert.equal(grep(/planner: village at/).length, 1, "one summary line");
  assert.equal(markersLeft(), 0, "every marker of the village is removed");
  const done = PL.parseDone(world.getDynamicProperty("lothlorien:village_plans"));
  assert.equal(done.length, 1, "done-list holds the village"); assert.equal(mock.propWrites.filter((k) => k === "lothlorien:village_plans").length, 1);
  assert.ok(mock.areaLog.created.length >= 2 && mock.areaLog.created.length === mock.areaLog.removed.length && mock.tickingAreas.areas.size === 0, "ticking areas created round by round and all removed again");
  assert.match(grep(/planner: village at/)[0], new RegExp(`${direct.picks.length} link\\(s\\)`), "the same number of links as the pure planner picks on the fixture");
  assert.equal(direct.picks.length, 2, "V2 with the L cap: plaza + side-side (the old third pick was an L join longer than 16)");
  assert.ok(mock.dimension().overrides.size > 50, "the links were written into the world");
  const kinds = grep(/planner:   (plaza|sideside|exit|side|L) /).map((l) => l.match(/planner:   (\w+) /)[1]);
  assert.deepEqual(kinds.sort(), direct.picks.map((p) => p.kind).sort(), "same kinds as the pure planner");

  // a straggler of the planned village (a marker that loads late) is removed without planning
  const before = grep(/planner: start for village/).length, props = mock.propWrites.length, areas = mock.areaLog.created.length;
  const late = mock.addEntity(MARKER, { x: f.markers[3][0], y: f.markers[3][1], z: f.markers[3][2] });
  mock.fire("entityLoad", { entity: late });
  await mock.settle();
  assert.equal(late.isValid, false, "straggler removed");
  assert.equal(grep(/planner: start for village/).length, before, "no second planner run");
  assert.equal(mock.propWrites.length, props, "done-list untouched"); assert.equal(mock.areaLog.created.length, areas, "no new ticking area");
});

await scenario("a marker that appears by entitySpawn (worldgen) starts the planner too", async () => {
  const markers = setupV2();
  await loadScript("loop_marker.js");
  mock.fire("entitySpawn", { entity: markers[5] });
  await mock.settle();
  assert.match(grep(/planner: start for village/)[0] ?? "", /trigger entitySpawn/);
  assert.equal(markersLeft(), 0);
});

await scenario("debug mode logs the silent exits, normal mode stays quiet about them", async () => {
  const markers = setupV2();
  const mod = await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] }); mock.fire("entityLoad", { entity: markers[0] });
  await mock.settle();
  assert.equal(grep(/\(debug\)/).length, 0, "no debug line without debug mode");
  mod.toggleDebug();
  const late = mock.addEntity(MARKER, { x: f.markers[3][0], y: f.markers[3][1], z: f.markers[3][2] });
  mock.fire("entityLoad", { entity: late }); mock.fire("entityLoad", { entity: late });
  await mock.settle();
  assert.ok(grep(/\(debug\).*already seen/).length === 1 && grep(/\(debug\).*straggler of a planned village/).length === 1, grep(/\(debug\)/).join("\n"));
});

await scenario("a quota that is too small gives up cleanly: markers stay, tries counted, areas removed, no done-list, no second run this session", async () => {
  const markers = setupV2();
  mock.tickingAreas.maxChunkCount = 6;
  const mod = await loadScript("loop_marker.js"); mod.toggleDebug();
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.settle();
  assert.equal(grep(/gave up: over chunk limit/).length, 1);
  assert.equal(markersLeft(), f.markers.length, "nothing removed");
  assert.equal(markers[0].getDynamicProperty("lothlorien:loop_tries"), 1);
  assert.equal(mock.tickingAreas.areas.size, 0); assert.equal(mock.propWrites.includes("lothlorien:village_plans"), false);
  // a failed run knows no village extent: its marker +-40 blocks count as failed; a neighbour inside that square is skipped this session
  const near = markers.find((m) => m !== markers[0] && Math.hypot(m.location.x - markers[0].location.x, m.location.z - markers[0].location.z) < 30);
  assert.ok(near);
  mock.fire("entityLoad", { entity: near });  await mock.settle();
  assert.equal(grep(/planner: start for village/).length, 1);
  assert.equal(grep(/failed earlier in this session/).length, 1);
});

await scenario("manual planNearest plans even for a done village and does not touch the done-list", async () => {
  const markers = setupV2();
  world.setDynamicProperty("lothlorien:village_plans", JSON.stringify([{ x0: 0, x1: 500, z0: 0, z1: 500 }])); mock.propWrites.length = 0;
  const mod = await loadScript("loop_marker.js");
  const sent = [], player = { dimension: mock.dimension(), location: { ...markers[0].location }, sendMessage: (m) => sent.push(m) };
  mod.planNearest(player);
  await mock.settle();
  assert.equal(grep(/planner: start for village/).length, 1); assert.match(grep(/planner: start for village/)[0], /trigger manual/);
  assert.equal(sent.length, 1); assert.equal(sent[0].translate, "lothlorien.message.village.plan.done");
  assert.equal(mock.propWrites.length, 0, "manual run leaves the done-list alone");
  assert.equal(markersLeft(), 0);
  mock.reset(); runNo++; // nothing to plan: a message, no run
  const mod2 = await loadScript("loop_marker.js"), sent2 = [];
  mod2.planNearest({ dimension: mock.dimension(), location: { x: 0, y: 70, z: 0 }, sendMessage: (m) => sent2.push(m) });
  assert.equal(sent2[0].translate, "lothlorien.message.village.plan.none");
});

await scenario("rail_mender: waits for loaded corners, switches on the dropped fence links, removes itself; stays when the box never loads", async () => {
  const FENCE = "lothlorien:mallorn_fence", MENDER = "lothlorien:rail_mender";
  mock.setBlocks((x, y, z) => (y === 70 && z === 0 && x >= 0 && x <= 2 ? FENCE : "minecraft:air"));
  const dim = mock.dimension();
  const e = mock.addEntity(MENDER, { x: 1.5, y: 70.5, z: 0.5 });
  await loadScript("rail_mender.js");
  mock.fire("entityLoad", { entity: e });
  await mock.settle();
  assert.equal(e.isValid, false, "mender removed itself");
  const st = (x) => dim.overrides.get(`${x},70,0`)?.states ?? {};
  assert.equal(st(0)["minecraft:connection_east"], true); assert.equal(st(1)["minecraft:connection_west"], true); assert.equal(st(1)["minecraft:connection_east"], true); assert.equal(st(2)["minecraft:connection_west"], true);
  assert.match(grep(/rail mender: 3 fence link/)[0] ?? "", /rail mender/);
  // box never loaded: marker stays valid, no job, no crash
  mock.reset(); runNo++; mock.strictLoading = true; mock.setBlocks(() => FENCE);
  const e2 = mock.addEntity(MENDER, { x: 1.5, y: 70.5, z: 0.5 });
  await loadScript("rail_mender.js");
  mock.fire("entitySpawn", { entity: e2 });
  await mock.settle();
  assert.equal(e2.isValid, true, "unloaded box: the mender stays for the next load");
});

await scenario("warden_replace: a template warden with engine movement is replaced once, a correct one is left", async () => {
  const W = "lothlorien:elven_warden";
  const wrong = mock.addEntity(W, { x: 5.5, y: 70, z: 5.5 }, { components: { "minecraft:movement": { currentValue: 0.7 } }, nameTag: "Haldir" });
  const right = mock.addEntity(W, { x: 9.5, y: 70, z: 5.5 }, { components: { "minecraft:movement": { currentValue: 0.25 } } });
  mock.onSpawn = (e) => { e.components = { "minecraft:movement": { currentValue: 0.25 } }; };
  await loadScript("warden_replace.js");
  assert.equal(mock.subscribers("after", "entitySpawn"), 0, "subscribes only after worldLoad");
  mock.fire("worldLoad", {});
  mock.fire("entitySpawn", { entity: wrong }); mock.fire("entityLoad", { entity: wrong }); mock.fire("entityLoad", { entity: right });
  await mock.settle();
  assert.equal(wrong.isValid, false); assert.equal(right.isValid, true);
  assert.equal(mock.spawned.length, 1, "exactly one replacement (idempotent for the second event, and the fresh one is not replaced again)");
  assert.equal(mock.spawned[0].entity.nameTag, "Haldir"); assert.equal(mock.spawned[0].opts.spawnEvent, "lothlorien:village_warden");
});
// ---- civilian elves (M1): elf_village.js inside the planner run, elf.js hurt handling ----
const EL = await import(`${SRC}elf_rules.js`);
const POST = EL.POST_ID, ELF = EL.ELF_ID;
const postsLeft = () => mock.dimension().getEntities({ type: POST }).length;
const elvesSpawned = () => mock.spawned.filter((s) => s.entity.typeId === ELF);
const cellKey = (loc) => `${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
// synthetic posts at real deck cells of V2: the Loremaster and the reserves beside one marker, a home post beside each of `homes` other markers
function addPosts(homes) {
  const n = f.markers.length, at = (i) => { const m = f.markers[Math.floor(i * n / 7)]; return { x: Math.floor(m[0]) + 0.5, y: Math.floor(m[1]), z: Math.floor(m[2]) + 0.5 }; };
  const post = (kind, l) => mock.addEntity(POST, l, { components: { "minecraft:type_family": { getTypeFamilies: () => ["lothlorien_elf_post", `elf_post_${kind}`, "inanimate"] } } });
  const l0 = at(0), lore = post("loremaster", l0);
  const reserves = [1, 2, 3, 4].map((d) => post("reserve", { ...l0, x: l0.x + d }));
  const home = Array.from({ length: homes }, (_, i) => post("home", at(i + 1)));
  return { lore, reserves, home };
}
const homeRecords = () => EL.parseHomes(world.getDynamicProperty(EL.HOMES_PROPERTY));

await scenario("elves: the planner run turns the posts into the five professions, records the homes, removes the posts; a later re-plan spawns nothing", async () => {
  const markers = setupV2(), { lore, reserves, home } = addPosts(5);
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.settle();
  const elves = elvesSpawned(), events = elves.map((s) => s.opts.spawnEvent);
  assert.equal(elves.length, 5, "exactly five elves");
  assert.deepEqual(events, [EL.spawnEventOf("loremaster"), ...EL.HOME_ORDER.map(EL.spawnEventOf)], "Loremaster first, then the four professions in HOME_ORDER");
  assert.equal(cellKey(elves[0].entity.location), cellKey(lore.location), "the Loremaster stands on its post");
  const site = (e) => EL.homeSite(v2At, Math.floor(e.location.x), Math.floor(e.location.y) - 1, Math.floor(e.location.z));
  const dist = (e) => Math.hypot(e.location.x - lore.location.x, e.location.z - lore.location.z);
  const want = home.map((e) => ({ e, room: site(e)?.k >= EL.HOME_MIN ? 0 : 1 })).sort((a, b) => a.room - b.room || dist(a.e) - dist(b.e) || a.e.location.x - b.e.location.x || a.e.location.z - b.e.location.z).slice(0, 4);
  want.forEach((w, i) => assert.equal(cellKey(elves[i + 1].entity.location), cellKey(w.e.location), `${EL.HOME_ORDER[i]} on the ${i + 1}. tree (room first, then nearest to the Loremaster)`));
  for (const s of elves) assert.equal(s.entity.getDynamicProperty(EL.HOME_OF_ELF), cellKey(s.entity.location), "the home note is the post cell");
  assert.equal(mock.propWrites.filter((k) => k === EL.HOMES_PROPERTY).length, 1, "the record is written once");
  const rec = homeRecords();
  assert.equal(rec.length, 1); assert.equal(rec[0].homes.length, 4); assert.deepEqual(rec[0].homes.map((h) => h.p), EL.HOME_ORDER);
  assert.deepEqual(rec[0].loremaster, [Math.floor(lore.location.x), Math.floor(lore.location.y), Math.floor(lore.location.z)]);
  assert.equal(postsLeft(), 0, "every post is removed, the unused fifth home post too"); assert.ok(reserves.every((r) => !r.isValid));
  assert.equal(grep(/elves: village at/).length, 1, "one elves line"); assert.match(grep(/elves: village at/)[0], /loremaster \+ 4 on own trees \(0 on reserves\)/);
  // a manual re-plan finds no posts: it spawns nothing and writes no record
  const marker = mock.addEntity(MARKER, { x: f.markers[3][0], y: f.markers[3][1], z: f.markers[3][2] });
  const mod = await loadScript("loop_marker.js"), sent = [];
  mod.planNearest({ dimension: mock.dimension(), location: { ...marker.location }, sendMessage: (m) => sent.push(m) });
  await mock.settle();
  assert.equal(sent.length, 1, "the re-plan ran"); assert.equal(elvesSpawned().length, 5, "no new elves"); assert.equal(homeRecords().length, 1, "no second record");
  assert.equal(grep(/elves: village at/).length, 1, "and no second elves line");
});

await scenario("elves: with only 2 home posts the other 2 professions stand on the nearest reserve posts - still five elves", async () => {
  const markers = setupV2(), { reserves } = addPosts(2);
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.settle();
  const elves = elvesSpawned();
  assert.equal(elves.length, 5);
  assert.deepEqual(elves.map((s) => s.opts.spawnEvent), [EL.spawnEventOf("loremaster"), ...EL.HOME_ORDER.map(EL.spawnEventOf)]);
  assert.equal(cellKey(elves[3].entity.location), cellKey(reserves[0].location), "woodwright on the nearest reserve");
  assert.equal(cellKey(elves[4].entity.location), cellKey(reserves[1].location), "lamplighter on the next one");
  assert.equal(homeRecords()[0].homes.filter((h) => h.site === null).length >= 2, true, "reserve homes have no site");
  assert.match(grep(/elves: village at/)[0], /loremaster \+ 2 on own trees \(2 on reserves\)/);
  assert.equal(postsLeft(), 0);
});

await scenario("elves: a spawn error for one elf keeps its post, the planner still finishes, nothing throws", async () => {
  const markers = setupV2(), { home } = addPosts(5);
  mock.onSpawn = (e, opts) => { if (opts.spawnEvent === EL.spawnEventOf("gardener")) throw new Error("boom"); };
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.settle();
  assert.equal(grep(/planner: village at/).length, 1, "the planner summary line still comes");
  assert.equal(markersLeft(), 0, "markers removed as always");
  assert.equal(grep(/could not spawn the gardener/).length, 1); assert.match(grep(/elves: village at/)[0], /1 failed/);
  assert.equal(postsLeft(), 1, "only the failed post is kept");
  assert.equal(homeRecords()[0].homes.length, 3, "the record lists the three elves that exist");
  assert.ok(home.some((h) => h.isValid), "the kept post is one of the home posts");
});

await scenario("elf.js: a hit on an elf charges a fight per 60 s window and tags the player as foe for 60 s after the LAST hit; other mobs and stale tags", async () => {
  const realNow = Date.now; let now = 1_000_000;
  Date.now = () => now;
  try {
    const player = mock.addEntity("minecraft:player", { x: 0, y: 70, z: 0 }), elf = mock.addEntity(ELF, { x: 1, y: 70, z: 1 }), deer = mock.addEntity("lothlorien:deer", { x: 2, y: 70, z: 2 });
    mock.players.push(player);
    const fights = [];
    const mod = await loadScript("elf.js");
    mod.startElves({ recordFight: (p, e) => fights.push([p, e]) });
    const hit = (target, by = player) => mock.fire("entityHurt", { hurtEntity: target, damageSource: { damagingEntity: by } });
    hit(deer); hit(elf, elf);
    assert.equal(fights.length, 0); assert.equal(player.hasTag(EL.FOE_TAG), false, "other mobs and non-player hitters do nothing");
    hit(elf);
    assert.equal(fights.length, 1); assert.equal(fights[0][1], elf); assert.ok(player.hasTag(EL.FOE_TAG));
    await mock.advance(200); now += 10_000; hit(elf); // 10 s later: the same fight, the tag timer starts over
    assert.equal(fights.length, 1, "no second fight within 60 s");
    await mock.advance(1100); now += 55_000; // 55 s after the second hit, 65 s after the first
    assert.ok(player.hasTag(EL.FOE_TAG), "the first hit's timer must not remove the tag early");
    await mock.advance(150); now += 7_500;
    assert.equal(player.hasTag(EL.FOE_TAG), false, "60 s after the last hit the tag is gone");
    now += 61_000; hit(elf);
    assert.equal(fights.length, 2, "a hit more than 60 s after the previous one is a new fight"); assert.ok(player.hasTag(EL.FOE_TAG));
    mock.fire("playerSpawn", { player, initialSpawn: false }); assert.ok(player.hasTag(EL.FOE_TAG), "a respawn keeps the tag");
    mock.fire("playerSpawn", { player, initialSpawn: true }); assert.equal(player.hasTag(EL.FOE_TAG), false, "a stale tag is dropped on joining");
    hit(elf); mock.fire("playerLeave", { playerId: player.id });
    await mock.settle(); // the pending timer of a player who left does nothing and throws nothing
  } finally { Date.now = realNow; }
});
console.warn = realWarn;
