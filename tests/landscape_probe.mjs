import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { PROBE, probePieces, probeDefinitions } from "../tools/build_landscape_probe.mjs";
import { toMcstructure } from "../tools/build_structures.mjs";
import { loadVillageData, simulate, readNbt } from "../tools/village_sim.mjs";

const bp = new URL("../lothlorien_bp/", import.meta.url);
const pieces = probePieces(), defs = probeDefinitions(pieces);
for (const p of pieces) {
  const encoded = toMcstructure(p.blocks, p.size, p.offset, p.entities);
  assert.equal(encoded.clipped, 0, p.name);
  assert.deepEqual(encoded.buffer,
    readFileSync(new URL(`structures/lothlorien/landscape_probe/${p.name}.mcstructure`, bp)));
  for (const [k, b] of p.source) {
    // Connector sites are outside accepted solids. Existing explicit air may
    // become an air-final connector; every solid/furniture/loot block is exact.
    if (b.name !== "minecraft:air") assert.deepEqual(p.blocks.get(k), b, `${p.name}: ${k}`);
  }
  const nbt = readNbt(encoded.buffer);
  assert.equal(nbt.structure.entities.length, p.entities.length, "camp residents/furnishings retained");
}
for (const [path, definition] of Object.entries(defs))
  assert.deepEqual(JSON.parse(readFileSync(new URL(`worldgen/${path}`, bp), "utf8")), definition);
const matching = new Set([PROBE.treeSpacer, PROBE.smallSpacer]);
const pools = new Map(Object.values(defs).filter(d => d["minecraft:template_pool"])
  .map(d => { const p = d["minecraft:template_pool"]; return [p.description.identifier, p]; }));
for (const [id, pool] of pools) for (const { element } of pool.elements)
  assert.equal(element.projection, matching.has(id) ? "terrain_matching" : "rigid",
    `${id}: only the invisible links may conform; full trees/buildings stay rigid`);
for (const retired of ["structures/woodland_group_rigid_control.json",
  "template_pools/landscape_probe_tree_spacer_rigid.json",
  "template_pools/landscape_probe_small_spacer_rigid.json"])
  assert.equal(existsSync(new URL(`worldgen/${retired}`, bp)), false, "failed control must not linger");
const sets = readdirSync(new URL("worldgen/structure_sets/", bp));
assert.ok(!sets.some(f => /probe/.test(f)), "no unproven natural-generation switch");
const data = loadVillageData();
data.structure = defs["structures/woodland_group_probe.json"]["minecraft:jigsaw"];
// The existing simulator models flat box assembly, not native heightmap
// projection or gravity processing. These results MUST NOT certify hill fit.
const counts = [];
const hulls = [];
const hull = result => ({
  x0: Math.min(...result.placed.map(p => p.o[0])), x1: Math.max(...result.placed.map(p => p.max[0])),
  z0: Math.min(...result.placed.map(p => p.o[2])), z1: Math.max(...result.placed.map(p => p.max[2])),
});
for (let seed = 1; seed <= 300; seed++) {
  const result = simulate(data, seed);
  assert.equal(result.capped, false);
  assert.equal(result.placed.filter(p => /^(root_)?tree_round/.test(p.name)).length, 2,
    "two complete ordinary giants per woodland group");
  assert.equal(result.placed.filter(p => /garden|memorial|root_shrine/.test(p.name)).length, 2,
    "two complete smaller places per woodland group");
  assert.equal(result.placed.filter(p => /spacer$/.test(p.name)).length, 3);
  const trees = result.placed.filter(p => /^(root_)?tree_round/.test(p.name));
  const centre = p => [0, 2].map(i => (p.o[i] + p.max[i]) / 2);
  const a = centre(trees[0]), b = centre(trees[1]);
  assert.equal(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])), PROBE.treeDistance,
    "tree centres are 80 blocks apart rather than the original 40");
  assert.ok(Math.min(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= 1,
    "only the original one-cell connector offset may shift the other axis");
  for (const p of result.placed) {
    assert.ok(p.o[0] >= -PROBE.horizontal && p.max[0] <= PROBE.horizontal);
    assert.ok(p.o[2] >= -PROBE.horizontal && p.max[2] <= PROBE.horizontal);
    for (const q of result.placed) if (p !== q) assert.ok(
      p.max[0] < q.o[0] || p.o[0] > q.max[0] || p.max[1] < q.o[1] || p.o[1] > q.max[1] ||
      p.max[2] < q.o[2] || p.o[2] > q.max[2], "whole boxes do not overlap");
  }
  counts.push({ trees: result.placed.filter(p => /^(root_)?tree_round/.test(p.name)).length,
    ends: result.placed.filter(p => /garden|memorial|root_shrine/.test(p.name)).length });
  hulls.push(hull(result));
}
for (const p of pieces.filter(p => p.spacer)) {
  const nbt = readNbt(toMcstructure(p.blocks, p.size, p.offset).buffer);
  const indices = nbt.structure.block_indices[0];
  assert.equal(indices.filter(i => i >= 0).length, 2, "spacer writes only its two endpoints");
  for (const j of Object.values(nbt.structure.palette.default.block_position_data))
    assert.equal(j.block_entity_data.final_state, "minecraft:air", "no visible spacer remains");
}
// Two independent starts require room for their complete horizontal envelopes,
// including an explicit margin for post-generation village finishing.
const minStartDistance = (PROBE.separation + 1) * 16;
assert.ok(minStartDistance - (2 * (PROBE.horizontal + PROBE.margin) + 1) >= PROBE.groupClearance,
  "at least 64 free block columns between worst-case padded group envelopes");
assert.ok(272 - (2 * (PROBE.horizontal + PROBE.margin) + 1) < PROBE.groupClearance,
  "the previous 34/16 grid would not meet the new edge-clearance requirement");
assert.ok(PROBE.separation < PROBE.spacing / 2);
// Include the real village branch, not just woodland roots, in neighbouring-cell
// checks. Exercise both sides of every axis/diagonal and every quarter turn.
data.structure = JSON.parse(readFileSync(new URL("worldgen/structures/elven_village.json", bp), "utf8"))["minecraft:jigsaw"];
for (let seed = 1; seed <= 30; seed++) hulls.push(hull(simulate(data, seed)));
const rotate = b => ({ x0: -b.z1, x1: -b.z0, z0: b.x0, z1: b.x1 });
const padded = b => ({ x0: b.x0 - PROBE.margin, x1: b.x1 + PROBE.margin,
  z0: b.z0 - PROBE.margin, z1: b.z1 + PROBE.margin });
const turned = hulls.flatMap(b => { const out = []; for (let r = 0; r < 4; r++) { out.push(padded(b)); b = rotate(b); } return out; });
for (const a of turned) for (const b of turned) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
  const x = dx * minStartDistance, z = dz * minStartDistance;
  const gap = Math.max(b.x0 + x - a.x1 - 1, a.x0 - b.x1 - x - 1,
    b.z0 + z - a.z1 - 1, a.z0 - b.z1 - z - 1);
  assert.ok(gap >= PROBE.groupClearance, "neighbouring rotated woodland/village edges remain separated");
}
const mean = k => (counts.reduce((n, r) => n + r[k], 0) / counts.length).toFixed(2);
const mixed = defs["template_pools/landscape_probe_start.json"]["minecraft:template_pool"].elements;
assert.equal(mixed[0].weight, 32);
assert.equal(mixed.slice(1).reduce((n,e) => n + e.weight,0), 64,
  "two woodland groups per village on average");
console.log(`ok   native landscape probe: exact complete assets, matching links/rigid builds, failed control removed; 300 flat assemblies; trees ${mean("trees")}, small builds ${mean("ends")}; spacing ${PROBE.treeDistance}, neighbouring padded groups >= ${PROBE.groupClearance}; native heightmap/terrain test pending`);
