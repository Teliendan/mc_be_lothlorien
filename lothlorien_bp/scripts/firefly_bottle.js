import { message } from "./messages.js";

// Stackable items cannot use ItemStack dynamic properties in API2.8. Visible,
// localized RawMessage lore carries just captured identity/current health.
const NAME = "lothlorien.message.firefly.name";
const MORE_NAME = "lothlorien.message.firefly.name_more";
const HEALTH = "lothlorien.message.firefly.health";
export const FIREFLY_HEALTH = 2;

export function bottleFirefly(item, entity) {
  const health = entity.getComponent("minecraft:health"), name = entity.nameTag ?? "";
  const lore = [];
  // Keep UTF-16 length <=24 per name part without splitting surrogate pairs;
  // localized prefixes fit the documented50-character lore line limit.
  let part = "";
  for (const char of name) {
    if (part.length + char.length > 24) { lore.push(message(lore.length ? "firefly.name_more" : "firefly.name", part)); part = ""; }
    part += char;
  }
  if (part) lore.push(message(lore.length ? "firefly.name_more" : "firefly.name", part));
  if (health.currentValue !== FIREFLY_HEALTH) lore.push(message("firefly.health", health.currentValue));
  if (lore.length) item.setLore(lore); // ordinary healthy/unnamed catches remain plain compatible bottles
  return item;
}

const argument = (line) => line.with.rawtext[0].text; // message() writes the one text argument

export function fireflyInBottle(item) {
  let name = "", health;
  for (const line of item.getRawLore()) {
    if (line.translate === NAME || line.translate === MORE_NAME) name += argument(line);
    else if (line.translate === HEALTH) {
      health = Number(argument(line));
    }
  }
  // Bottle title/anvil renaming and unrelated lore are not animal identity.
  return { name, health };
}

export function restoreFirefly(entity, state) {
  entity.nameTag = state.name;
  if (state.health !== undefined) {
    const health = entity.getComponent("minecraft:health");
    health.setCurrentValue(Math.min(state.health, health.effectiveMax));
  }
}
