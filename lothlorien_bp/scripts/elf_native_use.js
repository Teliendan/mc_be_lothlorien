// Keep native entity actions ahead of the custom elf dialogs and shops.
export const SKIP_ITEMS = ["minecraft:lead", "minecraft:name_tag"];
const ordinary = new Set(SKIP_ITEMS);

export function nativeElfUse(target, itemStack) {
  if (ordinary.has(itemStack?.typeId)) return true;
  return itemStack?.typeId === "minecraft:shears"
    && target.getComponent("minecraft:leashable")?.isLeashed === true;
}
