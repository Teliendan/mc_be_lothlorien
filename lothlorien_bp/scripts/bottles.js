import { EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";

// Container exchange shared by nectar, dew and both firefly directions.
export const GLASS_BOTTLE = "minecraft:glass_bottle";

export function mainhandSlot(player) {
  return player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
}

// Hands over `item`: it replaces a single held bottle, otherwise it goes into the inventory (dropped at the player's
// feet when full) and one bottle is used up. Creative players keep their bottle.
export function canSwapHeldBottle(player, expectedSource = GLASS_BOTTLE) {
  return mainhandSlot(player)?.getItem()?.typeId === expectedSource;
}

export function swapHeldBottle(player, item, expectedSource = GLASS_BOTTLE) {
  if (!canSwapHeldBottle(player, expectedSource)) return false;
  const slot = mainhandSlot(player);
  const creative = player.getGameMode() === GameMode.Creative;
  if (!creative && slot.amount === 1) {
    slot.setItem(item);
    return true;
  }
  if (!creative) slot.amount -= 1;
  const left = player.getComponent("inventory").container.addItem(item);
  if (left) player.dimension.spawnItem(left, player.location);
  return true;
}

export function newItem(typeId) {
  return new ItemStack(typeId, 1);
}
