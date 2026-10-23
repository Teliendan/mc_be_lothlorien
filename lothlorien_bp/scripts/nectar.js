import { world, system } from "@minecraft/server";
import { MALLORN_LEAVES, nectarAfterTick, MAX_NECTAR } from "./nectar_rules.js";
import { GLASS_BOTTLE, swapHeldBottle, newItem } from "./bottles.js";
import { noteDeed } from "./deeds.js";
import { captureUse, liveUse } from "./deferred_use.js";

// Phase 14b: the nectar bloom hangs under Mallorn leaves. `lothlorien:nectar` 0-3 fills by random tick while Mallorn
// leaves are directly above; a glass bottle on a full bloom gives Mallorn nectar and empties it. Shears or Silk Touch
// collect the bloom through native loot (owner 2026-10-11). Rules: nectar_rules.js.
export const BLOOM = "lothlorien:nectar_bloom";
const NECTAR = "lothlorien:nectar";

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:nectar_bloom", {
    onRandomTick({ block }) {
      const stage = block.permutation.getState(NECTAR);
      if (typeof stage !== "number" || stage >= MAX_NECTAR) return;
      const next = nectarAfterTick(stage, MALLORN_LEAVES.has(block.above()?.typeId), Math.random());
      if (next !== stage) block.setPermutation(block.permutation.withState(NECTAR, next));
    },
  });
});

// Hangs a bloom at `block` (air) when Mallorn leaves are above it; used for sapling-grown trees.
export function hangBloom(block, stage = 0) {
  if (!block?.isAir || !MALLORN_LEAVES.has(block.above()?.typeId)) return false;
  block.setType(BLOOM);
  block.setPermutation(block.permutation.withState(NECTAR, stage));
  return true;
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (block.typeId !== BLOOM || itemStack?.typeId !== GLASS_BOTTLE) return;
  if (block.permutation.getState(NECTAR) !== MAX_NECTAR) return;
  event.cancel = true;
  if (!event.isFirstEvent) return;
  const use = captureUse(block, itemStack);
  system.run(() => {
    const live = liveUse(use, player);
    if (!live) return;
    const b = live.block;
    swapHeldBottle(player, newItem("lothlorien:mallorn_nectar"));
    b.setPermutation(b.permutation.withState(NECTAR, 0));
    noteDeed(player, "nectar");
    b.dimension.playSound("bucket.fill_water", b.center(), { pitch: 1.5 });
  });
});
