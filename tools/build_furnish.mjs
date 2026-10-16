// Home furnishing structures (M7 showcase WP4b): one 1 x 1 x 1 .mcstructure per banner design and facing. The Script API cannot set banner patterns,
// so elf_village.js furnishHome places these with world.structureManager.place (ids from home_furnish.js bannerStructure).
// Run from mods/lothlorien: node tools/build_furnish.mjs   (writes lothlorien_bp/structures/lothlorien/furnish/banner_<design>_<facing>.mcstructure)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure } from "./build_structures.mjs";
import { BANNER_DESIGNS, bannerStructure } from "../lothlorien_bp/scripts/home_furnish.js";

const FACING_ID = { north: 2, south: 3, west: 4, east: 5 };
export function bannerStructures() {
  const out = [];
  for (const [design, spec] of Object.entries(BANNER_DESIGNS)) for (const [facing, id] of Object.entries(FACING_ID)) {
    const blocks = new Map([["0,0,0", { name: "minecraft:wall_banner", states: { facing_direction: id }, banner: spec }]]);
    out.push({ file: `banner_${design}_${facing}.mcstructure`, id: bannerStructure(design, facing), buffer: toMcstructure(blocks, [1, 1, 1], [0, 0, 0]).buffer });
  }
  return out;
}
if (process.argv[1] && process.argv[1].endsWith("build_furnish.mjs")) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp", "structures", "lothlorien", "furnish");
  mkdirSync(dir, { recursive: true });
  for (const s of bannerStructures()) { writeFileSync(join(dir, s.file), s.buffer); console.log(`${s.id}: ${s.buffer.length} bytes`); }
}
