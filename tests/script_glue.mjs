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
const { resetEntityEvents } = await import("../lothlorien_bp/scripts/entity_events.js"); // one shared instance (mock.reset() drops its subscriptions)
const PL = await import("../lothlorien_bp/scripts/village_planner.js");
const DBG = await import("../lothlorien_bp/scripts/village_debug.js"); // shared switch: not re-imported per scenario, so reset below
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
  lines.length = 0; mock.reset(); resetEntityEvents(); runNo++;
  DBG.setVillageDebug(true); // diagnostics log only in debug mode; the scenarios read them (the quiet-mode scenario switches it off)
  try { await body(); } catch (e) { console.warn = realWarn; console.log(`log of the failed scenario "${name}":\n  ${lines.join("\n  ")}`); throw e; }
  assert.deepEqual(mock.errors, [], `${name}: no uncaught error in a timer or job`);
  console.warn = realWarn; console.log(`ok   script glue: ${name}`); console.warn = (...a) => { lines.push(a.join(" ")); };
}
// debug-gated planner lines read as plain `planner: ...` unless the pattern asks for the "(debug)" marker itself
const grep = (re) => { const keep = re.source.includes("(debug"); return lines.map((l) => (keep ? l : l.replace("planner: (debug) ", "planner: "))).filter((l) => re.test(l)); };
const loadScript = (file) => import(`${SRC}${file}?run=${runNo}`);
// The shared mock has no Dimension.fillBlocks / heightRange yet: a test-local shim with the engine's contract (cells of the filtered types in the volume become the
// block; unreadable cells are skipped with ignoreChunkBoundErrors, else it throws; returns an object with getCapacity()). Calls are recorded in dim.fills.
function shimFill(dim) {
  dim.fills = [];
  dim.fillBlocks = (volume, block, options = {}) => {
    const { from, to } = volume, inc = options.blockFilter?.includeTypes;
    dim.fills.push({ from, to, options });
    let n = 0;
    for (let x = from.x; x <= to.x; x++) for (let z = from.z; z <= to.z; z++) {
      if (!dim.readable(x, z)) { if (options.ignoreChunkBoundErrors) continue; throw new Error("UnloadedChunksError"); }
      for (let y = from.y; y <= to.y; y++) { const t = dim.typeAt(x, y, z); if (t !== undefined && (!inc || inc.includes(t))) { dim.overrides.set(`${x},${y},${z}`, { id: block, states: {} }); n++; } }
    }
    return { getCapacity: () => n };
  };
  dim.heightRange = { min: -64, max: 320 };
  return dim;
}
function setupV2() {
  shimFill(mock.dimension());
  mock.strictLoading = true; // blocks only readable inside a ready ticking area: the planner must have loaded the village itself
  mock.setBlocks(v2At);
  return f.markers.map((p) => mock.addEntity(MARKER, { x: p[0], y: p[1], z: p[2] }));
}
const markersLeft = () => mock.dimension().getEntities({ type: MARKER }).length;

await scenario("an automatic entityLoad plans the village once, removes the markers, writes the done-list", async () => {
  const markers = setupV2();
  await loadScript("loop_marker.js");
  let layerCalls = 0;
  const dim = mock.dimension(), getBlocks = dim.getBlocks.bind(dim);
  dim.getBlocks = (volume, filter, allowUnloaded) => { if (volume.from.y === volume.to.y) layerCalls++; return getBlocks(volume, filter, allowUnloaded); };
  assert.equal(mock.subscribers("after", "entityLoad"), 1); assert.equal(mock.subscribers("after", "entitySpawn"), 1);
  // seeded shield cells: light_block_0 in the village (cleared), light_block_1 beside it (hidden spawn light, stays), light_block_0 far below the band and far outside the rect (stay)
  const ov = mock.dimension().overrides, mx = Math.floor(f.markers[0][0]), my = Math.floor(f.markers[0][1]) - 1, mz = Math.floor(f.markers[0][2]);
  const seeded0 = [[mx, my + 6, mz], [mx + 3, my + 8, mz + 2], [mx - 5, my + 12, mz - 4]], seeded1 = [[mx + 1, my + 6, mz], [mx + 1, my + 9, mz + 2]], kept0 = [[mx, my - 40, mz], [mx + 400, my + 6, mz]];
  for (const c of seeded0) ov.set(c.join(","), { id: "minecraft:light_block_0", states: {} });
  for (const c of seeded1) ov.set(c.join(","), { id: "minecraft:light_block_1", states: {} });
  for (const c of kept0) ov.set(c.join(","), { id: "minecraft:light_block_0", states: {} });
  for (const i of [0, 7, 30]) mock.fire("entityLoad", { entity: markers[i] }); // several trees of one village load in the same moment
  mock.fire("entitySpawn", { entity: markers[1] });
  await mock.advance(20);
  const territory = PL.parseDone(world.getDynamicProperty("lothlorien:village_areas"));
  assert.equal(territory.length, 1, "discovery saves the full area before repair planning completes");
  assert.ok(markers.every((m) => PL.inRect(territory[0], m.location.x, m.location.z)), "the discovered area covers every village marker");
  assert.equal(world.getDynamicProperty("lothlorien:village_plans"), undefined, "territory is available during the settle delay");
  await mock.settle();
  assert.equal(grep(/planner: start for village/).length, 1, "exactly one planner run per village");
  assert.match(grep(/planner: start for village/)[0], /trigger entityLoad/);
  assert.equal(grep(/planner: village at/).length, 1, "one summary line");
  assert.equal(markersLeft(), 0, "every marker of the village is removed");
  const id = (c) => mock.dimension().typeAt(...c);
  assert.deepEqual(seeded0.map(id), seeded0.map(() => "minecraft:air"), "the final step clears every light_block_0 of the village");
  assert.deepEqual(seeded1.map(id), seeded1.map(() => "minecraft:light_block_1"), "light_block_1 (hidden spawn light) stays");
  assert.deepEqual(kept0.map(id), kept0.map(() => "minecraft:light_block_0"), "light_block_0 outside the village rect and the Y band stays");
  const fills = mock.dimension().fills;
  assert.ok(fills.length >= 1 && fills.every((c) => c.options.blockFilter.includeTypes.join() === "minecraft:light_block_0" && c.options.ignoreChunkBoundErrors === true && (c.from.x >> 4) === (c.to.x >> 4) && (c.from.z >> 4) === (c.to.z >> 4)), "fillBlocks: only light_block_0, one chunk column per call");
  const clearLine = grep(/planner: clear \d+ ms wall, \d+ ticks, y -?\d+\.\.-?\d+, \d+ slices \(0 failed\), \d+ inner steps, \d+ ms inside them, 3 light_block_0 cells cleared/);
  assert.equal(clearLine.length, 1, "one debug line for the clear step: " + grep(/planner: clear/).join("|"));
  const done = PL.parseDone(world.getDynamicProperty("lothlorien:village_plans"));
  assert.equal(done.length, 1, "done-list holds the village"); assert.equal(mock.propWrites.filter((k) => k === "lothlorien:village_plans").length, 1);
  assert.ok(mock.areaLog.created.length >= 2 && mock.areaLog.created.length === mock.areaLog.removed.length && mock.tickingAreas.areas.size === 0, "ticking areas created round by round and all removed again");
  assert.match(grep(/planner: village at/)[0], new RegExp(`${direct.picks.length} link\\(s\\)`), "the same number of links as the pure planner picks on the fixture");
  const ropeFix = direct.repairs.filter((p) => p.kind === "rope"), flares = direct.repairs.filter((p) => p.kind === "flare");
  assert.equal(ropeFix.length, 1, "V2 is the owner's old-offset village: its rope is buried by one piece"); assert.equal(ropeFix[0].buried, 1);
  assert.ok(flares.length >= 1, "the pillars of its balconies / lookouts get root flares at the real ground");
  assert.match(grep(/planner: village at/)[0], new RegExp(`${direct.repairs.length} repair\\(s\\)`)); assert.equal(grep(/planner:   rope at \d+,\d+: -1 buried, \+0 hung/).length, 1, "one rope repair line");
  assert.equal(grep(/planner:   pillar at \d+,\d+: \d roots/).length, flares.length, "one line per flare");
  for (const b of direct.repairs.flatMap((p) => p.blocks)) assert.equal(mock.dimension().overrides.get(`${b.x},${b.y},${b.z}`)?.id, b.id, "the repairs (buried rope piece back to terrain, root logs) were written into the world");
  assert.match(grep(/planner: village at/)[0], / in \d+\.\d s$/, "the summary ends with the elapsed time");
  assert.equal(grep(/write\(s\) failed/).length, 0, "no false write failures");
  assert.ok(layerCalls > 0, "the full-area scans use the native filtered layer query");
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

await scenario("shield clear: a throwing fillBlocks slice is logged and the next slices still run; the village build still finishes", async () => {
  const markers = setupV2();
  const dim = mock.dimension(), fill = dim.fillBlocks;
  let calls = 0;
  dim.fillBlocks = (...a) => { if (calls++ === 0) throw new Error("boom"); return fill(...a); };
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.settle();
  assert.ok(calls > 1, `${calls} fill calls`);
  assert.equal(grep(/planner: shield clear .*boom/).length, 1, "the failing slice is logged unconditionally");
  assert.equal(grep(/planner: clear .*\(1 failed\)/).length, 1, "the debug line counts the failed slice");
  assert.equal(markersLeft(), 0, "the village was built and its markers removed");
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
  DBG.setVillageDebug(false);
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] }); mock.fire("entityLoad", { entity: markers[0] });
  await mock.settle();
  assert.equal(lines.filter((l) => /\[lothlorien\] planner:/.test(l)).length, 0, "no planner line at all without debug mode (the run succeeded)");
  DBG.setVillageDebug(true);
  const late = mock.addEntity(MARKER, { x: f.markers[3][0], y: f.markers[3][1], z: f.markers[3][2] });
  mock.fire("entityLoad", { entity: late }); mock.fire("entityLoad", { entity: late });
  await mock.settle();
  assert.ok(grep(/\(debug\).*already seen/).length === 1 && grep(/\(debug\).*straggler of a planned village/).length === 1, grep(/\(debug\)/).join("\n"));
});

await scenario("a quota that is too small gives up cleanly: markers stay, tries counted, areas removed, no done-list, no second run this session", async () => {
  const markers = setupV2();
  mock.tickingAreas.maxChunkCount = 6;
  await loadScript("loop_marker.js");
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

// These scenarios exercise asynchronous completion orders, not observations of
// native pending-area cancellation. Both registration orders must be safe.
await scenario("planner timeout releases an already registered area before its loading promise settles", async () => {
  const markers = setupV2();
  mock.tickingAreaDelay = 700;
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.advance(610);
  assert.equal(grep(/gave up: ticking area .* timed out/).length, 1);
  assert.equal(mock.tickingAreas.areas.size, 0, "registered area removed at timeout");
  assert.equal(markersLeft(), markers.length);
  assert.equal(world.getDynamicProperty("lothlorien:village_plans"), undefined);
  await mock.settle();
  assert.equal(mock.areaLog.created.length, 1);
  assert.equal(mock.areaLog.removed.length, 1, "late resolution tolerates an already removed area");
  assert.equal(grep(/could not remove ticking area/).length, 0);
});

await scenario("late area creation cleans its ended attempt without resuming the planner", async () => {
  const markers = setupV2(), tam = mock.tickingAreas;
  const create = tam.createTickingArea.bind(tam), pending = [];
  // Model registration after the timeout, leaving the promise under this scenario's control.
  tam.createTickingArea = (id, options) => new Promise((resolve, reject) => pending.push({ id, options, resolve, reject }));
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.advance(610);
  assert.equal(pending.length, 1);
  assert.equal(markers[0].getDynamicProperty("lothlorien:loop_tries"), 1);
  assert.equal(tam.areas.size, 0);
  const [old] = pending;
  const ready = create(old.id, old.options);
  await mock.advance(3);
  await ready;
  old.resolve();
  await mock.advance(1);
  assert.equal(tam.hasTickingArea(old.id), false, "late success from the timed-out attempt removed");
  assert.equal(markersLeft(), markers.length, "the timed-out attempt did not resume building");
  await mock.settle();
  assert.equal(tam.areas.size, 0);
  assert.equal(grep(/could not remove ticking area/).length, 0);
});

await scenario("a pending creation rejection after timeout is consumed without resuming the planner", async () => {
  const markers = setupV2();
  let rejectCreation;
  mock.tickingAreas.createTickingArea = () => new Promise((resolve, reject) => { rejectCreation = reject; });
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.advance(610);
  rejectCreation(new Error("simulated pending request cancellation"));
  await mock.advance(1);
  assert.equal(grep(/gave up:/).length, 1);
  assert.equal(grep(/could not remove ticking area/).length, 0);
  assert.equal(markersLeft(), markers.length);
  assert.equal(world.getDynamicProperty("lothlorien:village_plans"), undefined);
});

await scenario("cleanup failure is reported and pending completion retries only that owned area", async () => {
  const markers = setupV2(), tam = mock.tickingAreas;
  mock.tickingAreaDelay = 700;
  const remove = tam.removeTickingArea.bind(tam);
  let failOnce = true;
  tam.removeTickingArea = (id) => {
    if (failOnce) { failOnce = false; throw new Error("simulated removal error"); }
    remove(id);
  };
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.advance(610);
  assert.equal(grep(/could not remove ticking area .*simulated removal error/).length, 1);
  assert.equal(tam.areas.size, 1, "failed cleanup is not treated as successful removal");
  await mock.settle();
  assert.equal(tam.areas.size, 0, "pending completion retries the owned area's cleanup");
  assert.equal(mock.areaLog.removed.length, 1);
  assert.equal(markersLeft(), markers.length);
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
  mock.reset(); resetEntityEvents(); runNo++; mock.strictLoading = true; mock.setBlocks(() => FENCE);
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
// ---- civilian elves (M1): elf_village.js inside the planner run, the elf hurt handling in elven_warden.js ----
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
});

await scenario("elves: two neighbouring villages in one planner run each get a Loremaster and their own professions", async () => {
  mock.setBlocks((x, y) => (y === 79 ? "lothlorien:mallorn_planks" : "minecraft:air"));
  const mod = await loadScript("elf_village.js");
  const post = (kind, x, z) => mock.addEntity(POST, { x: x + 0.5, y: 80, z: z + 0.5 }, { components: { "minecraft:type_family": { getTypeFamilies: () => [`elf_post_${kind}`] } } });
  post("loremaster", 0, 0); post("loremaster", 120, 0);
  for (const x of [10, 20, 30, 40, 80, 90, 100, 110]) post("home", x, 10);
  mod.populateVillage(mock.dimension(), { x0: -50, x1: 200, z0: -50, z1: 60 }, [0, 0]);
  const elves = elvesSpawned(), side = (s) => (s.entity.location.x < 60 ? "west" : "east");
  for (const half of ["west", "east"]) assert.deepEqual(elves.filter((s) => side(s) === half).map((s) => s.opts.spawnEvent).sort(), [EL.spawnEventOf("loremaster"), ...EL.HOME_ORDER.map(EL.spawnEventOf)].sort(), `${half} village: all five professions`);
  assert.equal(postsLeft(), 0);
  assert.equal(homeRecords().length, 2, "one record per village"); assert.equal(mock.propWrites.filter((k) => k === EL.HOMES_PROPERTY).length, 1, "written once");
});

await scenario("elven_warden.js (elves): a release (rehome event) records the new home and the moved flag; other events, other mobs and a missing entity change nothing", async () => {
  const mod = await loadScript("elven_warden.js");
  mod.startElvenWardens(() => ({ level: 0 }), () => "neutral");
  assert.equal(mock.subscribers("after", "dataDrivenEntityTrigger"), 2, "the rehome handler and the warden shout");
  const elf = mock.addEntity(ELF, { x: 10.5, y: 70, z: 10.5 }), deer = mock.addEntity("lothlorien:deer", { x: 11, y: 70, z: 11 });
  elf.setDynamicProperty(EL.HOME_OF_ELF, "0,70,0");
  mock.fire("dataDrivenEntityTrigger", { entity: elf, eventId: "lothlorien:leashed" });
  mock.fire("dataDrivenEntityTrigger", { entity: deer, eventId: EL.REHOME_EVENT });
  assert.equal(elf.getDynamicProperty(EL.HOME_OF_ELF), "0,70,0"); assert.equal(elf.getDynamicProperty(EL.MOVED_PROPERTY), undefined); assert.equal(deer.getDynamicProperty(EL.HOME_OF_ELF), undefined);
  elf.location = { x: -3.2, y: 64, z: 40.9 };
  mock.fire("dataDrivenEntityTrigger", { entity: elf, eventId: EL.REHOME_EVENT });
  assert.equal(elf.getDynamicProperty(EL.HOME_OF_ELF), "-4,64,40", "floored feet cell"); assert.equal(elf.getDynamicProperty(EL.MOVED_PROPERTY), true);
  mock.fire("dataDrivenEntityTrigger", { entity: { typeId: ELF, get location() { throw new Error("gone"); }, setDynamicProperty() {} }, eventId: EL.REHOME_EVENT }); // an unloaded entity throws: swallowed
});

await scenario("harmony: elf and warden deeds count outside the forest, a deer outside costs nothing", async () => {
  const H = await import(`${SRC}harmony.js`), HG = await import(`${SRC}harmony_game.js`);
  const player = mock.addEntity("minecraft:player", { x: 0, y: 70, z: 0 }), elf = mock.addEntity(ELF, { x: 1, y: 70, z: 1 }, { components: { "minecraft:type_family": { getTypeFamilies: () => [EL.ELF_FAMILY, "mob"] } } }), deer = mock.addEntity("lothlorien:deer", { x: 2, y: 70, z: 2 });
  mock.players.push(player); const said = []; player.sendMessage = (m) => said.push(m); player.onScreenDisplay = { setActionBar() {} };
  assert.equal(H.deedKindOf("lothlorien:deer", []), "animal", "sanity: a deer would be charged inside the forest");
  HG.startHarmony(() => false, "dbg");
  const harmony = () => H.parse(player.getDynamicProperty("lothlorien:harmony")).harmony;
  const base = harmony();
  mock.fire("entityDie", { deadEntity: deer, damageSource: { damagingEntity: player } });
  assert.equal(harmony(), base, "a deer outside the forest: unchanged");
  mock.fire("entityDie", { deadEntity: elf, damageSource: { damagingEntity: player } });
  assert.equal(harmony(), base - H.deedCost("elf_kill"), "an elf killed outside the forest still costs the elf-kill penalty");
  HG.recordElfFight(player, elf); HG.recordWardenFight(player, elf);
  assert.equal(harmony(), base - H.deedCost("elf_kill") - H.deedCost("elf_fight") - H.deedCost("warden_fight"), "fights count outside too");
});

await scenario("harmony: inside the forest monsters and players the wardens hunt are free kills; any other player costs", async () => {
  const H = await import(`${SRC}harmony.js`), HG = await import(`${SRC}harmony_game.js`);
  const fam = (list) => ({ components: { "minecraft:type_family": { getTypeFamilies: () => list } } });
  const player = mock.addEntity("minecraft:player", { x: 0, y: 70, z: 0 }), zombie = mock.addEntity("minecraft:zombie", { x: 1, y: 70, z: 1 }, fam(["zombie", "monster", "mob"]));
  const hated = mock.addEntity("minecraft:player", { x: 2, y: 70, z: 2 }, fam(["player"])), foe = mock.addEntity("minecraft:player", { x: 3, y: 70, z: 3 }, fam(["player"])), other = mock.addEntity("minecraft:player", { x: 4, y: 70, z: 4 }, fam(["player"]));
  hated.setDynamicProperty("lothlorien:harmony", H.serialize({ harmony: -40, timer: 0 })); hated.addTag(HG.HATED_TAG); foe.addTag("lothlorien_elf_foe");
  for (const p of [player, hated, foe, other]) { p.sendMessage = () => {}; p.onScreenDisplay = { setActionBar() {} }; }
  HG.startHarmony(() => true, "dbg");
  const harmony = () => HG.harmonyOf(player).harmony;
  for (const victim of [zombie, hated, foe]) mock.fire("entityDie", { deadEntity: victim, damageSource: { damagingEntity: player } });
  assert.equal(harmony(), 0, "a zombie, a Hated player and an elf foe cost nothing");
  assert.equal(HG.harmonyOf(hated).harmony, H.HATED_DEATH_HARMONY, "the Hated victim's own death reset still applies");
  mock.fire("entityDie", { deadEntity: other, damageSource: { damagingEntity: player } });
  assert.equal(harmony(), -H.deedCost("player"), "an ordinary player still costs");
  const rideable = (riders) => ({ components: { "minecraft:type_family": { getTypeFamilies: () => ["horse", "mob"] }, "minecraft:rideable": { getRiders: () => riders } } });
  const baby = mock.addEntity("minecraft:zombie", { x: 5, y: 70, z: 5 }, fam(["zombie", "monster", "mob"]));
  const jockeyHorse = mock.addEntity("minecraft:horse", { x: 5, y: 70, z: 5 }, rideable([baby])), plainHorse = mock.addEntity("minecraft:horse", { x: 6, y: 70, z: 6 }, rideable([]));
  for (const horse of [jockeyHorse, plainHorse]) mock.fire("entityHurt", { hurtEntity: horse, damageSource: { damagingEntity: player } }, "before");
  const before = harmony();
  mock.fire("entityDie", { deadEntity: jockeyHorse, damageSource: { damagingEntity: player } });
  assert.equal(harmony(), before, "a horse that carried a zombie when hit is free");
  mock.fire("entityDie", { deadEntity: plainHorse, damageSource: { damagingEntity: player } });
  assert.ok(harmony() < before, "a riderless horse still costs");
});

// ---- planner speed: the time-boxed job driver and the timing log ----
await scenario("loop_marker.js: sliced() runs many inner steps per engine step, returns the same value, counts steps; the timing log lines appear in debug mode", async () => {
  const mod = await loadScript("loop_marker.js");
  const steps = 300, mk = function* () { for (let i = 0; i < steps; i++) yield i; return "done"; };
  let t = 0; const now = () => (t += 1); // every clock read is 1 ms
  const stats = { steps: 0, cpu: 0 }, g = mod.sliced(mk(), 8, stats, now);
  let engineSteps = 0, r;
  while (!(r = g.next()).done) engineSteps++;
  assert.equal(r.value, "done"); assert.equal(stats.steps, steps + 1, "every inner step counted (plus the finishing one)");
  assert.ok(engineSteps < steps / 2 && engineSteps > 10, `${engineSteps} engine steps for ${steps} inner steps`);
  const markers = setupV2();
  await loadScript("loop_marker.js");
  mock.fire("entityLoad", { entity: markers[0] });
  await mock.settle();
  for (const re of [/\(debug\) discovery lothlorien_village_-?\d+_-?\d+_\d+_1: \d+ chunks in \d+ ms/, /\(debug\) settle \d+ ms/, /\(debug\) plan\+build \d+ ms wall, \d+ ticks, \d+ inner steps, \d+ ms inside them, \d+ distinct reads, \d+ cells written/, /\(debug\) populate \d+ ms/]) assert.equal(grep(re).length, 1, String(re));
});

await scenario("rail connections: deferred player edits link moss and slabs, clear removed targets, and finish with no timer", async () => {
  const F="lothlorien:mallorn_fence";
  mock.setBlocks((x,y,z)=>y===70 && x===0 && z===0 ? F : "minecraft:air");
  const dim=mock.dimension();
  await loadScript("rail_mender.js");
  const put=(x,z,id)=>{const b=dim.getBlock({x,y:70,z});b.setType(id);mock.fire("playerPlaceBlock",{block:b,dimension:dim});};
  put(1,0,"minecraft:moss_block"); put(0,1,"lothlorien:mallorn_slab");
  await mock.settle();
  let st=dim.overrides.get("0,70,0").states;
  assert.equal(st["minecraft:connection_east"],true); assert.equal(st["minecraft:connection_south"],true);
  const gone=dim.getBlock({x:1,y:70,z:0});gone.setType("minecraft:air");
  mock.fire("playerBreakBlock",{block:gone,dimension:dim});
  await mock.settle(); st=dim.overrides.get("0,70,0").states;
  assert.equal(st["minecraft:connection_east"],false); assert.equal(st["minecraft:connection_south"],true);
  assert.equal(mock.pending,0,"no permanent fence poll");
});

await scenario("rail mender: duplicate marker events during a running scan do not launch a second scan", async () => {
  mock.stepsPerTick=1;
  mock.setBlocks((x,y,z)=>y===70 && z===0 && x>=0 && x<20 ? "lothlorien:mallorn_fence" : "minecraft:air");
  const e=mock.addEntity("lothlorien:rail_mender",{x:1,y:70,z:0});
  const dim=mock.dimension(), get=dim.getBlocks.bind(dim);let scans=0;
  dim.getBlocks=(...args)=>{scans++;return get(...args);};
  await loadScript("rail_mender.js");mock.fire("entityLoad",{entity:e});
  await mock.advance(41);mock.fire("entityLoad",{entity:e});mock.fire("entitySpawn",{entity:e});
  await mock.settle();assert.equal(scans,1);assert.equal(e.isValid,false);assert.equal(mock.pending,0);
});

await scenario("rail mender: loaded corners do not hide an unloaded interior chunk", async () => {
  mock.strictLoading=true;
  const dim=mock.dimension();
  for(let x=-2;x<=1;x++)for(let z=-2;z<=1;z++)if(x!==0||z!==0)dim.alwaysLoaded.add(`${x},${z}`);
  mock.setBlocks((x,y,z)=>x===0&&y===70&&z===0?"lothlorien:mallorn_fence":"minecraft:air");
  let scans=0;const get=dim.getBlocks.bind(dim);dim.getBlocks=(...args)=>{scans++;return get(...args);};
  const e=mock.addEntity("lothlorien:rail_mender",{x:0,y:70,z:0});
  await loadScript("rail_mender.js");mock.fire("entityLoad",{entity:e});
  await mock.advance(40);assert.equal(scans,0);assert.equal(e.isValid,true);
  dim.alwaysLoaded.add("0,0");await mock.settle();assert.equal(scans,1);assert.equal(e.isValid,false);
});

await scenario("rail mender: edits in one tick share one repair timer and still mend the neighbours", async () => {
  mock.setBlocks((x, y, z) => y === 70 && z === 0 && x >= 0 && x < 6 ? "lothlorien:mallorn_fence" : "minecraft:air");
  const dim = mock.dimension();
  await loadScript("rail_mender.js");
  const edit = x => mock.fire("playerPlaceBlock", { block: { location: { x, y: 70, z: 0 } }, dimension: dim });
  edit(1); edit(4);
  assert.equal(mock.pending, 1, "two edits in one tick: one timer");
  await mock.settle();
  const st = (x) => dim.overrides.get(`${x},70,0`)?.states ?? {};
  assert.equal(st(1)["minecraft:connection_east"], true); assert.equal(st(4)["minecraft:connection_west"], true);
  await mock.advance(1); edit(2); assert.equal(mock.pending, 1, "a later tick starts its own timer");
  await mock.settle();
});

await scenario("entityHurt before-subscriptions pass allowedDamageCauses (the engine skips every other hurt in the world)", async () => {
  const seen = [], hurt = world.beforeEvents.entityHurt, subscribe = hurt.subscribe.bind(hurt);
  hurt.subscribe = (fn, options) => { seen.push(options); return subscribe(fn); };
  (await loadScript("elven_warden.js")).startElvenWardens(() => ({ level: 2 }), () => 0);
  (await loadScript("harmony_game.js")).startHarmony(() => true, "dbg");
  assert.equal(seen.length, 2, "the warden and the Harmony handlers are the only before-hurt subscribers");
  assert.deepEqual(seen[0], { allowedDamageCauses: ["projectile"] }, "warden friendly fire: arrows only");
  assert.deepEqual(seen[1], { allowedDamageCauses: ["entityAttack", "projectile", "magic", "maceSmash", "thorns"] }, "Harmony mounts: the causes a player can inflict");
  const dts = readFileSync(new URL("../../../reference/server-2.8.0.d.ts", import.meta.url), "utf8"); // the manifest's @minecraft/server version
  for (const cause of seen.flatMap((o) => o.allowedDamageCauses)) assert.ok(new RegExp(`^    ${cause} = '${cause}',$`, "m").test(dts), `${cause} is an EntityDamageCause in 2.8.0`);
});

await scenario("renown: the Harmony nudge comes from a Harmony change (no poll), once, and needs a baseline taken with the lesson", async () => {
  const HG = await import(`${SRC}harmony_game.js`), RG = await loadScript("renown_game.js"); // renown_game.js imports the shared harmony_game.js
  const player = mock.addEntity("minecraft:player", { x: 0, y: 70, z: 0 }), said = [];
  player.sendMessage = (m) => said.push(JSON.stringify(m)); player.onScreenDisplay = { setActionBar() {} }; player.playSound = () => {};
  mock.players.push(player);
  const { system } = await import("@minecraft/server"), runInterval = system.runInterval; let intervals = 0;
  system.runInterval = (...args) => { intervals++; return runInterval.apply(system, args); };
  try { HG.startHarmony(() => true, "dbg"); RG.startRenown(() => true); } finally { system.runInterval = runInterval; }
  assert.equal(intervals, 1, "one interval (the Harmony second tick); the Renown nudge no longer polls");
  const setHarmony = (n) => HG.handleHarmonyEvent({ id: "lothlorien:harmony", message: String(n) }, player);
  const nudges = () => said.filter((m) => m.includes("lore.harmony.ready_chat")).length;
  RG.renownOf(player).task = { kind: "lesson", id: "harmony", ready: false, since: 0 };
  setHarmony(1); RG.baselineHarmonyNudge(player); // the lesson was just taken at Harmony 1
  setHarmony(2); assert.equal(nudges(), 0);
  setHarmony(3); assert.equal(nudges(), 1, "Harmony reaches the level while the lesson is the task");
  setHarmony(4); setHarmony(2); setHarmony(3); assert.equal(nudges(), 2, "and again after it dropped below and came back");
  RG.renownOf(player).task = null; setHarmony(1); setHarmony(5); assert.equal(nudges(), 2, "no nudge without the Harmony lesson as the task");
  RG.renownOf(player).task = { kind: "lesson", id: "harmony", ready: false, since: 0 };
  setHarmony(3); assert.equal(nudges(), 2, "no baseline: no nudge (a reload taught the lesson before)");
});

await scenario("debug switch follows the debug tag after a reload: tagged player -> planner debug lines on, untagged -> off; main.js calls it at world load and player spawn", async () => {
  const player = mock.addEntity("minecraft:player", { x: 0, y: 70, z: 0 });
  mock.players.push(player);
  const getPlayers = world.getPlayers; world.getPlayers = (o) => mock.players.filter((p) => (o?.tags ?? []).every((t) => p.hasTag(t))); // the mock ignores the tag filter
  try {
    DBG.setVillageDebug(false); // a fresh script load: the module variable starts off
    DBG.syncVillageDebug(world, "lothlorien_debug"); assert.equal(DBG.villageDebug(), false, "no tagged player: off");
    player.addTag("lothlorien_debug"); DBG.syncVillageDebug(world, "lothlorien_debug");
    assert.equal(DBG.villageDebug(), true, "tagged player after a reload: planner debug lines on");
    const markers = setupV2(); await loadScript("loop_marker.js");
    mock.fire("entityLoad", { entity: markers[0] }); mock.fire("entityLoad", { entity: markers[0] }); await mock.settle();
    assert.ok(grep(/\(debug\) plan\+build/).length === 1, "the planner debug line is printed");
  } finally { world.getPlayers = getPlayers; }
  const main = readFileSync(new URL(`${SRC}main.js`), "utf8"); // main.js needs server-ui, not in the mock: its two hooks are checked by text
  assert.ok(/worldLoad\.subscribe\(\(\) => \{\s*syncVillageDebug\(world, DEBUG_TAG\)/.test(main), "world load syncs the switch");
  assert.ok(/playerSpawn\.subscribe\([^\n]*initialSpawn[^\n]*syncVillageDebug\(world, DEBUG_TAG\)/.test(main), "a tagged player joining syncs the switch");
});

console.warn = realWarn;
