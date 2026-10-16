// Structure checks and the decoration API of the Elven village pieces (style guide docs/design/village_style.md, rules 8 and principle 10):
//   keepClearCells(blocks, opts) -> Set "x,y,z"   cells nobody may decorate (connector corridors, main path, walk ring, stair columns, posts, rope)
//   keepClearViolations(blocks, keep) -> [{ rule, at, detail }]   a non-air, non-carpet, non-light block inside a keep-clear cell
//   deco(blocks, keep) -> { put, can }            the only way dressing code writes blocks: throws on a keep-clear cell and on a non-air target
//   supportCheck(blocks) -> violations            nothing floats: stand / hang / wall rules, plant soil and block placement_filter (see below)
//   waterCheck(blocks, { allowed }) -> violations static water flow must stay inside the declared water cells; a source needs a vessel
// Pure (the placement_filter table is read once from lothlorien_bp/blocks). `blocks` = Map "x,y,z" -> { name, states }, any origin.
// Everything is tagged "documented / simulated": none of it is verified in game (2026-10-14).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const key = (x, y, z) => `${x},${y},${z}`;
const AIR_RE = /(^|:)(air|cave_air|void_air|structure_void)$/;
export const isAirName = (n) => n === undefined || n === null || AIR_RE.test(n);
const FACING_VEC = { 2: [0, -1], 3: [0, 1], 4: [-1, 0], 5: [1, 0] }; // facing_direction 2 north (-z), 3 south, 4 west, 5 east
const CARD_VEC = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---- keep-clear cells ----------------------------------------------------------------------------------------------------
const DECK_NAMES = new Set(["lothlorien:mallorn_planks", "lothlorien:mallorn_slab", "minecraft:jigsaw", "lothlorien:mallorn_heartwood_planks", "lothlorien:mallorn_heartwood_slab"]);
// opts:
//   connectors: [{ x, z, y, facing | d: [dx, dz] }]  deck connectors (y = deck layer; d = outward direction of the connector, or `facing`)
//   trunkR: trunk half width (plus / 3x3 = 1, round5 = 2)
//   ringY: [deck y | { y, dist }]  deck layers with a walk ring round the trunk (all cells at Chebyshev distance `dist`; a plain y means
//          trunkR + 1, or trunkR + 2 when `stair` is given; an upper deck round a stair opening railed on the deck has dist trunkR + 3)
//   stair: [{ x, z, y }]  tread blocks (y = the tread block); the column over a tread (feet to +3 headroom) is keep-clear
//   posts: [{ x, z, y? }] elf post / warden cells (deck + 1, + 2); deckY is the default y
//   rope: { x, z, y? }  the rope column and the cell in front of it (away from the trunk axis)
//   depth: how far a connector's path runs inward at most (default: on to the walk ring)
//   strips: [{ x, z, y }]  extra single cells (bridge walk strips: pass the deck / slab block cell, the three cells above are kept)
// A corridor / path / ring cell only counts where the deck layer really has a deck block (planks, slab, jigsaw) under it.
export function keepClearCells(blocks, { connectors = [], trunkR = 1, ringY = [], stair = [], posts = [], rope = null, strips = [], deckY = 16, ringHeight = null, depth = 64 } = {}) {
  const keep = new Set();
  const isDeck = (x, y, z) => DECK_NAMES.has(blocks.get(key(x, y, z))?.name);
  const column = (x, y, z, h = 3) => { if (isDeck(x, y, z)) for (let i = 1; i <= h; i++) keep.add(key(x, y + i, z)); };
  const ringDist = stair.length ? trunkR + 2 : trunkR + 1;
  const ringAt = (y) => { const r = ringY.find((q) => typeof q === "object" && q.y === y); return r ? r.dist : ringDist; };
  const cheb = (x, z) => Math.max(Math.abs(x), Math.abs(z));
  for (const c of connectors) {
    const d = c.d ?? ({ north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] })[c.facing];
    const p = [-d[1], d[0]];
    // the corridor (3 wide, the connector cell and 3 behind it) and the straight main path on to the walk ring
    for (let k = 0; k < depth; k++) {
      const cx = c.x - d[0] * k, cz = c.z - d[1] * k;
      const onRing = Math.abs(d[0] ? cx : cz) <= ringAt(c.y);
      for (let o = -1; o <= 1; o++) column(cx + p[0] * o, c.y, cz + p[1] * o, onRing && stair.length ? 2 : 3); // stair rails start at +3 on the ring
      if (k >= 3 && onRing) break; // the path ends on the walk ring row / column
    }
  }
  for (const r of ringY) {
    const y = typeof r === "number" ? r : r.y, dist = typeof r === "number" ? ringDist : r.dist;
    for (let x = -dist; x <= dist; x++) for (let z = -dist; z <= dist; z++) if (cheb(x, z) === dist) column(x, y, z, ringHeight ?? (stair.length ? 2 : 3));
  }
  for (const t of stair) for (let i = 1; i <= 3; i++) keep.add(key(t.x, t.y + i, t.z));
  for (const p of posts) { const y = p.y ?? deckY; keep.add(key(p.x, y + 1, p.z)); keep.add(key(p.x, y + 2, p.z)); }
  if (rope) {
    const y = rope.y ?? deckY, ax = Math.abs(rope.x) >= Math.abs(rope.z), s = ax ? Math.sign(rope.x) || 1 : Math.sign(rope.z) || 1;
    const front = ax ? [rope.x + s, rope.z] : [rope.x, rope.z + s];
    for (let i = 1; i <= 3; i++) { keep.add(key(rope.x, y + i, rope.z)); keep.add(key(front[0], y + i, front[1])); }
  }
  for (const s of strips) column(s.x, s.y, s.z, 3);
  return keep;
}
// blocks allowed in a keep-clear cell: air, hidden light, carpets, rope (the village rope), the deck itself over a stair (full deck / top slab
// above the tread headroom) and the stair rails that start 3 above the deck
const KEEP_OK = /(^|:)(air|cave_air|void_air|structure_void)$|light_block|carpet|elven_rope|mallorn_planks$|mallorn_slab$|jigsaw$/;
export function keepClearViolations(blocks, keep, { ok = KEEP_OK } = {}) {
  const v = [];
  for (const k of keep) {
    const b = blocks.get(k);
    if (!b || ok.test(b.name)) continue;
    v.push({ rule: "keep_clear", at: k.split(",").map(Number), detail: `${b.name} in a keep-clear cell` });
  }
  return v;
}
// Decoration writer: every dressing function goes through put(), after the structure and before the hidden lights.
export function deco(blocks, keep = new Set()) {
  const can = (x, y, z) => { const k = key(x, y, z); return !keep.has(k) && isAirName(blocks.get(k)?.name); };
  const put = (x, y, z, block) => {
    const k = key(x, y, z);
    if (keep.has(k)) throw new Error(`deco: ${block?.name} at ${k} is in a keep-clear cell`);
    const old = blocks.get(k);
    if (!isAirName(old?.name)) throw new Error(`deco: ${block?.name} at ${k} would replace ${old.name}`);
    blocks.set(k, block);
    return block;
  };
  return { put, can };
}

// ---- block classes ------------------------------------------------------------------------------------------------------------
const LIGHT_BLOCK = /(^|:)light_block/;
// not carriers: things that cannot hold another block (plants, cloth, lamps, ropes, light blocks, thin decor, open trapdoors are handled apart)
const NOT_CARRIER = /(^|:)(air|cave_air|void_air|structure_void)$|light_block|carpet|banner|torch|candle|lantern|chandelier|rope|(^|:|_)chain$|vine|pale_hanging_moss|moss_carpet|glow_lichen|spore_blossom|hanging_roots|leaf_litter|wildflowers|petals|firefly_bush|(^|:)bush$|fern|flower|elanor|niphredil|athelas|nectar_bloom|mallorn_blossom|sapling|lily_of_the_valley|lily_pad|sea_pickle|firefly_jar|sign|ladder|water$|lava$|pot$|button|pressure_plate|(^|:)azalea$/;
const LEAVES = /leaves|(^|:)azalea_leaves/;
const SOIL = new Set(["minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:moss_block", "minecraft:dirt_with_roots", "minecraft:rooted_dirt", "minecraft:mud", "minecraft:farmland", "minecraft:mycelium"]);
// vanilla plants that pop off anything but soil (Java BushBlock / Bedrock plant rules; documented, not tested here)
const SOIL_PLANT = /^minecraft:(short_grass|tall_grass|fern|large_fern|dandelion|poppy|blue_orchid|allium|azure_bluet|.*_tulip|oxeye_daisy|cornflower|lily_of_the_valley|torchflower|pitcher_plant|rose_bush|peony|lilac|sunflower|bush|firefly_bush|wildflowers|pink_petals|flowering_azalea|azalea|short_dry_grass|tall_dry_grass|sweet_berry_bush)$/;
const HANG_CHAIN = /(^|:)elven_rope_hanging$|(^|:|_)chain$|(^|:)pale_hanging_moss$|cave_vines|(^|:)hanging_roots$|(^|:)weeping_vines/;
const HANG_ALWAYS = /elven_chandelier|(^|:)spore_blossom$|(^|:)pale_hanging_moss$|cave_vines|(^|:)hanging_roots$|(^|:|_)chain$|(^|:)weeping_vines/;
const TREE = /_log$|_wood$|(^|:)mallorn_wood$|leaves/;
const STRUCTURE = /(^|:)(mallorn_planks|mallorn_slab|mallorn_heartwood_planks|mallorn_heartwood_slab|mallorn_double_slab|mallorn_heartwood_double_slab|mallorn_fence|mallorn_heartwood_fence|jigsaw)$|light_block/;

let filterTable = null; // "lothlorien:x" -> [{ faces: Set, blocks: Set|null }]
function filters() {
  if (filterTable) return filterTable;
  filterTable = new Map();
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp", "blocks");
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const j = JSON.parse(readFileSync(join(dir, f), "utf8"))["minecraft:block"];
    const pf = j?.components?.["minecraft:placement_filter"];
    if (!pf?.conditions?.length) continue;
    const conds = pf.conditions.map((c) => ({
      faces: new Set(c.allowed_faces ?? ["up", "down", "north", "south", "east", "west"]),
      blocks: Array.isArray(c.block_filter) && c.block_filter.every((e) => typeof e === "string") ? new Set(c.block_filter) : null,
    }));
    filterTable.set(j.description.identifier, conds);
  }
  return filterTable;
}
export const placementFilter = (name) => filters().get(name) ?? null;

// carrier: a block that can hold something against it. `leaves` only for hanging things.
const isCarrier = (n, { leaves = false } = {}) => !isAirName(n) && (LEAVES.test(n) ? leaves : !NOT_CARRIER.test(n));

// -> null when supported, else a reason. get(x, y, z) -> { name, states } | undefined
function whyFloating(get, x, y, z, b, opts) {
  const n = b.name, st = b.states ?? {};
  if (TREE.test(n) || STRUCTURE.test(n) || LIGHT_BLOCK.test(n) || WATER.test(n)) return null; // water is held by its vessel (waterCheck), not by a carrier
  const at = (dx, dy, dz) => get(x + dx, y + dy, z + dz);
  const filt = opts.filters ? placementFilter(n) : null;
  const filterOk = (dir, neighbour) => { // dir "up" = standing on the block below, "down" = hanging from the block above
    if (!filt) return true;
    const ok = filt.some((c) => c.faces.has(dir) && (!c.blocks || c.blocks.has(neighbour?.name)));
    return ok ? true : `placement_filter of ${n} does not allow it on ${neighbour?.name ?? "nothing"} (${dir})`;
  };
  // hanging: follow cords / vines / moss upwards to the first real block
  const hangs = () => {
    let cy = 1, up = at(0, cy, 0);
    while (up && HANG_CHAIN.test(up.name) && cy < 64) up = at(0, ++cy, 0);
    if (up && isCarrier(up.name, { leaves: true })) return filterOk("down", up);
    return `hangs from ${up?.name ?? "nothing"}`;
  };
  const wall = (vec) => { // carrier behind (vec = direction the block faces), else any horizontal neighbour
    if (vec) { const q = at(-vec[0], 0, -vec[1]); return q && isCarrier(q.name) ? true : `nothing behind it (${q?.name ?? "void"})`; }
    return H4.some(([dx, dz]) => { const q = at(dx, 0, dz); return q && isCarrier(q.name); }) ? true : "no wall beside it";
  };
  const stands = () => {
    const below = at(0, -1, 0);
    if (below?.name === n) return true; // a stack of the same thing (leaf carpet on leaf carpet, a double plant)
    if (n === "minecraft:lily_pad" || n === "minecraft:waterlily") return /water$/.test(below?.name ?? "") ? true : `lily pad on ${below?.name ?? "nothing"}`;
    if (st.upper_block_bit === true && below?.name === n) return true;
    if (!below || !isCarrier(below.name)) return `stands on ${below?.name ?? "nothing"}`;
    if (SOIL_PLANT.test(n) && !SOIL.has(below.name)) return `plant ${n} on ${below.name} (needs soil)`;
    return filterOk("up", below);
  };
  const ok = (r) => (r === true ? null : r);
  if (/(^|:)wall_banner$/.test(n)) { // a banner hangs on a FULL block face (trunk, log post, planks), never on a fence, a trapdoor, stairs, a slab or a pot
    const v = FACING_VEC[st.facing_direction], q = v && at(-v[0], 0, -v[1]);
    if (!q || !isCarrier(q.name) || /fence|_wall$|trapdoor|stairs|slab|door|pot$|chain|bars|lantern/.test(q.name)) return `banner on ${q?.name ?? "nothing"}, not a full block`;
    return null;
  }
  if (/(^|:)standing_banner$/.test(n)) { // a standing banner needs room: its cell and the cell above are air (no ceiling within 2), and it stands on a block (a fence top is fine)
    const up = at(0, 1, 0);
    if (up && !isAirName(up.name)) return `standing banner under ${up.name}: no ceiling within 2`;
  }
  if (/(^|:)decorated_pot$/.test(n)) { const below = at(0, -1, 0); if (below && /fence/.test(below.name)) return "a decorated pot (vase) stands on the floor, not on a fence"; }
  if (/stairs$/.test(n) && st["minecraft:vertical_half"] === "top") { // a roof eave: upside-down stairs lean on the roof beside them (logs, leaves or more eave stairs)
    if (H4.some(([dx, dz]) => { const q = at(dx, 0, dz); return q && (TREE.test(q.name) || /stairs$/.test(q.name)); })) return null;
  }
  if (/(^|:)ladder$/.test(n)) return ok(wall(FACING_VEC[st.facing_direction]));
  if (/(^|:)elven_rope$/.test(n)) return ok(wall(CARD_VEC[st["lothlorien:face"]]));
  if (/(^|:)elven_rope_hanging$/.test(n)) { // carried by the block above (cord) or the block behind (the trunk it lies on)
    const behind = CARD_VEC[st["minecraft:cardinal_direction"]];
    if (behind) { const q = at(-behind[0], 0, -behind[1]); if (q && isCarrier(q.name)) return null; }
    return hangs() === true ? null : "rope: nothing above and nothing behind";
  }
  if (/(^|:)glow_lichen$/.test(n)) {
    const six = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    return six.some(([dx, dy, dz]) => { const q = at(dx, dy, dz); return q && isCarrier(q.name); }) ? null : "glow lichen on nothing";
  }
  if (/trapdoor$/.test(n)) {
    const open = st["lothlorien:open"] === true || st.open_bit === true;
    if (open) {
      const c = CARD_VEC[st["minecraft:cardinal_direction"]]; // mod trapdoor: attached to the block opposite its direction
      const r = c ? wall([c[0], c[1]]) : wall(null);
      if (r === true) return null;
      const under = at(0, -1, 0); // or standing on edge on a block below (a screen panel on a deck, a planter box): carried like anything that stands
      return under && isCarrier(under.name) ? null : r;
    }
    const near = [[0, -1, 0], [0, 1, 0], ...H4.map(([a, c2]) => [a, 0, c2])].some(([dx, dy, dz]) => { const q = at(dx, dy, dz); return q && isCarrier(q.name); });
    return near ? null : "closed trapdoor touches nothing";
  }
  if (/lantern/.test(n)) { // lanterns: block_face down hangs, up stands; a missing state is the trait default (down)
    const face = st["minecraft:block_face"] ?? "down";
    const r = face === "down" ? hangs() : stands();
    return r === true ? null : r;
  }
  if (HANG_ALWAYS.test(n) || (filt && filt.every((c) => c.faces.size === 1 && c.faces.has("down")))) { const r = hangs(); return r === true ? null : r; }
  const r = stands();
  return r === true ? null : r;
}

// supportCheck(blocks, { filters: true }) -> [{ rule: "support", at, name, detail }]
export function supportCheck(blocks, opts = {}) {
  const get = (x, y, z) => blocks.get(key(x, y, z));
  return supportScan((fn) => { for (const [k, b] of blocks) { const [x, y, z] = k.split(",").map(Number); fn(x, y, z, b); } }, get, opts);
}
// the generic form: each(fn(x, y, z, block)) walks the blocks, get(x, y, z) reads a neighbour (the sim passes its assembled world)
export const isSupportSkipped = (name) => TREE.test(name) || STRUCTURE.test(name);
export function supportScan(each, get, { filters: useFilters = true, max = 60 } = {}) {
  const out = [], opts = { filters: useFilters }, cache = new Map();
  each((x, y, z, b) => {
    if (out.length >= max || !b || isAirName(b.name)) return;
    let skip = cache.get(b.name);
    if (skip === undefined) { skip = TREE.test(b.name) || STRUCTURE.test(b.name); cache.set(b.name, skip); }
    if (skip) return;
    const why = whyFloating(get, x, y, z, b, opts);
    if (why) out.push({ rule: "support", at: [x, y, z], name: b.name, detail: why });
  });
  return out;
}

// ---- water ------------------------------------------------------------------------------------------------------------------------
// Static Bedrock flow (conservative): from every water cell, down first; if it cannot go down, spread over the four sides up to 7 cells
// with decreasing level into cells that do not block water; falling resets the reach. Water above water does not spread.
const WATER = /(^|:)(flowing_)?water$/;
const PASS_WATER = /(^|:)(air|cave_air|void_air|structure_void)$|light_block|carpet|banner|torch|ladder|rope|pale_hanging_moss|cave_vines|vine|glow_lichen|spore_blossom|moss_carpet|leaf_litter|wildflowers|petals|firefly_bush|(^|:)bush$|fern|flower|elanor|niphredil|athelas|nectar_bloom|sapling|lily_of_the_valley|candle|sea_pickle|lily_pad|sign|button/;
const blocksWater = (n) => !PASS_WATER.test(n) && !WATER.test(n);
// a waterlogged block (a sea pickle in the basin: the structure's second block layer holds the water, `states.__water` marks it here) holds a water source
export const isWet = (b) => !!b && (WATER.test(b.name) || b.states?.__water === true);
// blocks: Map; allowed: Set "x,y,z" of extra cells the water may enter (default none); returns violations
export function waterCheck(blocks, { allowed = new Set() } = {}) {
  const waters = [];
  for (const [k, b] of blocks) if (isWet(b)) waters.push(k.split(",").map(Number));
  return waterScan((x, y, z) => blocks.get(key(x, y, z)), waters, { allowed });
}
// the generic form: get(x, y, z) -> { name, states } | undefined, waters = [[x, y, z]] of every water cell (the sim passes its assembled world)
export function waterScan(get, waters, { allowed = new Set() } = {}) {
  const out = [];
  if (!waters.length) return out;
  const seen = new Map(); // cell -> best remaining reach
  const leaks = new Set();
  const queue = [];
  const push = (x, y, z, r) => { const k = key(x, y, z); if ((seen.get(k) ?? -1) >= r) return; seen.set(k, r); queue.push([x, y, z, r]); };
  // the vessel rule: a source needs walls on the four sides and a floor
  for (const [x, y, z] of waters) {
    const b = get(x, y, z), depth = WATER.test(b.name) ? b.states?.liquid_depth ?? 0 : 0;
    if (depth === 0) {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
        const q = get(x + dx, y + dy, z + dz);
        if (!q || !(blocksWater(q.name) || isWet(q))) out.push({ rule: "water", at: [x, y, z], detail: `source without a wall ${dx},${dy},${dz} (${q?.name ?? "void"})` });
      }
    }
    push(x, y, z, depth >= 8 || depth === 0 ? 7 : 7 - depth);
  }
  const cap = 20000;
  for (let i = 0; i < queue.length && i < cap; i++) {
    const [x, y, z, r] = queue[i];
    if (seen.get(key(x, y, z)) !== r) continue;
    const below = get(x, y - 1, z);
    if (isWet(below)) continue; // water on water: no spread
    const enter = (nx, ny, nz, nr) => {
      const q = get(nx, ny, nz), k = key(nx, ny, nz);
      if (isWet(q)) return true;
      if (q && blocksWater(q.name)) return false;
      if (allowed.has(k)) { push(nx, ny, nz, nr); return true; }
      if (!leaks.has(k)) { leaks.add(k); out.push({ rule: "water", at: [nx, ny, nz], detail: `water flows into ${q?.name ?? "the void outside the piece"}` }); }
      return true;
    };
    if (!below || !blocksWater(below.name)) { enter(x, y - 1, z, 7); continue; } // falls (void below = leak)
    if (r > 0) for (const [dx, dz] of H4) enter(x + dx, y, z + dz, r - 1);
  }
  return out;
}
