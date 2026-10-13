// Section 9: the Great Mallorn watch camp. Furnishings/loot live here; arrow values use the shared gift rules.
import { ARROW, ARROW_ID } from "../lothlorien_bp/scripts/gift_rules.js";
// Tree coordinates; heads against the west trunk face, feet out toward the west rim.
export const CAMP = {
  beds: [[-1, 1], [-1, 2]],
  bedDirection: "east", bedFootOffset: [-1, 0],
  cushions: [{ x: 0, z: 5, variant: 2 }, { x: 3, z: 5, variant: 7 }], // native green / light gray
  carpet: [[-3, 1], [-3, 2]],
  banner: { x: 1, z: 4, height: 3, facing: 3 }, // south face of living trunk
  wardens: [[5, 3], [-1, -2]],
  lanterns: 4, // one on each cardinal rim; leaves the deck open
  lightMinimum: 1, // conservative block-light model, including trunk shadows
};

// Owner's silver design in docs/design/banner.png and banners.txt, in its original layer order.
// Bedrock calls light_gray "silver" and uses reversed dye numbers (green=2, lime=10).
export const SILVER_WATCH = {
  base: "green", baseId: 2,
  patterns: [
    { pattern: "cross", color: "lime", code: "cr", colorId: 10 },
    { pattern: "triangles_bottom", color: "lime", code: "bts", colorId: 10 },
    { pattern: "triangles_top", color: "lime", code: "tts", colorId: 10 },
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
    ["lothlorien:mallorn_acorn", 2, 1, 2], ["minecraft:emerald", 4, 2, 6],
    ["lothlorien:deer_antler", 2, 1, 1], [ARROW_ID, ARROW.lootWeight, ARROW.lootCount.min, ARROW.lootCount.max],
    ["lothlorien:mallorn_nectar", 2, 1, 2], ["lothlorien:elven_rope", 2, 1, 4],
  ],
  shieldWeight: 3, emptyWeight: 3, // owner's loot edit: one native patterned shield in 50% of chests
};
