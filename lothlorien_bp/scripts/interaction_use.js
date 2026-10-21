import { EquipmentSlot } from "@minecraft/server";
import { coverItemData } from "./cover_use.js";

// Share the exposed item-data comparison with cover/dew uses. This is a visible
// snapshot, not a persistent identity token or history/permission check.
export function captureHand(player, item) {
  try {
    return { dimension: player.dimension, index: player.selectedSlotIndex,
      mode: player.getGameMode(), item: item.clone() };
  } catch { return undefined; }
}
export function liveHand(snapshot, player, expected = snapshot?.item) {
  if (!snapshot) return undefined;
  try {
    if (player.isValid === false || player.dimension.id !== snapshot.dimension.id ||
        player.selectedSlotIndex !== snapshot.index || player.getGameMode() !== snapshot.mode) return undefined;
    const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand), item = slot?.getItem();
    if (expected === null) return slot && !item ? { slot } : undefined;
    if (!item || coverItemData(item) !== coverItemData(expected) ||
        (item.isStackable && !item.isStackableWith(expected))) return undefined;
    return { slot, item };
  } catch { return undefined; }
}
export function withinReach(player, location, reach = 6) {
  const eye = player.getHeadLocation();
  return Math.hypot(eye.x - location.x, eye.y - location.y, eye.z - location.z) <= reach;
}
