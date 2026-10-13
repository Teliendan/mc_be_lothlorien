// Section 9: the Great Mallorn watch camp. All furnishing and loot choices live here.
// Tree coordinates; head of each north-facing straw bed, foot one cell south.
export const CAMP = {
  beds: [[-1, 0], [-2, 0]],
  cushions: [{ x: 0, z: 5, variant: 2 }, { x: 3, z: 5, variant: 7 }], // native green / light gray
  carpet: [[-1, 2], [-2, 2], [-3, 2]],
  banner: { x: 1, z: 4, height: 3, facing: 3 }, // south face of living trunk
  wardens: [[5, 3], [-1, -2]],
  lanterns: 4, // one on each cardinal rim; leaves the deck open
  lightMinimum: 1, // conservative block-light model, including trunk shadows
};

// Owner's silver design in docs/design/banners.txt, in its original layer order.
// Bedrock calls light_gray "silver" and uses reversed dye numbers (green=2, lime=10).
export const SILVER_WATCH = {
  base: "green", baseId: 2,
  patterns: [
    { pattern: "cross", color: "lime", code: "cr", colorId: 10 },
    { pattern: "triangles_bottom", color: "lime", code: "bt", colorId: 10 },
    { pattern: "triangles_top", color: "lime", code: "tt", colorId: 10 },
    { pattern: "curly_border", color: "silver", code: "cbo", colorId: 7 },
    { pattern: "stripe_middle", color: "lime", code: "ms", colorId: 10 },
    { pattern: "flower", color: "green", code: "flo", colorId: 2 },
  ],
};

export const LOOT = {
  provisions: [
    ["lothlorien:miruvor", 3, 1, 2], ["lothlorien:lembas_wrapped", 2, 1, 1],
  ],
  supplyRolls: { min: 3, max: 5 },
  supplies: [
    ["lothlorien:athelas", 4, 1, 3], ["lothlorien:athelas_salve", 1, 1, 1],
    ["lothlorien:western_corn_grain", 2, 2, 4], ["lothlorien:western_corn_seeds", 4, 1, 3],
    ["lothlorien:mallorn_acorn", 2, 1, 2], ["lothlorien:elanor", 2, 1, 3],
    ["lothlorien:niphredil", 2, 1, 3], ["minecraft:emerald", 4, 2, 6],
    ["lothlorien:deer_antler", 2, 1, 1], ["lothlorien:galadhrim_arrow", 2, 4, 8],
    ["lothlorien:morning_dew", 2, 1, 2], ["lothlorien:bottle_of_fireflies", 1, 1, 1],
    ["lothlorien:mallorn_nectar", 2, 1, 2], ["lothlorien:elven_rope", 2, 1, 2],
  ],
  shieldWeight: 1, emptyWeight: 3, // one native patterned shield in 25% of chests
};
