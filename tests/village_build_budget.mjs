// Per-step budget of the village build job (village_build.js planAndBuild + clearShield) on 20 simulated villages and the deep-terrain fixtures
// (a valley, a lake under the trees). Deterministic: it counts the native calls of every inner step (the code between two labelled yields) with a counting
// dimension (tools/village_budget_world.mjs) and compares the written blocks with the pre-change planner (fixtures/village_build_baseline.json).
// Pure-JS time per step is NOT asserted here (V8 time is not deterministic); tools/village_steps.mjs --check times the steps in QuickJS.
//   node tests/village_build_budget.mjs                  assert LIMIT (the target, minus the TEMPORARY limits below that later commits tighten)
//   BUDGET_TARGET=1 node tests/village_build_budget.mjs  assert the real TARGET (fails until the village build fixes land)
//   node tests/village_build_budget.mjs --write-baseline rewrite the fixture from the current planner
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test, finish } from "./test_helpers.mjs";
import { loadVillageData } from "../tools/village_sim.mjs";
import { makeWorld, runVillageJob, SEEDS } from "../tools/village_budget_world.mjs";

// Per inner step (plan of village_hitch, 2026-11-21): <= 128 native block reads (getBlock), <= 16 block writes, <= 1 structure placement / elf spawn / entity
// query, <= 8 entity removes, getBlocks volumes <= 64 x 64 x 1, fillBlocks volumes <= 16 x 16 x 64.
const TARGET = { getBlock: 128, set: 16, structure: 1, spawn: 1, entityQuery: 1, remove: 8, layer: 64 * 64, fill: 16 * 16 * 64 };
// TEMPORARY limits: the worst values of the code before the fixes (each fix commit lowers its entry; the last one deletes this object).
const TEMPORARY = { getBlock: 28000, set: 32 };
const LIMIT = process.env.BUDGET_TARGET ? TARGET : { ...TARGET, ...TEMPORARY };
const CASES = [...SEEDS.map((s) => ({ seed: s, fixture: "flat" })), { seed: 3, fixture: "valley" }, { seed: 12, fixture: "valley" }, { seed: 7, fixture: "lake" }, { seed: 15, fixture: "lake" }];
const BASELINE = new URL("./fixtures/village_build_baseline.json", import.meta.url);
const name = (c) => `${c.fixture}-${c.seed}`;
const data = loadVillageData();

const runs = new Map();
const run = (c) => { if (!runs.has(name(c))) { const w = makeWorld(data, c.seed, c.fixture); runs.set(name(c), { w, ...runVillageJob(w) }); } return runs.get(name(c)); };

if (process.argv.includes("--write-baseline")) {
  const out = {};
  for (const c of CASES) { const r = run(c); out[name(c)] = { ...r.w.hash(), steps: r.steps.length }; }
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

test("village build: the written blocks stay identical to the pre-change planner on every simulated village", () => {
  const base = JSON.parse(readFileSync(BASELINE, "utf8"));
  for (const c of CASES) assert.deepEqual({ ...run(c).w.hash() }, { hash: base[name(c)].hash, cells: base[name(c)].cells }, `${name(c)}: written blocks differ from the baseline`);
});

finish();
