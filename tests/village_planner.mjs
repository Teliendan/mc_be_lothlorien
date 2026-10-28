// village planner regression tests; run independently or via tests/run.mjs.
import { test, finish } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estimateDepth } from "../lothlorien_bp/scripts/depth.js";
import { B } from "../tools/flet_mallorn.mjs";
import { PLANKS, FENCE } from "../tools/village_sim.mjs";
import { checkWalk } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";
import * as LOOP from "../lothlorien_bp/scripts/village_loop.js";
import { blockLight as sharedLight } from "../../../.claude/skills/bedrock-modding/scripts/structure_light.mjs";
import * as PL from "../lothlorien_bp/scripts/village_planner.js";
import { wkey } from "../tools/village_sim.mjs";
import { applyPlan, joinChecks } from "../tools/village_sim.mjs";
import { gunzipSync } from "node:zlib";

const L = "lothlorien:lothlorien", RIVER = "minecraft:river", FOREST = "minecraft:forest";
const T = new Set([RIVER]);
const depth = (fn) => estimateDepth(fn, L, T);
const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
const SLAB_NAME = "lothlorien:mallorn_slab";
function fixtureWorld(exits) {
  const w = new Map(), at = (x, y, z) => w.get(`${x},${y},${z}`) ?? "minecraft:air";
  for (const e of exits) {
    const a = [e.dir[1], e.dir[0]]; // along the row
    for (const [row, back] of [[0, 0], [1, 1]]) { // row 0 = railing row, row 1 = platform connector row
      const cx = e.x - e.dir[0] * back, cz = e.z - e.dir[1] * back;
      for (let o = -2; o <= 2; o++) {
        w.set(`${cx + a[0] * o},${e.y},${cz + a[1] * o}`, PLANKS);
        if (row === 0 || Math.abs(o) === 2) w.set(`${cx + a[0] * o},${e.y + 1},${cz + a[1] * o}`, FENCE);
      }
    }
  }
  return { w, at };
}
const E = (x, z, dir, y = 40) => ({ x, y, z, dir });
const LEG = (() => {
  const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z, rank = { exit: 0, side: 1, sideside: 1, plaza: 2, L: 3 };
  const findPartner = (at, A) => {
    for (const c of LOOP.scanAhead(A, (x, z) => at(x, A.y + 1, z) === FENCE)) {
      const B = LOOP.exitAt(at, c.x, A.y, c.z);
      if (B && B.dir[0] === -A.dir[0] && B.dir[1] === -A.dir[1]) return { B, length: c.length, dist: c.dist, offset: c.offset, score: c.score };
    }
    return null;
  };
  const findSides = (at, A) => LOOP.scanAhead(A, (x, z) => at(x, A.y + 1, z) === FENCE && !LOOP.exitAt(at, x, A.y, z) && LOOP.sideTarget(at, x, A.y, z, A.dir))
    .map((c) => ({ B: { x: c.x, y: A.y, z: c.z }, length: c.length, dist: c.dist, offset: c.offset, score: c.score }));
  const sideAt = (at, x, y, z) => LOOP.sideStarts(at, x, y, z)[0] ?? null;
  function decide(at, A, opts = {}) {
    const starts = opts.sideStart ? { exits: [], rims: [{ ...A, side: true, run: "t" }] } : { exits: [A], rims: [] };
    const cands = PL.enumerate(at, starts).filter((c) => same(c.A, A)).sort((a, b) => rank[a.kind] - rank[b.kind] || a.score - b.score);
    let fail = null;
    for (const c of cands) { const r = PL.realize(at, c); if (r.plan) return { action: "build", kind: c.kind, partner: c.B, plan: r.plan }; fail ??= r; }
    if (fail) return fail.blocked ? { action: "none", reason: "blocked", blocked: fail.blocked } : { action: "none", reason: fail.error };
    return { action: "none", reason: "no partner" };
  }
  function decideSide(at, x, y, z) {
    let first = null;
    for (const S of LOOP.sideStarts(at, x, y, z)) { const d = decide(at, S, { sideStart: true }); if (d.action === "build") return d; first ??= d; }
    return first ?? { action: "none", reason: "no rim" };
  }
  return { findPartner, findSides, findSide: (at, A) => findSides(at, A)[0] ?? null, sideAt, decide, decideSide };
})();
function addPlatform(w, x0, x1, z0, z1, y = 40) {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    w.set(`${x},${y},${z}`, PLANKS);
    if (x === x0 || x === x1 || z === z0 || z === z1) w.set(`${x},${y + 1},${z}`, FENCE);
  }
}
const withGround = (at, top, extra = () => undefined) => (x, y, z) => extra(x, y, z) ?? (at(x, y, z) !== "minecraft:air" ? at(x, y, z) : y <= top ? "minecraft:stone" : "minecraft:air");
const LOGN = "lothlorien:mallorn_log";
function exitPlatform(w, ex, ez, dir, { y = 40, depth = 9, half = 4 } = {}) {
  const a = [Math.abs(dir[1]), Math.abs(dir[0])], xz = (t, o) => [ex - dir[0] * t + a[0] * o, ez - dir[1] * t + a[1] * o];
  const put = (t, o, fence) => { const [x, z] = xz(t, o); w.set(`${x},${y},${z}`, PLANKS); if (fence) w.set(`${x},${y + 1},${z}`, FENCE); };
  for (let o = -2; o <= 2; o++) put(0, o, true);
  for (let t = 1; t <= depth; t++) for (let o = -half; o <= half; o++) put(t, o, t === depth || Math.abs(o) === half || (t === 1 && Math.abs(o) >= 2));
}
const mkWorld = (build) => { // Map "x,y,z" fixture -> sim world (wkey) with stone below y 35
  const w = new Map(); build(w);
  const world = new Map(), states = new Map();
  for (const [k, v] of w) { const [x, y, z] = k.split(",").map(Number); world.set(wkey(x, y, z), v); states.set(wkey(x, y, z), v === FENCE ? { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false } : {}); }
  const at = (x, y, z) => world.get(wkey(x, y, z)) ?? (y < 35 ? "minecraft:stone" : "minecraft:air");
  return { world, states, at };
};
const joined = (f, d) => { // apply a built plan and run the walk + light checks on it
  assert.equal(d.action, "build", d.reason);
  const r = joinChecks(f.world, f.states, d.plan, () => applyPlan(f.world, f.states, d.plan));
  assert.deepEqual(r.walk, [], `${d.kind}: walk violations`);
  assert.ok(r.light >= LOOP.LOOP.lightTarget, `${d.kind}: darkest walk cell ${r.light}`);
  return r;
};
const deck = (w, d, extra = {}) => (x, y, z) => { // a hand-made deck: planks at y 0, air at y 1..3, anything else unloaded
  if (x < 0 || z < 0 || x >= w || z >= d) return undefined;
  if (extra[`${x},${y},${z}`]) return extra[`${x},${y},${z}`];
  return y === 0 ? PLANKS : y >= 1 && y <= 3 ? "minecraft:air" : undefined;
};

test("loop closer: partner search takes facing exits at the same height within reach, nearest first, and refuses the rest", () => {
  const A = E(0, 0, [0, 1]);
  const find = (...others) => { const { at } = fixtureWorld([A, ...others]); return LEG.findPartner(at, A); };
  const ok = find(E(0, 12, [0, -1]));
  assert.deepEqual([ok.B.x, ok.B.z, ok.length, ok.offset], [0, 12, 13, 0]);
  assert.equal(find(E(3, 12, [0, -1])).offset, 3); // ex = (dir.z, -dir.x) = (1, 0)
  assert.equal(find(E(-3, 12, [0, -1])).offset, -3);
  assert.equal(find(E(0, 12, [0, -1]), E(1, 9, [0, -1])).B.z, 9, "nearest first");
  assert.equal(find(E(0, 1, [0, -1])), null, "too close (the rows would touch: minDist 2)");
  assert.ok(find(E(0, 2, [0, -1])) && find(E(0, 5, [0, -1])) && find(E(0, 6, [0, -1])) && find(E(0, 17, [0, -1])), "2..5: a flat deck (F2)");
  assert.ok(find(E(0, 18, [0, -1])) && find(E(0, 30, [0, -1])), "18..30: a span with a landing");
  assert.equal(find(E(0, 31, [0, -1])), null, "too far");
  assert.ok(find(E(8, 24, [0, -1])) && !find(E(9, 24, [0, -1])), "a span may shift 8 sideways, not 9");
  assert.ok(find(E(8, 12, [0, -1])) && !find(E(9, 12, [0, -1])), "direct bridge: 8 sideways at most (F3, owner 2026-10-09), 9 is too far");
  assert.equal(find(E(0, 12, [0, 1])), null, "same facing, not facing each other");
  assert.equal(find(E(0, 12, [0, -1], 41)), null, "other deck height");
  assert.equal(find(E(0, -12, [0, -1])), null, "behind");
  assert.ok(find(E(6, 8, [0, -1])) && !find(E(7, 8, [0, -1])), "sideways is also limited by length - 3");
  assert.equal(LOOP.exitAt(fixtureWorld([A]).at, 0, 40, 0).dir.join(), "0,1");
  assert.equal(LOOP.exitAt(fixtureWorld([E(4, 4, [1, 0])]).at, 4, 40, 4).dir.join(), "1,0");
  assert.equal(LOOP.exitAt(fixtureWorld([E(4, 4, [-1, 0])]).at, 4, 40, 4).dir.join(), "-1,0");
  assert.equal(LOOP.exitAt(fixtureWorld([A]).at, 0, 40, -1), null, "the platform's own connector row is no exit");
});

test("loop planner: a facing pair is one candidate whichever end it starts from; several partners: nearest first, each pair once; all 4 headings", () => {
  const A = E(0, 0, [0, 1]), B = E(2, 12, [0, -1]), { at } = fixtureWorld([A, B]);
  assert.equal(LEG.decide(at, A).action, "build");
  assert.equal(LEG.decide(at, B).action, "build", "no standing down any more: the planner picks the pair once, from either end");
  const C = E(-1, 9, [0, -1]), w2 = fixtureWorld([A, B, C]); // A prefers C (nearer)
  assert.equal(LEG.decide(w2.at, A).partner.z, 9);
  assert.equal(PL.enumerate(w2.at, { exits: [A, B, C], rims: [] }).filter((c) => c.kind === "exit").length, 2, "A-B and A-C, each pair once");
  const one = PL.planVillage(w2.at, [[0, 40, 0], [2, 40, 12], [-1, 40, 9]], { budget: 1 });
  assert.deepEqual([one.picks.length, one.picks[0].kind, one.picks[0].B.z], [1, "exit", 9], "budget 1: the nearer partner");
  for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const a1 = E(10, 10, dir), b1 = E(10 + dir[0] * 12 + dir[1] * 2, 10 + dir[1] * 12 - dir[0] * 2, [-dir[0], -dir[1]]), f = fixtureWorld([a1, b1]);
    const d = LEG.decide(f.at, a1), e = LEG.decide(f.at, b1);
    assert.deepEqual([d.action, e.action], ["build", "build"], `heading ${dir}`);
    assert.equal(d.plan.length, 13);
    assert.equal(PL.enumerate(f.at, { exits: [a1, b1], rims: [] }).length, 1, `heading ${dir}: one candidate for the pair`);
  }
});

test("loop closer: corridor check - air and leaves are cleared, anything else (log, planks, rock, unloaded) aborts; a built bridge removes both exits and clears leaves", () => {
  const A = E(0, 0, [0, 1]), B = E(3, 12, [0, -1]);
  const build = (extra = []) => { const f = fixtureWorld([A, B]); for (const [k, v] of extra) f.w.set(k, v); return f; };
  const base = build(), plan = LEG.decide(base.at, A).plan;
  assert.equal(plan.offset, 3);
  assert.deepEqual(LOOP.blockedCells(base.at, plan), []);
  const mid = [...LOOP.finalBlocks(plan)].find(([k, b]) => b.id === PLANKS && k.split(",")[2] === "6")[0];
  const [mx, my, mz] = mid.split(",").map(Number);
  for (const [name, block, blocks] of [["leaves", "lothlorien:mallorn_leaves", false], ["log", "lothlorien:mallorn_log", true], ["stone", "minecraft:stone", true], ["planks", PLANKS, true]]) {
    for (const dy of [0, 1, 3]) { // the deck itself and the headroom both count
      const f = build([[`${mx},${my + dy},${mz}`, block]]), d = LEG.decide(f.at, A);
      if (name === "planks" && dy === 0) continue; // the deck cell may already be planks only in the end rows
      assert.equal(d.action, blocks ? "none" : "build", `${name} at +${dy}`);
      if (blocks) assert.equal(d.reason, "blocked");
    }
  }
  assert.equal(LEG.decide((x, y, z) => (z === 6 ? undefined : base.at(x, y, z)), A).action, "none", "unloaded cells abort");
  const f = build([[`${mx},${my + 2},${mz}`, "lothlorien:mallorn_leaves"]]), d = LEG.decide(f.at, A);
  assert.equal(d.action, "build");
  for (const [k, b] of LOOP.finalBlocks(d.plan)) b.id === "minecraft:air" ? f.w.delete(k) : f.w.set(k, b.id);
  assert.equal(LOOP.exitAt(f.at, A.x, A.y, A.z), null);
  assert.equal(LOOP.exitAt(f.at, B.x, B.y, B.z), null);
  assert.equal(f.at(A.x, A.y + 1, A.z), "minecraft:air", "the railing's centre is open");
  assert.equal(f.at(A.x + 2, A.y + 1, A.z), FENCE, "the railing's outer posts stay as the bridge rails");
  assert.equal(f.at(mx, my + 2, mz), "minecraft:air", "leaves in the corridor are cleared");
});

test("loop closer (P7b): an exit joins the side of a platform - straight 5-cell rail run, plain deck two rows deep; stairs, slabs, short runs, other heights, curved rims and bridges are refused", () => {
  const A = E(0, 0, [0, 1]);
  const mk = (edit) => { const f = fixtureWorld([A]); addPlatform(f.w, -3, 3, 12, 20); edit?.(f.w); return f; };
  const f = mk(), d = LEG.decide(f.at, A);
  assert.equal(d.action, "build");
  assert.equal(d.kind, "side");
  assert.deepEqual([d.plan.B.x, d.plan.B.z, d.plan.length, d.plan.offset], [0, 12, 13, 0]);
  const sided = LEG.decide(mk().at, E(3, 0, [0, 1]));
  assert.equal(sided.kind, "side", "any cell of the straight run (sideways offset within reach)");
  // apply: the 3 centre rail cells open, the two posts stay, no link into the platform, bridge rails link to the posts
  const blocks = LOOP.finalBlocks(d.plan);
  for (const [k, b] of blocks) b.id === "minecraft:air" ? f.w.delete(k) : f.w.set(k, b.id);
  for (const o of [-1, 0, 1]) assert.equal(f.at(o, 41, 12), "minecraft:air");
  for (const o of [-2, 2]) assert.equal(f.at(o, 41, 12), FENCE);
  assert.equal(blocks.get("-2,41,12").states["minecraft:connection_south"], false);
  assert.equal(blocks.get("-2,42,12").states["minecraft:connection_north"], true, "the arch's step post above the rim post links to the bridge rail");
  assert.equal(blocks.get("-2,42,12").states["minecraft:connection_south"], false);
  assert.equal(f.at(0, 40, 12), PLANKS);
  // refusals (each makes the exit find no target)
  const none = (edit, why) => assert.equal(LEG.findSide(mk(edit).at, A), null, why);
  none((w) => { for (const o of [-1, 0, 1]) w.delete(`${o},40,13`); }, "stair opening / hole right behind the rim");
  none((w) => { w.set("0,40,13", SLAB_NAME); }, "slab behind the rim");
  none((w) => { w.set("0,41,13", "lothlorien:mallorn_log"); }, "obstacle in the walk cells behind");
  none((w) => { for (let x = -3; x <= 3; x++) for (let z = 14; z <= 20; z++) w.delete(`${x},40,${z}`), w.delete(`${x},41,${z}`); }, "only one deck row behind");
  none((w) => { w.delete("-1,41,12"); }, "rail run shorter than 5 around the centre");
  const short = fixtureWorld([A]); addPlatform(short.w, -2, 3, 12, 20); // 6 wide platform: a run of 6 rail cells (a 5-wide one is a railing_end lookalike) -> accepted
  assert.ok(LEG.findSide(short.at, A));
  const four = fixtureWorld([A]); addPlatform(four.w, -1, 2, 12, 20); // 4 wide
  assert.equal(LEG.findSide(four.at, A), null, "deck run shorter than 5");
  const high = fixtureWorld([A]); addPlatform(high.w, -5, 5, 12, 20, 41);
  assert.equal(LEG.findSide(high.at, A), null, "wrong height");
  const curved = fixtureWorld([A]); // rounded rim: the front row is only 3 wide, wider rows follow one step back
  addPlatform(curved.w, -5, 5, 13, 20); for (let x = -1; x <= 1; x++) { curved.w.set(`${x},40,12`, PLANKS); curved.w.set(`${x},41,12`, FENCE); }
  for (const x of [-1, 1]) curved.w.set(`${x},41,13`, FENCE);
  assert.equal(LEG.findSide(curved.at, A), null, "a rounded rim (3-cell nub in front of the straight run) is refused: no straight 5-run with open space in front");
  const bridge = fixtureWorld([A]); // a 5-wide bridge crossing the heading: rails at +-2 across, only one walk row deep
  addPlatform(bridge.w, -6, 6, 12, 16); for (let x = -6; x <= 6; x++) { bridge.w.delete(`${x},41,13`); bridge.w.delete(`${x},41,15`); }
  for (let x = -6; x <= 6; x++) for (const z of [13, 14, 15]) bridge.w.delete(`${x},41,${z}`);
  addPlatform(bridge.w, -6, 6, 12, 14);
  assert.equal(LEG.findSide(bridge.at, A), null, "a 3-deep strip (bridge) is no target");
  // exit-exit wins over a platform side that is nearer
  const both = fixtureWorld([A, E(0, 15, [0, -1])]); addPlatform(both.w, -5, 5, 8, 11);
  const pick = LEG.decide(both.at, A);
  assert.equal(pick.kind, "exit");
  assert.equal(pick.partner.z, 15);
  // blocked side corridor reports
  const blockedSide = mk((w) => w.set("0,43,6", "lothlorien:mallorn_log"));
  assert.equal(LEG.decide(blockedSide.at, A).reason, "blocked");
});

test("loop closer: runtime bridges are lit to >= 8 on every walk cell (shared flood fill over the plan's own blocks), all lengths / offsets / headings", () => {
  const passes = (n) => n === undefined || /^minecraft:air$|fence$|elven_lantern(_heartwood)?$|light_block_14$/.test(n);
  let worst = 99, count = 0;
  for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    for (let length = LOOP.LOOP.minDist + 1; length <= LOOP.LOOP.maxDist + 1; length++) {
      const maxOff = Math.min(LOOP.LOOP.maxOffset, length - 3);
      for (let off = -maxOff; off <= maxOff; off++) {
        const A = E(0, 0, dir), ex = [dir[1], -dir[0]], B = E(dir[0] * (length - 1) + ex[0] * off, dir[1] * (length - 1) + ex[1] * off, [-dir[0], -dir[1]]);
        const plan = LOOP.planBridge(A, B, length, off), blocks = LOOP.finalBlocks(plan);
        const xs = [...blocks.keys()].map((k) => k.split(",").map(Number)), lo = [0, 1, 2].map((i) => Math.min(...xs.map((c) => c[i]))), hi = [0, 1, 2].map((i) => Math.max(...xs.map((c) => c[i])));
        const get = (x, y, z) => blocks.get(`${x + lo[0]},${y + lo[1]},${z + lo[2]}`)?.id;
        const size = [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1];
        const L = sharedLight(get, size, { [LOOP.HIDDEN_LIGHT]: 14 }, passes); // the hidden lights ALONE keep the bridge lit (the visible lamps may be broken)
        for (const [k, b] of blocks) { // walk cells = feet cells above a plank / slab with two air cells above
          if (b.id !== PLANKS && b.id !== SLAB_NAME) continue;
          const [x, y, z] = k.split(",").map(Number);
          if (blocks.get(`${x},${y + 1},${z}`)?.id !== "minecraft:air" || blocks.get(`${x},${y + 2},${z}`)?.id !== "minecraft:air") continue;
          const l = L.get(`${x - lo[0]},${y + 1 - lo[1]},${z - lo[2]}`) ?? 0;
          worst = Math.min(worst, l); count++;
          assert.ok(l >= LOOP.LOOP.lightTarget, `heading ${dir} length ${length} offset ${off}: walk cell ${x},${y + 1},${z} has light ${l}`);
        }
        assert.equal(plan.lights.filter((l) => l.row === 0 || l.row === length - 1).length, 0, "no hidden light in the connector rows");
        assert.equal(plan.lamps.filter((l) => l.row === 0 || l.row === length - 1).length, 0, "no lamp in the connector rows");
        assert.ok(plan.lights.length <= 8, `${plan.lights.length} hidden lights`);
        // M7 WP3: lamp posts at both bridge ends (rows 1 and length - 2, on both rails: the rail post, a second fence, the lantern on top); a gate arch on straight bridges >= 11
        const ends = plan.lamps.filter((l) => l.id === undefined);
        if (off === 0) { const rows = new Map(); for (const l of plan.lamps) rows.set(l.row, (rows.get(l.row) ?? 0) + 1); for (const [r, n] of rows) assert.equal(n, 2, `heading ${dir} length ${length}: lamp row ${r} has ${n} posts (every post has its twin on the other rail)`); }
        if (length >= 4) assert.ok(ends.length >= 2 && plan.lamps.every((l) => blocks.get(`${l.x},${l.y - 1},${l.z}`)?.id === FENCE && blocks.get(`${l.x},${l.y},${l.z}`)?.id.includes("elven_lantern")), `heading ${dir} length ${length} offset ${off}: lamp posts`);
        if (length >= 11 && off === 0) assert.ok(plan.lamps.filter((l) => l.id === "lothlorien:elven_lantern_heartwood" && l.row === (length - 1) >> 1).length === 2 && plan.blocks.length === 0, `heading ${dir} length ${length}: gate (two gold lamp posts at mid-span, no bar, nothing hanging)`);
        else assert.equal(plan.lamps.filter((l) => l.id !== undefined).length, 0, "no gate on short or offset bridges");
      }
    }
  }
  console.log(`loop closer bridges: ${count} walk cells, darkest ${worst}`);
});

test("loop closer (long spans): above 17 blocks two bridges meet on a 5 x 5 landing that stands on a log pier to the ground; walkable end to end, rails closed, openings cut", () => {
  for (const [dist, lat] of [[18, 0], [22, 5], [26, -6], [30, 8], [30, -8]]) {
    for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const ex = [dir[1], -dir[0]], A = E(0, 0, dir), B = E(dir[0] * dist + ex[0] * lat, dir[1] * dist + ex[1] * lat, [-dir[0], -dir[1]]);
      const f = fixtureWorld([A, B]), at = withGround(f.at, 20), dA = LEG.decide(at, A), d = dA.action === "build" ? dA : LEG.decide(at, B); // the smaller (x, z) builds
      assert.equal(d.action, "build", `dist ${dist} lat ${lat} heading ${dir}`);
      const plan = d.plan, L = plan.landing;
      assert.ok(plan.landing && plan.length === dist + 1 && plan.offset === lat);
      assert.equal(L.d1 + 4 + L.d2, dist);
      assert.ok(L.d1 >= LOOP.LOOP.minDist && L.d2 >= LOOP.LOOP.minDist && L.d1 <= LOOP.LOOP.maxDist && L.d2 <= LOOP.LOOP.maxDist);
      const out = LOOP.finalBlocks(plan), get = (x, y, z) => out.get(`${x},${y},${z}`)?.id ?? at(x, y, z);
      // landing deck 5 x 5, rim fenced except the two 3-wide openings, two lamp posts on the side posts and a hidden light over the middle
      let deck = 0, fences = 0;
      for (let k = 0; k < 5; k++) for (let o = -2; o <= 2; o++) {
        const x = L.x + dir[0] * (k - 2) + ex[0] * o, z = L.z + dir[1] * (k - 2) + ex[1] * o;
        if (get(x, 40, z) === PLANKS) deck++;
        const rim = k === 0 || k === 4 || Math.abs(o) === 2, opening = (k === 0 || k === 4) && Math.abs(o) <= 1;
        if (get(x, 41, z) === FENCE) fences++;
        assert.equal(get(x, 41, z) === FENCE, rim && !opening, `landing cell k${k} o${o}`);
        if (!rim) for (const up of [1, 2, 3]) assert.equal(get(x, 40 + up, z), "minecraft:air");
      }
      assert.equal(deck, 25); assert.equal(fences, 10); // 16 rim cells - 2 x 3 opening cells
      assert.equal(plan.lamps.filter((l) => l.row === L.d1 + 2).length, 2);
      // pier: plus of columns under the centre from under the deck to y 21 (ground top 20), four braces under the deck
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) for (let y = 21; y <= 39; y++) assert.equal(get(L.x + dx, y, L.z + dz), LOGN, `pier ${dx},${dz} at ${y}`);
      assert.equal(get(L.x, 20, L.z), "minecraft:stone");
      for (const [dx, dz, dy] of [[2, 0, -1], [-2, 0, -1], [0, 2, -1], [0, -2, -1], [2, 0, -3], [0, -2, -3]]) assert.equal(get(L.x + dx, 40 + dy, L.z + dz), LOGN, `brace ${dx},${dz},${dy}`);
      // both end rows are opened, rows 0..dist all have a 3-wide walk (deck / slab with 2 free cells above)
      assert.equal(get(A.x, 41, A.z), "minecraft:air"); assert.equal(get(B.x, 41, B.z), "minecraft:air");
      for (let row = 0; row <= dist; row++) {
        let walk = 0;
        for (const k of out.keys()) {
          const [x, y, z] = k.split(",").map(Number);
          if ((x - A.x) * dir[0] + (z - A.z) * dir[1] !== row || ![PLANKS, SLAB_NAME].includes(out.get(k).id)) continue;
          if (get(x, y + 1, z) === "minecraft:air" && get(x, y + 2, z) === "minecraft:air") walk++;
        }
        assert.ok(walk >= 3, `row ${row}: ${walk} walk cells (dist ${dist} lat ${lat} heading ${dir})`);
      }
    }
  }
});

test("loop closer (long spans): bridges and landing are lit to >= 8 on every walk cell, no lantern in the end rows, all spans / offsets / headings", () => {
  const passes = (n) => n === undefined || /^minecraft:air$|fence$|elven_lantern(_heartwood)?$|light_block_14$/.test(n);
  let worst = 99, count = 0;
  for (const dir of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    for (let dist = LOOP.LOOP.maxDist + 1; dist <= LOOP.LOOP.maxSpan; dist++) {
      for (let lat = -LOOP.LOOP.maxSpanOffset; lat <= LOOP.LOOP.maxSpanOffset; lat += 2) {
        const A = E(0, 0, dir), ex = [dir[1], -dir[0]], B = E(dir[0] * dist + ex[0] * lat, dir[1] * dist + ex[1] * lat, [-dir[0], -dir[1]]);
        for (const side of [false, true]) {
          const plan = LOOP.planSpan(A, B, dist, lat, side), blocks = LOOP.finalBlocks(plan);
          const xs = [...blocks.keys()].map((k) => k.split(",").map(Number)), lo = [0, 1, 2].map((i) => Math.min(...xs.map((c) => c[i]))), hi = [0, 1, 2].map((i) => Math.max(...xs.map((c) => c[i])));
          const get = (x, y, z) => blocks.get(`${x + lo[0]},${y + lo[1]},${z + lo[2]}`)?.id;
          const L = sharedLight(get, [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1], { [LOOP.HIDDEN_LIGHT]: 14 }, passes);
          for (const [k, b] of blocks) {
            if (b.id !== PLANKS && b.id !== SLAB_NAME) continue;
            const [x, y, z] = k.split(",").map(Number);
            if (blocks.get(`${x},${y + 1},${z}`)?.id !== "minecraft:air" || blocks.get(`${x},${y + 2},${z}`)?.id !== "minecraft:air") continue;
            const l = L.get(`${x - lo[0]},${y + 1 - lo[1]},${z - lo[2]}`) ?? 0;
            worst = Math.min(worst, l); count++;
            assert.ok(l >= LOOP.LOOP.lightTarget, `heading ${dir} dist ${dist} lat ${lat}: walk cell ${x},${y + 1},${z} has light ${l}`);
          }
          assert.equal(plan.lights.concat(plan.lamps).filter((l) => l.row === 0 || l.row === dist).length, 0, "no lamp or light in the two end rows");
        }
      }
    }
  }
  console.log(`loop closer long spans: ${count} walk cells, darkest ${worst}`);
});

test("loop closer (pier): stands on any ground, goes through leaves and a lake to its bottom, refuses lava, no ground within reach and unloaded columns", () => {
  const A = E(0, 0, [0, 1]), B = E(0, 24, [0, -1]), f = fixtureWorld([A, B]);
  const L = LEG.decide(withGround(f.at, 20), A).plan.landing; // centre (0, 40, 10 + 2 = 12)
  assert.equal(L.z, 12);
  const plan = (top, extra) => LEG.decide(withGround(f.at, top, extra), A);
  const uneven = plan(20, (x, y, z) => (x === 1 && z === 12 && y <= 33 ? "minecraft:dirt" : undefined)); // one arm's column hits a hill at 33
  const logs = [...LOOP.finalBlocks(uneven.plan)].filter(([, b]) => b.id === LOGN).map(([k]) => k);
  assert.ok(logs.includes("1,34,12") && !logs.includes("1,33,12") && logs.includes("0,21,12"), "each column stops on its own ground");
  const lake = plan(20, (x, y, z) => (y >= 21 && y <= 33 && Math.abs(x) < 8 && z > 5 && z < 20 ? "minecraft:water" : undefined));
  assert.equal(lake.action, "build"); assert.ok(LOOP.finalBlocks(lake.plan).get("0,25,12")?.id === LOGN, "pier stands in the water down to the bottom");
  const leaves = plan(20, (x, y, z) => (y === 30 && z === 12 && x === 0 ? "lothlorien:mallorn_leaves" : undefined));
  assert.equal(leaves.action, "build"); assert.equal(LOOP.finalBlocks(leaves.plan).get("0,30,12")?.id, LOGN, "leaves are replaced");
  assert.equal(plan(20, (x, y, z) => (x === 0 && z === 12 && y === 25 ? "minecraft:lava" : undefined)).reason, "pier over lava");
  const D = LOOP.LOOP.pierMaxDepth; // ground at 39 - D is just in reach (D free cells below the deck at 39)
  assert.match(plan(38 - D).reason, new RegExp(`no ground within ${D}`));
  assert.equal(plan(39 - D).action, "build", "ground just in reach");
  assert.equal(LEG.decide((x, y, z) => (y < 38 && x === 0 && z === 12 ? undefined : withGround(f.at, 20)(x, y, z)), A).reason, "pier column not loaded");
  // a span that cannot get a pier falls back to a nearer target if there is one, otherwise none
  const near = fixtureWorld([A, E(0, 24, [0, -1])]); addPlatform(near.w, -3, 3, 12, 20);
  assert.equal(LEG.decide(withGround(near.at, 38 - LOOP.LOOP.pierMaxDepth), A).kind, "side", "pier impossible, the platform side is nearer anyway");
});

test("loop closer (lantern on a rim post): a bridge into a platform side may replace the lantern that stands next to the opening", () => {
  const A = E(0, 0, [0, 1]), f = fixtureWorld([A]);
  addPlatform(f.w, -6, 6, 12, 20);
  for (const x of [-2, 2]) f.w.set(`${x},42,12`, "lothlorien:elven_lantern");
  const d = LEG.decide(f.at, A);
  assert.equal(d.action, "build"); assert.equal(d.kind, "side");
  assert.deepEqual(LOOP.blockedCells(f.at, d.plan), []);
});

test("loop closer (F1): a rim run of one platform starts a bridge to the facing rim of another; both rims open, rails continuous, lit; sideAt finds the run from a marker up to 4 cells off", () => {
  const g = mkWorld((w) => { addPlatform(w, -5, 5, 0, 8); addPlatform(w, -4, 6, 19, 27); });
  const S = LEG.sideAt(g.at, 0, 40, 8);
  assert.deepEqual([S.x, S.z, S.dir.join()], [0, 8, "0,1"]);
  assert.ok(LEG.sideAt(g.at, 3, 40, 8) && LEG.sideAt(g.at, -4, 40, 8), "a marker 3-4 cells along the rim still finds a run");
  assert.equal(LEG.sideAt(g.at, 0, 40, 4), null, "a deck cell inside the platform is no rim");
  assert.equal(LEG.sideAt(g.at, 20, 40, 8), null);
  const d = LEG.decide(g.at, S, { sideStart: true });
  assert.equal(d.kind, "sideside");
  assert.deepEqual([d.plan.length, d.plan.offset], [12, 0]);
  joined(g, d);
  for (const o of [-1, 0, 1]) assert.equal(g.at(o, 41, 8), "minecraft:air", "near rim opened");
  assert.equal(g.at(-2, 41, 8), FENCE);
  assert.equal(LEG.sideAt(g.at, 0, 40, 8), null, "after the join the rim has an opening: no second join from the same rim run");
  assert.equal(LEG.sideAt(g.at, 1, 40, 19), null, "and none from the far rim either");
});

test("loop closer (F1): no side start from a stair opening; the clutter rule refuses a join within 2 cells of foreign deck (offset 1 and 4); never through another structure", () => {
  for (const off of [1, 4]) {
    const mk = (extra) => mkWorld((w) => { addPlatform(w, -5, 5, 0, 8); addPlatform(w, -5 + off, 5 + off, 19, 27); extra?.(w); });
    const A = { x: 0, y: 40, z: 8, dir: [0, 1] };
    assert.equal(LEG.decide(mk().at, A, { sideStart: true }).action, "build", `offset ${off}`);
    const near = mk((w) => { for (let x = 4; x <= 8; x++) { w.set(`${x},40,13`, PLANKS); w.set(`${x},41,13`, FENCE); } }); // a foreign strip 2 cells from the bridge edge
    const dn = LEG.decide(near.at, A, { sideStart: true });
    assert.deepEqual([dn.action, dn.reason], ["none", "clutter"], `offset ${off}: foreign deck within 2 cells`);
    if (off === 1) assert.equal(LEG.decideSide(near.at, 0, 40, 8).kind, "sideside", "the marker tries the next rim cells: a start further along the rim is free");
    const farOff = mk((w) => { for (let x = 9; x <= 12; x++) { w.set(`${x},40,13`, PLANKS); w.set(`${x},41,13`, FENCE); } });
    assert.equal(LEG.decide(farOff.at, A, { sideStart: true }).action, "build", "3 cells away is fine");
  }
  const blocked = mkWorld((w) => { addPlatform(w, -5, 5, 0, 8); addPlatform(w, -5, 5, 19, 27); for (let x = -9; x <= 9; x++) w.set(`${x},42,13`, "lothlorien:mallorn_log"); });
  assert.equal(LEG.decide(blocked.at, { x: 0, y: 40, z: 8, dir: [0, 1] }, { sideStart: true }).reason, "blocked");
  const stairs = mkWorld((w) => { addPlatform(w, -5, 5, 0, 8); addPlatform(w, -5, 5, 19, 27); for (let x = -1; x <= 1; x++) w.delete(`${x},40,7`); });
  assert.equal(LEG.sideAt(stairs.at, 0, 40, 8), null, "a hole behind the rim (stair opening) is no side");
});

test("loop closer (F2/F3): exits 2..5 apart get a FLAT deck (no arch, no slabs), 6.. the arch; sideways reach is 8 for a direct bridge; all lit and walkable", () => {
  for (const dist of [2, 3, 4, 5, 6]) { // length dist + 1 <= 5 (dist <= 4) is flat
    const f = mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 0, dist, [0, -1]); });
    const d = LEG.decide(f.at, LOOP.exitAt(f.at, 0, 40, 0));
    assert.equal(d.kind, "exit", `dist ${dist}`);
    assert.equal(d.plan.length, dist + 1);
    const slabs = d.plan.cells.filter((c) => c.kind.startsWith("slab")).length;
    if (dist <= 4) assert.equal(slabs, 0, `dist ${dist}: flat`); else assert.ok(slabs > 0, "arched");
    joined(f, d);
  }
  for (const lat of [6, 7, 8]) {
    const f = mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, lat, 12, [0, -1]); });
    const d = LEG.decide(f.at, LOOP.exitAt(f.at, 0, 40, 0));
    assert.equal(d.kind, "exit", `lateral ${lat}`);
    assert.equal(Math.abs(d.plan.offset), lat);
    joined(f, d);
  }
  const f9 = mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 9, 14, [0, -1]); });
  assert.notEqual(LEG.decide(f9.at, LOOP.exitAt(f9.at, 0, 40, 0)).kind, "exit", "9 sideways is too far for a direct bridge");
});

test("loop closer (F4): the plaza - two close balcony ends 6 sideways (the owner's gap5) get a filled railed deck, rails of the joined edges removed, on a pier; refused when blocked", () => {
  const mk = (extra) => mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 6, 2, [0, -1]); extra?.(w); });
  const f = mk(), A = LOOP.exitAt(f.at, 0, 40, 0);
  assert.ok(A && LOOP.exitAt(f.at, 6, 40, 2));
  assert.equal(LEG.findPartner(f.at, A), null, "no bridge fits (dist 2, lateral 6)");
  assert.equal(LEG.decide(f.at, LOOP.exitAt(f.at, 6, 40, 2)).kind, "plaza", "the other end finds the very same plaza");
  const d = LEG.decide(f.at, A);
  assert.equal(d.kind, "plaza");
  assert.ok(d.plan.cells.filter((c) => c.kind === "plank").length >= 20 && d.plan.pier.length > 0, "a filled deck on a log pier (owner: no unsupported balconies)");
  joined(f, d);
  for (const [x, z] of [[0, 0], [6, 2]]) assert.equal(f.at(x, 41, z), "minecraft:air", "the rails of the joined edges are gone");
  assert.ok([...f.world].some(([, n]) => n === LOOP.HIDDEN_LIGHT));
  const log = mk((w) => w.set("3,41,1", "lothlorien:mallorn_log"));
  assert.notEqual(LEG.decide(log.at, LOOP.exitAt(log.at, 0, 40, 0)).kind, "plaza", "a log in the patch: no plaza");
  const cant = mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1], { depth: 2, half: 2 }); exitPlatform(w, 8, 6, [0, -1], { depth: 2, half: 2 }); });
  assert.notEqual(LEG.decide(cant.at, LOOP.exitAt(cant.at, 0, 40, 0)).kind, "plaza", "the patch would hang more than 4 cells out");
});

test("loop closer (F5): L-join - exits at right angles meet on a 5 x 5 railed, lit landing on a log pier; two straight legs (an 8 / 7 L: total 16, within PLAN.lMaxLen 16; a 12 / 12 L of 25 is refused, owner 2026-10-09), no diagonal; refused by clutter and by obstacles", () => {
  const mk = (extra) => mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 7, 8, [-1, 0]); extra?.(w); });
  const f = mk(), A = LOOP.exitAt(f.at, 0, 40, 0);
  assert.deepEqual(LOOP.findLs(f.at, A).map((c) => [c.s, c.u]), [[8, 7]]);
  assert.equal(LEG.decide(f.at, LOOP.exitAt(f.at, 7, 40, 8)).kind, "L", "the other end finds the same L-join");
  const d = LEG.decide(f.at, A);
  assert.equal(d.kind, "L");
  assert.ok(d.plan.parts.every((p) => p.offset === 0), "both legs straight");
  assert.ok(d.plan.pier.length > 20, "pier under the landing");
  joined(f, d);
  assert.equal(f.at(0, 41, 0), "minecraft:air");
  assert.equal(f.at(7, 41, 8), "minecraft:air");
  assert.equal(f.at(0, 40, 8), PLANKS);
  assert.equal(PL.enumerate(mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 12, 12, [-1, 0]); }).at, { exits: [LOOP.exitAt(mkWorld((w) => { exitPlatform(w, 0, 0, [0, 1]); exitPlatform(w, 12, 12, [-1, 0]); }).at, 0, 40, 0)], rims: [] }).filter((c) => c.kind === "L").length, 0, "big L refused");
  const g = mk((w) => { w.set("0,42,3", "lothlorien:mallorn_log"); }); // in the arch of the first leg
  assert.notEqual(LEG.decide(g.at, LOOP.exitAt(g.at, 0, 40, 0)).kind, "L", "obstacle in a leg");
  const h = mk((w) => { for (let x = 3; x <= 5; x++) { w.set(`${x},40,3`, PLANKS); w.set(`${x},41,3`, FENCE); } });
  assert.notEqual(LEG.decide(h.at, LOOP.exitAt(h.at, 0, 40, 0)).kind, "L", "foreign deck within 2 cells of the first leg");
  assert.ok(LOOP.planPier((x, y, z) => (y === 36 ? "minecraft:lava" : mk().at(x, y, z)), d.plan.landing).error, "the pier gives up over lava (existing error path)");
});

test("loop merge (F6, gap8 / gap9): decks 0 or 1 cell apart open into one - shared railings go, a 1-cell gap is planked and capped, walk + light pass, no budget used; other heights and short runs are left, openWalk is rail-aware", () => {
  const mk = (gap, edit) => mkWorld((w) => { addPlatform(w, -9, -1, 0, 8); addPlatform(w, -1 + gap + 1, 8 + gap, 0, 8); edit?.(w); });
  const marks = (gap) => [[-1, 40, 4], [gap, 40, 4]];
  for (const gap of [0, 1]) {
    const f = mk(gap), res = PL.planVillage(f.at, marks(gap), { budget: 0 });
    assert.equal(res.merges.length, 1, `gap ${gap}`); assert.equal(res.picks.length, 0);
    const m = res.merges[0];
    assert.equal(m.gap, gap); assert.equal(m.len, 7, "rows 1..7 face each other (the corner posts at z 0 and 8 have no deck behind them: they ARE the end posts, the whole stretch opens)");
    joined(f, { action: "build", kind: "merge", plan: m.plan });
    for (const z of [1, 2, 3, 4, 5, 6, 7]) { // the opening
      assert.equal(f.at(-1, 41, z), "minecraft:air"); assert.equal(f.at(gap, 41, z), "minecraft:air");
      if (gap) { assert.equal(f.at(0, 40, z), PLANKS); assert.equal(f.at(0, 41, z), "minecraft:air"); }
    }
    for (const z of [0, 8]) { assert.equal(f.at(-1, 41, z), FENCE); assert.equal(f.at(gap, 41, z), FENCE); if (gap) { assert.equal(f.at(0, 40, z), PLANKS); assert.equal(f.at(0, 41, z), FENCE, "end cap on the filled gap"); } }
    const st = (x, z) => f.states.get(wkey(x, 41, z)) ?? {};
    assert.equal(st(-1, 0)["minecraft:connection_south"], false, "the end post lets go of the removed rail");
    assert.equal(st(-1, 0)["minecraft:connection_north"], false, "and keeps what it had (nothing north of the corner)");
    assert.equal(st(-1, 0)["minecraft:connection_east"], true, "to the partner corner post (gap 0) or the cap (gap 1)");
    if (gap) { assert.equal(st(0, 0)["minecraft:connection_west"], true); assert.equal(st(0, 0)["minecraft:connection_east"], true); }
    const walk = checkWalk((x, y, z) => { const k = wkey(x, y, z), n = f.world.get(k); return n === undefined || n === "minecraft:air" ? undefined : { name: n, states: f.states.get(k) }; }, { x0: -10, x1: 10, y0: 35, y1: 46, z0: -1, z1: 9 }, { must: [{ x: -5, y: 41, z: 4 }, { x: 5, y: 41, z: 4 }] });
    assert.deepEqual(walk.violations.filter((v) => v.rule !== "unguarded_edge"), [], "walkable and connected (the open sides of the fixture platforms' far ends are not the merge's business)");
  }
  assert.equal(PL.planVillage(mk(0).at, marks(0), { budget: 0, mergeCap: 0 }).merges.length, 0, "cap 0 switches merges off");
  assert.equal(PL.planVillage(mk(2).at, [[-1, 40, 4], [2, 40, 4]], { budget: 0 }).merges.length, 0, "2 cells apart is no merge");
  const high = mkWorld((w) => { addPlatform(w, -9, -1, 0, 8); addPlatform(w, 1, 9, 0, 8, 41); });
  assert.equal(PL.planVillage(high.at, [[-1, 40, 4], [1, 41, 4]], { budget: 0 }).merges.length, 0, "different heights are skipped");
  const short = mkWorld((w) => { addPlatform(w, -9, -1, 0, 4); addPlatform(w, 1, 9, 0, 4); });
  assert.equal(PL.planVillage(short.at, [[-1, 40, 2]], { budget: 0 }).merges.length, 1, "3 deck cells between real corner posts: a 3-wide opening (it was too short under the old minRun 4)");
  // no real end post on one side (the far rim row stops at the stretch): that last cell stays a post, 2 cells must remain
  const open1 = mkWorld((w) => { addPlatform(w, -9, -1, 0, 4); addPlatform(w, 1, 9, 0, 4); w.delete("1,41,0"); w.set("1,40,0", "minecraft:air"); });
  const o1 = PL.planVillage(open1.at, [[-1, 40, 2]], { budget: 0 }).merges;
  assert.deepEqual([o1.length, o1[0]?.len], [1, 2], "no post on one end: that end cell stays a post, 2 cells open (openMinTrim)");
  const open2 = mkWorld((w) => { addPlatform(w, -9, -1, 0, 3); addPlatform(w, 1, 9, 0, 3); w.delete("1,41,0"); w.set("1,40,0", "minecraft:air"); });
  assert.equal(PL.planVillage(open2.at, [[-1, 40, 2]], { budget: 0 }).merges.length, 0, "no post on one end and a 2-cell core: 1 cell left, too narrow");
  // real world TT 2026-10-09 (gap8): two 5-wide end caps touching, staggered by 2 cells: A rim row z = 0 (x 0..4), B rim row z = 1 (x 2..6). They share ONE
  // interior cell (x = 3), between two real posts on each row: a 1-cell door
  const stag = (edit) => mkWorld((w) => { addPlatform(w, 0, 4, -8, 0); addPlatform(w, 2, 6, 1, 9); edit?.(w); });
  const sf = stag(), sres = PL.planVillage(sf.at, [[2, 40, -4]], { budget: 0 });
  assert.equal(sres.merges.length, 1, "staggered caps merge"); assert.equal(sres.merges[0].len, 1);
  joined(sf, { action: "build", kind: "merge", plan: sres.merges[0].plan });
  assert.equal(sf.at(3, 41, 0), "minecraft:air"); assert.equal(sf.at(3, 41, 1), "minecraft:air");
  for (const [x, z] of [[2, 0], [4, 0], [2, 1], [4, 1]]) assert.equal(sf.at(x, 41, z), FENCE, `post ${x},${z}`);
  const swalk = checkWalk((x, y, z) => { const k = wkey(x, y, z), n = sf.world.get(k); return n === undefined || n === "minecraft:air" ? undefined : { name: n, states: sf.states.get(k) }; }, { x0: -2, x1: 8, y0: 35, y1: 46, z0: -9, z1: 10 }, { must: [{ x: 2, y: 41, z: -4 }, { x: 4, y: 41, z: 5 }] });
  assert.deepEqual(swalk.violations.filter((v) => v.rule !== "unguarded_edge"), [], "the door connects the two decks");
  const lane = mkWorld((w) => { for (let x = 0; x <= 6; x++) { w.set(`${x},40,0`, PLANKS); w.set(`${x},40,1`, PLANKS); } w.set("3,41,0", FENCE); w.set("3,41,1", FENCE); });
  assert.equal(PL.openWalk(lane.at, { x: 0, y: 40, z: 0 }, { x: 6, y: 40, z: 0 }, 20), false, "a railing wall across the deck blocks the walk");
  lane.world.delete(wkey(3, 41, 1));
  assert.equal(PL.openWalk(lane.at, { x: 0, y: 40, z: 0 }, { x: 6, y: 40, z: 0 }, 20), true, "one open cell lets it through");
  assert.equal(PL.openWalk(lane.at, { x: 0, y: 40, z: 0 }, { x: 6, y: 40, z: 0 }, 5), false, "limit counts steps (a long way round is not a short walk)");
});

test("loop planner: picks the best links of a village globally and respects the budget (3 extra links); nothing readable beyond the area is used", () => {
  const exits = [];
  for (const x of [0, 40, 80, 120]) exits.push(E(x, 0, [0, 1]), E(x, 12 + x / 40, [0, -1])); // four independent facing pairs (12..15 apart)
  const f = fixtureWorld(exits), marks = exits.map((e) => [e.x, e.y, e.z]);
  assert.equal(PL.enumerate(f.at, PL.startsFromMarkers(f.at, marks)).filter((c) => c.kind === "exit").length, 4);
  for (const [budget, want] of [[1, 1], [2, 2], [3, 3], [4, 4], [9, 4]]) assert.equal(PL.planVillage(f.at, marks, { budget }).picks.length, want, `budget ${budget}`);
  assert.equal(PL.PLAN.budget, 3, "default: up to 3 extra links per village (owner 2026-10-09)");
  assert.equal(PL.planVillage(f.at, marks).picks.length, 3);
  const blocked = (x, y, z) => (x === 0 && y > 40 && y < 48 && z === 6 ? "lothlorien:mallorn_log" : f.at(x, y, z));
  assert.ok(PL.planVillage(blocked, marks, { budget: 9 }).picks.every((p) => p.A.x !== 0 && p.B.x !== 0), "a trunk in the corridor: that pair is skipped, the others stay");
  assert.equal(PL.planVillage(blocked, marks, { budget: 9 }).picks.length, 3);
  const bounded = PL.boundedReader(f.at, { x0: -16, x1: 15, z0: -16, z1: 15 });
  assert.equal(bounded(0, 40, 0), PLANKS); assert.equal(bounded(40, 40, 0), undefined, "outside the loaded area: unreadable");
  assert.equal(PL.planVillage(bounded, marks, { budget: 9 }).picks.length, 1, "only the pair inside the area; unreadable cells never become a join");
  assert.equal(PL.planVillage(f.at, [], {}).picks.length, 0, "no markers, no starts");
});

test("loop planner: only a real shortcut is built - a pair that is already connected by a short walk is left alone", () => {
  const A = E(0, 0, [0, 1]), B = E(0, 12, [0, -1]), f = fixtureWorld([A, B]);
  for (let z = 1; z <= 11; z++) for (let x = -6; x <= -3; x++) f.w.set(`${x},40,${z}`, PLANKS); // a deck beside the corridor that links both platforms
  for (let x = -6; x <= -3; x++) { f.w.set(`${x},40,0`, PLANKS); f.w.set(`${x},40,12`, PLANKS); }
  assert.equal(PL.planVillage(f.at, [[0, 40, 0], [0, 40, 12]]).picks.length, 0, "walking round is as short as the bridge");
});

test("loop planner: discovery grows the ticking area round by round until the marker set is stable, keeps within the quota, and fails cleanly", async () => {
  const cell = (x, z) => [x, 40, z], all = [cell(0, 0), cell(30, 10), cell(60, 5), cell(90, -20), cell(400, 400)]; // the last one is another village
  const mkEnv = (cap = Infinity) => {
    const log = [], alive = new Set(), env = {
      claim: (r) => log.push(["claim", r]), hasCapacity: (r) => PL.chunksIn(r) <= cap, create: (id, r) => { alive.add(id); log.push(["create", id, PL.chunksIn(r)]); }, remove: (id) => { alive.delete(id); log.push(["remove", id]); },
      markersIn: (r) => all.filter(([x, , z]) => PL.inRect(r, x, z)),
    };
    return { env, log, alive };
  };
  const a = mkEnv(), found = PL.discoverSync(a.env, all[0], "t");
  assert.equal(found.known.length, 4, "grows 0 -> 30 -> 60 -> 90 and stops: the far village is not pulled in");
  assert.ok(found.stable && found.rounds >= 2 && found.rounds <= PL.AREA.maxRounds && found.sizes[0] > PL.chunksIn(PL.chunkAlign(PL.growRect(PL.hullOf([cell(0, 0)]), PL.AREA.margins[0]))), "round 1 is the seeded (bigger) area");
  assert.deepEqual([...a.alive], found.ids, "the previous area is removed once the next one is up; one area alive at the end");
  assert.ok(found.rect.x0 % 16 === 0 && (found.rect.x1 + 1) % 16 === 0, "areas are chunk aligned");
  assert.ok(found.known.every(([x, , z]) => PL.inRect(found.rect, x, z)));
  for (const start of all.slice(0, 4)) assert.equal(PL.discoverSync(mkEnv().env, start, "t").known.length, 4, "any marker may be the first one");
  assert.throws(() => PL.discoverSync(mkEnv(3).env, all[0], "t"), /over chunk limit/);
  const first = PL.chunksIn(PL.chunkAlign(PL.growRect(PL.hullOf([cell(0, 0)]), PL.AREA.margins[0])));
  const sm = PL.discoverSync(mkEnv(first + 2).env, all[0], "t");
  assert.ok(sm.known.length >= 1 && sm.rect, "a tight quota still returns what it found (the old area is dropped to make room)");
  const bad = mkEnv(); bad.env.create = () => Promise.reject(new Error("timed out"));
  await assert.rejects(PL.discoverVillage(bad.env, all[0], "t"), /timed out/);
  const good = mkEnv(); assert.equal((await PL.discoverVillage(good.env, all[0], "t")).known.length, 4);
});

test("loop planner: a planned village is remembered (done-list), markers inside it are stragglers, the list is bounded and survives garbage", () => {
  let list = PL.parseDone(undefined);
  assert.deepEqual(list, []);
  list = PL.addDone(list, { x0: 0, x1: 100, z0: 0, z1: 100 });
  assert.ok(PL.isDone(list, 50, 50) && PL.isDone(list, 0, 100) && !PL.isDone(list, 101, 50) && !PL.isDone(list, 50, -1));
  assert.deepEqual(PL.parseDone(JSON.stringify(list)), list);
  assert.deepEqual(PL.parseDone("not json"), []); assert.deepEqual(PL.parseDone('{"a":1}'), []);
  for (let i = 0; i < PL.AREA.maxDone + 5; i++) list = PL.addDone(list, { x0: 1000 * i, x1: 1000 * i + 10, z0: 0, z1: 10 });
  assert.equal(list.length, PL.AREA.maxDone);
  const js = readFileSync(new URL("../lothlorien_bp/scripts/loop_marker.js", import.meta.url), "utf8");
  assert.ok(js.includes("isDone(") && js.includes("addDone(") && js.includes("setDynamicProperty(DONE") && js.includes("removeMarkers(dimension, found.rect)"), "runtime: done-list checked, written, markers removed after planning");
  // Runtime area cleanup (including timeout/late completion) is exercised by script_glue.mjs.
});

test("loop planner: the owner's real village V2 (dump of world TT) gets the plaza (gap6) and the side-to-side bridge (gap7) among the picks, from the live marker positions", () => {
  const f = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/village_v2.json.gz", import.meta.url)))), [ox, oy, oz] = f.origin, [sx, sy, sz] = f.size, blocks = new Int16Array(sx * sy * sz);
  f.cols.forEach((runs, ci) => { const i = Math.floor(ci / sz), k = ci % sz; let j = 0; for (let r = 0; r < runs.length; r += 2) for (let n = 0; n < runs[r + 1]; n++) blocks[(i * sy + j++) * sz + k] = runs[r]; });
  const at = (x, y, z) => { const i = x - ox, j = y - oy, k = z - oz; return i < 0 || j < 0 || k < 0 || i >= sx || j >= sy || k >= sz ? undefined : f.palette[blocks[(i * sy + j) * sz + k]]; };
  const markers = f.markers.map((p) => [Math.floor(p[0]), Math.floor(p[1]) - 1, Math.floor(p[2])]);
  assert.equal(markers.length, 44);
  const r = PL.planVillage(at, markers);
  assert.equal(r.picks.length, 2, "owner 2026-10-09: no big L joins (PLAN.lMaxLen 16); the former third pick of V2 was an L of 24-26");
  const plaza = r.picks.find((p) => p.kind === "plaza"), ss = r.picks.find((p) => p.kind === "sideside");
  assert.ok(plaza && [plaza.A, plaza.B].some((e) => e.x === 81 && e.z === 343) && [plaza.A, plaza.B].some((e) => e.x === 85 && e.z === 347), "gap6: plaza 81,343 / 85,347");
  assert.ok(ss && [ss.A, ss.B].some((e) => e.x === 49) && [ss.A, ss.B].some((e) => e.x === 61), "gap7: side-side from x 49 to x 61");
  for (const p of r.picks) assert.ok(p.dnet >= 30 && p.dnet >= 2.5 * p.len, `${p.kind}: a real shortcut`);
  assert.equal(PL.planVillage(at, markers).picks.map((p) => p.kind + p.A.x + p.A.z).join(), r.picks.map((p) => p.kind + p.A.x + p.A.z).join(), "deterministic");
  const area = PL.chunkAlign(PL.growRect(PL.hullOf(markers), 32));
  assert.ok(PL.chunksIn(area) < 200, `V2 hull + 32 is ${PL.chunksIn(area)} chunks`);
});

test("village area counts as Lothlorien: planned rects from the world property, re-parsed only when it changes; territory reader and planner share the key", () => {
  let raw = JSON.stringify([{ x0: 0, x1: 47, z0: 16, z1: 63 }]), reads = 0;
  const inside = PL.villageAreaTest(() => { reads++; return raw; });
  assert.equal(inside(10.7, 20.2), true); assert.equal(inside(-0.5, 20), false); assert.equal(inside(47.9, 63.9), true); assert.equal(inside(48, 20), false);
  raw = undefined; assert.equal(inside(10, 20), false, "no villages planned yet");
  raw = "not json"; assert.equal(inside(10, 20), false);
  assert.ok(reads >= 6);
  const main = readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8"), loop = readFileSync(new URL("../lothlorien_bp/scripts/loop_marker.js", import.meta.url), "utf8");
  assert.match(main, /const inBiome = \(dimension, location\) => biomeAt\(dimension, location\) === BIOME_ID \|\| \(dimension\.id === "minecraft:overworld" && inVillageArea/);
  assert.match(loop, /DONE = VILLAGE_PLANS/);
});

finish();
