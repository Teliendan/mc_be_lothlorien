// The central tree of the Elven village (M7 showcase WP2; style guide docs/design/village_style.md 7.1, 7.3, 7.6, 0): the Court (lower deck, the rope arrives
// here), the round 5x5 trunk with a slab spiral stair round it (village_mallorn.mjs buildTree, trunk "round5", two levels) up to the Hall, the Hall (an open
// pavilion: slender posts, a low leaf dome on ribs, a chandelier, seats, a lookout bay), the stream (a spring vessel in the trunk, a contained trough along
// one rib, a fall into a raised basin on the Court) and the Loremaster's reading circle. Pure: every function writes into the block map of the tree
// ("x,y,z" -> { name, states }) inside the `structure` hook of buildTree (after the tree and its keep-clear cells, before the dressing). Nothing here is
// verified in game (2026-10-15): the block states are the documented ones (Mojang block metadata), see the notes in docs/design/.
//
// Tree coordinates: trunk axis (0, 0); x east, z south; Court deck layer D (FLOOR_H), Hall deck layer H = D + LEVEL_H. Heights are written h = y - deck.
// Hall (radius 7 + the east bay): the stair ring is at Chebyshev 3, the rails round the stair opening at 4, the Hall's walk ring at 5 (kept clear), the
// seats at 6, the rim posts at 7. The whole Hall stays under H + 5 (the crown piece starts at H + 6).
import { B } from "./flet_mallorn.mjs";
import { key, SHAPES, RAIL, AIR } from "./village_mallorn.mjs";
import { isAirName } from "./village_checks.mjs";
import {
  LEAF, GOLD, heartPlanks, lantern, berries, BANNERS, minorBanner, stairs, stripped, logAlong, wallBanner, slab, candle, trapOpen, jar, carpet, moss, flowerPot, mossBlock, decoratedPot, PLANTS,
} from "./village_dress.mjs";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";

const L = "lothlorien:", M = "minecraft:";
export const HALL_ROWS = [7, 7, 7, 7, 7, 6, 6, 4]; // |z| -> half width in x: 15 x 15, corners cut in 2-cell steps (the walk ring at Chebyshev 5 needs all its 8-neighbours: Chebyshev 6 square stays)
export const HALL_BAY = (x, z) => x >= 8 && x <= 9 && Math.abs(z) <= 2; // the lookout bay, 5 wide, 2 deep, on the east side (over the east bridgehead)
export const COURT_ROWS = SHAPES.octagon23;
export const COURT_CONN = [{ facing: "north", off: -3 }, { facing: "east", off: 2 }, { facing: "south", off: 5 }, { facing: "west", off: -2 }];
export const BASIN = { x0: 0, x1: 2, z0: 8, z1: 10, fall: [1, 9] }; // interior of the Court basin (water at D + 1); the stream falls on (1, 9), the Court's south rim is z = 11
export const SPRING = { x: 1, z: 2 }; // the niche in the south face of the trunk, at H + 4; the trough runs south along x = 1 to the rim post (1, 7) and ends at z = 8

const heartStairs = (facing, half = "bottom") => ({ name: `${L}mallorn_heartwood_stairs`, states: { "minecraft:cardinal_direction": facing, "minecraft:vertical_half": half } });
const strippedAlong = (vec) => ({ name: `${L}mallorn_stripped_log`, states: { "minecraft:block_face": vec[0] !== 0 ? "east" : "south" } });
const strippedWood = () => ({ name: `${L}mallorn_stripped_wood`, states: {} });
const water = (depth = 0) => ({ name: depth ? `${M}flowing_water` : `${M}water`, states: { liquid_depth: depth } });
const chandelier = () => ({ name: `${L}elven_chandelier`, states: { "minecraft:block_face": "down" } });
const sporeBlossom = () => ({ name: `${M}spore_blossom`, states: {} });
const cardinal = (v) => (v[0] === 1 ? "east" : v[0] === -1 ? "west" : v[1] === 1 ? "south" : "north");

// a native cushion (template actor) on a deck cell of layer y; the cell stays free (info.seats counts them, ctx.cushions carries them to the piece writer)
let CUSHIONS = null, CUSHION_KEEP = null;
function cushion(x, y, z, info) { CUSHIONS.push({ x, y, z, variant: [15, 12, 2][CUSHIONS.length % 3] }); for (const h of [1, 2]) CUSHION_KEEP.add(key(x, y + h, z)); info.seats++; } // the cell stays free of dressing

// A writer that refuses to touch a keep-clear cell or a non-air block (leaves may be replaced): a bug in the layout must stop the build, never overwrite.
function writer(blocks, keep) {
  const nameAt = (x, y, z) => blocks.get(key(x, y, z))?.name;
  const can = (x, y, z, leaf = true) => { const n = nameAt(x, y, z); return !keep.has(key(x, y, z)) && (isAirName(n) || (leaf && n === B.leaves)); };
  const put = (x, y, z, blk, leaf = true) => {
    if (!can(x, y, z, leaf)) throw new Error(`central: ${blk.name} at ${x},${y},${z} ${keep.has(key(x, y, z)) ? "is in a keep-clear cell" : `would replace ${nameAt(x, y, z)}`}`);
    blocks.set(key(x, y, z), blk);
  };
  const soft = (x, y, z, blk) => { if (can(x, y, z)) { blocks.set(key(x, y, z), blk); return true; } return false; }; // like put, but a refused cell is simply skipped
  return { put, soft, can, nameAt };
}

// ---- the heartwood ring of both decks (the dressing would swap the same cells; done here first so that the elf posts keep off it) ------------------------------
export function heartwoodRings(ctx) {
  const { blocks, D, H } = ctx;
  for (const [Y, dist] of [[D, 5], [H, 6]]) for (const [k, v] of [...blocks]) {
    const [x, y, z] = k.split(",").map(Number);
    if (y === Y && Math.max(Math.abs(x), Math.abs(z)) === dist && v.name === B.planks) blocks.set(k, heartPlanks());
  }
}

// ---- the Hall ----------------------------------------------------------------------------------------------------------------------------------------------------
export function buildHall(ctx) {
  CUSHIONS = ctx.cushions; CUSHION_KEEP = ctx.keep;
  const { blocks, keep, H, seed } = ctx, floor = ctx.deckObjs[1].floor;
  const { put, soft, can, nameAt } = writer(blocks, keep), rnd = makeRandom((seed ^ 0x7a11) >>> 0);
  const isFloor = (x, z) => floor.has(`${x},${z}`), Y = (h) => H + h;
  const cheb = (x, z) => Math.max(Math.abs(x), Math.abs(z));
  const rim = [...floor].map((c) => c.split(",").map(Number)).filter(([x, z]) => nameAt(x, Y(1), z) === RAIL);
  const rimSet = new Set(rim.map((c) => c.join(",")));
  const info = { posts: 0, lamps: 0, seats: 0, ribs: [], banners: 0 };

  // posts: slender stripped logs on the rim rail posts (the rail stays the foot), 2 + 3 high; the trough's post carries its floor at +3
  const posts = [[-4, -7], [0, -7], [4, -7], [-4, 7], [SPRING.x, 7], [4, 7], [-7, -3], [-7, 0], [-7, 3], [-6, -6], [6, -6], [-6, 6], [6, 6], [7, -4], [7, 4], [9, -2], [9, 2]];
  for (const [x, z] of posts) {
    if (!rimSet.has(`${x},${z}`)) throw new Error(`Hall post ${x},${z} is not a rim cell`);
    blocks.set(key(x, Y(1), z), stripped()); // the post is one stripped log from the deck up: it replaces the rail fence under it
    put(x, Y(2), z, stripped());
    if (!(x === SPRING.x && z === 7)) put(x, Y(3), z, stripped());
    info.posts++;
  }
  // ring beam at +4 over the rim cells (the bay only along its outer edge x = 9), ribs from the trunk
  const axisOf = (x, z) => (rimSet.has(`${x + 1},${z}`) || rimSet.has(`${x - 1},${z}`) ? [1, 0] : [0, 1]);
  const beam = new Set();
  for (const [x, z] of rim) {
    if (HALL_BAY(x, z) && x !== 9) continue;
    if (x === SPRING.x && z === 7) continue; // the trough passes here
    put(x, Y(4), z, strippedAlong(HALL_BAY(x, z) ? [0, 1] : axisOf(x, z))); beam.add(`${x},${z}`); // the beam is stripped like the posts, the ribs keep their bark
  }
  const ribs = [ // [axis vector, cells from the trunk face to the tip]
    { v: [0, -1], cells: range(3, 8).map((d) => [0, -d]) }, { v: [-1, 0], cells: range(3, 8).map((d) => [-d, 0]) }, { v: [1, 0], cells: range(3, 9).map((d) => [d, 0]) },
  ];
  const ribSet = new Set();
  for (const r of ribs) for (const [x, z] of r.cells) {
    const k = `${x},${z}`; ribSet.add(k);
    if (beam.has(k)) blocks.set(key(x, Y(4), z), logAlong(r.v)); else put(x, Y(4), z, logAlong(r.v)); // the rib wins where it crosses the beam
  }
  // dome: leaves at +4 over the footprint inside the beam, a crest at +5 (hypot <= 5.6) with golden spokes; a slot over the stream
  const slot = (x, z) => z >= 3 && x >= SPRING.x - 1 && x <= SPRING.x + 1;
  for (const k of floor) {
    const [x, z] = k.split(",").map(Number);
    if (HALL_BAY(x, z) || cheb(x, z) < 3 || beam.has(k) || ribSet.has(k) || slot(x, z) || (x === SPRING.x && z === 7)) continue;
    soft(x, Y(4), z, LEAF()); // a closed ring of leaves at +4 over the whole footprint (the owner saw the lattice and the open corners as holes in the roof)
    const h = Math.hypot(x, z);
    if (h <= 5.7 && !slot(x, z)) soft(x, Y(5), z, (x === 0 || z === 0 || Math.abs(x) === Math.abs(z)) && h >= 3 ? GOLD() : LEAF());
  }
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) soft(x, Y(5), z, LEAF()); // a leaf cap on each corner pillar
  // eaves: a leaf fringe just outside the beam at +4, here and there moss hanging from it
  for (const [x, z] of rim) {
    if (HALL_BAY(x, z)) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ox = x + dx, oz = z + dz;
      if (isFloor(ox, oz) || (ox === SPRING.x && oz >= 7) || (Math.abs(ox - SPRING.x) <= 1 && oz >= 7)) continue;
      if (!soft(ox, Y(4), oz, LEAF())) continue;
      const r = rnd(); // glow berries (warm light) and moss hang from the eave leaves
      if (r < 0.4 && can(ox, Y(3), oz) && can(ox, Y(2), oz)) { put(ox, Y(3), oz, berries(false)); put(ox, Y(2), oz, berries(true)); info.berries = (info.berries ?? 0) + 1; }
      else if (r < 0.55) soft(ox, Y(3), oz, moss(true));
    }
  }
  for (const r of ribs) { // tuft round each rib tip (no bare branch end) and a gold lantern hanging under it
    const [tx, tz] = r.cells[r.cells.length - 1];
    if (HALL_BAY(tx, tz)) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) soft(tx + dx, Y(4), tz + dz, LEAF());
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) soft(tx + dx, Y(5), tz + dz, LEAF());
    put(tx, Y(3), tz, lantern(true, true)); info.lamps++;
  }

  // the lookout bay: a bench of three stairs facing out, two gate posts joined by a beam, a gold lantern from it, a banner on a post, a jar and a pot
  for (const z of [-1, 0, 1]) cushion(8, H, z, info); // three native cushions looking east, over the bridge
  for (const s of [-1, 1]) for (const [x, h, z] of [[9, 4, 3], [9, 5, 3], [10, 4, 2], [10, 5, 2], [9, 5, 2], [8, 5, 2], [8, 4, 2]]) soft(x, Y(h), z * s, LEAF()); // a tuft on each end of the gate beam (no bare branch end)
  put(9, Y(3), 0, lantern(true, true)); info.lamps++;
  put(8, Y(3), 2, wallBanner([-1, 0], minorBanner(rnd))); info.banners++;
  put(9, Y(2), 1, jar()); // on the rail posts beside the posts
  put(9, Y(2), -1, flowerPot(PLANTS[0]));

  // seats at 6 round the walk ring (look at the trunk: the stream), candle groups between the groups of seats
  const seat = (x, z) => { if (can(x, Y(1), z) && isFloor(x, z)) cushion(x, H, z, info); }; // native cushions, no stairs (the engine links fences to stairs)
  for (const t of [-3, -1, 1, 3]) {
    seat(t, -6); seat(-6, t);
    if (t !== -1 && t !== 1 && !(t === SPRING.x)) seat(t, 6);
    if (!(Math.abs(t) <= 1)) seat(6, t);
  }
  seat(-1, 6);
  const candles = [[0, -6], [-6, 0], [2, 6], [6, -2], [6, 2]];
  for (const [x, z] of candles) if (isFloor(x, z) && can(x, Y(1), z)) put(x, Y(1), z, candle(3));
  // golden leaf knots on three ribs of the crest (review 2026-10-15: froglights here read as bare white cubes on top of the dome), banners on four posts looking inward
  for (const [x, z] of [[0, -4], [-4, 0], [4, 0]]) blocks.set(key(x, Y(5), z), { name: "lothlorien:mallorn_golden_leaves", states: {} });
  // four banners on Hall rim posts looking inward (review 2026-10-16: a little more on the upper floor): the original design on three, one light blue
  [[-4, -7, [0, 1], BANNERS.watch], [4, -7, [0, 1], minorBanner(rnd)], [-4, 7, [0, -1], BANNERS.watch], [4, 7, [0, -1], BANNERS.watch]].forEach(([px, pz, d, spec]) => { if (soft(px + d[0], Y(3), pz + d[1], wallBanner(d, spec))) info.banners++; });
  for (const [x, z] of [[-2, -7], [2, -7], [-7, -2], [-7, 2]]) if (nameAt(x, Y(1), z) === RAIL && can(x, Y(2), z)) put(x, Y(2), z, jar()); // firefly jars on the rim rails
  // the chandelier: under the east rib, over the walk ring, facing the bay
  put(5, Y(3), 0, chandelier()); info.lamps++;
  // spore blossoms (central tree only) under the ribs near the crown
  for (const [x, z] of [[-4, 0], [0, -4]]) if (can(x, Y(3), z)) put(x, Y(3), z, sporeBlossom());
  return info;
}
const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

// ---- the stream (7.3): spring vessel, trough, fall, basin --------------------------------------------------------------------------------------------------------
// Water cells: the niche (1, 2, H+4), the trough sources (1, 3..8, H+4), the fall (1, 9, H+4 .. D+2) as falling water, the basin sources (x 0..2, z 8..9, D+1).
// Every source has walls on its four sides and below (the niche: heartwood on both sides, the trunk behind, the trough in front); the fall is the only flow.
export function buildStream(ctx) {
  const { blocks, keep, D, H } = ctx, { put, nameAt } = writer(blocks, keep);
  const Y = (h) => H + h, sx = SPRING.x;
  // the niche: heartwood frame (left, right, below), a hood (an upside-down heartwood stair) carved from the trunk's face, the trunk behind
  const swap = (x, y, z, blk) => { const n = nameAt(x, y, z); if (n !== B.log && n !== B.wood) throw new Error(`spring: ${x},${y},${z} is ${n}, not trunk wood`); blocks.set(key(x, y, z), blk); };
  swap(sx - 1, Y(4), SPRING.z, heartPlanks()); swap(sx + 1, Y(4), SPRING.z, heartPlanks()); swap(sx, Y(3), SPRING.z, heartPlanks());
  swap(sx, Y(5), SPRING.z, heartStairs("north", "top")); // hood: the back (high step) toward the trunk, its open step overhangs the niche
  if (nameAt(sx, Y(4), SPRING.z - 1) !== B.log) throw new Error("spring: no trunk behind the niche");
  const set = (x, y, z, blk, extra = []) => { const n = nameAt(x, y, z); if (n === B.leaves || isAirName(n) || extra.includes(n)) blocks.set(key(x, y, z), blk); else throw new Error(`stream: ${blk.name} at ${x},${y},${z} would replace ${n}`); };
  set(sx, Y(4), SPRING.z, water(), [B.log]); // the niche itself is carved from the trunk
  // the trough: floor of heartwood planks at +3, walls of stripped wood at +4, water at +4 from z = 3 to 8; the rim post (1, 7) carries it
  for (let z = SPRING.z + 1; z <= 8; z++) {
    set(sx, Y(3), z, heartPlanks()); set(sx - 1, Y(4), z, strippedWood(), [B.log, `${L}mallorn_stripped_log`]); set(sx + 1, Y(4), z, strippedWood(), [B.log, `${L}mallorn_stripped_log`]); // (at the rim the walls replace beam logs)
    set(sx, Y(4), z, water());
  }
  // the fall: outside the Hall's rail, 2 cells beyond the rim, down to the basin
  const [fx, fz] = BASIN.fall;
  for (let y = Y(4); y >= D + 2; y--) set(fx, y, fz, water(8));
  // the basin on the Court: a raised vessel (floor = the deck, a rim of stripped wood at +1 with log corners, water at +1), lily pads, a sea pickle
  const { x0, x1, z0, z1 } = BASIN, inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) {
    if (inside(x, z)) continue;
    const corner = (x === x0 - 1 || x === x1 + 1) && (z === z0 - 1 || z === z1 + 1);
    const old = nameAt(x, D + 1, z);
    if (old === RAIL) blocks.set(key(x, D + 1, z), corner ? stripped() : strippedWood()); // the Court's rim rail gives way to the basin wall
    else set(x, D + 1, z, corner ? stripped() : strippedWood()); // (corner posts of stripped log: a heartwood block there would be a walking surface of its own)
  }
  const unlink = (x, z, side) => { const b = blocks.get(key(x, D + 1, z)); if (b?.name === RAIL && b.states[`minecraft:connection_${side}`]) blocks.set(key(x, D + 1, z), { ...b, states: { ...b.states, [`minecraft:connection_${side}`]: false } }); };
  unlink(x0 - 2, z1 + 1, "east"); unlink(x1 + 2, z1 + 1, "west"); // the rim rails beside the basin no longer link into it
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) set(x, D + 1, z, water());
  blocks.set(key(x1, D + 1, z0 + 1), { name: `${M}sea_pickle`, states: { cluster_count: 2, dead_bit: false, __water: true } }); // waterlogged: the liquid layer holds the water
  for (const [x, z] of [[x0, z0], [x1, z1], [x0, z1]]) set(x, D + 2, z, { name: `${M}waterlily`, states: {} });
  // a firefly jar on each corner post of the basin (the lamp budget of the central tree goes to the bridgeheads, the arms and the Hall)
  for (const x of [x0 - 1, x1 + 1]) for (const z of [z0 - 1, z1 + 1]) set(x, D + 2, z, jar());
  return { water: [[sx, Y(4), SPRING.z]] };
}

// every water cell of the central piece (the generator declares them to waterCheck: the check itself finds the vessel / flow violations)
export const waterCells = (blocks) => [...blocks].filter(([, b]) => /water$/.test(b.name) || b.states?.__water).map(([k]) => k);

// ---- the Court ---------------------------------------------------------------------------------------------------------------------------------------------------
// banners on the trunk's north face either side of the rope (the visitor's first sight), the reading circle at the north rim
export function buildCourt(ctx) {
  CUSHIONS = ctx.cushions; CUSHION_KEEP = ctx.keep;
  const { blocks, keep, D, seed } = ctx, { put, can, nameAt } = writer(blocks, keep), rnd = makeRandom((seed ^ 0x1007) >>> 0);
  const Y = (h) => D + h, info = { banners: 0, books: 0, seats: 0 };
  for (const [x, spec] of [[-1, BANNERS.watch], [1, BANNERS.watch]]) { put(x, Y(4), -3, wallBanner([0, -1], spec)); info.banners++; }
  // reading circle: chiseled shelves against the north rim rail (inside it), the lectern in front, six seats in a half ring, a candle group, a banner pole
  const rail = (x, z) => nameAt(x, Y(1), z) === RAIL;
  for (let x = 1; x <= 4; x++) if (!rail(x, -10) && rail(x, -11)) { // the shelves stand on the deck cell in front of the rim rail
    const chiseled = x === 2 || x === 3;
    for (const h of [1, 2]) put(x, Y(h), -10, chiseled ? { name: `${M}chiseled_bookshelf`, states: { books_stored: [63, 36, 54, 45][(x + h) % 4], direction: 0 } } : { name: `${M}bookshelf`, states: {} });
    info.books++;
  }
  put(3, Y(1), -9, { name: `${M}lectern`, states: { "minecraft:cardinal_direction": "south", powered_bit: false } });
  const seat = (x, z) => { if (can(x, Y(1), z)) cushion(x, D, z, info); }; // the half ring of the reading circle: native cushions
  seat(1, -9); seat(1, -8); seat(5, -9); seat(5, -8); seat(2, -7); seat(4, -7);
  for (const x of [2, 3, 4]) put(x, Y(1), -8, { name: `${M}light_blue_carpet`, states: {} }); // a rug in front of the lectern
  put(0, Y(1), -8, candle(3)); // a candle group by the shelves
  put(0, Y(1), -9, decoratedPot());
  // a banner on a stripped-log pole beside the shelves, the cloth hangs on its south face over the seats
  if (can(5, Y(1), -10)) { for (const h of [1, 2, 3]) put(5, Y(h), -10, stripped()); put(5, Y(3), -9, wallBanner([0, 1], minorBanner(rnd))); info.banners++; } // (the pole stands on the deck: no walled-in deck cell behind it)
  return info;
}
