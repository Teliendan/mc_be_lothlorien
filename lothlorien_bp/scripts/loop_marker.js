// Village loop planner, runtime side (owner decision 2026-10-09: "build the planner", replaces the per-marker loop closer).
//
// Jigsaw only grows a tree. Every platform piece of an Elven village (central tree, node trees, towers, railing / balcony / lookout ends) carries
// invisible `lothlorien:loop_marker` entities. The FIRST marker that loads (the first tree that comes into simulation range, or the first one
// spawned by worldgen) starts ONE planner for its whole village; village_planner.js decides, this file only loads the village and writes:
//   1 queue      markers wait 5 ticks, then queue up; one planner runs at a time; a marker inside a rectangle that is being planned, was planned
//                ("lothlorien:village_plans" done-list on the world) or failed this session is dropped / removed.
//   2 load       script ticking areas (world.tickingAreaManager) around the known markers, grown round by round until no new marker shows up
//                (discoverVillage), so the planner never depends on where the player stands. The areas are removed again in `finally`.
//   3 plan       planGen on the blocks of that area (budget 3 extra links), run as a job (yields, no long tick).
//   4 build      all picks are written in the same job (2 ms slices, a time check every WRITES_PER_CHECK writes), then every marker in the area is removed.
//   5 populate   civilian elves: the tree pieces' `lothlorien:elf_post` entities are read, assigned and replaced by elves (elf_village.js).
//   6 clear      every minecraft:light_block_0 of the village (the worldgen headroom shield) becomes air, so beds work (village_clear.js); still inside the
//                ticking areas, which are released afterwards. Existing, already built villages keep their shield (owner decision).
// The planner is one-shot: no polling, no retry loop. A failed run (quota, timeout, error) keeps the markers; they retry after world re-entry, at
// most AREA.maxTries times per marker.
import { BlockPermutation, BlockVolume, system, world } from "@minecraft/server";
import { onEntity } from "./entity_events.js";
import { MARKER_ID } from "./village_loop.js";
import { villageDebug } from "./village_debug.js";
import { AREA, PLAN, discoverVillage, parseDone, addDone, isDone, inRect, growRect, hullOf, chunksIn, describePick, describeMerge, VILLAGE_PLANS } from "./village_planner.js";
import { isKnownVillageCell, rememberVillageArea } from "./village_area.js";
import { describeRepair } from "./village_repair.js";
import { populateVillage } from "./elf_village.js";
import { clearBand } from "./village_clear.js";
import { sliced, stepSummary, planAndBuild, clearShield } from "./village_build.js";

export { sliced, stepSummary }; // tests drive them with a mock clock

// START_DELAY_TICKS 5 (was 20, owner 2026-10-10: the village looked empty for a long time). JOB_SLICE_MS: one engine job step runs the planner's inner steps
// until this many ms are used, then yields once; without it the job may advance only ONE inner step per tick (about 200 steps = 10 s).
const START_DELAY_TICKS = 5, SETTLE_TICKS = 40, AREA_TIMEOUT_TICKS = 600, JOB_SLICE_MS = 2;
const ENGINE = { BlockPermutation, BlockVolume }; // the pure build module (village_build.js) imports nothing from @minecraft/server
const TRIES = "lothlorien:loop_tries", DONE = VILLAGE_PLANS;
const seen = new Set(), queue = [], failed = [];
let claim = null, running = false, loggedQuota = false, areaAttempt = 0;

// Stage logging: all diagnostics (start, timings, per-merge/pick/repair/rejected lines, the run summary, silent exits) log only in debug mode,
// which `/scriptevent lothlorien:debug` switches on (village_debug.js). Only failures ("gave up", elf population errors) log unconditionally.
const dlog = (msg) => { if (villageDebug()) console.warn(`[lothlorien] planner: (debug) ${msg}`); };
const log = (msg) => console.warn(`[lothlorien] planner: ${msg}`);

const cellOf = (e) => { const p = e.location; return [Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)]; }; // the deck cell under the marker
const sleep = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));
const withTimeout = (promise, ticks, what) => Promise.race([promise, sleep(ticks).then(() => { throw new Error(`${what} timed out after ${ticks} ticks`); })]);
function runJobAsync(gen) {
  return new Promise((resolve, reject) => system.runJob((function* () { try { resolve(yield* gen); } catch (e) { reject(e); } })()));
}

const boxQuery = (r) => ({ type: MARKER_ID, location: { x: r.x0, y: -64, z: r.z0 }, volume: { x: r.x1 - r.x0 + 1, y: 420, z: r.z1 - r.z0 + 1 } });
function removeMarkers(dimension, r) {
  let n = 0;
  for (const e of dimension.getEntities(boxQuery(r))) { e.remove(); n++; }
  return n;
}

async function planVillageAt(entity, trigger) {
  const dimension = entity.dimension, first = cellOf(entity), tam = world.tickingAreaManager, base = `lothlorien_village_${first[0]}_${first[2]}_${++areaAttempt}`;
  const areas = new Map();
  let ended = false;
  const removeArea = (id) => {
    const area = areas.get(id);
    if (!area) return;
    area.release = true;
    try {
      if (tam.hasTickingArea(id)) tam.removeTickingArea(id);
      // A timeout ends our wait, not creation: keep ownership until it settles.
      if (!area.pending) areas.delete(id);
    } catch (e) { log(`could not remove ticking area ${id}: ${e?.message ?? e}`); }
  };
  const opts = (r) => ({ dimension, from: { x: r.x0, y: first[1], z: r.z0 }, to: { x: r.x1, y: first[1], z: r.z1 } });
  const env = {
    claim: (r) => { claim = r; },
    hasCapacity: (r) => { try { return tam.hasCapacity(opts(r)); } catch { return false; } },
    create: async (id, r) => {
      const t = Date.now();
      const area = { pending: true, release: false };
      areas.set(id, area);
      const creation = Promise.resolve().then(() => tam.createTickingArea(id, opts(r))).finally(() => {
        area.pending = false;
        if (ended || area.release) removeArea(id);
      });
      await withTimeout(creation, AREA_TIMEOUT_TICKS, `ticking area ${id}`);
      dlog(`discovery ${id}: ${chunksIn(r)} chunks in ${ms(t)} ms`);
    },
    remove: removeArea,
    markersIn: (r) => dimension.getEntities(boxQuery(r)).map(cellOf),
  };
  const t0 = Date.now(), ms = (since) => Date.now() - since;
  dlog(`start for village near ${first[0]},${first[2]}, trigger ${trigger}`);
  if (!loggedQuota) { loggedQuota = true; dlog(`ticking area quota maxChunkCount=${tam.maxChunkCount}`); }
  let found = null;
  try {
    found = await discoverVillage(env, first, base);
    if (dimension.id === "minecraft:overworld") rememberVillageArea(found.rect);
    dlog(`discovery done: ${found.rounds} round(s) in ${ms(t0)} ms since the start`);
    const tSettle = Date.now();
    await sleep(SETTLE_TICKS); // neighbouring chunks of a fresh village finish their decoration
    dlog(`settle ${ms(tSettle)} ms`);
    const tPlan = Date.now(), tick0 = system.currentTick, stats = { steps: 0, cpu: 0, native: 0, reads: () => 0, writeCells: 0 };
    const result = await runJobAsync(sliced(planAndBuild(dimension, found, PLAN.budget, stats, ENGINE), JOB_SLICE_MS, stats));
    dlog(`plan+build ${ms(tPlan)} ms wall, ${system.currentTick - tick0} ticks, ${stats.steps} inner steps, ${stats.cpu} ms inside them, ${stats.reads()} distinct reads, ${stats.writeCells} cells written (${result.blocks} changed), ${stepSummary(stats)}`);
    // Civilians move in while loaded. Population errors are logged and posts retained; no automatic population retry.
    const tPop = Date.now();
    try { populateVillage(dimension, found.rect, [first[0], first[2]]); } catch (e) { log(`elves: ${e?.message ?? e}`); }
    dlog(`populate ${ms(tPop)} ms`);
    // Last build step, still in the ticking areas: the light_block_0 shield goes (the band covers the marker decks and the crowns above them, see village_clear.js).
    const range = dimension.heightRange ?? { min: -64, max: 320 }, band = clearBand(found.known, { min: range.min, max: range.max - 1 });
    if (band) {
      const tClear = Date.now(), tickC = system.currentTick, cs = { slices: 0, cells: 0, failed: 0, steps: 0, cpu: 0 };
      try { await runJobAsync(sliced(clearShield(dimension, found.rect, band, cs, ENGINE, log), JOB_SLICE_MS, cs)); } catch (e) { log(`shield clear: ${e?.message ?? e}`); }
      dlog(`clear ${ms(tClear)} ms wall, ${system.currentTick - tickC} ticks, y ${band.y0}..${band.y1}, ${cs.slices} slices (${cs.failed} failed), ${cs.steps} inner steps, ${cs.cpu} ms inside them, ${cs.cells} light_block_0 cells cleared, ${stepSummary(cs)}`);
    }
    const removed = removeMarkers(dimension, found.rect);
    world.setDynamicProperty(DONE, JSON.stringify(addDone(parseDone(world.getDynamicProperty(DONE)), found.rect)));
    dlog(`village at ${first[0]},${first[2]}: ${found.known.length} markers (${removed} removed), ${found.rounds} area round(s) of ${found.sizes.join("+")} chunks${found.stable ? "" : ", NOT stable"}, ${result.nRaw} candidates, ${result.merges.length} merge(s), ${result.picks.length} link(s), ${result.repairs.length} repair(s), ${result.blocks} blocks${result.failedWrites ? `, ${result.failedWrites} write(s) failed` : ""} in ${(ms(t0) / 1000).toFixed(1)} s`);
    for (const m of result.merges) dlog(`  ${describeMerge(m)}`);
    for (const p of result.picks) dlog(`  ${describePick(p)}`);
    for (const p of result.repairs) dlog(`  ${describeRepair(p)}`);
    for (const l of result.log) dlog(`  rejected ${l}`);
    if (result.failedWrites) log(`village at ${first[0]},${first[2]}: ${result.failedWrites} write(s) failed`);
    return result;
  } catch (e) {
    log(`village at ${first[0]},${first[2]} gave up: ${e?.message ?? e}`);
    failed.push(found?.rect ?? { x0: first[0] - 40, x1: first[0] + 40, z0: first[2] - 40, z1: first[2] + 40 });
    try {
      if (entity.isValid) {
        const tries = (Number(entity.getDynamicProperty(TRIES)) || 0) + 1;
        if (tries >= AREA.maxTries) { entity.remove(); dlog(`marker ${first[0]},${first[2]} removed after ${tries} failed tries`); } else { entity.setDynamicProperty(TRIES, tries); dlog(`marker ${first[0]},${first[2]} kept for a retry after world re-entry or manual planning (try ${tries} of ${AREA.maxTries})`); }
      } else dlog(`marker ${first[0]},${first[2]} unloaded meanwhile, no retry counted`);
    } catch { /* entity unloaded meanwhile */ }
    return null;
  } finally {
    ended = true;
    for (const id of [...areas.keys()]) env.remove(id);
    claim = null;
  }
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const { entity, trigger } = queue.shift();
      try {
        if (!entity.isValid) { dlog("skip: marker no longer valid"); continue; }
        const [x, , z] = cellOf(entity);
        if (claim && inRect(claim, x, z)) { dlog(`skip ${x},${z}: inside the village being planned`); continue; }
        if (failed.some((r) => inRect(r, x, z))) { dlog(`skip ${x},${z}: this village failed earlier in this session`); continue; }
        if (isDone(parseDone(world.getDynamicProperty(DONE)), x, z)) { entity.remove(); dlog(`skip ${x},${z}: straggler of a planned village, marker removed`); continue; } // a straggler of a planned village
        await planVillageAt(entity, trigger);
      } catch (e) { log(`${e}`); }
    }
  } finally { running = false; }
}

function onMarker(entity, trigger) {
  if (seen.has(entity.id)) { dlog(`marker ${entity.id} already seen this session (${trigger})`); return; }
  // Recognize the first loaded village piece immediately, even while queued or if
  // loading/planning fails. The normal discovery margin covers the marker's platform.
  if (entity.dimension.id === "minecraft:overworld") {
    const cell = cellOf(entity), [x, , z] = cell;
    if (!(claim && inRect(claim, x, z)) && !isKnownVillageCell(x, z)) rememberVillageArea(growRect(hullOf([cell]), AREA.margins[0]));
  }
  seen.add(entity.id);
  dlog(`marker ${entity.id} noticed (${trigger}), queued in ${START_DELAY_TICKS} ticks`);
  system.runTimeout(() => { try { if (entity.isValid) { queue.push({ entity, trigger }); drain(); } else dlog(`marker ${entity.id} gone before its turn`); } catch { /* unloaded */ } }, START_DELAY_TICKS);
}

// Both events stay routed: a marker may announce itself through either. The router isolates handlers, so a throwing
// handler elsewhere cannot skip onMarker (that would leave a whole village unplanned).
onEntity(MARKER_ID, {
  load: ({ entity }) => onMarker(entity, "entityLoad"),
  spawn: ({ entity }) => onMarker(entity, "entitySpawn"),
});
