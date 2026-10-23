import { system } from "@minecraft/server";
import { MAX_GROWTH, MAX_GROW_CHANCE, advanceGrowth, bonemealSteps, growChance, cropLayout, CORN_ORIGIN, cornSoilAllowed } from "./crop_rules.js";
import { readBlock } from "./deferred_use.js";

// Phase 7: Western Corn. `lothlorien:crop` (random tick) advances the state lothlorien:growth 0-7 on farmland;
// wild corn from worldgen stands on grass at growth 7 and never needs to grow. Seeds only place on farmland
// (`block_placer.use_on`). Harvest drops come from the loot tables (the mature one is set by a permutation).
export const CROP = "lothlorien:western_corn";
const GROWTH = "lothlorien:growth";
const FARMLAND = "minecraft:farmland";

export function growthOf(block) {
  const g = block.permutation.getState(GROWTH);
  return typeof g === "number" ? g : MAX_GROWTH;
}

export function isMature(block) {
  return growthOf(block) >= MAX_GROWTH;
}

// Bone meal: 2-5 stages, like vanilla wheat.
export function growCrop(block) {
  if (!validCropSoil(block)) return;
  const g = growthOf(block);
  if (g >= MAX_GROWTH) return;
  block.setPermutation(block.permutation.withState(GROWTH, advanceGrowth(g, bonemealSteps(Math.random()))));
}

export function validCropSoil(block) {
  const { x, y, z } = block.location;
  return cornSoilAllowed(block.permutation.getState(CORN_ORIGIN), readBlock(block.dimension, { x, y: y - 1, z })?.typeId);
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:crop", {
    onRandomTick({ block }) {
      const g = growthOf(block);
      const roll = Math.random();
      if (g >= MAX_GROWTH || roll >= MAX_GROW_CHANCE) return;
      const { x, y, z } = block.location;
      const soil = readBlock(block.dimension, { x, y: y - 1, z });
      if (soil?.typeId !== FARMLAND) return; // grows only when farmed
      const moisture = soil.permutation.getState("moisturized_amount");
      const light = block.getLightLevel();
      if (light < 4) return;
      const layout = cropLayout((dx, dz) => readBlock(block.dimension, { x: x + dx, y: y - 1, z: z + dz }),
        (dx, dz) => readBlock(block.dimension, { x: x + dx, y, z: z + dz }));
      const chance = growChance(light, typeof moisture === "number" ? moisture : 0, layout);
      if (roll >= chance) return;
      block.setPermutation(block.permutation.withState(GROWTH, g + 1));
    },
  });
});
