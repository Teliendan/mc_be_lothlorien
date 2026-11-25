// Swan rules (mobs/swan.md). Pure (no @minecraft/server) so tests/run.mjs can check them offline; swan.js wires them to the game.
//
// The swan's spawn rule accepts the Lothlorien biome tag OR the river tag (rivers are their own biome, so a spawn filter
// on Lothlorien alone would never see the Nimrodel). Rivers all over the world pass that filter, so each natural spawn is
// judged once: it stays only if Lothlorien lies within NEAR_RADII of it (swan.js removes the rest before anyone sees it).

import { SWAN_ID } from "./ids.js";
export { SWAN_ID };

export const NEAR_RADII = [16, 32, 48];
export const NEAR_HEADINGS = 8;

// Sample offsets {dx, dz}: the spot itself, then NEAR_HEADINGS headings on each ring.
export function nearOffsets() {
  const out = [{ dx: 0, dz: 0 }];
  for (const r of NEAR_RADII) {
    for (let k = 0; k < NEAR_HEADINGS; k++) {
      const a = (2 * Math.PI * k) / NEAR_HEADINGS;
      out.push({ dx: Math.round(Math.cos(a) * r), dz: Math.round(Math.sin(a) * r) });
    }
  }
  return out;
}

// sample(dx, dz) -> biome id at that offset (undefined = unloaded). True when any sample is the Lothlorien biome.
export function nearBiome(sample, biomeId) {
  return nearOffsets().some(({ dx, dz }) => sample(dx, dz) === biomeId);
}

// Natural-spawn surface rule. The spawn rule is the fish pattern (any depth of water), so a natural swan can start
// submerged or under a bank. typeAt(blockY) -> typeId of the block at the swan's x,z (undefined = unloaded).
// Returns {action: "keep"} (not in water), {action: "keep", y} (already at the open surface, top water block y),
// {action: "move", y} (open water above it: float at the top water block y) or {action: "remove"} (the top water block has a
// bank or anything else overhead).
// ASSUMPTION (in-game check): a swimming swan has floor(location.y) == the top water block, or the air block just above it.
export const WATER_TYPES = ["minecraft:water", "minecraft:flowing_water"];
export const WATER_SCAN_MAX = 16;

export function surfaceAction(locationY, typeAt) {
  const isWater = y => WATER_TYPES.includes(typeAt(y));
  const fy = Math.floor(locationY);
  let top = isWater(fy) ? fy : isWater(fy - 1) ? fy - 1 : null;
  if (top === null) return { action: "keep" };
  for (let i = 0; i < WATER_SCAN_MAX && isWater(top + 1); i++) top++;
  if (typeAt(top + 1) !== "minecraft:air" || typeAt(top + 2) !== "minecraft:air") return { action: "remove" };
  if (fy === top || fy === top + 1) return { action: "keep", y: top };
  return { action: "move", y: top };
}

// Swans live on lakes and rivers, not in small vessels (owner 2026-11-25: swans spawned in the village basins up in the
// trees). A natural swan stays only where at least MIN_OPEN_WATER open surface cells (water with air above, 4-connected,
// on the swan's surface layer) join its own. Village water is far smaller (Court basin 6 sources, Hall trough about 6,
// stair basins 1); a player's pond smaller than 4x4 gets no natural swans either (eggs, summons, breeding still work).
// isOpen(dx, dz) -> true when the cell at that offset on the surface layer is open water (unloaded = false).
// Returns the count found, stopping at MIN_OPEN_WATER (at most about 4 * MIN_OPEN_WATER isOpen calls, once per spawn).
export const MIN_OPEN_WATER = 16;

export function openWaterArea(isOpen) {
  const seen = new Set(["0,0"]), queue = [[0, 0]];
  let count = 0;
  while (queue.length && count < MIN_OPEN_WATER) {
    const [dx, dz] = queue.shift();
    count++;
    for (const [nx, nz] of [[dx + 1, dz], [dx - 1, dz], [dx, dz + 1], [dx, dz - 1]]) {
      const k = `${nx},${nz}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (isOpen(nx, nz)) queue.push([nx, nz]);
    }
  }
  return count;
}
