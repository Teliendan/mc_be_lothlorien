// Shared builders for the natural `structure_template_feature` garden and memorial.
// TEST BUILD 2026-10-28 (docs/GARDEN_FEATURE_TEST.md). Semantics follow Microsoft Learn and the vanilla sulfur springs.

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

// The "tuned" configuration of temp/garden-features/SIMULATION.md: ground_level is the grass/deck row (the layer that replaces
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
// Each feature passes its own constants so two features on the same lattice rarely pick the same chunk.
export const SHUFFLE = Object.freeze({ x: [31, 17, 7], z: [13, 29, 41], prime: 97 });
export function shuffledLatticeIterations(cell, shuffle = SHUFFLE) {
  const c = (ax) => `math.floor(variable.origin${ax} / ${16 * cell})`;
  const pmod = (e, m) => `math.mod(math.mod(${e}, ${m}) + ${m}, ${m})`;
  const pick = ([a, b, k]) => `math.mod(math.mod(math.pow(${pmod(`${a} * ${c("x")} + ${b} * ${c("z")} + ${k}`, shuffle.prime)}, 2), ${shuffle.prime}), ${cell - 1})`;
  const idx = (ax) => `(variable.origin${ax} / 16 - ${cell} * ${c(ax)})`;
  return `(${idx("x")} == ${pick(shuffle.x)} && ${idx("z")} == ${pick(shuffle.z)}) ? 1 : 0`;
}
// The same choice in JavaScript (tests, test instructions): chunk index of the candidate in cell (cx, cz).
export function shuffledPick(cell, cx, cz, shuffle = SHUFFLE) {
  const pmod = (v, m) => ((v % m) + m) % m;
  const pick = ([a, b, k]) => ((pmod(a * cx + b * cz + k, shuffle.prime) ** 2) % shuffle.prime) % (cell - 1);
  return [cell * cx + pick(shuffle.x), cell * cz + pick(shuffle.z)];
}
