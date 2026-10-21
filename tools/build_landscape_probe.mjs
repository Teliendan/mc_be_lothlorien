// Native, command-only grouping probe. Does not change natural placement sets.
import { mkdirSync, readFileSync, writeFileSync, realpathSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure, CHOSEN, VARIANTS } from "./build_structures.mjs";
import { buildFletMallorn } from "./flet_mallorn.mjs";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { furnishWatchCamp } from "./watch_camp.mjs";
import { buildRootShrine } from "./root_shrine.mjs";
import { GARDEN, buildFlowerGarden } from "./flower_garden.mjs";
import { MEMORIAL, buildMemorial } from "./memorial.mjs";

const mod = join(dirname(fileURLToPath(import.meta.url)), "..");
const bp = join(mod, "lothlorien_bp");
const EMPTY = "minecraft:empty";
export const PROBE = Object.freeze({
  anchor: "lothlorien:village_anchor", join: "lothlorien:landscape_join",
  smallJoin: "lothlorien:landscape_small_join",
  trees: "lothlorien:landscape_probe/trees", ends: "lothlorien:landscape_probe/ends",
  treeSpacer: "lothlorien:landscape_probe/tree_spacer",
  smallSpacer: "lothlorien:landscape_probe/small_spacer",
  treeSpacerJoin: "lothlorien:landscape_tree_spacer_join",
  smallSpacerJoin: "lothlorien:landscape_small_spacer_join",
  spacerLength: 40, treeDistance: 80, groupClearance: 64,
  horizontal: 116, margin: 12, separation: 20, spacing: 42,
});
const key = (x, y, z) => `${x},${y},${z}`;
const jigsaw = (facing, name, pool, target = name, finalState = "minecraft:air") => ({
  name: "minecraft:jigsaw", states: { facing_direction: facing, rotation: 0 },
  jigsaw: name, jigsawPool: pool, jigsawTarget: target, finalState,
});

// Copy accepted builders rather than clipping blocks or changing their geometry.
// Whole rectangular boxes reserve roots, air-clearing cells and empty headroom.
export function probePieces() {
  const pieces = [];
  const wrap = (name, source, size, offset, entities = [], ordinary = false, weight = 1) => {
    const blocks = new Map(source);
    // The probe shares the village's -17 start height. Pad the tree/small-build
    // boxes down to -18 without adding a foundation or altering the real roots.
    const sx = size[0], sz = size[2], ox = offset[0], oz = offset[2];
    const ymin = -18, ymax = size[1] - offset[1] - 1;
    const x0 = -ox, x1 = sx - ox - 1, z0 = -oz, z1 = sz - oz - 1;
    const cx = sx === 40 ? 1 : 0, cz = sz === 40 ? 1 : 0;
    for (const [x, z, facing] of [[cx, z0, 2], [x1, cz, 5], [cx, z1, 3], [x0, cz, 4]]) {
      const k = key(x, 0, z);
      if (blocks.has(k) && blocks.get(k).name !== "minecraft:air")
        throw new Error(`${name}: connector would replace accepted art at ${k}`);
      blocks.set(k, jigsaw(facing, ordinary ? PROBE.join : PROBE.smallJoin, EMPTY, EMPTY));
    }
    pieces.push({ name, blocks, source, size: [sx, ymax - ymin + 1, sz],
      offset: [ox, -ymin, oz], weight, ordinary,
      entities: entities.map(e => ({ ...e, x: e.x + ox, y: e.y - ymin, z: e.z + oz })) });
  };
  for (const [variant, seed, weight] of CHOSEN) {
    const tree = buildFletMallorn(makeRandom(seed * 7919), VARIANTS[variant]);
    const entities = furnishWatchCamp(tree);
    wrap(`tree_${variant}_${String(seed).padStart(2, "0")}`, tree.blocks,
      [40, 54, 40], [18, 6, 18], entities, true, variant === "round" ? 6 : 5);
  }
  wrap("root_shrine", buildRootShrine().blocks, [40, 54, 40], [18, 6, 18]);
  wrap("garden", buildFlowerGarden().blocks, GARDEN.size, GARDEN.offset);
  wrap("memorial", buildMemorial().blocks, MEMORIAL.size, MEMORIAL.offset);
  // A woodland group has exactly two ordinary giants and two smaller places.
  // Root connectors occupy three different exterior faces, so the child boxes
  // cannot collide with the root or each other, in any permitted quarter turn.
  for (const p of pieces.filter(p => p.ordinary)) {
    const blocks = new Map(p.blocks);
    blocks.set(key(1, 0, -18), jigsaw(2, PROBE.join, PROBE.treeSpacer, PROBE.treeSpacerJoin));
    blocks.set(key(21, 0, 1), jigsaw(5, PROBE.smallJoin, PROBE.smallSpacer, PROBE.smallSpacerJoin));
    blocks.set(key(-18, 0, 1), jigsaw(4, PROBE.smallJoin, PROBE.smallSpacer, PROBE.smallSpacerJoin));
    blocks.set(key(1, -18, 1), jigsaw(0, PROBE.anchor, EMPTY, EMPTY, "minecraft:dirt"));
    pieces.push({ ...p, name: `root_${p.name}`, blocks, root: true });
  }
  // Native invisible links reserve a narrow corridor without filling it. Only
  // the two jigsaw cells are written and both resolve to air; all intermediate
  // cells are structure void, preserving the existing terrain and vegetation.
  // root (depth 0) -> spacer (1) -> complete build (2), within the existing depth.
  for (const [name, incoming, outgoing, pool] of [
    ["tree_spacer", PROBE.treeSpacerJoin, PROBE.join, PROBE.trees],
    ["small_spacer", PROBE.smallSpacerJoin, PROBE.smallJoin, PROBE.ends],
  ]) {
    const blocks = new Map([
      [key(0, 0, PROBE.spacerLength - 1), jigsaw(3, incoming, EMPTY, EMPTY)],
      [key(0, 0, 0), jigsaw(2, EMPTY, pool, outgoing)],
    ]);
    pieces.push({ name, blocks, source: new Map(), size: [1, 1, PROBE.spacerLength],
      offset: [0, 0, 0], weight: 1, entities: [], spacer: true });
  }
  return pieces;
}

const element = (location, weight, projection = "rigid") => ({ element: {
  element_type: "minecraft:single_pool_element", location, projection,
}, weight });
const asset = name => `lothlorien/landscape_probe/${name}`;
export function probeDefinitions(pieces) {
  const pool = (identifier, elements, fallback) => ({ format_version: "1.21.100",
    "minecraft:template_pool": { description: { identifier }, elements,
      ...(fallback ? { fallback } : {}) } });
  const original = JSON.parse(readFileSync(join(bp, "worldgen/structures/elven_village.json"), "utf8"));
  const structure = (identifier, start_pool) => ({ ...original, "minecraft:jigsaw": {
    ...original["minecraft:jigsaw"], description: { identifier }, start_pool,
  } });
  return {
    "template_pools/landscape_probe_tree_spacer.json": pool(PROBE.treeSpacer,
      [element(asset("tree_spacer"), 1, "terrain_matching")]),
    "template_pools/landscape_probe_small_spacer.json": pool(PROBE.smallSpacer,
      [element(asset("small_spacer"), 1, "terrain_matching")]),
    "template_pools/landscape_probe_trees.json": pool(PROBE.trees,
      pieces.filter(p => p.ordinary && !p.root).map(p => element(asset(p.name), p.weight))),
    "template_pools/landscape_probe_ends.json": pool(PROBE.ends,
      [element(asset("garden"), 1), element(asset("root_shrine"), 1), element(asset("memorial"), 1)]),
    "template_pools/landscape_probe_woodland.json": pool("lothlorien:landscape_probe/woodland",
      pieces.filter(p => p.root).map(p => element(asset(p.name), p.weight))),
    "template_pools/landscape_probe_start.json": pool("lothlorien:landscape_probe/start",
      [element("lothlorien/village/central_mallorn_01", 32),
        ...pieces.filter(p => p.root).map(p => element(asset(p.name), p.weight * 2))]),
    "structures/woodland_group_probe.json": structure("lothlorien:woodland_group_probe", "lothlorien:landscape_probe/woodland"),
    "structures/landscape_probe.json": structure("lothlorien:landscape_probe", "lothlorien:landscape_probe/start"),
  };
}

export function writeProbe() {
  // Retire the failed control: 1.26.52 registers template locations globally
  // and rejects using one asset with different projections in separate pools.
  for (const path of ["structures/woodland_group_rigid_control.json",
    "template_pools/landscape_probe_tree_spacer_rigid.json",
    "template_pools/landscape_probe_small_spacer_rigid.json"]) {
    const file = join(bp, "worldgen", path);
    if (existsSync(file)) unlinkSync(file);
  }
  const pieces = probePieces();
  const write = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
  for (const p of pieces) {
    const { buffer, clipped } = toMcstructure(p.blocks, p.size, p.offset, p.entities);
    if (clipped) throw new Error(`${p.name}: ${clipped} clipped blocks`);
    write(join(bp, "structures", asset(p.name) + ".mcstructure"), buffer);
  }
  for (const [path, data] of Object.entries(probeDefinitions(pieces)))
    write(join(bp, "worldgen", path), JSON.stringify(data, null, 2) + "\n");
  console.log(`Native landscape probe: ${pieces.length} whole templates; command-only, no natural sets changed.`);
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) writeProbe();
