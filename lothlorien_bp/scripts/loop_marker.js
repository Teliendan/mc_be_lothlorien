// Village loop planner, runtime side (owner decision 2026-10-09: "build the planner", replaces the per-marker loop closer).
//
// Jigsaw only grows a tree. Every platform piece of an Elven village (central tree, node trees, towers, railing / balcony / lookout ends) carries
// invisible `lothlorien:loop_marker` entities. The FIRST marker that loads (the first tree that comes into simulation range, or the first one
// spawned by worldgen) starts ONE planner for its whole village; village_planner.js decides, this file only loads the village and writes:
//   1 queue      markers wait 2 s, then queue up; one planner runs at a time; a marker inside a rectangle that is being planned, was planned
//                ("lothlorien:village_plans" done-list on the world) or failed this session is dropped / removed.
//   2 load       script ticking areas (world.tickingAreaManager) around the known markers, grown round by round until no new marker shows up
//                (discoverVillage), so the planner never depends on where the player stands. The areas are removed again in `finally`.
//   3 plan       planGen on the blocks of that area (budget 3 extra links), run as a job (yields, no long tick).
//   4 build      all picks are written in the same job (a few hundred blocks per tick), then every marker in the area is removed.
//   5 populate   civilian elves: the tree pieces' `lothlorien:elf_post` entities are read, assigned and replaced by elves (elf_village.js).
// The planner is one-shot: no polling, no retry loop. A failed run (quota, timeout, error) keeps the markers; they try again on a later load, at
// most AREA.maxTries times per marker. `/scriptevent lothlorien:village plan` re-runs it by hand for the nearest marker (see planNearest).
import { BlockPermutation, system, world } from "@minecraft/server";
import { MARKER_ID, finalBlocks } from "./village_loop.js";
import { AREA, PLAN, planGen, discoverVillage, boundedReader, parseDone, addDone, isDone, inRect, chunksIn, describePick, describeMerge } from "./village_planner.js";
import { describeRepair } from "./village_repair.js";
import { missingLinks } from "./rail_mender_rules.js";
import { message } from "./messages.js";
import { populateVillage } from "./elf_village.js";

// START_DELAY_TICKS 5 (was 20, owner 2026-10-10: the village looked empty for a long time). JOB_SLICE_MS: one engine job step runs the planner's inner steps
// until this many ms are used, then yields once; without it the job may advance only ONE inner step per tick (about 200 steps = 10 s).
const START_DELAY_TICKS = 5, SETTLE_TICKS = 40, AREA_TIMEOUT_TICKS = 600, WRITES_PER_TICK = 400, JOB_SLICE_MS = 8;
const TRIES = "lothlorien:loop_tries", DONE = "lothlorien:village_plans";
const seen = new Set(), queue = [], failed = [];
let claim = null, running = false, loggedQuota = false, debug = false;

// Stage logging: the start and the summary of every planner run are always logged; every silent exit (marker skipped, invalid, queued, retried)
// logs only in debug mode, which `/scriptevent lothlorien:village debug` toggles (see toggleDebug).
const log = (msg) => console.warn(`[lothlorien] planner: ${msg}`);
const dlog = (msg) => { if (debug) log(`(debug) ${msg}`); };
export function toggleDebug() { debug = !debug; return debug; }

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

// Time-boxed job driver: runs `gen` step by step until `ms` milliseconds are used, yields once, and goes on; returns the generator's value.
// stats (optional) collects { steps, cpu } (inner steps and ms spent inside them) for the timing log. `now` is injectable for tests.
export function* sliced(gen, ms, stats, now = Date.now) {
  for (;;) {
    const t0 = now();
    let r;
    do { r = gen.next(); if (stats) stats.steps++; } while (!r.done && now() - t0 < ms);
    if (stats) stats.cpu += now() - t0;
    if (r.done) return r.value;
    yield;
  }
}

// one job: plan on the loaded blocks, then write every pick (fence links as rail_mender_rules wants them)
function* planAndBuild(dimension, found, budget, stats) {
  const get = (x, y, z) => { try { return dimension.getBlock({ x, y, z })?.typeId; } catch { return undefined; } };
  const at = boundedReader(get, found.rect);
  if (stats) stats.reads = at.size;
  const res = yield* planGen(at, found.known, { budget, rect: found.rect });
  const writes = new Map();
  for (const p of [...res.merges, ...res.picks, ...res.repairs]) for (const [k, b] of finalBlocks(p.plan ?? p)) writes.set(k, b); // a repair is itself the plan
  if (stats) stats.writeCells = writes.size;
  let n = 0, failedWrites = 0, count = 0;
  for (const [k, b] of writes) {
    const [x, y, z] = k.split(",").map(Number), cur = at(x, y, z);
    if (cur === b.id && (b.id === "minecraft:air" || b.id === "lothlorien:mallorn_planks")) continue; // already right (air over air, planks over planks)
    try {
      const block = dimension.getBlock({ x, y, z });
      if (b.id === "minecraft:air") block.setType("minecraft:air");
      else block.setPermutation(BlockPermutation.resolve(b.id, b.states ?? {}));
      count++;
    } catch { failedWrites++; }
    if (++n % WRITES_PER_TICK === 0) yield;
  }
  const typeAt = (x, y, z) => dimension.getBlock({ x, y, z })?.typeId;
  for (const p of [...res.merges, ...res.picks]) for (const r of [...p.plan.rails, ...(p.plan.lamps ?? []).map((l) => ({ x: l.x, y: l.y - 1, z: l.z }))]) { // the rails and the fence under every lamp
    try {
      const block = dimension.getBlock(r), perm = block.permutation, on = missingLinks(r, typeAt, (s) => perm.getState(s));
      if (on.length) { let next = perm; for (const s of on) next = next.withState(s, true); block.setPermutation(next); }
    } catch { failedWrites++; }
  }
  return { ...res, blocks: count, failedWrites };
}

async function planVillageAt(entity, force, trigger) {
  const dimension = entity.dimension, first = cellOf(entity), tam = world.tickingAreaManager, base = `lothlorien_village_${first[0]}_${first[2]}`;
  const areas = new Set();
  const opts = (r) => ({ dimension, from: { x: r.x0, y: first[1], z: r.z0 }, to: { x: r.x1, y: first[1], z: r.z1 } });
  const env = {
    claim: (r) => { claim = r; },
    hasCapacity: (r) => { try { return tam.hasCapacity(opts(r)); } catch { return false; } },
    create: async (id, r) => {
      const t = Date.now();
      areas.add(id);
      await withTimeout(Promise.resolve().then(() => tam.createTickingArea(id, opts(r))), AREA_TIMEOUT_TICKS, `ticking area ${id}`);
      dlog(`discovery ${id}: ${chunksIn(r)} chunks in ${ms(t)} ms`);
    },
    remove: (id) => { areas.delete(id); try { tam.removeTickingArea(id); } catch { /* already gone */ } },
    markersIn: (r) => dimension.getEntities(boxQuery(r)).map(cellOf),
  };
  const t0 = Date.now(), ms = (since) => Date.now() - since;
  log(`start for village near ${first[0]},${first[2]}, trigger ${trigger}`);
  if (!loggedQuota) { loggedQuota = true; log(`ticking area quota maxChunkCount=${tam.maxChunkCount}`); }
  let found = null;
  try {
    found = await discoverVillage(env, first, base);
    dlog(`discovery done: ${found.rounds} round(s) in ${ms(t0)} ms since the start`);
    const tSettle = Date.now();
    await sleep(SETTLE_TICKS); // neighbouring chunks of a fresh village finish their decoration
    dlog(`settle ${ms(tSettle)} ms`);
    const tPlan = Date.now(), tick0 = system.currentTick, stats = { steps: 0, cpu: 0, reads: () => 0, writeCells: 0 };
    const result = await runJobAsync(sliced(planAndBuild(dimension, found, PLAN.budget, stats), JOB_SLICE_MS, stats));
    dlog(`plan+build ${ms(tPlan)} ms wall, ${system.currentTick - tick0} ticks, ${stats.steps} inner steps, ${stats.cpu} ms inside them, ${stats.reads()} distinct reads, ${stats.writeCells} cells written (${result.blocks} changed)`);
    // the civilians move in while the village is loaded (own try: a population error never fails the planner; unspawned posts stay for a later run)
    const tPop = Date.now();
    try { populateVillage(dimension, found.rect, [first[0], first[2]]); } catch (e) { log(`elves: ${e?.message ?? e}`); }
    dlog(`populate ${ms(tPop)} ms`);
    const removed = removeMarkers(dimension, found.rect);
    if (!force) world.setDynamicProperty(DONE, JSON.stringify(addDone(parseDone(world.getDynamicProperty(DONE)), found.rect)));
    console.warn(`[lothlorien] planner: village at ${first[0]},${first[2]}: ${found.known.length} markers (${removed} removed), ${found.rounds} area round(s) of ${found.sizes.join("+")} chunks${found.stable ? "" : ", NOT stable"}, ${result.nRaw} candidates, ${result.merges.length} merge(s), ${result.picks.length} link(s), ${result.repairs.length} repair(s), ${result.blocks} blocks${result.failedWrites ? `, ${result.failedWrites} write(s) failed` : ""} in ${(ms(t0) / 1000).toFixed(1)} s`);
    for (const m of result.merges) console.warn(`[lothlorien] planner:   ${describeMerge(m)}`);
    for (const p of result.picks) console.warn(`[lothlorien] planner:   ${describePick(p)}`);
    for (const p of result.repairs) console.warn(`[lothlorien] planner:   ${describeRepair(p)}`);
    for (const l of result.log) console.warn(`[lothlorien] planner:   rejected ${l}`);
    return result;
  } catch (e) {
    console.warn(`[lothlorien] planner: village at ${first[0]},${first[2]} gave up: ${e?.message ?? e}`);
    failed.push(found?.rect ?? { x0: first[0] - 40, x1: first[0] + 40, z0: first[2] - 40, z1: first[2] + 40 });
    try {
      if (entity.isValid) {
        const tries = (Number(entity.getDynamicProperty(TRIES)) || 0) + 1;
        if (tries >= AREA.maxTries) { entity.remove(); dlog(`marker ${first[0]},${first[2]} removed after ${tries} failed tries`); } else { entity.setDynamicProperty(TRIES, tries); dlog(`marker ${first[0]},${first[2]} kept for a retry on a later load (try ${tries} of ${AREA.maxTries})`); }
      } else dlog(`marker ${first[0]},${first[2]} unloaded meanwhile, no retry counted`);
    } catch { /* entity unloaded meanwhile */ }
    return null;
  } finally {
    for (const id of [...areas]) env.remove(id);
    claim = null;
  }
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const { entity, force, done, trigger } = queue.shift();
      try {
        if (!entity.isValid) { dlog("skip: marker no longer valid"); done?.(null); continue; }
        const [x, , z] = cellOf(entity);
        if (!force && claim && inRect(claim, x, z)) { dlog(`skip ${x},${z}: inside the village being planned`); done?.(null); continue; }
        if (!force && failed.some((r) => inRect(r, x, z))) { dlog(`skip ${x},${z}: this village failed earlier in this session`); done?.(null); continue; }
        if (!force && isDone(parseDone(world.getDynamicProperty(DONE)), x, z)) { entity.remove(); dlog(`skip ${x},${z}: straggler of a planned village, marker removed`); done?.(null); continue; } // a straggler of a planned village
        const result = await planVillageAt(entity, force, trigger); // not `done?.(await ...)`: an optional call skips its arguments when done is unset
        done?.(result);
      } catch (e) { log(`${e}`); done?.(null); }
    }
  } finally { running = false; }
}

function onMarker(entity, trigger) {
  if (!entity || entity.typeId !== MARKER_ID) return;
  if (seen.has(entity.id)) { dlog(`marker ${entity.id} already seen this session (${trigger})`); return; }
  seen.add(entity.id);
  dlog(`marker ${entity.id} noticed (${trigger}), queued in ${START_DELAY_TICKS} ticks`);
  system.runTimeout(() => { try { if (entity.isValid) { queue.push({ entity, trigger }); drain(); } else dlog(`marker ${entity.id} gone before its turn`); } catch { /* unloaded */ } }, START_DELAY_TICKS);
}

// `/scriptevent lothlorien:village plan`: plan again for the village of the marker nearest to the player (done-list ignored, budget 3).
// A planned village has no markers left, so this only works while some are left (an old village waiting for its first plan, or a failed run).
export function planNearest(player) {
  const near = player.dimension.getEntities({ type: MARKER_ID, location: player.location, maxDistance: 160, closest: 1 })[0];
  if (!near) { player.sendMessage(message("village.plan.none")); return; }
  seen.add(near.id);
  queue.push({ entity: near, force: true, trigger: "manual", done: (r) => player.sendMessage(r ? message("village.plan.done", r.picks.length, r.picks.map((p) => p.kind).join(", ") || "-") : message("village.plan.failed")) });
  drain();
}

world.afterEvents.entityLoad.subscribe(({ entity }) => onMarker(entity, "entityLoad"));
world.afterEvents.entitySpawn.subscribe(({ entity }) => onMarker(entity, "entitySpawn"));
