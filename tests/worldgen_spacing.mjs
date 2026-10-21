import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assemblyEnvelope, spacingForRadius, spacingReport, bounds, overlaps } from "../tools/worldgen_spacing.mjs";
import { loadVillageData, simulate } from "../tools/village_sim.mjs";

const EMPTY = "minecraft:empty";
const connector = (x, name, pool, target, direction) => ({
  x, y: 0, z: 0, name, pool, target, vec: direction === "east" ? [1, 0, 0] : direction === "west" ? [-1, 0, 0] : [0, -1, 0],
  dir: direction === "east" ? [1, 0] : direction === "west" ? [-1, 0] : null,
});
const piece = (name, length, jigsaws) => ({ name, size: [length, 1, 1], blocks: [], jigsaws });
const fixtures = new Map([
  ["root", piece("root", 3, [connector(1, "anchor", EMPTY, EMPTY, "down"), connector(2, EMPTY, "first", "join", "east")])],
  ["branch", piece("branch", 2, [connector(0, "join", EMPTY, EMPTY, "west"), connector(1, EMPTY, "second", "join", "east")])],
  ["large", piece("large", 8, [connector(0, "join", EMPTY, EMPTY, "west")])],
  ["cap", piece("cap", 3, [connector(0, "join", EMPTY, EMPTY, "west")])],
]);
const pool = (location, fallback) => ({ elements: [{ weight: 1, element: { element_type: "minecraft:single_pool_element", location } }], fallback });
const fixture = { structure: { start_pool: "start", start_jigsaw_name: "anchor", max_depth: 1, max_distance_from_center: 20 },
  pools: new Map([["start", pool("root")], ["first", pool("branch")], ["second", pool("large", "end")], ["end", pool("cap")]]),
  getPiece: name => fixtures.get(name) };
const result = assemblyEnvelope(fixture);
assert.equal(result.deepest, 2, "depth-limit fallbacks extend beyond max_depth and must be counted");
assert.equal(result.horizontalRadius, 6, "root -> two-block branch -> three-block cap in every rotation");
assert.ok(result.witnesses.flat().includes("cap"));
assert.ok(!result.witnesses.flat().includes("large"), "normal candidates unavailable at the depth limit");
fixture.pools.get("first").elements[0].element.projection = "terrain_matching";
assert.throws(() => assemblyEnvelope(fixture), /rigid/);

assert.equal(overlaps(bounds([0, 0, 0], [2, 2, 2]), bounds([1, 1, 1], [2, 2, 2])), true);
assert.equal(overlaps(bounds([0, 0, 0], [2, 2, 2]), bounds([2, 0, 0], [2, 2, 2])), false);
for (const radius of [0, 6, 20, 86, 116]) for (const margin of [0, 12]) for (const gap of [0, 32, 64]) {
  const p = spacingForRadius(radius, margin, gap);
  assert.ok(p.separation < p.spacing / 2, "target engine's strict spacing restriction");
  const lastOffset = p.spacing - p.separation - 1;
  const nearestAcrossCells = (p.spacing - lastOffset) * 16;
  assert.equal(nearestAcrossCells, p.minimumDistance);
  const aMax = radius + margin;
  const bMin = nearestAcrossCells - radius - margin;
  assert.ok(bMin - aMax - 1 >= gap, "even touching candidate-cell extremes retain all requested free columns");
  assert.equal(p.actualFreeColumns, bMin - aMax - 1);
}
for (const args of [[-1], [NaN], [1.5], [1, -1], [1, 0, -1]]) assert.throws(() => spacingForRadius(...args), /nonnegative integers/);

const report = spacingReport();
const data = loadVillageData();
data.structure = JSON.parse(readFileSync(new URL("../lothlorien_bp/worldgen/structures/elven_village.json", import.meta.url), "utf8"))["minecraft:jigsaw"];
// Cross-check the conservative path union against actual complete assemblies.
for (let seed = 1; seed <= 20; seed++) for (const p of simulate(data, seed).placed)
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(p.o[axis] >= report.village.hull.min[axis]);
    assert.ok(p.max[axis] <= report.village.hull.max[axis]);
  }
const weights = report.desiredIndividualWeights;
assert.equal(weights.platform / weights.village, 1.5);
assert.equal(weights.plain / weights.village, 2.5);
assert.equal(weights.small / weights.village, 4);
console.log(`ok   worldgen footprint audit: fallback bounds, all candidate-cell extremes, 20 real assemblies; path radius ${report.village.horizontalRadius}, ${report.village.paths} paths (offline evidence)`);
