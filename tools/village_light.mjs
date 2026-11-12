// Block light model for the Elven village pieces: emitters, light field, walk cells, hidden lights and spawn-proofing.
// Moved unchanged out of village_mallorn.mjs (LT-09 step 2); no import of village_mallorn.mjs (no cycle).
import { B } from "./flet_mallorn.mjs";
import { blockLight } from "../../../.claude/skills/bedrock-worldgen/scripts/structure_light.mjs"; // shared skill script (one implementation of the light model)
import { isPlanterPanel } from "../lothlorien_bp/scripts/planter_panels.js";

const key = (x, y, z) => `${x},${y},${z}`;
const SLAB = "lothlorien:mallorn_slab";

// ---- block light -----------------------------------------------------------------------------------------------------
// Monsters spawn at block light 0 only; the owner wants a vivid city: >= LIGHT_TARGET on every walkable cell. Visible lamps are art
// (village_dress.mjs); the safety comes from hidden `minecraft:light_block_<n>` blocks (style guide section 5, `addHiddenLights`).
// Model: every emitter of EMITTERS counts, light spreads through every block that is not a full block (LIGHT_PASS: air, void, rails, lamps,
// carpets, banners, plants, pots, candles, trapdoors, light blocks) losing 1 per step (6-neighbours), and is stopped by everything else
// (planks, slabs, stairs, logs, leaves: the safe assumption). Only sources inside the piece box count. Walk cell = the feet cell above a deck /
// slab / connector block with feet and head cell free (not a rail).
export const LANTERN_LIGHT = 14, LIGHT_TARGET = 8;
// ONE emitter table. Block-light levels of the emitters the style guide allows (mod blocks: the light_emission of their block JSON, checked by a test).
export const EMITTERS = {
  "lothlorien:elven_lantern": 14, "lothlorien:elven_lantern_heartwood": 14, "lothlorien:elven_chandelier": 15, "lothlorien:firefly_jar": 11,
  "minecraft:verdant_froglight": 15, "minecraft:pearlescent_froglight": 15, "minecraft:ochre_froglight": 15,
  "minecraft:cave_vines_body_with_berries": 14, "minecraft:cave_vines_head_with_berries": 14, "minecraft:end_rod": 14,
};
// states matter for two emitters: sea pickles (cluster_count 0..3 -> 6/9/12/15; only wet ones shine in game, the model does not look at water) and
// lit candles (3 per candle, `candles` 0..3 = 1..4 candles, `lit`). Without a state reader the safe values are used (pickle 6, candle 0 = unlit).
export const emission = (name, states) => {
  if (name === undefined) return 0;
  if (EMITTERS[name] !== undefined) return EMITTERS[name];
  const m = /^minecraft:light_block_(\d+)$/.exec(name);
  if (m) return +m[1];
  if (name === "minecraft:sea_pickle") return states?.dead_bit ? 0 : 6 + 3 * (states?.cluster_count ?? 0);
  if (/^minecraft:(.*_)?candle$/.test(name)) return states?.lit ? 3 * ((states?.candles ?? 0) + 1) : 0;
  return 0;
};
export const lightBlock = (n) => ({ name: `minecraft:light_block_${n}`, states: {} });
export const isLightBlock = (n) => /^minecraft:light_block_\d+$/.test(n ?? "");
// blocks light passes through (everything that is not a full opaque block; slabs, stairs and leaves stay blocking on purpose)
export const LIGHT_PASS = /(^|:)(air|cave_air|void_air|structure_void)$|fence$|fence_gate$|lantern|chandelier|torch|end_rod|(^|:|_)chain$|rope|ladder|carpet|banner|candle|flower_pot|decorated_pot|trapdoor|light_block|glass|pane|pale_hanging_moss|cave_vines|glow_lichen|spore_blossom|moss_carpet|leaf_litter|wildflowers|pink_petals|firefly_bush|(^|:)bush$|fern|elanor|niphredil|athelas|nectar_bloom|mallorn_blossom|sapling|lily_of_the_valley|lily_pad|flowering_azalea|sea_pickle|firefly_jar|brewing_stand|cauldron|sign/;
const clearForLight = (n) => n === undefined || LIGHT_PASS.test(n);
const STATEFUL = /^minecraft:(sea_pickle|(.*_)?candle)$/;
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inBox = (b, x, y, z) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1;
// nameAt(x, y, z) -> block name, undefined for structure void; b = { x0, x1, y0, y1, z0, z1 }; stateAt(x, y, z) -> states (optional, for candles and
// sea pickles). The flood fill itself is the shared skill script (.claude/skills/bedrock-worldgen/scripts/structure_light.mjs); this wraps it for boxes that do not start at 0.
export function lightField(nameAt, b, stateAt = null) {
  const get = (x, y, z) => {
    const n = nameAt(x + b.x0, y + b.y0, z + b.z0);
    return stateAt && n !== undefined && STATEFUL.test(n) ? `${n}#${emission(n, stateAt(x + b.x0, y + b.y0, z + b.z0))}` : n;
  };
  const sources = (v) => { if (v === undefined) return 0; const i = v.indexOf("#"); return i < 0 ? emission(v) : +v.slice(i + 1); };
  const passes = (v) => v === undefined || clearForLight(v.indexOf("#") < 0 ? v : v.slice(0, v.indexOf("#")));
  const raw = blockLight(get, [b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, b.z1 - b.z0 + 1], sources, passes);
  const L = new Map();
  for (const [k, v] of raw) { const [x, y, z] = k.split(",").map(Number); L.set(key(x + b.x0, y + b.y0, z + b.z0), v); }
  return L;
}
// blocks a walker passes through (their cells count as free for walk cells)
export const HEART_PLANKS = "lothlorien:mallorn_heartwood_planks", HEART_SLAB = "lothlorien:mallorn_heartwood_slab";
const isDeckBlock = (n) => n === B.planks || n === SLAB || n === HEART_PLANKS || n === HEART_SLAB; // the heartwood ring of the trunk is deck as well
const NO_COLLIDE = /(^|:)(air|cave_air|void_air|structure_void)$|light_block|carpet|wall_banner|pale_hanging_moss|cave_vines|glow_lichen|spore_blossom|rope/;
export function walkCells(nameAt, b, stateAt = null) {
  const cells = [], free = (n) => n === undefined || NO_COLLIDE.test(n);
  const get=(x,y,z)=>({name:nameAt(x,y,z),states:stateAt?.(x,y,z)});
  const open=(x,y,z)=>free(nameAt(x,y,z)) || isPlanterPanel(get,x,y,z);
  for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y < b.y1 - 1; y++) for (let z = b.z0; z <= b.z1; z++) {
    const n = nameAt(x, y, z);
    if (!isDeckBlock(n) && n !== "minecraft:jigsaw") continue;
    if (open(x,y+1,z) && open(x,y+2,z)) cells.push([x,y+1,z]);
  }
  return cells;
}
export function worstLight(nameAt, b, stateAt = null) {
  const L = lightField(nameAt, b, stateAt), cells = walkCells(nameAt, b, stateAt);
  let worst = 99, at = null;
  for (const c of cells) { const l = L.get(key(...c)) ?? 0; if (l < worst) { worst = l; at = c; } }
  return { worst, at, cells: cells.length };
}
// ---- typed light grid (exact, fast) ------------------------------------------------------------------------------------------------
// Why the greedy below may update its field incrementally and stay byte-identical to the flood fill of `lightField`: the field is the maximum over
// all sources of (source level - path length through passing cells), which is unique whatever the order of the flood. A hidden light only ever
// replaces air or void, and all three pass light, so passability, the reach sets and the per-source decomposition never change while it runs
// (addHiddenLights throws if that ever stops holding). Box-indexed Uint8Array, 6-neighbour steps, no Map or string keys.
// makeGrid(nameAt, b, stateAt) -> { size, bi(x,y,z), nb(j,dir), pass, fullField(), raise(L,j,level) }; fullField() reads the emitters now.
function makeGrid(nameAt, b, stateAt) {
  const X = b.x1 - b.x0 + 1, Y = b.y1 - b.y0 + 1, Z = b.z1 - b.z0 + 1, size = X * Y * Z;
  const bi = (x, y, z) => ((x - b.x0) * Y + (y - b.y0)) * Z + (z - b.z0);
  const pass = new Uint8Array(size), passMemo = new Map();
  const passes = (n) => { if (n === undefined) return 1; let v = passMemo.get(n); if (v === undefined) passMemo.set(n, (v = LIGHT_PASS.test(n) ? 1 : 0)); return v; };
  for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) pass[bi(x, y, z)] = passes(nameAt(x, y, z));
  const STEP = [Y * Z, -Y * Z, Z, -Z, 1, -1];
  const nb = (j, d) => { // neighbour index or -1 outside the box
    const z = j % Z, y = ((j - z) / Z) % Y, x = (j - z - y * Z) / (Y * Z);
    if (d === 0 ? x + 1 >= X : d === 1 ? x === 0 : d === 2 ? y + 1 >= Y : d === 3 ? y === 0 : d === 4 ? z + 1 >= Z : z === 0) return -1;
    return j + STEP[d];
  };
  const q = new Int32Array(size * 16); // every cell is queued at most 15 times (levels 14..0) plus once as a source
  const relax = (L, n0, n) => { // max-propagation from the queued cells q[n0..n)
    for (let i = n0; i < n; i++) {
      const j = q[i], l = L[j];
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) { const k = nb(j, d); if (k < 0 || L[k] >= l - 1 || !pass[k]) continue; L[k] = l - 1; q[n++] = k; }
    }
  };
  const emitOf = (x, y, z) => { const n = nameAt(x, y, z); if (n === undefined) return 0; return STATEFUL.test(n) ? emission(n, stateAt?.(x, y, z)) : emission(n); };
  const fullField = () => {
    const L = new Uint8Array(size); let n = 0;
    for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) { const e = emitOf(x, y, z); if (e > 0) { const j = bi(x, y, z); L[j] = e; q[n++] = j; } }
    relax(L, 0, n);
    return L;
  };
  const raise = (L, j, level) => { if (L[j] >= level) return; L[j] = level; q[0] = j; relax(L, 0, 1); };
  return { size, bi, nb, pass, fullField, raise };
}
// Typed twin of lightField (same model, same inputs): { L: Uint8Array, bi } with L[bi(x, y, z)] = block light of the world cell. A test ties it to lightField.
export function lightGrid(nameAt, b, stateAt = null) {
  const g = makeGrid(nameAt, b, stateAt);
  return { L: g.fullField(), bi: g.bi };
}

// Hidden lights (style guide section 5; replaces the old visible lantern greedy). Greedy: the air cell that lights most still-dark walk cells gets a
// `light_block_15`; candidates are the cells at deck + 3 over walk cells and the air / void cells right under a deck edge (never in `avoid`, never
// outside the box). When every walk cell is >= LIGHT_TARGET each placed light is lowered as far as the target still holds (a light that is not needed
// any more is removed). Call it AFTER all dressing: visible lamps and every other emitter already count. -> [{ x, y, z, level }] of the lights kept.
export function addHiddenLights(blocks, b, avoid = () => false, { target = LIGHT_TARGET, visible = true } = {}) {
  const nameAt = (x, y, z) => blocks.get(key(x, y, z))?.name;
  const lightAt = (x, y, z) => { const n = nameAt(x, y, z); return !visible && n !== undefined && (EMITTERS[n] !== undefined || STATEFUL.test(n)) ? "minecraft:air" : n; };
  const stateAt = (x, y, z) => blocks.get(key(x, y, z))?.states;
  const ok = (x, y, z) => inBox(b, x, y, z) && !avoid(x, y, z);
  const cells = walkCells(lightAt, b, stateAt);
  const cand = [], seenCand = new Set();
  const addCand = (x, y, z) => { const k = key(x, y, z); if (!seenCand.has(k) && ok(x, y, z)) { seenCand.add(k); cand.push([x, y, z]); } };
  for (const [x, y, z] of cells) if (nameAt(x, y + 2, z) === "minecraft:air") addCand(x, y + 2, z);
  for (const [x, y, z] of cells) {
    const dy = y - 1;
    for (const h of [1, 2]) {
      const cy = dy - h, n = nameAt(x, cy, z);
      if (n !== undefined && n !== "minecraft:air") break;
      if (H4.some(([dx, dz]) => !isDeckBlock(nameAt(x + dx, dy, z + dz)))) addCand(x, cy, z);
    }
  }
  const { size, bi, nb, pass, fullField, raise } = makeGrid(lightAt, b, stateAt);
  const walk = cells.map(([x, y, z]) => bi(x, y, z));
  const R = 15 - target;
  const reachCache = new Map();
  const reachOf = (c) => { // box indexes within R steps through passing cells (the candidate itself included, as gain() did)
    const j0 = bi(c[0], c[1], c[2]);
    let out = reachCache.get(j0);
    if (out) return out;
    const dist = new Map([[j0, 0]]); out = [j0];
    for (let i = 0; i < out.length; i++) {
      const j = out[i], dj = dist.get(j);
      if (dj >= R) continue;
      for (let d = 0; d < 6; d++) { const k = nb(j, d); if (k < 0 || dist.has(k) || !pass[k]) continue; dist.set(k, dj + 1); out.push(k); }
    }
    reachCache.set(j0, out);
    return out;
  };
  const lights = [];
  const L = fullField(), dark = new Uint8Array(size);
  for (let guard = 0; guard < 80; guard++) {
    dark.fill(0); let nDark = 0, firstDark = -1;
    for (const j of walk) if (L[j] < target && !dark[j]) { dark[j] = 1; nDark++; if (firstDark < 0) firstDark = j; }
    if (!nDark) break;
    let best = null, bg = 0;
    for (const c of cand) {
      const n = nameAt(c[0], c[1], c[2]);
      if (n !== undefined && n !== "minecraft:air") continue;
      let g = 0; for (const j of reachOf(c)) g += dark[j];
      if (g > bg) { bg = g; best = c; }
    }
    if (!best) throw new Error(`cannot light ${nDark} walk cells with hidden lights`);
    if (!pass[bi(best[0], best[1], best[2])]) throw new Error("addHiddenLights: a hidden light would replace a blocking cell");
    lights.push({ x: best[0], y: best[1], z: best[2], level: 15, orig: blocks.get(key(...best)) });
    blocks.set(key(...best), lightBlock(15));
    raise(L, bi(best[0], best[1], best[2]), 15);
  }
  if (walk.some((j) => L[j] < target)) throw new Error("addHiddenLights: no convergence");
  for (const l of lights) {
    const k = key(l.x, l.y, l.z), put = (v) => (v ? blocks.set(k, lightBlock(v)) : l.orig ? blocks.set(k, l.orig) : blocks.delete(k));
    put(0);
    const F = fullField(); // every other source at its current level
    const j0 = bi(l.x, l.y, l.z), dist = new Int16Array(size).fill(-1); dist[j0] = 0; const order = [j0];
    for (let i = 0; i < order.length; i++) { const j = order[i]; if (dist[j] >= 14) continue; for (let d = 0; d < 6; d++) { const kk = nb(j, d); if (kk < 0 || dist[kk] >= 0 || !pass[kk]) continue; dist[kk] = dist[j] + 1; order.push(kk); } }
    const holds = (v) => { for (const j of walk) { const own = dist[j] >= 0 ? v - dist[j] : 0; if (Math.max(F[j], own) < target) return false; } return true; };
    let lo = 0, hi = 15;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (holds(mid)) hi = mid; else lo = mid + 1; }
    l.level = lo;
    put(lo);
  }
  return lights.filter((l) => l.level > 0).map(({ x, y, z, level }) => ({ x, y, z, level }));
}

// ---- spawn-proofing (owner 2026-10-16: a zombie in a village) ---------------------------------------------------------------------------------------------------------
// Hostile mobs spawn on a full solid top with two clear cells above where the block light is 0. The walk rule covers deck cells only; this covers every spawnable surface inside
// a piece box (crown branches, root flares, pillars, trunk tops...): block light >= 1 by the same flood fill. Not spawnable: leaves, slabs, stairs, fences, glass, carpets, plants,
// lamps, pots, cloth, light blocks, beds, cushions (the audit list of temp/village_style/spawn/spawn_audit.mjs).
export const NO_SPAWN = /leaves|fence|slab|stairs|glass|carpet|lantern|rope|banner|pot|candle|trapdoor|jigsaw|light_block|air|void|water|chandelier|jar|cauldron|brewing|lectern|moss_carpet|flower|fern|elanor|niphredil|athelas|bush|cushion|bed|chest|vine|moss$|spore|sapling|lily|pickle|sign|ladder/;
const clearAbove = (n) => n === null || n === undefined || /(^|:)(air|cave_air|void_air|structure_void)$|light_block/.test(n); // (anchored: "stairs" contains "air")
// -> [[x, y, z]] cells above the dark surfaces (y >= b.y0; the top two layers of the box are skipped: unknown above)
export function darkSpawnCells(nameAt, stateAt, b, L = null) {
  const field = L ?? lightField(nameAt, b, stateAt), out = [];
  for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) for (let y = b.y0; y <= b.y1 - 2; y++) {
    const n = nameAt(x, y, z);
    if (!n || NO_SPAWN.test(n) || !clearAbove(nameAt(x, y + 1, z)) || !clearAbove(nameAt(x, y + 2, z))) continue;
    if ((field.get(key(x, y + 1, z)) ?? 0) < 1) out.push([x, y + 1, z]);
  }
  return out;
}
// Greedy like addHiddenLights: the air cell above a dark surface that lights most dark surfaces within 7 steps gets a `light_block_8`; then every light is lowered as far as every
// surface still holds >= 1. -> the lights placed [{ x, y, z, level }]
export function addSpawnLights(blocks, b) {
  const nameAt = (x, y, z) => blocks.get(key(x, y, z))?.name, stateAt = (x, y, z) => blocks.get(key(x, y, z))?.states;
  const lights = [];
  for (let guard = 0; guard < 600; guard++) {
    const dark = darkSpawnCells(nameAt, stateAt, b);
    if (!dark.length) break;
    const darkSet = new Set(dark.map((c) => key(...c)));
    let best = null, bg = 0;
    for (const c of dark.slice(0, 400)) {
      if (!(nameAt(...c) === undefined || nameAt(...c) === "minecraft:air")) continue;
      const seen = new Map([[key(...c), 0]]), q = [c];
      let n = 0;
      for (let i = 0; i < q.length; i++) {
        const [cx, cy, cz] = q[i], d = seen.get(key(cx, cy, cz));
        if (darkSet.has(key(cx, cy, cz))) n++;
        if (d >= 7) continue;
        for (const [dx, dy, dz] of N6) { const nx = cx + dx, ny = cy + dy, nz = cz + dz, nk = key(nx, ny, nz); if (!seen.has(nk) && inBox(b, nx, ny, nz) && clearForLight(nameAt(nx, ny, nz))) { seen.set(nk, d + 1); q.push([nx, ny, nz]); } }
      }
      if (n > bg) { bg = n; best = c; }
    }
    if (!best) { best = dark.find((c) => nameAt(...c) === undefined || nameAt(...c) === "minecraft:air"); if (!best) throw new Error(`cannot spawn-proof the surface under ${dark[0]}`); }
    blocks.set(key(...best), lightBlock(8)); lights.push({ x: best[0], y: best[1], z: best[2], level: 8, orig: undefined });
  }
  const ok = () => !darkSpawnCells(nameAt, stateAt, b).length;
  for (const l of lights) { // the lowest level that still holds
    let lo = 1, hi = 8;
    while (lo < hi) { const mid = (lo + hi) >> 1; blocks.set(key(l.x, l.y, l.z), lightBlock(mid)); if (ok()) hi = mid; else lo = mid + 1; }
    blocks.set(key(l.x, l.y, l.z), lightBlock(lo)); l.level = lo;
  }
  return lights.map(({ x, y, z, level }) => ({ x, y, z, level }));
}
