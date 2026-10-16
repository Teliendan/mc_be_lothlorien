// Dressing of the Elven village pieces (M7 showcase WP3; style guide docs/design/village_style.md sections 2, 5, 7.2, 7.4 - 7.7, 7.10):
// heartwood trunk ring, lamp posts at every bridgehead, trunk banners and branch-arm lamps, leaf drifts, rim dressing, under-deck moss and
// berries, bridge dressing (gate arch, moss and berries under the belly), balcony and lookout dressing, and the home pavilion.
// Pure: every function writes into a block map ("x,y,z" -> { name, states }) after the structure and before the hidden lights.
// Dressing goes through deco() of village_checks.mjs, so it never lands in a keep-clear cell or on a non-air block (soft things such as leaf
// carpets, the one allowed content of a keep-clear cell, go through `soft`). Nothing here is verified in game (2026-10-14): block orientation
// states are the documented ones (mallorn stairs / trapdoors `minecraft:cardinal_direction`, vanilla wall banners `facing_direction`).
//
// The home pavilion frame (homeFrame, frameCell...) is the contract with the runtime furnishing (WP4b) and the sim:
//   frame = { x0, z0, du: [dx, dz], dv: [dx, dz], k, y, vs, d0, lat0, open, screen, post, lamp }, tree coordinates, y = deck block layer.
//   frameCell(frame, u, v) = [x0 + du[0] * u + dv[0] * v, z0 + du[1] * u + dv[1] * v]   (one cell of the k x k square; the block under the feet is at y)
//   u runs along the back side, v = 0 is the back row (nearest the trunk), v = k - 1 the outer (front) row; dv points away from the trunk and
//   du = (-dv.z, dv.x).  The roof reaches back to the trunk: rows vs..-1 are roof only.
//   furnishing area: interior cells u 1..k-2, v 0..k-2, heights +1 and +2, minus the post cell (frame.post) and the door lane
//   (cells (u, k-2) with |u - cu| <= 1, cu = (k - 1) >> 1); the pavilion hangs its marker lantern (elven_lantern_heartwood, block_face down) at
//   (cu, k - 2) and +3 (k 4, the open variant: (cu, k - 1), the tip of its branch), nothing else at +3 inside the square (see frameArea / frameLamp).
import { B } from "./flet_mallorn.mjs";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { deco, isAirName } from "./village_checks.mjs";
import { SILVER_WATCH } from "./watch_camp_rules.mjs";
import { homeSite } from "../lothlorien_bp/scripts/elf_rules.js";
import { sideTarget } from "../lothlorien_bp/scripts/village_loop.js"; // the runtime planner's own rim test: a bridge may start on a rim run

const L = "lothlorien:", M = "minecraft:";
const key = (x, y, z) => `${x},${y},${z}`;
const PLANKS = B.planks, HEART = `${L}mallorn_heartwood_planks`, SLAB = `${L}mallorn_slab`, RAIL = B.fence;
const DIRV = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const FACING_ID = { north: 2, south: 3, west: 4, east: 5 };
const nameOfVec = (v) => Object.keys(DIRV).find((n) => DIRV[n][0] === v[0] && DIRV[n][1] === v[1]);
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const isDeckName = (n) => n === PLANKS || n === HEART;

// ---- blocks --------------------------------------------------------------------------------------------------------------
export const LEAF = () => ({ name: B.leaves, states: { [`${L}persistent`]: true } }); // dressing leaves never decay
export const GOLD = () => ({ name: `${L}mallorn_golden_leaves`, states: {} });
export const heartPlanks = () => ({ name: HEART, states: {} });
const plank = () => ({ name: PLANKS, states: {} });
const slab = (half = "bottom", heart = false) => ({ name: `${L}mallorn_${heart ? "heartwood_" : ""}slab`, states: { "minecraft:vertical_half": half } });
const stripped = () => ({ name: `${L}mallorn_stripped_log`, states: { "minecraft:block_face": "up" } });
const logAlong = (vec) => ({ name: B.log, states: { "minecraft:block_face": vec[0] !== 0 ? "east" : "south" } }); // east = x axis, south = z axis
const fence = (heart = false) => ({ name: `${L}mallorn_${heart ? "heartwood_" : ""}fence`, states: { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false } });
export const lantern = (hang = false, gold = false) => ({ name: `${L}elven_lantern${gold ? "_heartwood" : ""}`, states: { "minecraft:block_face": hang ? "down" : "up" } });
// open mallorn trapdoor standing on edge: `facing` = the direction it faces (away from the block it is attached to; its panel is on the opposite edge)
const trapOpen = (facing) => ({ name: `${L}mallorn_trapdoor`, states: { "minecraft:cardinal_direction": nameOfVec(facing), "minecraft:vertical_half": "bottom", "lothlorien:open": true } });
const stairs = (facing, half = "bottom") => ({ name: `${L}mallorn_stairs`, states: { "minecraft:cardinal_direction": nameOfVec(facing), "minecraft:vertical_half": half } });
const carpet = (n) => ({ name: `${L}mallorn_leaf_carpet`, states: { "lothlorien:amount": n, "lothlorien:on_grass": false, "lothlorien:dew": false, "minecraft:cardinal_direction": "north" } });
const jar = () => ({ name: `${L}firefly_jar`, states: { "minecraft:block_face": "up" } });
const moss = (tip) => ({ name: `${M}pale_hanging_moss`, states: { tip } });
const berries = (head) => ({ name: `${M}cave_vines_${head ? "head" : "body"}_with_berries`, states: { growing_plant_age: 25 } }); // age 25 = the maximum (0..25): a cave vine tip below that grows longer on random ticks
const mossBlock = () => ({ name: `${M}moss_block`, states: {} });
const candle = (n) => ({ name: `${M}white_candle`, states: { candles: n - 1, lit: true } });
// vanilla flowers of our palette (white / blue / pink / purple): a minority of the pots, planters and gardens (they need soil in a planter; a pot holds any)
const VANILLA_FLOWERS = ["lily_of_the_valley", "cornflower", "blue_orchid", "allium", "azure_bluet", "white_tulip", "pink_tulip", "oxeye_daisy"].map((n) => ({ name: `${M}${n}`, states: {} }));
const decoratedPot = () => ({ name: `${M}decorated_pot`, states: {} });
// flower pot: the plant is block entity data (FlowerPot.PlantBlock), written by toMcstructure from `plant`; the format is documented, not verified in game
const flowerPot = (plant) => ({ name: `${M}flower_pot`, states: { update_bit: false }, plant });
const PLANTS = [
  { name: `${L}elanor`, states: { [`${L}on_grass`]: false } }, { name: `${L}niphredil`, states: { [`${L}on_grass`]: false } },
  { name: `${L}athelas`, states: { [`${L}on_grass`]: false } }, { name: `${L}golden_fern`, states: { [`${L}on_grass`]: false } },
];
const wallBanner = (facing, spec) => ({ name: `${M}wall_banner`, states: { facing_direction: FACING_ID[nameOfVec(facing)] }, banner: spec });
const pickPlant = (rnd) => (rnd() < 0.25 ? VANILLA_FLOWERS[Math.floor(rnd() * VANILLA_FLOWERS.length)] : PLANTS[Math.floor(rnd() * PLANTS.length)]); // ~1 in 4 a vanilla flower
const potPlant = (rnd) => (rnd() < 0.15 ? null : pickPlant(rnd)); // flower pots: mostly planted, now and then empty (<= 1 in 5)
const plantBlock = (pl) => (pl.name.startsWith(L) ? { name: pl.name, states: { ...pl.states, [`${L}on_grass`]: true } } : { name: pl.name, states: { ...pl.states } }); // on soil
// banner designs (Bedrock: colour ids reversed, light_gray = silver 7, green 2, lime 10, light_blue 12, white 15); the owner's M6 watch design first
const recolour = (to, id) => ({ ...SILVER_WATCH, patterns: SILVER_WATCH.patterns.map((q) => (q.color === "silver" ? { ...q, color: to, colorId: id } : q)) });
export const BANNERS = { watch: SILVER_WATCH, lightblue: recolour("light_blue", 12), white: recolour("white", 15) }; // the silver layer of the owner's design in light blue / white (main one: watch)
const minorBanner = (rnd) => BANNERS[rnd() < 0.5 ? "lightblue" : "white"];
// standing banner on a fence post (a rim flag): ground_sign_direction 0 south, 4 west, 8 north, 12 east (the way the cloth faces); +4 per quarter turn clockwise
const standingBanner = (facing, spec) => ({ name: `${M}standing_banner`, states: { ground_sign_direction: { "0,1": 0, "-1,0": 4, "0,-1": 8, "1,0": 12 }[facing.join()] }, banner: spec });

// ---- frame helpers (the contract, see the header) ------------------------------------------------------------------------------
export const frameCell = (f, u, v) => [f.x0 + f.du[0] * u + f.dv[0] * v, f.z0 + f.du[1] * u + f.dv[1] * v];
export const frameCu = (f) => (f.k - 1) >> 1;
export const frameInterior = (f) => { const c = []; for (let u = 1; u <= f.k - 2; u++) for (let v = 0; v <= f.k - 2; v++) c.push([u, v]); return c; };
export const frameDoorLane = (f) => frameInterior(f).filter(([u, v]) => v === f.k - 2 && Math.abs(u - frameCu(f)) <= 1);
export const framePost = (f) => [frameCu(f), 1]; // the elf post stands here (interior, not the door lane, not a screen cell)
export const frameLamp = (f) => [frameCu(f), f.k < 5 ? f.k - 1 : f.k - 2]; // the marker lantern hangs over this cell at +3 (the open variant, k 4, hangs it from the arm tip in the front row)
// furnishing area cells [u, v] (WP4b furnishes these at +1 and +2)
export const frameArea = (f) => { const p = framePost(f), lane = new Set(frameDoorLane(f).map((c) => c.join(","))); return frameInterior(f).filter(([u, v]) => !(u === p[0] && v === p[1]) && !lane.has(`${u},${v}`)); };
// the same frame turned k quarter turns clockwise about the tree axis ((x, z) -> (-z, x)) and moved by (dx, dz)
export function rotateFrame(f, quarter, dx = 0, dz = 0) {
  const rot = (v) => { let [x, z] = v; for (let i = 0; i < quarter; i++) [x, z] = [-z, x]; return [x, z]; };
  const [x0, z0] = rot([f.x0, f.z0]);
  return { ...f, x0: x0 + dx, z0: z0 + dz, du: rot(f.du), dv: rot(f.dv), post: f.post, lamp: f.lamp };
}

// ---- pockets: a walkable deck cell the dressing closed off (all round: rails, trapdoors, planters) is opened again ----------------------------------------------
// Walkable = a deck block with nothing that collides in the two cells above. Components are compared before and after the dressing; a part that was connected to a
// bigger part before and is not any more is a pocket: the dressing blocks beside it are removed (trapdoors first) until it is connected again.
const SOFT_BLOCK = /light_block|carpet|wall_banner|pale_hanging_moss|cave_vines|glow_lichen|spore_blossom|elven_rope/;
const walkFree = (map, x, y, z) => { const n = map.get(key(x, y, z))?.name; return isAirName(n) || SOFT_BLOCK.test(n); };
function walkComps(map, Y) {
    const id = new Map(), size = [];
    for (const [k, b] of map) {
      const [x, y, z] = k.split(",").map(Number);
      if (y !== Y || !(isDeckName(b.name) || b.name === "minecraft:jigsaw") || !walkFree(map, x, Y + 1, z) || !walkFree(map, x, Y + 2, z) || id.has(`${x},${z}`)) continue;
      const q = [[x, z]]; id.set(`${x},${z}`, size.length); let n = 0;
      for (let i = 0; i < q.length; i++) {
        n++;
        for (const [a, c] of D4) {
          const nx = q[i][0] + a, nz = q[i][1] + c, nk = `${nx},${nz}`;
          if (id.has(nk)) continue;
          const nb = map.get(key(nx, Y, nz))?.name;
          if (!(isDeckName(nb) || nb === "minecraft:jigsaw") || !walkFree(map, nx, Y + 1, nz) || !walkFree(map, nx, Y + 2, nz)) continue;
          id.set(nk, size.length); q.push([nx, nz]);
        }
      }
      size.push(n);
    }
    return { id, size };
}

// A dead-end nook beside the pavilion that is reachable only through the furnishing area (the runtime furnishing may fill it) would be cut off: such cells become a small planter
// (moss with a plant) instead. Checked with the whole furnishing area treated as blocked.
function sealNooks(blocks, keep, home, rnd, stats) {
  const Y = home.y;
  for (let guard = 0; guard < 12; guard++) {
    const temp = new Map(blocks);
    for (const [u, v] of frameArea(home)) { const [x, z] = frameCell(home, u, v); temp.set(key(x, Y + 1, z), { name: "minecraft:stone", states: {} }); }
    const c0 = walkComps(blocks, Y), c1 = walkComps(temp, Y), best = new Map();
    for (const [cell, i1] of c1.id) { const i0 = c0.id.get(cell); if (i0 === undefined) continue; if (!best.has(i0) || c1.size[i1] > c1.size[best.get(i0)]) best.set(i0, i1); }
    const pockets = [...c1.id].filter(([cell, i1]) => { const i0 = c0.id.get(cell); return i0 !== undefined && best.get(i0) !== i1; }).map(([cell]) => cell.split(",").map(Number));
    const fill = pockets.filter(([x, z]) => !keep.has(key(x, Y + 1, z)) && !keep.has(key(x, Y + 2, z)));
    if (!fill.length) return;
    for (const [x, z] of fill) {
      blocks.set(key(x, Y + 1, z), mossBlock());
      const pl = pickPlant(rnd);
      blocks.set(key(x, Y + 2, z), plantBlock(pl));
      stats.nooks = (stats.nooks ?? 0) + 1;
    }
  }
}

function repairPockets(blocks, before, ys, stats) {
  const comps = walkComps;
  for (const Y of ys) {
    const c0 = comps(before, Y);
    for (let guard = 0; guard < 60; guard++) {
      const c1 = comps(blocks, Y), best = new Map(); // largest part of each old component
      for (const [cell, i1] of c1.id) { const i0 = c0.id.get(cell); if (i0 === undefined) continue; if (!best.has(i0) || c1.size[i1] > c1.size[best.get(i0)]) best.set(i0, i1); }
      const pocket = [...c1.id].find(([cell, i1]) => { const i0 = c0.id.get(cell); return i0 !== undefined && best.get(i0) !== i1; });
      if (!pocket) break;
      const [px, pz] = pocket[0].split(",").map(Number);
      let removed = false;
      const order = [/trapdoor/, /stairs|candle|jar|decorated_pot/, /moss_block|flower_pot|fern|elanor|niphredil|athelas|tulip|orchid|allium|cornflower|bluet|daisy|lily_of/]; // what to take away first
      for (const re of order) {
        for (const [a, c] of D4) for (const h of [1, 2]) {
          const k = key(px + a, Y + h, pz + c), b = blocks.get(k);
          if (b && !isAirName(b.name) && !SOFT_BLOCK.test(b.name) && re.test(b.name) && isAirName(before.get(k)?.name)) { // placed by the dressing
            for (const hh of [1, 2]) { const kk = key(px + a, Y + hh, pz + c); if (isAirName(before.get(kk)?.name)) blocks.set(kk, before.get(kk) ?? { name: "minecraft:air", states: {} }); } // the item's cells (a planter's plant goes with its moss)
            removed = true; stats.pockets = (stats.pockets ?? 0) + 1;
            break;
          }
        }
        if (removed) break;
      }
      if (!removed) break; // a pocket of the structure itself, or one the dressing did not cause
    }
  }
}

// frameOf(at, x, y, z): the pavilion frame of a home post from block names alone (at(x, y, z) -> block name; (x, y, z) = the deck cell under the post), or null. Pure: the sim
// and the runtime can use it. It finds the frame whose post cell is (x, z), whose marker lantern hangs at +3 over frameLamp and whose two front corner posts are stripped logs at +3.
export function frameOf(at, x, y, z) {
  for (let k = 7; k >= 4; k--) for (const dv of D4) {
    const du = [-dv[1], dv[0]], cu = (k - 1) >> 1;
    const f = { x0: x - du[0] * cu - dv[0], z0: z - du[1] * cu - dv[1], du, dv, k, y, open: k < 5 };
    const [lx, lz] = frameCell(f, ...frameLamp(f));
    if (at(lx, y + 3, lz) !== `${L}elven_lantern_heartwood`) continue;
    if (![0, k - 1].every((u) => { const [px, pz] = frameCell(f, u, k - 1); return at(px, y + 3, pz) === `${L}mallorn_stripped_log`; })) continue;
    f.post = framePost(f); f.lamp = frameLamp(f);
    return f;
  }
  return null;
}

// ---- the home pavilion frame ----------------------------------------------------------------------------------------------------
// homeFrame(blocks, keep, { y, ring, trunkR, seed, kMax, kMin }): picks the pavilion square on the deck layer y (deck block layer), or null.
//   ring: Chebyshev distance of the walk ring (keep-clear) round the trunk: the back row sits at ring + 1 or ring + 2; trunkR: trunk half width.
// All k x k cells must be plain deck (planks / heartwood planks); the interior (u 1..k-2, v 0..k-2) needs air at +1..+3 and no keep-clear cell;
// the edge cells may carry rim rails only; the roof volume (+4, +5 over the square and back to the trunk) holds nothing but air and leaves.
// Larger squares win (7 down to kMin), then the nearest to the trunk and the most centred on the trunk face; among the faces that tie, the
// seed picks. k 4 is the open variant (no roof, a hanging lamp from a bent branch); nothing smaller than 4 gets a pavilion.
export function homeFrame(blocks, keep, { y, ring = 2, trunkR = 1, seed = 1, kMax = 7, kMin = 4, avoid = new Set(), box = null } = {}) {
  const at = (x, yy, z) => blocks.get(key(x, yy, z))?.name;
  const rnd = makeRandom((seed ^ 0x5f3759df) >>> 0);
  const found = [];
  for (const dv of D4) {
    const du = [-dv[1], dv[0]];
    for (let k = kMax; k >= kMin; k--) for (const d0 of [ring + 1, ring + 2]) for (let lat0 = -(k - 1) - 4; lat0 <= 4; lat0++) {
      const covered = []; for (let l = -trunkR; l <= trunkR; l++) if (l >= lat0 && l <= lat0 + k - 1) covered.push(l);
      const centred = covered.includes(-trunkR) && covered.includes(trunkR); // both ribs leave the trunk face; else an off-axis square: a branch bends from the trunk to it
      if (!centred && (k < 5 || covered.length)) continue; // (an off-axis square has no trunk column in its span: its branch comes round the corner)
      const f = { x0: dv[0] * d0 + du[0] * lat0, z0: dv[1] * d0 + du[1] * lat0, du, dv, k, y, vs: trunkR + 1 - d0, d0, lat0, trunkR, mode: centred ? "c" : "o" };
      if (!centred) f.near = lat0 > trunkR ? 0 : k - 1; // the column nearest the trunk
      if (!frameFits(blocks, keep, f, at, avoid, box)) continue;
      found.push({ f, k, d0, centre: Math.abs(lat0 + (k - 1) / 2), face: nameOfVec(dv), jitter: rnd() });
    }
  }
  if (!found.length) return null;
  const kBest = Math.max(...found.map((c) => c.k));
  const top = found.filter((c) => c.k === kBest);
  const faces = [...new Set(top.map((c) => c.face))];
  const face = faces[Math.floor(rnd() * faces.length)];
  const mine = top.filter((c) => c.face === face).sort((a, b) => a.d0 - b.d0 || a.centre - b.centre || a.jitter - b.jitter);
  const { f } = mine[0];
  f.open = f.k < 5;
  f.post = framePost(f); f.lamp = frameLamp(f);
  return f;
}
function frameFits(blocks, keep, f, at, avoid, box) {
  const { k, y } = f;
  for (let u = 0; u < k; u++) for (let v = 0; v < k; v++) { const [x, z] = frameCell(f, u, v); if (avoid.has(`${x},${z}`)) return false; }
  for (let u = 0; u < k; u++) for (let v = 0; v < k; v++) {
    const [x, z] = frameCell(f, u, v);
    if (!isDeckName(at(x, y, z))) return false;
    const interior = u >= 1 && u <= k - 2 && v <= k - 2;
    for (let h = 1; h <= 3; h++) {
      const kk = key(x, y + h, z), n = at(x, y + h, z);
      if (keep.has(kk)) return false;
      if (isAirName(n)) continue;
      if (!interior && h === 1 && n === RAIL) continue; // a rim rail is the pavilion's own edge
      return false;
    }
  }
  if (k >= 5) for (let u = 0; u < k; u++) for (let v = f.vs; v < k; v++) { // the roof volume
    const [x, z] = frameCell(f, u, v);
    for (const h of [4, 5]) { const n = at(x, y + h, z); if (!isAirName(n) && n !== B.leaves) return false; }
  }
  if (f.mode === "o") for (const [u, v] of offAxisRoute(f)) { const [x, z] = frameCell(f, u, v), n = at(x, y + 4, z); if (!isAirName(n) && n !== B.leaves) return false; }
  return true;
}

// An off-axis square (no trunk column in its span): the branch leaves the trunk face at its nearest column, runs along the ring row (v = vs) to the square's near
// column u = f.near and on along dv; the far rib stands on the back beam (row v = 0). -> [[u, v]] of the cells of the part that lies outside the square (u may be < 0 or >= k)
function offAxisRoute(f) {
  const lr = f.lat0 > f.trunkR ? f.trunkR : -f.trunkR, latNear = f.lat0 + f.near, cells = [];
  const step = Math.sign(latNear - lr);
  for (let l = lr; l !== latNear + step && step !== 0; l += step) cells.push([l - f.lat0, f.vs]);
  for (let v = f.vs; v <= f.k; v++) cells.push([f.near, v]);
  return cells;
}

// The biggest free square of the lower deck (elf_rules homeSite), nearest to the trunk, for a tree that gets no pavilion -> { x0, z0, k } | null
function reserveSite(blocks, keep, y) {
  const at = (x, yy, z) => blocks.get(key(x, yy, z))?.name ?? "minecraft:air";
  let best = null;
  for (const k of blocks.keys()) {
    const [x, yy, z] = k.split(",").map(Number);
    if (yy !== y || !isDeckName(blocks.get(k).name)) continue;
    const s = homeSite(at, x, y, z);
    if (!s || s.k < 3) continue;
    const d = Math.hypot(s.x0 + (s.k - 1) / 2, s.z0 + (s.k - 1) / 2);
    if (!best || s.k > best.k || (s.k === best.k && (d < best.d || (d === best.d && (s.x0 < best.x0 || (s.x0 === best.x0 && s.z0 < best.z0)))))) best = { ...s, d };
  }
  return best && { x0: best.x0, z0: best.z0, k: best.k };
}

// ---- the pavilion --------------------------------------------------------------------------------------------------------------------
// writes the roof (ribs, beam, leaf dome, golden ridge), posts, screen, banner and the marker lantern; adds the furnishing area to `keep`.
function buildPavilion(blocks, keep, f, rnd, banner) {
  const { put, can } = deco(blocks, keep);
  const { k, y } = f, cell = (u, v) => frameCell(f, u, v), cu = frameCu(f);
  const at = (x, yy, z) => blocks.get(key(x, yy, z));
  const free = (x, yy, z) => !keep.has(key(x, yy, z));
  // roof writers: may replace air and natural leaves, never logs, never a keep-clear cell
  const roof = (u, v, h, blk) => { const [x, z] = cell(u, v), o = at(x, y + h, z); if (!free(x, y + h, z) || (o && !isAirName(o.name) && o.name !== B.leaves)) return false; blocks.set(key(x, y + h, z), blk); return true; };
  const info = { posts: [], banner: null, screen: "none", lamp: null };
  const outward = [f.dv[0], f.dv[1]], left = [-f.du[0], -f.du[1]], right = f.du;
  // posts: stripped logs on the two outer corners (on a rim cell the rail stays the foot of the post, the logs stand on it: a banner needs a full block)
  const post = (u, v) => {
    const [x, z] = cell(u, v);
    if (at(x, y + 1, z)?.name === RAIL) blocks.set(key(x, y + 1, z), stripped()); // a post on a rim cell replaces the rail fence: one log from the deck up
    else if (can(x, y + 1, z)) put(x, y + 1, z, stripped());
    for (const h of [2, 3]) if (can(x, y + h, z)) put(x, y + h, z, stripped());
    info.posts.push([x, z]);
  };
  for (const u of [0, k - 1]) post(u, k - 1);
  const [lu, lv] = frameLamp(f), [lx, lz] = cell(lu, lv);
  if (f.open) { // open variant: a bent branch from the trunk along the middle column carries the hanging lamp over the square; a little foliage on it, no roof
    for (let v = f.vs; v <= k - 1; v++) roof(cu, v, 4, logAlong(f.dv));
    for (let v = 0; v <= k; v++) for (const du of [-1, 1]) roof(cu + du, v, 4, LEAF());
    roof(cu, k, 4, LEAF());
    for (let v = 0; v <= k; v++) roof(cu, v, 5, v >= 1 && v <= 2 ? GOLD() : LEAF());
    for (const du of [-1, 1]) for (let v = k - 3; v <= k - 1; v++) roof(cu + du, v, 5, LEAF());
  } else {
    // ribs (logs along dv at +4) come out of the trunk faces and stick out one cell past the front beam; a beam links the posts. Centred square: ribs at the trunk's two outer
    // columns. Off-axis square: a branch bends from the trunk along the ring row to the near column, the far rib stands on a back beam.
    let ribs;
    if (f.mode === "c") ribs = [-f.trunkR, f.trunkR].map((l) => l - f.lat0);
    else {
      ribs = [0, k - 1];
      for (const [u, v] of offAxisRoute(f)) roof(u, v, 4, logAlong(v === f.vs && u !== f.near ? f.du : f.dv));
      for (let u = 0; u < k; u++) roof(u, 0, 4, logAlong(f.du)); // back beam
      const far = f.near === 0 ? k - 1 : 0; post(far, 0);
    }
    for (const u of ribs) for (let v = f.vs; v <= k; v++) roof(u, v, 4, logAlong(f.dv));
    for (let u = 0; u < k; u++) roof(u, k - 1, 4, logAlong(f.du));
    // dome: +4 leaves between the ribs (the two front corners left open: the beam ends show), +5 an inner rounded layer (its corners empty), golden leaves along the ridge
    const mids = k % 2 ? [(k - 1) / 2] : [k / 2 - 1, k / 2], big = k >= 6;
    const ridgeU = (u) => mids.includes(u);
    for (let v = f.vs; v <= k - 2; v++) for (let u = 0; u < k; u++) {
      if (ribs.includes(u) || (v >= k - 2 && (u === 0 || u === k - 1)) || (f.mode === "o" && v === 0)) continue;
      roof(u, v, 4, LEAF());
    }
    const inner5 = (u, v) => u >= 1 && u <= k - 2 && v >= f.vs && v <= k - 3 && !(v === k - 3 && (u === 1 || u === k - 2)) && !(big && v === k - 4 && (u === 1 || u === k - 2));
    for (let v = f.vs; v <= k - 3; v++) for (let u = 1; u <= k - 2; u++) if (inner5(u, v)) roof(u, v, 5, ridgeU(u) || (big && ribs.includes(u) && v % 2 === 0) ? GOLD() : LEAF());
    for (const [u, v] of [[0, k - 1], [k - 1, k - 1], [1, k - 1], [k - 2, k - 1], [0, k - 2], [k - 1, k - 2]]) roof(u, v, 5, LEAF()); // a leaf crest over each front post (and the beam ends carry leaves)
    // eaves: upside-down mallorn stairs at +4 on the three open sides (their high step toward the roof; they lean on the roof's leaves and logs)
    const eave = (u, v, facing) => { const [x, z] = cell(u, v); if (can(x, y + 4, z)) { put(x, y + 4, z, stairs(facing, "top")); return [x, z]; } return null; };
    const beards = [];
    for (let v = 0; v <= k - 2; v++) { const l = eave(-1, v, f.du), r = eave(k, v, [-f.du[0], -f.du[1]]); if (l) beards.push(l); if (r) beards.push(r); }
    for (let u = 1; u <= k - 2; u++) if (!ribs.includes(u)) { const e = eave(u, k, [-f.dv[0], -f.dv[1]]); if (e) beards.push(e); }
    for (const [x, z] of beards) if (rnd() < 0.45 && can(x, y + 3, z) && !(Math.abs(x - lx) + Math.abs(z - lz) < 2)) { // a moss beard under some eaves
      const two = rnd() < 0.5 && can(x, y + 2, z);
      put(x, y + 3, z, moss(!two)); if (two) put(x, y + 2, z, moss(true));
    }
    // a lantern under each rib tip (silver: the gold hanging lantern at +3 is the pavilion's marker)
    for (const u of ribs) { const [x, z] = cell(u, k); if (at(x, y + 4, z)?.name === B.log && can(x, y + 3, z)) put(x, y + 3, z, lantern(true, false)); }
  }
  // marker lantern: gold, hanging from the roof at +3 (the runtime finds a pavilion by this lantern)
  if (can(lx, y + 3, lz)) { put(lx, y + 3, lz, lantern(true, true)); info.lamp = [lx, y + 3, lz]; }
  else throw new Error(`pavilion lamp cell ${lx},${y + 3},${lz} is not free`);
  // a low screen (open trapdoors on edge, one high) on one side or none: the sides stay open so one sees inside
  const kind = ["left", "right", "none", "none"][Math.floor(rnd() * 4)];
  info.screen = kind;
  const panel = (u, v, facing) => { const [x, z] = cell(u, v); if (at(x, y + 1, z)?.name !== RAIL && can(x, y + 1, z)) put(x, y + 1, z, trapOpen(facing)); };
  if (kind === "left" || kind === "right") for (let v = 1; v <= k - 2; v++) panel(kind === "left" ? 0 : k - 1, v, kind === "left" ? right : left);
  // a banner on a post, on the face that looks away from the pavilion
  const spec = banner;
  const tries = rnd() < 0.5 ? [0, k - 1] : [k - 1, 0];
  for (const u of tries) { // the cloth hangs on the post's side that looks along the front row into the pavilion (inward), at +3
    const d = u === 0 ? f.du : [-f.du[0], -f.du[1]], [px, pz] = cell(u, k - 1), bx = px + d[0], bz = pz + d[1];
    if (can(bx, y + 3, bz)) { put(bx, y + 3, bz, wallBanner(d, spec)); info.banner = [bx, y + 3, bz]; break; }
  }
  for (const [u, v] of frameInterior(f)) for (const h of [1, 2]) { const [x, z] = cell(u, v); keep.add(key(x, y + h, z)); } // the area, the post cell and the door lane stay clear of dressing
  return info;
}

// ---- shared small helpers --------------------------------------------------------------------------------------------------------------
// soft(): carpets and other soft things may stand in a keep-clear cell (walk-through), but never on a non-air block
function softWriter(blocks) {
  return (x, yy, z, blk) => { const k = key(x, yy, z); if (!isAirName(blocks.get(k)?.name) || !isDeckName(blocks.get(key(x, yy - 1, z))?.name)) return false; blocks.set(k, blk); return true; };
}
const railAt = (blocks, x, y, z) => blocks.get(key(x, y + 1, z))?.name === RAIL;
const deckAt = (blocks, x, y, z) => isDeckName(blocks.get(key(x, y, z))?.name);

// ---- tree dressing ---------------------------------------------------------------------------------------------------------------------
// o: { levels: [{ y, ring (heartwood ring distance, 0 = none) }], conns: [{ x, z, y, d }], trunkR, trunk(x, z), seed, central, pavilion (try a home), kind ("node" | "tower" | "central") }
// -> { home (frame | null), info, connLamps: Map(connector index -> [keys]) , stats }
export function dressTree(blocks, keep, o) {
  const rnd = makeRandom((o.seed ^ 0x3a11d5) >>> 0);
  // nothing may leave the piece box: the cells just outside it count as keep-clear while the dressing runs
  const shell = [];
  if (o.box) for (const lv of o.levels) for (let yy = lv.y + 1; yy <= lv.y + 7; yy++) for (let x = -o.box.hx - 1; x <= o.box.hx + 1; x++) for (let z = -o.box.hz - 1; z <= o.box.hz + 1; z++) {
    if (Math.abs(x) <= o.box.hx && Math.abs(z) <= o.box.hz) continue;
    const k = key(x, yy, z);
    if (!keep.has(k)) { keep.add(k); shell.push(k); }
  }
  const { put, can } = deco(blocks, keep), soft = softWriter(blocks);
  const trunk = o.trunk ?? ((x, z) => Math.max(Math.abs(x), Math.abs(z)) <= o.trunkR);
  const stats = { lamps: 0, banners: 0, arms: 0, rim: 0, moss: 0, home: null };
  const at = (x, yy, z) => blocks.get(key(x, yy, z));
  const bannerSpec = BANNERS.watch, cushions = o.cushions ?? [], flagsLeft = { n: o.flags ?? 1 };
  const cushion = (x, Y, z) => { cushions.push({ x, y: Y, z, variant: [15, 12, 2][cushions.length % 3] }); for (const h of [1, 2]) keep.add(key(x, Y + h, z)); }; // a native cushion (template actor) on a free deck cell

  const before = new Map(blocks); // the structure before the dressing, to find out what the dressing blocked
  // 1. heartwood ring in the deck round the trunk (deck block swap)
  for (const lv of o.levels) if (lv.ring) {
    for (const k of [...blocks.keys()]) {
      const [x, yy, z] = k.split(",").map(Number);
      if (yy === lv.y && Math.max(Math.abs(x), Math.abs(z)) === lv.ring && blocks.get(k).name === PLANKS) blocks.set(k, heartPlanks());
    }
  }
  // 2. the home pavilion on the lower deck
  let home = null, homeInfo = null, site = null;
  const lower = o.levels[0];
  if (o.pavilion) {
    // the bridgehead rails (offsets +-2, +-3 of every connector, 3 deep) are the connectors' own: no pavilion post stands there
    const zone = new Set();
    for (const c of o.conns) if (c.y === lower.y) { const p = [-c.d[1], c.d[0]]; for (let off = -3; off <= 3; off++) for (let dep = 0; dep <= 2; dep++) zone.add(`${c.x + p[0] * off - c.d[0] * dep},${c.z + p[1] * off - c.d[1] * dep}`); }
    home = homeFrame(blocks, keep, { y: lower.y, ring: lower.walkRing, trunkR: o.trunkR, seed: o.seed, avoid: zone, box: o.box });
    if (home) { homeInfo = buildPavilion(blocks, keep, home, rnd, bannerSpec); stats.home = `${home.k}${home.open ? " open" : ""}/${homeInfo.screen}`; }
    else { // no pavilion fits: the biggest free square stays free (it is the home site of the elf post and of the runtime furnishing; no dressing there)
      site = reserveSite(blocks, keep, lower.y);
      if (site) for (let i = 0; i < site.k; i++) for (let j = 0; j < site.k; j++) for (let h = 1; h <= 3; h++) keep.add(key(site.x0 + i, lower.y + h, site.z0 + j));
    }
  }
  // 3. lamp posts at the bridgeheads: the rail posts at +-2 of a connector rise to 2 fences and carry a lantern. Budget (style guide section 5: 3-6 visible lamps per deck,
  // counting the arms and the pavilion's): 5 lit posts on a tree deck (8 on the central one), shared out one per connector first, then a second for each; one pot beside a post
  const connLamps = new Map();
  const budget = o.lampBudget ?? (o.central ? 8 : 5), lit = o.conns.map(() => 0), turn = Math.floor(rnd() * Math.max(1, o.conns.length));
  let used = 0;
  for (let pass = 1; pass <= 2; pass++) for (let j = 0; j < o.conns.length; j++) { const i = (j + turn) % o.conns.length; if (used < budget && lit[i] < pass) { lit[i] = pass; used++; } }
  o.conns.forEach((c, i) => {
    const p = [-c.d[1], c.d[0]], keys = [];
    const sides = rnd() < 0.5 ? [-2, 2] : [2, -2];
    sides.forEach((off, si) => {
      if (si >= lit[i]) return;
      const x = c.x + p[0] * off, z = c.z + p[1] * off;
      if (at(x, c.y + 1, z)?.name !== RAIL) return;
      if (can(x, c.y + 2, z) && can(x, c.y + 3, z)) { put(x, c.y + 2, z, fence()); put(x, c.y + 3, z, lantern(false, o.central)); keys.push(key(x, c.y + 2, z), key(x, c.y + 3, z)); stats.lamps++; }
    });
    // beside one post: a pot on the next rail post along the rim
    const off = sides[0], side = Math.sign(off), nx = c.x + p[0] * (off + side), nz = c.z + p[1] * (off + side);
    if (at(nx, c.y + 1, nz)?.name === RAIL && can(nx, c.y + 2, nz)) put(nx, c.y + 2, nz, flowerPot(potPlant(rnd)));
    connLamps.set(i, keys);
  });
  for (const lv of o.levels) reserveRuns(blocks, keep, lv.y); // (before gardens and rim items: they may not close the last bridge start of a face)
  // 4. trunk dressing per deck level: banners facing the approaches, branch-arm lamps, leaf drift at the foot
  const faceDirs = [...new Set(o.conns.map((c) => nameOfVec(c.d)))];
  for (const lv of o.levels) {
    const Y = lv.y;
    // trunk faces: (trunk cell c, direction d, banner cell n)
    const faces = [];
    for (const k of blocks.keys()) {
      const [x, yy, z] = k.split(",").map(Number);
      if (yy !== Y + 4 || !trunk(x, z) || !(at(x, yy, z).name === B.log)) continue;
      for (const d of D4) if (!trunk(x + d[0], z + d[1])) faces.push({ c: [x, z], d, n: [x + d[0], z + d[1]] });
    }
    // banners: 1-2 per level, on faces that look toward a connector (the first thing a visitor sees), else any face
    const wantFaces = o.bannerFaces?.[o.levels.indexOf(lv)] ?? (lv === o.levels[0] ? 2 : 1); // one trunk banner per level, the lower deck a second one (review 2026-10-16: a bit more banners)
    const byDir = (dn) => faces.filter((f) => nameOfVec(f.d) === dn);
    const order = [...faceDirs.filter((dn) => byDir(dn).length), ...["north", "east", "south", "west"].filter((dn) => !faceDirs.includes(dn))];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let placed = 0;
    for (const dn of order) {
      if (placed >= wantFaces) break;
      const cands = byDir(dn).filter((f) => can(f.n[0], Y + 4, f.n[1]));
      if (!cands.length) continue;
      const f = cands[Math.floor(rnd() * cands.length)];
      put(f.n[0], Y + 4, f.n[1], wallBanner(f.d, BANNERS.watch));
      placed++; stats.banners++;
    }
    // branch-arm lamps: a log sideways out of the trunk at +4, 1-2 long, a lantern hanging under its tip, a small leaf bough round the tip
    let arms = 0;
    const wantArms = o.arms?.[o.levels.indexOf(lv)] ?? (o.central ? 2 : lv === o.levels[0] ? Math.max(0, Math.min(2, 6 - used - (homeInfo ? 1 : 0))) : 1); // the arms fill the lamp budget of 6 (posts, arms, the pavilion's lantern)
    const armFaces = faces.filter((f) => !faceDirs.includes(nameOfVec(f.d)) || rnd() < 0.5);
    for (let i = armFaces.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [armFaces[i], armFaces[j]] = [armFaces[j], armFaces[i]]; }
    for (const f of armFaces) {
      if (arms >= wantArms) break;
      const [x1, z1] = f.n, x2 = x1 + f.d[0], z2 = z1 + f.d[1], p = [-f.d[1], f.d[0]];
      if (!(can(x1, Y + 4, z1) && can(x2, Y + 4, z2) && can(x2, Y + 3, z2))) continue;
      put(x1, Y + 4, z1, logAlong(f.d)); put(x2, Y + 4, z2, logAlong(f.d));
      put(x2, Y + 3, z2, lantern(true, o.central)); stats.lamps++; stats.arms++; arms++;
      const leaf = (x, yy, z) => { if (can(x, yy, z) || at(x, yy, z)?.name === B.leaves) blocks.set(key(x, yy, z), LEAF()); };
      for (const [x, z] of [[x1, z1], [x2, z2]]) { leaf(x, Y + 5, z); for (const s of [-1, 1]) leaf(x + p[0] * s, Y + 4, z + p[1] * s); }
      leaf(x2 + f.d[0], Y + 4, z2 + f.d[1]); leaf(x2 + f.d[0], Y + 5, z2 + f.d[1]);
    }
    trunkGarden(blocks, keep, lv, o, rnd, stats, cushion);
    gardenIslands(blocks, keep, lv, o, rnd, stats);
  }
  // 5. rim dressing and under-deck moss and berries per level
  for (const lv of o.levels) { rimDressing(blocks, keep, lv, o, rnd, stats, homeInfo, cushion, flagsLeft); underDeck(blocks, lv.y, o, rnd, stats); }
  repairPockets(blocks, before, o.levels.map((l) => l.y), stats);
  if (home) sealNooks(blocks, keep, home, rnd, stats);
  for (const k of shell) keep.delete(k);
  relinkFences(blocks);
  return { home, homeInfo, site, connLamps, stats, cushions };
}

// ---- the trunk foot: in two or three of the four diagonal corners round the heartwood ring a small scene (7.10 "trunk": lived in, never empty) -------------------
// an L of moss planters with plants framed by open trapdoors, or a seat of two cushions with a jar
function trunkGarden(blocks, keep, lv, o, rnd, stats, cushion) {
  const Y = lv.y, R = lv.ring, { put, can } = deco(blocks, keep), soft = softWriter(blocks);
  if (!R) return;
  const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let i = corners.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [corners[i], corners[j]] = [corners[j], corners[i]]; }
  const n = 2 + (rnd() < 0.5 ? 1 : 0);
  let done = 0;
  for (const [sx, sz] of corners) {
    if (done >= n) break;
    const ok = (x, z, h = 1) => deckAt(blocks, x, Y, z) && !railAt(blocks, x, Y, z) && can(x, Y + h, z);
    const base = [[sx * R, sz * R], [sx * (R + 1), sz * R], [sx * R, sz * (R + 1)]].filter(([x, z]) => ok(x, z) && ok(x, z, 2)); // the corner cell and the two beside it that exist (a notched deck has fewer)
    if (!base.length || base[0][0] !== sx * R || base[0][1] !== sz * R) continue;
    if (rnd() < 0.6) { // planter L
      for (const [x, z] of base) {
        put(x, Y + 1, z, mossBlock());
        const pl = pickPlant(rnd);
        put(x, Y + 2, z, plantBlock(pl));
      }
      for (const [x, z] of base) for (const d of D4) { // trapdoors round the free sides
        const tx = x + d[0], tz = z + d[1];
        if (base.some(([bx, bz]) => bx === tx && bz === tz) || Math.max(Math.abs(tx), Math.abs(tz)) < R) continue; // not toward the trunk: the ring side stays open
        if (ok(tx, tz)) put(tx, Y + 1, tz, trapOpen(d));
      }
    } else if (base.length > 1) { // a seat: two native cushions facing the trunk's corner, a firefly jar beside them
      for (const q of base.slice(1)) cushion(q[0], Y, q[1]);
      const jx = sx * (R + 2), jz = sz * (R + 2); // behind the cushions (the seat looks at the trunk): the view stays open
      if (ok(jx, jz) && ok(jx, jz, 2)) put(jx, Y + 1, jz, jar());
    }
    done++; stats.rim++;
  }
}

// ---- garden islands: a 2 x 2 moss bed with flowers and a fern, framed by open trapdoors, out in the open quarters of a deck ---------
function gardenIslands(blocks, keep, lv, o, rnd, stats) {
  const Y = lv.y, { put, can } = deco(blocks, keep);
  const free = (x, z, h) => blocks.get(key(x, Y, z))?.name === PLANKS && !railAt(blocks, x, Y, z) && can(x, Y + h, z);
  const cands = [];
  const GR = o.gardenR ?? 8;
  for (let x = -GR - 1; x <= GR + 1; x++) for (let z = -GR - 1; z <= GR + 1; z++) {
    if (Math.min(Math.abs(x), Math.abs(z)) < (lv.ring ?? 3) || Math.max(Math.abs(x), Math.abs(z)) > GR) continue; // in a quarter, not on an axis path
    const cells = [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]];
    if (!cells.every(([a, b]) => free(a, b, 1) && free(a, b, 2))) continue;
    const frame = []; for (let a = x - 1; a <= x + 2; a++) for (let b = z - 1; b <= z + 2; b++) if (!cells.some(([c, d]) => c === a && d === b) && (a === x - 1 || a === x + 2 || b === z - 1 || b === z + 2) && !((a === x - 1 || a === x + 2) && (b === z - 1 || b === z + 2))) frame.push([a, b]);
    if (frame.some(([a, b]) => railAt(blocks, a, Y, b) || !deckAt(blocks, a, Y, b))) continue; // room all round
    cands.push({ cells, frame, at: [x, z] });
  }
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  const done = [];
  for (const c of cands) {
    if (done.length >= (o.islands?.[o.levels.indexOf(lv)] ?? (lv === o.levels[0] ? 2 : 1))) break;
    if (done.some((d) => Math.hypot(d.at[0] - c.at[0], d.at[1] - c.at[1]) < 6)) continue;
    if (!c.cells.every(([a, b]) => free(a, b, 1) && free(a, b, 2))) continue;
    const sap = Math.floor(rnd() * 4);
    c.cells.forEach(([a, b], i) => {
      put(a, Y + 1, b, mossBlock());
      const pl = pickPlant(rnd);
      put(a, Y + 2, b, i === sap ? { name: `${M}fern`, states: {} } : plantBlock(pl)); // (no sapling: a Mallorn could grow on the deck)
    });
    for (const [a, b] of c.frame) {
      const d = a < c.at[0] ? [-1, 0] : a > c.at[0] + 1 ? [1, 0] : b < c.at[1] ? [0, -1] : [0, 1];
      if (can(a, Y + 1, b)) put(a, Y + 1, b, trapOpen(d));
    }
    done.push(c); stats.rim++;
  }
}

// Keeps one bridge start per rim run clear, before the garden and rim dressing: the middle cell of every run where the runtime planner could start a bridge (sideTarget), with the two rows behind it
function reserveRuns(blocks, keep, Y) {
    const nameAt = (x, yy, z) => blocks.get(key(x, yy, z))?.name ?? "minecraft:air", runs = new Map();
    for (const [k, v] of blocks) {
      if (v.name !== RAIL) continue;
      const [x, yy, z] = k.split(",").map(Number);
      if (yy !== Y + 1) continue;
      for (const d of D4) {
        if (!sideTarget(nameAt, x, Y, z, d)) continue;
        const a = [d[1], -d[0]], line = `${d}|${d[0] * x + d[1] * z}`;
        (runs.get(line) ?? runs.set(line, { d, a, cells: [] }).get(line)).cells.push([a[0] * x + a[1] * z, x, z]);
      }
    }
    for (const r of runs.values()) {
      const cs = r.cells.sort((p, q) => p[0] - q[0]);
      let start = 0;
      for (let i = 1; i <= cs.length; i++) {
        if (i < cs.length && cs[i][0] === cs[i - 1][0] + 1) continue;
        const [, mx, mz] = cs[start + Math.floor((i - start - 1) / 2)];
        for (let kk = 1; kk <= 2; kk++) for (let o = -1; o <= 1; o++) for (let h = 1; h <= 2; h++) keep.add(key(mx + r.d[0] * kk + r.a[0] * o, Y + h, mz + r.d[1] * kk + r.a[1] * o));
        start = i;
      }
    }
}

// ---- rim dressing (7.10): every 5-7 rail posts away from connectors one small thing ---------------------------------------------------------
function rimDressing(blocks, keep, lv, o, rnd, stats, homeInfo, cushion, flagsLeft) {
  const Y = lv.y, { put, can } = deco(blocks, keep), soft = softWriter(blocks);
  const at = (x, yy, z) => blocks.get(key(x, yy, z));
  const rim = [];
  for (const [k, v] of blocks) {
    if (v.name !== RAIL) continue;
    const [x, yy, z] = k.split(",").map(Number);
    if (yy !== Y + 1 || !deckAt(blocks, x, Y, z)) continue;
    if (o.conns.some((c) => c.y === Y && Math.max(Math.abs(x - c.x), Math.abs(z - c.z)) <= 3)) continue;
    rim.push({ x, z, a: Math.atan2(z, x) });
  }
  rim.sort((p, q) => p.a - q.a);
  if (!rim.length) return;
  const cx = (rnd() * rim.length) | 0;
  const inward = (r) => { // the open deck neighbour of a rim post nearest the trunk axis
    let best = null;
    for (const d of D4) {
      const nx = r.x + d[0], nz = r.z + d[1];
      if (!deckAt(blocks, nx, Y, nz) || railAt(blocks, nx, Y, nz)) continue;
      const dist = Math.hypot(nx, nz);
      if (!best || dist < best.dist) best = { d, nx, nz, dist };
    }
    return best;
  };
  // corners first (a small scene each, up to 3: the deck's convex corners and dead ends are never empty), then one small thing every 4-6 rail posts
  const railSet = new Set(rim.map((r) => `${r.x},${r.z}`));
  const isCorner = (r) => { const ax = railSet.has(`${r.x + 1},${r.z}`) || railSet.has(`${r.x - 1},${r.z}`), az = railSet.has(`${r.x},${r.z + 1}`) || railSet.has(`${r.x},${r.z - 1}`); return ax && az && D4.filter(([a, c]) => railSet.has(`${r.x + a},${r.z + c}`)).length === 2; };
  const kinds = ["pot", "planter", "candles", "seat", "pot", "flag", "planter", "jar"];
  let ki = Math.floor(rnd() * kinds.length), step = 0;
  const near = []; // cells taken by a scene: the next one keeps 3 away
  const free3 = (r) => near.every((q) => Math.max(Math.abs(q.x - r.x), Math.abs(q.z - r.z)) >= 3);
  const tryPlace = (r, order) => {
    if (!free3(r)) return false;
    for (const kind of order) if (placeRim(kind, r)) { near.push(r); stats.rim++; return true; }
    return false;
  };
  const corners = rim.filter(isCorner);
  for (let i = corners.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [corners[i], corners[j]] = [corners[j], corners[i]]; }
  let scenes = 0;
  for (const r of corners) { if (scenes >= 3) break; if (tryPlace(r, rnd() < 0.5 ? ["seat", "planter"] : ["planter", "seat"])) scenes++; } // (never a flag on a corner post)
  for (let i = 0; i < rim.length; i += (o.rimStep ?? 4) + Math.floor(rnd() * 3)) {
    const r = rim[(i + cx) % rim.length];
    if (step++ > (o.rimMax ?? 18)) break;
    tryPlace(r, kinds.map((_, a) => kinds[(ki + a) % kinds.length]));
    ki = (ki + 1) % kinds.length;
  }
  function placeRim(kind, r) {
    if (kind === "pot") {
      if (!can(r.x, Y + 2, r.z)) return false;
      put(r.x, Y + 2, r.z, flowerPot(potPlant(rnd)));
      return true;
    }
    const n = inward(r);
    if (kind === "flag") { // a standing banner on a 2-high fence post (the rail post and one more fence), the cloth facing the deck; one per tree
      const straight = (railSet.has(`${r.x + 1},${r.z}`) && railSet.has(`${r.x - 1},${r.z}`)) || (railSet.has(`${r.x},${r.z + 1}`) && railSet.has(`${r.x},${r.z - 1}`));
      if (flagsLeft.n <= 0 || !n || !straight || isCorner(r) || !can(r.x, Y + 2, r.z) || !can(r.x, Y + 3, r.z) || !isAirName(at(r.x, Y + 4, r.z)?.name) || !isAirName(at(r.x, Y + 5, r.z)?.name)) return false; // a straight run, and no ceiling within 2 over the banner
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let h = 2; h <= 5; h++) if ((dx || dz) && at(r.x + dx, Y + h, r.z + dz)?.name === RAIL) return false; // no other raised rail near (stair rails would need step posts)
      put(r.x, Y + 2, r.z, fence());
      put(r.x, Y + 3, r.z, standingBanner(n.d, minorBanner(rnd)));
      flagsLeft.n--; stats.banners++;
      return true;
    }
    if (!n || !can(n.nx, Y + 1, n.nz)) return false;
    if (kind === "jar") { put(n.nx, Y + 1, n.nz, jar()); return true; }
    if (kind === "candles") {
      put(n.nx, Y + 1, n.nz, candle(2 + Math.floor(rnd() * 2)));
      const px = n.nx + (n.d[0] === 0 ? 1 : 0), pz = n.nz + (n.d[1] === 0 ? 1 : 0);
      if (can(px, Y + 1, pz) && deckAt(blocks, px, Y, pz) && !railAt(blocks, px, Y, pz)) put(px, Y + 1, pz, decoratedPot());
      return true;
    }
    if (kind === "seat") { // two native cushions side by side, a jar on the rim post beside them (no stairs: the engine links fences to stairs)
      const sx = n.d[0] === 0 ? 1 : 0, sz = n.d[1] === 0 ? 1 : 0, bx = n.nx + sx, bz = n.nz + sz;
      if (!can(bx, Y + 1, bz) || !can(bx, Y + 2, bz) || !can(n.nx, Y + 2, n.nz) || !deckAt(blocks, bx, Y, bz) || railAt(blocks, bx, Y, bz)) return false;
      cushion(n.nx, Y, n.nz); cushion(bx, Y, bz);
      const jx = r.x - sx, jz = r.z - sz; // the jar stands on the rail post one cell to the side of the seat: never in front of a cushion, the view stays open
      if (at(jx, Y + 1, jz)?.name === RAIL && can(jx, Y + 2, jz)) put(jx, Y + 2, jz, jar());
      return true;
    }
    if (kind === "planter") { // moss block with the plant on top, open trapdoors on its free sides
      const cells = [[n.nx, n.nz]];
      const sx = n.d[0] === 0 ? 1 : 0, sz = n.d[1] === 0 ? 1 : 0, bx = n.nx + sx, bz = n.nz + sz;
      if (can(bx, Y + 1, bz) && deckAt(blocks, bx, Y, bz) && !railAt(blocks, bx, Y, bz) && rnd() < 0.7) cells.push([bx, bz]);
      const own = new Set(cells.map((c) => c.join(",")));
      for (const [x, z] of cells) {
        if (!can(x, Y + 2, z)) return false;
      }
      for (const [x, z] of cells) {
        put(x, Y + 1, z, mossBlock());
        const plantsOn = pickPlant(rnd);
        put(x, Y + 2, z, plantsOn.name === `${L}golden_fern` || rnd() < 0.8 ? plantBlock(plantsOn) : { name: `${M}fern`, states: {} });
        for (const d of D4) {
          const tx = x + d[0], tz = z + d[1];
          if (own.has(`${tx},${tz}`) || railAt(blocks, tx, Y, tz) || at(tx, Y + 1, tz)?.name === RAIL) continue;
          if (can(tx, Y + 1, tz) && deckAt(blocks, tx, Y, tz)) put(tx, Y + 1, tz, trapOpen(d));
        }
      }
      return true;
    }
    return false;
  }
}

// ---- under the deck: moss and glow berries (7.7) -----------------------------------------------------------------------------------------
function underDeck(blocks, Y, o, rnd, stats) {
  const at = (x, yy, z) => blocks.get(key(x, yy, z));
  const isAirOrNone = (x, yy, z) => isAirName(at(x, yy, z)?.name);
  for (const [k, v] of [...blocks]) {
    if (!isDeckName(v.name)) continue;
    const [x, yy, z] = k.split(",").map(Number);
    if (yy !== Y) continue;
    if (Math.max(Math.abs(x), Math.abs(z)) <= o.trunkR + 1) continue;
    if (rnd() > 1 / 11) continue;
    const berry = rnd() < 0.35, len = 2 + Math.floor(rnd() * 3);
    let ok = true;
    for (let i = 1; i <= len + 1 && ok; i++) ok = isAirOrNone(x, Y - i, z);
    if (!ok) continue;
    for (let i = 1; i <= len; i++) blocks.set(key(x, Y - i, z), berry ? berries(i === len) : moss(i === len));
    stats.moss++;
  }
}

// ---- bridge dressing (7.4): drifts in the rail corners, pots beside the ends, gate arch on bridges >= 11, moss and berries under the belly -------------
// blocks: the bridge in its own frame (deck layer y 0, z 0 .. length - 1, x 0 .. 4), keep = its walk strip cells (the gate removes its own from keep)
export function dressBridge(blocks, keep, length, seed) {
  const rnd = makeRandom((seed ^ 0x91d3) >>> 0), soft = softWriter(blocks), { put, can } = deco(blocks, keep);
  const at = (x, yy, z) => blocks.get(key(x, yy, z));
  const deckTop = (x, z) => { for (let y = 8; y >= -2; y--) { const n = at(x, y, z)?.name; if (n === PLANKS || n === SLAB) return y; } return null; };
  const railY = (x, z) => { for (let y = 8; y >= -2; y--) if (at(x, y, z)?.name === RAIL) return y; return null; };
  const stats = { gate: false, moss: 0, drifts: 0 };
  // mid-span lamp posts (length >= 9): the two rail posts at mid-span rise to a 2-high fence post (the rail and one more fence) with a lantern standing on top (gold from 11, one silver
  // post on a bridge of 9), deck + 3 at most (the top of the combo box); nothing hangs over the walk lanes and nothing spans them. A pot never stands alone on a bridge: the one
  // pot of the span sits on the rail post next to a lamp post. (The bridgehead lamp posts, with their pot, belong to the tree decks at both ends.)
  if (length >= 9) {
    const mid = (length - 1) >> 1, y = railY(0, mid);
    if (y !== null && railY(4, mid) === y) {
      const xs = [0, 4]; // both rails: every lamp post has its twin on the other rail
      for (const x of xs) { blocks.set(key(x, y + 1, mid), fence()); blocks.set(key(x, y + 2, mid), lantern(false, length >= 11)); }
      const px = rnd() < 0.5 ? 0 : 4, pz = mid + (rnd() < 0.5 ? -1 : 1);
      if (railY(px, pz) === y && can(px, y + 1, pz)) put(px, y + 1, pz, flowerPot(potPlant(rnd)));
      stats.gate = true;
    }
  }
  // moss and glow berries under the arch belly, every 3-4 rows, not on the shortest bridges
  if (length >= 9) {
    let z = 2 + Math.floor(rnd() * 2), flip = rnd() < 0.5;
    for (; z < length - 2; z += 3 + Math.floor(rnd() * 2)) {
      const x = flip ? 1 : 3; flip = !flip;
      let low = null; for (let yy = -2; yy <= 8; yy++) if (isDeckName(at(x, yy, z)?.name) || at(x, yy, z)?.name === SLAB) { low = yy; break; }
      if (low === null) continue;
      const len = 2 + Math.floor(rnd() * 3), berry = rnd() < 0.4;
      let ok = true; for (let i = 1; i <= len + 1; i++) if (!isAirName(at(x, low - i, z)?.name)) ok = false;
      if (!ok) continue;
      for (let i = 1; i <= len; i++) blocks.set(key(x, low - i, z), berry ? berries(i === len) : moss(i === len));
      stats.moss++;
    }
  }
  relinkFences(blocks);
  return stats;
}

// ---- balcony (7.5, "seat of song") and lookout (the warden's flet): both boxes stop at +3 over the deck ------------------------------------------
// Both end pieces carry loop markers on the centres of their free rim sides (tests/run.mjs: every marker sits on a recognised exit), so the
// 5-run of rail, the two plain rows behind it and the air over their middle three columns stay free: everything stands beside them.
// balcony frame: deck y 0, rows z 0..6 (z 0 = the connector row, z 6 the far rim), x -3..3 (the far rows are 5 wide). keep = the connector corridor.
export function dressBalcony(blocks, keep, seed) {
  const rnd = makeRandom((seed ^ 0xba1c) >>> 0), { put, can } = deco(blocks, keep), soft = softWriter(blocks);
  const stats = { lamps: 0, cushions: [] };
  const rail = (x, y, z) => blocks.get(key(x, y, z))?.name === RAIL;
  const side = rnd() < 0.5 ? -1 : 1; // the seat side
  // keep the far exit clear: rows 4, 5 over x -1..1 (and the rim row itself above the rail)
  for (let z = 4; z <= 5; z++) for (let x = -1; x <= 1; x++) for (let h = 1; h <= 2; h++) keep.add(key(x, h, z));
  // lamp posts on the two rail posts beside the connector row
  for (const x of [-2, 2]) if (rail(x, 1, 0) && can(x, 2, 0) && can(x, 3, 0)) { put(x, 2, 0, fence()); put(x, 3, 0, lantern(false)); stats.lamps++; }
  // the seat of song: two cushions at the side (x = 2 * side, rows 3 and 4) facing outward to the rim, an arbour of two posts with a roof of top slabs at +3 over two cushions
  const sx = 2 * side, out = [side, 0];
  for (const [z, v] of [[3, 15], [4, 12]]) if (can(sx, 1, z)) { stats.cushions.push({ x: sx, y: 0, z, variant: v }); for (const h of [1, 2]) keep.add(key(sx, h, z)); } // two native cushions under the arbour
  for (const z of [2, 5]) for (const h of [1, 2, 3]) if (can(sx, h, z) || blocks.get(key(sx, h, z))?.name === RAIL) blocks.set(key(sx, h, z), fence()); // the two posts rise to +3 (owner 2026-10-16: poles up, slabs between them); z 2, not 1: a post top at +3 beside the bridgehead lantern (z 0) would link to it
  for (const z of [3, 4]) if (can(sx, 3, z)) put(sx, 3, z, slab("top")); // the roof: two upper (top-half) slabs between the post tops, not a fence bar
  if (can(sx, 2, 4) && rnd() < 0.7) put(sx, 2, 4, moss(true)); // a beard of moss from the beam (nothing hangs lower than deck + 3 over a walk cell)
  // the other side: a jar and a planter, leaf drifts
  if (can(-sx, 1, 2)) put(-sx, 1, 2, jar());
  if (can(-sx, 1, 3) && can(-sx, 2, 3)) { put(-sx, 1, 3, mossBlock()); put(-sx, 2, 3, { name: `${L}elanor`, states: { [`${L}on_grass`]: true } }); }
  relinkFences(blocks);
  return stats;
}

// lookout: deck at absolute y (FLOOR_H), x -4..4, z -4..4 (connector north at z -4), plus-shaped pillar below. keep = the connector corridor.
export function dressLookout(blocks, keep, y, seed) {
  const rnd = makeRandom((seed ^ 0x100c) >>> 0), { put, can } = deco(blocks, keep), soft = softWriter(blocks);
  const stats = { lamps: 0, cushions: [] };
  const rail = (x, z) => blocks.get(key(x, y + 1, z))?.name === RAIL;
  // the three free rim sides keep their exit: 5-run of rail, rows 2 and 3 behind it, the middle three columns clear at +1, +2
  for (const [d, a] of [[[0, 1], [1, 0]], [[1, 0], [0, 1]], [[-1, 0], [0, 1]]]) for (let k = 1; k <= 2; k++) for (let o = -1; o <= 1; o++) for (let h = 1; h <= 2; h++) keep.add(key(d[0] * (4 - k) + a[0] * o, y + h, d[1] * (4 - k) + a[1] * o));
  for (const x of [-2, 2]) if (rail(x, -4) && can(x, y + 2, -4) && can(x, y + 3, -4)) { put(x, y + 2, -4, fence()); put(x, y + 3, -4, lantern(false)); stats.lamps++; }
  // the warden's flag: a 3-high pole at a corner of the far rim with a banner on its side, a jar, a moss planter behind trapdoors, drifts
  const bx = rnd() < 0.5 ? -1 : 1, spec = minorBanner(rnd);
  // the flag pole stands on the deck beside the connector corridor, one stripped log from the deck up (the rim rails of the three exits must stay fences)
  const pxp = 3 * bx, pzp = -2;
  if ([1, 2, 3].every((h) => can(pxp, y + h, pzp)) && can(2 * bx, y + 3, pzp) && blocks.get(key(pxp, y, pzp))?.name === PLANKS) {
    for (const h of [1, 2, 3]) put(pxp, y + h, pzp, stripped());
    put(2 * bx, y + 3, pzp, wallBanner([-bx, 0], spec)); // hangs on the pole's inner side
  }
  if (can(-2 * bx, y + 1, 3) && !rail(-2 * bx, 3)) put(-2 * bx, y + 1, 3, jar());
  const px = -3 * bx, pz = -2; // a moss planter on the other side of the corridor
  if (can(px, y + 1, pz) && can(px, y + 2, pz) && blocks.get(key(px, y, pz))?.name === PLANKS && !rail(px, pz)) {
    put(px, y + 1, pz, mossBlock()); put(px, y + 2, pz, { name: `${L}niphredil`, states: { [`${L}on_grass`]: true } });
    for (const [dx, dz] of [[bx, 0], [0, 1], [0, -1]]) if (can(px + dx, y + 1, pz + dz) && blocks.get(key(px + dx, y, pz + dz))?.name === PLANKS && !rail(px + dx, pz + dz)) put(px + dx, y + 1, pz + dz, trapOpen([dx, dz]));
  }
  for (const [cx, cz, v] of [[2 * bx, 2, 15], [3 * bx, 1, 12]]) if (can(cx, y + 1, cz) && !rail(cx, cz) && blocks.get(key(cx, y, cz))?.name === PLANKS) { stats.cushions.push({ x: cx, y, z: cz, variant: v }); for (const h of [1, 2]) keep.add(key(cx, y + h, cz)); } // two native cushions
  underDeck(blocks, y, { trunkR: 1 }, rnd, stats);
  relinkFences(blocks);
  return stats;
}

// Fence links: a fence placed beside another fence at the same height links to it, both ways (the engine would do it when placing; a structure keeps what is stored)
export function relinkFences(blocks) {
  for (const [k, b] of [...blocks]) {
    if (b.name !== RAIL) continue;
    const [x, y, z] = k.split(",").map(Number);
    let states = null; // copy on write: a block object may be shared with another map (the combos rotate a tree by 0 quarter turns without copying)
    for (const [side, v] of Object.entries(DIRV)) if (/^lothlorien:mallorn_(stripped_)?log$|^lothlorien:mallorn_(stripped_)?wood$/.test(blocks.get(key(x + v[0], y, z + v[1]))?.name ?? "") && blocks.get(key(x + v[0], y - 1, z + v[1]))?.name?.match(/planks$|slab$/) && !b.states[`minecraft:connection_${side}`]) (states ??= { ...b.states })[`minecraft:connection_${side}`] = true; // toward a log post standing on the deck (the rail line goes on through it)
    for (const [side, v] of Object.entries(DIRV)) if (blocks.get(key(x + v[0], y, z + v[1]))?.name === RAIL && !b.states[`minecraft:connection_${side}`]) (states ??= { ...b.states })[`minecraft:connection_${side}`] = true;
    if (states) blocks.set(k, { ...b, states });
  }
}

// small block constructors the central tree builder (village_central.mjs) shares with this module
export { standingBanner, minorBanner, berries, stairs, stripped, logAlong, wallBanner, fence, slab, candle, trapOpen, jar, flowerPot, carpet, moss, mossBlock, decoratedPot, plank, PLANTS, nameOfVec, DIRV, FACING_ID };
