// Per-step budget of the three world-growing single calls fixed 2026-11-21 (perf audit L2-L4): the white deer gift-spot
// job, the rail mender's explosion batch and breaking a long elven rope. A counting mock counts native calls per call
// or job step: <= 128 reads, <= 16 writes (rope: item spawns count as writes). Pure-JS time is not asserted (see performance.md).
//   node tests/single_call_budget.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rules from "../lothlorien_bp/scripts/elven_rope_rules.js";
import * as railRules from "../lothlorien_bp/scripts/rail_mender_rules.js";
import * as railConn from "../lothlorien_bp/scripts/rail_connections.js";
import * as worldUtil from "../lothlorien_bp/scripts/world_util.js";
import { SUPPORT_POLICIES } from "../lothlorien_bp/scripts/support_policies.js";
import { createSupportMotionService } from "../lothlorien_bp/scripts/support_motion_service.js";
import { supportOffset } from "../lothlorien_bp/scripts/antler_rules.js";
import { cornSoilAllowed, CORN_ORIGIN } from "../lothlorien_bp/scripts/crop_rules.js";
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

// both rope loaders pass their mocks through one global while importing: one at a time
let loading = Promise.resolve();
const serial = (fn) => (...args) => (loading = loading.then(() => fn(...args), () => fn(...args)));
const loadRope = serial(async (system) => {
  globalThis.__ropeBudget = { ...rules, BlockPermutation: {}, EquipmentSlot: {}, GameMode: { Creative: "creative" },
    ItemStack: class { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } }, repeatedUse: () => false,
    readBlock: (dimension, location) => dimension.getBlock(location), noteDeed() {}, system,
    world: { gameRules: { doTileDrops: true }, afterEvents: { playerBreakBlock: { subscribe() {} }, blockExplode: { subscribe() {} } } } };
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8")
    .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__ropeBudget;");
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}#${Math.random()}`);
  delete globalThis.__ropeBudget; return mod;
});

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

// ---- Owner decision 2026-11-22: rope extension and the per-exploded-block handlers -----------------------------------

const loadRopeFull = serial(async (system, hooks) => {
  globalThis.__ropeBudget = { ...rules, BlockPermutation: { resolve: (type, states) => ({ type: { id: type }, states, getState: (k) => states[k] }) },
    EquipmentSlot: { Mainhand: "main" }, GameMode: { Creative: "creative" },
    ItemStack: class { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } }, repeatedUse: () => false,
    readBlock: (dimension, location) => dimension.getBlock(location), noteDeed: hooks.noteDeed ?? (() => {}), system,
    world: { gameRules: { doTileDrops: true }, afterEvents: { playerBreakBlock: { subscribe() {} }, blockExplode: { subscribe: (fn) => hooks.explode?.push(fn) } } } };
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8")
    .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__ropeBudget;");
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}#${Math.random()}`);
  delete globalThis.__ropeBudget; return mod;
});
const ROPE = "lothlorien:elven_rope";
const ropePerm = (id = ROPE) => ({ type: { id }, getState: () => "north" });

await (async () => {
  const c = { reads: 0, writes: 0 }, jobs = [];
  let deeds = 0, use;
  const hooks = { explode: [], noteDeed: () => { c.writes++; deeds++; } };
  await loadRopeFull({ beforeEvents: { startup: { subscribe: (fn) => fn({ itemComponentRegistry: { registerCustomComponent: (id, comp) => { use = comp.onUseOn; } } }) } },
    runJob: (g) => jobs.push(g) }, hooks);
  const MIN = -64, MAX = 320;
  // column (x 0, z 0) on the north face: the wall is at z 1. `blocked`: rows of the column that hold stone.
  const make = (pieces, blocked = []) => {
    const cells = new Map(), sounds = [];
    const dimension = { id: "overworld", heightRange: { min: MIN, max: MAX }, playSound(id, p) { c.writes++; sounds.push(p.y); },
      getBlock(p) {
        c.reads++;
        if (p.z === 1) return { typeId: "minecraft:stone", isAir: false, isLiquid: false };
        let cell = cells.get(p.y);
        if (!cell) {
          const stone = blocked.includes(p.y);
          cell = { typeId: stone ? "minecraft:stone" : "minecraft:air", isAir: !stone, isLiquid: false, permutation: ropePerm("minecraft:air"),
            setPermutation(perm) { c.writes++; this.typeId = perm.type.id; this.isAir = false; this.permutation = perm; } };
          cells.set(p.y, cell);
        }
        return cell;
      } };
    for (const y of pieces) { const cell = dimension.getBlock({ x: 0, y, z: 0 }); cell.typeId = ROPE; cell.isAir = false; cell.permutation = ropePerm(); }
    return { dimension, cells, sounds, blocked };
  };
  const rowsOf = (r) => [...r.cells].filter(([, b]) => b.typeId === ROPE).map(([y]) => y).sort((a, b) => a - b);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const sorted = (rows) => rows.slice().sort((a, b) => a - b);
  const player = (amount, creative = false) => {
    const p = { held: { typeId: ROPE, amount }, getGameMode: () => (creative ? "creative" : "survival"),
      getComponent: () => ({ getEquipmentSlot: () => ({ getItem() { c.reads++; return p.held && { ...p.held }; },
        get amount() { return p.held.amount; }, set amount(n) { c.writes++; p.held.amount = n; }, setItem(i) { c.writes++; p.held = i; } }) }) };
    return p;
  };
  const run = (r, p, y, face, wallBlock) => {
    jobs.length = 0; c.reads = c.writes = 0; deeds = 0;
    const clicked = wallBlock ?? { typeId: ROPE, permutation: ropePerm(), location: { x: 0, y, z: 0 }, dimension: r.dimension };
    use({ source: p, block: clicked, blockFace: face, itemStack: { amount: p.held.amount } });
    const steps = [{ reads: c.reads, writes: c.writes }];
    const inline = jobs.length === 0;
    while (jobs.length) steps.push(...drive(c, jobs.shift()));
    return { steps, inline };
  };
  // what the code before 2026-11-22 placed: columnBounds + planRope over the same world
  const expected = (r, y, count, extend) => {
    const free = (row) => { const cell = r.cells.get(row); return !(cell && cell.typeId !== "minecraft:air") && !r.blocked.includes(row) && row >= MIN && row <= MAX; };
    const isPiece = (row) => r.cells.get(row)?.typeId === ROPE;
    if (!extend) return rules.planRope({ downFrom: y, upFrom: y + 1, count, free, minY: MIN, maxY: MAX });
    const { bottom, top } = rules.columnBounds(isPiece, y, MIN, MAX);
    return rules.planRope({ downFrom: bottom - 1, upFrom: top + 1, count, free, minY: MIN, maxY: MAX });
  };

  test("rope extension: a 384-piece rope is extended in counted steps (first step inline) with the same rows, items, sound and deed as the plan it replaced", () => {
    { // 320 pieces + 64 items: the rope becomes the full 384 rows
      const r = make(range(-64, 255)), p = player(64), want = expected(r, 100, 64, true);
      const { steps, inline } = run(r, p, 100);
      within("rope extension (320 -> 384 pieces)", steps);
      assert.equal(inline, false, "a long extension continues as a job");
      assert.deepEqual(want, range(256, 319));
      assert.deepEqual(rowsOf(r), range(-64, 319), "same rows");
      assert.equal(p.held, undefined, "all 64 items used (setItem(undefined) like before)");
      assert.equal(r.sounds.length, 1); assert.equal(deeds, 1);
    }
    { // down first
      const r = make(range(100, 110)), p = player(40), want = expected(r, 105, 40, true);
      const { steps } = run(r, p, 105);
      within("rope extension (40 pieces down)", steps);
      assert.deepEqual(rowsOf(r), sorted([...want, ...range(100, 110)]), "same rows as planRope");
      assert.equal(p.held, undefined); assert.deepEqual(r.sounds, [want[0]], "sound at the first new piece");
    }
    { // down blocked at row 90 and up at row 112: the rest of the stack stays in the hand
      const r = make(range(95, 110), [90, 112]);
      const p = player(30), want = expected(r, 100, 30, true);
      run(r, p, 100);
      assert.deepEqual(rowsOf(r), sorted([...want, ...range(95, 110)]));
      assert.deepEqual(sorted(want), [91, 92, 93, 94, 111]); assert.equal(p.held.amount, 25);
    }
    { // a short extension is placed before the call returns, with one hand update
      const r = make(range(100, 102)), p = player(5), want = expected(r, 100, 5, true);
      const { steps, inline } = run(r, p, 100);
      assert.equal(inline, true); assert.equal(steps.length, 1);
      assert.deepEqual(rowsOf(r), sorted([...want, ...range(100, 102)]));
      assert.equal(p.held, undefined); assert.equal(deeds, 1);
    }
    { // a new rope beside the clicked wall: 64 pieces down from the clicked row, creative keeps the stack
      const r = make([]), p = player(64, true), want = expected(r, 100, 64, false);
      const wall = { typeId: "minecraft:stone", location: { x: 0, y: 100, z: 1 }, dimension: r.dimension };
      const { steps } = run(r, p, 100, "North", wall);
      within("new rope (64 pieces)", steps);
      assert.deepEqual(rowsOf(r), sorted(want)); assert.equal(want.length, 64); assert.equal(p.held.amount, 64);
    }
    { // a blocked clicked cell places nothing, no sound, no deed
      const r = make([], [100]);
      const p = player(10), wall = { typeId: "minecraft:stone", location: { x: 0, y: 100, z: 1 }, dimension: r.dimension };
      run(r, p, 100, "North", wall);
      assert.deepEqual(rowsOf(r), []); assert.equal(p.held.amount, 10); assert.equal(deeds, 0); assert.equal(r.sounds.length, 0);
    }
    { // the hand changed while the job runs: no more pieces, nothing is paid twice
      const r = make(range(-64, 100)), p = player(64);
      jobs.length = 0;
      use({ source: p, block: { typeId: ROPE, permutation: ropePerm(), location: { x: 0, y: 0, z: 0 }, dimension: r.dimension }, blockFace: "North", itemStack: { amount: 64 } });
      assert.equal(jobs.length, 1); const placedFirst = rowsOf(r).length;
      p.held = { typeId: "minecraft:stick", amount: 3 };
      while (jobs.length) { const j = jobs.shift(); while (!j.next().done); }
      assert.equal(rowsOf(r).length - placedFirst, 0, "no piece placed after the hand changed");
      assert.equal(p.held.typeId, "minecraft:stick"); assert.equal(p.held.amount, 3);
    }
  });
})();

await (async () => {
  const c = { reads: 0, writes: 0 }, jobs = [], hooks = { explode: [] };
  const key = (x, y, z) => `${x},${y},${z}`;
  const mod = await loadRopeFull({ beforeEvents: { startup: { subscribe() {} } }, runJob: (g) => jobs.push(g) }, hooks);
  const make = () => {
    const cells = new Map(), items = [];
    const dimension = { id: "overworld", heightRange: { min: -64, max: 320 }, getBlock(p) { c.reads++; return cells.get(key(p.x, p.y, p.z)); },
      spawnItem(stack) { c.writes++; items.push(stack.amount); } };
    for (let x = 0; x < 10; x++) for (let y = 0; y < 100; y++) {
      cells.set(key(x, y, 0), { typeId: ROPE, permutation: ropePerm(), setType(id) { c.writes++; this.typeId = id; this.permutation = ropePerm(id); } });
    }
    const exploded = [];
    for (let x = 0; x < 10; x++) for (let y = x < 5 ? 0 : 50; y < 100; y++) exploded.push({ x, y, z: 0 });
    for (const p of exploded) { const cell = cells.get(key(p.x, p.y, p.z)); cell.typeId = "minecraft:air"; cell.permutation = ropePerm("minecraft:air"); }
    return { dimension, cells, items, exploded };
  };
  const state = (r) => JSON.stringify([...r.cells].map(([k, b]) => [k, b.typeId]));
  const r0 = (r) => r.exploded.length;
  test("rope explosion: 750 exploded pieces are noted without a native call and removed by one job in counted steps, same drops as a call per piece", () => {
    const ref = make(); jobs.length = 0; c.reads = c.writes = 0; // the old behaviour: one removal call per exploded piece
    for (const p of ref.exploded) mod.dropWholeRope(ref.dimension, p, "north");
    for (let alive = jobs.splice(0); alive.length;) alive = alive.filter((j) => !j.next().done);
    console.log(`     rope explosion before: ${c.reads} reads + ${c.writes} writes spread over ${r0(ref)} callbacks (each up to 128 reads + 16 writes inline)`);
    const r = make(); jobs.length = 0; c.reads = c.writes = 0;
    for (const location of r.exploded) for (const fn of hooks.explode) fn({ block: { location }, dimension: r.dimension, explodedBlockPermutation: ropePerm() });
    assert.equal(r.exploded.length, 750);
    assert.equal(c.reads + c.writes, 0, "the callbacks touch no block");
    assert.equal(jobs.length, 1, "one job for the whole blast");
    const steps = drive(c, jobs.shift());
    within("rope explosion (750 pieces)", steps);
    assert.equal(state(r), state(ref), "same world afterwards");
    assert.deepEqual(r.items.slice().sort((a, b) => a - b), ref.items.slice().sort((a, b) => a - b), "same drops (every piece once)");
    assert.equal(r.items.reduce((a, b) => a + b, 0), 250, "one item per surviving piece (5 ropes x 50); the engine drops the exploded ones");
    const again = make(); // a second blast after the job has ended starts a fresh job
    for (const location of again.exploded.slice(0, 3)) for (const fn of hooks.explode) fn({ block: { location }, dimension: again.dimension, explodedBlockPermutation: ropePerm() });
    assert.equal(jobs.length, 1);
  });
})();

await (async () => {
  const jobs = [];
  const key = (p) => `${p.x},${p.y},${p.z}`;
  const build = async () => {
    const c = { reads: 0, writes: 0 }, cells = new Map(), commands = [], ropeCalls = [], handlers = {};
    const dimension = { id: "overworld", getBlock(p) { c.reads++; return cells.get(key(p)) ?? air(p); },
      runCommand(command) { c.writes++; commands.push(command); const [, x, y, z] = command.split(" "); put({ x: +x, y: +y, z: +z }, "minecraft:air"); } };
    const air = (p) => ({ location: { ...p }, dimension, typeId: "minecraft:air", isAir: true, isLiquid: false, permutation: { getState: () => undefined } });
    const put = (p, typeId, states = {}) => cells.set(key(p), { location: { ...p }, dimension, typeId, isAir: typeId === "minecraft:air", isLiquid: false,
      permutation: { getState: (name) => (name in states ? states[name] : undefined) } });
    globalThis.__supportAdapter = { ...worldUtil, SUPPORT_POLICIES, createSupportMotionService, supportOffset, cornSoilAllowed, CORN_ORIGIN,
      dropWholeRope(...call) { ropeCalls.push(call); },
      system: { currentTick: 0, runTimeout() {}, runJob: (g) => jobs.push(g), beforeEvents: { startup: { subscribe(fn) { fn({ blockComponentRegistry: { registerCustomComponent() {} } }); } } } },
      world: { afterEvents: new Proxy({}, { get: (_, name) => ({ subscribe: (fn) => { handlers[name] = fn; } }) }) } };
    const src = readFileSync(new URL("../lothlorien_bp/scripts/support_motion.js", import.meta.url), "utf8")
      .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__supportAdapter;");
    const adapter = await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}#${Math.random()}`);
    delete globalThis.__supportAdapter;
    // 25 x 25 flowers on a grass floor over a stone layer; 3 ropes hang on a wall column. The blast takes the floor, part of
    // the stone layer and the wall.
    const exploded = [];
    for (let x = 0; x < 25; x++) for (let z = 0; z < 25; z++) {
      put({ x, y: 1, z }, "lothlorien:elanor"); put({ x, y: 0, z }, "minecraft:grass_block"); put({ x, y: -1, z }, "minecraft:stone");
      exploded.push({ x, y: 0, z });
      if (z < 15) exploded.push({ x, y: -1, z });
    }
    for (let k = 0; k < 3; k++) for (let y = 10; y < 60; y++) {
      put({ x: 40 + k, y, z: 0 }, ROPE, { "lothlorien:face": "north" }); put({ x: 40 + k, y, z: 1 }, "minecraft:stone"); exploded.push({ x: 40 + k, y, z: 1 });
    }
    return { c, cells, commands, ropeCalls, handlers, adapter, dimension, exploded };
  };
  const state = (r) => JSON.stringify([...r.cells].map(([k, b]) => [k, b.typeId]).sort());
  const explode = (r) => { for (const p of r.exploded) r.cells.delete(key(p)); };
  const settled = (r) => JSON.stringify([...r.cells].filter(([, b]) => !b.isAir).map(([k, b]) => [k, b.typeId]).sort());
  const ref = await build(); explode(ref); // the old callback: invalidate + resetAround per exploded block, inside the event
  ref.c.reads = ref.c.writes = 0;
  for (const p of ref.exploded) { ref.adapter.supportMotion.invalidate(ref.dimension, p); ref.adapter.supportMotion.resetAround(ref.dimension, p); }
  console.log(`     support blast before: ${ref.c.reads} reads + ${ref.c.writes} writes, all inside the ${ref.exploded.length} event callbacks of one tick`);
  const r = await build(); jobs.length = 0; explode(r);
  test("support motion: a 1,000-block blast notes positions in the callback and checks the supports in counted steps, same removals as a check per block", () => {
    assert.ok(r.exploded.length >= 1000, `${r.exploded.length} exploded blocks`);
    r.c.reads = r.c.writes = 0;
    for (const location of r.exploded) r.handlers.blockExplode({ block: { location }, dimension: r.dimension });
    assert.equal(r.c.reads + r.c.writes, 0, "the callbacks read and write nothing");
    assert.equal(jobs.length, 1, "one job for the whole blast");
    const steps = drive(r.c, jobs.shift());
    within(`support blast (${r.exploded.length} blocks)`, steps);
    assert.equal(settled(r), settled(ref), "same world afterwards");
    assert.equal(r.commands.length, ref.commands.length); assert.equal(r.commands.length, 625, "every flower over the floor pops");
    assert.equal(r.ropeCalls.length, ref.ropeCalls.length); assert.ok(r.ropeCalls.length > 0, "ropes lost their wall");
    assert.ok(r.ropeCalls.every((call) => call[3]?.defer === true), "inside the job a rope removal runs as its own job");
    assert.equal(r.adapter.supportMotion.size(), ref.adapter.supportMotion.size());
  });
})();

finish();
