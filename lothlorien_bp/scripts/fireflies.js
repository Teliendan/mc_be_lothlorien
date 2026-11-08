import { world, system } from "@minecraft/server";
import { GLASS_BOTTLE, swapHeldBottle, newItem } from "./bottles.js";
import { repeatedUse } from "./use_guard.js";
import { noteDeed } from "./deeds.js";
import { captureUse, liveUse } from "./deferred_use.js";
import { swingArm } from "./swing.js";
import { bottleFirefly, fireflyInBottle, restoreFirefly } from "./firefly_bottle.js";

// Catching a firefly (M2 redesign, owner 2026-10-11; native swing 2026-11-08): the firefly's `minecraft:interact` entry in
// entities/firefly.json (glass bottle, use_item false, no event, swing true) makes the click a native interaction, so the
// engine swings the arm, also in first person. The script owns the outcome in the after event: it removes the firefly and
// hands over a Bottle of fireflies. The deed hook "fireflies" makes the lesson ready.
const FIREFLY = "lothlorien:firefly";
const FIREFLY_BOTTLE = "lothlorien:bottle_of_fireflies";

world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, beforeItemStack }) => {
  try {
    if (target.typeId !== FIREFLY || beforeItemStack?.typeId !== GLASS_BOTTLE) return;
    if (repeatedUse(player, "firefly")) return;
    if (!target.isValid) return; // another player caught it in the same tick
    const { dimension, location } = target;
    const result = bottleFirefly(newItem(FIREFLY_BOTTLE), target);
    // Deliver before removing the animal: a native inventory/drop error must
    // leave it catchable instead of silently deleting a named firefly.
    if (!swapHeldBottle(player, result, GLASS_BOTTLE)) return;
    target.remove();
    try { noteDeed(player, "fireflies"); } catch { /* optional feedback */ }
    try { dimension.playSound("bottle.dragonbreath", location, { volume: 0.35, pitch: 1.5 }); } catch { /* optional sound */ }
  } catch { /* player/target unloaded or disconnected */ }
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
      swingArm(player);
      try { dimension.playSound("bottle.dragonbreath", firefly.location, { volume: 0.35, pitch: 1.3 }); } catch { /* optional sound */ }
    } catch { /* placement became unloaded or out of bounds */ }
  });
});
