import { world, system } from "@minecraft/server";
import { GLASS_BOTTLE, swapHeldBottle, newItem } from "./bottles.js";
import { repeatedUse } from "./use_guard.js";
import { noteDeed } from "./deeds.js";
import { captureUse, heldSlot, liveUse } from "./deferred_use.js";
import { bottleFirefly, fireflyInBottle, restoreFirefly } from "./firefly_bottle.js";

// Catching a firefly (M2 redesign, owner 2026-10-11): the script owns the catch, like the nectar bloom (nectar.js). The firefly's
// `minecraft:interact` entry in entities/firefly.json only supplies the prompt (use_item false, no event, no transform); here the
// before event cancels the vanilla outcome and, next tick, removes the firefly and hands over a Bottle of fireflies.
// The deed hook "fireflies" makes the lesson ready. One tick later only the target (firefly still there, clicked block
// unchanged) and the held item type are checked (deferred_use.js).
const FIREFLY = "lothlorien:firefly";
const FIREFLY_BOTTLE = "lothlorien:bottle_of_fireflies";

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target, itemStack } = event;
  if (target.typeId !== FIREFLY || itemStack?.typeId !== GLASS_BOTTLE) return;
  event.cancel = true;
  if (repeatedUse(player, "firefly")) return;
  system.run(() => {
    try {
      if (!target.isValid || !heldSlot(player, GLASS_BOTTLE)) return;
      const { dimension, location } = target;
      const result = bottleFirefly(newItem(FIREFLY_BOTTLE), target);
      target.remove();
      swapHeldBottle(player, result, GLASS_BOTTLE);
      try { noteDeed(player, "fireflies"); } catch { /* optional feedback */ }
      try { dimension.playSound("bucket.fill_water", location, { pitch: 1.8 }); } catch { /* optional sound */ }
    } catch { /* player/target unloaded or disconnected */ }
  });
});

const FACE_OFFSET = {
  Up: { x: 0, y: 1, z: 0 }, Down: { x: 0, y: -1, z: 0 },
  North: { x: 0, y: 0, z: -1 }, South: { x: 0, y: 0, z: 1 },
  West: { x: -1, y: 0, z: 0 }, East: { x: 1, y: 0, z: 0 },
};

// Use a full bottle against a block face. No crafting recipe or feeding is needed.
// Cancellation prevents opening a chest/door on the same use. Mutations run next tick.
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, itemStack, block, blockFace } = event;
  if (itemStack?.typeId !== FIREFLY_BOTTLE) return;
  event.cancel = true;
  if (repeatedUse(player, "firefly")) return;
  const offset = FACE_OFFSET[blockFace];
  if (!offset) return;
  const { dimension, location } = block;
  const use = captureUse(block, itemStack);
  const at = { x: location.x + offset.x, y: location.y + offset.y, z: location.z + offset.z };
  system.run(() => {
    try {
      const live = liveUse(use, player);
      if (!live || !dimension.getBlock(at)?.isAir) return;
      const state = fireflyInBottle(live.slot.getItem());
      const firefly = dimension.spawnEntity(FIREFLY, { x: at.x + 0.5, y: at.y + 0.4, z: at.z + 0.5 },
        { spawnEvent: "lothlorien:released" });
      restoreFirefly(firefly, state);
      swapHeldBottle(player, newItem(GLASS_BOTTLE), FIREFLY_BOTTLE);
      try { dimension.playSound("bucket.empty_water", firefly.location, { pitch: 1.8 }); } catch { /* optional sound */ }
    } catch { /* placement became unloaded or out of bounds */ }
  });
});
