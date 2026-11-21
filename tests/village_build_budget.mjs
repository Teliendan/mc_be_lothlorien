// Per-step budget of the village build job (village_build.js planAndBuild + clearShield) on 20 simulated villages and the deep-terrain fixtures
// (a valley, a lake under the trees). Deterministic: it counts the native calls of every inner step (the code between two labelled yields) with a counting
// dimension (tools/village_budget_world.mjs) and compares the written blocks with the pre-change planner (fixtures/village_build_baseline.json).
// Pure-JS time per step is NOT asserted here (V8 time is not deterministic); tools/village_steps.mjs --check times the steps in QuickJS.
//   node tests/village_build_budget.mjs                  assert the budget (suite village / village-budget, part of `all`)
//   node tests/village_build_budget.mjs --write-baseline rewrite the baseline fixture (only from the pre-change planner: it is the regression oracle)
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test, finish } from "./test_helpers.mjs";
import { loadVillageData } from "../tools/village_sim.mjs";
import { makeWorld, runVillageJob, SEEDS } from "../tools/village_budget_world.mjs";
import { finalBlocks } from "../lothlorien_bp/scripts/village_loop.js";

// Per inner step (plan of village_hitch, 2026-11-21): <= 128 native block reads (getBlock), <= 16 block writes, <= 1 structure placement / elf spawn / entity
// query, <= 8 entity removes, getBlocks volumes <= 64 x 64 x 1, fillBlocks volumes <= 16 x 16 x 64.
const TARGET = { getBlock: 128, set: 16, structure: 1, spawn: 1, entityQuery: 1, remove: 8, layer: 64 * 64, fill: 16 * 16 * 64 };
const LIMIT = TARGET;
const CASES = [...SEEDS.map((s) => ({ seed: s, fixture: "flat" })), { seed: 3, fixture: "valley" }, { seed: 12, fixture: "valley" }, { seed: 7, fixture: "lake" }, { seed: 15, fixture: "lake" }];
const BASELINE = new URL("./fixtures/village_build_baseline.json", import.meta.url);
const name = (c) => `${c.fixture}-${c.seed}`;
const data = loadVillageData();

// The hidden light blocks of the runtime light rule (owner decision 2026-11-21: the light cells and lanterns of bridges / plazas / merges may differ from the
// old greedy; everything else must stay identical). lightCounts: how many lights the plans of each kind carry.
// planHash: what the plans write (merges, picks, repairs; later wins, as in planAndBuild) WITHOUT their light cells, FNV-1a over the sorted cells.
const planHash = (res) => {
  const writes = new Map();
  for (const p of [...res.merges, ...res.picks, ...res.repairs]) { const plan = p.plan ?? p; for (const [k, b] of finalBlocks({ ...plan, lights: [] })) writes.set(k, b); }
  let h = 2166136261 >>> 0;
  for (const [k, b] of [...writes].sort((a, c) => (a[0] < c[0] ? -1 : a[0] > c[0] ? 1 : 0))) for (const ch of `${k}|${b.id}|${JSON.stringify(b.states ?? {})};`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { hash: h.toString(16), cells: writes.size };
};
const lightCounts = (res) => { const out = { bridge: 0, plaza: 0, merge: 0 }; for (const p of res.picks) out[p.kind === "plaza" ? "plaza" : "bridge"] += p.plan.lights.length; for (const m of res.merges) out.merge += m.plan.lights.length; return out; };
const runs = new Map();
const run = (c) => { if (!runs.has(name(c))) { const w = makeWorld(data, c.seed, c.fixture); runs.set(name(c), { w, ...runVillageJob(w) }); } return runs.get(name(c)); };

if (process.argv.includes("--write-baseline")) {
  const out = {};
  for (const c of CASES) { const r = run(c); out[name(c)] = { steps: r.steps.length, plans: planHash(r.result), lights: lightCounts(r.result) }; }
  writeFileSync(BASELINE, JSON.stringify(out, null, 1) + "\n", { encoding: "utf8" });
  console.log(`baseline written: ${Object.keys(out).length} villages`);
  process.exit(0);
}

test(`village build budget: no inner step over ${JSON.stringify(LIMIT)} on ${CASES.length} villages (20 flat, 2 valleys, 2 lakes)`, () => {
  const worst = {};
  for (const c of CASES) {
    for (const s of run(c).steps) {
      for (const [k, lim] of [["getBlock", LIMIT.getBlock], ["set", LIMIT.set], ["structure", LIMIT.structure], ["spawn", LIMIT.spawn], ["entityQuery", LIMIT.entityQuery], ["remove", LIMIT.remove]]) {
        const v = s.d[k]; if (v > (worst[k]?.v ?? 0)) worst[k] = { v, at: `${name(c)} ${s.label}` };
        assert.ok(v <= lim, `${name(c)}: step ${s.label} made ${v} ${k} calls (limit ${lim})`);
      }
      assert.ok(s.layer <= LIMIT.layer, `${name(c)}: step ${s.label} queried a ${s.layer}-cell volume (limit ${LIMIT.layer})`);
      assert.ok(s.fill <= LIMIT.fill, `${name(c)}: step ${s.label} filled a ${s.fill}-cell volume (limit ${LIMIT.fill})`);
    }
  }
  console.log(`village build budget (worst per inner step): ${Object.entries(worst).map(([k, e]) => `${k} ${e.v} (${e.at})`).join("; ")}`);
});

test("village build: everything but the light cells stays identical to the pre-change planner on every simulated village; light counts vs the old greedy", () => {
  const base = JSON.parse(readFileSync(BASELINE, "utf8")), now = { bridge: 0, plaza: 0, merge: 0 }, was = { bridge: 0, plaza: 0, merge: 0 };
  for (const c of CASES) {
    const r = run(c), b = base[name(c)];
    assert.deepEqual(planHash(r.result), b.plans, `${name(c)}: what the plans write (other than the hidden lights) differs from the baseline`);
    for (const k of Object.keys(now)) { now[k] += lightCounts(r.result)[k]; was[k] += b.lights[k]; }
  }
  console.log(`hidden lights over ${CASES.length} villages, now vs the old greedy: bridges ${now.bridge} vs ${was.bridge}, plazas ${now.plaza} vs ${was.plaza}, merges ${now.merge} vs ${was.merge}`);
});

test("village populate job: every village gets its elves (Loremaster + the professions), every post is removed, furnishing is written and structures placed", () => {
  const sum = { elves: 0, own: 0, reserve: 0, posts: 0, writes: 0, structures: 0, spawn: 0, removed: 0 };
  for (const c of CASES) {
    const r = run(c), p = r.populated;
    assert.ok(p.spawned >= 5 && p.failed === 0, `${name(c)}: ${p.spawned} elves, ${p.failed} failed`);
    assert.equal(r.counters.remove, r.w.posts.length, `${name(c)}: every post removed`);
    sum.elves += p.spawned; sum.own += p.own; sum.reserve += p.reserve; sum.posts += r.w.posts.length; sum.structures += r.counters.structure; sum.spawn += r.counters.spawn;
  }
  assert.ok(sum.structures > 0, "banners / pots / cushions are placed");
  console.log(`populate over ${CASES.length} villages: ${JSON.stringify(sum)}`);
});

finish();
