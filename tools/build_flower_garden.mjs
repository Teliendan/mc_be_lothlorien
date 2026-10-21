// node tools/build_flower_garden.mjs [--preview]
import { writeFileSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure } from "./build_structures.mjs";
import { GARDEN, GARDEN_SITES, buildFlowerGarden, flowerGardenLoot, flowerGardenWorldgen, gardenSitesSet } from "./flower_garden.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export function writeFlowerGarden() {
  const garden = buildFlowerGarden(), bp = join(root, "lothlorien_bp");
  const { buffer, clipped } = toMcstructure(garden.blocks, GARDEN.size, GARDEN.offset);
  if (clipped) throw new Error(`flower garden clips ${clipped} blocks`);
  const write = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
  write(join(bp, "structures", "lothlorien", "flower_garden_01.mcstructure"), buffer);
  write(join(bp, GARDEN.loot), JSON.stringify(flowerGardenLoot(), null, 2) + "\n");
  for (const [kind, data] of Object.entries(flowerGardenWorldgen()))
    write(join(bp, "worldgen", kind, "flower_garden.json"), JSON.stringify(data, null, 2) + "\n");
  // One grid for gardens and memorials; their separate sets before 2026-10-21 are removed.
  write(join(bp, GARDEN_SITES.file), JSON.stringify(gardenSitesSet(), null, 2) + "\n");
  for (const f of ["flower_garden.json", "memorial.json"]) rmSync(join(bp, "worldgen", "structure_sets", f), { force: true });
  console.log(`${GARDEN.id}: ${buffer.length} bytes, four flower beds and one supply barrel`);
  return garden;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const garden = writeFlowerGarden();
  if (process.argv.includes("--preview")) {
    const { renderBlocks } = await import("./textured_render.mjs");
    const dir = join(root, "..", "..", "temp", "flower-garden");
    mkdirSync(dir, { recursive: true });
    for (const rot of [0, 2]) renderBlocks(garden.blocks, join(dir, `garden-${rot}.png`), { ppb: 36, rot, bg: [191, 207, 213] });
  }
}
