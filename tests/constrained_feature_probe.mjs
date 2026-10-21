// Offline definition/geometry checks only: engine clipping/rejection is unknown.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { CASES, BOUNDS_CASES, FEATURE_PROBE as P, featureProbePieces, featureProbeDefinitions,
  featureProbeFunctions, featureProbeNaturalSet } from "../tools/build_constrained_feature_probe.mjs";
import { toMcstructure } from "../tools/build_structures.mjs";
import { readNbt } from "../tools/village_sim.mjs";

const bp = new URL("../lothlorien_feature_probe_bp/", import.meta.url);
const core = new URL("../lothlorien_bp/", import.meta.url);
const pieces = featureProbePieces(), defs = featureProbeDefinitions();
const payload = pieces.find(p => p.id === "payload");
for (const p of pieces) {
  const { buffer, clipped } = toMcstructure(p.blocks, p.size, p.offset);
  assert.equal(clipped, 0);
  assert.deepEqual(buffer, readFileSync(new URL(`structures/lothlorien/feature_probe/${p.id}.mcstructure`, bp)));
  const nbt = readNbt(buffer);
  assert.deepEqual(nbt.size, p.size);
  assert.equal(nbt.structure.entities.length, 0, "plain tree test has no scripted residents");
}
for (const [k, b] of payload.source) assert.deepEqual(payload.blocks.get(k), b, `accepted source: ${k}`);
// Every possible quarter turn of the carrier puts its obstacle in a distinct
// chunk at our x/z=8 modulo 16 fixtures. Both plausible centring conventions
// land on explicit AIR (not a root or other solid), including the diagonal.
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  assert.notEqual(Math.floor((8 + sx * P.obstacle[0]) / 16), Math.floor(8 / 16));
  assert.notEqual(Math.floor((8 + sz * P.obstacle[2]) / 16), Math.floor(8 / 16));
  for (const min of [-20, -19]) {
    const x = sx * 18 - min, z = sz * 18 - min;
    assert.equal(payload.blocks.get(`${x - 18},${P.airPlane - 6},${z - 18}`).name, "minecraft:air");
  }
}
assert.equal(2 - P.ground + P.airPlane, P.obstacle[1], "feature-point plane intersects carrier diamond");
assert.ok(-10 < 2 - P.ground, "case label below all payload entries");
for (const c of CASES) {
  const p = pieces.find(p => p.id === `carrier_${c.id}`);
  assert.equal(c.x % 16, 8);
  assert.deepEqual(p.size, P.carrierSize, "identical root bbox in all controls");
  const connector = p.blocks.get("0,1,0");
  assert.equal(connector.states.facing_direction, 1);
  assert.equal(connector.finalState, "minecraft:air");
  assert.equal(p.blocks.get("0,-10,0").name, c.marker);
  assert.equal(p.blocks.has(P.obstacle.join(",")), c.obstacle);
  if (c.obstacle) assert.equal(p.blocks.get(P.obstacle.join(",")).name, "minecraft:diamond_block");
  assert.equal(p.blocks.size, c.obstacle ? 3 : 2, "carrier otherwise structure void");
  const pool = defs[`worldgen/template_pools/feature_probe_${c.id}_start.json`]["minecraft:template_pool"];
  assert.equal(pool.elements[0].element.location, `lothlorien/feature_probe/${p.id}`);
  assert.equal(pool.elements[0].element.projection, "rigid");
  const id = c.checked ? "checked" : "control";
  const element = defs[`worldgen/template_pools/feature_probe_${id}_feature.json`]["minecraft:template_pool"].elements[0].element;
  assert.equal(element.element_type, "minecraft:feature_pool_element");
  assert.equal(Object.hasOwn(element, "projection"), false,
    "owner engine log: feature pool elements reject projection");
  const feature = defs[`features/feature_probe_${id}.json`]["minecraft:structure_template_feature"];
  assert.equal(element.feature, feature.description.identifier);
  assert.equal(feature.structure_name, "lothlorien:feature_probe/payload");
  assert.ok(existsSync(new URL(`structures/${feature.structure_name.replace(":", "/")}.mcstructure`, bp)));
  for (const suffix of ["", "_natural"]) {
    const d = defs[`worldgen/structures/feature_probe_${c.id}${suffix}.json`]["minecraft:jigsaw"];
    assert.equal(d.start_pool, pool.description.identifier);
    assert.equal(d.max_depth, 1);
    assert.equal(d.start_jigsaw_name, connector.jigsaw);
    assert.equal(d.start_height.value.absolute, suffix ? 220 : 100);
    assert.equal(d.heightmap_projection, undefined, "absolute sky test isolates terrain");
  }
}
const control = structuredClone(defs["features/feature_probe_control.json"]["minecraft:structure_template_feature"]);
const checked = structuredClone(defs["features/feature_probe_checked.json"]["minecraft:structure_template_feature"]);
delete control.description; delete checked.description;
assert.deepEqual(control.constraints, {}, "unchecked features still require constraints object");
assert.deepEqual(checked.constraints, { block_intersection: {
  only_check_intersection_for_motion_blocking_blocks: false, block_allowlist: ["minecraft:air"],
} });
delete checked.constraints;
delete control.constraints;
assert.deepEqual(control, checked, "feature controls differ only identifier and intersection gate");
for (const [path, d] of Object.entries(defs))
  assert.deepEqual(JSON.parse(readFileSync(new URL(path, bp), "utf8")), d);
for (const [path, contents] of Object.entries(featureProbeFunctions()))
  assert.equal(readFileSync(new URL(path, bp), "utf8"), contents);
// Obstructed command fixtures must exist before feature invocation, independent
// of how the engine orders carrier block writes and child feature placement.
const runner = featureProbeFunctions()["functions/lothlorien/feature_probe.mcfunction"].trim().split("\n");
for (const c of CASES) {
  const end = runner.indexOf(`place structure lothlorien:feature_probe_${c.id} ${c.x} 100 8`);
  assert.ok(end >= 0);
  const start = runner.findIndex(line => line.startsWith(`fill ${c.x - 24} 80 `));
  const obstacles = runner.slice(start, end).filter(line => line.endsWith("minecraft:diamond_block"));
  assert.equal(obstacles.length, c.obstacle ? 4 : 0);
  for (const line of obstacles) {
    const [xa, ya, za, xb, yb, zb] = line.split(" ").slice(1, 7).map(Number);
    assert.ok((xb - xa + 1) * (yb - ya + 1) * (zb - za + 1) <= 32768);
    assert.ok(xa >= c.x - 24 && xb <= c.x + 24 && za >= -16 && zb <= 32);
    for (const x of [xa, xb]) assert.notEqual(Math.floor(x / 16), Math.floor(c.x / 16));
    for (const z of [za, zb]) assert.notEqual(Math.floor(z / 16), 0);
    assert.ok(ya <= 99 && yb >= 99, "pillars cross the nominal diagnostic-air plane");
    // These low outer pillars intersect diagnostic AIR, not the real saved tree
    // or its glass frame, under either plausible integer centring convention.
    for (const min of [-20, -19]) for (let x = xa; x <= xb; x++)
      for (let z = za; z <= zb; z++) for (let y = ya; y <= yb; y++) {
        const k = `${x - c.x - min - 18},${y - 95 - 6},${z - 8 - min - 18}`;
        const value = payload.blocks.get(k);
        assert.ok(!value || value.name === "minecraft:air", `pillar touches solid payload ${k}`);
      }
  }
}
assert.deepEqual(JSON.parse(readFileSync(new URL(P.naturalSet, bp), "utf8")), featureProbeNaturalSet());
// Revision 3: the unchanged direct baseline survives the list-element rejection.
const direct = pieces.find(p => p.id === "direct");
assert.deepEqual(direct.size, payload.size);
assert.deepEqual(direct.offset, payload.offset);
for (const [k, value] of payload.blocks) assert.deepEqual(direct.blocks.get(k), value, `direct baseline payload: ${k}`);
assert.equal(direct.blocks.size, payload.blocks.size + 1);
const [inputKey, input] = [...direct.blocks].find(([, b]) => b.name === "minecraft:jigsaw");
const inputLocal = inputKey.split(",").map((n, i) => Number(n) + direct.offset[i]);
assert.deepEqual(inputLocal, [20, 0, 20]);
assert.equal(input.states.facing_direction, 0);
assert.equal(input.jigsaw, P.target);
assert.equal(input.jigsawPool, "minecraft:empty");
assert.equal(payload.blocks.has(inputKey), false, "input must not remove source art or diagnostic air");
assert.equal([...payload.blocks].filter(([k, b]) => k.split(",")[1] === "47"
  && ["minecraft:glass", "minecraft:sea_lantern"].includes(b.name)).length, 156,
  "perimeter must contain all four complete 40-block sides");
for (const c of BOUNDS_CASES) {
  const carrier = pieces.find(p => p.id === `carrier_${c.id}`);
  assert.deepEqual(carrier.size, [1, 12, 1]);
  assert.equal(carrier.blocks.size, 2);
  const anchor = carrier.blocks.get("0,1,0");
  assert.equal(carrier.blocks.get("0,-10,0").name, c.marker);
  assert.equal(anchor.jigsawTarget, input.jigsaw);
  assert.equal(anchor.states.facing_direction, 1);
  assert.equal(1 + carrier.offset[1], carrier.size[1] - 1, "parent anchor is on its top face");
  const childMinY = 1 + 1 - inputLocal[1];
  const parentMaxY = carrier.size[1] - 1 - carrier.offset[1];
  assert.ok(childMinY > parentMaxY, "full child box must not overlap its parent");
  // Adjacent vertical connectors put the child above the parent at every roll.
  for (let turn = 0; turn < 4; turn++) {
    const rotate = ([x, z]) => turn === 0 ? [x, z] : turn === 1 ? [-z, x]
      : turn === 2 ? [-x, -z] : [z, -x];
    const [ax, az] = rotate([inputLocal[0], inputLocal[2]]);
    const corners = [[0, 0], [39, 0], [0, 39], [39, 39]].map(p => rotate(p));
    assert.ok(corners.every(([x, z]) => Math.abs(x - ax) <= 20 && Math.abs(z - az) <= 20));
  }
  const child = defs[`worldgen/template_pools/feature_probe_${c.id}_child.json`]["minecraft:template_pool"].elements[0].element;
  assert.equal(child.element_type, "minecraft:single_pool_element");
  assert.equal(child.location, "lothlorien/feature_probe/direct");
  for (const suffix of ["", "_natural"]) {
    const d = defs[`worldgen/structures/feature_probe_${c.id}${suffix}.json`]["minecraft:jigsaw"];
    assert.equal(d.max_depth, 1);
    assert.equal(d.start_height.value.absolute, suffix ? P.naturalY : P.commandY);
    assert.equal(d.heightmap_projection, undefined);
  }
}
assert.deepEqual(featureProbeNaturalSet()["minecraft:structure_set"].structures,
  BOUNDS_CASES.map(c => ({ structure: `lothlorien:feature_probe_${c.id}_natural`, weight: 1 })),
  "natural set must contain only the direct-template control");
assert.equal(BOUNDS_CASES.length, 1);
assert.equal(BOUNDS_CASES[0].id, "direct");
for (const path of ["features/feature_probe_bounded.json",
  "structures/lothlorien/feature_probe/envelope.mcstructure",
  "structures/lothlorien/feature_probe/carrier_envelope.mcstructure",
  "worldgen/template_pools/feature_probe_envelope_child.json",
  "worldgen/template_pools/feature_probe_envelope_start.json",
  "worldgen/structures/feature_probe_envelope.json",
  "worldgen/structures/feature_probe_envelope_natural.json"])
  assert.equal(existsSync(new URL(path, bp)), false, `rejected envelope must be removed: ${path}`);
for (const line of featureProbeFunctions()["functions/lothlorien/feature_bounds.mcfunction"].split("\n")) {
  if (!line.startsWith("fill ")) continue;
  const [xa, ya, za, xb, yb, zb] = line.split(" ").slice(1, 7).map(Number);
  assert.ok((xb - xa + 1) * (yb - ya + 1) * (zb - za + 1) <= 32768);
}
const manifest = defs["manifest.json"];
const coreManifest = JSON.parse(readFileSync(new URL("manifest.json", core), "utf8"));
assert.deepEqual(manifest.dependencies[0], { uuid: coreManifest.header.uuid, version: coreManifest.header.version });
assert.notEqual(manifest.header.uuid, coreManifest.header.uuid);
assert.notEqual(manifest.header.uuid, manifest.modules[0].uuid);
assert.equal(manifest.modules.length, 1);
assert.equal(manifest.modules[0].type, "data", "probe has no runtime script");
assert.equal(existsSync(new URL(P.naturalSet, core)), false, "natural test set isolated from main pack");
const setReferences = readdirSync(new URL("worldgen/structure_sets/", core)).flatMap(f => {
  return JSON.parse(readFileSync(new URL(`worldgen/structure_sets/${f}`, core), "utf8"))["minecraft:structure_set"].structures;
});
assert.ok(setReferences.every(s => !s.structure.includes("feature_probe")), "no production set references probe");
for (const path of Object.keys(defs).filter(p => p !== "manifest.json"))
  assert.equal(existsSync(new URL(path, core)), false, `test definition isolated: ${path}`);
console.log("Native constrained-feature probe: source preservation, references, obstacles and direct control pass; rejected envelope removed (native direct result pending).");
