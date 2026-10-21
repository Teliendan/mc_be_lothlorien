// village simulation regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planterWalkName } from "../lothlorien_bp/scripts/planter_panels.js";
import { B } from "../tools/flet_mallorn.mjs";
import { existsSync, readdirSync } from "node:fs";
import { loadVillageData, parseMcstructure, runSeeds, PLANKS, FENCE, populateElves } from "../tools/village_sim.mjs";
import * as EL from "../lothlorien_bp/scripts/elf_rules.js";
import { RING, STAIR_FULL, STAIR_TOP, STAIR_CUT, FLOOR_H as V_FLOOR, LEVEL_H as V_LEVEL, ROOTS as V_ROOTS } from "../tools/village_mallorn.mjs";
import { rotateCell } from "../tools/village_combo.mjs";
import * as LOOP from "../lothlorien_bp/scripts/village_loop.js";
import * as PL from "../lothlorien_bp/scripts/village_planner.js";
import * as RP from "../lothlorien_bp/scripts/village_repair.js";
import { planLoops, discoveryCoverage, buildWorld, wkey, markerCells, walkability } from "../tools/village_sim.mjs";

const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
const flat = () => 64;
const VILLAGE = "../lothlorien_bp/structures/lothlorien/village";
const villageData = loadVillageData();
const villagePieces = () => readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
  parseMcstructure(readFileSync(new URL(`${VILLAGE}/${f}`, import.meta.url)), f.replace(".mcstructure", "")));
let villageRows = null;
const villages = () => (villageRows ??= runSeeds(villageData, 30, 1));
const SLAB_ID = "lothlorien:mallorn_slab", LEAVES_ID = "lothlorien:mallorn_leaves";
const halfOf = (p) => { const up = p.jigsaws.find((j) => j.dirId === 1); return up ? [up.x, up.z] : [(p.size[0] - 1) / 2, (p.size[2] - 1) / 2]; };
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

test("village: 30 simulated villages connect, never overlap, terminate, are fully walkable in 3D, have crowns and ~8-10 trees", () => {
  const t0 = Date.now();
  const rows = villages();
  for (const r of rows) {
    assert.deepEqual([...new Set(r.ck.fail)].slice(0, 3), [], `seed ${r.seed}`);
    assert.equal(r.ck.unreachable, 0, `seed ${r.seed}: unreachable walk cells`);
    assert.equal(r.ck.overlaps, 0);
    assert.ok(r.ck.walkCells > 200 && r.ck.reached === r.ck.walkCells, `seed ${r.seed}: walk cells ${r.ck.reached}/${r.ck.walkCells}`);
    assert.ok(r.ck.kinds.crown >= r.ck.kinds.trees - 3, `seed ${r.seed}: crowns ${r.ck.kinds.crown} for ${r.ck.kinds.trees} trees`);
  }
  assert.ok(new Set(rows.map((r) => r.hash)).size >= 25, "layouts barely vary");
  const avg = rows.reduce((s, r) => s + r.ck.kinds.trees, 0) / rows.length;
  assert.ok(avg >= 7 && avg <= 12, `average ${avg} trees`);
  assert.ok(rows.filter((r) => r.ck.levels >= 2).length >= rows.length * 0.6, "two levels in most villages");
  for (const r of rows) { // P6: no bridge to nowhere, no hanging balcony
    assert.equal(r.ck.kinds.bridgesNoDest, 0, `seed ${r.seed}: bridges without a destination tree`);
    assert.equal(r.ck.kinds.unsupported, 0, `seed ${r.seed}: unsupported balcony`);
    assert.equal(r.ck.kinds.bridgeAlone, 0, `seed ${r.seed}: a bridge piece placed alone`);
  }
  assert.ok(rows.reduce((s, r) => s + r.ck.open, 0) / rows.length <= 1.5, "too many open connectors");
  assert.ok(Date.now() - t0 < 20000, `simulation took ${Date.now() - t0} ms`);
});

test("rope fit in the simulator: the terrain top follows the Bedrock rule (first air at tree y 0 on flat ground, nothing to fix); lower ground hangs, higher ground buries - every rope ends on the ground", () => {
  const row = villages()[0], sim = (terrain) => {
    const world = new Map(row.ck.world), states = new Map(row.ck.states);
    return planLoops(row.res, world, states, { terrain, start: 0 });
  };
  const flat = sim(undefined);
  assert.deepEqual(flat.repairs.filter((p) => p.kind === "rope"), [], "start height -(ROOTS-1): the rope stands on the first air cell, nothing to repair");
  assert.ok(flat.ropeFeet.length >= 1 && flat.ropeFeet.every((f) => f.onGround && !f.buried));
  const low = sim(() => 14), high = sim(() => 20);
  assert.ok(low.repairs.find((p) => p.kind === "rope").hung === 3 && low.ropeFeet.every((f) => f.onGround && !f.buried), JSON.stringify(low.repairs));
  assert.ok(high.repairs.find((p) => p.kind === "rope").buried === 3 && high.ropeFeet.every((f) => f.onGround && !f.buried), JSON.stringify(high.repairs));
});

test("root flare in the simulator: every pillar of the villages gets roots without wood mass; skips are rare", () => {
  const row = villages()[0], world = new Map(row.ck.world), states = new Map(row.ck.states), r = planLoops(row.res, world, states, { terrain: undefined, start: 0 });
  const flares = r.repairs.filter((p) => p.kind === "flare");
  assert.ok(flares.length >= 1 && flares.every((p) => p.roots >= 1 && p.roots <= 4), JSON.stringify(flares));
  assert.ok(r.flareLog.length <= flares.length / 4 + 1, r.flareLog.join("|"));
});

test("village: simulated villages have no wrong rope side, no decaying leaf, linked rails across every joint", () => {
  for (const r of villages()) {
    assert.equal(r.ck.info.ropeWrong, 0, `seed ${r.seed}: ropes facing away from the trunk`);
    assert.ok(r.ck.info.ropes > 0 && r.ck.info.hangingRopes === r.ck.info.ropes, `seed ${r.seed}: village ropes are the rotating variant`);
    assert.equal(r.ck.info.decay, 0, `seed ${r.seed}: leaves that will decay`);
    assert.ok(!r.ck.fail.some((f) => f.includes("rail link")), `seed ${r.seed}: ${r.ck.fail.find((f) => f.includes("rail link"))}`);
  }
});

test("village towers: the upper floor covers the stair opening as far as headroom allows (full deck / top slab), spiral stays walkable", () => {
  assert.deepEqual(STAIR_FULL.concat(STAIR_TOP, STAIR_CUT).sort((a, b) => a - b), [9, 10, 11, 12, 13]);
  assert.ok(STAIR_CUT.length <= 4, `remaining hole ${STAIR_CUT.length} cells`);
  const towers = villagePieces().filter((p) => p.name.startsWith("combo_tower_"));
  assert.ok(towers.length >= 6, `${towers.length} tower combos`);
  for (const p of towers) {
    const [hx, hz] = halfOf(p), yU = V_ROOTS + V_FLOOR + V_LEVEL;
    const k = (4 - ["north", "east", "south", "west"].indexOf(p.name.match(/^combo_tower_[a-z]_(north|east|south|west)_/)[1])) % 4; // the combo is the tower turned k quarter turns
    for (let i = 0; i < 14; i++) {
      const [rx, rz] = rotateCell(...RING[i], k), s = 3 + i, at = p.at(rx + hx, yU, rz + hz), blk = p.blocks.find((q) => q.x === rx + hx && q.y === yU && q.z === rz + hz);
      // the ceiling over tread i must clear the NEXT tread (2.0 blocks = 4 half-blocks): a walker steps up with his head still over column i (owner 2026-10-08)
      if (2 * V_LEVEL - (s + 1) >= 4) assert.equal(at, PLANKS, `${p.name}: ring ${i} under full deck`);
      else if (2 * V_LEVEL + 1 - (s + 1) >= 4) assert.ok(at === SLAB_ID && blk.states["minecraft:vertical_half"] === "top", `${p.name}: ring ${i} top slab, got ${at}`);
      else assert.ok(at === null || at === "minecraft:air" || at === "minecraft:light_block_0", `${p.name}: ring ${i} stays open, got ${at}`); // light_block_0: headroom shield
    }
  }
  for (const r of villages()) assert.equal(r.ck.unreachable, 0, `seed ${r.seed}: unreachable walk cells`);
});

test("village: no leaf of any placed piece sits in a cell another piece owns (rails, surfaces, two cells above): simulated villages report no 'leaf in protected cell'", () => {
  for (const r of villages().slice(0, 12)) assert.ok(!r.ck.fail.some((f) => f.includes("leaf in protected")), `seed ${r.seed}: ${r.ck.fail.find((f) => f.includes("leaf in protected"))}`);
});

test("loop planner: every tree / platform piece carries a loop marker (the first one that loads starts the village planner), rim markers on rim centres, crowns none; entity and script are wired", () => {
  const MARKED = { railing_end: 1, balcony_braced: 1, lookout_01: 3 };
  const re = villagePieces().filter((p) => p.name === "railing_end");
  assert.equal(re.length, 1);
  assert.deepEqual(re[0].entities.filter((e) => e.id === LOOP.MARKER_ID).map((e) => e.pos), [[2.5, 1.5, 0.5]]);
  for (const p of villagePieces()) { // round 2: the platform pieces (central, combos = bridge + node) carry side markers on their rim runs; crowns never
    const n = p.entities.filter((e) => e.id === LOOP.MARKER_ID).length;
    if (MARKED[p.name]) assert.equal(n, MARKED[p.name], `${p.name}: loop markers`);
    else if (/^(central|combo_)/.test(p.name)) assert.ok(n >= 1 && n <= 12, `${p.name}: ${n} markers (every platform piece can trigger the planner)`);
    else assert.equal(n, 0, `${p.name}: loop markers`);
  }
  const seen = {}, exits = {}, sides = [];
  for (const r of villages()) { // in every rotation each marker sits on the centre fence of a placed piece, and the exit signature faces away from the platform
    const states = new Map(), world = buildWorld(r.res, states), at = planterWalkName((x,y,z)=>({name:world.get(wkey(x,y,z))??"minecraft:air",states:states.get(wkey(x,y,z))}));
    for (const p of r.res.placed.filter((q) => MARKED[q.name] || /^(central|combo_)/.test(q.name))) {
      for (const [x, y, z] of markerCells(p)) {
        assert.equal(at(x, y + 1, z), FENCE, `seed ${r.seed}: ${p.name} marker on the centre fence`);
        assert.equal(at(x, y, z), PLANKS);
        // balcony far rim and the lookout's three free sides are exits in the sense of exitAt (a neighbouring piece may merge the rim into a longer run)
        seen[p.name] = (seen[p.name] ?? 0) + 1;
        if (LOOP.exitAt(at, x, y, z) || (p.name === "lookout_01" && LEG.sideAt(at, x, y, z))) exits[p.name] = (exits[p.name] ?? 0) + 1; // (the 11 x 11 lookout's east / west ends are 7-long platform sides: sideAt recognises them)
        else if (!MARKED[p.name]) sides.push(!!LEG.sideAt(at, x, y, z));
      }
    }
  }
  assert.ok(seen.railing_end > 100 && seen.balcony_braced > 50 && seen.lookout_01 > 20, `markers seen ${JSON.stringify(seen)}`);
  for (const k of Object.keys(seen).filter((q) => MARKED[q])) assert.ok(exits[k] >= 0.95 * seen[k], `${k}: ${exits[k]} of ${seen[k]} markers sit on a recognised exit`);
  assert.ok(sides.length > 200 && sides.filter(Boolean).length >= 0.9 * sides.length, `side markers recognised by sideAt: ${sides.filter(Boolean).length} of ${sides.length}`);
  const entity = readJson("../lothlorien_bp/entities/loop_marker.json")["minecraft:entity"];
  assert.equal(entity.description.identifier, LOOP.MARKER_ID);
  assert.ok(entity.components["minecraft:persistent"] && entity.components["minecraft:physics"].has_collision === false && entity.description.is_spawnable === false);
  assert.ok(existsSync(new URL("../lothlorien_rp/entity/loop_marker.entity.json", import.meta.url)) && existsSync(new URL("../lothlorien_rp/models/entity/loop_marker.geo.json", import.meta.url)));
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('from "./loop_marker.js"'));
  const js = readFileSync(new URL("../lothlorien_bp/scripts/loop_marker.js", import.meta.url), "utf8");
  assert.ok(js.includes("entityLoad") && js.includes("entitySpawn") && js.includes("e.remove()") && js.includes("system.runJob") && !js.includes("runInterval") && !js.includes("isChunkLoaded"));
  assert.ok(js.includes("createTickingArea") && js.includes("removeTickingArea") && js.includes("finally"), "ticking area is created and always removed");
});

test("loop planner: in simulated villages the planner (one start marker, discovery by ticking areas) finds every marker, builds a walkable deck, passes walk + light, budget respected", () => {
  let loops = 0, complete = 0;
  for (const r of villages()) {
    const states = new Map(), world = buildWorld(r.res, states), n = Math.max(1, r.res.placed.flatMap(markerCells).length);
    const lp = planLoops(r.res, world, states, { verify: true, start: (r.seed * 13) % n, shift: [(r.seed * 7) % 16, (r.seed * 11) % 16] });
    loops += lp.loops; complete += lp.complete ? 1 : 0;
    assert.equal(lp.error, null);
    assert.ok(lp.loops <= PL.PLAN.budget, `seed ${r.seed}: ${lp.loops} links, budget ${PL.PLAN.budget}`);
    assert.deepEqual(lp.bad, [], `seed ${r.seed}: links with walk / light violations`);
    assert.equal(walkability(r.res, world, states).unreachable.length, 0, `seed ${r.seed}: walkable deck after the links`);
  }
  assert.ok(loops >= 1, "at least one link in 30 seeds");
  assert.equal(complete, villages().length, "discovery from the start marker found every marker of every village");
});

test("loop planner: 30 simulated villages - every join passes the shared walk checker and light >= 8, all join kinds occur over the seeds, deck stays walkable; marker counts stay modest", () => {
  const kinds = {}; let markers = 0, n = 0;
  for (const r of villages()) {
    const states = new Map(), world = buildWorld(r.res, states), lp = planLoops(r.res, world, states, { verify: true, shift: [(r.seed * 5) % 16, (r.seed * 3) % 16] });
    assert.deepEqual(lp.bad, [], `seed ${r.seed}: joins with walk / light violations`);
    for (const [k, v] of Object.entries(lp.byKind)) kinds[k] = (kinds[k] ?? 0) + v;
    markers += lp.markers; n++;
    assert.equal(walkability(r.res, world, states).unreachable.length, 0, `seed ${r.seed}: walkable deck`);
  }
  for (const k of ["exit", "side", "sideside"]) assert.ok(kinds[k] >= 1, `join kind ${k} occurs: ${JSON.stringify(kinds)}`);
  assert.ok(markers / n <= 60, `markers per village ${(markers / n).toFixed(1)}`);
  console.log(`loop planner (30 villages): ${JSON.stringify(kinds)}, markers/village ${(markers / n).toFixed(1)}`);
});

test("loop planner: simulated villages - every marker as the first one finds the whole village; a too small quota gives up cleanly without building", () => {
  let starts = 0, complete = 0;
  for (const r of villages().slice(0, 12)) { const c = discoveryCoverage(r.res, { shift: [(r.seed * 7) % 16, (r.seed * 3) % 16] }); starts += c.starts; complete += c.complete; assert.equal(c.errors, 0); }
  assert.ok(starts > 200 && complete === starts, `${complete} of ${starts} starts found the whole village`);
  const r = villages()[0], states = new Map(), world = buildWorld(r.res, states), lp = planLoops(r.res, world, states, { maxChunks: 6 });
  assert.equal(lp.error, "over chunk limit"); assert.equal(lp.loops, 0);
});

test("elf population over villages: all five professions (the healer twice with 6+ outer trees), four on their own trees when there are four, reserves only for the missing ones", () => {
  let withReserve = 0;
  for (const r of villages()) {
    const at = (x, y, z) => r.ck.world.get(wkey(x, y, z)) ?? "minecraft:air", el = populateElves(r.res, at);
    assert.deepEqual(el.fail, [], `seed ${r.seed}`);
    assert.equal(el.elves, EL.PROFESSIONS.length + (el.outer >= EL.HEALER2_MIN_TREES ? 1 : 0), `seed ${r.seed}: all five, the healer twice with ${EL.HEALER2_MIN_TREES}+ outer trees`);
    assert.equal(el.reservePosts, EL.RESERVE_POSTS);
    assert.equal(el.ownTree, Math.min(4, el.outer) + (el.outer >= EL.HEALER2_MIN_TREES ? 1 : 0), `seed ${r.seed}: ${el.outer} outer trees`);
    assert.equal(el.onReserve, Math.max(0, 4 - el.outer), `seed ${r.seed}: reserves for the missing trees only`);
    if (el.onReserve) withReserve++;
  }
  assert.ok(withReserve <= 6, `${withReserve} of 30 villages needed reserve posts (about 6 % expected)`);
});

test("forest floor in the simulator: every plant stands on ground, the landing at each rope foot is bare, the budget holds, a village gets most kinds", () => {
  for (const row of villages().slice(0, 4)) {
    const world = new Map(row.ck.world), states = new Map(row.ck.states), r = planLoops(row.res, world, states, { start: 0 });
    assert.equal(r.floor.floating, 0, JSON.stringify(r.floor));
    assert.equal(r.floor.onRope, 0);
    assert.ok(r.floor.n > 100 && r.floor.n <= RP.FLOOR.maxBlocks, `${r.floor.n} blocks`);
    assert.ok(Object.keys(r.floor.byId).length >= 6 && !r.floor.byId["minecraft:leaf_litter"], JSON.stringify(r.floor.byId));
  }
});

finish();
