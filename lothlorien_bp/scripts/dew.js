import { world, system } from "@minecraft/server";
import { MALLORN_LEAVES } from "./nectar_rules.js";
import { DEW_APPEAR, NEW_DEW_BOTTLE_DAMAGE, addDrop, dewAfterTick, leavesAbove } from "./dew_rules.js";
import { GLASS_BOTTLE, swapHeldBottle, newItem } from "./bottles.js";
import { repeatedUse } from "./use_guard.js";
import { noteDeed } from "./deeds.js";
import { captureCoverUse, liveCoverUse } from "./cover_use.js";
import { readBlock } from "./deferred_use.js";

// Phase 14b: morning dew on the Mallorn ground covers (leaf litter, blossoms). The bool state `lothlorien:dew` is set
// by random tick in the morning window under Mallorn leaves (appear chance falls, dry chance rises across the window) and
// dried with certainty by the first random tick outside it (leftover dew vanishes during the day; a visible dewy
// patch can always be collected, at any time). A glass bottle on dewy cover
// starts a Dew bottle (durability item, damage = missing drops); each further use adds a drop; at 8 drops it becomes a
// Bottle of morning dew. Rules: dew_rules.js.
const DEW = "lothlorien:dew";
const DEW_BOTTLE = "lothlorien:dew_bottle";
const MORNING_DEW = "lothlorien:morning_dew";

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:dew_cover", {
    onRandomTick({ block, dimension }) {
      const dewy = block.permutation.getState(DEW) === true;
      const { x, y, z } = block.location;
      const next = dewAfterTick(dewy, world.getTimeOfDay(), DEW_APPEAR[block.typeId] ?? 0, Math.random(), () =>
        leavesAbove((dy) => readBlock(dimension, { x, y: y + dy, z })?.typeId, (id) => MALLORN_LEAVES.has(id))
      );
      if (next !== dewy) block.setPermutation(block.permutation.withState(DEW, next));
    },
  });
});

function collect(player, block, held, slot) {
  let completed = false;
  if (held?.typeId === GLASS_BOTTLE) {
    const bottle = newItem(DEW_BOTTLE);
    bottle.getComponent("minecraft:durability").damage = NEW_DEW_BOTTLE_DAMAGE;
    if (!swapHeldBottle(player, bottle)) return;
  } else if (held?.typeId === DEW_BOTTLE) {
    const durability = held.getComponent("minecraft:durability");
    const result = addDrop(durability.damage);
    if (result.full) {
      slot.setItem(newItem(MORNING_DEW));
      completed = true;
    }
    else {
      durability.damage = result.damage;
      slot.setItem(held);
    }
  } else return;
  block.setPermutation(block.permutation.withState(DEW, false));
  try { if (completed) noteDeed(player, "dew"); }
  catch { /* optional deed feedback must not interrupt completion */ }
  try { block.dimension.playSound("bucket.fill_water", block.center(), { pitch: 1.8 }); }
  catch { /* optional sound */ }
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (itemStack?.typeId !== GLASS_BOTTLE && itemStack?.typeId !== DEW_BOTTLE) return;
  if (!(block.typeId in DEW_APPEAR) || block.permutation.getState(DEW) !== true) return;
  event.cancel = true;
  if (repeatedUse(player, "dew")) return;
  const snapshot = captureCoverUse(block, player, itemStack);
  system.run(() => {
    const live = liveCoverUse(snapshot, player);
    if (live) collect(player, live.block, live.item, live.slot);
  });
});
