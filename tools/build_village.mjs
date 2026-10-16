// Writes the Elven jigsaw village pieces, pools and structure (design: docs/design/lothlorien_jigsaw_settlement.md):
//   node tools/build_village.mjs
// -> lothlorien_bp/structures/lothlorien/village/<piece>.mcstructure   (id lothlorien:village/<piece>)
//    lothlorien_bp/worldgen/template_pools/village_<pool>.json         (id lothlorien:village/<pool>)
//    lothlorien_bp/worldgen/structures/elven_village.json              (no structure set: /place structure only)
// Pieces: tree nodes = platform piece (rim connectors, trunk to deck + 5) + crown piece on an upward jigsaw; two-level
// towers with a slab spiral stair; slab-arched straight bridges; balcony / lookout / plug ends; central tree.
// Connector standard: one jigsaw per connection in the deck layer, on the outer face of the piece box, in the middle of a
// 3-wide walk opening (deck under 5 cells, rails at +-2), name = target = lothlorien:village_deck (upper-level connectors of
// towers: name village_deck_hi, parent role only), aligned joint, final state planks.
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toMcstructure } from "./build_structures.mjs";
import { B, decoratePillar } from "./flet_mallorn.mjs";
import { checkWalk } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs"; // shared walkability checker (headroom, steps, edges, rings, rail links)
import { makeCombo, buildBalcony, STRAIGHT } from "./village_combo.mjs";
import { sideTarget } from "../lothlorien_bp/scripts/village_loop.js"; // the runtime's own rim test decides where a side marker may stand
import { POST_ID, POST_GROUP_PREFIX, POST_SPACING, ROPE_CLEARANCE, RESERVE_POSTS, homeSite } from "../lothlorien_bp/scripts/elf_rules.js"; // civilian elf posts (tunables live there)
import {
  ROOTS, FLOOR_H, LEVEL_H, FACING, SHAPES, key, AIR, planks, slab, Deck, buildTree, buildCrown, deckJigsaw, lonelyRail,
  writeRails, RAIL, shapeCells, addHiddenLights, addSpawnLights, isLightBlock, bareBranchEnds, worstLight, LIGHT_TARGET, HEART_PLANKS,
} from "./village_mallorn.mjs";
import { frameCell, frameInterior, frameDoorLane, framePost, dressBalcony, dressLookout } from "./village_dress.mjs"; // deck dressing and the home pavilion frame (M7 WP3)
import { keepClearCells, keepClearViolations, supportCheck, waterCheck } from "./village_checks.mjs";
import { COURT_ROWS, COURT_CONN, HALL_ROWS, HALL_BAY, heartwoodRings, buildHall, buildStream, buildCourt } from "./village_central.mjs"; // the central tree: Court, Hall, stream, reading circle (M7 WP2) // keep-clear cells, nothing floats, water stays in its vessel (style guide rule 8)

export const MAX_DEPTH = 2; // hops from the central tree (a combo = one hop; its crown is a sibling, not a deeper level)
// exits (no combo fits, or the depth is used up): mostly a plain railing, sometimes a braced balcony or a lookout. The combos pool also
// holds them as early ends (tuned with the sim so a village keeps ~8-10 trees at max_depth 2).
const EXIT_WEIGHTS = { railing: 4, balcony: 2, lookout: 1 };
const EARLY_END = { railing_end: 10, balcony_braced: 6, lookout_01: 2 };
const MENDER = "lothlorien:rail_mender";
const WARDEN = "lothlorien:elven_warden";
const LOOP_MARKER = "lothlorien:loop_marker";
// Village wardens (entities/elven_warden.json, group lothlorien:village_warden = persistent + home): placed as template
// entities on the lower deck of these pieces. Whether Bedrock places structure entities in jigsaw pieces is an open question
// (same as the rail mender), to be seen in game.
const WARDENS = { central_mallorn_01: 2, node_b: 1, node_c: 1, node_f: 1, tower_a: 1, tower_c: 1 };
const bp = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp");
// Pillar decoration (owner 2026-10-10): the balcony pillar gets the light, the lookout pillar the full foliage (decoratePillar); the root flare is placed
// at the real ground by the planner (scripts/village_repair.js). Preview (nothing shipped is touched): PILLAR_PREVIEW=<dir> writes the pieces, pools and
// structure under <dir> instead of the pack; PILLARS=bare|light|full forces one amount for both pillars; CROWN_FIT=0 builds the old, clipped crowns.
const PREVIEW = process.env.PILLAR_PREVIEW ? process.env.PILLAR_PREVIEW : null;
const AMOUNTS = { bare: 0, light: 0.7, full: 1.4 };
const pillarAmount = (dflt) => (process.env.PILLARS ? AMOUNTS[process.env.PILLARS] ?? dflt : dflt);
const bpOut = PREVIEW ? join(PREVIEW, "bp") : bp;
const out = join(bpOut, "structures", "lothlorien", "village");
mkdirSync(out, { recursive: true });
mkdirSync(join(bpOut, "worldgen", "template_pools"), { recursive: true });
mkdirSync(join(bpOut, "worldgen", "structures"), { recursive: true });
for (const f of readdirSync(out)) unlinkSync(join(out, f)); // pieces of earlier layouts must not linger

const POOL = (n) => `lothlorien:village/${n}`;
const summary = [];

// Walkability (owner 2026-10-08, rules in .claude/skills/bedrock-modding/references/13-structure-walkability.md): every piece is checked
// with the shared checker; any violation stops the build. opts.ring: [{ trunk: [[x, z]], level }] (walk ring round a trunk at deck level),
// opts.connectors: deck connectors that must be reachable from each other. `blocks` are in piece coordinates (any origin).
export function walkReport(blocks, { connectors = [], ring = [], must: extraMust = [] } = {}) {
  const ks = [...blocks.keys()].map((k) => k.split(",").map(Number));
  const lo = (i) => Math.min(...ks.map((k) => k[i])), hi = (i) => Math.max(...ks.map((k) => k[i]));
  const box = { x0: lo(0), x1: hi(0), y0: lo(1), y1: hi(1), z0: lo(2), z1: hi(2) };
  const must = connectors.map((c) => ({ x: c.x, y: c.y + 1, z: c.z })).concat(extraMust);
  // a stripped-log post standing right on the deck (pavilion / flag / Hall posts replace the rim fence under them) is the rail of its cell: the checker sees a fence there
  const FENCE_AS = { name: RAIL, states: {} };
  // a top-half slab roof on posts (the balcony arbour) is no floor: the checker would walk it
  const ROOF = { name: "lothlorien:mallorn_log", states: {} }, roofSlabs = new Set(); // groups of top slabs (same layer, side by side) that stand on or between fence posts and rest on nothing else
  { const topSlab = (k) => { const b = blocks.get(k); return b?.name === "lothlorien:mallorn_slab" && b.states?.["minecraft:vertical_half"] === "top"; }, seen = new Set();
    for (const k0 of blocks.keys()) {
      if (seen.has(k0) || !topSlab(k0)) continue;
      const grp = [k0]; seen.add(k0); let post = false, solid = false;
      for (let i = 0; i < grp.length; i++) { const [x, y, z] = grp[i].split(",").map(Number), bn = blocks.get(key(x, y - 1, z))?.name ?? "minecraft:air"; if (/fence$/.test(bn)) post = true; else if (!/air$|pale_hanging_moss|cave_vines|light_block/.test(bn)) solid = true; for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (/fence$/.test(blocks.get(key(x + a, y, z + c))?.name ?? "")) post = true; const nk = key(x + a, y, z + c); if (!seen.has(nk) && topSlab(nk)) { seen.add(nk); grp.push(nk); } } }
      if (post && !solid) for (const k of grp) roofSlabs.add(k);
    } }
  const get = (x, y, z) => { const b = blocks.get(key(x, y, z)); if (b?.name === "lothlorien:mallorn_slab" && b.states?.["minecraft:vertical_half"] === "top" && roofSlabs.has(key(x, y, z))) return ROOF; return b?.name === "lothlorien:mallorn_stripped_log" && /planks$|slab$/.test(blocks.get(key(x, y - 1, z))?.name ?? "") ? FENCE_AS : b; };
  const r = checkWalk(get, box, { must, ring });
  return r.violations;
}
export function assertWalk(name, blocks, opts) {
  const v = walkReport(blocks, opts);
  if (v.length) throw new Error(`${name}: ${v.length} walkability violations, e.g. ${v.slice(0, 6).map((x) => `${x.rule} at ${x.at} (${x.detail})`).join("; ")}`);
}

// connector standard (depth 1: the connector cell itself): deck under 5 cells, rails at +-2 one above, 3 air above the walk cells
function checkConnectors(name, blocks, connectors) {
  for (const c of connectors) {
    const { d } = FACING[c.facing], p = [-d[1], d[0]];
    for (let off = -2; off <= 2; off++) {
      const x = c.x + p[0] * off, z = c.z + p[1] * off;
      const deckB = blocks.get(key(x, c.y, z));
      if (off === 0 ? deckB?.name !== "minecraft:jigsaw" : deckB?.name !== B.planks && deckB?.name !== "minecraft:jigsaw") throw new Error(`${name}: ${c.facing} connector: bad deck at ${off}`);
      for (let h = 1; h <= 3; h++) {
        const b = blocks.get(key(x, c.y + h, z));
        if (Math.abs(off) === 2) { if (h === 1 && b?.name !== RAIL) throw new Error(`${name}: ${c.facing} no rail at ${off}`); }
        else if (b?.name !== "minecraft:air") throw new Error(`${name}: ${c.facing} headroom not air at ${off},${h}: ${b?.name}`);
      }
    }
  }
}
// Open deck cells on the deck layer y = FLOOR_H (tree coordinates): planks under the cell and its 8 neighbours, 3 x 3 x 3 explicit air
// above, no rail within 2 cells, so nothing but open deck around (not at a connector, the trunk, the rope hole, a stair or a lantern).
// Shared by the warden and the elf post cells. -> [{ x, z, d }] (d = distance to the trunk axis), in block order.
const isPlankDeck = (n) => n === B.planks || n === HEART_PLANKS; // the heartwood ring round the trunk is plank deck as well
export function openDeckCells(blocks, avoid = new Set()) {
  const at = (x, y, z) => blocks.get(key(x, y, z))?.name;
  const ok = [];
  for (const k of blocks.keys()) {
    const [x, y, z] = k.split(",").map(Number);
    if (y !== FLOOR_H || at(x, y, z) !== B.planks || avoid.has(`${x},${z}`)) continue; // the elf stands on plain planks; the heartwood ring may be part of the open deck round it
    let good = true;
    for (let dx = -2; dx <= 2 && good; dx++) for (let dz = -2; dz <= 2 && good; dz++) {
      if (at(x + dx, y + 1, z + dz) === RAIL) good = false;
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
        if (!isPlankDeck(at(x + dx, y, z + dz))) good = false;
        for (let h = 1; h <= 3; h++) if (at(x + dx, y + h, z + dz) !== "minecraft:air" && !isLightBlock(at(x + dx, y + h, z + dz))) good = false; // a hidden light is air for standing room
      }
    }
    if (good) ok.push({ x, z, d: Math.hypot(x, z) });
  }
  return ok;
}
// The elf post cell of a pavilion frame (tree coordinates) and the cells round it that the wardens of the piece keep away from (POST_SPACING)
const homePostCell = (frame) => { const [x, z] = frameCell(frame, ...framePost(frame)); return { x, z }; };
const postAvoid = (tree) => {
  const out = new Set(), frame = tree.home, site = tree.dress?.site;
  if (!frame && !site) return out;
  const p = frame ? homePostCell(frame) : { x: site.x0 + ((site.k - 1) >> 1), z: site.z0 + ((site.k - 1) >> 1) };
  for (let dx = -(POST_SPACING - 1); dx <= POST_SPACING - 1; dx++) for (let dz = -(POST_SPACING - 1); dz <= POST_SPACING - 1; dz++) out.add(`${p.x + dx},${p.z + dz}`);
  return out;
};
// Standing cells for `count` wardens on the deck layer (see openDeckCells). The first warden stands near ring `want`, the next ones as far
// from the earlier ones as possible. Deterministic. Returns [{ x, z }] (tree coordinates); throws when there is no room.
export function wardenCells(name, blocks, count, want, avoid = new Set()) {
  if (!count) return [];
  const ok = openDeckCells(blocks, avoid);
  const near = ok.filter((c) => Math.abs(c.d - want) <= 2.5);
  const pool = (near.length >= count ? near : ok).sort((a, b) => Math.abs(a.d - want) - Math.abs(b.d - want) || a.x - b.x || a.z - b.z);
  if (pool.length < count) throw new Error(`${name}: no room for ${count} wardens`);
  const picked = [pool[0]];
  while (picked.length < count) {
    const next = pool.filter((c) => !picked.includes(c)).sort((a, b) =>
      Math.min(...picked.map((p) => Math.hypot(b.x - p.x, b.z - p.z))) - Math.min(...picked.map((p) => Math.hypot(a.x - p.x, a.z - p.z))) || a.x - b.x || a.z - b.z)[0];
    picked.push(next);
  }
  return picked.map(({ x, z }) => ({ x, z }));
}
// Civilian elf posts (invisible `lothlorien:elf_post` entities, rules and tunables in scripts/elf_rules.js; the village planner assigns the
// professions at runtime, see elf_village.js): on the deck layer y = FLOOR_H, tree coordinates. `taken` = the piece's warden cells [{ x, z }].
// Every post stands on an open deck cell (openDeckCells) at least POST_SPACING (Chebyshev) from the wardens and the earlier posts.
//   central tree: one `loremaster` post on the open cell nearest the rope hole (at least ROPE_CLEARANCE from the rope cell), then RESERVE_POSTS
//                 `reserve` posts spread out as far from each other as possible (leftover professions of a village with few trees stand there);
//   tree node:    one `home` post inside the biggest free square of the lower deck (homeSite), preferably on an open deck cell, nearest the trunk.
//                 (Small nodes have no cell with the full open-deck margin of a warden, node_e only a 3 x 3 square, so a post there only needs its own
//                 cell to be open deck: planks underneath, 3 cells of air above.)
// Other pieces (crowns, ends) carry none. Deterministic (ties by x, then z). -> [{ x, z, kind }]; throws when there is no room.
export function postCells(name, blocks, taken = [], avoid = new Set()) {
  const central = name.startsWith("central"), isNode = name in NODES;
  if (!central && !isNode) return [];
  const apart = (c, list) => list.every((t) => Math.max(Math.abs(c.x - t.x), Math.abs(c.z - t.z)) >= POST_SPACING);
  const ok = openDeckCells(blocks, avoid);
  const ground = (x, y, z) => blocks.get(key(x, y, z))?.name ?? AIR.name;
  if (isNode && NODES[name].home) { // the pavilion's post cell (village_dress.mjs framePost): interior, not the door lane, not a screen cell
    const post = homePostCell(NODES[name].home);
    if (!apart(post, taken)) throw new Error(`${name}: a warden stands within ${POST_SPACING} cells of the pavilion post`);
    return [{ ...post, kind: "home" }];
  }
  if (isNode && NODES[name].dress?.site) { // no pavilion: the reserved free square (village_dress.mjs reserveSite) is the home site; the post stands in its middle
    const sq = NODES[name].dress.site, cells = [];
    for (let i = 0; i < sq.k; i++) for (let j = 0; j < sq.k; j++) cells.push({ x: sq.x0 + i, z: sq.z0 + j, d: Math.hypot(i - ((sq.k - 1) >> 1), j - ((sq.k - 1) >> 1)) });
    const c = cells.sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z).find((q) => blocks.get(key(q.x, FLOOR_H, q.z))?.name === B.planks && apart(q, taken)); // plain planks under the elf (not the heartwood ring)
    if (!c) throw new Error(`${name}: a warden stands within ${POST_SPACING} cells of every cell of the home site`);
    return [{ x: c.x, z: c.z, kind: "home" }];
  }
  if (isNode) {
    const strict = new Set(ok.map((c) => `${c.x},${c.z}`));
    let best = null;
    for (const k of blocks.keys()) {
      const [x, y, z] = k.split(",").map(Number), c = { x, z, d: Math.hypot(x, z) };
      if (y !== FLOOR_H || !apart(c, taken)) continue;
      const size = homeSite(ground, x, FLOOR_H, z)?.k ?? 0, margin = strict.has(`${x},${z}`) ? 1 : 0;
      const better = !best || size > best.k || (size === best.k && (margin > best.margin || (margin === best.margin && (c.d < best.c.d || (c.d === best.c.d && (x < best.c.x || (x === best.c.x && z < best.c.z)))))));
      if (better) best = { c, k: size, margin };
    }
    if (!best || !best.k) throw new Error(`${name}: no room for an elf home post`);
    return [{ x: best.c.x, z: best.c.z, kind: "home" }];
  }
  let rope = null;
  for (const [k, b] of blocks) if (b.name === B.ropeHanging && k.split(",")[1] === String(FLOOR_H)) { const [x, , z] = k.split(",").map(Number); rope = { x, z }; break; }
  if (!rope) throw new Error(`${name}: no rope cell on the deck layer`);
  const cheb = (c, t) => Math.max(Math.abs(c.x - t.x), Math.abs(c.z - t.z));
  const lore = ok.filter((c) => cheb(c, rope) >= ROPE_CLEARANCE && apart(c, taken))
    .sort((a, b) => Math.hypot(a.x - rope.x, a.z - rope.z) - Math.hypot(b.x - rope.x, b.z - rope.z) || a.x - b.x || a.z - b.z)[0];
  if (!lore) throw new Error(`${name}: no room for the Loremaster post`);
  const picked = [{ x: lore.x, z: lore.z, kind: "loremaster" }];
  for (let i = 0; i < RESERVE_POSTS; i++) {
    const have = [...taken, ...picked], gap = (c) => Math.min(...have.map((p) => Math.hypot(c.x - p.x, c.z - p.z)));
    const next = ok.filter((c) => apart(c, have)).sort((a, b) => gap(b) - gap(a) || a.x - b.x || a.z - b.z)[0];
    if (!next) throw new Error(`${name}: no room for ${RESERVE_POSTS} reserve posts`);
    picked.push({ x: next.x, z: next.z, kind: "reserve" });
  }
  return picked;
}
// Where a platform's plain rim sides can start a bridge (F1): one marker per straight rim run, on the run's middle cell, where the runtime's
// sideTarget holds for a bridge heading into the platform (5-run of rail on 5 planks, two plain deck rows behind with open air; a stair opening,
// trunk, slab or connector row fails it). `inRegion(x, z)` limits the cells (a combo's bridge half is excluded). -> [[x, z, deckY]] in box coordinates.
// A platform with no such run still gets one marker (see the end of the function) so every tree piece can start the village planner.
export function sideMarkerCells(blocks, origin, inRegion = () => true, onlyY = null) {
  const nameAt = (x, y, z) => blocks.get(key(x, y, z))?.name ?? "minecraft:air";
  const runs = new Map();
  for (const [k, b] of blocks) {
    if (b.name !== B.planks) continue;
    const [x, y, z] = k.split(",").map(Number);
    if (!inRegion(x, z) || nameAt(x, y + 1, z) !== RAIL || (onlyY !== null && y !== onlyY)) continue;
    for (const out of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!sideTarget(nameAt, x, y, z, [-out[0], -out[1]])) continue;
      const along = out[0] ? z : x, line = out[0] ? x : z, id = `${out}|${y}|${line}`;
      (runs.get(id) ?? runs.set(id, { out, y, line, cells: [] }).get(id)).cells.push(along);
    }
  }
  const res = [];
  for (const r of runs.values()) { // split into contiguous runs of the along coordinate
    const cs = r.cells.sort((a, b) => a - b);
    let start = 0;
    for (let i = 1; i <= cs.length; i++) {
      if (i < cs.length && cs[i] === cs[i - 1] + 1) continue;
      const along = cs[start + Math.floor((i - start - 1) / 2)];
      res.push(r.out[0] ? [r.line, along, r.y] : [along, r.line, r.y]);
      start = i;
    }
  }
  if (!res.length) { // planner trigger (owner 2026-10-09: the first tree that loads starts the village planner): a platform without a usable rim run still carries a marker
    let best = null; // on its lowest deck cell with a rail above, nearest to the middle of the region; sideStarts finds no rim there, so the marker only wakes the planner
    for (const [k, b] of blocks) {
      if (b.name !== B.planks) continue;
      const [x, y, z] = k.split(",").map(Number);
      if (!inRegion(x, z) || nameAt(x, y + 1, z) !== RAIL || (onlyY !== null && y !== onlyY)) continue;
      if (!best || y < best[2]) best = [x, z, y];
    }
    if (best) res.push(best);
  }
  return res.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]).map(([x, z, y]) => [x + origin[0] + 0.5, z + origin[2] + 0.5, y]);
}
// extra.markers: [[x, z]] rail mender marker positions in box coordinates (default: the box centre); extra.wardens: standing cells
// [{ x, z }] in block coordinates (default: computed here for WARDENS[name]); extra.posts: elf post cells [{ x, z, kind }] in block coordinates
// (default: postCells); extra.keep: the piece's keep-clear cells (Set "x,y,z", block coordinates; the post and warden cells are added here);
// extra.waterAllowed: cells the water of the piece may reach besides its own water cells
const spawnLights = new Map(); // piece -> number of spawn-proof hidden lights
const cushionTally = new Map(); // piece -> number of native cushions
function writePiece(name, blocks, size, origin, connectors, extra = {}) {
  checkConnectors(name, blocks, connectors);
  const bare = bareBranchEnds(blocks);
  if (bare.length) throw new Error(`${name}: bare branch end at ${bare.map((q) => `${q.x},${q.y},${q.z}`).join(" ")}`);
  if (!name.startsWith("crown_")) assertWalk(name, blocks, { connectors, ...extra.walk });
  const [sx, sy, sz] = size;
  const fail = (what, list) => { if (list.length) throw new Error(`${name}: ${list.length} ${what} violations, e.g. ${list.slice(0, 5).map((v) => `${v.rule} at ${v.at} (${v.name ? v.name + ": " : ""}${v.detail})`).join("; ")}`); };
  fail("support", supportCheck(blocks)); // nothing floats (principle 10)
  fail("water", waterCheck(blocks, { allowed: extra.waterAllowed }));
  // rail mender markers (scripts/rail_mender.js, scan radius 17): one at the box centre, two for a combo (bridge middle and tree axis,
  // so the whole bridge + node is covered); y = the lowest rail
  const railYs = [...blocks].filter(([, b]) => b.name === RAIL).map(([k]) => Number(k.split(",")[1]));
  const markers = railYs.length ? (extra.markers ?? [[sx / 2, sz / 2]]).map(([x, z]) => ({ id: MENDER, x, y: Math.min(...railYs) + origin[1], z })) : [];
  // loop closer (scripts/loop_marker.js): every closed exit (railing_end) carries one marker on the centre fence cell (y + 0.5 = cell middle, so
  // rotation rounding cannot change the cell); it finds its railing, a facing one and the bridge direction from the blocks, not from its own rotation
  // Balcony and lookout ends have the very same signature on their free rim sides (5 planks + fences, 5-wide connector row behind), so they carry
  // markers too (extra.loopMarkers: [[x, z]] box coordinates of the rim's centre cell): a loop may start there and the end becomes a walk-through.
  // Side markers (round 2, F1): [x, z, deckY] in box coordinates + block key y of the deck; a platform rim run of its own is a bridge START too.
  for (const m of name === "railing_end" ? [[sx / 2, sz / 2]] : extra.loopMarkers ?? []) markers.push({ id: LOOP_MARKER, x: m[0], y: m[2] === undefined ? Math.min(...railYs) + origin[1] + 0.5 : m[2] + 1 + origin[1] + 0.5, z: m[1] });
  const cells = extra.wardens ?? wardenCells(name, blocks, WARDENS[name] ?? 0, name.startsWith("central") ? 7 : 5);
  const posts = (extra.posts ?? postCells(name, blocks, cells)).map((c) => ({
    id: POST_ID, x: c.x + origin[0] + 0.5, y: FLOOR_H + 1 + origin[1], z: c.z + origin[2] + 0.5,
    definitions: [`+${POST_ID}`, `+${POST_GROUP_PREFIX}${c.kind}`],
  }));
  const keep = new Set(extra.keep ?? []);
  for (const c of [...cells, ...(extra.posts ?? postCells(name, blocks, cells))]) { keep.add(key(c.x, FLOOR_H + 1, c.z)); keep.add(key(c.x, FLOOR_H + 2, c.z)); }
  fail("keep-clear", keepClearViolations(blocks, keep));
  const wardens = cells.map((c) => ({
    id: WARDEN, x: c.x + origin[0] + 0.5, y: FLOOR_H + 1 + origin[1], z: c.z + origin[2] + 0.5,
    definitions: [`+${WARDEN}`, "+lothlorien:village_warden"], mainhand: "minecraft:bow", invulnerable: false,
  }));
  // native cushions (persistent template actors like the M6 camps: the seats of the village; variant = dye id, 15 white, 12 light blue, 2 green)
  const cushionActors = (extra.cushions ?? []).map((c) => ({ id: "minecraft:cushion", x: c.x + origin[0] + 0.5, y: c.y + 1 + origin[1], z: c.z + origin[2] + 0.5, variant: c.variant, invulnerable: false }));
  cushionTally.set(name, cushionActors.length);
  // spawn-proofing: no spawnable surface from deck - 6 up (crowns: all) with block light 0
  // (owner 2026-10-16: ground and root mobs are fine, branch mobs are not: crowns entirely, elsewhere from deck - 6 up)
  const sl = name === "railing_end" ? [] : addSpawnLights(blocks, { x0: -origin[0], x1: size[0] - 1 - origin[0], y0: name.startsWith("crown_") ? 0 : name === "balcony_braced" ? -6 : FLOOR_H - 6, y1: size[1] - 1 - origin[1], z0: -origin[2], z1: size[2] - 1 - origin[2] });
  spawnLights.set(name, sl.length);
  const { buffer, clipped } = toMcstructure(blocks, size, origin, [...markers, ...wardens, ...posts, ...cushionActors]);
  if (clipped) throw new Error(`${name}: ${clipped} blocks outside the box`);
  writeFileSync(join(out, `${name}.mcstructure`), buffer);
  const tally = (f) => [...blocks.values()].filter(f).length;
  const conn = connectors.map((c) => `${c.facing}@y${c.y + origin[1]}`).join(" ");
  summary.push(`${name}: ${sx}x${sy}x${sz}, connectors ${conn || "none"}; ` +
    `${wardens.length} wardens, ${posts.length} elf posts, ${tally((b) => isLightBlock(b.name))} hidden lights, ${tally((b) => b.name.endsWith("_log") || b.name.endsWith("_wood"))} logs, ${tally((b) => b.name === B.leaves)} leaves, ` +
    `${tally((b) => b.name === B.planks)} planks, ${tally((b) => b.name.includes("slab"))} slabs, ${tally((b) => b.name === RAIL)} rails, ${buffer.length} bytes`);
}

// --- tree nodes: platform + crown. Nodes and towers are never written alone: each is a part of combo pieces -----------------
const treeSpec = (opts) => {
  const t = buildTree({ pool: POOL("combos"), upPool: POOL("crowns"), ...opts });
  // a tower has the stair base on its lower deck and the opening on its upper deck: a closed walk ring round the 3x3 trunk must stay free on both (owner: "going round the staircase was not possible")
  const trunk = []; for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) trunk.push([x, z]);
  assertWalk(`tree seed ${opts.seed}`, t.blocks, { connectors: t.connectors, ring: opts.levels.length === 2 ? [{ trunk, level: FLOOR_H + 1 }, { trunk, level: FLOOR_H + LEVEL_H + 1 }] : [] });
  return t;
};
const C = (facing, off, hi = false) => ({ facing, off, hi });
// single level: shape, connectors (face, offset along the face), trunk 3x3
const NODES = {
  node_a: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.cutrect15, conn: [C("north", 1), C("south", -2)] }], seed: 11011 }),
  node_b: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.octagon15, conn: [C("west", 1), C("east", -1), C("south", 0)] }], seed: 22022 }),
  node_c: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.plus15, add: (x, z) => x >= 4 && z <= -4, conn: [C("north", -1), C("east", 1), C("south", 1), C("west", 0)] }], seed: 33033 }),
  node_d: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.oval17h, conn: [C("east", 0), C("west", 0), C("north", -2)] }], seed: 44044 }),
  node_e: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.cutrect13e, conn: [C("north", -1), C("east", 1)] }], seed: 55055 }),
  node_f: treeSpec({ trunk: "square3", levels: [{ rows: SHAPES.cutrect17h, conn: [C("west", 1), C("east", -1), C("south", 1)] }], seed: 66066 }),
  // two levels: lower deck, upper deck +8, slab spiral stair in the ring round a 3x3 trunk
  tower_a: treeSpec({ trunk: "square3", seed: 77077, levels: [
    { rows: SHAPES.octagon17, conn: [C("south", -1), C("west", 1)] }, { rows: SHAPES.octagon17, conn: [C("north", 1, true), C("east", -1, true)], clip: (x, z) => z >= 6 }] }), // upper deck stops at z 5: rows to z 4 keep the walk ring round the stair opening (was plus15 clipped at z 4)
  tower_b: treeSpec({ trunk: "square3", seed: 88088, levels: [
    { rows: SHAPES.plus17w, conn: [C("east", 1), C("north", -1), C("south", 0)] }, { rows: SHAPES.octagon17w, conn: [C("south", 1, true), C("west", -1, true)] }] }),
  tower_c: treeSpec({ trunk: "square3", seed: 99099, levels: [
    { rows: SHAPES.oval17, conn: [C("north", 2), C("south", -2)] }, { rows: SHAPES.cutrect17.concat([6]), conn: [C("east", 1, true), C("west", -1, true)] }] }),
};
// central tree (village_central.mjs): the Court (lower deck, 4 rim connectors, Elven rope from the ground, start anchor), the round 5x5 trunk with a slab spiral
// stair round it, the Hall (upper deck +8: open pavilion, dome, chandelier, lookout bay), the stream and the reading circle; crown jigsaw above the Hall
{
  const NAME = "central_mallorn_01";
  let elf = null;
  const t = buildTree({
    pool: POOL("combos"), trunk: "round5", seed: 20261007, rope: true, anchor: true, upPool: POOL("crowns_central"),
    levels: [{ rows: COURT_ROWS, conn: COURT_CONN.map((c) => C(c.facing, c.off)) }, { rows: HALL_ROWS, conn: [], add: HALL_BAY }],
    dressOpts: { lampBudget: 6, arms: [2, 0], bannerFaces: [0, 0], flags: 0, rimStep: 3, rimMax: 30, gardenR: 10, islands: [4, 0] },
    hooks: {
      structure: (ctx) => {
        heartwoodRings(ctx); buildHall(ctx); buildStream(ctx); buildCourt(ctx);
        for (let z = -10; z <= -6; z++) for (const h of [1, 2]) ctx.keep.add(key(6, FLOOR_H + h, z)); // the lane east of the reading circle stays open (the strip between the circle and the rim must not become a closed pocket)
        for (let x = -5; x <= -4; x++) for (let z = -2; z <= 0; z++) for (const h of [1, 2]) ctx.keep.add(key(x, FLOOR_H + LEVEL_H + h, z)); // the exit lane from the last tread onto the Hall floor stays open
        // elf cells (wardens, Loremaster, reserve posts) from the finished structure; the dressing keeps off them (3 x 3 x 3 round each)
        // nobody stands ON a bridge path, a stair column or the rope's landing (the ring and the deck beside them are wide enough to pass an elf)
        const apart = new Set(), paths = keepClearCells(ctx.blocks, { connectors: ctx.keepOpts.connectors, trunkR: ctx.rT, stair: ctx.keepOpts.stair, rope: ctx.keepOpts.rope, deckY: FLOOR_H });
        for (const k of paths) { const [x, y, z] = k.split(",").map(Number); if (y === FLOOR_H + 1) apart.add(`${x},${z}`); }
        const wardens = wardenCells(NAME, ctx.blocks, WARDENS[NAME], 7, apart), posts = postCells(NAME, ctx.blocks, wardens, apart);
        for (const c of [...wardens, ...posts]) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let h = 1; h <= 3; h++) ctx.keep.add(key(c.x + dx, FLOOR_H + h, c.z + dz));
        elf = { wardens, posts };
      },
    },
  });
  const trunk5 = []; for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) trunk5.push([x, z]);
  writePiece(NAME, t.blocks, t.size, t.origin, t.connectors, {
    loopMarkers: sideMarkerCells(t.blocks, t.origin, (x, z) => t.connectors.every((c) => Math.max(Math.abs(x - c.x), Math.abs(z - c.z)) > 4), FLOOR_H), // (never a run whose five rails include a connector's rail post: a joined bridge deck lies outside it)
    keep: t.keep, wardens: elf.wardens, posts: elf.posts, cushions: t.cushions,
    walk: { ring: [{ trunk: trunk5, level: FLOOR_H + 1 }, { trunk: trunk5, level: FLOOR_H + LEVEL_H + 1 }], must: [{ x: 0, y: FLOOR_H + LEVEL_H + 1, z: -5 }] }, // a walk ring closed on both decks, the Hall reachable
  });
}

// --- combo pieces: bridge + destination tree in one piece ------------------------------------------------------------------
// Every (node, entry connector) pair gets one straight bridge (lengths cycle 7..15); the entry connector's face is the bridge side,
// the other connectors stay exits. Owner 2026-10-08: dog-legs inside combos are "ugly and unnecessary, it could have been straight",
// so combos use straight bridges only (the diagonal exists only in the runtime planner's bridges).
const comboList = [];
{
  let next = 0; // each bridge length is used in turn
  for (const [node, tree] of Object.entries(NODES)) {
    for (let ei = 0; ei < tree.connectors.length; ei++) {
      const facing = tree.connectors[ei].facing;
      if (makeCombo(tree, ei, STRAIGHT[0], POOL("combos")).why?.match(/^(entry|another)/)) continue; // no bridge side on this connector
      for (let t = 0; t < STRAIGHT.length; t++) {
        const spec = STRAIGHT[(next + t) % STRAIGHT.length];
        const cb = makeCombo(tree, ei, spec, POOL("combos"), next);
        if (cb.why) continue; // this bridge sticks out of this node's width: next one
        const name = `combo_${node}_${facing}_${spec.name}`;
        const wardenCellsOfNode = wardenCells(node, tree.blocks, WARDENS[node] ?? 0, 5, postAvoid(tree));
        const nodeWardens = wardenCellsOfNode.map(cb.wardenMap);
        const nodePosts = postCells(node, tree.blocks, wardenCellsOfNode).map((c) => ({ ...cb.wardenMap(c), kind: c.kind }));
        writePiece(name, cb.blocks, cb.size, cb.origin, cb.connectors, {
          markers: [[cb.bridgeMid[0], cb.bridgeMid[1]], [cb.axis[0] + 0.5, cb.axis[1] + 0.5]], wardens: nodeWardens, posts: nodePosts, keep: cb.keep, cushions: cb.cushions,
          loopMarkers: sideMarkerCells(cb.blocks, cb.origin, (x, z) => z >= cb.bridgeLen), // the node's rims; the bridge half has none
        });
        comboList.push({ name, node });
        next += t + 1;
        break;
      }
    }
  }
}

// --- crown pieces ------------------------------------------------------------------------------------------------
// Crown fit (owner 2026-10-10: the crowns were clipped flat at the box faces): crowns are rebuilt smaller until nothing lies in the outermost cell layer of the box (sides and top), asserted here for every crown piece
const CROWN_FIT = process.env.CROWN_FIT !== "0";
const crown = (name, o) => {
  const c = buildCrown({ ...o, fit: CROWN_FIT });
  if (CROWN_FIT) {
    const [sx, sy, sz] = c.size;
    for (const k of c.blocks.keys()) {
      const [x, y, z] = k.split(",").map(Number), px = x + c.origin[0], pz = z + c.origin[2];
      if (y > 0 && (px < 1 || px > sx - 2 || pz < 1 || pz > sz - 2 || y > sy - 2)) throw new Error(`${name}: ${k} lies in the outermost layer of the box`);
    }
  }
  writePiece(name, c.blocks, c.size, c.origin, []);
};
crown("crown_small", { h: 7, H: 16, seed: 4004, branches: 8, blob: 2.1 });
crown("crown_medium", { h: 8, H: 20, seed: 6006, branches: 9, blob: 2.6 });
crown("crown_large", { h: 10, H: 24, seed: 8008, branches: 11, blob: 2.9 });
crown("crown_central_a", { h: 16, H: 34, seed: 12012, branches: 14, blob: 3.6, central: true });
crown("crown_central_b", { h: 13, H: 30, seed: 10010, branches: 12, blob: 3.3, central: true });

// --- ends ---------------------------------------------------------------------------------------------------------------
// balcony_braced: half-round rim balcony on a log pillar to the ground, braced under the deck; one connector, 7 x 7
{
  const b = buildBalcony();
  if (pillarAmount(AMOUNTS.light)) decoratePillar(b.blocks, { x0: -b.origin[0], x1: b.size[0] - 1 - b.origin[0], y0: -b.origin[1], y1: b.size[1] - 1 - b.origin[1], z0: -b.origin[2], z1: b.size[2] - 1 - b.origin[2] }, { amount: pillarAmount(AMOUNTS.light), seed: 4141 });
  writePiece("balcony_braced", b.blocks, b.size, b.origin, b.connectors, { loopMarkers: [[b.origin[0] + 0.5, b.size[2] - 0.5]], keep: b.keep, cushions: b.cushions }); // centre of the far rim row
}
// lookout_01: square-ish platform on a log pillar down to ROOTS, one connector
{
  const blocks = new Map();
  for (let y = -ROOTS; y < FLOOR_H; y++) for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) blocks.set(key(x, y, z), { name: B.log, states: { "minecraft:block_face": "up" } });
  const deck = new Deck(blocks, FLOOR_H, SHAPES.lookout9, { box: { hx: 4, hz: 4 } });
  deck.connect("north", 0, "minecraft:empty");
  const { rails, forced } = deck.build();
  writeRails(blocks, rails, forced);
  const lookoutConnectors = deck.connectors.map((c) => ({ ...c, y: FLOOR_H }));
  const lookoutKeep = keepClearCells(blocks, { connectors: lookoutConnectors, deckY: FLOOR_H, depth: 4 }) // a pillar, no trunk on the deck: only the connector corridor;
  const lookoutDress = dressLookout(blocks, lookoutKeep, FLOOR_H, 5252); // flag pole, lamp posts, leaf screen, jar, moss under the deck (village_dress.mjs)
  addHiddenLights(blocks, { x0: -4, x1: 4, y0: -ROOTS, y1: FLOOR_H + 3, z0: -4, z1: 4 }, (x, y, z) => z === -4);
  // the three free sides (south, east, west) are 5-wide rim rows: loop markers on their centres
  if (pillarAmount(AMOUNTS.full)) decoratePillar(blocks, { x0: -4, x1: 4, y0: -ROOTS, y1: FLOOR_H + 3, z0: -4, z1: 4 }, { amount: pillarAmount(AMOUNTS.full), seed: 5252 });
  writePiece("lookout_01", blocks, [9, ROOTS + FLOOR_H + 4, 9], [4, ROOTS, 4], lookoutConnectors, { loopMarkers: [[4.5, 8.5], [8.5, 4.5], [0.5, 4.5]], keep: lookoutKeep, cushions: lookoutDress.cushions });
}
// railing_end (plug): deck row of 5 + 5 rails; connector at the middle deck cell facing the parent
{
  const blocks = new Map(), rails = new Set(), forced = new Map();
  for (let x = 0; x < 5; x++) { blocks.set(key(x, 0, 0), planks()); rails.add(key(x, 1, 0)); }
  forced.set(key(0, 1, 0), ["north"]); forced.set(key(4, 1, 0), ["north"]);
  writeRails(blocks, rails, forced);
  blocks.set(key(2, 0, 0), deckJigsaw("north", "minecraft:empty"));
  writePiece("railing_end", blocks, [5, 2, 1], [0, 0, 0], []);
}

// --- pools and structure -------------------------------------------------------------------------------------------
const poolFiles = new Set();
const pool = (name, elements, fallback) => {
  const node = {
    description: { identifier: POOL(name) },
    elements: elements.map(([piece, weight]) => ({
      element: { element_type: "minecraft:single_pool_element", location: `lothlorien/village/${piece}`, projection: "rigid" },
      weight,
    })),
  };
  if (fallback) node.fallback = fallback;
  poolFiles.add(`village_${name}.json`);
  writeFileSync(join(bpOut, "worldgen", "template_pools", `village_${name}.json`),
    JSON.stringify({ format_version: "1.21.100", "minecraft:template_pool": node }, null, 2) + "\n");
};
pool("start", [["central_mallorn_01", 1]]);
// a platform exit gets a combo (bridge + tree) or, when none fits, a railing / braced balcony / lookout; never a bridge alone
pool("combos", comboList.map((c) => [c.name, 3 + (c.node.startsWith("tower_") ? 2 : 0)]) // towers weigh more: most villages should climb to a second level
    .concat(Object.entries(EARLY_END)), POOL("exits"));
pool("exits", [["railing_end", EXIT_WEIGHTS.railing], ["balcony_braced", EXIT_WEIGHTS.balcony], ["lookout_01", EXIT_WEIGHTS.lookout]], POOL("plugs"));
pool("plugs", [["railing_end", 1]]);
// trees placed at max_depth only get the fallback pool (Java rule), so the fallback offers the big crowns too; small is the last resort
pool("crowns", [["crown_large", 3], ["crown_medium", 2]], POOL("crowns_fallback"));
pool("crowns_fallback", [["crown_large", 12], ["crown_medium", 8], ["crown_small", 1]]);
pool("crowns_small", [["crown_small", 1]]);
pool("crowns_central", [["crown_central_a", 2], ["crown_central_b", 1]], POOL("crowns_small"));
for (const f of readdirSync(join(bpOut, "worldgen", "template_pools"))) if (f.startsWith("village_") && !poolFiles.has(f)) unlinkSync(join(bpOut, "worldgen", "template_pools", f));

writeFileSync(join(bpOut, "worldgen", "structures", "elven_village.json"), JSON.stringify({
  format_version: "1.21.100",
  "minecraft:jigsaw": {
    description: { identifier: "lothlorien:elven_village" },
    biome_filters: [{ test: "has_biome_tag", value: "lothlorien" }],
    step: "surface_structures",
    terrain_adaptation: "none",
    start_pool: POOL("start"),
    start_jigsaw_name: "lothlorien:village_anchor",
    max_depth: MAX_DEPTH,
    // Bedrock's world_surface is the TOP SOLID block (Java: the first free cell above it), so absolute N puts the start N blocks from the top solid block.
    // -(ROOTS - 1) puts tree y 0 on the first air cell: verified in the owner's flat world "ET" 2026-10-10 (grass at y -1, -ROOTS buried the rope's lowest piece).
    start_height: { type: "constant", value: { absolute: -(ROOTS - 1) } },
    heightmap_projection: "world_surface",
    max_distance_from_center: { horizontal: 116, vertical: 116 },
  },
}, null, 2) + "\n");

console.log(summary.join("\n"));
console.log("spawn-proof hidden lights per piece: " + [...spawnLights].filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(", "));
console.log("native cushions per piece: " + [...cushionTally].filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(", "));
