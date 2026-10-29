// node tools/build_flower_garden.mjs [--preview]
import { writeFileSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure } from "./build_structures.mjs";
import { GARDEN, GARDEN_FILES, buildFlowerGarden, flowerGardenFeature, flowerGardenLoot } from "./flower_garden.mjs";
import { SITES, siteFeatureRule, siteSelectFeature } from "./site_feature.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export function writeFlowerGarden() {
  const garden = buildFlowerGarden(), bp = join(root, "lothlorien_bp");
  const { buffer, clipped } = toMcstructure(garden.blocks, GARDEN.size, GARDEN.offset);
  if (clipped) throw new Error(`flower garden clips ${clipped} blocks`);
  const write = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
  write(join(bp, "structures", "lothlorien", "flower_garden_01.mcstructure"), buffer);
  write(join(bp, GARDEN.loot), JSON.stringify(flowerGardenLoot(), null, 2) + "\n");
  // Natural feature, plus the shared garden/memorial site pick and rule; jigsaw files and per-feature rules are retired.
  write(join(bp, GARDEN_FILES.feature), JSON.stringify(flowerGardenFeature(), null, 2) + "\n");
  write(join(bp, SITES.files.select), JSON.stringify(siteSelectFeature(), null, 2) + "\n");
  write(join(bp, SITES.files.rule), JSON.stringify(siteFeatureRule(), null, 2) + "\n");
  for (const f of [...GARDEN_FILES.retired, ...SITES.retired]) rmSync(join(bp, f), { force: true });
  console.log(`${GARDEN.id}: ${buffer.length} bytes, four flower beds and one supply barrel; feature and shared site rule written`);
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
