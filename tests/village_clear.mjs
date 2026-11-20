// The shield clear's pure helpers (lothlorien_bp/scripts/village_clear.js): the Y band from the marker decks and the slicing of the village rect.
import { test, finish } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { clearBand, clearSlices, BAND, MAX_HEIGHT, SHIELD_ID } from "../lothlorien_bp/scripts/village_clear.js";

const cells = (slices) => slices.reduce((a, s) => a + (s.x1 - s.x0 + 1) * (s.y1 - s.y0 + 1) * (s.z1 - s.z0 + 1), 0);

test("clearSlices: full coverage, no overlap, each slice inside one chunk column and at most MAX_HEIGHT layers (negative and unaligned rects, tall bands)", () => {
  const rects = [{ x0: 0, x1: 15, z0: 0, z1: 15 }, { x0: -5, x1: 40, z0: -33, z1: 2 }, { x0: 3, x1: 3, z0: 3, z1: 3 }, { x0: -16, x1: -1, z0: 16, z1: 47 }, { x0: 100, x1: 227, z0: -200, z1: -73 }];
  for (const r of rects) for (const [y0, y1] of [[34, 34], [-64, -64 + MAX_HEIGHT - 1], [30, 80], [-64, 319]]) {
    const slices = clearSlices(r, y0, y1), seen = new Set();
    assert.equal(cells(slices), (r.x1 - r.x0 + 1) * (r.z1 - r.z0 + 1) * (y1 - y0 + 1), "cell total = rect x band");
    for (const s of slices) {
      assert.equal(s.x0 >> 4, s.x1 >> 4, "one chunk column in x"); assert.equal(s.z0 >> 4, s.z1 >> 4, "one chunk column in z");
      assert.ok(s.x0 >= r.x0 && s.x1 <= r.x1 && s.z0 >= r.z0 && s.z1 <= r.z1 && s.y0 >= y0 && s.y1 <= y1 && s.y0 <= s.y1, "inside the rect and band");
      assert.ok(s.y1 - s.y0 + 1 <= MAX_HEIGHT, "slice height");
      for (let x = s.x0; x <= s.x1; x++) for (let z = s.z0; z <= s.z1; z++) for (let y = s.y0; y <= s.y1; y++) { const id = `${x},${y},${z}`; assert.ok(!seen.has(id), `overlap at ${id}`); seen.add(id); }
    }
    assert.equal(seen.size, cells(slices), "no cell twice");
  }
});

test("clearSlices: a chunk-aligned 4 x 4 chunk village is 16 columns; a tall band splits by MAX_HEIGHT", () => {
  assert.equal(clearSlices({ x0: 0, x1: 63, z0: 0, z1: 63 }, 30, 70).length, 16);
  assert.equal(clearSlices({ x0: 0, x1: 15, z0: 0, z1: 15 }, 0, 2 * MAX_HEIGHT).length, 3);
});

test("clearBand: marker decks minus BELOW / plus ABOVE, clamped to the dimension's block range; no markers, no band", () => {
  assert.deepEqual(clearBand([[0, 34, 0], [5, 50, 5], [9, 42, 1]], { min: -64, max: 319 }), { y0: 34 - BAND.below, y1: 50 + BAND.above });
  assert.deepEqual(clearBand([[0, -62, 0]], { min: -64, max: 319 }), { y0: -64, y1: -62 + BAND.above });
  assert.deepEqual(clearBand([[0, 310, 0]], { min: -64, max: 319 }), { y0: 310 - BAND.below, y1: 319 });
  assert.equal(clearBand([], { min: -64, max: 319 }), null);
});

test("the cleared id is light_block_0 only", () => assert.equal(SHIELD_ID, "minecraft:light_block_0"));

finish();
