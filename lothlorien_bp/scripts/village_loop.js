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
import { layerCells, drive } from "./village_geom.js";

export const MARKER_ID = "lothlorien:loop_marker";
export const PLANKS = "lothlorien:mallorn_planks", SLAB = "lothlorien:mallorn_slab", FENCE = "lothlorien:mallorn_fence", LANTERN = "lothlorien:elven_lantern", HEART = "lothlorien:mallorn_heartwood_planks";
// the heartwood ring round a trunk (tools/village_dress.mjs) is deck like planks: every deck test below that is not about a plain railing_end accepts it
export const isPlank = (n) => n === PLANKS || n === HEART;
// a rim cell is a fence, or a stripped-log post standing on the deck (pavilion / flag posts replace the rim fence under them, tools/village_dress.mjs)
export const isRailPost = (n) => n === FENCE || n === "lothlorien:mallorn_stripped_log";
// Light of runtime-built links (M7 style guide section 5, WP3): the safety light is HIDDEN (`minecraft:light_block_14`, plan.lights, invisible; the sim and
// the tests count it like a lantern of 14), the visible lamps are art (plan.lamps: a lamp post = a second fence on a rail post + an elven lantern on top, at
// both bridge ends and beside a gate arch). A visible lamp is never counted for the safety: it may be broken or taken.
export const HIDDEN_LIGHT = "minecraft:light_block_14", LANTERN_GOLD = "lothlorien:elven_lantern_heartwood", LOG_STRIPPED = "lothlorien:mallorn_stripped_log";
const LIGHT_BLOCK_RE = /^minecraft:light_block_(\d+)$/;
// level an existing block emits for the planners' light models (lanterns 14, hidden light blocks their own level)
export const lightLevel = (n) => (n === LANTERN || n === LANTERN_GOLD ? 14 : LIGHT_BLOCK_RE.test(n ?? "") ? +LIGHT_BLOCK_RE.exec(n)[1] : 0);
// minDist/maxDist: blocks between the two railing rows' centres (bridge length = dist + 1, i.e. 5..16 free cells between the rows);
// maxOffset: sideways shift (also <= length - 3, the most bridgeShape supports: one block sideways per block forward).
// Longer spans (maxDist < dist <= maxSpan) are two bridges with a supported 5 x 5 landing in the middle (planSpan): the landing stands on a
// log pier down to the ground (planPier, at most pierMaxDepth blocks, through water to the bottom); maxSpanOffset = sideways shift of the whole span.
// Round 2 (owner 2026-10-09): minDist 6 -> 2 with a flat deck for length <= flatMax (F2), maxOffset 5 -> 8 (F3), sideSearch = how far along a rim a
// side marker looks for its 5-run (F1), clutterMargin = no foreign deck within that many cells of a NEW kind of join. legacyMinDist / legacyMaxOffset
// are the old limits: a join inside them is the old kind (no clutter test). LOOP.corner = F5 L-join limits (legs of `minLeg`..maxDist blocks).
// pierMaxDepth: the whole overworld height (-64..320), as the repair's root down (owner 2026-10-28: hilltop villages).
export const LOOP = { minDist: 2, maxDist: 17, maxSpan: 30, maxOffset: 8, maxSpanOffset: 8, landing: 5, pierMaxDepth: 384, lightTarget: 8, lanternLight: 14,
  flatMax: 5, sideSearch: 6, sideStarts: 8, clutterMargin: 2, legacyMinDist: 6, legacyMaxOffset: 5, minLeg: 3 };
// F4 plaza: filled deck over the bounding rectangle of two facing exits that no bridge can join (dist 1..maxDist, |lat| <= maxLat), fill cells at most
// `cantilever` (Chebyshev) from an existing deck cell, a log pier under the patch when a fill cell is more than `needPier` from the old deck.
export const PLAZA = { maxDist: 6, maxLat: 8, cantilever: 4, needPier: 2 };
export const LOG = "lothlorien:mallorn_log";

const AIRS = ["minecraft:air", "minecraft:cave_air", "minecraft:void_air"];
const isAir = (n) => AIRS.includes(n) || /^minecraft:light_block_\d+$/.test(n); // a hidden light block (village generator) is air for every planner test
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
        if (!isPlank(at(bx, y, bz))) ok = false;
        else if (Math.abs(o) === 2) ok = at(bx, y + 1, bz) === FENCE;
        else ok = isAir(at(bx, y + 1, bz)) && isAir(at(bx, y + 2, bz));
      }
      const out = at(x - s[0], y, z - s[1]);
      if (ok && !isPlank(out) && out !== SLAB) return { x, y, z, dir: [-s[0], -s[1]] };
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
export const planBridge = (...a) => drive(planBridgeGen(...a));
export function* planBridgeGen(A, B, length, offset, side = false, sideA = false) {
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
  const pl = yield* planLightsGen(shape, offset);
  const lights = pl.lights.map(([x, y, z]) => ({ ...w(x, y, z), row: z }));
  const lamps = pl.lamps.map((q) => ({ ...w(q.x, q.y, q.z), row: q.z, id: q.id }));
  const gateBlock = (q) => {
    if (q.kind === "hang") return { id: LANTERN_GOLD, states: { "minecraft:block_face": "down" } };
    if (q.kind === "crest") return { id: "lothlorien:mallorn_golden_leaves", states: {} };
    const states = { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false };
    if (q.kind === "bar") { // the bar links to its neighbours across the bridge (world side of the local +-x)
      if (!q.first) states[`minecraft:connection_${SIDE_OF([-ex[0], -ex[1]])}`] = true;
      if (!q.last) states[`minecraft:connection_${SIDE_OF([ex[0], ex[1]])}`] = true;
    }
    return { id: FENCE, states };
  };
  const blocks = pl.gate.map((q) => ({ ...w(q.x, q.y, q.z), ...gateBlock(q) }));
  const pots = pl.pots.map((q) => ({ ...w(q.x, q.y, q.z), row: q.z }));
  for (const q of pl.gate) if (q.kind === "crest") cells.push({ ...w(q.x, q.y, q.z), kind: "air", row: q.z }); // so blockedCells sees it
  const end = w(shape.connectors[1].x, 0, length - 1);
  if (end.x !== B.x || end.z !== B.z || end.y !== B.y) throw new Error(`planBridge: far end ${end.x},${end.z} is not the partner ${B.x},${B.z}`);
  return { A, B, length, offset, shape, cells, rails, lights, lamps, blocks, pots, side };
}

// A span of `dist` blocks (A -> B, B laterally `lat` off): one arched bridge when dist <= maxDist, otherwise two bridges with a supported
// 5 x 5 landing between them (deck, rim rail, two lamp posts and a hidden light over its middle; the openings are the bridges' own end rows). Same plan format as planBridge;
// `landing` = { x, y, z (centre deck cell), dir, d1, d2 } and the pier (plan.pier, see planPier) is added by realize() in village_planner.js.
export const planSpan = (...a) => drive(planSpanGen(...a));
export function* planSpanGen(A, B, dist, lat, side = false, sideA = false) {
  if (dist <= LOOP.maxDist) return yield* planBridgeGen(A, B, dist + 1, lat, side, sideA);
  const d = A.dir, ex = [d[1], -d[0]], N = LOOP.landing, span = N - 1;
  const d1 = Math.floor((dist - span) / 2), d2 = dist - span - d1, l = Math.trunc(lat / 2);
  const cell = (k, o) => ({ x: A.x + d[0] * k + ex[0] * o, y: A.y, z: A.z + d[1] * k + ex[1] * o });
  const p1 = yield* planBridgeGen(A, cell(d1, l), d1 + 1, l, true, sideA);
  const p2 = yield* planBridgeGen({ ...cell(d1 + span, l), dir: d }, B, d2 + 1, lat - l, side);
  const cells = [], rails = new Map(), lights = [], lamps = [], blocks = [], pots = [], h = (N - 1) / 2;
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
  for (const o of [-h, h]) lamps.push({ ...cell(d1 + Math.floor(N / 2), l + o), y: A.y + 3, row: d1 + Math.floor(N / 2) }); // lamp posts on the middle rim posts of the two closed sides
  for (const [k, o] of [[0, -h], [N - 1, h]]) lights.push({ ...cell(d1 + k, l + o), y: A.y + 3, row: d1 + k }); // hidden lights two cells over two diagonal corner posts of the landing (every walk cell within 8 steps; not on the posts' tops: the bridges' step posts stand there)
  const shift = (r, n) => ({ ...r, row: r.row + n });
  for (const c of p1.cells) cells.push(c);
  for (const r of p1.rails) addRail(r);
  for (const l1 of p1.lights) lights.push(l1);
  for (const l1 of p1.lamps) lamps.push(l1);
  for (const b of p1.blocks) blocks.push(b);
  for (const q of p1.pots) pots.push(q);
  for (const c of p2.cells) cells.push(shift(c, d1 + span));
  for (const r of p2.rails) addRail(shift(r, d1 + span));
  for (const l2 of p2.lights) lights.push(shift(l2, d1 + span));
  for (const l2 of p2.lamps) lamps.push(shift(l2, d1 + span));
  for (const b of p2.blocks) blocks.push(b);
  for (const q of p2.pots) pots.push(shift(q, d1 + span));
  const c0 = cell(d1 + Math.floor(N / 2), l);
  return { A, B, length: dist + 1, offset: lat, shape: null, cells, rails: [...rails.values()], lights, lamps, blocks, pots, side, landing: { x: c0.x, y: c0.y, z: c0.z, dir: d, d1, d2 }, pier: [] };
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

// Everything the bridge writes: Map "x,y,z" -> { id, states? }. Later entries win (rails, hidden lights and lamp posts replace headroom air).
export function finalBlocks(plan) {
  const out = new Map(), k = (c) => `${c.x},${c.y},${c.z}`;
  const KIND = { plank: { id: PLANKS }, slab_bottom: { id: SLAB, states: { "minecraft:vertical_half": "bottom" } }, slab_top: { id: SLAB, states: { "minecraft:vertical_half": "top" } }, air: { id: "minecraft:air" } };
  for (const c of plan.cells) out.set(k(c), KIND[c.kind]);
  for (const b of plan.pier ?? []) out.set(k(b), { id: b.id, states: b.states });
  for (const r of plan.rails) out.set(k(r), { id: FENCE, states: r.states });
  for (const l of plan.lights ?? []) out.set(k(l), { id: HIDDEN_LIGHT, states: {} }); // the safety light: invisible
  for (const l of plan.lamps ?? []) { // lamp posts: a fence on the rail post below, the lantern on top
    out.set(`${l.x},${l.y - 1},${l.z}`, { id: FENCE, states: { "minecraft:connection_north": false, "minecraft:connection_south": false, "minecraft:connection_west": false, "minecraft:connection_east": false } });
    out.set(k(l), { id: l.id ?? LANTERN, states: { "minecraft:block_face": "up" } });
  }
  for (const q of plan.pots ?? []) out.set(k(q), { id: "minecraft:decorated_pot", states: {} }); // a pot on the rail post beside a lamp post (a decorated pot: a flower pot needs block entity data; unverified in game)
  for (const b of plan.blocks ?? []) out.set(k(b), { id: b.id, states: b.states }); // gate arch parts and repairs (village_repair.js): free-form blocks
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
    if (!isPlank(at(x + a[0] * o, y, z + a[1] * o)) || !isRailPost(at(x + a[0] * o, y + 1, z + a[1] * o))) return false;
    const fx = x - d[0] + a[0] * o, fz = z - d[1] + a[1] * o;
    if (isPlank(at(fx, y, fz)) || at(fx, y, fz) === SLAB) return false; // a rail inside a deck, not on its rim
  }
  for (const k of [1, 2]) {
    for (let o = -2; o <= 2; o++) {
      const bx = x + d[0] * k + a[0] * o, bz = z + d[1] * k + a[1] * o;
      if (!isPlank(at(bx, y, bz))) return false;
      if (Math.abs(o) <= 1 && !(isAir(at(bx, y + 1, bz)) && isAir(at(bx, y + 2, bz)))) return false;
    }
  }
  return true;
}
// ---- F1: a side as the START of a bridge ---------------------------------------------------------------------------------------------
// A side marker sits on a rim deck cell of a platform. -> the rim cell (within LOOP.sideSearch cells along the rim, nearest first) where
// sideTarget holds for a bridge heading INTO the platform, as an exit-like start { x, y, z, dir (outward), side: true }, or null.
export function sideStarts(at, x, y, z) {
  if (!isPlank(at(x, y, z)) || at(x, y + 1, z) !== FENCE) return [];
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
      for (let y = plan.A.y - 1; y <= plan.A.y + 3; y++) { const n = at(x + dx, y, z + dz); if (isPlank(n) || n === SLAB || n === FENCE) return true; }
    }
  }
  return false;
}
export const isNewKind = (sideStart, dist, offset) => sideStart || dist < LOOP.legacyMinDist || Math.abs(offset) > LOOP.legacyMaxOffset;

// ---- F4 plaza ------------------------------------------------------------------------------------------------------------------------------
const isDeck = (n) => isPlank(n) || n === SLAB;
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
export const planPlaza = (at, A, B) => drive(planPlazaGen(at, A, B));
export function* planPlazaGen(at, A, B) {
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
  const lamps = yield* plazaLanterns(at, ov, walkXZ, posts, y);
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
  return { A, B, length: dist + 1, offset: lat, shape: null, cells, rails, lights: lamps.map(([x, yy, z]) => ({ x, y: yy, z, row: 1 })), side: false, plaza: true, pier };
}
// ---- the light rule: one model for bridges, plazas and merges --------------------------------------------------------------------------------------
// Owner decision 2026-11-21 (replaces the old "light that helps most" greedy, which took 80-460 ms in one step): START from the existing emitters, find the FIRST
// walk cell below LOOP.lightTarget in a fixed scan order, place a light on the allowed candidate NEAREST to it (fewest open steps; ties: the candidate list's
// order), update the light field AROUND that one light, repeat. One round per job step; no candidate within reach of the dark cell = no plan (the callers'
// errors). A light passes through open cells and loses 1 per step (6-neighbours); it never reaches a walk cell farther than lanternLight - lightTarget steps,
// so the box needs only LIGHT_MARGIN cells round the walk cells. Levels, open flags and the queue are numeric box indexes (string keys per cell took up to ~1 s
// per long bridge in QuickJS, owner 2026-10-27). The open flags are read in prefetch steps of LIGHT_STEP.reads new cells, so no step reads more than that.
const LIGHT_IDS = [LANTERN, LANTERN_GOLD, ...Array.from({ length: 15 }, (_, i) => `minecraft:light_block_${i + 1}`)];
const LIGHT_MARGIN = 7, LIGHT_STEP = { pops: 500, reads: 64 }; // 15 (strongest emitter) - lightTarget; queue pops and fresh native reads per job step
// b = { x0, x1, y0, y1, z0, z1 }; opens(x, y, z) must not change during the fill (a placed light stands in an open cell, so it does not); at: the reader the
// open flags come from (its .size() counts the native reads of a prefetch step; optional)
function lightBox(b, opens, at) {
  const X = b.x1 - b.x0 + 1, Y = b.y1 - b.y0 + 1, Z = b.z1 - b.z0 + 1, SX = Y * Z, size = X * SX;
  const open = new Int8Array(size).fill(-1);
  const bi = (x, y, z) => ((x - b.x0) * Y + (y - b.y0)) * Z + (z - b.z0);
  const inBox = (x, y, z) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1;
  const isOpen = (j, lx, ly, lz) => (open[j] < 0 ? (open[j] = opens(b.x0 + lx, b.y0 + ly, b.z0 + lz) ? 1 : 0) : open[j]);
  const counted = at && typeof at.size === "function";
  function* prefetch() { // every open flag, a yield after LIGHT_STEP.reads fresh reads (or every 1024 cells over a reader that cannot count)
    let last = counted ? at.size() : 0, n = 0;
    for (let lx = 0, j = 0; lx < X; lx++) for (let ly = 0; ly < Y; ly++) for (let lz = 0; lz < Z; lz++, j++) {
      isOpen(j, lx, ly, lz);
      if (counted) { const s = at.size(); if (s - last >= LIGHT_STEP.reads) { last = s; yield "lightPrefetch"; } } else if (++n % 1024 === 0) yield "lightPrefetch";
    }
  }
  // raise the levels in Lv by the sources [[x, y, z, level]] (a cell keeps the higher of what it had and what arrives); a source cell holds its level whether or not it is open
  function* raise(Lv, sources) {
    const q = [];
    for (const s of sources) if (inBox(s[0], s[1], s[2])) { const j = bi(s[0], s[1], s[2]); if (Lv[j] < s[3]) { Lv[j] = s[3]; q.push(j); } }
    for (let i = 0, since = 0; i < q.length; i++) {
      const j = q[i], v = Lv[j];
      if (v <= 1) continue;
      const lx = (j / SX) | 0, r = j - lx * SX, ly = (r / Z) | 0, lz = r - ly * Z, w = v - 1;
      let nj;
      if (lx < X - 1 && Lv[(nj = j + SX)] < w && isOpen(nj, lx + 1, ly, lz)) { Lv[nj] = w; q.push(nj); }
      if (lx > 0 && Lv[(nj = j - SX)] < w && isOpen(nj, lx - 1, ly, lz)) { Lv[nj] = w; q.push(nj); }
      if (ly < Y - 1 && Lv[(nj = j + Z)] < w && isOpen(nj, lx, ly + 1, lz)) { Lv[nj] = w; q.push(nj); }
      if (ly > 0 && Lv[(nj = j - Z)] < w && isOpen(nj, lx, ly - 1, lz)) { Lv[nj] = w; q.push(nj); }
      if (lz < Z - 1 && Lv[(nj = j + 1)] < w && isOpen(nj, lx, ly, lz + 1)) { Lv[nj] = w; q.push(nj); }
      if (lz > 0 && Lv[(nj = j - 1)] < w && isOpen(nj, lx, ly, lz - 1)) { Lv[nj] = w; q.push(nj); }
      if (++since >= LIGHT_STEP.pops) { since = 0; yield "lightFlood"; }
    }
  }
  // the cell with the lowest `rank(j) >= 0` among the nearest ones to `from` through open cells, at most `reach` steps -> box index | -1
  function nearest(from, reach, rank) {
    const seen = new Uint8Array(size);
    let layer = [bi(from[0], from[1], from[2])];
    seen[layer[0]] = 1;
    for (let d = 0; d <= reach && layer.length; d++) {
      let best = -1, bestRank = Infinity;
      const next = [];
      for (const j of layer) {
        const rk = rank(j);
        if (rk >= 0 && rk < bestRank) { bestRank = rk; best = j; }
        if (d === reach) continue;
        const lx = (j / SX) | 0, r = j - lx * SX, ly = (r / Z) | 0, lz = r - ly * Z;
        let nj;
        if (lx < X - 1 && !seen[(nj = j + SX)] && isOpen(nj, lx + 1, ly, lz)) { seen[nj] = 1; next.push(nj); }
        if (lx > 0 && !seen[(nj = j - SX)] && isOpen(nj, lx - 1, ly, lz)) { seen[nj] = 1; next.push(nj); }
        if (ly < Y - 1 && !seen[(nj = j + Z)] && isOpen(nj, lx, ly + 1, lz)) { seen[nj] = 1; next.push(nj); }
        if (ly > 0 && !seen[(nj = j - Z)] && isOpen(nj, lx, ly - 1, lz)) { seen[nj] = 1; next.push(nj); }
        if (lz < Z - 1 && !seen[(nj = j + 1)] && isOpen(nj, lx, ly, lz + 1)) { seen[nj] = 1; next.push(nj); }
        if (lz > 0 && !seen[(nj = j - 1)] && isOpen(nj, lx, ly, lz - 1)) { seen[nj] = 1; next.push(nj); }
      }
      if (best >= 0) return best;
      layer = next;
    }
    return -1;
  }
  const cellOf = (j) => { const lx = (j / SX) | 0, r = j - lx * SX, ly = (r / Z) | 0; return [b.x0 + lx, b.y0 + ly, b.z0 + r - ly * Z]; };
  return { size, inBox, bi, cellOf, prefetch, raise, nearest };
}
// Light until every walk cell has lightTarget. walk: [[x, y, z]] in the fixed scan order, candidates: [[x, y, z]] (their order breaks ties), base: [[x, y, z, level]].
// -> { lights } | { dark: n } (no candidate within reach of the first dark cell; n = dark cells left) | { diverged: true } (`rounds` used up)
function* lightFill(box, { base = [], walk, candidates, canPlace, rounds }) {
  yield* box.prefetch();
  const Lv = new Int8Array(box.size), cand = new Int32Array(box.size).fill(-1), placed = new Set(), lights = [];
  candidates.forEach((p, i) => { if (box.inBox(p[0], p[1], p[2])) cand[box.bi(p[0], p[1], p[2])] = i; });
  yield* box.raise(Lv, base);
  const reach = LOOP.lanternLight - LOOP.lightTarget, usable = (j) => (cand[j] >= 0 && !placed.has(j) && canPlace(candidates[cand[j]]) ? cand[j] : -1);
  for (let cursor = 0, round = 0; ; round++) {
    while (cursor < walk.length && Lv[box.bi(walk[cursor][0], walk[cursor][1], walk[cursor][2])] >= LOOP.lightTarget) cursor++;
    if (cursor >= walk.length) return { lights };
    if (round >= rounds) return { diverged: true };
    yield "lightRound";
    const j = box.nearest(walk[cursor], reach, usable);
    if (j < 0) { let dark = 0; for (let i = cursor; i < walk.length; i++) if (Lv[box.bi(walk[i][0], walk[i][1], walk[i][2])] < LOOP.lightTarget) dark++; return { dark }; }
    placed.add(j);
    lights.push(candidates[cand[j]]);
    yield* box.raise(Lv, [[...box.cellOf(j), LOOP.lanternLight]]);
  }
}
// existing emitters in the deck band of a box: [[x, y, z, level]]. The base layer's emitter cells come from the native filtered layer query (in tiles); `ov` (the
// world after the plan under test, which can only remove an emitter) says what is still there.
function* emittersIn(at, ov, b) {
  const out = [], rect = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
  for (let y = b.y0; y <= b.y1; y++) {
    const cells = yield* layerCells(at, y, LIGHT_IDS, rect); // not `for (... of yield* ...)`: QuickJS cannot compile it (stack underflow)
    for (const [x, z] of cells) { const l = lightLevel(ov(x, y, z)); if (l > 0) out.push([x, y, z, l]); }
  }
  return out;
}
const byXZ = (p, q) => p[0] - q[0] || p[2] - q[2] || p[1] - q[1];
const lightPasses = (n) => isAir(n) || n === FENCE || n === LANTERN;
function* plazaLanterns(at, ov, walkXZ, posts, y) {
  const R = LIGHT_MARGIN, xs = [...walkXZ, ...posts].map((c) => c[0]), zs = [...walkXZ, ...posts].map((c) => c[1]);
  const b = { x0: Math.min(...xs) - R, x1: Math.max(...xs) + R, y0: y - 1, y1: y + 5, z0: Math.min(...zs) - R, z1: Math.max(...zs) + R };
  const walk = walkXZ.filter(([x, z]) => isAir(ov(x, y + 1, z)) || ov(x, y + 1, z) === LANTERN).map(([x, z]) => [x, y + 1, z]).sort(byXZ);
  const r = yield* lightFill(lightBox(b, (x, yy, z) => lightPasses(ov(x, yy, z)), at), { base: yield* emittersIn(at, ov, b), walk, candidates: posts.map(([x, z]) => [x, y + 2, z]).sort(byXZ), canPlace: (p) => isAir(ov(...p)), rounds: 40 });
  return r.lights ?? { error: r.dark ? `plaza: cannot light ${r.dark} walk cells` : "plaza: lighting did not converge" };
}

// ---- F5 L-join (owner 2026-10-09): two exits at right angles whose heading lines cross -----------------------------------------------------
// Leave A, straight bridge, a square 5 x 5 railed landing on a log pier at the crossing C = A + d*s = B + e*u, turn 90 degrees, straight bridge
// into B. Both legs are ordinary bridges (minLeg..maxDist blocks); the landing stands on a pier like the one of the long spans (planPier).
export function planLanding(C, opens) { // C = centre deck cell {x, y, z}; opens = unit vectors of the faces that carry a bridge
  const N = LOOP.landing, h = (N - 1) / 2, cells = [], ring = new Set(), lamps = [], lights = [], rails = [];
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
  // lamp posts on the middle posts of the two closed faces (the posts flanking an opening carry the bridges' step posts), a hidden light over the middle
  for (const [i, j] of [[-h, 0], [h, 0], [0, -h], [0, h]]) if (ring.has(`${i},${j}`) && lamps.length < 2) lamps.push({ x: C.x + i, y: C.y + 3, z: C.z + j, row: 1 });
  for (const [i, j] of [[-h, -h], [h, h]]) lights.push({ x: C.x + i, y: C.y + 3, z: C.z + j, row: 1 }); // hidden lights two cells over two diagonal corner posts
  return { cells, rails, lamps, lights };
}
export const planL = (...a) => drive(planLGen(...a));
export function* planLGen(A, B, s, u) {
  const d = A.dir, e = B.dir, h = (LOOP.landing - 1) / 2;
  const C = { x: A.x + d[0] * s, y: A.y, z: A.z + d[1] * s };
  if (C.x !== B.x + e[0] * u || C.z !== B.z + e[1] * u) throw new Error("planL: corner mismatch");
  const f = [-e[0], -e[1]]; // heading from the landing to B
  const near = { x: C.x - d[0] * h, y: A.y, z: C.z - d[1] * h }, far = { x: C.x + f[0] * h, y: A.y, z: C.z + f[1] * h, dir: f };
  const p1 = yield* planBridgeGen(A, near, s - h + 1, 0, true), p2 = yield* planBridgeGen(far, B, u - h + 1, 0, false, true);
  const L = planLanding(C, [[-d[0], -d[1]], f]);
  const rm = new Map();
  for (const r of [...p1.rails, ...p2.rails, ...L.rails]) {
    const k = `${r.x},${r.y},${r.z}`, cur = rm.get(k);
    if (!cur) rm.set(k, { ...r, states: { ...r.states } }); else for (const [st, v] of Object.entries(r.states)) if (v) cur.states[st] = true;
  }
  return { A, B, length: s + u + 1, offset: 0, shape: null, cells: [...p1.cells, ...p2.cells, ...L.cells], rails: [...rm.values()], lights: [...p1.lights, ...p2.lights, ...L.lights], lamps: [...p1.lamps, ...p2.lamps, ...L.lamps], blocks: [...p1.blocks, ...p2.blocks], pots: [...p1.pots, ...p2.pots],
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

// ---- lights and lamps of a bridge (the generator's hidden-light greedy, tools/village_mallorn.mjs addHiddenLights, on the bridge alone) ---------------
// planLights(shape, offset) -> { lights: [[x, y, z]], lamps: [{ x, y, z, id? }], gate: [{ x, y, z, log? }] } in shape coordinates.
//   lamps: lamp posts at both bridge ends (rows 1 and length - 2, the outer rail posts: a second fence on the rail post, y = the lantern cell on top);
//          the end rows themselves (rails of the neighbouring pieces) stay as they are.
//   gate:  on a straight bridge of >= 11 whose arch has a flat crown: the two rail posts at mid-span are lamp posts with gold lanterns (nothing hangs over or spans the walk lanes).
//   lights: hidden `light_block_14` cells (above the walk strip at deck + 3, or above rail posts) until every walk cell is >= lightTarget by them ALONE.
// Light model as in skill 11-structure-lighting: a light of 14 passes through air, void, fences and lamps, loses 1 per step, everything else stops it.
export const planLights = (shape, offset = 0) => drive(planLightsGen(shape, offset));
export function* planLightsGen(shape, offset = 0) {
  const [W, H, L] = shape.size, k = (x, y, z) => `${x},${y},${z}`;
  const g = new Map();
  for (const c of shape.cells) g.set(k(c.x, c.y, c.z), c.kind === "air" ? "a" : "s");
  for (const r of shape.rails) g.set(k(r.x, r.y, r.z), "f");
  const lamps = [], gate = [], pots = [];
  const top = (x, z) => shape.rails.filter((r) => r.x === x && r.z === z).reduce((m, r) => Math.max(m, r.y), -1);
  const lonely = (x, y, z) => ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g.get(k(x + a, y, z + b)) === "f"); // a fence with no fence beside it keeps its stored links off
  const free = (x, y, z) => g.get(k(x, y, z)) === "a";
  const lampPost = (x, z, id, dry = false) => {
    const y = top(x, z);
    if (y < 0 || !free(x, y + 1, z) || !free(x, y + 2, z) || !lonely(x, y + 1, z)) return false;
    if (dry) return true;
    g.set(k(x, y + 1, z), "f"); g.set(k(x, y + 2, z), "l");
    lamps.push({ x, y: y + 2, z, id });
    return true;
  };
  const edges = (z) => { const xs = shape.rails.filter((r) => r.z === z).map((r) => r.x); return xs.length ? [...new Set([Math.min(...xs), Math.max(...xs)])] : []; };
  for (const rows of [[1, 2, 3], [L - 2, L - 3, L - 4]]) { // each end: a lamp post on both rails, in the same row (every post has its twin), on the first row near the end where both rail posts can carry one
    let placed = false;
    for (const z of rows) if (!placed && z >= 1 && z <= L - 2) { const e = edges(z); if (e.length === 2 && e.every((x) => lampPost(x, z, undefined, true))) { for (const x of e) lampPost(x, z); placed = true; } }
    if (!placed) for (const z of rows) if (!placed && z >= 1 && z <= L - 2) for (const x of edges(z)) if (lampPost(x, z)) placed = true; // (a shape without a matching pair: one post)
  }
  if (L >= 11 && offset === 0) { // gate arch at the arch crown
    const mid = (L - 1) >> 1, e = edges(mid), xl = Math.min(...e), xr = Math.max(...e), yR = top(xl, mid);
    const flat = e.length === 2 && yR > 0 && top(xr, mid) === yR && [mid - 1, mid + 1].every((z) => top(xl, z) === yR && top(xr, z) === yR) && xr - xl === 4;
    if (flat) { lampPost(xl, mid, LANTERN_GOLD); lampPost(xr, mid, LANTERN_GOLD); } // the two rail posts at mid-span: a 2-high fence post with a gold lantern standing on top
  }
  // pots: never alone on a bridge, only on the rail post next to a lamp post: one at the foot of a lamp post at each end and one at the gate
  const potBeside = (l) => { // a decorated pot ON THE DECK at the lamp post's foot, inside the rail (a vase never stands on a fence)
    const yT = l.y - 2, cx = (Math.min(...shape.walk.map((c) => c[0])) + Math.max(...shape.walk.map((c) => c[0]))) / 2, x = l.x + (cx > l.x ? 1 : -1);
    const plank = shape.cells.some((c) => c.x === x && c.y === yT - 1 && c.z === l.z && c.kind === "plank"); // on a plank row only (a block over a half-height slab is a walk node with no headroom)
    if (plank && free(x, yT, l.z) && !lamps.some((m) => m.x === x && m.z === l.z)) { g.set(k(x, yT, l.z), "l"); pots.push({ x, y: yT, z: l.z }); }
  };
  const endNear = lamps.filter((l) => l.id === undefined && l.z <= 3), endFar = lamps.filter((l) => l.id === undefined && l.z >= L - 4);
  if (endNear[0]) potBeside(endNear[0]);
  if (endFar[0]) potBeside(endFar[0]);
  const gateLamp = lamps.find((l) => l.id !== undefined);
  if (gateLamp) potBeside(gateLamp);
  const passes = (x, y, z) => ["a", "f", "l", undefined].includes(g.get(k(x, y, z)));
  const cand = []; // candidate cells: above the middle of the walk strip at deck + 3 (the walk cell is the feet cell: + 2), then above the rail posts; never in the two end rows
  for (const c of shape.walk) if (c[2] > 0 && c[2] < L - 1) cand.push([c[0], c[1] + 2, c[2]]);
  for (const r of shape.rails) cand.push([r.x, r.y + 1, r.z]);
  const walk = shape.walk.map((c) => [c[0], c[1], c[2]]).sort((p, q) => p[2] - q[2] || p[0] - q[0] || p[1] - q[1]); // the scan runs from the first rail row to the last
  const r = yield* lightFill(lightBox({ x0: 0, x1: W - 1, y0: 0, y1: H - 1, z0: 0, z1: L - 1 }, passes), { walk, candidates: cand, canPlace: (p) => p[2] !== 0 && p[2] !== L - 1 && g.get(k(...p)) === "a", rounds: 60 });
  if (r.dark) throw new Error(`planLights: cannot light ${r.dark} walk cells`);
  if (!r.lights) throw new Error("planLights: no convergence");
  return { lights: r.lights, lamps, gate, pots };
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
const isRimCell = (at, x, y, z) => isPlank(at(x, y, z)) && at(x, y + 1, z) === FENCE;
const standCell = (at, x, y, z) => isPlank(at(x, y, z)) && isAir(at(x, y + 1, z)) && isAir(at(x, y + 2, z)); // deck with standing room
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
  const out = [], fences = yield* layerCells(at, y + 1, [FENCE], rect); // nothing is applied during this scan, so one list serves all four passes
  for (const d of [[1, 0], [0, 1]]) for (let g = 0; g <= MERGE.maxGap; g++) {
    const ok = new Set(), a = [d[1], d[0]];
    let n = 0;
    for (const [x, z] of fences) {
      if (mergePair(at, y, d, g, x, z)) ok.add(`${x},${z}`);
      if (++n % 32 === 0) yield "findMerges";
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
export const planMerge = (at, m) => drive(planMergeGen(at, m));
export function* planMergeGen(at, m) {
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
  const inner = { x0: box.x0 + 4, x1: box.x1 - 4, z0: box.z0 + 4, z1: box.z1 - 4 }, postAt = new Map(); // the rail posts of the area (fenced), by the native layer query
  const fenceCells = yield* layerCells(at, y + 1, [FENCE], inner);
  for (const [x, z] of fenceCells) if (!removed.has(K(x, z))) postAt.set(K(x, z), [x, z]);
  for (const k of added) { const [x, z] = k.split(",").map(Number); if (x >= inner.x0 && x <= inner.x1 && z >= inner.z0 && z <= inner.z1) postAt.set(k, [x, z]); }
  const posts = [...postAt.values()].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const lamps = yield* mergeLanterns(at, ovA, walk, posts, y, box);
  if (lamps.error) return lamps;
  const mid = lo + Math.floor((hi - lo + 1) / 2);
  const A = { x: P[mid][0] - d[0], y, z: P[mid][1] - d[1] }, B = { x: Q[mid][0] + d[0], y, z: Q[mid][1] + d[1] };
  return { plan: { A, B, length: n, offset: 0, shape: null, cells, rails, lights: lamps.map(([x, yy, z]) => ({ x, y: yy, z, row: 1 })), side: false, merge: true, gap: g, pier: [] } };
}
// Lanterns on post tops until every watched walk cell (the stretch + all deck cells that were lit before) is lit again (the light rule above); `at` / ovA = the world
// before / after.
function* mergeLanterns(at, ovA, walkXZ, posts, y, area) {
  const b = { ...area, y0: y - 1, y1: y + 5 }, rect = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
  const before = lightBox(b, (x, yy, z) => lightPasses(at(x, yy, z)), at), after = lightBox(b, (x, yy, z) => lightPasses(ovA(x, yy, z)), at);
  yield* before.prefetch();
  const litBefore = new Int8Array(before.size);
  yield* before.raise(litBefore, yield* emittersIn(at, at, b));
  const standing = (x, z) => isPlank(ovA(x, y, z)) && isAir(ovA(x, y + 1, z)), watch = new Map(), cell = (x, z) => watch.set(`${x},${z}`, [x, y + 1, z]);
  for (const [x, z] of walkXZ) if (standing(x, z)) cell(x, z);
  const decks = yield* layerCells(at, y, [PLANKS, HEART], rect);
  for (const [x, z] of decks) if (standing(x, z) && litBefore[before.bi(x, y + 1, z)] >= LOOP.lightTarget) cell(x, z);
  const r = yield* lightFill(after, { base: yield* emittersIn(at, ovA, b), walk: [...watch.values()].sort(byXZ), candidates: posts.map(([x, z]) => [x, y + 2, z]), canPlace: (p) => isAir(ovA(...p)), rounds: 30 });
  return r.lights ?? { error: r.dark ? `merge: cannot light ${r.dark} walk cells` : "merge: lighting did not converge" };
}
