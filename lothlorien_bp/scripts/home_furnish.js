// Furnishing of the village homes (M7 showcase WP4b; style guide docs/design/village_style.md sections 6 and 7.2).
// Pure (no @minecraft/server): tools/village_sim.mjs, tests/ and tools/build_furnish.mjs import the very same functions as elf_village.js.
//
// A tree node carries a home pavilion (tools/village_dress.mjs homeFrame). Its frame is the contract:
//   frame = { x0, z0, du: [dx, dz], dv: [dx, dz], k, y, open, post, lamp }, world coordinates, y = the deck block layer.
//   cell(u, v) = [x0 + du.x * u + dv.x * v, z0 + du.z * u + dv.z * v]; v = 0 is the back row (nearest the trunk), dv points away from the trunk,
//   du = (-dv.z, dv.x). The furnishing area is the interior (u 1..k-2, v 0..k-2) at +1 and +2 minus the elf post cell (cu, 1) and the door
//   lane (cells (u, k-2) with |u - cu| <= 1), cu = (k - 1) >> 1. The pavilion hangs a gold lantern at +3 over (cu, k-2) (open variant: (cu, k-1)):
//   findHome() finds a pavilion from live blocks by that lantern and the geometry round it.
// The layout of a profession is written once, in frame coordinates, and turned in code: every orientation state (bed, banner) is derived from the
// frame's own vectors, nothing relies on a structure rotation. Nothing here is verified in game (2026-10-14): block states are the documented
// ones (Mojang's block metadata: cauldron fill_level 0..6 + cauldron_liquid, white_candle candles 0..3 + lit, straw_bed head_piece_bit /
// minecraft:cardinal_direction, wall_banner facing_direction).
import { homeSite } from "./elf_rules.js";

const L = "lothlorien:", M = "minecraft:";
export const MARKER_LANTERN = `${L}elven_lantern_heartwood`;
const DECK = new Set([`${L}mallorn_planks`, `${L}mallorn_heartwood_planks`]);
const AIRS = new Set([`${M}air`, `${M}cave_air`, `${M}void_air`]);
const isAir = (n) => n === undefined || n === null || AIRS.has(n) || /^minecraft:light_block/.test(n); // for looking: hidden light counts as air
const isFree = (n) => AIRS.has(n); // for writing: undefined (unloaded) is not free, and a hidden light block is never replaced
const FACING_ID = { north: 2, south: 3, west: 4, east: 5 };
const nameOf = (v) => (v[0] === 1 ? "east" : v[0] === -1 ? "west" : v[1] === 1 ? "south" : "north");

// ---- frame helpers ------------------------------------------------------------------------------------------------------------
export const frameCell = (f, u, v) => [f.x0 + f.du[0] * u + f.dv[0] * v, f.z0 + f.du[1] * u + f.dv[1] * v];
export const frameCu = (f) => (f.k - 1) >> 1;
export const framePost = (f) => [frameCu(f), 1];
export const frameLamp = (f) => [frameCu(f), f.k < 5 ? f.k - 1 : f.k - 2];
export function frameArea(f) {
  const cu = frameCu(f), out = [];
  for (let u = 1; u <= f.k - 2; u++) for (let v = 0; v <= f.k - 2; v++) {
    if (u === cu && v === 1) continue; // the elf post
    if (v === f.k - 2 && Math.abs(u - cu) <= 1) continue; // the door lane
    out.push([u, v]);
  }
  return out;
}
// the bounding square { x0, z0, k } of the pavilion in world cells (the shape homeSite returns)
export function frameSquare(f) {
  const xs = [], zs = [];
  for (const [u, v] of [[0, 0], [f.k - 1, 0], [0, f.k - 1], [f.k - 1, f.k - 1]]) { const [x, z] = frameCell(f, u, v); xs.push(x); zs.push(z); }
  return { x0: Math.min(...xs), z0: Math.min(...zs), k: f.k };
}

// ---- finding a pavilion from live blocks --------------------------------------------------------------------------------------------
// at(x, y, z) -> block type id | undefined; post = { x, y, z } with y the cell the elf stands in (the deck is y - 1), as elf_village.js reads it.
// -> frame | null. The marker lantern hangs at +3 in the post's column line, 2 (k 4 or 5), 3 (k 6) or 4 (k 7) cells away; the candidate square must be
// all deck, its interior open at +3 except the lantern, and carry a post (not air) at +3 on both outer corners. The first candidate that fits wins.
export function findHome(at, post) {
  const y = post.y - 1;
  for (const dv of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const du = [-dv[1], dv[0]];
    for (const [n, ks] of [[2, [5, 4]], [3, [6]], [4, [7]]]) {
      if (at(post.x + dv[0] * n, y + 3, post.z + dv[1] * n) !== MARKER_LANTERN) continue;
      for (const k of ks) {
        const cu = (k - 1) >> 1;
        const f = { x0: post.x - du[0] * cu - dv[0], z0: post.z - du[1] * cu - dv[1], du, dv, k, y, open: k < 5 };
        f.post = framePost(f); f.lamp = frameLamp(f);
        if (fitsFrame(at, f)) return f;
      }
    }
  }
  return null;
}
function fitsFrame(at, f) {
  const { k, y } = f, lamp = frameLamp(f);
  for (let u = 0; u < k; u++) for (let v = 0; v < k; v++) { const [x, z] = frameCell(f, u, v); if (!DECK.has(at(x, y, z))) return false; }
  for (let u = 1; u <= k - 2; u++) for (let v = 0; v <= k - 2; v++) {
    if (u === lamp[0] && v === lamp[1]) continue;
    const [x, z] = frameCell(f, u, v);
    if (!isAir(at(x, y + 3, z))) return false;
  }
  for (const u of [0, k - 1]) { const [x, z] = frameCell(f, u, k - 1); if (isAir(at(x, y + 3, z))) return false; }
  return true;
}
// The home site the assignment rules see (elf_rules assignHomes uses site.k): the pavilion's square when a pavilion exists, else the old free-square search.
export function siteOf(at, post) {
  const f = findHome(at, post);
  return f ? frameSquare(f) : homeSite(at, post.x, post.y - 1, post.z);
}

// ---- the objects -------------------------------------------------------------------------------------------------------------------
export const HEALER_BANNER = { base: "white", baseId: 15, patterns: [ // white and silver; Bedrock dye ids are reversed (white 15, light_gray 7, light_blue 12)
  { pattern: "rhombus", color: "light_blue", code: "mr", colorId: 12 },
  { pattern: "curly_border", color: "light_gray", code: "cbo", colorId: 7 },
  { pattern: "flower", color: "white", code: "flo", colorId: 15 }] };
export const BANNER_DESIGNS = { healer: HEALER_BANNER };
export const bannerStructure = (design, facing) => `${L}furnish/banner_${design}_${facing}`; // structures/lothlorien/furnish/banner_<design>_<facing>.mcstructure

const plain = (name, states = {}) => ({ name, states });
const O = {
  cauldron: () => plain(`${M}cauldron`, { cauldron_liquid: "water", fill_level: 6 }),
  brew: () => plain(`${M}brewing_stand`, { brewing_stand_slot_a_bit: true, brewing_stand_slot_b_bit: true, brewing_stand_slot_c_bit: false }),
  barrel: () => plain(`${M}barrel`, { facing_direction: 1, open_bit: false }),
  pot: () => plain(`${M}decorated_pot`, { direction: 0 }),
  candles: (n) => plain(`${M}white_candle`, { candles: n - 1, lit: true }), // a healer works at night: lit
  carpet: () => plain(`${M}white_carpet`),
  planter: () => plain(`${M}moss_block`),
  herb: (name) => plain(`${L}${name}`, { [`${L}on_grass`]: false }), // on moss, not grass
  pillar: () => plain(`${L}mallorn_stripped_log`, { "minecraft:block_face": "up" }),
  bed: (head, towardHead) => plain(`${M}straw_bed`, { head_piece_bit: head, occupied_bit: false, "minecraft:cardinal_direction": nameOf(towardHead) }),
};

// ---- the healer's set ------------------------------------------------------------------------------------------------------------------
// Canonical frame (u grows to the right as the owner of the pavilion looks out): the work corner on the low-u side, the sleeping corner on the high-u side,
// herbs by the door; the whole aisle column u = cu (behind the post, the post, in front of it to the door lane) stays free: a pavilion on the deck rim is entered from the trunk side only. Specs; mirrored (u -> k-1-u) for half the homes.
//   [kind, u, v, ...]: cauldron, brew, barrel (top: "pot" | n candles), planter (herb), bed (head cell; the foot is one row towards the door),
//   rug (carpet), candles (on the deck), pot (on the deck), banner (pillar cell; the cloth hangs on the door side of the pillar at +2; candles below)
const HEALER = {
  4: [["cauldron", 2, 0], ["brew", 2, 1]],
  5: [["cauldron", 1, 0], ["brew", 1, 1], ["planter", 1, 2, "athelas"], ["bed", 3, 0], ["barrel", 3, 2, 3], ["rug", 2, 2]],
  6: [["cauldron", 1, 0], ["brew", 1, 1], ["banner", 1, 2, "healer"], ["barrel", 3, 0, 3], ["bed", 4, 0],
      ["rug", 3, 1], ["rug", 3, 2], ["rug", 4, 2], ["planter", 3, 3, "athelas"], ["planter", 4, 3, "niphredil"], ["pot", 4, 4]],
  7: [["cauldron", 1, 0], ["brew", 2, 0], ["barrel", 1, 1, "pot"], ["barrel", 2, 1, 3], ["banner", 1, 2, "healer"], ["barrel", 2, 2, "pot"],
      ["barrel", 4, 0, 2], ["bed", 5, 0], ["bed", 5, 2], ["rug", 4, 1], ["rug", 4, 2], ["rug", 4, 3],
      ["planter", 1, 4, "athelas"], ["planter", 2, 4, "niphredil"], ["planter", 4, 4, "athelas"], ["planter", 5, 4, "niphredil"], ["candles", 1, 5, 3], ["candles", 5, 5, 3]],
};
const SETS = { healer: HEALER };
export const hasLayout = (profession) => profession in SETS;

// frame hash -> mirrored? (deterministic: the same home is furnished the same way every time; odd k only, see furnishLayout)
const mirrored = (f) => ((Math.imul(f.x0, 73856093) ^ Math.imul(f.z0, 19349663) ^ Math.imul(f.y, 83492791)) >>> 7) % 2 === 1;

// -> [{ group, u, v, h, name, states, banner?: design, wall?: true }] in frame coordinates (u, v in the frame, h = +1 / +2 over the deck), states turned for the frame.
// A group is placed whole or not at all (a bed's two halves, a banner with its pillar). Variants exist for k 4, 5, 6, 7 (k >= 8 uses the 7 set); none for k < 4.
export function furnishLayout(profession, frame, flipOverride = null) {
  const set = SETS[profession];
  if (!set || frame.k < 4) return [];
  const spec = set[Math.min(frame.k, 7)];
  const k = frame.k, flip = k % 2 === 1 && (flipOverride ?? mirrored(frame)), U = (u) => (flip ? k - 1 - u : u);
  const toBack = [-frame.dv[0], -frame.dv[1]], toFront = frame.dv;
  const out = [];
  let g = 0;
  const put = (group, u, v, h, o, extra = {}) => out.push({ group, u: U(u), v, h, name: o.name, states: o.states, ...extra });
  for (const [kind, u, v, a] of spec) {
    const group = `${kind}${g++}`;
    switch (kind) {
      case "cauldron": put(group, u, v, 1, O.cauldron()); break;
      case "brew": put(group, u, v, 1, O.brew()); break;
      case "barrel":
        put(group, u, v, 1, O.barrel());
        put(group, u, v, 2, a === "pot" ? O.pot() : O.candles(a));
        break;
      case "planter": put(group, u, v, 1, O.planter()); put(group, u, v, 2, O.herb(a)); break;
      case "bed": put(group, u, v, 1, O.bed(true, toBack)); put(group, u, v + 1, 1, O.bed(false, toBack)); break; // the head lies towards the trunk
      case "rug": put(group, u, v, 1, O.carpet()); break;
      case "pot": put(group, u, v, 1, O.pot()); break;
      case "candles": put(group, u, v, 1, O.candles(a)); break;
      case "banner":
        put(group, u, v, 1, O.pillar()); put(group, u, v, 2, O.pillar());
        put(group, u, v + 1, 1, O.candles(2));
        put(group, u, v + 1, 2, { name: `${M}wall_banner`, states: { facing_direction: FACING_ID[nameOf(toFront)] } }, { banner: a, wall: true });
        break;
      default: throw new Error(`home_furnish: unknown object ${kind}`);
    }
  }
  return out;
}

const PASS = /^minecraft:(air|cave_air|void_air|wall_banner|pale_hanging_moss|moss_carpet|leaf_litter)$|^minecraft:light_block|carpet$|^lothlorien:elven_rope/;

// -> { writes: [{ x, y, z, name, states }], banners: [{ x, y, z, structure, design }], skipped: [group], flipped: bool }
// at(x, y, z) -> type id. A group is skipped when any of its cells is not air, its deck cell is no deck, it lies outside the furnishing area, or it would shut
// in a walkable deck cell of the pavilion (every cell that could be walked to from outside before must still be reachable: a pavilion on the deck rim is
// entered from the trunk side only, and a bed must not wall in a gap of the screen). Both mirror images of the layout are tried; the one that keeps more wins.
export function planFurnish(profession, frame, at) {
  const base = mirrored(frame);
  let best = null;
  for (const flip of frame.k % 2 === 1 ? [base, !base] : [false]) { // an even pavilion is not symmetric about the aisle: no mirror image
    const r = planOne(profession, frame, at, flip);
    if (!best || r.skipped.length < best.skipped.length) best = r;
    if (!best.skipped.length) break;
  }
  return best;
}
function planOne(profession, frame, at, flip) {
  const layout = furnishLayout(profession, frame, flip), area = new Set(frameArea(frame).map((c) => c.join(",")));
  const groups = new Map();
  for (const it of layout) (groups.get(it.group) ?? groups.set(it.group, []).get(it.group)).push(it);
  const { y, k } = frame;
  // local walk graph: the square plus a one-cell margin; a margin cell that is walkable counts as "outside"
  const cells = new Map(); // "x,z" -> blocked by furnishing?
  const lo = -1, hi = k;
  const walkable = (x, z) => DECK.has(at(x, y, z)) && PASS.test(at(x, y + 1, z) ?? "x") && PASS.test(at(x, y + 2, z) ?? "x");
  const nodes = [];
  for (let u = lo; u <= hi; u++) for (let v = lo; v <= hi; v++) { const [x, z] = frameCell(frame, u, v); if (walkable(x, z)) { nodes.push({ u, v, x, z, edge: u === lo || u === hi || v === lo || v === hi }); } }
  const blocked = new Set();
  const reach = () => {
    const open = new Map(nodes.filter((n) => !blocked.has(`${n.x},${n.z}`)).map((n) => [`${n.u},${n.v}`, n])), seen = new Set(), q = [];
    for (const [id, n] of open) if (n.edge) { seen.add(id); q.push(n); }
    for (let i = 0; i < q.length; i++) for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const id = `${q[i].u + du},${q[i].v + dv}`;
      if (open.has(id) && !seen.has(id)) { seen.add(id); q.push(open.get(id)); }
    }
    return seen;
  };
  const before = reach();
  const writes = [], banners = [], skipped = [], used = new Set(); // used: "u,v" of kept groups
  const cu = frameCu(frame);
  // places one group (items already in frame coordinates); false when it does not fit (nothing is changed then)
  const tryGroup = (items) => {
    const cs = items.map((it) => { const [x, z] = frameCell(frame, it.u, it.v); return { it, x, y: y + it.h, z }; });
    if (!cs.every(({ it, x, y: yy, z }) => area.has(`${it.u},${it.v}`) && (it.h > 1 || !used.has(`${it.u},${it.v}`)) && isFree(at(x, yy, z)) && (it.h > 1 || DECK.has(at(x, yy - 1, z))))) return false;
    const mine = cs.filter(({ it }) => !/carpet$|wall_banner$/.test(it.name)).map(({ x, z }) => `${x},${z}`);
    if (mine.length) {
      for (const c of mine) blocked.add(c);
      const now = reach(), lost = nodes.some((n) => before.has(`${n.u},${n.v}`) && !blocked.has(`${n.x},${n.z}`) && !now.has(`${n.u},${n.v}`));
      if (lost) { for (const c of mine) blocked.delete(c); return false; }
    }
    for (const { it, x, y: yy, z } of cs) {
      used.add(`${it.u},${it.v}`);
      if (it.banner) banners.push({ x, y: yy, z, design: it.banner, structure: bannerStructure(it.banner, nameOf(frame.dv)) });
      else writes.push({ x, y: yy, z, name: it.name, states: it.states });
    }
    return true;
  };
  // a group that does not fit where the layout wants it moves at once to the nearest free cell of the area (never the aisle column u = cu); a banner post stays or goes
  for (const [group, items] of groups) {
    if (items.every((it) => { const [x, z] = frameCell(frame, it.u, it.v); return at(x, y + it.h, z) === it.name; })) { for (const it of items) used.add(`${it.u},${it.v}`); continue; } // already there (a second run)
    if (tryGroup(items)) continue;
    const u0 = items[0].u, v0 = items[0].v;
    const free = frameArea(frame).filter(([u, v]) => u !== cu && !used.has(`${u},${v}`)).sort((p, q) => Math.hypot(p[0] - u0, p[1] - v0) - Math.hypot(q[0] - u0, q[1] - v0) || p[1] - q[1] || p[0] - q[0]);
    const moved = !items.some((it) => it.banner) && free.some(([u, v]) => tryGroup(items.map((it) => ({ ...it, u: it.u + u - u0, v: it.v + v - v0 }))));
    if (!moved) skipped.push(group);
  }
  return { writes, banners, skipped, flipped: flip };
}
