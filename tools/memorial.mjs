// Accepted leaf memorial. Existing assets, standalone woodland worldgen.
import { SILVER_WATCH } from "./watch_camp_rules.mjs";
import { addSoilSkirt, SKIRT } from "./ground_skirt.mjs";

// start: the jigsaw start height; the deck stands one above the terrain's top block (owner, Test G 2026-10-20: raised like the garden,
// with the same deep soil and ragged shoulder; clear: the free cells above the deck and apron).
export const MEMORIAL = Object.freeze({
  id: "lothlorien:memorial_leaf_01", size: [15, 6 + SKIRT.depth, 18], offset: [7, SKIRT.depth, 8], start: -1, clear: 4,
  anchor: "lothlorien:memorial_ground",
});
const L = "lothlorien:", M = "minecraft:";
const key = (x, y, z) => `${x},${y},${z}`;

export function buildMemorial() {
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
  for (const k of ground) {
    const [x, z] = k.split(",").map(Number);
    put(x, -2, z, M + "dirt");
    put(x, -1, z, M + "grass_block");
    for (let y = 0; y <= MEMORIAL.clear; y++) put(x, y, z, M + "air");
  }
  for (const k of leaf) {
    const [x, z] = k.split(",").map(Number);
    const edge = adjacent.some(([dx, dz]) => !leaf.has(`${x + dx},${z + dz}`));
    const wood = x === 0 ? "mallorn_heartwood" : "mallorn";
    put(x, 0, z, L + wood + (edge ? "_slab" : "_planks"),
      edge ? { "minecraft:vertical_half": "bottom" } : {});
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
  put(0, -2, 0, M + "jigsaw", { facing_direction: 0, rotation: 0 }, {
    jigsaw: MEMORIAL.anchor, finalState: M + "dirt",
  });
  // Deep soil under the apron and a ragged shoulder round it (tools/ground_skirt.mjs).
  const skirt = addSoilSkirt(put, (x, y, z) => blocks.has(key(x, y, z)), ground, { top: -1, seed: 23 });
  return { blocks, flowers, seats, entities: [], leaf, ground, skirt };
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
