import { EquipmentSlot } from "@minecraft/server";
import { readBlock } from "./deferred_use.js";
import { SUPPORT_POLICIES } from "./support_policies.js";

// Nonstackable bottles always fail isStackableWith in API2.8. Compare their
// exposed mutable data; this cannot prove identity or observe changes undone.
export function coverItemData(item) {
  const durability = item.getComponent("durability");
  return JSON.stringify({
    type: item.typeId, amount: item.amount, name: item.nameTag, keep: item.keepOnDeath, lock: item.lockMode,
    lore: item.getRawLore(), place: item.getCanPlaceOn(), destroy: item.getCanDestroy(),
    dynamic: item.getDynamicPropertyIds().sort().map(id => [id, item.getDynamicProperty(id)]),
    enchantments: (item.getComponent("enchantable")?.getEnchantments() ?? [])
      .map(e => [e.type.id, e.level]).sort((a, b) => a[0].localeCompare(b[0])),
    durability: durability && [durability.damage, durability.maxDurability, durability.unbreakable],
  });
}
export function coverBlockSnapshot(block) {
  return { dimension: block.dimension, location: { ...block.location }, permutation: block.permutation,
    water: block.isWaterlogged };
}
export function originalCoverBlock(snapshot) {
  if (!snapshot) return undefined;
  try {
    const block = readBlock(snapshot.dimension, snapshot.location);
    return block && block.isWaterlogged === snapshot.water &&
      snapshot.permutation.matches(block.typeId, block.permutation.getAllStates()) ? block : undefined;
  } catch { return undefined; }
}
export function coverSupported(block) {
  const below = readBlock(block.dimension, { ...block.location, y: block.y - 1 });
  return !!below && !!SUPPORT_POLICIES[block.typeId]?.allowed?.includes(below.typeId);
}
export function captureCoverUse(block, player, item) {
  try {
    const support = readBlock(block.dimension, { ...block.location, y: block.y - 1 });
    if (!support || !coverSupported(block)) return undefined;
    return { target: coverBlockSnapshot(block), support: coverBlockSnapshot(support),
      dimension: block.dimension, index: player.selectedSlotIndex, mode: player.getGameMode(), item: item.clone() };
  } catch { return undefined; }
}
export function originalCoverHand(snapshot, player, expected) {
  if (!snapshot) return undefined;
  try {
    if (player.dimension.id !== snapshot.dimension.id || player.selectedSlotIndex !== snapshot.index ||
        player.getGameMode() !== snapshot.mode) return undefined;
    const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand), item = slot?.getItem();
    if (!expected) return !item ? { slot } : undefined;
    if (!item || coverItemData(item) !== coverItemData(expected)) return undefined;
    if (item.isStackable && !item.isStackableWith(expected)) return undefined;
    return { slot, item };
  } catch { return undefined; }
}
export function liveCoverUse(snapshot, player) {
  try {
    const hand = originalCoverHand(snapshot, player, snapshot?.item), block = originalCoverBlock(snapshot?.target);
    if (!hand || !block || !originalCoverBlock(snapshot.support) || !coverSupported(block)) return undefined;
    return { ...hand, block };
  } catch { return undefined; }
}
