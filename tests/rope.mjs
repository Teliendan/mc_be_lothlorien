// rope regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as ROPE from "../lothlorien_bp/scripts/elven_rope_rules.js";



test("Elven rope: fills down first, then up, one piece per item", () => {
  const free = (lo, hi) => (y) => y >= lo && y <= hi;
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 3, free: free(0, 20) }), [10, 9, 8]);
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 6, free: free(8, 20) }), [10, 9, 8, 11, 12, 13], "bottom reached: carries on up");
  assert.deepEqual(ROPE.planRope({ downFrom: 10, upFrom: 11, count: 4, free: free(10, 12) }), [10, 11, 12], "stops at the first blocked row");
  assert.deepEqual(ROPE.planRope({ downFrom: 4, upFrom: 12, count: 3, free: free(0, 20) }), [4, 3, 2], "extension: down from the bottom first");
  assert.deepEqual(ROPE.planRope({ downFrom: 4, upFrom: 12, count: 4, free: free(4, 20) }), [4, 12, 13, 14], "extension: up from the top once down is blocked");
  assert.deepEqual(ROPE.planRope({ downFrom: 0, upFrom: 1, count: 3, free: free(0, 9), minY: 0 }), [0, 1, 2], "world bottom");
});

test("Elven rope: whole column found, drops split into stacks of 64", () => {
  const pieces = new Set([3, 4, 5, 9]);
  assert.deepEqual(ROPE.columnBounds((y) => pieces.has(y), 4), { bottom: 3, top: 5 });
  assert.deepEqual(ROPE.columnBounds((y) => pieces.has(y), 9), { bottom: 9, top: 9 });
  assert.deepEqual(ROPE.dropStacks(64), [64]);
  assert.deepEqual(ROPE.dropStacks(70), [64, 6]);
  assert.deepEqual(ROPE.dropStacks(1), [1]);
});

test("Elven rope: wall lies behind the face, the piece in front of the clicked face", () => {
  for (const f of ROPE.FACES) {
    const w = ROPE.wallOffset(f);
    const p = ROPE.pieceOffset(f);
    assert.deepEqual([w.x + p.x, w.z + p.z], [0, 0], f);
  }
  assert.deepEqual(ROPE.wallOffset("north"), { x: 0, z: 1 });
  assert.equal(ROPE.wallOffset("up"), undefined);
  assert.equal(ROPE.isUnsupported({ isAir: true, isLiquid: false }), true);
  assert.equal(ROPE.isUnsupported({ isAir: false, isLiquid: false }), false);
  assert.equal(ROPE.isUnsupported(undefined), false, "unloaded chunk keeps the rope");
});

test("Elven rope: levitation controller reaches the ladder speed at once and holds it", () => {
  const target = 3.2 / 20;
  let v = 0;
  const speeds = [];
  for (let tick = 0; tick < 200; tick++) speeds.push((v = ROPE.levitationStep(v, target).v));
  assert.ok(speeds[0] > target * 0.9, `first tick ${speeds[0]}`);
  const mean = speeds.slice(5).reduce((a, b) => a + b, 0) / (speeds.length - 5);
  assert.ok(Math.abs(mean - target) < 0.002, `mean ${mean * 20} b/s`);
  // the old fixed level 2.35 gives the 2.1 blocks/s measured in game: the model matches the game
  const m = ROPE.LEVITATION;
  let w = 0;
  for (let tick = 0; tick < 100; tick++) w = m.drag * (w + m.pull * (2.35 * m.perLevel - w));
  assert.ok(Math.abs(w * 20 - 2.13) < 0.03, `steady ${w * 20}`);
  // falling into the rope: the first levels are high, never above the cap
  assert.equal(ROPE.levitationStep(-1, target).amplifier, m.maxLevel - 1);
  assert.equal(ROPE.levitationStep(1, target).amplifier, 0, "level never below 1");
  assert.ok(ROPE.CLIMB.effectTicks <= 10, "short effects");
  assert.equal(ROPE.brakes(-0.25, ROPE.CLIMB.downSpeed / 20), true, "5 blocks/s down brakes");
  assert.equal(ROPE.brakes(-0.15, ROPE.CLIMB.downSpeed / 20), false, "3 blocks/s down slides on");
});

test("Elven rope: every rule the wiring calls is imported (a missing import throws inside try/catch, silently)", () => {
  const src = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8");
  const imported = src.match(/import \{([^}]*)\} from "\.\/elven_rope_rules\.js"/)[1].split(",").map((n) => n.trim());
  for (const name of Object.keys(ROPE)) {
    if (new RegExp(`\\b${name}\\b`).test(src.replace(/^import .*$/gm, ""))) assert.ok(imported.includes(name), `${name} used but not imported`);
  }
});

test("Elven rope: block, item and recipe agree", () => {
  const block = readJson("../lothlorien_bp/blocks/elven_rope.json")["minecraft:block"];
  assert.deepEqual(block.description.states["lothlorien:face"], ROPE.FACES);
  assert.equal(block.components["minecraft:collision_box"], false, "climb through it");
  assert.equal(block.components["minecraft:loot"], "loot_tables/blocks/elven_rope.json", "native loot covers the popped piece; script drops remaining pieces");
  assert.equal(block.permutations.length, ROPE.FACES.length);
  const item = readJson("../lothlorien_bp/items/elven_rope.json")["minecraft:item"];
  assert.equal(item.components["minecraft:max_stack_size"], 64);
  assert.ok("lothlorien:rope" in item.components);
  const recipe = readJson("../lothlorien_bp/recipes/elven_rope.json")["minecraft:recipe_shaped"];
  assert.deepEqual(Object.values(recipe.key).map((i) => i.item).sort(), ["lothlorien:golden_fern", "lothlorien:morning_dew"]);
  assert.deepEqual(recipe.result, [{ item: "lothlorien:elven_rope", count: 1 }, { item: "minecraft:glass_bottle", count: 1 }]);
});

finish();
