// Rail mender rules. Pure, so tests/run.mjs can check them offline; rail_mender.js wires them up.
//
// Structure placement may overwrite stored links. Both builders and the one-shot
// runtime repair share this explicit village target policy. Runtime also repairs
// local edits and furnishing, clears known empty/thin targets, and preserves unknown
// native behavior. Half-slab links are an intentional owner-requested extension.
export const MENDER_ID = "lothlorien:rail_mender";
export const FENCE_IDS = ["lothlorien:mallorn_fence", "lothlorien:mallorn_heartwood_fence"];
export const LINKS = [
  { state: "minecraft:connection_north", dx: 0, dz: -1 },
  { state: "minecraft:connection_south", dx: 0, dz: 1 },
  { state: "minecraft:connection_east", dx: 1, dz: 0 },
  { state: "minecraft:connection_west", dx: -1, dz: 0 },
];
// Box scanned around the marker: bigger than the largest rail piece (central tree 33 x 33), covering both tower levels.
export const SCAN = { radius: 17, below: 3, above: 14 };
export const MAX_WAIT_TICKS = 600; // give up after 30 s of unloaded corners; the marker stays and fires again next load
export const RETRY_TICKS = 40;
export const START_DELAY_TICKS = 40;

export const POST_IDS = ["lothlorien:mallorn_stripped_log", "lothlorien:mallorn_log", "lothlorien:mallorn_wood", "lothlorien:mallorn_stripped_wood"];
export const isFence = (typeId) => FENCE_IDS.includes(typeId);
// Shared village policy. Half slabs intentionally join too (owner 2026-10-16).
// Thin decoration and leaves are excluded. Unknown targets retain the native result.
export const SOLID_TARGETS = ["minecraft:moss_block", "minecraft:grass_block", "minecraft:dirt", "minecraft:stone", "minecraft:bookshelf", "minecraft:chiseled_bookshelf", "minecraft:barrel"];
export const isLinkTarget = (typeId) => FENCE_IDS.includes(typeId) || POST_IDS.includes(typeId)
  || /^lothlorien:mallorn_(heartwood_)?(planks|slab|double_slab)$/.test(typeId ?? "")
  || SOLID_TARGETS.includes(typeId);

// States to switch on for the fence at `pos`. `typeAt(x, y, z)` gives the block type id or undefined when unloaded;
// `stateOf(state)` the current value of that link on this fence.
export function missingLinks(pos, typeAt, stateOf) {
  const out = [];
  for (const l of LINKS) {
    if (stateOf(l.state) === true) continue;
    if (isLinkTarget(typeAt(pos.x + l.dx, pos.y, pos.z + l.dz))) out.push(l.state);
  }
  return out;
}

// Undefined means unloaded: keep that link. Unknown block types keep native rules.
export function connectionChanges(pos, typeAt, stateOf) {
  const out = [];
  for (const l of LINKS) {
    const id = typeAt(pos.x + l.dx, pos.y, pos.z + l.dz);
    const value = isLinkTarget(id) ? true : /(^minecraft:(air|cave_air|void_air|light_block_\d+|flower_pot)$)|leaves$|firefly_jar$|elven_lantern/.test(id ?? "") ? false : undefined;
    if (value !== undefined && stateOf(l.state) !== value) out.push([l.state, value]);
  }
  return out;
}

// The two opposite corners of the scan box around a marker position, rounded to block coordinates.
export function scanBox(p) {
  const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
  return {
    from: { x: x - SCAN.radius, y: y - SCAN.below, z: z - SCAN.radius },
    to: { x: x + SCAN.radius, y: y + SCAN.above, z: z + SCAN.radius },
  };
}
