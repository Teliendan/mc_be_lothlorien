// Temporary native-worldgen experiment in the main BP. No structure/art edits.
// node tools/build_tree_grid_test.mjs          enable the dense 10/19/33/18 grid (village 1 in 8)
// node tools/build_tree_grid_test.mjs --restore restore the original tree-only set
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mod = join(dirname(fileURLToPath(import.meta.url)), "..");
const bp = join(mod, "lothlorien_bp");
export const TREE_GRID_KINDS = Object.freeze([
  { id: "village", structure: "lothlorien:elven_village", weight: 10 },
  { id: "platform", structure: "lothlorien:tree_grid_platform", weight: 19 },
  { id: "plain", structure: "lothlorien:tree_grid_plain", weight: 33 },
  { id: "shrine", structure: "lothlorien:tree_grid_shrine", weight: 18 },
]);
export const TREE_GRID_PLACEMENT = Object.freeze({
  type: "minecraft:random_spread", salt: 518204731, separation: 2, spacing: 6, spread_type: "linear",
});
export const TREE_GRID_SET = "worldgen/structure_sets/giant_mallorn.json";
const json = path => JSON.parse(readFileSync(join(bp, path), "utf8"));

export function treeGridDefinitions() {
  const legacy = json("worldgen/template_pools/giant_mallorn.json")["minecraft:template_pool"];
  const giant = json("worldgen/structures/giant_mallorn.json");
  const categories = { platform: [], plain: [], shrine: [] };
  for (const entry of legacy.elements) {
    const location = entry.element.location;
    const kind = location.startsWith("lothlorien/mallorn_roundplain_") ? "plain"
      : location.startsWith("lothlorien/mallorn_round_") ? "platform"
      : location === "lothlorien/root_shrine_01" ? "shrine" : null;
    if (!kind) throw new Error(`unclassified legacy tree asset: ${location}`);
    categories[kind].push(structuredClone(entry));
  }
  const definitions = {
    [TREE_GRID_SET]: { format_version: "1.21.100", "minecraft:structure_set": {
      description: { identifier: "lothlorien:giant_mallorn" }, placement: { ...TREE_GRID_PLACEMENT },
      structures: TREE_GRID_KINDS.map(({ structure, weight }) => ({ structure, weight })),
    } },
  };
  for (const kind of TREE_GRID_KINDS.filter(k => k.id !== "village")) {
    if (!categories[kind.id].length) throw new Error(`empty tree category ${kind.id}`);
    const name = kind.structure.split(":")[1];
    definitions[`worldgen/template_pools/${name}.json`] = { format_version: "1.21.100", "minecraft:template_pool": {
      description: { identifier: kind.structure }, elements: categories[kind.id],
    } };
    const definition = structuredClone(giant);
    definition["minecraft:jigsaw"].description.identifier = kind.structure;
    definition["minecraft:jigsaw"].start_pool = kind.structure;
    definitions[`worldgen/structures/${name}.json`] = definition;
  }
  // Village keeps its own existing start pool/anchor, depth 2 and surface offset;
  // all tree categories retain the original giant height/anchor/depth instead.
  return definitions;
}

export function writeTreeGridTest({ restore = false } = {}) {
  const definitions = treeGridDefinitions();
  if (restore) {
    definitions[TREE_GRID_SET]["minecraft:structure_set"].structures = [{ structure: "lothlorien:giant_mallorn", weight: 1 }];
    for (const path of Object.keys(definitions).filter(path => path !== TREE_GRID_SET)) {
      const file = join(bp, path);
      if (existsSync(file)) unlinkSync(file);
      delete definitions[path];
    }
  }
  for (const [path, definition] of Object.entries(definitions)) {
    const file = join(bp, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(definition, null, 2) + "\n");
  }
  console.log(restore ? "Original tree/shrine selection restored; gardens and memorials retain their separate grids."
    : "Dense tree-grid test enabled: village/platform/plain/shrine 10/19/33/18; gardens and memorials share their own grid.");
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args.some(a => a !== "--restore")) throw new Error("usage: node tools/build_tree_grid_test.mjs [--restore]");
  writeTreeGridTest({ restore: args.includes("--restore") });
}
