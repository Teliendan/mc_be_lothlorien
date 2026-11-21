// The village build job, pure JS (no @minecraft/server import: loop_marker.js passes `engine` = { BlockPermutation, BlockVolume }, the tests and
// tools/village_steps.mjs pass fakes): sliced() (the time-boxed job driver with the per-step instrumentation), planAndBuild() (plan on the loaded
// blocks, write every pick, mend the fences) and clearShield() (the light_block_0 shield). loop_marker.js keeps the ticking areas and the async flow.
import { finalBlocksGen } from "./village_loop.js";
import { planGen, boundedReader } from "./village_planner.js";
import { LINKS } from "./rail_mender_rules.js";
import { mendFence } from "./rail_connections.js";
import { PANEL_ID, planterWalkName } from "./planter_panels.js";
import { SHIELD_ID, clearSlices } from "./village_clear.js";

// WRITES_PER_CHECK: a lantern write also triggers a light update the engine does in the same call; MENDS_PER_CHECK: a mend reads up to 5 cells.
const WRITES_PER_CHECK = 16, MENDS_PER_CHECK = 16, LAYER_TILE = 64;

// Time-boxed job driver: runs `gen` step by step until `ms` milliseconds are used, yields once, and goes on; returns the generator's value.
// An inner step is all the code between two yields. Every generator yield carries a label (a string naming the code just before it), and a step is
// named "label of the yield that started it>label of the yield that ended it" ("findMerges>scoreGen"). stats (optional) collects { steps, cpu } plus
// the slowest step (maxStep, maxLabel), the most native reads in one step (maxReads, maxReadsLabel; the caller bumps stats.native per read) and
// the steps over STEP_BUDGET_MS (over, overBy: label -> count). Each slice yields the label of its slowest inner step outward, so the DIAG wrapper
// (tools/diag/diag_wrap.js) can name the code of a long job call. `now` is injectable for tests.
export const STEP_BUDGET_MS = 3;
export function* sliced(gen, ms, stats, now = Date.now) {
  let prev = "start";
  for (;;) {
    const t0 = now();
    let r, slow = undefined, slowMs = -1;
    do {
      const s0 = now(), n0 = stats ? stats.native ?? 0 : 0;
      r = gen.next();
      const d = now() - s0, label = `${prev}>${r.done ? "done" : typeof r.value === "string" ? r.value : "?"}`;
      if (!r.done) prev = typeof r.value === "string" ? r.value : "?";
      if (d > slowMs) { slowMs = d; slow = label; }
      if (stats) {
        stats.steps++;
        if (d > (stats.maxStep ?? 0)) { stats.maxStep = d; stats.maxLabel = label; } // the slowest single inner step: the slicer cannot split it
        const reads = (stats.native ?? 0) - n0;
        if (reads > (stats.maxReads ?? 0)) { stats.maxReads = reads; stats.maxReadsLabel = label; }
        if (d > STEP_BUDGET_MS) { stats.over = (stats.over ?? 0) + 1; const by = stats.overBy ??= {}; by[label] = (by[label] ?? 0) + 1; }
      }
    } while (!r.done && now() - t0 < ms);
    if (stats) stats.cpu += now() - t0;
    if (r.done) return r.value;
    yield slow;
  }
}
// "slowest step 7 ms (a>b), most native reads in one step 30 (a>b), steps over 3 ms: 2 (a>b 2)" for the debug lines
export function stepSummary(s) {
  const by = Object.entries(s.overBy ?? {}).sort((p, q) => q[1] - p[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(", ");
  return `slowest step ${s.maxStep ?? 0} ms (${s.maxLabel ?? "-"}), most native reads in one step ${s.maxReads ?? 0} (${s.maxReadsLabel ?? "-"}), steps over ${STEP_BUDGET_MS} ms: ${s.over ?? 0}${by ? ` (${by})` : ""}`;
}

// one job: plan on the loaded blocks, then write every pick (fence links as rail_mender_rules wants them)
export function* planAndBuild(dimension, found, budget, stats, engine) {
  const { BlockPermutation, BlockVolume } = engine;
  const nat = () => { if (stats) stats.native++; }; // one native block read, for the per-step read count of sliced()
  const raw = (x,y,z) => {
    nat();
    try {
      const block=dimension.getBlock({x,y,z});
      if(!block)return undefined;
      const id=block.typeId;
      return id===PANEL_ID ? {name:id,states:{"lothlorien:open":block.permutation.getState("lothlorien:open"),"minecraft:cardinal_direction":block.permutation.getState("minecraft:cardinal_direction")}} : id;
    } catch {return undefined;}
  };
  const get = planterWalkName(raw);
  // Native filtered layer query for the planner's full-area scans, in tiles so that no single call is large; a yield between tiles.
  const layer = function* (y, ids, r) {
    const out = [];
    for (let x = r.x0; x <= r.x1; x += LAYER_TILE) for (let z = r.z0; z <= r.z1; z += LAYER_TILE) {
      const volume = new BlockVolume({ x, y, z }, { x: Math.min(x + LAYER_TILE - 1, r.x1), y, z: Math.min(z + LAYER_TILE - 1, r.z1) });
      for (const p of dimension.getBlocks(volume, { includeTypes: ids }, true).getBlockLocationIterator()) out.push([p.x, p.z]);
      yield "layerTile";
    }
    return out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  };
  let at = boundedReader(get, found.rect, layer);
  if (stats) stats.reads = at.size;
  const res = yield* planGen(at, found.known, { budget, rect: found.rect });
  res.at = null; // the overlay (its numeric maps hold every planned cell) is not needed any more: the write loop reads the base reader only (heap, F7)
  const writes = new Map(); // one plan per step (the floor plan alone has 1,500 blocks)
  for (const p of [...res.merges, ...res.picks, ...res.repairs]) { // a repair is itself the plan
    yield "writeMap";
    const fb = yield* finalBlocksGen(p.plan ?? p);
    let i = 0;
    for (const [k, b] of fb) { writes.set(k, b); if (++i % 64 === 0) yield "writeMap"; }
  }
  if (stats) stats.writeCells = writes.size;
  if (!engine.keepPlans) for (const p of [...res.merges, ...res.picks, ...res.repairs]) { // the plans' cell lists are in the write map now: keep only what the debug lines print (heap, F7; the tests keep them)
    const plan = p.plan ?? p;
    plan.nBlocks = plan.blocks?.length ?? 0; plan.nRails = plan.rails?.length ?? 0;
    for (const f of ["cells", "rails", "lights", "lamps", "blocks", "pots", "pier", "shape", "parts", "core"]) plan[f] = null;
  }
  // every written cell and its four neighbours, each fence mended once (mendAround per cell visited a shared neighbour up to 5 times; a mend reads only
  // neighbour types, which mending never changes, so order and repeats do not matter). The set is built in the write loop, as numeric keys.
  const r0 = found.rect, mendKey = (x, y, z) => ((x - r0.x0 + 2048) * 8192 + (z - r0.z0 + 2048)) * 1024 + (y + 256);
  const mend = new Set();
  let n = 0, failedWrites = 0, count = 0;
  for (const [k, b] of writes) {
    const [x, y, z] = k.split(",").map(Number), cur = at(x, y, z);
    mend.add(mendKey(x, y, z));
    for (const l of LINKS) mend.add(mendKey(x + l.dx, y, z + l.dz));
    if (!(cur === b.id && (b.id === "minecraft:air" || b.id === "lothlorien:mallorn_planks"))) { // else already right (air over air, planks over planks)
      try {
        nat();
        const block = dimension.getBlock({ x, y, z });
        if (b.id === "minecraft:air") block.setType("minecraft:air");
        else block.setPermutation(BlockPermutation.resolve(b.id, b.states ?? {}));
        count++;
      } catch { failedWrites++; }
    }
    if (++n % WRITES_PER_CHECK === 0) yield "write";
  }
  yield "write";
  writes.clear();
  at = null; res.at = null; // release the block memo and the overlay before the fence mend pass (watchdog memory, 2026-10-27)
  const counted = { getBlock: (l) => { nat(); return dimension.getBlock(l); } };
  let m = 0;
  for (const mk of mend) {
    const y = (mk % 1024) - 256, rest = Math.floor(mk / 1024), z = (rest % 8192) - 2048 + r0.z0, x = Math.floor(rest / 8192) - 2048 + r0.x0;
    try { mendFence(counted, { x, y, z }); } catch { /* unloaded */ }
    if (++m % MENDS_PER_CHECK === 0) yield "mend";
  }
  return { ...res, blocks: count, failedWrites };
}

// Replaces every light_block_0 in the village rect by air: one native fillBlocks per chunk column and Y slice (village_clear.js), a yield after each.
// A failing slice is logged and skipped. stats collects { slices, cells, failed }.
export function* clearShield(dimension, rect, band, stats, engine, log) {
  const { BlockVolume } = engine;
  for (const s of clearSlices(rect, band.y0, band.y1)) {
    try {
      const volume = new BlockVolume({ x: s.x0, y: s.y0, z: s.z0 }, { x: s.x1, y: s.y1, z: s.z1 });
      stats.cells += dimension.fillBlocks(volume, "minecraft:air", { blockFilter: { includeTypes: [SHIELD_ID] }, ignoreChunkBoundErrors: true }).getCapacity();
    } catch (e) { stats.failed++; log(`shield clear ${s.x0},${s.y0},${s.z0} to ${s.x1},${s.y1},${s.z1}: ${e?.message ?? e}`); }
    stats.slices++;
    yield "clear";
  }
}

