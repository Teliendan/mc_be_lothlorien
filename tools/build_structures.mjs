// Writes the giant Mallorn structures:
//   node tools/build_structures.mjs
//      the worldgen set: the trees in CHOSEN plus the root shrine (other giant variants are removed)
//   node tools/build_structures.mjs <variant|all> [count] [firstSeed]      (defaults 8 1)
//      curation candidates for the dev-only showcase (tools/dev_scripts/showcase.js); they replace that variant's files but never
//      enter worldgen. Run the plain command again before committing, so the pack keeps only CHOSEN.
// -> lothlorien_bp/structures/lothlorien/mallorn_<variant>_NN.mcstructure (id lothlorien:mallorn_<variant>_NN)
//    and worldgen/template_pools/giant_mallorn.json (legacy pool: 75% trees, 25% shrine) for the jigsaw structure
//    lothlorien:giant_mallorn. The natural set (village/platform/plain/shrine) is written by build_tree_grid.mjs from this pool. A plain structure
//    feature was cut at chunk borders; jigsaw structures may span chunks.
// Tree NN of every variant uses the same seed, so round_07 and roundplain_07 share their trunk and height.
// Each file is SIZE x SIZE_Y x SIZE with the trunk centred horizontally (cells TRUNK_AT..TRUNK_AT+3) and the
// first block above the ground at y ROOT_DEPTH; cells the tree does not fill are structure void, so the
// terrain and plants around it survive. Keep TRUNK_AT / ROOT_DEPTH in step with tools/dev_scripts/showcase.js and
// with start_height (-ROOT_DEPTH) in worldgen/structures/giant_mallorn.json.
import { writeFileSync, mkdirSync, readdirSync, unlinkSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { buildFletMallorn, ROOT_DEPTH, bareBranchEnds } from "./flet_mallorn.mjs";
import { furnishWatchCamp, watchCampLoot } from "./watch_camp.mjs";
import { ANCHOR_AT, TRUNK_ANCHOR, anchorMallorn } from "./mallorn_anchor.mjs";
import { SHRINE, buildRootShrine, rootShrineLoot } from "./root_shrine.mjs";
export { ANCHOR_AT, TRUNK_ANCHOR };

export const SIZE = 40, SIZE_Y = 54, TRUNK_AT = 18;
import { placeEntities, toMcstructure } from "../../../.claude/skills/bedrock-worldgen/scripts/mcstructure.mjs";
export const toGiantMcstructure = (blocks, entities = []) => toMcstructure(blocks, [SIZE, SIZE_Y, SIZE], [TRUNK_AT, ROOT_DEPTH, TRUNK_AT], entities); // the giant-tree box

// Variants: options for buildFletMallorn. Add one here to experiment without touching the others.
export const VARIANTS = {
  round: { woven: true, lush: true, round: true }, // lookout tree: round trunk, platform, ladder, chest
  roundplain: { woven: true, lush: true, flet: false, round: true }, // plain giant
};

// Trees placed by world generation: variant + number (the number is the seed) + pool weight. Seeds picked in game 2026-09-29;
// the round trunk (2026-10-01) replaced the square one on the same seeds. These base weights retain the
// existing tree mix; giantMallornPool reserves one quarter of the unchanged placement attempts for shrines.
export const CHOSEN = [["round", 5, 2], ["round", 7, 2], ["roundplain", 2, 3], ["roundplain", 3, 3], ["roundplain", 6, 3], ["roundplain", 8, 3]];

// Worldgen flet giants hold a loot chest; planted nuts grow only the plain giants (great_mallorn_rules.js PLAIN_TREES).
export const CHEST_BLOCK = "minecraft:chest";
export const hasChest = (blocks) => [...blocks.values()].some((b) => b.name === CHEST_BLOCK);

const treeName = (variant, n) => `mallorn_${variant}_${String(n).padStart(2, "0")}`;

export function giantMallornPool() {
  const entry = (location, weight) => ({
    element: { element_type: "minecraft:single_pool_element", location }, weight,
  });
  const treeWeight = CHOSEN.reduce((sum, [, , weight]) => sum + weight, 0);
  return {
    format_version: "1.21.100",
    "minecraft:template_pool": {
      description: { identifier: "lothlorien:giant_mallorn" },
      elements: [
        ...CHOSEN.map(([v, n, weight]) => entry(`lothlorien/${treeName(v, n)}`, weight * 3)),
        entry(SHRINE.id.replace(":", "/"), treeWeight),
      ],
    },
  };
}

export function writeRootShrineFiles(bp) {
  const shrine = buildRootShrine();
  const { buffer, clipped } = toMcstructure(shrine.blocks, SHRINE.size, SHRINE.offset, placeEntities(shrine.entities, SHRINE.offset));
  if (clipped) throw new Error(`root shrine clips ${clipped} blocks`);
  mkdirSync(join(bp, "structures", "lothlorien"), { recursive: true });
  mkdirSync(join(bp, "loot_tables", "chests"), { recursive: true });
  writeFileSync(join(bp, "structures", "lothlorien", "root_shrine_01.mcstructure"), buffer);
  writeFileSync(join(bp, SHRINE.loot), JSON.stringify(rootShrineLoot(), null, 2) + "\n");
  console.log(`${SHRINE.id}: ${buffer.length} bytes, ground offset ${SHRINE.offset[1]}, 25% of legacy mixed-pool selections`);
  return shrine;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const [which, countArg, seedArg] = process.argv.slice(2);
  const bp = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp");
  const out = join(bp, "structures", "lothlorien");
  mkdirSync(out, { recursive: true });
  // removes the structure files of the given variants (and per-tree feature files from before 2026-09-30)
  const clean = (variants) => {
    const re = new RegExp(`^mallorn_(${variants.join("|")})_\\d\\d[._]`);
    for (const dir of [out, join(bp, "features")]) for (const f of readdirSync(dir)) if (re.test(f)) unlinkSync(join(dir, f));
  };
  const write = (variant, n) => {
    const tree = buildFletMallorn(makeRandom(n * 7919), VARIANTS[variant]);
    const campEntities = furnishWatchCamp(tree).map((e) => ({ ...e,
      x: e.x + TRUNK_AT, y: e.y + ROOT_DEPTH, z: e.z + TRUNK_AT,
    }));
    anchorMallorn(tree.blocks);
    const { buffer, clipped } = toGiantMcstructure(tree.blocks, campEntities);
    const name = treeName(variant, n);
    const bare = bareBranchEnds(tree.blocks); // every branch end carries >= 6 leaves within 2 (tuftBareEnds fixes the rest)
    if (bare.length) throw new Error(`${name}: bare branch end at ${bare.map((q) => `${q.x},${q.y},${q.z}`).join(" ")}`);
    writeFileSync(join(out, `${name}.mcstructure`), buffer);
    const tally = (t) => [...tree.blocks.values()].filter((b) => b.name.endsWith(t)).length;
    console.log(`${name}: height ${tree.height}, floor ${tree.floorY}, radius ${tree.radius.toFixed(1)}, ` +
      `${tally("_log")} logs, ${tally("_leaves")} leaves (${tree.trimmed} far leaves dropped), ${clipped} clipped, ${buffer.length} bytes`);
  };

  if (!which) {
    clean(Object.keys(VARIANTS));
    for (const [variant, n] of CHOSEN) write(variant, n);
  } else {
    const variants = which === "all" ? Object.keys(VARIANTS) : [which];
    for (const v of variants) if (!VARIANTS[v]) throw new Error(`unknown variant ${v}; known: ${Object.keys(VARIANTS).join(", ")}`);
    const count = parseInt(countArg, 10) || 8, firstSeed = parseInt(seedArg, 10) || 1;
    clean(variants);
    for (const v of variants) for (let n = firstSeed; n < firstSeed + count; n++) write(v, n);
    // worldgen must not lose a chosen tree that falls outside the candidate range
    for (const [v, n] of CHOSEN) if (variants.includes(v) && (n < firstSeed || n >= firstSeed + count)) write(v, n);
    console.log("candidates written; run `node tools/build_structures.mjs` before committing to keep only CHOSEN in the pack");
  }
  writeRootShrineFiles(bp);
  mkdirSync(join(bp, "worldgen", "template_pools"), { recursive: true });
  writeFileSync(join(bp, "worldgen", "template_pools", "giant_mallorn.json"), JSON.stringify(giantMallornPool(), null, 2) + "\n");
  console.log(`legacy mixed pool: 75% trees (${CHOSEN.map(([v, n]) => treeName(v, n)).join(", ")}), 25% root shrine; natural test-set selection is managed separately`);
  writeFileSync(join(bp, "loot_tables/chests/mallorn_flet.json"), JSON.stringify(watchCampLoot(), null, 2) + "\n");
}
