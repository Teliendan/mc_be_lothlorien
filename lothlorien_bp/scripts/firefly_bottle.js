import { message } from "./messages.js";

// Stackable items cannot use ItemStack dynamic properties in API2.8. Visible,
// localized RawMessage lore carries just captured identity/current health.
const NAME = "lothlorien.message.firefly.name";
const MORE_NAME = "lothlorien.message.firefly.name_more";
const HEALTH = "lothlorien.message.firefly.health";
export const FIREFLY_HEALTH = 2;

export function bottleFirefly(item, entity) {
  const health = entity.getComponent("minecraft:health"), name = entity.nameTag ?? "";
  if (!health || !Number.isFinite(health.currentValue) || health.currentValue <= 0) throw Error("Firefly is not living");
  if (name.length > 255) throw Error("Firefly name exceeds supported length");
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

function argument(line) {
  const args = line.with;
  const value = Array.isArray(args) ? args[0] : args?.rawtext?.[0]?.text;
  if (typeof value !== "string") throw Error("Invalid captured firefly lore");
  return value;
}

export function fireflyInBottle(item) {
  let name = "", health;
  for (const line of item.getRawLore()) {
    if (line.translate === NAME || line.translate === MORE_NAME) name += argument(line);
    else if (line.translate === HEALTH) {
      health = Number(argument(line));
      if (!Number.isFinite(health) || health <= 0) throw Error("Invalid captured firefly health");
    }
  }
  if (name.length > 255) throw Error("Invalid captured firefly name");
  // Bottle title/anvil renaming and unrelated lore are not animal identity.
  return { name, health };
}

export function restoreFirefly(entity, state) {
  entity.nameTag = state.name;
  if (state.health !== undefined) {
    const health = entity.getComponent("minecraft:health");
    if (!health || health.setCurrentValue(Math.min(state.health, health.effectiveMax)) === false)
      throw Error("Captured firefly health could not be restored");
  }
}
