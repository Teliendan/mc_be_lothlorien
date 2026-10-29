// Accepted leaf memorial. Existing assets, standalone woodland worldgen.
import { SILVER_WATCH } from "./watch_camp_rules.mjs";
import { addSoilSkirt, SKIRT } from "./ground_skirt.mjs";
import { shuffledLatticeIterations, siteFeature } from "./site_feature.mjs";

// start offsets the template bottom from world_surface. Deck planks are at encoded y SKIRT.depth:
// bury all the soil beneath them so the deck replaces the terrain top (owner, 2026-10-24).
// clear: the free cells above the deck and apron.
export const MEMORIAL = Object.freeze({
  id: "lothlorien:memorial_leaf_01", size: [15, 6 + SKIRT.depth, 18], offset: [7, SKIRT.depth, 8], start: -SKIRT.depth, clear: 4,
  anchor: "lothlorien:memorial_ground",
});
// Natural `structure_template_feature` copy (TEST BUILD 2026-10-28, docs/GARDEN_FEATURE_TEST.md). 11 x 15 centred box
// (apron x +-5, z -6..7; row z -7 stays void), no shoulder, no anchor, soil 3 deep. Local deck row 0 = encoded y 3 =
// ground_level, so the deck replaces the terrain top (owner 2026-10-28: raised by 1 the slab edge read as steps; back flush).
// The feature drops template entities, so the top pillar log is the look-alike `memorial_seed` (scripts/memorial_seed.js).
// /place feature found no memorial_feature while no rule placed it (owner, 2026-10-28), so the rule also makes it placeable.
export const MEMORIAL_FEATURE = Object.freeze({
  id: "lothlorien:memorial_leaf_feature_01", size: [11, 9, 15], offset: [5, 3, 7], groundLevel: 3, clear: 4,
  feature: "lothlorien:memorial_feature", rule: "lothlorien:memorial_feature_rules", adjustmentRadius: 0,
  seed: "lothlorien:memorial_seed", seedAt: [0, 4, 3],
  soil: { depth: 3, ring1: 0, ring2: false, seed: 23 },
});
export function memorialFeature() {
  return siteFeature({ identifier: MEMORIAL_FEATURE.feature, structure: MEMORIAL_FEATURE.id,
    groundLevel: MEMORIAL_FEATURE.groundLevel, adjustmentRadius: MEMORIAL_FEATURE.adjustmentRadius });
}

// Same shuffled lattice and chance as the garden (owner 2026-10-28: memorials ~24 per km2, "same as gardens"), with its own
// scramble so the two pick the same chunk in only ~1 cell in 9; there the constraints refuse whichever comes second.
// Centre 7 keeps the rotated 15-long side inside the chunk (0..14) with radius 0.
export const MEMORIAL_LATTICE = 4;
export const MEMORIAL_SHUFFLE = Object.freeze({ x: [23, 11, 53], z: [19, 37, 5], prime: 97 });
export const MEMORIAL_CHANCE = Object.freeze({ numerator: 1, denominator: 5 });
export const MEMORIAL_EXTENT = Object.freeze([7, 8]);
export const MEMORIAL_FILES = Object.freeze({
  feature: "features/memorial_feature.json", rule: "feature_rules/memorial_feature_rules.json",
  retired: ["worldgen/structure_sets/memorial_sites.json"],
});
export function memorialFeatureRule() {
  return { format_version: "1.13.0", "minecraft:feature_rules": {
    description: { identifier: MEMORIAL_FEATURE.rule, places_feature: MEMORIAL_FEATURE.feature },
    conditions: {
      placement_pass: "before_surface_pass",
      "minecraft:biome_filter": [{ test: "has_biome_tag", value: "lothlorien" }],
    },
    distribution: {
      iterations: shuffledLatticeIterations(MEMORIAL_LATTICE, MEMORIAL_SHUFFLE),
      ...(MEMORIAL_CHANCE.numerator < MEMORIAL_CHANCE.denominator ? { scatter_chance: { ...MEMORIAL_CHANCE } } : {}),
      x: { distribution: "uniform", extent: [...MEMORIAL_EXTENT] },
      y: "query.heightmap(variable.worldx, variable.worldz) - 1",
      z: { distribution: "uniform", extent: [...MEMORIAL_EXTENT] },
    },
  } };
}

const L = "lothlorien:", M = "minecraft:";
const key = (x, y, z) => `${x},${y},${z}`;

export function buildMemorial({ feature = false } = {}) {
  const clear = feature ? MEMORIAL_FEATURE.clear : MEMORIAL.clear;
  const blocks = new Map(), flowers = [], seats = [];
  const put = (x, y, z, name, states = {}, extra = {}) =>
    blocks.set(key(x, y, z), { name, states, ...extra });
  // Widths describe an asymmetric leaf: pointed north tip, broad shoulders,
  // rounded south heel. A short golden petiole continues its central vein.
  const widths = new Map([[-5, 0], [-4, 1], [-3, 2], [-2, 3], [-1, 4],
    [0, 4], [1, 4], [2, 3], [3, 3], [4, 2], [5, 1], [6, 0]]);
  const leaf = new Set();
  for (const [z, width] of widths) for (let x = -width; x <= width; x++) leaf.add(`${x},${z}`);
  const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const ground = new Set(leaf);
  for (const k of leaf) {
    const [x, z] = k.split(",").map(Number);
    for (const [dx, dz] of adjacent) ground.add(`${x + dx},${z + dz}`);
  }
  // Only a one-cell apron and the actual deck are cleared. The corners and
  // canopy remain structure void.
  // The apron ring is grass at deck level (owner 2026-10-28: a ring one lower read as a trench, the old slab rim as steps).
  for (const k of ground) {
    const [x, z] = k.split(",").map(Number);
    const apron = !leaf.has(k);
    put(x, -2, z, M + "dirt");
    put(x, -1, z, M + (apron ? "dirt" : "grass_block"));
    if (apron) put(x, 0, z, M + "grass_block");
    for (let y = apron ? 1 : 0; y <= clear; y++) put(x, y, z, M + "air");
  }
  // Full planks to the rim, no slab edge (owner 2026-10-28: the slab rim read as steps).
  for (const k of leaf) {
    const [x, z] = k.split(",").map(Number);
    put(x, 0, z, L + (x === 0 ? "mallorn_heartwood" : "mallorn") + "_planks");
  }
  // Three recessed soil pockets. Flowers have full soil support at deck level,
  // and their white clusters repeat around the heel without fencing it in.
  for (const patch of [
    [[-3, 0], [-3, 1], [-2, 2]],
    [[3, 0], [3, 1], [2, 2]],
    [[-1, 4], [0, 4], [1, 4]],
  ]) for (const [i, [x, z]] of patch.entries()) {
    put(x, 0, z, M + "grass_block");
    put(x, 1, z, i === 1 ? M + "lily_of_the_valley" : L + "niphredil",
      i === 1 ? {} : { "lothlorien:on_grass": false });
    flowers.push([x, 1, z]);
  }
  // Straight silver marker with a small golden cap. The owner rejected
  // horizontal shoulders because they made the monument read as a cross.
  for (let y = 1; y <= 4; y++) put(0, y, 3, L + "mallorn_log", { "minecraft:block_face": "up" });
  put(0, 5, 3, L + "mallorn_heartwood_slab", { "minecraft:vertical_half": "bottom" });
  const banner = { ...SILVER_WATCH, patterns: SILVER_WATCH.patterns.map((p) =>
    p.color === "silver" ? { ...p, color: "white", colorId: 15 } : { ...p }) };
  for (const [z, facing] of [[2, 2], [4, 3]]) {
    // Cloth hangs down into the next lower air cell, above the flowers.
    put(0, 3, z, M + "wall_banner", { facing_direction: facing }, { banner });
    put(0, 2, z, M + "air");
  }
  // Two small inward-facing benches, with open access and no nearby fence
  // for the stairs to join. No runtime actors or new furnishing assets.
  for (const x of [-2, 2]) for (const z of [-1, 0]) {
    put(x, 1, z, L + "mallorn_stairs", { "minecraft:cardinal_direction": x < 0 ? "west" : "east",
      "minecraft:vertical_half": "bottom", "minecraft:corner": "none" });
    seats.push([x, 1, z]);
  }
  // Clear above the small monument itself, without clearing a full-height box.
  for (let y = 4; y <= 5; y++) for (const x of [-1, 0, 1]) for (const z of [2, 3, 4])
    if (!blocks.has(key(x, y, z))) put(x, y, z, M + "air");
  // Same centred ground alignment as the garden. Natural jigsaw placement
  // consumes the buried anchor to dirt; no visible deck cell changes.
  if (!feature) put(0, -2, 0, M + "jigsaw", { facing_direction: 0, rotation: 0 }, {
    jigsaw: MEMORIAL.anchor, finalState: M + "dirt",
  });
  // Deep soil under the apron and a ragged shoulder round it (tools/ground_skirt.mjs).
  const skirt = addSoilSkirt(put, (x, y, z) => blocks.has(key(x, y, z)), ground, { top: -1, seed: 23, ...(feature ? MEMORIAL_FEATURE.soil : {}) });
  // Invisible sound source just above the pillar's cap (docs/SOUNDSCAPE_PLAN.md): its native ambient timer plays the memorial tones.
  // The jigsaw places it from the template; the feature copy gets it from the seed log (memorial_seed.js offset 0.5, 1.6, 0.5).
  const entities = feature ? [] : [{ id: "lothlorien:memorial_sound", x: 0.5, y: 5.6, z: 3.5 }];
  if (feature) put(...MEMORIAL_FEATURE.seedAt, MEMORIAL_FEATURE.seed);
  return { blocks, flowers, seats, entities, leaf, ground, skirt };
}

export function memorialWorldgen() {
  return {
    template_pools: { format_version: "1.21.100", "minecraft:template_pool": {
      description: { identifier: "lothlorien:memorial" },
      elements: [{ element: { element_type: "minecraft:single_pool_element",
        location: MEMORIAL.id.replace(":", "/") }, weight: 1 }],
    } },
    structures: { format_version: "1.21.100", "minecraft:jigsaw": {
      description: { identifier: "lothlorien:memorial" },
      biome_filters: [{ test: "has_biome_tag", value: "lothlorien" }],
      step: "surface_structures", terrain_adaptation: "none",
      start_pool: "lothlorien:memorial", start_jigsaw_name: MEMORIAL.anchor,
      max_depth: 1, start_height: { type: "constant", value: { absolute: MEMORIAL.start } },
      heightmap_projection: "world_surface", max_distance_from_center: { horizontal: 32, vertical: 32 },
    } },
  };
}
