// node tools/build_memorial.mjs [--preview]
import { mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure } from "./build_structures.mjs";
import { MEMORIAL, buildMemorial, memorialWorldgen } from "./memorial.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export function writeMemorial() {
  const memorial = buildMemorial();
  const { buffer, clipped } = toMcstructure(memorial.blocks, MEMORIAL.size, MEMORIAL.offset);
  if (clipped) throw new Error(`memorial clips ${clipped} blocks`);
  const dir = join(root, "lothlorien_bp", "structures", "lothlorien");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "memorial_leaf_01.mcstructure"), buffer);
  for (const [kind, data] of Object.entries(memorialWorldgen())) {
    const worldgenDir = join(root, "lothlorien_bp", "worldgen", kind);
    mkdirSync(worldgenDir, { recursive: true });
    writeFileSync(join(worldgenDir, "memorial.json"), JSON.stringify(data, null, 2) + "\n");
  }
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
