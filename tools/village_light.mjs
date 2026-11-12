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
// Hidden lights (style guide section 5; replaces the old visible lantern greedy). Greedy: the air cell that lights most still-dark walk cells gets a
// `light_block_15`; candidates are the cells at deck + 3 over walk cells and the air / void cells right under a deck edge (never in `avoid`, never
// outside the box). When every walk cell is >= LIGHT_TARGET each placed light is lowered as far as the target still holds (a light that is not needed
// any more is removed). Call it AFTER all dressing: visible lamps and every other emitter already count. -> [{ x, y, z, level }] of the lights kept.
export function addHiddenLights(blocks, b, avoid = () => false, { target = LIGHT_TARGET, visible = true } = {}) {
  // Count the real lamps; hidden light only fills gaps. `visible:false` remains available for isolated safety-light probes.
  const nameAt = (x, y, z) => blocks.get(key(x, y, z))?.name;
  const lightAt = (x, y, z) => { const n = nameAt(x, y, z); return !visible && n !== undefined && (EMITTERS[n] !== undefined || STATEFUL.test(n)) ? "minecraft:air" : n; }; // what the light model sees: visible emitters (lamps, jars, berries, candles) are art and do not count
  const stateAt = (x, y, z) => blocks.get(key(x, y, z))?.states;
  const ok = (x, y, z) => inBox(b, x, y, z) && !avoid(x, y, z);
  const cells = walkCells(lightAt, b, stateAt); // include the center lanes beside moss-mounted skirts
  const cand = [], seenCand = new Set();
  const addCand = (x, y, z) => { const k = key(x, y, z); if (!seenCand.has(k) && ok(x, y, z)) { seenCand.add(k); cand.push([x, y, z]); } };
  for (const [x, y, z] of cells) if (nameAt(x, y + 2, z) === "minecraft:air") addCand(x, y + 2, z); // deck + 3
  const isDeck = isDeckBlock;
  for (const [x, y, z] of cells) { // under the deck, where the deck ends within one cell (void or air)
    const dy = y - 1; // the deck block
    for (const h of [1, 2]) {
      const cy = dy - h, n = nameAt(x, cy, z);
      if (n !== undefined && n !== "minecraft:air") break;
      if (H4.some(([dx, dz]) => !isDeck(nameAt(x + dx, dy, z + dz)))) addCand(x, cy, z);
    }
  }
  const lights = [];
  const field = () => lightField(lightAt, b, stateAt);
  for (let guard = 0; guard < 80; guard++) {
    const L = field();
    const dark = new Set(cells.filter((c) => (L.get(key(...c)) ?? 0) < target).map((c) => key(...c)));
    if (!dark.size) break;
    const R = 15 - target; // a level-15 light reaches the target within R steps
    const gain = (x, y, z) => {
      const seen = new Map([[key(x, y, z), 0]]), q = [[x, y, z]];
      let n = 0;
      for (let i = 0; i < q.length; i++) {
        const [cx, cy, cz] = q[i], d = seen.get(key(cx, cy, cz));
        if (dark.has(key(cx, cy, cz))) n++;
        if (d >= R) continue;
        for (const [dx, dy, dz] of N6) {
          const nx = cx + dx, ny = cy + dy, nz = cz + dz, nk = key(nx, ny, nz);
          if (!seen.has(nk) && inBox(b, nx, ny, nz) && clearForLight(lightAt(nx, ny, nz))) { seen.set(nk, d + 1); q.push([nx, ny, nz]); }
        }
      }
      return n;
    };
    let best = null, bg = 0;
    for (const [x, y, z] of cand) {
      const n = nameAt(x, y, z);
      if (n !== undefined && n !== "minecraft:air") continue;
      const g = gain(x, y, z);
      if (g > bg) { bg = g; best = [x, y, z]; }
    }
    if (!best) throw new Error(`cannot light ${dark.size} walk cells with hidden lights, e.g. ${[...dark][0]} (${[...dark].slice(0, 8).join(" ")}; below ${nameAt(...[...dark][0].split(",").map(Number).map((v, i) => (i === 1 ? v - 1 : v)))}; here ${nameAt(...[...dark][0].split(",").map(Number))})`);
    lights.push({ x: best[0], y: best[1], z: best[2], level: 15, orig: blocks.get(key(...best)) });
    blocks.set(key(...best), lightBlock(15));
  }
  if (cells.some((c) => (field().get(key(...c)) ?? 0) < target)) throw new Error("addHiddenLights: no convergence");
  // lower every light as far as the target holds (binary search per light: light is monotone in the level); a light that is not needed is removed
  const worstNow = () => { const L = field(); let w = 99; for (const c of cells) w = Math.min(w, L.get(key(...c)) ?? 0); return w; };
  for (const l of lights) {
    const k = key(l.x, l.y, l.z), put = (v) => (v ? blocks.set(k, lightBlock(v)) : l.orig ? blocks.set(k, l.orig) : blocks.delete(k)); // 0 = give the cell back as it was
    let lo = 0, hi = 15; // smallest level (0 = removed) that keeps the target
    while (lo < hi) { const mid = (lo + hi) >> 1; put(mid); if (worstNow() >= target) hi = mid; else lo = mid + 1; }
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
