// Final step of the runtime village build (loop_marker.js): every `minecraft:light_block_0` of the village becomes air again.
// The structure pieces fill their explicit air up to 3 cells above solids with light_block_0 (`shieldHeadroom`, tools/build_village.mjs) so that the
// leaves of natural tree features (generated after structures) cannot fill decks and houses. After the build the shield has done its job; left in
// place it makes every bed in the village "obstructed" (the wake-up check does not accept a light block as a free cell), also beds players place
// (owner decision 2026-11-21). light_block_1..15 (hidden lights that stop spawns) are never touched: the fill filter names only light_block_0.
// Pure helpers, no engine imports (tests/village_clear.mjs).

export const SHIELD_ID = "minecraft:light_block_0";
// Y band measured on 30 simulated villages (tools/village_sim.mjs): the lowest shield cell is 1 above the lowest marker deck, the highest at most 11 above
// the highest marker deck (crown tops). Margins leave slack for terrain-fitted pieces: BELOW 4, ABOVE 16.
export const BAND = { below: 4, above: 16 };
// One fill call covers at most one 16 x 16 chunk column and MAX_HEIGHT layers (16 x 16 x 64 = 16384 cells).
export const MAX_HEIGHT = 64;

// the Y range of the shield from the planner's marker deck cells ([x, y, z]), clamped to the dimension's block range [min, max] (inclusive)
export function clearBand(known, range, band = BAND) {
  if (!known.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const c of known) { lo = Math.min(lo, c[1]); hi = Math.max(hi, c[1]); }
  const y0 = Math.max(range.min, lo - band.below), y1 = Math.min(range.max, hi + band.above);
  return y0 <= y1 ? { y0, y1 } : null;
}

// rect { x0, x1, z0, z1 } (inclusive) and a Y band -> [{ x0, x1, y0, y1, z0, z1 }]: every cell exactly once, each slice inside one chunk column
// and at most maxHeight layers tall
export function clearSlices(rect, y0, y1, maxHeight = MAX_HEIGHT) {
  const out = [];
  for (let cx = rect.x0 >> 4; cx <= rect.x1 >> 4; cx++) for (let cz = rect.z0 >> 4; cz <= rect.z1 >> 4; cz++) {
    const x0 = Math.max(rect.x0, cx * 16), x1 = Math.min(rect.x1, cx * 16 + 15), z0 = Math.max(rect.z0, cz * 16), z1 = Math.min(rect.z1, cz * 16 + 15);
    for (let y = y0; y <= y1; y += maxHeight) out.push({ x0, x1, z0, z1, y0: y, y1: Math.min(y1, y + maxHeight - 1) });
  }
  return out;
}
