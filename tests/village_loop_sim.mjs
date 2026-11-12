// Loop planner over 30 simulated villages (split out of village_simulation.mjs so the two run in parallel): the planner sweep,
// the layer path against the plain scan, and discovery from every marker. The fixture is the same 30 seeds as runSeeds(30) but
// without check(): these tests read only `seed` and `res`, and check() does not change `res`.
import { test, finish } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { loadVillageData, simulate, planLoops, discoveryCoverage, buildWorld, markerCells, walkability } from "../tools/village_sim.mjs";
import * as PL from "../lothlorien_bp/scripts/village_planner.js";

const villageData = loadVillageData();
let villageRows = null;
const villages = () => (villageRows ??= Array.from({ length: 30 }, (_, i) => ({ seed: i + 1, res: simulate(villageData, i + 1) })));

test("loop planner: 30 simulated villages - one start marker, discovery finds every marker, every join passes the shared walk checker and light >= 8, all join kinds occur, deck stays walkable, budget respected, marker counts modest", () => {
  let loops = 0, complete = 0, markers = 0, n = 0;
  const kinds = {};
  for (const r of villages()) {
    const states = new Map(), world = buildWorld(r.res, states), count = Math.max(1, r.res.placed.flatMap(markerCells).length);
    const shift = r.seed % 2 === 0 ? [(r.seed * 7) % 16, (r.seed * 11) % 16] : [(r.seed * 5) % 16, (r.seed * 3) % 16]; // two chunk-shift patterns, alternated by seed parity
    const lp = planLoops(r.res, world, states, { verify: true, start: (r.seed * 13) % count, shift });
    loops += lp.loops; complete += lp.complete ? 1 : 0;
    assert.equal(lp.error, null);
    assert.ok(lp.loops <= PL.PLAN.budget, `seed ${r.seed}: ${lp.loops} links, budget ${PL.PLAN.budget}`);
    assert.deepEqual(lp.bad, [], `seed ${r.seed}: joins with walk / light violations`);
    for (const [k, v] of Object.entries(lp.byKind)) kinds[k] = (kinds[k] ?? 0) + v;
    markers += lp.markers; n++;
    assert.equal(walkability(r.res, world, states).unreachable.length, 0, `seed ${r.seed}: walkable deck after the links`);
  }
  assert.ok(loops >= 1, "at least one link in 30 seeds");
  assert.equal(complete, villages().length, "discovery from the start marker found every marker of every village");
  for (const k of ["exit", "side", "sideside"]) assert.ok(kinds[k] >= 1, `join kind ${k} occurs: ${JSON.stringify(kinds)}`);
  assert.ok(markers / n <= 60, `markers per village ${(markers / n).toFixed(1)}`);
  console.log(`loop planner (30 villages): ${JSON.stringify(kinds)}, markers/village ${(markers / n).toFixed(1)}`);
});

test("loop planner: the layer path plans the same village as the plain scan", () => {
  for (const r of villages().slice(0, 3)) {
    const run = (noLayer) => { const states = new Map(), world = buildWorld(r.res, states), lp = planLoops(r.res, world, states, { noLayer }); return JSON.stringify({ picks: lp.picks.map((p) => [p.kind, p.planRef.cells.length, p.planRef.rails.length]), repairs: lp.repairs, merges: lp.mergeCells, log: lp.log }); };
    assert.equal(run(false), run(true), `seed ${r.seed}`);
  }
});

test("loop planner: simulated villages - every marker as the first one finds the whole village; a too small quota gives up cleanly without building", () => {
  let starts = 0, complete = 0;
  for (const r of villages().slice(0, 12)) { const c = discoveryCoverage(r.res, { shift: [(r.seed * 7) % 16, (r.seed * 3) % 16] }); starts += c.starts; complete += c.complete; assert.equal(c.errors, 0); }
  assert.ok(starts > 200 && complete === starts, `${complete} of ${starts} starts found the whole village`);
  const r = villages()[0], states = new Map(), world = buildWorld(r.res, states), lp = planLoops(r.res, world, states, { maxChunks: 6 });
  assert.equal(lp.error, "over chunk limit"); assert.equal(lp.loops, 0);
});

finish();
