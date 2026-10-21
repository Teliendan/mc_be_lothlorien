// rail mender regression tests; run independently or via tests/run.mjs.
import { test, finish } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { parseMcstructure, FENCE } from "../tools/village_sim.mjs";
import * as EL from "../lothlorien_bp/scripts/elf_rules.js";
import * as MEND from "../lothlorien_bp/scripts/rail_mender_rules.js";

const VILLAGE = "../lothlorien_bp/structures/lothlorien/village";
const villagePieces = () => readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
  parseMcstructure(readFileSync(new URL(`${VILLAGE}/${f}`, import.meta.url)), f.replace(".mcstructure", "")));
const railJs = readFileSync(new URL("../lothlorien_bp/scripts/rail_mender.js", import.meta.url), "utf8");

test("rail mender: markers inside the box, and every rail of every village piece lies inside the scan box of a marker (combos carry two: bridge middle and tree axis)", () => {
  for (const p of villagePieces()) {
    const rails = p.blocks.filter((b) => b.name === FENCE);
    const m = p.entities.filter((e) => e.id === MEND.MENDER_ID);
    assert.equal(p.entities.length - p.entities.filter((e) => e.id === "lothlorien:elven_warden" || e.id === "lothlorien:loop_marker" || e.id === EL.POST_ID || e.id === "minecraft:cushion").length, m.length, `${p.name}: only markers (and village wardens, loop markers, elf posts, native cushions)`);
    assert.equal(m.length, !rails.length ? 0 : p.name.startsWith("combo_") ? 2 : 1, `${p.name}: ${rails.length} rails, ${m.length} markers`);
    for (const e of m) {
      const [x, y, z] = e.pos;
      assert.ok(x >= 0 && x < p.size[0] && y >= 0 && y < p.size[1] && z >= 0 && z < p.size[2], `${p.name}: marker inside the box`);
    }
    for (const r of rails) {
      const covered = m.some((e) => { const box = MEND.scanBox({ x: e.pos[0], y: e.pos[1], z: e.pos[2] }); return r.x >= box.from.x && r.x <= box.to.x && r.z >= box.from.z && r.z <= box.to.z && r.y >= box.from.y && r.y <= box.to.y; });
      assert.ok(covered, `${p.name}: rail ${r.x},${r.y},${r.z} is outside every marker's scan box`);
    }
  }
});

test("rail mender: marker entity files exist and the scan box is centred on the marker", () => {
  const bpE = JSON.parse(readFileSync(new URL("../lothlorien_bp/entities/rail_mender.json", import.meta.url), "utf8"))["minecraft:entity"];
  assert.equal(bpE.description.identifier, MEND.MENDER_ID);
  assert.ok(bpE.components["minecraft:persistent"] && bpE.components["minecraft:physics"].has_collision === false);
  assert.ok(existsSync(new URL("../lothlorien_rp/entity/rail_mender.entity.json", import.meta.url)));
  const b = MEND.scanBox({ x: 10.5, y: 70, z: -3.5 });
  assert.deepEqual(b.from, { x: -7, y: 67, z: -21 });
  assert.deepEqual(b.to, { x: 27, y: 84, z: 13 });
});

test("rail mender: only switches links on, only toward our own fences, never toward loaded other blocks or unloaded cells", () => {
  const world = new Map([["1,0,0", "lothlorien:mallorn_fence"], ["-1,0,0", "lothlorien:mallorn_heartwood_fence"], ["0,0,1", "minecraft:oak_fence"], ["0,0,-1", undefined]]);
  const typeAt = (x, y, z) => world.get(`${x},${y},${z}`);
  const none = () => false;
  assert.deepEqual(MEND.missingLinks({ x: 0, y: 0, z: 0 }, typeAt, none).sort(), ["minecraft:connection_east", "minecraft:connection_west"]);
  assert.deepEqual(MEND.missingLinks({ x: 0, y: 0, z: 0 }, typeAt, (s) => s === "minecraft:connection_east"), ["minecraft:connection_west"]);
  assert.deepEqual(MEND.missingLinks({ x: 5, y: 0, z: 5 }, typeAt, none), []);
});

test("rail mender: also links a fence toward a full-block post of ours (log, stripped log, wood), never toward other blocks", () => {
  const world = new Map([["1,0,0", "lothlorien:mallorn_stripped_log"], ["-1,0,0", "lothlorien:mallorn_log"], ["0,0,1", "minecraft:oak_log"], ["0,0,-1", "lothlorien:mallorn_leaves"]]);
  const typeAt = (x, y, z) => world.get(`${x},${y},${z}`);
  assert.deepEqual(MEND.missingLinks({ x: 0, y: 0, z: 0 }, typeAt, () => false).sort(), ["minecraft:connection_east", "minecraft:connection_west"]);
  assert.deepEqual(MEND.missingLinks({ x: 0, y: 0, z: 0 }, typeAt, (s) => s === "minecraft:connection_east"), ["minecraft:connection_west"], "only switches links on");
});

test("rail mender: script is imported by main.js and removes the marker only after the scan", () => {
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('import "./rail_mender.js"'));
  assert.ok(railJs.includes("entityLoad") && railJs.includes("entitySpawn") && railJs.includes("entity.remove()"));
});

finish();
