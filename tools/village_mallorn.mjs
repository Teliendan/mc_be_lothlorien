// Geometry for the Elven village jigsaw pieces (connector standard and design: docs/design/lothlorien_jigsaw_settlement.md):
// platform decks with rim connectors, the one-and-only rail block, slab arches, the slab spiral stair, crown pieces.
// Pure: build_village.mjs writes the files.
//
// Tree-piece coordinates: trunk centre (0,0), y 0 = the first block above the nominal ground, roots down to -ROOTS.
// The box is (2*hx+1) x (2*hz+1), so toMcstructure offset = [hx, ROOTS, hz].
import { makeBuilder, makeRandom, DIRS8 } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { B, LEAF_KEEP, trimFarLeaves, roundFoot, bentBranch, bareBranchEnds } from "./flet_mallorn.mjs"; // the giant Mallorns' foot and bent branch (Phase 5, accepted in game)
import { keepClearCells } from "./village_checks.mjs";
import { dressTree, lantern as dressLantern } from "./village_dress.mjs"; // deck dressing, art lamps and the home pavilion (M7 WP3)
import { addHiddenLights } from "./village_light.mjs";

export { bareBranchEnds }; // the generator check lives in flet_mallorn.mjs (the giants use it too)
export const ROOTS = 18; // trunks and pillars reach this far below the nominal ground (levels up to +16 still reach the ground)
export const FLOOR_H = 16; // lower deck above the nominal ground
export const LEVEL_H = 8; // upper deck of a two-level node above its lower deck
export const CROWN_AT = 5; // the crown jigsaw sits CROWN_AT layers above the highest deck: crown box starts at deck + 6,
//                            above the headroom (3) and the top of the highest arch box (rise 2: deck + 5)
export const DECK_NAME = "lothlorien:village_deck";
export const DECK_HI_NAME = "lothlorien:village_deck_hi"; // upper-level connectors of two-level nodes: parent role only
export const CROWN_NAME = "lothlorien:village_crown";
export const ANCHOR_NAME = "lothlorien:village_anchor";
export const LANTERN = "lothlorien:elven_lantern";
export const SLAB = "lothlorien:mallorn_slab";
// THE rail block of every walkway, platform, balcony and plug. The engine drops some fence links when it places a
// structure (cause: engine, not the templates), so the owner may pick another rail block: change it here only.
// writeRails() stores `minecraft:connection_*` states, which only fence-like blocks have.
export const RAIL = B.fence;
// facing_direction ids: 0 down, 1 up, 2 north (-z), 3 south (+z), 4 west (-x), 5 east (+x)
export const FACING = { north: { d: [0, -1], id: 2 }, south: { d: [0, 1], id: 3 }, west: { d: [-1, 0], id: 4 }, east: { d: [1, 0], id: 5 } };
export const key = (x, y, z) => `${x},${y},${z}`;
export const AIR = { name: "minecraft:air", states: {} };
export const planks = () => ({ name: B.planks, states: {} });
export const slab = (half = "bottom") => ({ name: SLAB, states: { "minecraft:vertical_half": half } });
const logBlock = (face = "up") => ({ name: B.log, states: { "minecraft:block_face": face } });

export const deckJigsaw = (facing, pool, name = DECK_NAME) => ({
  name: "minecraft:jigsaw", states: { facing_direction: FACING[facing].id, rotation: 0 },
  jigsaw: name, jigsawTarget: DECK_NAME, jigsawPool: pool, joint: "aligned", finalState: B.planks,
});
// The trunk becomes a log where the two jigsaws meet. The plain id gives the default block_face (down), which is the
// vertical axis like `up` (the log's permutations treat both alike), so no state string is needed.
export const crownUpJigsaw = (pool) => ({
  name: "minecraft:jigsaw", states: { facing_direction: 1, rotation: 0 },
  jigsaw: CROWN_NAME, jigsawTarget: CROWN_NAME, jigsawPool: pool, joint: "rollable", finalState: B.log,
});
export const crownDownJigsaw = () => ({
  name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 },
  jigsaw: CROWN_NAME, jigsawTarget: CROWN_NAME, jigsawPool: "minecraft:empty", joint: "rollable", finalState: B.log,
});
export const anchorJigsaw = () => ({
  name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 }, jigsaw: ANCHOR_NAME, finalState: B.log,
});
export const lantern = () => ({ name: LANTERN, states: { "minecraft:block_face": "up" } });
export const lonelyRail = () => ({
  name: RAIL, states: { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false },
});

// rails: Set of "x,y,z"; forced: Map "x,y,z" -> sides that link to a rail outside the piece
export function writeRails(blocks, rails, forced = new Map()) {
  for (const k of rails) {
    const [x, y, z] = k.split(",").map(Number);
    const states = {};
    for (const [side, { d }] of Object.entries(FACING)) {
      states[`minecraft:connection_${side}`] = rails.has(key(x + d[0], y, z + d[1])) || (forced.get(k) ?? []).includes(side);
    }
    blocks.set(k, { name: RAIL, states });
  }
}

// ---- platform shapes --------------------------------------------------------------------------------------------
// A shape is an array of half-widths: rows[|z|] = half-width in x at that |z|. Outlines are rectilinear (straight runs and
// square corners, runs of >= 2 cells), never a diagonal staircase of single cells.
export const SHAPES = {
  cutrect13: [6, 6, 6, 6, 4, 4], // 13 x 11, corners cut 2 x 2
  cutrect11: [5, 5, 5, 5, 3, 3], // 11 x 11
  cutrect17: [8, 8, 8, 8, 6, 6], // 17 x 11
  octagon15: [7, 7, 7, 7, 5, 5, 3, 3], // 15 x 15, two 2-cell steps per corner
  plus15: [7, 7, 7, 7, 3, 3, 3, 3], // 15 x 15, arms 7 wide
  plus15w: [7, 7, 7, 7, 4, 4, 4, 4], // 15 x 15, arms 9 wide: the cell (4, 4) exists, so a walk ring round a stair (rails at radius 3) fits at radius 4
  oval17: [8, 8, 8, 6, 6, 4, 4], // 17 x 13, ends 5 wide
  octagon21: [10, 10, 10, 10, 10, 10, 8, 8, 6, 6, 6], // 21 x 21 (the central Court before M7)
  octagon23: [11, 11, 11, 11, 11, 11, 9, 9, 7, 7, 7, 7], // central Court, 23 x 23: room for the stair ring, the walk ring, the basin, the reading circle and 7 elf posts
  lookout9: [4, 4, 4, 2, 2], // 9 x 9 (before phase 3)
  lookout11: [5, 5, 5, 5, 2, 2], // 11 x 11: a 11 x 7 band with 5-wide arms north and south: corner pockets for a seat bay and beds (phase 3). East / west are 7-long platform sides (sideAt), south is a 5-run exit
  // home wings (M7 WP3 revision): the nodes' own shapes grown so that a free face has 5 deck cells of depth beside the walk ring (a pavilion square, k >= 5)
  cutrect15: [7, 7, 7, 7, 4, 4], // 15 x 11 (node_a)
  cutrect13e: [7, 7, 7, 7, 3, 3], // 15 x 11, short ends (node_e)
  oval17h: [8, 8, 8, 8, 6, 6, 4, 4], // 17 x 15 (node_d)
  cutrect17h: [8, 8, 8, 8, 6, 6, 4, 4], // 17 x 15 (node_f)
  octagon17: [8, 8, 8, 8, 7, 7, 5, 5, 3], // 17 x 17 (tower_a)
  plus17w: [8, 8, 8, 8, 4, 4, 4, 4], // 17 x 15, arms 9 wide (tower_b lower)
  octagon17w: [8, 8, 8, 8, 5, 5, 3, 3], // 17 x 15 (tower_b upper)
};
export const shapeCells = (rows) => {
  const s = new Set(), hz = rows.length - 1;
  for (let z = -hz; z <= hz; z++) for (let x = -rows[Math.abs(z)]; x <= rows[Math.abs(z)]; x++) s.add(`${x},${z}`);
  return s;
};
// the straight run on the outer face of a shape in direction `facing`: { a: distance of the face, lo, hi: offsets along the face }
export function faceRun(cells, facing) {
  const { d } = FACING[facing], p = [-d[1], d[0]];
  let a = -1e9, lo = 1e9, hi = -1e9;
  for (const c of cells) { const [x, z] = c.split(",").map(Number); a = Math.max(a, x * d[0] + z * d[1]); }
  for (const c of cells) {
    const [x, z] = c.split(",").map(Number);
    if (x * d[0] + z * d[1] !== a) continue;
    const o = x * p[0] + z * p[1]; lo = Math.min(lo, o); hi = Math.max(hi, o);
  }
  return { a, lo, hi };
}

const N8 = DIRS8;
// A deck layer at height y over a shape. Connectors sit on the rim cells of the box face (no stub walkways):
// deck under 5 cells, 3 walk cells (headroom air), rails at +-2.
export class Deck {
  constructor(blocks, y, rows, { box, inner = new Set(), holes = new Set(), noRail = new Set(), cells = null, topSlabs = new Set() }) {
    Object.assign(this, { blocks, y, rows, box, inner, holes, noRail, topSlabs });
    this.cells = cells ?? shapeCells(rows);
    this.connectors = []; // { x, z, facing, pool, name }
  }
  connect(facing, off, pool, name = DECK_NAME) {
    const { d } = FACING[facing], p = [-d[1], d[0]];
    const run = faceRun(this.cells, facing), half = d[0] ? this.box.hx : this.box.hz;
    if (run.a !== half) throw new Error(`${facing} face of the deck is not on the box face (${run.a} vs ${half})`);
    if (off - 2 < run.lo || off + 2 > run.hi) throw new Error(`${facing} connector offset ${off} does not fit the face run ${run.lo}..${run.hi}`);
    this.connectors.push({ x: d[0] * half + p[0] * off, z: d[1] * half + p[1] * off, facing, off, pool, name, p, d });
  }
  // writes planks, headroom air and jigsaws; returns the rails { rails: Set "x,y,z", forced: Map }
  build() {
    const { blocks, y } = this;
    const floor = new Set([...this.cells].filter((c) => !this.inner.has(c) && !this.holes.has(c)));
    const occupied = (x, z) => floor.has(`${x},${z}`) || this.inner.has(`${x},${z}`);
    const rim = new Set();
    for (const c of floor) {
      const [x, z] = c.split(",").map(Number);
      if (N8.some(([dx, dz]) => !occupied(x + dx, z + dz))) rim.add(c);
    }
    const forced = new Map();
    for (const c of this.connectors) {
      for (let o = -1; o <= 1; o++) rim.delete(`${c.x + c.p[0] * o},${c.z + c.p[1] * o}`);
      for (const o of [-2, 2]) {
        const k = `${c.x + c.p[0] * o},${c.z + c.p[1] * o}`;
        if (!floor.has(k)) throw new Error(`connector ${c.facing} rail cell ${k} is not deck`);
        rim.add(k);
        const [fx, fz] = k.split(",").map(Number);
        forced.set(key(fx, y + 1, fz), [c.facing]);
      }
    }
    for (const k of this.noRail) rim.delete(k);
    for (const k of floor) {
      const [x, z] = k.split(",").map(Number);
      for (let h = 1; h <= 3; h++) blocks.set(key(x, y + h, z), AIR);
      blocks.set(key(x, y, z), this.topSlabs.has(k) ? slab("top") : planks()); // top slab: walking surface as high as the deck, headroom 0.5 lower
    }
    const rails = new Set();
    for (const k of rim) { const [x, z] = k.split(",").map(Number); rails.add(key(x, y + 1, z)); }
    for (const c of this.connectors) blocks.set(key(c.x, y, c.z), deckJigsaw(c.facing, c.pool, c.name));
    this.floor = floor; this.rim = rim;
    return { rails, forced };
  }
}

// ---- trees --------------------------------------------------------------------------------------------------------
const PLUS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const ROUND5 = (() => { const c = []; for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (!(Math.abs(x) === 2 && Math.abs(z) === 2)) c.push([x, z]); return c; })();
const SQUARE3 = (() => { const c = []; for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) c.push([x, z]); return c; })();
const TRUNKS = { plus: { cells: PLUS, r: 1 }, square3: { cells: SQUARE3, r: 1 }, round5: { cells: ROUND5, r: 2 } };
const leafBlock = () => ({ name: B.leaves, states: { "lothlorien:persistent": false } });
export const RING = (() => { // the 16 cells around the 3x3 trunk, clockwise from the NW corner
  const r = [];
  for (let x = -2; x <= 2; x++) r.push([x, -2]);
  for (let z = -1; z <= 2; z++) r.push([2, z]);
  for (let x = 1; x >= -2; x--) r.push([x, 2]);
  for (let z = 1; z >= -1; z--) r.push([-2, z]);
  return r;
})();
// The central tree: round 5x5 trunk, stair ring at Chebyshev 3 (24 cells; the climb uses 16 of them, i = 0..15, clockwise, exit i = 14, 15 on the west
// side at (-3, 0), (-3, -1); the other 8 cells are the flat deck on the north side with the rope). RING7 clockwise from the NW corner.
export const RING7 = (() => {
  const r = [];
  for (let x = -3; x <= 3; x++) r.push([x, -3]);
  for (let z = -2; z <= 3; z++) r.push([3, z]);
  for (let x = 2; x >= -3; x--) r.push([x, 3]);
  for (let z = 2; z >= -2; z--) r.push([-3, z]);
  return r;
})();
export const STAIR7 = Array.from({ length: 16 }, (_, i) => RING7[(i + 7) % 24]);
export const CORNERS5 = [[-2, -2], [2, -2], [-2, 2], [2, 2]]; // the four cells the round 5x5 trunk lacks: stripped-down pillars between the decks (the stair's inner wall)
// stair cell i: walking surface 3 + i half-blocks above the lower deck's block bottom (deck surface = 2): planks on even
// surfaces, a bottom slab on odd ones; one half-step (0.5 block, steppable without jumping) per cell
export const stairLayer = (i) => { const s = 3 + i; return s % 2 === 0 ? (s - 2) / 2 : (s - 1) / 2; };
// The upper floor over the spiral (ring cells 9..13; 0..8 are under full deck, 14 and 15 are the exit). Owner 2026-10-08: "the slab over the
// head is too low, a standing man can't go through". A walker steps from tread i to tread i+1 (half a block higher) with his body still over
// column i, so the ceiling over cell i must clear the NEXT tread: ceiling - stairS(i + 1) >= 4 half-blocks (1.8 + margin 0.1 -> 2.0 blocks).
// A full deck block has its bottom at 2 * LEVEL_H, a top slab at 2 * LEVEL_H + 1; only the rest stays open (and is railed on the deck).
const stairS = (i) => 3 + i;
const NEED = 4; // half-blocks of free space above the feet (1.8 + 0.1 margin, rounded up to half-blocks)
const ringOver = [9, 10, 11, 12, 13];
export const STAIR_FULL = ringOver.filter((i) => 2 * LEVEL_H - stairS(i + 1) >= NEED); // full deck over these ring cells
export const STAIR_TOP = ringOver.filter((i) => !STAIR_FULL.includes(i) && 2 * LEVEL_H + 1 - stairS(i + 1) >= NEED); // top slab at floor level (carries the rail)
export const STAIR_CUT = ringOver.filter((i) => !STAIR_FULL.includes(i) && !STAIR_TOP.includes(i)); // the remaining opening, railed on the deck

// Rail step links (same rule as the arched bridges, round 4a): when a rail goes from (x, y, z) to the next column one higher, a post at
// (next column, y) closes the diagonal gap ("up-forward corner"); a same-height diagonal pair gets the outer cell. Mutates `set`.
export function linkRails(set) {
  const has = (x, y, z) => set.has(key(x, y, z));
  for (let again = true; again;) {
    again = false;
    for (const k of [...set]) {
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (has(x + dx, y + 1, z + dz) && !has(x + dx, y, z + dz) && !has(x, y + 1, z)) { set.add(key(x + dx, y, z + dz)); again = true; }
        if (dx !== 0) for (const sz of [1, -1]) {
          if (has(x + dx, y, z + sz) && !has(x + dx, y, z) && !has(x, y, z + sz)) { // diagonal only: the cell farther from the trunk
            const a = [x + dx, z], c = [x, z + sz];
            set.add(key(...(Math.hypot(...a) >= Math.hypot(...c) ? [a[0], y, a[1]] : [c[0], y, c[1]]))); again = true;
          }
        }
      }
    }
  }
}

// opts: name-free tree builder.
//   levels: [{ rows, conn: [{ facing, off, hi? }], clip?: (x, z) => remove this cell }] one entry (single level) or two (lower, upper at +LEVEL_H, slab stair)
//   trunk: "plus" | "square3" | "round5"; seed; upPool (pool of the crown jigsaw); rope; anchor
// Returns { blocks, connectors, box, topY, size, origin, keep (Set of keep-clear cells), keepOpts, lights (hidden lights placed) }.
export function buildTree({ levels, trunk = "plus", seed, pool, upPool, rope = false, anchor = false, dress = true, hooks = {}, dressOpts = {} }) {
  const random = makeRandom(seed), b = makeBuilder(random);
  const tk = TRUNKS[trunk], rT = tk.r, two = levels.length === 2, central = trunk === "round5";
  const D = FLOOR_H, topY = two ? D + LEVEL_H : D; // y of the highest deck
  const hx = Math.max(...levels.flatMap((l) => l.rows)), hz = Math.max(...levels.map((l) => l.rows.length - 1));
  const box = { hx, hz };
  const inner = new Set(tk.cells.map(([x, z]) => `${x},${z}`));
  if (central && two) for (const [x, z] of CORNERS5) inner.add(`${x},${z}`); // the stair's inner pillars (see below)
  const ropeAt = rope ? { x: 0, z: -(rT + 1) } : null;
  if (ropeAt) inner.add(`${ropeAt.x},${ropeAt.z}`);

  // trunk sunk ROOTS into the ground; it keeps its full section up to the crown, and the crown piece goes on with the same
  // section (3x3 for village trees, round 5x5 for the central one): a plus-shaped trunk widens to 3x3 in the top two layers
  const crownCells = trunk === "round5" ? ROUND5 : SQUARE3;
  const pillars = central && two; // central tower: the trunk's four missing corner cells are filled between the Court and just under the Hall's crown (topY + 4) (the stair ring has no pit against them)
  for (let y = -ROOTS; y <= topY + CROWN_AT; y++) {
    for (const [x, z] of y === topY + CROWN_AT && !central ? [[0, 0]] : y >= topY + 4 ? crownCells : tk.cells) b.addLog(x, y, z, "up"); // (the top layer is only the crown jigsaw: the leaf cap below hugs it)
    if (pillars && y >= D && y <= topY + 4) for (const [x, z] of CORNERS5) b.addLog(x, y, z, "up");
  }

  // foot: the giants' root flare (flet_mallorn.mjs roundFoot) at nominal ground level, bark above ground, logs below; it keeps the
  // rope column free. The trunk itself goes on down to -ROOTS as plain logs; the flare's own footprint goes 8 down.
  roundFoot(b, makeRandom(seed ^ 0x51ed), ropeAt, { C: 0, R0: trunk === "round5" ? 2.3 : 1.6, depth: 8, scale: trunk === "round5" ? 1.7 : 0.85, extra: trunk === "round5" ? 1 : 0 });
  // under each deck: woven struts one layer below it (diagonals, never on the walkway axes) with hanging leaves; low branches
  const decks = two ? [D, D + LEVEL_H] : [D];
  const lenW = Math.round(Math.min(hx, hz) * 0.9);
  for (const Y of central && two ? [D] : decks) for (const [dx, dz] of DIRS8.slice(4)) { // (the central Hall hangs no struts and blobs into the Court's air: the Court stays open and visible)
    let x = dx * rT, z = 0;
    for (let i = 1; i <= lenW; i++) {
      if (i % 2 === 1) x += dx; else z += dz;
      b.addLog(x, Y - 1, z, i % 2 === 1 ? "east" : "south");
    }
    b.blob(x, Y - 2, z, 2.4 + random() * 0.6, 1.8, Y - 6, 0.7);
  }
  // bent low branches on the bare trunk (as the giants' lush ones), each with a leaf blob; the central tree gets more, and longer ones
  const reachMax = Math.min(hx, hz) - rT - 3;
  for (let i = 0, n = (central ? 7 : 3) + Math.floor(random() * 2); i < n; i++) {
    const [dx, dz] = DIRS8[Math.floor(random() * 8)];
    const sx = dx !== 0 ? dx * rT : 0, sz = dx !== 0 ? 0 : dz * rT;
    bentBranch(b, random, sx, sz, dx, dz, b.between([4, D - 7]), Math.max(3, b.between([central ? 6 : 3, reachMax])), 0.3, 2.0 + random() * 0.8);
  }
  const tree = b.result(topY + CROWN_AT);
  const blocks = new Map();
  for (const c of tree.leaves) blocks.set(key(c.x, c.y, c.z), leafBlock());
  for (const c of tree.logs) blocks.set(key(c.x, c.y, c.z), c.face === "wood" ? { name: B.wood, states: {} } : logBlock(c.face));
  // leaves: inside the box, under the highest deck
  for (const [k, v] of [...blocks]) {
    if (v.name !== B.leaves) continue;
    const [x, y, z] = k.split(",").map(Number);
    if (Math.abs(x) > hx || Math.abs(z) > hz || y >= topY) blocks.delete(k);
  }
  for (const [k, v] of [...blocks]) { // logs inside the box too
    const [x, , z] = k.split(",").map(Number);
    if (v.name !== B.leaves && (Math.abs(x) > hx || Math.abs(z) > hz)) blocks.delete(k);
  }

  // decks
  const stairHoles = new Set(), noRail = new Set(), topSlabs = new Set();
  const stairRing = central ? STAIR7 : RING; // tread cell of climb step i (0..15)
  const stairR = rT + 1; // Chebyshev distance of the stair ring from the trunk axis
  const cheb = (x, z) => Math.max(Math.abs(x), Math.abs(z));
  if (two) {
    for (const i of STAIR_CUT) stairHoles.add(stairRing[i].join(","));
    for (const i of STAIR_TOP) topSlabs.add(stairRing[i].join(","));
    for (const i of [14, 15]) { // the exit onto the upper deck stays open: the two exit cells and the cell outside each
      const [x, z] = stairRing[i];
      noRail.add(`${x},${z}`);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (cheb(x + dx, z + dz) === stairR + 1 && !stairRing.some((c) => c[0] === x + dx && c[1] === z + dz)) noRail.add(`${x + dx},${z + dz}`);
    }
  }
  const deckObjs = levels.map((lv, i) => new Deck(blocks, i === 0 ? D : D + LEVEL_H, lv.rows, {
    box, inner: i === 1 && ropeAt ? new Set([...inner].filter((c) => c !== `${ropeAt.x},${ropeAt.z}`)) : inner, holes: i === 1 ? stairHoles : new Set(), noRail: i === 1 ? noRail : new Set(), topSlabs: i === 1 ? topSlabs : new Set(),
    cells: lv.clip || lv.add ? new Set([...shapeCells(lv.rows)].filter((c) => !(lv.clip && lv.clip(...c.split(",").map(Number)))).concat(lv.add ? [...Array(2 * hx + 1).keys()].flatMap((i) => [...Array(2 * hz + 1).keys()].filter((j) => lv.add(i - hx, j - hz)).map((j) => `${i - hx},${j - hz}`)) : [])) : null, // clip removes cells, add (x, z) => bool adds some inside the box
  }));
  levels.forEach((lv, i) => lv.conn.forEach((c) => deckObjs[i].connect(c.facing, c.off, pool, c.hi ? DECK_HI_NAME : DECK_NAME)));
  // the rope column and the column in front of it are free from -ROOTS up (structure void keeps the terrain): the flare's underground logs there
  // would leave the rope ending on an exposed log on lower ground (the runtime rope fit, village_repair.js, then hangs or buries the rope to the real ground)
  if (ropeAt) for (let y = -ROOTS; y <= D + 3; y++) for (const z of [ropeAt.z, ropeAt.z - 1]) blocks.delete(key(ropeAt.x, y, z));
  const rails = new Set(), forced = new Map();
  for (const dk of deckObjs) { const r = dk.build(); r.rails.forEach((k) => rails.add(k)); r.forced.forEach((v, k) => forced.set(k, v)); }

  // slab spiral stair in the ring round the trunk
  if (two) {
    stairRing.forEach(([x, z], i) => {
      const L = stairLayer(i), s = 3 + i;
      blocks.set(key(x, D + L, z), s % 2 === 0 ? planks() : slab("bottom"));
      // a bottom slab is not left one slab thin: a top slab under it (the body is 1 block thick); not under the lower deck
      if (s % 2 === 1 && [undefined, "minecraft:air", B.leaves].includes(blocks.get(key(x, D + L - 1, z))?.name)) blocks.set(key(x, D + L - 1, z), slab("top"));
      for (let h = 1; h <= 3; h++) { // headroom wins over leaves and logs, but never cuts the upper floor (planks / top slab) over the stair
        const over = blocks.get(key(x, D + L + h, z))?.name;
        if (over !== B.planks && over !== SLAB) blocks.set(key(x, D + L + h, z), AIR);
      }
    });
    // Stair rails (owner 2026-10-08): outside the ring, at the walker's feet level + 1 (the cell beside the tread), only where the fence
    // (1.5 high) fits under the upper deck and never lower than D + 3 (so the walk round the stair foot keeps 2 blocks of headroom);
    // the opening above is railed by the deck itself. Never shifted down into another layer; leaves and branches in a rail cell are cut.
    const ringSet = new Set((central ? RING7 : RING).map((c) => c.join(",")));
    const stairRails = new Set();
    const addRail = (x, z, L) => {
      const y = D + L + 1;
      if (y > D + LEVEL_H - 1) return; // the fence stands at most in the cell under the upper deck (review 2026-10-15: the stair rail stopped a block short)
      stairRails.add(key(x, y, z));
    };
    for (let i = 3; i <= 13; i++) {
      const [x, z] = stairRing[i], L = stairLayer(i);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (ringSet.has(`${nx},${nz}`) || (central ? inner.has(`${nx},${nz}`) : Math.abs(nx) <= 1 && Math.abs(nz) <= 1)) continue;
        addRail(nx, nz, L);
      }
      if (Math.abs(x) === stairR && Math.abs(z) === stairR) addRail(x + Math.sign(x), z + Math.sign(z), L); // outer corner post (3,3)
    }
    linkRails(stairRails);
    for (const k of stairRails) {
      const [x, y, z] = k.split(",").map(Number);
      for (const dy of [0, 1]) { const v = blocks.get(key(x, y + dy, z)); if (v && (v.name === B.leaves || (v.name.endsWith("_log") && dy === 0 && !inner.has(`${x},${z}`) && !(Math.abs(x) <= rT && Math.abs(z) <= rT)) || v.name === B.wood)) blocks.delete(key(x, y + dy, z)); }
      rails.add(k);
    }
  }
  writeRails(blocks, rails, forced);

  if (ropeAt) {
    for (let y = 0; y <= D; y++) blocks.set(key(ropeAt.x, y, ropeAt.z), { name: B.ropeHanging, states: { "minecraft:cardinal_direction": "north" } });
    for (let h = 1; h <= 3; h++) blocks.set(key(ropeAt.x, D + h, ropeAt.z), AIR);
  }
  // rails, deck, walk cells and headroom win over leaves: no leaf in the 3 cells above any deck / stair block or on a rail
  // (everything above is written after the leaves already; this keeps it so if the order ever changes)
  for (const [k, v] of [...blocks]) {
    if (v.name !== B.planks && v.name !== SLAB) continue;
    const [x, y, z] = k.split(",").map(Number);
    for (let h = 1; h <= 3; h++) if (blocks.get(key(x, y + h, z))?.name === B.leaves) blocks.delete(key(x, y + h, z));
  }
  // the orphan-leaf trim stays the LAST step that changes leaves: drop every leaf that has no path <= 8 to a log (leaf decay in game breaks the rest)
  trimFarLeaves(blocks);
  // keep-clear cells (corridors, main path, walk ring, stair columns, rope): dressing (village_dress.mjs) must stay out of them, via deco(blocks, keep)
  const keepOpts = {
    connectors: deckObjs.flatMap((dk) => dk.connectors.map((c) => ({ x: c.x, z: c.z, y: dk.y, d: c.d }))), trunkR: rT, ringY: two ? [{ y: D, dist: rT + 2 }, { y: D + LEVEL_H, dist: rT + 3 }] : [D], deckY: D,
    stair: two ? stairRing.map(([x, z], i) => ({ x, z, y: D + stairLayer(i) })) : [], rope: ropeAt ? { x: ropeAt.x, z: ropeAt.z, y: D } : null,
  };
  const keep = keepClearCells(blocks, keepOpts);
  // hooks (the central tree, village_central.mjs): `structure` writes the Hall and the Court's furniture after the tree and before the dressing (it may add to `keep`);
  // `late` runs after the dressing and before the hidden lights. ctx: everything a builder needs to know about the tree.
  const ctx = { blocks, keep, keepOpts, D, H: topY, rT, inner, stairRing, deckObjs, box, seed, random, cushions: [] }; // cushions: native cushion actors [{ x, y (deck layer), z, variant }]
  hooks.structure?.(ctx);
  // dressing (village_dress.mjs): heartwood ring, home pavilion, lamp posts, banners, rim and under-deck dressing; after the structure, before the hidden lights
  const trunkSet = new Set(tk.cells.map(([x, z]) => `${x},${z}`));
  const walkRing = (i) => (two ? (i === 0 ? rT + 2 : rT + 3) : rT + 1);
  const levelsInfo = (two ? [D, D + LEVEL_H] : [D]).map((y, i) => ({ y, walkRing: walkRing(i), ring: walkRing(i) + 1, bay: levels[i].bay ? (typeof levels[i].bay === "function" ? levels[i].bay : levels[i].add) : null }));
  const dressed = dress === false ? null : dressTree(blocks, keep, {
    levels: levelsInfo, conns: keepOpts.connectors, trunkR: rT, trunk: (x, z) => trunkSet.has(`${x},${z}`), seed, central, pavilion: !central, box, topY: topY + CROWN_AT, cushions: ctx.cushions, ...dressOpts,
  });
  hooks.late?.({ ...ctx, dressed });
  // the leaf cap (phase 3, no stub trees): the trunk top is a rounded cap of leaves round the jigsaw cell (layers +4 ring, +5 section and ring). With a crown placed on top it is the
  // collar of the crown; where the crown jigsaw is refused (a neighbour's crown box is in the way, nothing fits) the tree still ends in a cap, at most deck + 5 high.
  { const rC = central ? 2 : 1, capLeaf = { name: B.leaves, states: { "lothlorien:persistent": true } };
    for (let x = -rC - 1; x <= rC + 1; x++) for (let z = -rC - 1; z <= rC + 1; z++) {
      const d = Math.max(Math.abs(x), Math.abs(z)), corner = Math.abs(x) === rC + 1 && Math.abs(z) === rC + 1;
      for (const y of [topY + 4, topY + 5]) {
        if (blocks.has(key(x, y, z)) || corner) continue;
        const trunkCell = crownCells.some(([a, c]) => a === x && c === z);
        if (y === topY + 4 ? !trunkCell && d === rC + 1 : (trunkCell || d === rC + 1)) blocks.set(key(x, y, z), capLeaf);
      }
    } }
  // hidden lights (safety light, style guide section 5), after all dressing. Not in a stair column (no light block from the deck to the headroom over a
  // tread; the exit nook under cells 14, 15 may hold one at the deck) and not in the connector rows (the joint must stay plain air).
  const stairCol = new Map(two ? stairRing.map((c, i) => [c.join(","), [i < 14 ? D : D + LEVEL_H - 1, D + stairLayer(i) + 3]]) : []); // column -> (lo, hi]
  const lights = addHiddenLights(blocks, { x0: -hx, x1: hx, y0: -ROOTS, y1: topY + CROWN_AT, z0: -hz, z1: hz },
    (x, y, z) => (stairCol.has(`${x},${z}`) && y > stairCol.get(`${x},${z}`)[0] && y <= stairCol.get(`${x},${z}`)[1]) || deckObjs.some((dk) => dk.connectors.some((c) => Math.abs(y - dk.y) <= 4 && (c.d[0] ? x === c.x && Math.abs(z - c.z) <= 2 : z === c.z && Math.abs(x - c.x) <= 2))));
  if (anchor) blocks.set(key(0, -ROOTS, 0), anchorJigsaw());
  blocks.set(key(0, topY + CROWN_AT, 0), crownUpJigsaw(upPool));
  const connectors = deckObjs.flatMap((dk) => dk.connectors.map((c) => ({ ...c, y: dk.y })));
  return { blocks, connectors, box, topY, size: [2 * hx + 1, ROOTS + topY + CROWN_AT + 1, 2 * hz + 1], origin: [hx, ROOTS, hz], keep, keepOpts, lights, home: dressed?.home ?? null, dress: dressed, cushions: ctx.cushions };
}

// ---- crown stars (style guide 5, phase 3): the landmark at night -----------------------------------------------------------------------------------------
// `lamps` lanterns (gold and silver) hang on 1-2 links of green copper chain under the leaf blobs, `fruit` froglights sit INSIDE the blobs (embedded in leaves
// on at least five sides, so they read as glowing fruit and never as a bare cube), `spores` spore blossoms hang under the lowest leaves (central crowns).
// Everything stays inside the box margin (|x|, |z| <= h - 1, y <= H - 2); a froglight that would orphan a leaf (decay) is put back as a leaf.
export const CROWN_CHAIN = "minecraft:waxed_oxidized_copper_chain";
function addCrownStars(blocks, { h, H, seed, central, lamps = 0, fruit = 0, spores = 0, gold = 0.5, loose = false }) {
  const rnd = makeRandom((seed ^ 0x57a2) >>> 0), at = (x, y, z) => blocks.get(key(x, y, z))?.name, free = (x, y, z) => !blocks.has(key(x, y, z));
  const inside = (x, y, z) => Math.abs(x) <= h - 1 && Math.abs(z) <= h - 1 && y >= 1 && y <= H - 2;
  const leaves = [...blocks].filter(([, v]) => v.name === B.leaves).map(([k]) => k.split(",").map(Number));
  const shuffled = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const placed = [], apart = (x, y, z, d) => placed.every((q) => Math.max(Math.abs(q[0] - x), Math.abs(q[2] - z), Math.abs(q[1] - y)) >= d);
  const out = { lamps: 0, fruit: 0, spores: 0 };
  // lamps: below a leaf whose column is free for the chain and the lantern, with air round the lantern
  let want = lamps, goldLeft = Math.round(lamps * gold);
  const outward = shuffled(leaves).map((l) => [Math.hypot(l[0], l[2]) + rnd() * h * 0.6, l]).sort((a, b) => b[0] - a[0]).map((e) => e[1]); // the lamps hang far out on the blobs, where they are seen
  for (const [x, y, z] of outward) {
    if (!want) break;
    const len = 1 + Math.floor(rnd() * 2), ly = y - 1 - len;
    if (![...Array(len + 1).keys()].every((i) => free(x, y - 1 - i, z) && inside(x, y - 1 - i, z)) || !apart(x, ly, z, central ? 5 : 4)) continue;
    if (!loose && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !free(x + dx, ly, z + dz))) continue;
    for (let i = 0; i < len; i++) blocks.set(key(x, y - 1 - i, z), { name: CROWN_CHAIN, states: { pillar_axis: "y" } });
    const isGold = goldLeft > 0 && (want <= goldLeft || rnd() < 0.5); if (isGold) goldLeft--;
    blocks.set(key(x, ly, z), dressLantern(true, isGold)); placed.push([x, ly, z]); want--; out.lamps++;
  }
  // spore blossoms under the lowest leaves
  if (spores) {
    const low = Math.min(...leaves.map((l) => l[1]));
    for (const [x, y, z] of shuffled(leaves.filter((l) => l[1] <= low + 2))) {
      if (!spores) break;
      if (free(x, y - 1, z) && inside(x, y - 1, z) && apart(x, y - 1, z, 4)) { blocks.set(key(x, y - 1, z), { name: "minecraft:spore_blossom", states: {} }); placed.push([x, y - 1, z]); spores--; out.spores++; }
    }
  }
  // froglights inside the blobs
  const solid = (x, y, z) => { const n = at(x, y, z); return n === B.leaves || n === B.log || n === B.wood; };
  const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const orphans = () => { // leaves with no log within LEAF_KEEP steps through leaves
    const dist = new Set(), q = [];
    for (const [k, v] of blocks) if (v.name === B.log || v.name === B.wood) { dist.add(k); q.push(k); }
    let fr = q;
    for (let d = 1; d <= LEAF_KEEP && fr.length; d++) { const nx = []; for (const k of fr) { const [x, y, z] = k.split(",").map(Number); for (const [dx, dy, dz] of N6) { const n = key(x + dx, y + dy, z + dz); if (!dist.has(n) && blocks.get(n)?.name === B.leaves) { dist.add(n); nx.push(n); } } } fr = nx; }
    let bad = 0; for (const [k, v] of blocks) if (v.name === B.leaves && !dist.has(k)) bad++;
    return bad;
  };
  const base = orphans();
  for (const [x, y, z] of shuffled(leaves)) {
    if (!fruit) break;
    if (!inside(x, y, z) || !apart(x, y, z, 5)) continue;
    const open = N6.filter(([dx, dy, dz]) => !solid(x + dx, y + dy, z + dz));
    if (open.length > 1 || (open.length === 1 && open[0][1] === 1)) continue; // fully embedded, one open face at most and never the top one (no bare cube on top)
    if (N6.some(([dx, dy, dz]) => at(x + dx, y + dy, z + dz) === CROWN_CHAIN)) continue;
    const old = blocks.get(key(x, y, z));
    blocks.set(key(x, y, z), { name: `minecraft:${out.fruit % 2 === 0 ? "verdant" : "pearlescent"}_froglight`, states: { pillar_axis: "y" } });
    if (orphans() > base) { blocks.set(key(x, y, z), old); continue; }
    placed.push([x, y, z]); fruit--; out.fruit++;
  }
  return out;
}

// The smallest crown (the last resort of the crown pools, box 5 x 8 x 5): a short tapering trunk, a rounded leaf cap and a gold lantern on one chain link.
export function buildNubCrown() {
  const blocks = new Map(), H = 8, h = 2;
  for (const [x, z] of SQUARE3) blocks.set(key(x, 1, z), logBlock("up"));
  for (const [x, z] of PLUS) blocks.set(key(x, 2, z), logBlock("up"));
  for (const y of [3, 4]) blocks.set(key(0, y, 0), logBlock("up"));
  const leaf = (x, y, z) => blocks.set(key(x, y, z), leafBlock());
  for (const [x, z] of SQUARE3) if (x || z) leaf(x, 4, z); // the ring round the trunk top
  for (const [x, z] of SQUARE3) leaf(x, 5, z);
  for (const [x, z] of PLUS) leaf(x, 6, z);
  blocks.set(key(1, 3, 1), { name: CROWN_CHAIN, states: { pillar_axis: "y" } }); blocks.set(key(1, 2, 1), dressLantern(true, true)); // hangs from the ring's corner leaf
  for (const [x, z] of SQUARE3) blocks.set(key(x, 0, z), logBlock("up"));
  blocks.set(key(0, 0, 0), crownDownJigsaw());
  return { blocks, size: [2 * h + 1, H, 2 * h + 1], origin: [h, 0, h], overflow: false };
}

// ---- crown piece: trunk continues from the jigsaw upward, branches, leaves, all inside the box ------------------------
// local coords: jigsaw at (0,0,0) = box layer 0 centre. opts: h (half width), H (height), seed, branches, blob
// fit (owner 2026-10-10, crowns were clipped flat at the box faces): with fit true nothing may lie in the outermost cell layer of the box (the four
// sides and the top); the same crown is rebuilt a little smaller (branch reach and blob radii x scale, scale 1 -> 0.5) until it fits. fit false = the shipped crowns.
export function buildCrown(opts) {
  if (!opts.fit) return buildCrownScaled({ ...opts, scale: 1 });
  for (let scale = 1; scale >= 0.5; scale -= 0.02) {
    const c = buildCrownScaled({ ...opts, scale });
    if (!c.overflow) return c;
  }
  throw new Error(`crown seed ${opts.seed}: does not fit with a margin`);
}
function buildCrownScaled({ h, H, seed, branches, blob, central = false, fit = false, scale = 1, stars = null }) {
  const random = makeRandom(seed), b = makeBuilder(random);
  // the trunk keeps the platform's section well up into the crown and tapers gradually, thin only in the top third:
  // village 3x3 -> plus (from 40 %) -> 1x1 (from 67 %); central round 5x5 -> 3x3 (30 %) -> plus (50 %) -> 1x1 (67 %)
  const top = H - 4, steps = central ? [[0.3, ROUND5], [0.5, SQUARE3], [0.67, PLUS]] : [[0.4, SQUARE3], [0.67, PLUS]];
  const section = (y) => (steps.find(([t]) => y / top < t)?.[1] ?? [[0, 0]]);
  const radiusAt = (y) => Math.max(...section(y).map(([x, z]) => Math.max(Math.abs(x), Math.abs(z))));
  for (let y = 1; y <= top; y++) for (const [x, z] of section(y)) b.addLog(x, y, z, "up");
  // the giants' crown: rising bent branches round the trunk (they turn up to 45 degrees, rise on 45 % of the steps), each with
  // tufts along it and a big leaf blob on its tip; a blob hugging the trunk, and a cap. Branch length is fitted to the box:
  // tip + blob stay inside (a diagonal branch moves one axis per step, so it may be longer).
  const dirs = b.shuffled();
  for (let i = 0; i < branches; i++) {
    const [dx, dz] = dirs[i % 8], diag = dx !== 0 && dz !== 0;
    const blobR = (blob + random() * 0.6) * scale;
    const y0 = b.between([2, Math.max(3, H - 10)]);
    const r0 = radiusAt(y0);
    const room = h - r0 - Math.ceil(blobR); // cells of branch the box allows along an axis
    const len = Math.max(3, Math.floor((diag ? room * (fit ? 1.25 : 1.5) : room) - random() * 2));
    // a branch that climbs above the box would lose its tip blob to the box clip and end bare: cap the rise so the blob fits under the top
    bentBranch(b, random, dx !== 0 ? dx * r0 : 0, dx !== 0 ? 0 : dz * r0, dx, dz, y0, len, 0.45, blobR, H - 2 - Math.ceil(blobR * 0.8));
  }
  b.blob(0, H - 6, 0, Math.min(h - 0.5, (blob + 2.6) * scale), Math.min(4, H / 4), 3, 1.0);
  b.blob(0, H - (fit ? 4 : 3), 0, Math.min(h - 2, (blob + 1.4) * scale), fit ? 2.1 : 2.6, H - 5, 0.8);
  const tree = b.result(H);
  const blocks = new Map();
  for (const c of tree.leaves) blocks.set(key(c.x, c.y, c.z), leafBlock());
  for (const c of tree.logs) blocks.set(key(c.x, c.y, c.z), logBlock(c.face));
  let overflow = false;
  for (const [k, v] of [...blocks]) {
    const [x, y, z] = k.split(",").map(Number);
    if (fit && (Math.abs(x) >= h || Math.abs(z) >= h || y >= H - 1)) overflow = true; // something in the outermost layer
    if (Math.abs(x) > h || Math.abs(z) > h || y < 1 || y > H - 1) blocks.delete(k);
  }
  trimFarLeaves(blocks);
  if (stars) addCrownStars(blocks, { h, H, seed, central, ...stars });
  for (const [x, z] of central ? ROUND5 : SQUARE3) blocks.set(key(x, 0, z), logBlock("up")); // the full trunk section starts at the jigsaw layer
  blocks.set(key(0, 0, 0), crownDownJigsaw());
  return { blocks, size: [2 * h + 1, H, 2 * h + 1], origin: [h, 0, h], overflow };
}
