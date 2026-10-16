// Home furnishing structures (M7 WP4b + phase 3): one-cell .mcstructure files that elf_village.js furnishHome places with world.structureManager.place, because the
// Script API cannot set a banner's patterns, a flower pot's plant or a cushion's colour:
//   banner_<design>_<facing>   a wall banner (4 designs x 4 facings)
//   pot_<plant>                a flower pot with its plant (block entity), or empty
//   cushion_<variant>          a native cushion actor on a structure void cell
// Run from mods/lothlorien: node tools/build_furnish.mjs   (writes lothlorien_bp/structures/lothlorien/furnish/*.mcstructure)
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure } from "./build_structures.mjs";
import { BANNER_DESIGNS, POT_PLANTS, CUSHION_VARIANTS, bannerStructure, potStructure, cushionStructure, potPlantBlock } from "../lothlorien_bp/scripts/home_furnish.js";

const FACING_ID = { north: 2, south: 3, west: 4, east: 5 };
const one = (block, entities = []) => toMcstructure(new Map([["0,0,0", block]]), [1, 1, 1], [0, 0, 0], entities).buffer;
export function furnishStructures() {
  const out = [];
  const add = (id, buffer) => out.push({ id, file: `${id.slice(id.indexOf("/") + 1)}.mcstructure`, buffer });
  for (const [design, spec] of Object.entries(BANNER_DESIGNS)) for (const [facing, id] of Object.entries(FACING_ID))
    add(bannerStructure(design, facing), one({ name: "minecraft:wall_banner", states: { facing_direction: id }, banner: spec }));
  for (const name of POT_PLANTS) add(potStructure(name), one({ name: "minecraft:flower_pot", states: { update_bit: false }, ...(potPlantBlock(name) ? { plant: potPlantBlock(name) } : {}) }));
  for (const v of CUSHION_VARIANTS) add(cushionStructure(v), one({ name: "minecraft:structure_void", states: {} }, [{ id: "minecraft:cushion", x: 0.5, y: 0, z: 0.5, variant: v, invulnerable: false }]));
  return out;
}
export const bannerStructures = furnishStructures; // the earlier name
if (process.argv[1] && process.argv[1].endsWith("build_furnish.mjs")) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp", "structures", "lothlorien", "furnish");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) unlinkSync(join(dir, f));
  for (const s of furnishStructures()) writeFileSync(join(dir, s.file), s.buffer);
  console.log(`${furnishStructures().length} furnishing structures written to ${dir}`);
}
