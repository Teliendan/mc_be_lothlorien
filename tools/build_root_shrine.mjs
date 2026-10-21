// node tools/build_root_shrine.mjs [--preview] (from the Lothlorien repo).
import { writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { giantMallornPool, writeRootShrineFiles } from "./build_structures.mjs";
import { buildRootShrine } from "./root_shrine.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export function writeRootShrine() {
  const bp = join(root, "lothlorien_bp");
  const shrine = writeRootShrineFiles(bp);
  mkdirSync(join(bp, "worldgen", "template_pools"), { recursive: true });
  writeFileSync(join(bp, "worldgen", "template_pools", "giant_mallorn.json"), JSON.stringify(giantMallornPool(), null, 2) + "\n");
  return shrine;
}

export async function previewRootShrine(shrine = buildRootShrine()) {
  const { renderBlocks } = await import("./textured_render.mjs");
  const dir = join(root, "..", "..", "temp", "root-shrine");
  mkdirSync(dir, { recursive: true });
  // Plain review ground is preview-only; never written into the structure.
  const review = new Map(shrine.blocks);
  for (let x = -11; x <= 13; x++) for (let z = -12; z <= 13; z++) {
    const k = `${x},-1,${z}`;
    if (!review.has(k)) review.set(k, { name: "minecraft:grass_block", states: {} });
  }
  for (const rot of [1, 2]) {
    renderBlocks(review, join(dir, `full-${rot}.png`), { ppb: 15, rot, bg: [191, 207, 213] });
    const detail = new Map([...review].filter(([k]) => {
      const [x, y, z] = k.split(",").map(Number);
      return x >= -5 && x <= 7 && y >= -1 && y <= 8 && z >= -9 && z <= 5;
    }));
    renderBlocks(detail, join(dir, `roots-${rot}.png`), { ppb: 35, rot, bg: [191, 207, 213] });
  }
  const cutaway = new Map([...review].filter(([k]) => {
    const [x, y, z] = k.split(",").map(Number);
    return x >= -4 && x <= 5 && y >= -1 && y <= 3 && z >= -8 && z <= 0 && !(y === 3 && z <= -1);
  }));
  renderBlocks(cutaway, join(dir, "cutaway.png"), { ppb: 45, rot: 2, bg: [191, 207, 213] });
  console.log("Preview PNGs written to temp/root-shrine (root/detail/cutaway crops are preview only).");
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const shrine = writeRootShrine();
  if (process.argv.includes("--preview")) await previewRootShrine(shrine);
}
