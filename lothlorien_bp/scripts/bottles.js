import { EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";

// Container exchange shared by nectar, dew and both firefly directions.
export const GLASS_BOTTLE = "minecraft:glass_bottle";

export function mainhandSlot(player) {
  return player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
}

// Hands over `item`: it replaces a single held bottle, otherwise it goes into the inventory (dropped at the player's
// feet when full) and one bottle is used up. Creative players keep their bottle. With `refuseWhenFull` a full inventory
// hands nothing over, keeps the source and returns FULL (the firefly catch, owner 2026-11-22).
export const FULL = "full";
export function canSwapHeldBottle(player, expectedSource = GLASS_BOTTLE) {
  return mainhandSlot(player)?.getItem()?.typeId === expectedSource;
}

export function swapHeldBottle(player, item, expectedSource = GLASS_BOTTLE, refuseWhenFull = false) {
  if (!canSwapHeldBottle(player, expectedSource)) return false;
  const slot = mainhandSlot(player);
  const creative = player.getGameMode() === GameMode.Creative;
  if (!creative && slot.amount === 1) {
    slot.setItem(item);
    return true;
  }
  // addItem returns what did not fit; a single item either fits whole or is left whole.
  const left = player.getComponent("inventory").container.addItem(item);
  if (left && refuseWhenFull) return FULL;
  if (left) player.dimension.spawnItem(left, player.location);
  // Only pay after the output reached the inventory or the ground. In
  // particular, a failed full-inventory drop must leave the held source intact.
  if (!creative) slot.amount -= 1;
  return true;
}

export function newItem(typeId) {
  return new ItemStack(typeId, 1);
}
