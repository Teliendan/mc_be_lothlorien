// Village REPAIRS, run by the loop planner (village_planner.js planGen) on the loaded village, after the links. Pure JS (no Bedrock imports):
// loop_marker.js writes the result in game, tools/village_sim.mjs and tests/run.mjs run the very same functions.
//
// Rope fit (owner screenshot 2026-10-10, flat world "ET"): the central tree hangs `elven_rope_hanging` from tree y 0 to its lower deck. Bedrock's
// `world_surface` start height counts from the TOP SOLID block, so with the old start height the lowest rope piece replaced the top block of the
// ground (a hole in the grass), and on uneven ground the rope is buried or ends in the air: the rope is 3 blocks from the trunk axis where the
// height was sampled. The fit reads the real ground and (a) turns buried rope pieces back into the terrain block in front of them, (b) hangs
// more pieces down to the ground. The face of the rope is derived from the wall it hangs on, never hard-coded (a piece can be rotated).
import { hullOf, growRect } from "./village_planner.js";

export const ROPE_ID = "lothlorien:elven_rope_hanging";
export const REPAIR = { maxHang: 24, minAbove: 2, scanChunk: 512 };
const LOGS = new Set(["lothlorien:mallorn_log", "lothlorien:mallorn_wood"]);
const FACE_OF = { "1,0": "west", "-1,0": "east", "0,1": "north", "0,-1": "south" }; // wall offset from the piece -> rope face (the wall lies opposite)
const OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AIRS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);
const WET = (n) => n === "minecraft:water" || n === "minecraft:flowing_water" || n === "minecraft:lava" || n === "minecraft:flowing_lava" || /seagrass|kelp|bubble_column/.test(n ?? "");
const SOFT = /short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|daisy|orchid|allium|bluet|cornflower|lily|bush|sapling|snow_layer|leaf_litter|petals|vine|mushroom|dead_bush|sweet_berry|azalea/;
const VILLAGE = /^lothlorien:(mallorn_(planks|slab|fence|log|wood|stairs|leaves)|elven_)/;
const TERRAIN = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|rooted_dirt|mycelium|stone|sand|red_sand|gravel|moss_block|mud|clay|sandstone|red_sandstone|snow|dirt_path|deepslate|andesite|diorite|granite|terracotta|.*_terracotta)$/;
const isAir = (n) => AIRS.has(n);
const isPlant1 = (n) => n === "minecraft:short_grass" || n === "minecraft:fern" || n === "minecraft:tallgrass";

// ground(n): a block the rope may not occupy because it is the terrain (an undefined read is not ground: the caller errors out first)
export const isGround = (n) => n !== undefined && n !== null && !isAir(n) && !WET(n) && !SOFT.test(n) && !/leaves/.test(n) && !VILLAGE.test(n);

// Rope pieces of the layer y (the deck cell row) inside the rect. A generator, so the runtime job can yield: yields every REPAIR.scanChunk reads.
export function* findRopesGen(at, rect, y) {
  const out = [];
  let n = 0;
  for (let x = rect.x0; x <= rect.x1; x++) for (let z = rect.z0; z <= rect.z1; z++) {
    if (at(x, y, z) === ROPE_ID) out.push({ x, y, z });
    if (++n % REPAIR.scanChunk === 0) yield;
  }
  return out;
}

// The fit of the rope column that has `top` as its upper piece (in the deck layer). -> { blocks: [{ x, y, z, id, states }], buried, hung, face } | { error }
export function planRopeFit(at, top) {
  const wall = OFFSETS.filter(([a, b]) => LOGS.has(at(top.x + a, top.y, top.z + b)) && LOGS.has(at(top.x + a, top.y - 1, top.z + b)));
  const w = wall.find(([a, b]) => isAir(at(top.x - a, top.y, top.z - b))) ?? wall[0];
  if (!w) return { error: "no wall behind the rope" };
  const [wx, wz] = w, face = FACE_OF[`${wx},${wz}`], fx = -wx, fz = -wz; // front = beyond the rope
  let bottom = top.y;
  while (at(top.x, bottom - 1, top.z) === ROPE_ID) bottom--;
  const blocks = [], mark = (y, id, states = {}) => blocks.push({ x: top.x, y, z: top.z, id, states });
  let buried = 0, hung = 0;
  // buried: the piece stands where the terrain is (the cell in front of it is ground)
  while (bottom < top.y - REPAIR.minAbove) {
    const front = at(top.x + fx, bottom, top.z + fz);
    if (front === undefined) return { error: `unloaded cell at ${top.x + fx},${bottom},${top.z + fz}` };
    if (!isGround(front)) break;
    mark(bottom, TERRAIN.test(front) ? front : "minecraft:dirt");
    bottom++; buried++;
  }
  if (!buried) {
    // hanging: more pieces while the cell below is open and the wall carries them
    let y = bottom;
    while (hung < REPAIR.maxHang) {
      const below = at(top.x, y - 1, top.z), wallBelow = at(top.x + wx, y - 1, top.z + wz);
      if (below === undefined || wallBelow === undefined) return { error: `unloaded cell under the rope at ${top.x},${y - 1},${top.z}` };
      if (!(isAir(below) || isPlant1(below)) || isAir(wallBelow) || WET(wallBelow)) break;
      mark(y - 1, ROPE_ID, { "minecraft:cardinal_direction": face });
      y--; hung++;
    }
  }
  return { blocks, buried, hung, face, bottom };
}

// All repairs of a village (the planner calls this after the links): -> [{ kind: "rope", x, z, buried, hung, cells: [], rails: [], lanterns: [], blocks }]
export function* repairGen(at, markers, o = {}) {
  if (o.repairs === false || !markers.length) return [];
  const rect = o.rect ?? growRect(hullOf(markers), 24), y = Math.min(...markers.map((m) => m[1])), out = [];
  const ropes = yield* findRopesGen(at, rect, y);
  const columns = ropes.filter((r) => at(r.x, r.y + 1, r.z) !== ROPE_ID); // the top piece of each column only (no rope above it)
  for (const top of columns) {
    yield;
    const fit = planRopeFit(at, top);
    if (fit.error) { o.log?.push(`rope ${top.x},${top.z}: ${fit.error}`); continue; }
    if (!fit.blocks.length) continue;
    const plan = { kind: "rope", x: top.x, z: top.z, buried: fit.buried, hung: fit.hung, cells: [], rails: [], lanterns: [], blocks: fit.blocks };
    at.apply(plan);
    out.push(plan);
  }
  return out;
}

export const describeRepair = (p) => `rope at ${p.x},${p.z}: -${p.buried} buried, +${p.hung} hung`;
