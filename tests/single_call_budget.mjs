// Per-step budget of the three world-growing single calls fixed 2026-11-21 (perf audit L2-L4): the white deer gift-spot
// job, the rail mender's explosion batch and breaking a long elven rope. A counting mock counts native calls per call
// or job step: <= 128 reads, <= 16 writes (rope: item spawns count as writes). Pure-JS time is not asserted (see performance.md).
//   node tests/single_call_budget.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rules from "../lothlorien_bp/scripts/elven_rope_rules.js";
import * as railRules from "../lothlorien_bp/scripts/rail_mender_rules.js";
import * as railConn from "../lothlorien_bp/scripts/rail_connections.js";
import { setup } from "./fixtures/wildlife_runtime.mjs";
import { test, finish } from "./test_helpers.mjs";

const READS = 128, WRITES = 16;
const worst = (steps) => steps.reduce((w, s) => ({ reads: Math.max(w.reads, s.reads), writes: Math.max(w.writes, s.writes) }), { reads: 0, writes: 0 });
const within = (name, steps) => {
  const w = worst(steps);
  console.log(`     ${name}: ${steps.length} steps, worst step ${JSON.stringify(w)}`);
  assert.ok(w.reads <= READS && w.writes <= WRITES, `${name}: worst step ${JSON.stringify(w)} (limit ${READS} reads, ${WRITES} writes)`);
};
// Runs `job` to the end; a step is what one next() does. Returns the counter deltas of each step.
function drive(counter, job) {
  const steps = [];
  for (;;) {
    const before = { ...counter };
    const r = job.next();
    steps.push({ reads: counter.reads - before.reads, writes: counter.writes - before.writes });
    if (r.done) return steps;
  }
}

const gift = await (async () => {
  const h = await setup(), c = { reads: 0, writes: 0 };
  let depth = 0;
  // count each public native call once (the fixture's raycast calls getBlock inside)
  const wrap = (obj, name) => { const f = obj[name]; obj[name] = function (...a) { if (!depth) c.reads++; depth++; try { return f.apply(this, a); } finally { depth--; } }; };
  const getBlock = h.dimension.getBlock;
  const leaf = (p) => Math.floor(p.y) >= 70 && Math.floor(p.y) <= 115;
  h.dimension.getBlock = function (p) { return leaf(p) ? { ...getBlock.call(this, p), typeId: "lothlorien:mallorn_leaves", isAir: false } : getBlock.call(this, p); };
  h.dimension.top = 116;
  for (const name of ["getBlock", "getBlockFromRay", "getTopmostBlock"]) wrap(h.dimension, name);
  const at = h.biome.at; h.biome.at = (...a) => { c.reads += 2; return at(...a); }; // the real sampler: topmost block + biome
  return { h, c };
})();

test("L2 white deer gift-spot search: a forest of 46-leaf canopy columns stays within the per-step native-call budget and still finds the spot", () => {
  const { h, c } = gift;
  h.offer();
  assert.equal(h.jobs.length, 1, "one search job");
  const steps = drive(c, h.jobs.splice(0)[0]);
  assert.equal(h.mod.isGuiding(h.deer.id), true, "a spot was found (same result)");
  within("gift spot", steps);
});

test("L3 rail mender: a 1,000-cell explosion is mended in job steps of <= 16 cells, with the same repairs as mending every cell at once", async () => {
  const world = new Map(), c = { reads: 0, writes: 0 }, handlers = [], timeouts = [], jobs = [];
  const key = (p) => `${p.x},${p.y},${p.z}`;
  const permOf = (states) => ({ states, getState: (s) => states[s] === true, withState: (s, v) => permOf({ ...states, [s]: v }) });
  const dimension = { id: "overworld", getBlock(p) {
    c.reads++; const cell = world.get(key(p)); if (!cell) return { typeId: "minecraft:air" };
    return { typeId: cell.typeId, permutation: permOf(cell.states), setPermutation(perm) { c.writes++; cell.states = perm.states; } };
  } };
  const fill = () => { world.clear(); for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) for (let z = 0; z < 10; z++) world.set(`${x},${y},${z}`, { typeId: railRules.FENCE_IDS[0], states: {} }); };
  const src = readFileSync(new URL("../lothlorien_bp/scripts/rail_mender.js", import.meta.url), "utf8")
    .replace(/^import \{([\s\S]*?)\} from "[^"]+";/gm, "const {$1} = globalThis.__rail;");
  globalThis.__rail = { ...railRules, ...railConn, onEntity() {}, BlockVolume: class {}, villageDebug: () => false,
    system: { currentTick: 5, runTimeout: (fn) => timeouts.push(fn), runJob: (gen) => jobs.push(gen) },
    world: { afterEvents: { playerPlaceBlock: { subscribe() {} }, playerBreakBlock: { subscribe() {} }, blockExplode: { subscribe: (fn) => handlers.push(fn) } } } };
  await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`);
  delete globalThis.__rail;
  fill();
  const cells = [...world.keys()].map((k) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z }; });
  for (const location of cells) for (const fn of handlers) fn({ block: { location }, dimension });
  assert.equal(timeouts.length, 1, "one timer per tick");
  c.reads = c.writes = 0; timeouts.shift()();
  assert.equal(c.reads + c.writes, 0, "the timer itself does no world work");
  assert.equal(jobs.length, 1);
  const steps = drive(c, jobs.shift());
  within("rail mender", steps);
  const viaJob = JSON.stringify([...world]);
  const repairs = c.writes;
  fill(); // the old behaviour: every cell around every edit in one go
  const all = new Map(); for (const p of cells) for (const l of railConn.cellsAround(p)) all.set(key(l), l);
  for (const loc of all.values()) railConn.mendFence(dimension, loc);
  assert.equal(viaJob, JSON.stringify([...world]), "same repairs");
  assert.ok(repairs > 0);
});

async function loadRope(system) {
  globalThis.__ropeBudget = { ...rules, BlockPermutation: {}, EquipmentSlot: {}, GameMode: { Creative: "creative" },
    ItemStack: class { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } }, repeatedUse: () => false,
    readBlock: (dimension, location) => dimension.getBlock(location), noteDeed() {}, system,
    world: { gameRules: { doTileDrops: true }, afterEvents: { playerBreakBlock: { subscribe() {} }, blockExplode: { subscribe() {} } } } };
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8")
    .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__ropeBudget;");
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}#${Math.random()}`);
  delete globalThis.__ropeBudget; return mod;
}

test("L4 elven rope: removing a 384-piece rope runs in counted steps and drops one item per piece; overlapping removals never drop twice", async () => {
  const jobs = [], c = { reads: 0, writes: 0 };
  const { dropWholeRope } = await loadRope({ beforeEvents: { startup: { subscribe() {} } }, runJob: (g) => jobs.push(g) });
  const perm = (id) => ({ type: { id }, getState: () => "north" });
  const make = () => {
    const cells = new Map(), items = [];
    const dimension = { heightRange: { min: -64, max: 320 }, getBlock(p) { c.reads++; return cells.get(p.y); }, spawnItem(stack) { c.writes++; items.push(stack.amount); } };
    const piece = () => ({ typeId: "lothlorien:elven_rope", permutation: perm("lothlorien:elven_rope"), setType(id) { c.writes++; this.typeId = id; this.permutation = perm(id); } });
    for (let y = -64; y < 320; y++) cells.set(y, piece());
    cells.get(100).setType("minecraft:air"); c.writes--; // the piece the player broke
    return { dimension, cells, items };
  };
  const total = (r) => r.items.reduce((a, b) => a + b, 0);
  const at = { x: 0, y: 100, z: 0 };
  { // one call: the first step runs inside the call, the rest as a job
    const r = make(); jobs.length = 0;
    const before = { ...c };
    dropWholeRope(r.dimension, at, "north");
    const steps = [{ reads: c.reads - before.reads, writes: c.writes - before.writes }];
    assert.equal(jobs.length, 1, "a long rope continues as a job");
    steps.push(...drive(c, jobs.shift()));
    within("elven rope (384 pieces)", steps);
    assert.deepEqual(r.items, [64, 64, 64, 64, 64, 63], "one item per removed piece (the native broken piece drops itself)");
    assert.ok([...r.cells.values()].every((b) => b.typeId === "minecraft:air"));
  }
  { // an explosion fires one call per exploded piece: two overlapping runs
    const r = make(); jobs.length = 0;
    dropWholeRope(r.dimension, at, "north"); dropWholeRope(r.dimension, at, "north");
    for (let alive = jobs.splice(0); alive.length;) alive = alive.filter((j) => !j.next().done);
    assert.equal(total(r), 383, "no piece dropped twice");
  }
  { // a short rope is still gone before the call returns
    const r = make(); jobs.length = 0;
    for (let y = -64; y < 320; y++) if (y < 98 || y > 102) r.cells.get(y).setType("minecraft:air");
    dropWholeRope(r.dimension, at, "north");
    assert.equal(jobs.length, 0); assert.equal(total(r), 4, "pieces 98, 99, 101, 102");
  }
});

finish();
