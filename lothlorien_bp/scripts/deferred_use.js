import { EquipmentSlot } from "@minecraft/server";

// A deferred use may only complete against the same visible target/held snapshot.
// Synchronous writes are not an engine transaction or a history/permission proof.
export function readBlock(dimension, location) {
  try { return dimension.getBlock(location); } catch { return undefined; }
}
export function captureUse(block, player, item) {
  try {
    return { dimension: block.dimension, location: { ...block.location }, permutation: block.permutation,
      id: block.typeId, slot: player.selectedSlotIndex, mode: player.getGameMode(), item: item.clone() };
  } catch { return undefined; }
}
export function liveUse(snapshot, player) {
  if (!snapshot) return undefined;
  try {
    if (player.dimension.id !== snapshot.dimension.id || player.selectedSlotIndex !== snapshot.slot ||
        player.getGameMode() !== snapshot.mode) return undefined;
    const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand), item = slot?.getItem();
    if (!item || item.typeId !== snapshot.item.typeId || item.amount !== snapshot.item.amount ||
        !item.isStackableWith(snapshot.item)) return undefined;
    const block = readBlock(snapshot.dimension, snapshot.location);
    if (!block || !snapshot.permutation.matches(block.typeId, block.permutation.getAllStates())) return undefined;
    return { block, slot };
  } catch { return undefined; } // player left / chunk unloaded
}
