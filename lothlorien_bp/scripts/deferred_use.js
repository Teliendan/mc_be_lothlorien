import { EquipmentSlot } from "@minecraft/server";

// One-tick-deferred uses (cancel the before-event, act in system.run): the world can only change by
// the player scrolling the hotbar or another player editing the block. So re-check just two things:
// the target block is as it was (type, states, waterlogged) and the main hand still holds the same item type.
export function readBlock(dimension, location) {
  try { return dimension.getBlock(location); } catch { return undefined; }
}
export function blockSnapshot(block) {
  return { dimension: block.dimension, location: { ...block.location }, permutation: block.permutation,
    water: block.isWaterlogged };
}
// The block now at the snapshot, or undefined when it changed (or its chunk is unloaded).
export function sameBlock(snapshot) {
  const block = readBlock(snapshot.dimension, snapshot.location);
  return block && block.isWaterlogged === snapshot.water &&
    snapshot.permutation.matches(block.typeId, block.permutation.getAllStates()) ? block : undefined;
}
// The main-hand slot when it still holds `typeId`.
export function heldSlot(player, typeId) {
  const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
  return slot?.getItem()?.typeId === typeId ? slot : undefined;
}
// Capture before the deferral, check after it: { block, slot } or undefined.
export function captureUse(block, itemStack) {
  return { target: blockSnapshot(block), typeId: itemStack.typeId };
}
export function liveUse(use, player) {
  const block = sameBlock(use.target), slot = heldSlot(player, use.typeId);
  return block && slot ? { block, slot } : undefined;
}
