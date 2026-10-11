import { world, system } from "@minecraft/server";
import { GLASS_BOTTLE, swapHeldBottle, newItem } from "./bottles.js";
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
    const { dimension, location } = target;
    target.remove();
    swapHeldBottle(player, newItem(FIREFLY_BOTTLE));
    noteDeed(player, "fireflies");
    dimension.playSound("bucket.fill_water", location, { pitch: 1.8 });
  });
});
