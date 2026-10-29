// Shared builders for the natural `structure_template_feature` garden and memorial and the one lattice that places both
// (docs/FLOWER_GARDEN.md, docs/MEMORIAL.md). Semantics follow Microsoft Learn and the vanilla sulfur springs.

// Terrain the clearance may carve or the soil may replace; nothing built, no water, logs or leaves.
// Template cells (explicit air included) must all meet one of these, so lakes, shores, trees and builds refuse the site.
export const SITE_ALLOWLIST = Object.freeze([
  "minecraft:air",
  "minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:dirt_with_roots",
  "minecraft:gravel", "minecraft:sand", "minecraft:clay", "minecraft:moss_block",
  "minecraft:stone", "minecraft:granite", "minecraft:diorite", "minecraft:andesite",
  "minecraft:coal_ore", "minecraft:iron_ore", "minecraft:copper_ore",
  "minecraft:short_grass", "minecraft:fern", "minecraft:leaf_litter",
  "lothlorien:elanor", "lothlorien:niphredil", "lothlorien:athelas", "lothlorien:golden_fern",
]);

// The tuned configuration (simulated before the 2026-10-28 game test): ground_level is the grass/deck row (the layer that replaces
// the terrain top block), the rule y is that top block, and max_steepness 2 gives a symmetric +-1 band.
export const SITE_STEEPNESS = 2;

export function siteFeature({ identifier, structure, groundLevel, adjustmentRadius }) {
  return {
    format_version: "1.26.30",
    "minecraft:structure_template_feature": {
      description: { identifier },
      structure_name: structure,
      adjustment_radius: adjustmentRadius,
      facing_direction: "random",
      ground_level: groundLevel,
      rotate_around_center: true,
      constraints: {
        grounded: {},
        unburied: {},
        leveled: { max_steepness: SITE_STEEPNESS },
        block_intersection: {
          only_check_intersection_for_motion_blocking_blocks: false,
          block_allowlist: [...SITE_ALLOWLIST],
        },
      },
    },
  };
}

// Shuffled lattice (owner 2026-10-28: the plain lattice read as a fixed grid). Each cell of `cell` x `cell` chunks has one
// candidate chunk at a scrambled index 0..cell-2 per axis, so candidates in neighbouring cells stay at least 2 chunks
// (32 blocks) apart. A feature rule sees no world seed and no other chunk, so the scramble is a fixed function of the cell
// position (the same layout in every world): t = (a cx + b cz + c) mod 97, index = (t^2 mod 97) mod (cell - 1). All values stay
// small integers, exact in Molang floats for |cx|, |cz| below ~150000 cells.
export const SHUFFLE = Object.freeze({ x: [31, 17, 7], z: [13, 29, 41], prime: 97 });
export function shuffledLatticeIterations(cell) {
  const c = (ax) => `math.floor(variable.origin${ax} / ${16 * cell})`;
  const pmod = (e, m) => `math.mod(math.mod(${e}, ${m}) + ${m}, ${m})`;
  const pick = ([a, b, k]) => `math.mod(math.mod(math.pow(${pmod(`${a} * ${c("x")} + ${b} * ${c("z")} + ${k}`, SHUFFLE.prime)}, 2), ${SHUFFLE.prime}), ${cell - 1})`;
  const idx = (ax) => `(variable.origin${ax} / 16 - ${cell} * ${c(ax)})`;
  return `(${idx("x")} == ${pick(SHUFFLE.x)} && ${idx("z")} == ${pick(SHUFFLE.z)}) ? 1 : 0`;
}
// The same choice in JavaScript (tests, test instructions): chunk index of the candidate in cell (cx, cz).
export function shuffledPick(cell, cx, cz) {
  const pmod = (v, m) => ((v % m) + m) % m;
  const pick = ([a, b, k]) => ((pmod(a * cx + b * cz + k, SHUFFLE.prime) ** 2) % SHUFFLE.prime) % (cell - 1);
  return [cell * cx + pick(SHUFFLE.x), cell * cz + pick(SHUFFLE.z)];
}

// Gardens and memorials share the lattice (owner 2026-10-28): one site per cell, a weighted pick of garden or memorial 1:1, so
// two sites are always >= 32 blocks apart and never compete for a chunk. Chance 2/5 keeps each at the agreed ~24 per km2
// (round 1: 117 gardens per km2 at chance 1, acceptance ~0.5). A refused pick (water, slope, trees) places nothing.
// Centre extent [7, 8] (the upper bound is exclusive, so always 7) keeps both boxes in one chunk: garden half 6 + radius 1,
// memorial rotated half 7 + radius 0.
export const SITES = Object.freeze({
  select: "lothlorien:site_select_feature", rule: "lothlorien:site_feature_rules",
  features: Object.freeze([["lothlorien:flower_garden_feature", 1], ["lothlorien:memorial_feature", 1]]),
  lattice: 4, chance: Object.freeze({ numerator: 2, denominator: 5 }), extent: Object.freeze([7, 8]),
  files: Object.freeze({ select: "features/site_select_feature.json", rule: "feature_rules/site_feature_rules.json" }),
  retired: Object.freeze(["feature_rules/flower_garden_feature_rules.json", "feature_rules/memorial_feature_rules.json"]),
});
export function siteSelectFeature() {
  return { format_version: "1.26.30", "minecraft:weighted_random_feature": {
    description: { identifier: SITES.select }, features: SITES.features.map(([id, w]) => [id, w]),
  } };
}
// Chance 1 must be written as no scatter_chance: the engine drops a rule whose numerator >= denominator.
export function siteFeatureRule() {
  return { format_version: "1.13.0", "minecraft:feature_rules": {
    description: { identifier: SITES.rule, places_feature: SITES.select },
    conditions: {
      placement_pass: "before_surface_pass",
      "minecraft:biome_filter": [{ test: "has_biome_tag", value: "lothlorien" }],
    },
    distribution: {
      iterations: shuffledLatticeIterations(SITES.lattice),
      ...(SITES.chance.numerator < SITES.chance.denominator ? { scatter_chance: { ...SITES.chance } } : {}),
      x: { distribution: "uniform", extent: [...SITES.extent] },
      y: "query.heightmap(variable.worldx, variable.worldz) - 1",
      z: { distribution: "uniform", extent: [...SITES.extent] },
    },
  } };
}
