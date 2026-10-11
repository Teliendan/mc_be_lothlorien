import { world, system } from "@minecraft/server";
import { GLASS_BOTTLE, mainhandSlot, swapHeldBottle, newItem } from "./bottles.js";
import { repeatedUse } from "./use_guard.js";
import { noteDeed } from "./deeds.js";

// Catching a firefly (M2 redesign, owner 2026-10-11): the script owns the catch, like the nectar bloom (nectar.js). The firefly's
// `minecraft:interact` entry in entities/firefly.json only supplies the prompt (use_item false, no event, no transform); here the
// before event cancels the vanilla outcome and, next tick, removes the firefly and hands over a Bottle of fireflies.
// The deed hook "fireflies" then makes the Fireflies lesson ready when it is the current task. UNVERIFIED in game: survival, creative,
// two players on one firefly (the second finds it invalid and gets nothing).
const FIREFLY = "lothlorien:firefly";
const FIREFLY_BOTTLE = "lothlorien:bottle_of_fireflies";

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
  const { player, target, itemStack } = event;
  if (target.typeId !== FIREFLY || itemStack?.typeId !== GLASS_BOTTLE) return;
  event.cancel = true;
  if (repeatedUse(player, "firefly")) return;
  system.run(() => {
    if (!target.isValid || !player.isValid) return; // another player was faster
    if (mainhandSlot(player)?.typeId !== GLASS_BOTTLE) return;
    const { dimension, location } = target;
    target.remove();
    swapHeldBottle(player, newItem(FIREFLY_BOTTLE));
    noteDeed(player, "fireflies");
    dimension.playSound("bucket.fill_water", location, { pitch: 1.8 });
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
  const at = { x: location.x + offset.x, y: location.y + offset.y, z: location.z + offset.z };
  system.run(() => {
    try {
      if (!player.isValid || player.dimension.id !== dimension.id || mainhandSlot(player)?.typeId !== FIREFLY_BOTTLE) return;
      if (!dimension.getBlock(at)?.isAir) return;
      const firefly = dimension.spawnEntity(FIREFLY, { x: at.x + 0.5, y: at.y + 0.4, z: at.z + 0.5 },
        { spawnEvent: "lothlorien:released" });
      if (!firefly?.isValid) return;
      swapHeldBottle(player, newItem(GLASS_BOTTLE));
      dimension.playSound("bucket.empty_water", firefly.location, { pitch: 1.8 });
    } catch { /* placement became unloaded or out of bounds */ }
  });
});
