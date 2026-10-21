// Target 1.26.52: explicit vanilla tree families, not Java datapack tags or name suffix guesses.
const SPECIES = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "poplar"];
export const TREE_WOOD = new Set(SPECIES.flatMap(name => ["log", "wood", "stripped_log", "stripped_wood"]
  .map(form => `minecraft:${form.startsWith("stripped_") ? "stripped_" : ""}${name}_${form.replace("stripped_", "")}`))
  .concat(["log", "wood", "stripped_log", "stripped_wood"].map(form => `lothlorien:mallorn_${form}`)));
export const TREE_LEAVES = new Set(SPECIES.filter(name => name !== "poplar").map(name => `minecraft:${name}_leaves`)
  .concat(["minecraft:azalea_leaves", "minecraft:azalea_leaves_flowered", "minecraft:red_poplar_leaves",
    "minecraft:orange_poplar_leaves", "minecraft:yellow_poplar_leaves", "lothlorien:mallorn_leaves", "lothlorien:mallorn_golden_leaves"]));
export const SAPLING_SOILS = new Set(["grass_block", "dirt", "coarse_dirt", "podzol", "dirt_with_roots", "moss_block", "mud", "farmland", "mycelium"]
  .map(name => `minecraft:${name}`));
export function readTreeBlock(dimension, location) {
  try { return dimension.getBlock(location); } catch { return undefined; }
}
export function saplingSoil(block) {
  const { x, y, z } = block.location;
  return readTreeBlock(block.dimension, { x, y: y - 1, z });
}
export function validSaplingSoil(block) { return SAPLING_SOILS.has(saplingSoil(block)?.typeId); }
export function saplingLight(block) {
  const { x, y, z } = block.location;
  try { return readTreeBlock(block.dimension, { x, y: y + 1, z })?.getLightLevel() ?? 0; }
  catch { return 0; } // unreadable space postpones growth; never assume enough light
}
