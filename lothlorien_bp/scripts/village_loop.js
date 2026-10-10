// Loop plan builders for the Elven village (round 4, P7; the per-marker closer was replaced by the village planner on 2026-10-09). Pure JS (no fs,
// no Node or Bedrock imports): scripts/village_planner.js chooses the links, scripts/loop_marker.js loads the village and writes them, tools/village_sim.mjs
// runs the very same functions on the simulated village, tests/run.mjs checks them with fixtures.
//
// A jigsaw village is a tree, so exits that found no room end in a `railing_end` piece (5 planks + 5 fences, carrying one invisible
// `lothlorien:loop_marker`). The planner joins two such exits that face each other on the same deck height with an arched slab bridge
// (scripts/village_bridge.js), and also uses the plaza, L-join and side joins below.
//
// P7b: an exit may also join the SIDE of any platform (node / tower deck at either level, central deck, braced balcony, lookout): a straight
// run of 5 rail cells perpendicular to the bridge, deck under them, and two rows of open deck behind (see sideTarget).
//
// World reader: at(x, y, z) -> block type id; undefined = not loaded. An "exit" is { x, y, z, dir: [dx, dz] }: x, z, y = the centre
// deck cell of the railing row, dir = the way out (away from the platform the railing closes).
import { bridgeShape } from "./village_bridge.js";

export const MARKER_ID = "lothlorien:loop_marker";
export const PLANKS = "lothlorien:mallorn_planks", SLAB = "lothlorien:mallorn_slab", FENCE = "lothlorien:mallorn_fence", LANTERN = "lothlorien:elven_lantern";
// minDist/maxDist: blocks between the two railing rows' centres (bridge length = dist + 1, i.e. 5..16 free cells between the rows);
// maxOffset: sideways shift (also <= length - 3, the most bridgeShape supports: one block sideways per block forward).
// Longer spans (maxDist < dist <= maxSpan) are two bridges with a supported 5 x 5 landing in the middle (planSpan): the landing stands on a
// log pier down to the ground (planPier, at most pierMaxDepth blocks, through water to the bottom); maxSpanOffset = sideways shift of the whole span.
// Round 2 (owner 2026-10-09): minDist 6 -> 2 with a flat deck for length <= flatMax (F2), maxOffset 5 -> 8 (F3), sideSearch = how far along a rim a
// side marker looks for its 5-run (F1), clutterMargin = no foreign deck within that many cells of a NEW kind of join. legacyMinDist / legacyMaxOffset
// are the old limits: a join inside them is the old kind (no clutter test). LOOP.corner = F5 L-join limits (legs of `minLeg`..maxDist blocks).
export const LOOP = { minDist: 2, maxDist: 17, maxSpan: 30, maxOffset: 8, maxSpanOffset: 8, landing: 5, pierMaxDepth: 48, lightTarget: 8, lanternLight: 14,
  flatMax: 5, sideSearch: 6, sideStarts: 8, clutterMargin: 2, legacyMinDist: 6, legacyMaxOffset: 5, minLeg: 3 };
// F4 plaza: filled deck over the bounding rectangle of two facing exits that no bridge can join (dist 1..maxDist, |lat| <= maxLat), fill cells at most
// `cantilever` (Chebyshev) from an existing deck cell, a log pier under the patch when a fill cell is more than `needPier` from the old deck.
export const PLAZA = { maxDist: 6, maxLat: 8, cantilever: 4, needPier: 2 };
export const LOG = "lothlorien:mallorn_log";

const AIRS = ["minecraft:air", "minecraft:cave_air", "minecraft:void_air"];
const isAir = (n) => AIRS.includes(n);
const isLeaves = (n) => typeof n === "string" && n.endsWith("_leaves");
const SIDE_OF = (v) => (v[1] < 0 ? "north" : v[1] > 0 ? "south" : v[0] < 0 ? "west" : "east");

// The railing_end signature around the centre deck cell (x, y, z): a row of exactly 5 planks with a fence on each, the open side without
// deck, and on the other side the platform's connector row (deck under a 3-wide air walk, fences at +-2).
export function exitAt(at, x, y, z) {
  if (at(x, y, z) !== PLANKS || at(x, y + 1, z) !== FENCE) return null;
  for (const a of [[1, 0], [0, 1]]) {
    let row = true;
    for (let o = -2; o <= 2 && row; o++) if (at(x + a[0] * o, y, z + a[1] * o) !== PLANKS || at(x + a[0] * o, y + 1, z + a[1] * o) !== FENCE) row = false;
    if (!row) continue;
    if ([-3, 3].some((o) => at(x + a[0] * o, y, z + a[1] * o) === PLANKS || at(x + a[0] * o, y + 1, z + a[1] * o) === FENCE)) continue; // railing_end is exactly 5 wide: a longer fence run is a platform rim
    for (const s of [[a[1], a[0]], [-a[1], -a[0]]]) { // s = towards the platform
      const px = x + s[0], pz = z + s[1];
      let ok = true;
      for (let o = -2; o <= 2 && ok; o++) {
        const bx = px + a[0] * o, bz = pz + a[1] * o;
        if (at(bx, y, bz) !== PLANKS) ok = false;
        else if (Math.abs(o) === 2) ok = at(bx, y + 1, bz) === FENCE;
        else ok = isAir(at(bx, y + 1, bz)) && isAir(at(bx, y + 2, bz));
      }
      const out = at(x - s[0], y, z - s[1]);
      if (ok && out !== PLANKS && out !== SLAB) return { x, y, z, dir: [-s[0], -s[1]] };
    }
  }
  return null;
}

// Reach of a span of `dist` blocks: sideways shift allowed (a direct bridge: <= length - 3; a span with a landing: maxSpanOffset)
export const reach = (dist) => (dist > LOOP.maxDist ? LOOP.maxSpanOffset : Math.min(LOOP.maxOffset, dist + 1 - 3));
// Every cell ahead of A within reach that `accept(x, z)` takes, nearest first (a sideways shift counts 3). offset is the shift along
// ex = (dir.z, -dir.x), the "east" of a bridge drawn by bridgeShape heading south. -> [{ x, z, dist, length, offset, score }]
export function scanAhead(A, accept) {
  const d = A.dir, ex = [d[1], -d[0]], out = [];
  for (let dist = LOOP.minDist; dist <= LOOP.maxSpan; dist++) {
    const maxOff = reach(dist);
    for (let lat = -maxOff; lat <= maxOff; lat++) {
      const x = A.x + d[0] * dist + ex[0] * lat, z = A.z + d[1] * dist + ex[1] * lat;
      if (accept(x, z)) out.push({ x, z, dist, length: dist + 1, offset: lat, score: dist + 3 * Math.abs(lat) });
    }
  }
  return out.sort((a, b) => a.score - b.score || a.dist - b.dist);
}

// ---- the bridge in world coordinates ---------------------------------------------------------------------------------------------
// Local frame of bridgeShape: z runs from A (z = 0) to B (z = length - 1) along A's dir, local x (east) is ex = (dir.z, -dir.x).
// Rows 0 and length - 1 are the two railing rows themselves.
export function planBridge(A, B, length, offset, side = false, sideA = false) {
  const shape = bridgeShape(length, offset, length <= LOOP.flatMax ? 0 : length <= 7 ? 1 : 2); // short joins are flat decks (no arch)
  const d = A.dir, ex = [d[1], -d[0]], c0 = shape.connectors[0].x;
  const w = (lx, ly, lz) => ({ x: A.x + ex[0] * (lx - c0) + d[0] * lz, y: A.y + ly, z: A.z + ex[1] * (lx - c0) + d[1] * lz });
  const vec = { north: [-d[0], -d[1]], south: [d[0], d[1]], west: [-ex[0], -ex[1]], east: [ex[0], ex[1]] };
  // side target: the far end row is the platform's own rim row; its edge posts keep their place (no air above them: a lantern may sit there)
  const endC = shape.connectors[1].x;
  const isEdge = (c) => c.z === length - 1 && (Math.abs(c.x - endC) === 2);
  // sideA: the near end row is a platform rim too (side-to-side bridge): same treatment mirrored at row 0
  const startC = shape.connectors[0].x, isEdgeA = (c) => c.z === 0 && Math.abs(c.x - startC) === 2;
  const cells = shape.cells.filter((c) => !(side && isEdge(c) && c.kind === "air") && !(sideA && isEdgeA(c) && c.kind === "air")).map((c) => ({ ...w(c.x, c.y, c.z), kind: c.kind, row: c.z }));
  const rails = shape.rails.map((r) => {
    const states = { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false };
    for (const s of r.sides) if (!(side && r.z === length - 1 && s === "south") && !(sideA && r.z === 0 && s === "north")) states[`minecraft:connection_${SIDE_OF(vec[s])}`] = true; // side: no link into the platform interior
    return { ...w(r.x, r.y, r.z), states, row: r.z };
  });
  const lanterns = planLanterns(shape).map(([x, y, z]) => ({ ...w(x, y, z), row: z }));
  const end = w(shape.connectors[1].x, 0, length - 1);
  if (end.x !== B.x || end.z !== B.z || end.y !== B.y) throw new Error(`planBridge: far end ${end.x},${end.z} is not the partner ${B.x},${B.z}`);
  return { A, B, length, offset, shape, cells, rails, lanterns, side };
}

// A span of `dist` blocks (A -> B, B laterally `lat` off): one arched bridge when dist <= maxDist, otherwise two bridges with a supported
// 5 x 5 landing between them (deck, rim rail, two lanterns; the openings are the bridges' own end rows). Same plan format as planBridge;
// `landing` = { x, y, z (centre deck cell), dir, d1, d2 } and the pier (plan.pier, see planPier) is added by decide().
export function planSpan(A, B, dist, lat, side = false, sideA = false) {
  if (dist <= LOOP.maxDist) return planBridge(A, B, dist + 1, lat, side, sideA);
  const d = A.dir, ex = [d[1], -d[0]], N = LOOP.landing, span = N - 1;
  const d1 = Math.floor((dist - span) / 2), d2 = dist - span - d1, l = Math.trunc(lat / 2);
  const cell = (k, o) => ({ x: A.x + d[0] * k + ex[0] * o, y: A.y, z: A.z + d[1] * k + ex[1] * o });
  const p1 = planBridge(A, cell(d1, l), d1 + 1, l, true, sideA);
  const p2 = planBridge({ ...cell(d1 + span, l), dir: d }, B, d2 + 1, lat - l, side);
  const cells = [], rails = new Map(), lanterns = [], h = (N - 1) / 2;
  const ring = new Set(), opening = (k, o) => (k === 0 || k === N - 1) && Math.abs(o) <= 1;
  for (let k = 0; k < N; k++) for (let o = -h; o <= h; o++) {
    const c = cell(d1 + k, l + o);
    cells.push({ ...c, kind: "plank", row: d1 + k });
    if (Math.abs(o) <= 1) for (let up = 1; up <= 3; up++) cells.push({ ...c, y: c.y + up, kind: "air", row: d1 + k });
    if ((k === 0 || k === N - 1 || Math.abs(o) === h) && !opening(k, o)) ring.add(`${k},${o}`);
  }
  const addRail = (r) => {
    const key = `${r.x},${r.y},${r.z}`, cur = rails.get(key);
    if (!cur) rails.set(key, { ...r, states: { ...r.states } });
    else for (const [st, v] of Object.entries(r.states)) if (v) cur.states[st] = true;
  };
  for (const key of ring) {
    const [k, o] = key.split(",").map(Number), c = cell(d1 + k, l + o), states = {};
    for (const s4 of ["north", "south", "west", "east"]) states[`minecraft:connection_${s4}`] = false;
    for (const v of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = k + v[0] * d[0] + v[1] * d[1], no = o + v[0] * ex[0] + v[1] * ex[1];
      if (ring.has(`${nk},${no}`)) states[`minecraft:connection_${SIDE_OF(v)}`] = true;
    }
    addRail({ ...c, y: c.y + 1, states, row: d1 + k });
  }
  for (const o of [-h, h]) lanterns.push({ ...cell(d1 + Math.floor(N / 2), l + o), y: A.y + 2, row: d1 + Math.floor(N / 2) });
  const shift = (r, n) => ({ ...r, row: r.row + n });
  for (const c of p1.cells) cells.push(c);
  for (const r of p1.rails) addRail(r);
  for (const l1 of p1.lanterns) lanterns.push(l1);
  for (const c of p2.cells) cells.push(shift(c, d1 + span));
  for (const r of p2.rails) addRail(shift(r, d1 + span));
  for (const l2 of p2.lanterns) lanterns.push(shift(l2, d1 + span));
  const c0 = cell(d1 + Math.floor(N / 2), l);
  return { A, B, length: dist + 1, offset: lat, shape: null, cells, rails: [...rails.values()], lanterns, side, landing: { x: c0.x, y: c0.y, z: c0.z, dir: d, d1, d2 }, pier: [] };
}

// The landing's pier: a plus of log columns (centre + 4 arms) from under the deck down to the ground, and four braces (a log laid out under
// the deck, two standing up to its rim) like balcony_braced. Columns pass through air, leaves and water (the pier may stand in a lake: logs
// are fine under water, the same as the balcony's pillar) and stop on the first other block; no ground within pierMaxDepth, lava or an unloaded
// column = { error }. -> { blocks: [{ x, y, z, id, states }] } | { error }
const WET = (n) => n === "minecraft:water" || n === "minecraft:flowing_water" || /seagrass|kelp|bubble_column/.test(n ?? "");
export function planPier(at, L) {
  const free = (n) => isAir(n) || isLeaves(n) || WET(n), logAt = (face) => ({ id: LOG, states: { "minecraft:block_face": face } });
  const blocks = [];
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let y = L.y - 1, depth = 0;
    for (; ; y--, depth++) {
      const n = at(L.x + dx, y, L.z + dz);
      if (n === undefined) return { error: "pier column not loaded" };
      if (n === "minecraft:lava" || n === "minecraft:flowing_lava") return { error: "pier over lava" };
      if (!free(n)) break;
      if (depth >= LOOP.pierMaxDepth) return { error: `no ground within ${LOOP.pierMaxDepth} blocks below the landing` };
      blocks.push({ x: L.x + dx, y, z: L.z + dz, ...logAt("up") });
    }
  }
  for (const s of [1, -1]) {
    const brace = [[s * 2, -3, 0, "east"], [s * 2, -2, 0, "up"], [s * 2, -1, 0, "up"], [0, -3, s * 2, "south"], [0, -2, s * 2, "up"], [0, -1, s * 2, "up"]];
    for (const [dx, dy, dz, face] of brace) if (free(at(L.x + dx, L.y + dy, L.z + dz))) blocks.push({ x: L.x + dx, y: L.y + dy, z: L.z + dz, ...logAt(face) });
  }
  return { blocks };
}

// Everything the bridge writes: Map "x,y,z" -> { id, states? }. Later entries win (rails and lanterns replace headroom air).
export function finalBlocks(plan) {
  const out = new Map(), k = (c) => `${c.x},${c.y},${c.z}`;
  const KIND = { plank: { id: PLANKS }, slab_bottom: { id: SLAB, states: { "minecraft:vertical_half": "bottom" } }, slab_top: { id: SLAB, states: { "minecraft:vertical_half": "top" } }, air: { id: "minecraft:air" } };
  for (const c of plan.cells) out.set(k(c), KIND[c.kind]);
  for (const b of plan.pier ?? []) out.set(k(b), { id: b.id, states: b.states });
  for (const r of plan.rails) out.set(k(r), { id: FENCE, states: r.states });
  for (const l of plan.lanterns) out.set(k(l), { id: LANTERN, states: { "minecraft:block_face": "up" } });
  for (const b of plan.blocks ?? []) out.set(k(b), { id: b.id, states: b.states }); // repairs (village_repair.js): free-form blocks
  return out;
}

// Cells of the bridge that cannot be built over: anything but air or leaves (the end rows may hold the railing's own planks and fences).
export function blockedCells(at, plan) {
  if (plan.parts) return [...plan.parts.flatMap((p) => blockedCells(at, p)), ...blockedCells(at, plan.core)]; // L-join: the legs, then the landing (nothing of it exists yet)
  const bad = [], last = plan.length - 1;
  for (const c of [...plan.cells, ...plan.rails]) {
    const n = at(c.x, c.y, c.z);
    const own = (c.row === 0 || c.row === last) && (n === PLANKS || n === FENCE || n === LANTERN); // an end row's own railing (a rim post may carry a lantern)
    if (!(isAir(n) || isLeaves(n) || own)) bad.push({ x: c.x, y: c.y, z: c.z, block: n });
  }
  return bad;
}

// Platform side the exit can join: (x, y, z) is the rim deck cell the bridge's far end row is centred on, d = the bridge heading.
// Needs: a straight run of 5 rail cells on 5 plank cells across the heading; in front (toward the exit) nothing walkable; behind it two
// rows of plain planks (-2..2) with open air above their centre 3 cells (so no stair opening, slab, trunk or connector corridor).
export function sideTarget(at, x, y, z, d) {
  const a = [d[1], -d[0]];
  if (at(x, y + 1, z) !== FENCE) return false;
  for (let o = -2; o <= 2; o++) {
    if (at(x + a[0] * o, y, z + a[1] * o) !== PLANKS || at(x + a[0] * o, y + 1, z + a[1] * o) !== FENCE) return false;
    const fx = x - d[0] + a[0] * o, fz = z - d[1] + a[1] * o;
    if (at(fx, y, fz) === PLANKS || at(fx, y, fz) === SLAB) return false; // a rail inside a deck, not on its rim
  }
  for (const k of [1, 2]) {
    for (let o = -2; o <= 2; o++) {
      const bx = x + d[0] * k + a[0] * o, bz = z + d[1] * k + a[1] * o;
      if (at(bx, y, bz) !== PLANKS) return false;
      if (Math.abs(o) <= 1 && !(isAir(at(bx, y + 1, bz)) && isAir(at(bx, y + 2, bz)))) return false;
    }
  }
  return true;
}
// ---- F1: a side as the START of a bridge ---------------------------------------------------------------------------------------------
// A side marker sits on a rim deck cell of a platform. -> the rim cell (within LOOP.sideSearch cells along the rim, nearest first) where
// sideTarget holds for a bridge heading INTO the platform, as an exit-like start { x, y, z, dir (outward), side: true }, or null.
export function sideStarts(at, x, y, z) {
  if (at(x, y, z) !== PLANKS || at(x, y + 1, z) !== FENCE) return [];
  const found = [];
  for (const out of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const a = [out[1], -out[0]];
    for (let o = -LOOP.sideSearch; o <= LOOP.sideSearch; o++) {
      const cx = x + a[0] * o, cz = z + a[1] * o;
      if (sideTarget(at, cx, y, cz, [-out[0], -out[1]])) found.push({ x: cx, y, z: cz, dir: out, side: true, score: Math.abs(o) });
    }
  }
  return found.sort((p, q) => p.score - q.score).slice(0, LOOP.sideStarts).map(({ score, ...A }) => A);
}
// ---- clutter rule (owner 2026-10-09): a NEW kind of join is refused when a foreign deck / rail lies within clutterMargin cells of its footprint ----
// Footprint = the plan's cells on rows 1..length-2; the three rows at each end are skipped (they belong to the platforms being joined).
export function clutter(at, plan, margin = LOOP.clutterMargin) {
  if (plan.parts) return plan.parts.some((p) => clutter(at, p, margin));
  const foot = new Set();
  for (const c of plan.cells) if (c.row > 0 && c.row < plan.length - 1) foot.add(`${c.x},${c.z}`);
  const d = plan.A.dir;
  for (const k of foot) {
    const [x, z] = k.split(",").map(Number);
    for (let dx = -margin; dx <= margin; dx++) for (let dz = -margin; dz <= margin; dz++) {
      const t = (x + dx - plan.A.x) * d[0] + (z + dz - plan.A.z) * d[1];
      if (foot.has(`${x + dx},${z + dz}`) || t < 3 || t > plan.length - 4) continue;
      for (let y = plan.A.y - 1; y <= plan.A.y + 3; y++) { const n = at(x + dx, y, z + dz); if (n === PLANKS || n === SLAB || n === FENCE) return true; }
    }
  }
  return false;
}
export const isNewKind = (sideStart, dist, offset) => sideStart || dist < LOOP.legacyMinDist || Math.abs(offset) > LOOP.legacyMaxOffset;

// ---- F4 plaza ------------------------------------------------------------------------------------------------------------------------------
const isDeck = (n) => n === PLANKS || n === SLAB;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Exits facing A at dist 1..PLAZA.maxDist ahead, |lat| <= PLAZA.maxLat, same height: nearest first. -> [{ B, dist, lat, score }]
export function findPlazaPartners(at, A) {
  const d = A.dir, e = [d[1], -d[0]], out = [];
  for (let dist = 1; dist <= PLAZA.maxDist; dist++) for (let lat = -PLAZA.maxLat; lat <= PLAZA.maxLat; lat++) {
    const x = A.x + d[0] * dist + e[0] * lat, z = A.z + d[1] * dist + e[1] * lat;
    if (at(x, A.y + 1, z) !== FENCE) continue;
    const B = exitAt(at, x, A.y, z);
    if (B && B.dir[0] === -d[0] && B.dir[1] === -d[1]) out.push({ B, dist, lat, score: dist + Math.abs(lat) });
  }
  return out.sort((a, b) => a.score - b.score || a.dist - b.dist);
}

// A filled, railed plank deck over the bounding rectangle of the two exit rows. -> a plan (kind "plaza", same format as planBridge, plus `pier`)
// or { error, blocked? }. Frame: t forward from A, o sideways (e = (dir.z, -dir.x)); A at (0, 0), B at (dist, lat).
export function planPlaza(at, A, B) {
  const d = A.dir, e = [d[1], -d[0]], dx = B.x - A.x, dz = B.z - A.z, y = A.y;
  const dist = dx * d[0] + dz * d[1], lat = dx * e[0] + dz * e[1];
  if (dist < 1 || dist > PLAZA.maxDist || Math.abs(lat) > PLAZA.maxLat) return { error: "plaza out of range" };
  const lo = Math.min(-2, lat - 2), hi = Math.max(2, lat + 2), ext = dist < 4 ? 1 : 0;
  const cell = (t, o) => [A.x + d[0] * t + e[0] * o, A.z + d[1] * t + e[1] * o];
  const K = (x, z) => `${x},${z}`;
  const deck = new Map(), fill = [], blocked = [];
  for (let t = -ext; t <= dist + ext; t++) for (let o = lo; o <= hi; o++) {
    const [x, z] = cell(t, o), n = at(x, y, z);
    if (n === undefined) return { error: "plaza not loaded" };
    if (isDeck(n)) { deck.set(K(x, z), "old"); continue; }
    let ok = true;
    for (let h = 0; h <= 3; h++) { const m = at(x, y + h, z); if (!(isAir(m) || isLeaves(m))) { ok = false; blocked.push({ x, y: y + h, z, block: m }); break; } }
    if (ok) { fill.push([x, z]); deck.set(K(x, z), "new"); }
  }
  if (blocked.length) return { error: "blocked", blocked };
  const olds = [...deck].filter(([, v]) => v === "old").map(([k]) => k.split(",").map(Number));
  if (!fill.length) return { error: "plaza nothing to fill" };
  let far = 0;
  for (const [x, z] of fill) {
    const m = Math.min(...olds.map(([ox, oz]) => Math.max(Math.abs(ox - x), Math.abs(oz - z))));
    if (m > PLAZA.cantilever) return { error: "plaza cantilever" };
    far = Math.max(far, m);
  }
  // the decks of the two exits must be one piece (4-connected) after filling
  const isD = (x, z) => deck.has(K(x, z)) || isDeck(at(x, y, z));
  const seen = new Set([K(A.x, A.z)]), stack = [[A.x, A.z]];
  while (stack.length) { const [x, z] = stack.pop(); for (const [a, b] of N4) if (isD(x + a, z + b) && !seen.has(K(x + a, z + b))) { seen.add(K(x + a, z + b)); stack.push([x + a, z + b]); } }
  if (!seen.has(K(B.x, B.z))) return { error: "plaza not connected" };
  // fences: a new deck cell with a non-deck 4-neighbour; old fences whose open sides are all new deck now go
  const hasFence = (x, z) => at(x, y + 1, z) === FENCE;
  const newRail = new Set(), removed = new Set();
  for (const [x, z] of fill) if (N4.some(([a, b]) => !isD(x + a, z + b))) newRail.add(K(x, z));
  for (const [k, v] of deck) {
    if (v !== "old") continue;
    const [x, z] = k.split(",").map(Number);
    if (!hasFence(x, z)) continue;
    const open = N4.filter(([a, b]) => !isDeck(at(x + a, y, z + b)));
    if (open.every(([a, b]) => deck.get(K(x + a, z + b)) === "new")) removed.add(k); // also a wall between two rows that now touch
  }
  const fenced = (x, z) => newRail.has(K(x, z)) || (hasFence(x, z) && !removed.has(K(x, z)));
  // a diagonal pair of posts needs one orthogonal post (rail_diag): add it on a deck cell
  for (let guard = 0; guard < 6; guard++) {
    let added = false;
    const dxs = [...deck.keys()].map((k) => k.split(",").map(Number)), bx0 = Math.min(...dxs.map((c) => c[0])) - 1, bx1 = Math.max(...dxs.map((c) => c[0])) + 1, bz0 = Math.min(...dxs.map((c) => c[1])) - 1, bz1 = Math.max(...dxs.map((c) => c[1])) + 1;
    const around = [];
    for (let x = bx0; x <= bx1; x++) for (let z = bz0; z <= bz1; z++) around.push([x, z]);
    for (const [x, z] of around) for (const [a, b] of [[1, 1], [1, -1]]) {
      if (!fenced(x, z) || !fenced(x + a, z + b) || fenced(x + a, z) || fenced(x, z + b)) continue;
      const orth = [[x + a, z], [x, z + b]];
      const pick = orth.find(([cx, cz]) => isD(cx, cz)) ?? orth.find(([cx, cz]) => isAir(at(cx, y + 1, cz)) && isAir(at(cx, y, cz))); // else a corner post in the air
      if (pick) { newRail.add(K(...pick)); added = true; }
    }
    if (!added) break;
  }
  const changed = [...newRail, ...removed];
  const stateOf = (x, z) => {
    const st = {};
    for (const [a, b] of N4) st[`minecraft:connection_${SIDE_OF([a, b])}`] = fenced(x + a, z + b);
    return st;
  };
  const rails = [], railAt = new Set();
  const addRail = (x, z) => { if (!railAt.has(K(x, z))) { railAt.add(K(x, z)); rails.push({ x, y: y + 1, z, states: stateOf(x, z), row: 1 }); } };
  for (const k of newRail) addRail(...k.split(",").map(Number));
  for (const k of changed) { // old posts next to a changed cell: their links follow
    const [x, z] = k.split(",").map(Number);
    for (const [a, b] of N4) if (fenced(x + a, z + b)) addRail(x + a, z + b);
  }
  const cells = [];
  for (const [x, z] of fill) {
    cells.push({ x, y, z, kind: "plank", row: 1 });
    for (let h = 1; h <= 3; h++) cells.push({ x, y: y + h, z, kind: "air", row: 1 });
  }
  for (const k of removed) { const [x, z] = k.split(",").map(Number); for (let h = 1; h <= 3; h++) cells.push({ x, y: y + h, z, kind: "air", row: 1 }); } // a lantern on the post goes too
  // lanterns on post tops until every walk cell of the patch is lit
  const posts = [], walkXZ = [];
  for (const k of deck.keys()) { const [x, z] = k.split(",").map(Number); (fenced(x, z) ? posts : walkXZ).push([x, z]); }
  const ov = (x, yy, z) => { // the world after the plan, for the light test
    const dk = deck.get(K(x, z));
    if (dk === "new" && yy === y) return PLANKS;
    if (dk === "new" && yy > y && yy <= y + 3) return yy === y + 1 && fenced(x, z) ? FENCE : "minecraft:air";
    if (yy > y && yy <= y + 3 && removed.has(K(x, z))) return "minecraft:air";
    return at(x, yy, z);
  };
  const lamps = plazaLanterns(ov, walkXZ, posts, y);
  if (lamps.error) return lamps;
  // a pier under the patch when it hangs out more than PLAZA.needPier from the old deck: under the fill cell nearest to the fill's centre
  let pier = [];
  if (far > PLAZA.needPier) {
    const mx = fill.reduce((s, c) => s + c[0], 0) / fill.length, mz = fill.reduce((s, c) => s + c[1], 0) / fill.length;
    const [px, pz] = fill.slice().sort((p, q) => Math.hypot(p[0] - mx, p[1] - mz) - Math.hypot(q[0] - mx, q[1] - mz))[0];
    const r = planPier(at, { x: px, y, z: pz });
    if (r.error) return { error: r.error };
    pier = r.blocks;
  }
  return { A, B, length: dist + 1, offset: lat, shape: null, cells, rails, lanterns: lamps.map(([x, yy, z]) => ({ x, y: yy, z, row: 1 })), side: false, plaza: true, pier };
}
function plazaLanterns(ov, walkXZ, posts, y) {
  const k3 = (x, yy, z) => `${x},${yy},${z}`, R = LOOP.lanternLight;
  const xs = [...walkXZ, ...posts].map((c) => c[0]), zs = [...walkXZ, ...posts].map((c) => c[1]);
  const x0 = Math.min(...xs) - R, x1 = Math.max(...xs) + R, z0 = Math.min(...zs) - R, z1 = Math.max(...zs) + R;
  const lamps = [], base = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let yy = y - 1; yy <= y + 5; yy++) if (ov(x, yy, z) === LANTERN) base.push([x, yy, z]);
  const passes = (x, yy, z) => {
    if (x < x0 || x > x1 || z < z0 || z > z1 || yy < y - 1 || yy > y + 5) return false;
    const n = ov(x, yy, z);
    return isAir(n) || n === FENCE || n === LANTERN;
  };
  const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const lit = () => {
    const Lv = new Map(), q = [];
    for (const l of [...base, ...lamps]) { Lv.set(k3(...l), R); q.push(l); }
    for (let i = 0; i < q.length; i++) {
      const [x, yy, z] = q[i], v = Lv.get(k3(x, yy, z));
      if (v <= 1) continue;
      for (const [a, b, c] of N6) {
        const n = [x + a, yy + b, z + c];
        if ((Lv.get(k3(...n)) ?? 0) >= v - 1 || !(passes(...n) || lamps.some((l) => k3(...l) === k3(...n)))) continue;
        Lv.set(k3(...n), v - 1); q.push(n);
      }
    }
    return Lv;
  };
  const walk = walkXZ.filter(([x, z]) => isAir(ov(x, y + 1, z)) || ov(x, y + 1, z) === LANTERN).map(([x, z]) => [x, y + 1, z]);
  for (let guard = 0; guard < 40; guard++) {
    const Lv = lit(), dark = new Set(walk.filter((c) => (Lv.get(k3(...c)) ?? 0) < LOOP.lightTarget).map((c) => k3(...c)));
    if (!dark.size) return lamps;
    let best = null, bg = 0;
    for (const [px, pz] of posts) {
      const p = [px, y + 2, pz];
      if (!isAir(ov(...p)) || lamps.some((l) => k3(...l) === k3(...p))) continue;
      const seen = new Map([[k3(...p), 0]]), q = [p];
      let n = 0;
      for (let i = 0; i < q.length; i++) {
        const [x, yy, z] = q[i], dd = seen.get(k3(x, yy, z));
        if (dark.has(k3(x, yy, z))) n++;
        if (dd >= R - LOOP.lightTarget) continue;
        for (const [a, b, c] of N6) { const m = [x + a, yy + b, z + c]; if (!seen.has(k3(...m)) && passes(...m)) { seen.set(k3(...m), dd + 1); q.push(m); } }
      }
      if (n > bg) { bg = n; best = p; }
    }
    if (!best) return { error: `plaza: cannot light ${dark.size} walk cells` };
    lamps.push(best);
  }
  return { error: "plaza: lighting did not converge" };
}

// ---- F5 L-join (owner 2026-10-09): two exits at right angles whose heading lines cross -----------------------------------------------------
// Leave A, straight bridge, a square 5 x 5 railed landing on a log pier at the crossing C = A + d*s = B + e*u, turn 90 degrees, straight bridge
// into B. Both legs are ordinary bridges (minLeg..maxDist blocks); the landing stands on a pier like the one of the long spans (planPier).
export function planLanding(C, opens) { // C = centre deck cell {x, y, z}; opens = unit vectors of the faces that carry a bridge
  const N = LOOP.landing, h = (N - 1) / 2, cells = [], ring = new Set(), lanterns = [], rails = [];
  const isOpen = (i, j) => opens.some((v) => (Math.abs(v[0]) === 1 ? i === v[0] * h && Math.abs(j) <= 1 : j === v[1] * h && Math.abs(i) <= 1));
  for (let i = -h; i <= h; i++) for (let j = -h; j <= h; j++) {
    cells.push({ x: C.x + i, y: C.y, z: C.z + j, kind: "plank", row: 1 });
    if (Math.abs(i) <= 1 && Math.abs(j) <= 1) for (let up = 1; up <= 3; up++) cells.push({ x: C.x + i, y: C.y + up, z: C.z + j, kind: "air", row: 1 });
    if ((Math.abs(i) === h || Math.abs(j) === h) && !isOpen(i, j)) ring.add(`${i},${j}`);
  }
  for (const key of ring) {
    const [i, j] = key.split(",").map(Number), states = {};
    for (const s4 of ["north", "south", "west", "east"]) states[`minecraft:connection_${s4}`] = false;
    for (const v of N4) if (ring.has(`${i + v[0]},${j + v[1]}`)) states[`minecraft:connection_${SIDE_OF(v)}`] = true;
    rails.push({ x: C.x + i, y: C.y + 1, z: C.z + j, states, row: 1 });
  }
  // lanterns on the middle posts of the two closed faces (the posts flanking an opening carry the bridges' step posts)
  for (const [i, j] of [[-h, 0], [h, 0], [0, -h], [0, h]]) if (ring.has(`${i},${j}`) && lanterns.length < 2) lanterns.push({ x: C.x + i, y: C.y + 2, z: C.z + j, row: 1 });
  return { cells, rails, lanterns };
}
export function planL(A, B, s, u) {
  const d = A.dir, e = B.dir, h = (LOOP.landing - 1) / 2;
  const C = { x: A.x + d[0] * s, y: A.y, z: A.z + d[1] * s };
  if (C.x !== B.x + e[0] * u || C.z !== B.z + e[1] * u) throw new Error("planL: corner mismatch");
  const f = [-e[0], -e[1]]; // heading from the landing to B
  const near = { x: C.x - d[0] * h, y: A.y, z: C.z - d[1] * h }, far = { x: C.x + f[0] * h, y: A.y, z: C.z + f[1] * h, dir: f };
  const p1 = planBridge(A, near, s - h + 1, 0, true), p2 = planBridge(far, B, u - h + 1, 0, false, true);
  const L = planLanding(C, [[-d[0], -d[1]], f]);
  const rm = new Map();
  for (const r of [...p1.rails, ...p2.rails, ...L.rails]) {
    const k = `${r.x},${r.y},${r.z}`, cur = rm.get(k);
    if (!cur) rm.set(k, { ...r, states: { ...r.states } }); else for (const [st, v] of Object.entries(r.states)) if (v) cur.states[st] = true;
  }
  return { A, B, length: s + u + 1, offset: 0, shape: null, cells: [...p1.cells, ...p2.cells, ...L.cells], rails: [...rm.values()], lanterns: [...p1.lanterns, ...p2.lanterns, ...L.lanterns],
    side: false, landing: { x: C.x, y: C.y, z: C.z, dir: d, d1: s - h, d2: u - h }, pier: [], L: true, parts: [p1, p2], core: { cells: L.cells, rails: L.rails, length: 99 } };
}
// Exits at right angles to A (same deck height) whose heading line crosses A's ahead: [{ B, s, u, score }] nearest first.
export function findLs(at, A) {
  const d = A.dir, h = (LOOP.landing - 1) / 2, out = [], lim = LOOP.maxDist + h;
  for (const e of [[d[1], -d[0]], [-d[1], d[0]]]) { // e = heading of B
    for (let s = h + LOOP.minLeg; s <= lim; s++) for (let u = h + LOOP.minLeg; u <= lim; u++) {
      const x = A.x + d[0] * s - e[0] * u, z = A.z + d[1] * s - e[1] * u;
      if (at(x, A.y + 1, z) !== FENCE) continue;
      const B = exitAt(at, x, A.y, z);
      if (B && B.dir[0] === e[0] && B.dir[1] === e[1]) out.push({ B, s, u, score: s + u });
    }
  }
  return out.sort((a, b) => a.score - b.score || a.s - b.s);
}

// ---- lanterns: the generator's greedy (tools/village_mallorn.mjs addLanterns) on the bridge alone ---------------------------------
// Light model as in skill 11-structure-lighting: lantern 14, passes through air, void, fences and lanterns, loses 1 per step,
// everything else stops it. Lanterns go on top of rail posts (never in the two end rows) until every walk cell has >= lightTarget.
// -> [[x, y, z]] in shape coordinates.
export function planLanterns(shape) {
  const [W, H, L] = shape.size, k = (x, y, z) => `${x},${y},${z}`;
  const g = new Map();
  for (const c of shape.cells) g.set(k(c.x, c.y, c.z), c.kind === "air" ? "a" : "s");
  for (const r of shape.rails) g.set(k(r.x, r.y, r.z), "f");
  const passes = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < L && ["a", "f", "l", undefined].includes(g.get(k(x, y, z)));
  const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const lit = (lamps) => {
    const Lv = new Map(), q = [];
    for (const l of lamps) { Lv.set(k(...l), LOOP.lanternLight); q.push(l); }
    for (let i = 0; i < q.length; i++) {
      const [x, y, z] = q[i], v = Lv.get(k(x, y, z));
      if (v <= 1) continue;
      for (const [dx, dy, dz] of N6) {
        const n = [x + dx, y + dy, z + dz];
        if ((Lv.get(k(...n)) ?? 0) >= v - 1 || !passes(...n)) continue;
        Lv.set(k(...n), v - 1); q.push(n);
      }
    }
    return Lv;
  };
  const lamps = [];
  for (let guard = 0; guard < 60; guard++) {
    const Lv = lit(lamps), dark = new Set(shape.walk.filter((c) => (Lv.get(k(...c)) ?? 0) < LOOP.lightTarget).map((c) => k(...c)));
    if (!dark.size) return lamps;
    let best = null, bg = 0;
    for (const r of shape.rails) {
      const p = [r.x, r.y + 1, r.z];
      if (r.z === 0 || r.z === L - 1 || g.get(k(...p)) !== "a") continue;
      const seen = new Map([[k(...p), 0]]), q = [p];
      let n = 0;
      for (let i = 0; i < q.length; i++) {
        const [x, y, z] = q[i], dd = seen.get(k(x, y, z));
        if (dark.has(k(x, y, z))) n++;
        if (dd >= LOOP.lanternLight - LOOP.lightTarget) continue;
        for (const [dx, dy, dz] of N6) { const m = [x + dx, y + dy, z + dz]; if (!seen.has(k(...m)) && passes(...m)) { seen.set(k(...m), dd + 1); q.push(m); } }
      }
      if (n > bg) { bg = n; best = p; }
    }
    if (!best) throw new Error(`planLanterns: cannot light ${dark.size} walk cells`);
    g.set(k(...best), "l"); lamps.push(best);
  }
  throw new Error("planLanterns: no convergence");
}

// ---- F6 merge (owner 2026-10-09, screenshots gap8 / gap9): two decks that touch (0 cells apart: a double railing) or nearly touch (1 cell apart) ----
// Jigsaw puts two pieces side by side and each keeps its own rim. A merge opens ONE shared stretch of the two rims: both railings go along the stretch,
// a 1-cell gap is filled with planks, and the stretch is closed at both ends by posts. It adds no bridge, so it does not count toward the link budget
// (village_planner.js: PLAN.mergeCap). Same deck height only (a half slab or one block of height difference is skipped: the rims would need a step).
// The CORE of a stretch = rim pairs with standing deck behind both (cells the walker can enter from both sides). A pair just beyond the core whose two
// rim cells both exist (the corner posts of the pieces) is a real END POST: the whole core opens (a 1-cell door fits between two posts; real world TT
// 2026-10-09: two 5-wide end caps staggered by 2 cells share ONE such cell, 3 rim cells). Without a real post on an end, that end's last core cell stays as
// the post (the opening is one cell shorter there). openMin / openMinTrim: opening width needed with posts on both ends / otherwise (2).
// minNet (planner): the two decks must not already be joined by a walk of fewer than this many steps (a 2-thick fence wall inside one deck is not a merge).
export const MERGE = { openMin: 1, openMinTrim: 2, maxGap: 1, minNet: 10 };
const isRimCell = (at, x, y, z) => at(x, y, z) === PLANKS && at(x, y + 1, z) === FENCE;
const standCell = (at, x, y, z) => at(x, y, z) === PLANKS && isAir(at(x, y + 1, z)) && isAir(at(x, y + 2, z)); // deck with standing room
const freeCell = (n) => isAir(n) || isLeaves(n);
const gapFree = (at, y, x, z) => { for (let h = 0; h <= 3; h++) if (!freeCell(at(x, y + h, z))) return false; return true; };
// is (x, z) with the partner g + 1 cells ahead (d) a facing rim pair? P = rim, Q = rim, standing deck behind both, the gap cell (g = 1) free
export function mergePair(at, y, d, g, x, z) {
  const qx = x + d[0] * (g + 1), qz = z + d[1] * (g + 1);
  if (!isRimCell(at, x, y, z) || !isRimCell(at, qx, y, qz) || !standCell(at, x - d[0], y, z - d[1]) || !standCell(at, qx + d[0], y, qz + d[1])) return false;
  return g === 0 || gapFree(at, y, x + d[0], z + d[1]);
}
// an end post pair: both rim cells exist (no deck behind needed), the gap cell (g = 1) is free for the cap
const mergePost = (at, y, d, g, x, z) => isRimCell(at, x, y, z) && isRimCell(at, x + d[0] * (g + 1), y, z + d[1] * (g + 1)) && (g === 0 || gapFree(at, y, x + d[0], z + d[1]));
// which core cells open: [lo, hi] (indexes into run) | null when the stretch is too short
function mergeSpan(at, y, d, g, run) {
  const n = run.length, a = [d[1], d[0]], [x0, z0] = run[0], [x1, z1] = run[n - 1];
  const p0 = mergePost(at, y, d, g, x0 - a[0], z0 - a[1]), p1 = mergePost(at, y, d, g, x1 + a[0], z1 + a[1]);
  const lo = p0 ? 0 : 1, hi = p1 ? n - 1 : n - 2;
  return hi - lo + 1 >= (p0 && p1 ? MERGE.openMin : MERGE.openMinTrim) ? [lo, hi] : null;
}
// Every shared stretch within rect on level y: [{ y, d, g, a, run: [[x, z] ...], span: [lo, hi] }] (run = the P cells of the core in order along the rims), widest opening first.
export function* findMerges(at, y, rect) {
  const out = [];
  for (const d of [[1, 0], [0, 1]]) for (let g = 0; g <= MERGE.maxGap; g++) {
    const ok = new Set(), a = [d[1], d[0]];
    for (let x = rect.x0; x <= rect.x1; x++) {
      for (let z = rect.z0; z <= rect.z1; z++) if (at(x, y + 1, z) === FENCE && mergePair(at, y, d, g, x, z)) ok.add(`${x},${z}`);
      if (x % 8 === 0) yield;
    }
    for (const k of ok) {
      const [x, z] = k.split(",").map(Number);
      if (ok.has(`${x - a[0]},${z - a[1]}`)) continue; // not the start of its run
      const run = [];
      for (let i = 0; ok.has(`${x + a[0] * i},${z + a[1] * i}`); i++) run.push([x + a[0] * i, z + a[1] * i]);
      const span = mergeSpan(at, y, d, g, run);
      if (span) out.push({ y, d, g, a, run, span });
    }
  }
  const w = (m) => m.span[1] - m.span[0];
  return out.sort((p, q) => w(q) - w(p) || p.run[0][0] - q.run[0][0] || p.run[0][1] - q.run[0][1]);
}

// The real build of one stretch (re-checks every pair on the current world, so a stretch that an earlier merge changed fails cleanly).
// -> { plan } in the plaza plan format (cells / rails / lanterns, plan.merge = true) | { error }
export function planMerge(at, m) {
  const { y, d, g, run } = m, n = run.length, K = (x, z) => `${x},${z}`;
  if (!run.every(([x, z]) => mergePair(at, y, d, g, x, z))) return { error: "merge: stretch changed" };
  const span = mergeSpan(at, y, d, g, run);
  if (!span) return { error: "merge: stretch changed" };
  const [lo, hi] = span, a = [d[1], d[0]];
  const P = run.map(([x, z]) => [x, z]), Q = run.map(([x, z]) => [x + d[0] * (g + 1), z + d[1] * (g + 1)]), G = run.map(([x, z]) => [x + d[0], z + d[1]]);
  const removed = new Set(), added = new Set(), gapSet = new Set(), cells = [];
  for (let i = lo; i <= hi; i++) {
    for (const [x, z] of [P[i], Q[i]]) {
      const up2 = at(x, y + 2, z);
      if (!(freeCell(up2) || up2 === LANTERN)) return { error: "merge: no headroom over a removed rail" };
      removed.add(K(x, z));
      cells.push({ x, y, z, kind: "plank", row: 1 }, { x, y: y + 1, z, kind: "air", row: 1 }, { x, y: y + 2, z, kind: "air", row: 1 });
    }
  }
  if (g === 1) { // gap planks under the opening; the caps (a fence on plank) sit one cell beyond each end, between the two end posts
    const cap = (i) => [P[0][0] + a[0] * i + d[0], P[0][1] + a[1] * i + d[1]];
    for (let i = lo - 1; i <= hi + 1; i++) {
      const [x, z] = cap(i), isCap = i === lo - 1 || i === hi + 1;
      gapSet.add(K(x, z)); cells.push({ x, y, z, kind: "plank", row: 1 });
      if (isCap) { added.add(K(x, z)); cells.push({ x, y: y + 2, z, kind: "air", row: 1 }, { x, y: y + 3, z, kind: "air", row: 1 }); }
      else for (let h = 1; h <= 3; h++) cells.push({ x, y: y + h, z, kind: "air", row: 1 });
    }
  }
  const fenced = (x, z) => added.has(K(x, z)) || (at(x, y + 1, z) === FENCE && !removed.has(K(x, z)));
  const rails = [], seen = new Set();
  const addRail = (x, z) => {
    if (seen.has(K(x, z)) || !fenced(x, z)) return;
    seen.add(K(x, z));
    const st = {};
    for (const v of N4) st[`minecraft:connection_${SIDE_OF(v)}`] = fenced(x + v[0], z + v[1]);
    rails.push({ x, y: y + 1, z, states: st, row: 1 });
  };
  for (const k of [...removed, ...added]) { const [x, z] = k.split(",").map(Number); addRail(x, z); for (const v of N4) addRail(x + v[0], z + v[1]); }
  // light: every walk cell of the stretch and every walk cell that was lit before must still have light >= lightTarget
  const ovA = (x, yy, z) => {
    const k = K(x, z);
    if (gapSet.has(k)) {
      if (yy === y) return PLANKS;
      if (yy === y + 1 && added.has(k)) return FENCE;
      if (yy > y && yy <= y + 3) return "minecraft:air";
    }
    if (removed.has(k) && (yy === y + 1 || yy === y + 2)) return "minecraft:air";
    return at(x, yy, z);
  };
  const walk = [];
  for (let i = lo; i <= hi; i++) { walk.push(P[i], Q[i]); if (g === 1) walk.push(G[i]); }
  const xs = [...P, ...Q].map((c) => c[0]), zs = [...P, ...Q].map((c) => c[1]);
  const box = { x0: Math.min(...xs) - 12, x1: Math.max(...xs) + 12, z0: Math.min(...zs) - 12, z1: Math.max(...zs) + 12 };
  const posts = [];
  for (let x = box.x0 + 4; x <= box.x1 - 4; x++) for (let z = box.z0 + 4; z <= box.z1 - 4; z++) if (fenced(x, z)) posts.push([x, z]);
  const lamps = mergeLanterns(at, ovA, walk, posts, y, box);
  if (lamps.error) return lamps;
  const mid = lo + Math.floor((hi - lo + 1) / 2);
  const A = { x: P[mid][0] - d[0], y, z: P[mid][1] - d[1] }, B = { x: Q[mid][0] + d[0], y, z: Q[mid][1] + d[1] };
  return { plan: { A, B, length: n, offset: 0, shape: null, cells, rails, lanterns: lamps.map(([x, yy, z]) => ({ x, y: yy, z, row: 1 })), side: false, merge: true, gap: g, pier: [] } };
}
// Lanterns on post tops until every watched walk cell (the stretch + all deck cells that were lit before) is lit again; ovB / ovA = the world before / after.
function mergeLanterns(ovB, ovA, walkXZ, posts, y, b) {
  const k3 = (x, yy, z) => `${x},${yy},${z}`, R = LOOP.lanternLight, N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const inBox = (x, yy, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && yy >= y - 1 && yy <= y + 5;
  const passes = (ov, x, yy, z) => { if (!inBox(x, yy, z)) return false; const t = ov(x, yy, z); return isAir(t) || t === FENCE || t === LANTERN; };
  const field = (ov, lamps) => {
    const Lv = new Map(), q = [];
    for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) for (let yy = y - 1; yy <= y + 5; yy++) if (ov(x, yy, z) === LANTERN) { Lv.set(k3(x, yy, z), R); q.push([x, yy, z]); }
    for (const l of lamps) { Lv.set(k3(...l), R); q.push(l); }
    for (let i = 0; i < q.length; i++) {
      const [x, yy, z] = q[i], v = Lv.get(k3(x, yy, z));
      if (v <= 1) continue;
      for (const [a, c, e] of N6) {
        const nx = x + a, ny = yy + c, nz = z + e;
        if ((Lv.get(k3(nx, ny, nz)) ?? 0) >= v - 1 || !passes(ov, nx, ny, nz)) continue;
        Lv.set(k3(nx, ny, nz), v - 1); q.push([nx, ny, nz]);
      }
    }
    return Lv;
  };
  const before = field(ovB, []), watch = new Map();
  const standing = (x, z) => ovA(x, y, z) === PLANKS && isAir(ovA(x, y + 1, z));
  for (const [x, z] of walkXZ) if (standing(x, z)) watch.set(k3(x, y + 1, z), [x, y + 1, z]);
  for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) if (standing(x, z) && (before.get(k3(x, y + 1, z)) ?? 0) >= LOOP.lightTarget) watch.set(k3(x, y + 1, z), [x, y + 1, z]);
  const lamps = [];
  for (let guard = 0; guard < 30; guard++) {
    const Lv = field(ovA, lamps), dark = [...watch.values()].filter((c) => (Lv.get(k3(...c)) ?? 0) < LOOP.lightTarget);
    if (!dark.length) return lamps;
    const darkSet = new Set(dark.map((c) => k3(...c)));
    let best = null, bg = 0;
    for (const [px, pz] of posts) {
      const p = [px, y + 2, pz];
      if (!isAir(ovA(...p)) || lamps.some((l) => k3(...l) === k3(...p))) continue;
      const seen = new Map([[k3(...p), 0]]), q = [p];
      let cnt = 0;
      for (let i = 0; i < q.length; i++) {
        const [x, yy, z] = q[i], dd = seen.get(k3(x, yy, z));
        if (darkSet.has(k3(x, yy, z))) cnt++;
        if (dd >= R - LOOP.lightTarget) continue;
        for (const [a, c, e] of N6) { const m = [x + a, yy + c, z + e]; if (!seen.has(k3(...m)) && passes(ovA, ...m)) { seen.set(k3(...m), dd + 1); q.push(m); } }
      }
      if (cnt > bg) { bg = cnt; best = p; }
    }
    if (!best) return { error: `merge: cannot light ${dark.length} walk cells` };
    lamps.push(best);
  }
  return { error: "merge: lighting did not converge" };
}
