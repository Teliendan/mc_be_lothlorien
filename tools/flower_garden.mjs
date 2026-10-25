// Small, open woodland garden; only existing blocks and native deferred container loot.
import { addSoilSkirt, SKIRT } from "./ground_skirt.mjs";

// start offsets the template bottom from world_surface, not the named jigsaw's Y.
// Grass is at encoded y SKIRT.depth - 1: bury the foundation so grass replaces the terrain top
// (owner, 2026-10-24). The named jigsaw centres horizontal placement/rotation.
export const GARDEN = Object.freeze({
  id: "lothlorien:flower_garden_01", size: [15, 4 + SKIRT.depth, 15], offset: [7, SKIRT.depth, 7], start: 1 - SKIRT.depth, clear: 4,
  loot: "loot_tables/chests/flower_garden.json", barrel: [4, 0, 5],
  anchor: "lothlorien:garden_ground",
});

export function buildFlowerGarden() {
  const blocks = new Map(), flowers = [];
  const put = (x, y, z, name, states = {}, extra = {}) =>
    blocks.set(`${x},${y},${z}`, { name, states, ...extra });
  // A rounded soil patch supports the planting and grass aisles. Clear GARDEN.clear
  // cells above it; the rest of the template stays void, preserving the canopy.
  const footprint = new Set();
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
    if (Math.abs(x) === 5 && Math.abs(z) === 5) continue;
    put(x, -2, z, "minecraft:dirt");
    put(x, -1, z, "minecraft:grass_block");
    for (let y = 0; y < GARDEN.clear; y++) put(x, y, z, "minecraft:air");
    footprint.add(`${x},${z}`);
  }
  const bed = (x0, z0, species) => {
    // Six flowers in each bed, with half-height silver edging and cut corners.
    for (let x = x0; x < x0 + 3; x++) for (let z = z0; z < z0 + 2; z++) {
      const name = species[(x - x0 + z - z0) % species.length];
      put(x, 0, z, name, name.startsWith("lothlorien:") ? { "lothlorien:on_grass": false } : {});
      flowers.push([x, 0, z]);
    }
    const slab = (x, z) => put(x, 0, z, "lothlorien:mallorn_slab", { "minecraft:vertical_half": "bottom" });
    for (let x = x0; x < x0 + 3; x++) { slab(x, z0 - 1); slab(x, z0 + 2); }
    for (let z = z0; z < z0 + 2; z++) { slab(x0 - 1, z); slab(x0 + 3, z); }
  };
  bed(-4, -4, ["lothlorien:niphredil", "minecraft:lily_of_the_valley"]);
  bed(2, -4, ["minecraft:allium", "lothlorien:niphredil"]);
  bed(-4, 2, ["lothlorien:elanor", "minecraft:orange_tulip"]);
  bed(2, 2, ["minecraft:blue_orchid", "minecraft:cornflower"]);
  // Bench at the south rim, facing the broad central grass aisle.
  for (let x = -1; x <= 1; x++) put(x, 0, 5, "lothlorien:mallorn_stairs", {
    "minecraft:cardinal_direction": "south", "minecraft:vertical_half": "bottom", "minecraft:corner": "none",
  });
  for (const [x, facing] of [[-2, "east"], [2, "west"]]) put(x, 0, 5, "lothlorien:mallorn_trapdoor", {
    "minecraft:cardinal_direction": facing, "minecraft:vertical_half": "bottom", "lothlorien:open": true,
  });
  // An upright barrel beside the planting: lid exposed, reachable from the east
  // or the open bench side. No saplings are planted in the composition.
  put(5, -2, 5, "minecraft:dirt");
  put(5, -1, 5, "minecraft:grass_block");
  footprint.add("5,5");
  for (const x of [3, 4, 5]) for (let y = 0; y < GARDEN.clear; y++) put(x, y, 5, "minecraft:air");
  put(...GARDEN.barrel, "minecraft:barrel", { facing_direction: 1, open_bit: false }, { loot: GARDEN.loot });
  // Buried anchor keeps rotation centred and places the soil surface at ground.
  put(0, -2, 0, "minecraft:jigsaw", { facing_direction: 0, rotation: 0 }, {
    jigsaw: GARDEN.anchor, finalState: "minecraft:dirt",
  });
  // Deep soil under the patch and a ragged shoulder round it (tools/ground_skirt.mjs).
  const skirt = addSoilSkirt(put, (x, y, z) => blocks.has(`${x},${y},${z}`), footprint, { top: -1, seed: 11 });
  return { blocks, flowers, entities: [], footprint, skirt };
}

export function flowerGardenLoot() {
  const item = (name, min = 1, max = min) => ({ type: "item", name, weight: 1,
    functions: [{ function: "set_count", count: min === max ? min : { min, max } }] });
  return { pools: [
    { rolls: 1, entries: [item("lothlorien:mallorn_acorn", 2, 5)] },
    { rolls: 1, entries: [item("minecraft:bone_meal", 4, 8)] },
    { rolls: 2, entries: ["minecraft:allium", "minecraft:blue_orchid", "minecraft:cornflower",
      "minecraft:lily_of_the_valley", "lothlorien:elanor", "lothlorien:niphredil"].map((name) => item(name, 1, 3)) },
    { rolls: 1, entries: [item("minecraft:wooden_hoe")] },
    { rolls: 1, entries: [item("minecraft:shears")] },
  ] };
}

// Gardens and memorials share one grid (owner, 2026-10-21): each candidate places one of them, so the two never
// pair up. Spacing 9 / separation 3 keeps about the old combined count (1/81 per chunk² against 2/144 from two
// separate 12-chunk grids); neighbouring sites stay at least three chunks apart. Salt is the old garden one.
export const GARDEN_SITES = Object.freeze({ file: "worldgen/structure_sets/garden_sites.json", salt: 794231583, spacing: 9, separation: 3 });
export function gardenSitesSet() {
  return { format_version: "1.21.100", "minecraft:structure_set": {
    description: { identifier: "lothlorien:garden_sites" },
    placement: { type: "minecraft:random_spread", salt: GARDEN_SITES.salt,
      spacing: GARDEN_SITES.spacing, separation: GARDEN_SITES.separation, spread_type: "linear" },
    structures: [{ structure: "lothlorien:flower_garden", weight: 1 }, { structure: "lothlorien:memorial", weight: 1 }],
  } };
}

export function flowerGardenWorldgen() {
  return {
    template_pools: { format_version: "1.21.100", "minecraft:template_pool": {
      description: { identifier: "lothlorien:flower_garden" },
      elements: [{ element: { element_type: "minecraft:single_pool_element", location: GARDEN.id.replace(":", "/") }, weight: 1 }],
    } },
    structures: { format_version: "1.21.100", "minecraft:jigsaw": {
      description: { identifier: "lothlorien:flower_garden" },
      biome_filters: [{ test: "has_biome_tag", value: "lothlorien" }],
      step: "surface_structures", terrain_adaptation: "none",
      start_pool: "lothlorien:flower_garden", start_jigsaw_name: GARDEN.anchor,
      max_depth: 1, start_height: { type: "constant", value: { absolute: GARDEN.start } },
      heightmap_projection: "world_surface", max_distance_from_center: { horizontal: 32, vertical: 32 },
    } },
  };
}
