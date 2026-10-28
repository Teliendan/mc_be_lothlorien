// Shared builders for the natural `structure_template_feature` garden and the command-only memorial feature.
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
