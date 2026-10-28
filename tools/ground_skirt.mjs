// Soil under and round a small woodland build (flower garden, memorial). Owner, Test G 2026-10-20: two soil layers were not enough on
// slopes and a garden in a lake was flooded, and the build should not read as a perfect square when the ground is uneven. Native jigsaw
// placement cannot reject a site, so the build carries its own ground: DEPTH layers under the footprint (grass on top), then a ragged
// shoulder - most cells of the first ring one step lower, some cells of the second ring two steps lower. On flat ground the shoulder lies
// in or under the terrain; on a downhill side it fills the gap and steps down. Structure void everywhere else (the terrain stays).
export const SKIRT = Object.freeze({ depth: 6, ring1: 0.8, ring2: 0.4 });

const hash = (x, z, i) => { let h = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ Math.imul(i + 1, 83492791)) >>> 0; h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], N4 = N8.slice(0, 4);

// put(x, y, z, name), has(x, y, z); footprint: Set of "x,z" whose grass the caller laid at `top`. Never overwrites a cell the caller wrote.
// Options: depth (soil layers incl. the grass row, default SKIRT.depth), ring1 (share of first-ring cells laid, 0 = no shoulder),
// ring2 (false drops the second ring). -> { ring1: [[x, z]], ring2: [[x, z]] } (the shoulder cells laid)
export function addSoilSkirt(put, has, footprint, { top = -1, seed = 0, depth = SKIRT.depth, ring1: share1 = SKIRT.ring1, ring2: second = true } = {}) {
  const lay = (x, z, grass) => {
    if (!has(x, grass, z)) put(x, grass, z, "minecraft:grass_block");
    for (let y = grass - 1; y > top - depth; y--) if (!has(x, y, z)) put(x, y, z, "minecraft:dirt");
  };
  const cells = [...footprint].map((k) => k.split(",").map(Number));
  for (const [x, z] of cells) for (let y = top - 1; y > top - depth; y--) if (!has(x, y, z)) put(x, y, z, "minecraft:dirt");
  const ring = (inner, skip) => {
    const out = new Map();
    for (const [x, z] of inner) for (const [a, b] of N8) { const k = `${x + a},${z + b}`; if (!skip.has(k)) out.set(k, [x + a, z + b]); }
    return [...out.values()];
  };
  const ring1 = ring(cells, footprint).filter(([x, z]) => hash(x, z, seed) < share1);
  const r1 = new Set(ring1.map(([x, z]) => `${x},${z}`));
  for (const [x, z] of ring1) lay(x, z, top - 1);
  const ring2 = ring(ring1, new Set([...footprint, ...ring(cells, footprint).map(([x, z]) => `${x},${z}`)]))
    .filter(([x, z]) => second && N4.some(([a, b]) => r1.has(`${x + a},${z + b}`)) && hash(x, z, seed + 1) < SKIRT.ring2);
  for (const [x, z] of ring2) lay(x, z, top - 2);
  return { ring1, ring2 };
}
