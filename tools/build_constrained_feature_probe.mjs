// Isolated native feature bridge experiment. No scripted placement or production set edits.
import { mkdirSync, writeFileSync, existsSync, unlinkSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure, VARIANTS } from "./build_structures.mjs";
import { buildFletMallorn } from "./flet_mallorn.mjs";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";

const mod = join(dirname(fileURLToPath(import.meta.url)), "..");
const bp = join(mod, "lothlorien_feature_probe_bp");
const EMPTY = "minecraft:empty", PREFIX = "lothlorien:feature_probe";
const key = (x, y, z) => `${x},${y},${z}`;
const block = name => ({ name, states: {} });
export const FEATURE_PROBE = Object.freeze({
  size: [40, 54, 40], offset: [18, 6, 18], ground: 6,
  carrierSize: [41, 12, 41], carrierOffset: [20, 10, 20],
  obstacle: [18, 0, 18], airPlane: 4, commandY: 100, naturalY: 220,
  pillarNear: 16, pillarFar: 21, pillarBottom: 90, pillarTop: 110,
  anchor: "lothlorien:feature_probe_anchor", target: "lothlorien:feature_probe_target",
  naturalSet: "worldgen/structure_sets/feature_probe_natural.json",
});
export const CASES = Object.freeze([
  { id: "control", checked: false, obstacle: false, marker: "minecraft:gold_block", x: 8 },
  { id: "checked", checked: true, obstacle: false, marker: "minecraft:emerald_block", x: 136 },
  { id: "control_blocked", checked: false, obstacle: true, marker: "minecraft:lapis_block", x: 264 },
  { id: "checked_blocked", checked: true, obstacle: true, marker: "minecraft:redstone_block", x: 392 },
]);
// Revision 3 retains only the direct-template completeness control. The owner
// engine rejects list_pool_element, so the iron envelope case cannot load.
export const BOUNDS_CASES = Object.freeze([
  { id: "direct", marker: "minecraft:amethyst_block", x: 200 },
]);

export function featureProbePieces() {
  const source = buildFletMallorn(makeRandom(2 * 7919), VARIANTS.roundplain).blocks;
  const payload = new Map(source);
  // Preserve every source entry. Fill only previously void cells with explicit
  // air at local y=4: a deliberately test-only space constraint/carving plane.
  for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) {
    const k = key(x - 18, FEATURE_PROBE.airPlane - 6, z - 18);
    if (!payload.has(k)) payload.set(k, block("minecraft:air"));
  }
  // A visible 40x40 perimeter at local y=53 exposes chunk clipping. Original
  // art is never replaced; a future source change touching this plane fails.
  for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) {
    if (x !== 0 && z !== 0 && x !== 39 && z !== 39) continue;
    const k = key(x - 18, 47, z - 18);
    if (source.has(k)) throw new Error(`source touches diagnostic perimeter: ${k}`);
    payload.set(k, block((x === 0 || x === 39) && (z === 0 || z === 39)
      ? "minecraft:sea_lantern" : "minecraft:glass"));
  }
  const pieces = [{ id: "payload", blocks: payload, source,
    size: FEATURE_PROBE.size, offset: FEATURE_PROBE.offset }];
  for (const c of CASES) {
    const blocks = new Map([[key(0, 1, 0), {
      name: "minecraft:jigsaw", states: { facing_direction: 1, rotation: 0 },
      jigsaw: FEATURE_PROBE.anchor, jigsawTarget: FEATURE_PROBE.target,
      jigsawPool: `${PREFIX}/${c.checked ? "checked" : "control"}_feature`, finalState: "minecraft:air",
    }], [key(0, -10, 0), block(c.marker)]]);
    if (c.obstacle) blocks.set(key(...FEATURE_PROBE.obstacle), block("minecraft:diamond_block"));
    pieces.push({ id: `carrier_${c.id}`, blocks,
      size: FEATURE_PROBE.carrierSize, offset: FEATURE_PROBE.carrierOffset });
  }
  // Direct-template baseline, unchanged from revision 2. No feature is called.
  const inputKey = key(2, -6, 2); // file-local (20, 0, 20)
  if (payload.has(inputKey)) throw new Error("bounds input intersects payload");
  const input = {
    name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 },
    jigsaw: FEATURE_PROBE.target, jigsawTarget: EMPTY, jigsawPool: EMPTY,
    finalState: "minecraft:air",
  };
  pieces.push({ id: "direct", blocks: new Map([...payload, [inputKey, input]]),
    size: FEATURE_PROBE.size, offset: FEATURE_PROBE.offset });
  for (const c of BOUNDS_CASES) {
    const blocks = new Map([[key(0, 1, 0), {
      name: "minecraft:jigsaw", states: { facing_direction: 1, rotation: 0 },
      jigsaw: FEATURE_PROBE.anchor, jigsawTarget: FEATURE_PROBE.target,
      jigsawPool: `${PREFIX}/${c.id}_child`, finalState: "minecraft:air",
    }], [key(0, -10, 0), block(c.marker)]]);
    // Parent ends just below the child: declaring the full child volume must
    // not make the jigsaw reject it for overlapping its own parent.
    pieces.push({ id: `carrier_${c.id}`, blocks, size: [1, 12, 1], offset: [0, 10, 0] });
  }
  return pieces;
}

export function featureProbeDefinitions() {
  const defs = {
    "manifest.json": { format_version: 2,
      header: { name: "pack.name", description: "pack.description",
        uuid: "3061bf12-1867-427c-99c6-daee79fc2606", version: [1, 0, 0], min_engine_version: [1, 26, 50] },
      modules: [{ type: "data", uuid: "a1117fa9-f639-4a12-94c7-bc1d157388fc", version: [1, 0, 0] }],
      dependencies: [{ uuid: "f1017fe8-4525-4d1b-9e5d-8e1c13851057", version: [1, 0, 0] }],
    },
    [FEATURE_PROBE.naturalSet]: featureProbeNaturalSet(),
  };
  const pool = (id, element) => ({ format_version: "1.26.50", "minecraft:template_pool": {
    description: { identifier: `${PREFIX}/${id}` }, elements: [{ element, weight: 1 }],
  } });
  for (const checked of [false, true]) {
    const id = checked ? "checked" : "control";
    defs[`features/feature_probe_${id}.json`] = {
      format_version: "1.26.50", "minecraft:structure_template_feature": {
        description: { identifier: `lothlorien:feature_probe_${id}` },
        structure_name: "lothlorien:feature_probe/payload", adjustment_radius: 0,
        facing_direction: "north", rotate_around_center: true, ground_level: FEATURE_PROBE.ground,
        constraints: checked ? { block_intersection: {
          only_check_intersection_for_motion_blocking_blocks: false,
          block_allowlist: ["minecraft:air"],
        } } : {},
      },
    };
    defs[`worldgen/template_pools/feature_probe_${id}_feature.json`] = pool(`${id}_feature`, {
      element_type: "minecraft:feature_pool_element", feature: `lothlorien:feature_probe_${id}`,
    });
  }
  for (const c of CASES) {
    defs[`worldgen/template_pools/feature_probe_${c.id}_start.json`] = pool(`${c.id}_start`, {
      element_type: "minecraft:single_pool_element",
      location: `lothlorien/feature_probe/carrier_${c.id}`, projection: "rigid",
    });
    for (const natural of [false, true]) {
      const id = `feature_probe_${c.id}${natural ? "_natural" : ""}`;
      defs[`worldgen/structures/${id}.json`] = { format_version: "1.26.50", "minecraft:jigsaw": {
        description: { identifier: `lothlorien:${id}` },
        biome_filters: [{ test: "has_biome_tag", value: "overworld" }],
        step: "surface_structures", terrain_adaptation: "none",
        start_pool: `${PREFIX}/${c.id}_start`, start_jigsaw_name: FEATURE_PROBE.anchor,
        max_depth: 1,
        start_height: { type: "constant", value: { absolute: natural ? FEATURE_PROBE.naturalY : FEATURE_PROBE.commandY } },
        max_distance_from_center: { horizontal: 64, vertical: 64 },
      } };
    }
  }
  const single = id => ({ element_type: "minecraft:single_pool_element",
    location: `lothlorien/feature_probe/${id}`, projection: "rigid" });
  for (const c of BOUNDS_CASES) {
    defs[`worldgen/template_pools/feature_probe_${c.id}_start.json`] = pool(`${c.id}_start`, single(`carrier_${c.id}`));
    defs[`worldgen/template_pools/feature_probe_${c.id}_child.json`] = pool(`${c.id}_child`, single("direct"));
    for (const natural of [false, true]) {
      const id = `feature_probe_${c.id}${natural ? "_natural" : ""}`;
      defs[`worldgen/structures/${id}.json`] = { format_version: "1.26.50", "minecraft:jigsaw": {
        description: { identifier: `lothlorien:${id}` },
        biome_filters: [{ test: "has_biome_tag", value: "overworld" }],
        step: "surface_structures", terrain_adaptation: "none",
        start_pool: `${PREFIX}/${c.id}_start`, start_jigsaw_name: FEATURE_PROBE.anchor,
        max_depth: 1,
        start_height: { type: "constant", value: { absolute: natural ? FEATURE_PROBE.naturalY : FEATURE_PROBE.commandY } },
        max_distance_from_center: { horizontal: 64, vertical: 64 },
      } };
    }
  }
  return defs;
}

export function featureProbeNaturalSet() {
  return { format_version: "1.26.50", "minecraft:structure_set": {
    description: { identifier: "lothlorien:feature_probe_natural" },
    placement: { type: "minecraft:random_spread", spacing: 12, separation: 4,
      salt: 102717413, spread_type: "linear" },
    structures: BOUNDS_CASES.map(c => ({ structure: `lothlorien:feature_probe_${c.id}_natural`, weight: 1 })),
  } };
}

export function featureProbeFunctions() {
  const lines = [
    "# Disposable FLAT Creative world only. Clears four sky fixtures, not terrain.",
    "# Fixed absolute locations; all buffers are below the fill-command volume cap.",
  ];
  for (const c of CASES) {
    const x0 = c.x - 24, x1 = c.x + 24;
    for (let y = 80; y < 160; y += 10)
      lines.push(`fill ${x0} ${y} -16 ${x1} ${y + 9} 32 minecraft:air`);
    // Independent commands write these obstacles BEFORE invoking the jigsaw.
    // A diamond saved in the carrier alone cannot establish write/check order.
    if (c.obstacle) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const range = sign => sign < 0
        ? [-FEATURE_PROBE.pillarFar, -FEATURE_PROBE.pillarNear]
        : [FEATURE_PROBE.pillarNear, FEATURE_PROBE.pillarFar];
      const [xa, xb] = range(sx), [za, zb] = range(sz);
      lines.push(`fill ${c.x + xa} ${FEATURE_PROBE.pillarBottom} ${8 + za} ${c.x + xb} ${FEATURE_PROBE.pillarTop} ${8 + zb} minecraft:diamond_block`);
    }
    lines.push(`place structure lothlorien:feature_probe_${c.id} ${c.x} 100 8`);
  }
  lines.push("tp @s 424 118 40 facing 392 100 8");
  const bounds = ["# Revision 3 direct-template control. Disposable FLAT Creative world only."];
  for (const c of BOUNDS_CASES) {
    for (let y = 80; y < 160; y += 7)
      bounds.push(`fill ${c.x - 32} ${y} -24 ${c.x + 32} ${Math.min(y + 6, 159)} 40 minecraft:air`);
    bounds.push(`place structure lothlorien:feature_probe_${c.id} ${c.x} 100 8`);
  }
  bounds.push("tp @s 232 118 40 facing 200 118 8");
  return {
    "functions/lothlorien/feature_bounds_setup.mcfunction": BOUNDS_CASES.map(c =>
      `tickingarea add ${c.x - 32} 80 -24 ${c.x + 32} 159 40 fb_${c.id} true`).join("\n") + "\n",
    "functions/lothlorien/feature_bounds.mcfunction": bounds.join("\n") + "\n",
    "functions/lothlorien/feature_bounds_release.mcfunction": BOUNDS_CASES.map(c =>
      `tickingarea remove fb_${c.id}`).join("\n") + "\n",
    "functions/lothlorien/feature_probe_setup.mcfunction": CASES.map(c =>
      `tickingarea add ${c.x - 24} 80 -16 ${c.x + 24} 159 32 fp_${c.id} true`).join("\n") + "\n",
    "functions/lothlorien/feature_probe.mcfunction": lines.join("\n") + "\n",
    "functions/lothlorien/feature_probe_view.mcfunction": "tp @s 424 118 40 facing 392 100 8\n",
    "functions/lothlorien/feature_probe_release.mcfunction": CASES.map(c =>
      `tickingarea remove fp_${c.id}`).join("\n") + "\n",
  };
}

export function writeFeatureProbe() {
  const write = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
  // Retire exact files from the rejected revision-2 envelope. Leaving its bad
  // pool JSON in the optional pack still causes a load error even when unused.
  for (const path of ["features/feature_probe_bounded.json",
    "structures/lothlorien/feature_probe/envelope.mcstructure",
    "structures/lothlorien/feature_probe/carrier_envelope.mcstructure",
    "worldgen/template_pools/feature_probe_envelope_child.json",
    "worldgen/template_pools/feature_probe_envelope_start.json",
    "worldgen/structures/feature_probe_envelope.json",
    "worldgen/structures/feature_probe_envelope_natural.json"]) {
    const retired = join(bp, path);
    if (existsSync(retired)) unlinkSync(retired);
  }
  for (const p of featureProbePieces()) {
    const { buffer, clipped } = toMcstructure(p.blocks, p.size, p.offset);
    if (clipped) throw new Error(`${p.id}: ${clipped} clipped blocks`);
    write(join(bp, `structures/lothlorien/feature_probe/${p.id}.mcstructure`), buffer);
  }
  for (const [path, definition] of Object.entries(featureProbeDefinitions()))
    write(join(bp, path), JSON.stringify(definition, null, 2) + "\n");
  for (const [path, data] of Object.entries(featureProbeFunctions())) write(join(bp, path), data);
  // Retire only files from the initial, undeployed main-pack routing. Never
  // remove folders or the core manifest. The optional pack owns all probes now.
  const retired = [FEATURE_PROBE.naturalSet,
    ...featureProbePieces().map(p => `structures/lothlorien/feature_probe/${p.id}.mcstructure`),
    ...Object.keys(featureProbeDefinitions()).filter(p => p !== "manifest.json"),
    ...Object.keys(featureProbeFunctions())];
  for (const path of new Set(retired)) {
    const old = join(mod, "lothlorien_bp", path);
    if (existsSync(old)) unlinkSync(old);
  }
  console.log("Feature bridge probes generated in optional lothlorien_feature_probe_bp; enable only in disposable test worlds.");
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args.length) throw new Error("usage: node tools/build_constrained_feature_probe.mjs");
  writeFeatureProbe();
}
