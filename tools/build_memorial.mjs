// node tools/build_memorial.mjs [--preview]
import { mkdirSync, writeFileSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { placeEntities, toMcstructure } from "./build_structures.mjs";
import { MEMORIAL, MEMORIAL_FEATURE, MEMORIAL_FILES, buildMemorial, memorialFeature, memorialFeatureRule, memorialWorldgen } from "./memorial.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export function writeMemorial() {
  const memorial = buildMemorial();
  const { buffer, clipped } = toMcstructure(memorial.blocks, MEMORIAL.size, MEMORIAL.offset, placeEntities(memorial.entities, MEMORIAL.offset));
  if (clipped) throw new Error(`memorial clips ${clipped} blocks`);
  const dir = join(root, "lothlorien_bp", "structures", "lothlorien");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "memorial_leaf_01.mcstructure"), buffer);
  for (const [kind, data] of Object.entries(memorialWorldgen())) {
    const worldgenDir = join(root, "lothlorien_bp", "worldgen", kind);
    mkdirSync(worldgenDir, { recursive: true });
    writeFileSync(join(worldgenDir, "memorial.json"), JSON.stringify(data, null, 2) + "\n");
  }
  // The jigsaw stays for /place structure; natural memorials come from the feature rule (retired sets removed).
  for (const file of [...MEMORIAL_FILES.retired, "worldgen/structure_sets/garden_sites.json"])
    rmSync(join(root, "lothlorien_bp", file), { force: true });
  // Natural feature copy and its rule.
  const copy = buildMemorial({ feature: true });
  const encoded = toMcstructure(copy.blocks, MEMORIAL_FEATURE.size, MEMORIAL_FEATURE.offset, placeEntities(copy.entities, MEMORIAL_FEATURE.offset));
  if (encoded.clipped) throw new Error(`memorial feature clips ${encoded.clipped} blocks`);
  writeFileSync(join(dir, MEMORIAL_FEATURE.id.split(":")[1] + ".mcstructure"), encoded.buffer);
  mkdirSync(join(root, "lothlorien_bp", "features"), { recursive: true });
  mkdirSync(join(root, "lothlorien_bp", "feature_rules"), { recursive: true });
  writeFileSync(join(root, "lothlorien_bp", MEMORIAL_FILES.feature), JSON.stringify(memorialFeature(), null, 2) + "\n");
  writeFileSync(join(root, "lothlorien_bp", MEMORIAL_FILES.rule), JSON.stringify(memorialFeatureRule(), null, 2) + "\n");
  console.log(`${MEMORIAL.id}: ${buffer.length} bytes, leaf deck, banner pillar and two benches`);
  return memorial;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const memorial = writeMemorial();
  if (process.argv.includes("--preview")) {
    const { renderBlocks } = await import("./textured_render.mjs");
    const dir = join(root, "..", "..", "temp", "memorial");
    mkdirSync(dir, { recursive: true });
    for (const rot of [0, 1, 2, 3]) renderBlocks(memorial.blocks, join(dir, `leaf-${rot}.png`),
      { ppb: 42, rot, bg: [191, 207, 213] });
  }
}
