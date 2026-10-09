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
// The planner is one-shot: no polling, no retry loop. A failed run (quota, timeout, error) keeps the markers; they try again on a later load, at
// most AREA.maxTries times per marker. `/scriptevent lothlorien:village plan` re-runs it by hand for the nearest marker (see planNearest).
import { BlockPermutation, system, world } from "@minecraft/server";
import { MARKER_ID, finalBlocks } from "./village_loop.js";
import { AREA, PLAN, planGen, discoverVillage, boundedReader, parseDone, addDone, isDone, inRect, describePick } from "./village_planner.js";
import { missingLinks } from "./rail_mender_rules.js";
import { message } from "./messages.js";

const START_DELAY_TICKS = 40, SETTLE_TICKS = 40, AREA_TIMEOUT_TICKS = 600, WRITES_PER_TICK = 400;
const TRIES = "lothlorien:loop_tries", DONE = "lothlorien:village_plans";
const seen = new Set(), queue = [], failed = [];
let claim = null, running = false, loggedQuota = false;

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

// one job: plan on the loaded blocks, then write every pick (fence links as rail_mender_rules wants them)
function* planAndBuild(dimension, found, budget) {
  const get = (x, y, z) => { try { return dimension.getBlock({ x, y, z })?.typeId; } catch { return undefined; } };
  const at = boundedReader(get, found.rect);
  const res = yield* planGen(at, found.known, { budget });
  const writes = new Map();
  for (const p of res.picks) for (const [k, b] of finalBlocks(p.plan)) writes.set(k, b);
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
  for (const p of res.picks) for (const r of p.plan.rails) {
    try {
      const block = dimension.getBlock(r), perm = block.permutation, on = missingLinks(r, typeAt, (s) => perm.getState(s));
      if (on.length) { let next = perm; for (const s of on) next = next.withState(s, true); block.setPermutation(next); }
    } catch { failedWrites++; }
  }
  return { ...res, blocks: count, failedWrites };
}

async function planVillageAt(entity, force) {
  const dimension = entity.dimension, first = cellOf(entity), tam = world.tickingAreaManager, base = `lothlorien_village_${first[0]}_${first[2]}`;
  const areas = new Set();
  const opts = (r) => ({ dimension, from: { x: r.x0, y: first[1], z: r.z0 }, to: { x: r.x1, y: first[1], z: r.z1 } });
  const env = {
    claim: (r) => { claim = r; },
    hasCapacity: (r) => { try { return tam.hasCapacity(opts(r)); } catch { return false; } },
    create: async (id, r) => { areas.add(id); await withTimeout(Promise.resolve().then(() => tam.createTickingArea(id, opts(r))), AREA_TIMEOUT_TICKS, `ticking area ${id}`); },
    remove: (id) => { areas.delete(id); try { tam.removeTickingArea(id); } catch { /* already gone */ } },
    markersIn: (r) => dimension.getEntities(boxQuery(r)).map(cellOf),
  };
  if (!loggedQuota) { loggedQuota = true; console.warn(`[lothlorien] planner: ticking area quota maxChunkCount=${tam.maxChunkCount}`); }
  let found = null;
  try {
    found = await discoverVillage(env, first, base);
    await sleep(SETTLE_TICKS); // neighbouring chunks of a fresh village finish their decoration
    const result = await runJobAsync(planAndBuild(dimension, found, PLAN.budget));
    const removed = removeMarkers(dimension, found.rect);
    if (!force) world.setDynamicProperty(DONE, JSON.stringify(addDone(parseDone(world.getDynamicProperty(DONE)), found.rect)));
    console.warn(`[lothlorien] planner: village at ${first[0]},${first[2]}: ${found.known.length} markers (${removed} removed), ${found.rounds} area round(s) of ${found.sizes.join("+")} chunks${found.stable ? "" : ", NOT stable"}, ${result.nRaw} candidates, ${result.picks.length} link(s), ${result.blocks} blocks${result.failedWrites ? `, ${result.failedWrites} write(s) failed` : ""}`);
    for (const p of result.picks) console.warn(`[lothlorien] planner:   ${describePick(p)}`);
    for (const l of result.log) console.warn(`[lothlorien] planner:   rejected ${l}`);
    return result;
  } catch (e) {
    console.warn(`[lothlorien] planner: village at ${first[0]},${first[2]} gave up: ${e?.message ?? e}`);
    failed.push(found?.rect ?? { x0: first[0] - 40, x1: first[0] + 40, z0: first[2] - 40, z1: first[2] + 40 });
    try {
      if (entity.isValid) {
        const tries = (Number(entity.getDynamicProperty(TRIES)) || 0) + 1;
        if (tries >= AREA.maxTries) entity.remove(); else entity.setDynamicProperty(TRIES, tries);
      }
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
      const { entity, force, done } = queue.shift();
      try {
        if (!entity.isValid) { done?.(null); continue; }
        const [x, , z] = cellOf(entity);
        if (!force && ((claim && inRect(claim, x, z)) || failed.some((r) => inRect(r, x, z)))) { done?.(null); continue; }
        if (!force && isDone(parseDone(world.getDynamicProperty(DONE)), x, z)) { entity.remove(); done?.(null); continue; } // a straggler of a planned village
        done?.(await planVillageAt(entity, force));
      } catch (e) { console.warn(`[lothlorien] planner: ${e}`); done?.(null); }
    }
  } finally { running = false; }
}

function onMarker(entity) {
  if (!entity || entity.typeId !== MARKER_ID || seen.has(entity.id)) return;
  seen.add(entity.id);
  system.runTimeout(() => { try { if (entity.isValid) { queue.push({ entity }); drain(); } } catch { /* unloaded */ } }, START_DELAY_TICKS);
}

// `/scriptevent lothlorien:village plan`: plan again for the village of the marker nearest to the player (done-list ignored, budget 3).
// A planned village has no markers left, so this only works while some are left (an old village waiting for its first plan, or a failed run).
export function planNearest(player) {
  const near = player.dimension.getEntities({ type: MARKER_ID, location: player.location, maxDistance: 160, closest: 1 })[0];
  if (!near) { player.sendMessage(message("village.plan.none")); return; }
  seen.add(near.id);
  queue.push({ entity: near, force: true, done: (r) => player.sendMessage(r ? message("village.plan.done", r.picks.length, r.picks.map((p) => p.kind).join(", ") || "-") : message("village.plan.failed")) });
  drain();
}

world.afterEvents.entityLoad.subscribe(({ entity }) => onMarker(entity));
world.afterEvents.entitySpawn.subscribe(({ entity }) => onMarker(entity));
