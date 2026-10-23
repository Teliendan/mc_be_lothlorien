// Pure: Western Corn growth rules (tests/run.mjs imports this).
export const MAX_GROWTH = 7;

// Preserve approved baseline rates at uncrowded fertility10 wet/4 dry;
// wheat-like soil layout/crowding reduces packed corn's growth probability.
// These are random-tick probabilities, not verified real-time growth durations.
// Highest possible result (dry centre cell, all eight neighbours wet farmland): lets the caller roll before reading the 3x3.
export const MAX_GROW_CHANCE = 0.4;
export function growChance(light, moisture, layout = moisture > 0 ? 10 : 4) {
  let base = Math.min(1, (moisture > 0 ? 1 / 3 : 1 / 5) * layout / (moisture > 0 ? 10 : 4));
  if (light >= 9) return base;
  if (light >= 6) return base * 0.6;
  if (light >= 4) return base * 0.3;
  return 0;
}

export const CORN_ORIGIN = "lothlorien:wild";
export const WILD_SOILS = ["minecraft:farmland", "minecraft:grass_block", "minecraft:dirt", "minecraft:podzol"];
export function cornSoilAllowed(wild, soil) {
  return wild === true ? WILD_SOILS.includes(soil) : soil === "minecraft:farmland";
}

// The caller supplies bounded safe reads; unknown cells postpone this tick.
export function cropLayout(readSoil, readCrop) {
  let score = 1;
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
    const soil = readSoil(x, z);
    if (!soil) return 0;
    if (soil.typeId !== "minecraft:farmland") continue;
    const value = (soil.permutation.getState("moisturized_amount") ?? 0) > 0 ? 3 : 1;
    score += x === 0 && z === 0 ? value : value / 4;
  }
  const neighbours = [];
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
    if (!x && !z) continue;
    const crop = readCrop(x, z); if (!crop) return 0;
    if (crop.typeId === "lothlorien:western_corn") neighbours.push([x, z]);
  }
  if (neighbours.some(([x, z]) => x && z) ||
      (neighbours.some(([x, z]) => x && !z) && neighbours.some(([x, z]) => !x && z))) score /= 2;
  return score;
}

// Bone meal advances 2 to 5 stages (vanilla wheat); r in [0, 1).
export function bonemealSteps(r) {
  return 2 + Math.floor(r * 4);
}

export function advanceGrowth(growth, steps) {
  return Math.min(MAX_GROWTH, growth + steps);
}
