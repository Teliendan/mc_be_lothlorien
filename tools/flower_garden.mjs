// Small, open woodland garden; only existing blocks and native deferred container loot.
import { addSoilSkirt } from "./ground_skirt.mjs";
import { siteFeature } from "./site_feature.mjs";

// Natural `structure_template_feature` (TEST BUILD 2026-10-28). 13 x 13 centred box (beds and aisles +-5, one ragged shoulder ring
// to +-6), soil 3 deep (grass + 2 dirt), 4 free cells above the grass, no jigsaw anchor. Local y: grass row -1, planting 0..3.
// Encoded y 0 is local -3, so the grass row is encoded y 2 = ground_level. The rule puts the top terrain block (q.heightmap - 1)
// at ground_level, so the grass replaces the terrain top block (owner, 2026-10-24).
export const GARDEN = Object.freeze({
  id: "lothlorien:flower_garden_01", size: [13, 7, 13], offset: [6, 3, 6], groundLevel: 2, clear: 4,
  loot: "loot_tables/chests/flower_garden.json", barrel: [4, 0, 5],
  feature: "lothlorien:flower_garden_feature", rule: "lothlorien:flower_garden_feature_rules",
  adjustmentRadius: 1, soil: { depth: 3, ring2: false, seed: 11 },
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
  // Soil under the patch and a ragged one-step shoulder round it (tools/ground_skirt.mjs).
  const skirt = addSoilSkirt(put, (x, y, z) => blocks.has(`${x},${y},${z}`), footprint, { top: -1, ...GARDEN.soil });
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

export function flowerGardenFeature() {
  return siteFeature({ identifier: GARDEN.feature, structure: GARDEN.id, groundLevel: GARDEN.groundLevel,
    adjustmentRadius: GARDEN.adjustmentRadius });
}

// Files the garden builder writes (relative to the BP) and the retired jigsaw files it deletes.
export const GARDEN_FILES = Object.freeze({
  feature: "features/flower_garden_feature.json",
  retired: ["worldgen/structures/flower_garden.json", "worldgen/template_pools/flower_garden.json",
    "worldgen/structure_sets/flower_garden.json", "worldgen/structure_sets/garden_sites.json"],
});
