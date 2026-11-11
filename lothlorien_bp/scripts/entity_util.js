// Small helpers shared by the creature, trade and Renown scripts (LM-09): chat lines, player lookup, entity reads, held-item
// consumption, natural-spawn judging and the guide beacon's two moves. Block and biome helpers live in world_util.js, which stays
// free of @minecraft/server so rule modules may import it; these need the API.
import { world } from "@minecraft/server";
import { TRADERS } from "./elf_rules.js";
import { ELF_ID, PLAYER_ID } from "./ids.js";

// A chat line to a player. Chat, not the action bar: the action bar belongs to the Harmony status (harmony_game.js).
export function say(player, text) {
  try {
    player.sendMessage(text);
  } catch {
    // player left
  }
}

// The online player with this id, or undefined (left, or no id). world.getEntity is the direct lookup; listing every player is not.
export function playerById(id) {
  const entity = id ? world.getEntity(id) : undefined;
  return entity?.typeId === PLAYER_ID ? entity : undefined;
}

// The type families of an entity ([] when unreadable).
export function familiesOf(entity) {
  try {
    return entity.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? [];
  } catch {
    return [];
  }
}

// A natural spawn is judged once: the spawn rule's herd event sets lothlorien:natural (/summon, eggs and structures do not), the flag is
// cleared before `judge(entity)` runs (so a chunk reload does not roll again) and `judge` removes the entity or leaves it.
export function judgeNatural(entity, judge) {
  try {
    if (!entity.isValid || !entity.getProperty("lothlorien:natural")) return;
    entity.setProperty("lothlorien:natural", false);
    judge(entity);
  } catch {
    // unloaded meanwhile
  }
}

// The profession of a trader elf (gardener, healer, woodwright, lamplighter), or undefined (the Loremaster, any other entity).
export function traderProfession(entity) {
  try {
    return entity.typeId === ELF_ID ? TRADERS[entity.getComponent("minecraft:variant")?.value] : undefined;
  } catch {
    return undefined;
  }
}

// The guide beacon (white deer and squirrel sessions): removed by id, and moved by teleport.
export function removeBeacon(beaconId) {
  try {
    const beacon = beaconId && world.getEntity(beaconId);
    if (beacon?.isValid) beacon.remove();
  } catch {
    // already gone
  }
}

export const moveBeacon = (beacon, to) => beacon.teleport({ x: to.x, y: to.y, z: to.z });
