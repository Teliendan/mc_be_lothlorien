import { EquipmentSlot, GameMode, world } from "@minecraft/server";
import { FOOD_HEALTH, FLOWER_ITEMS, GRAIN_ITEMS } from "./animal_food_rules.js";

// Gifts and bonding own their food consumption. They call this only after acceptance.
export function healAnimal(animal) {
  const health = animal.getComponent("minecraft:health");
  if (health) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + FOOD_HEALTH));
}

export function isInjured(animal) {
  const health = animal.getComponent("minecraft:health");
  return !!health && health.currentValue < health.effectiveMax;
}

// Recheck the live hand, including deferred interactions. Never consume a substituted item.
export function eatHeldFood(player, animal, foodId) {
  const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
  if (!slot?.hasItem() || slot.typeId !== foodId) return false;
  if (player.getGameMode() !== GameMode.Creative) {
    if (slot.amount > 1) slot.amount -= 1;
    else slot.setItem(undefined);
  }
  healAnimal(animal);
  return true;
}

// Native healable / breedable / ageable components own these interactions.
// Only add persistence; breeders (swans) deliberately have no healable component.
const FOODS = new Map([
  ["lothlorien:songbird", new Set(GRAIN_ITEMS)],
  ["lothlorien:butterfly", new Set(FLOWER_ITEMS)],
  ["lothlorien:swan", new Set(GRAIN_ITEMS)],
]);
world.afterEvents.playerInteractWithEntity.subscribe(({ target, beforeItemStack, itemStack }) => {
  try {
    if (FOODS.get(target.typeId)?.has((beforeItemStack ?? itemStack)?.typeId)) target.triggerEvent("lothlorien:fed");
  } catch { /* animal unloaded */ }
});
