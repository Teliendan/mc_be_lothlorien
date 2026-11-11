// Small helpers shared by the creature, trade and Renown scripts (LM-09): chat lines, player lookup, entity reads, held-item
// consumption, natural-spawn judging and the guide beacon's two moves. Block and biome helpers live in world_util.js, which stays
// free of @minecraft/server so rule modules may import it; these need the API.
import { world } from "@minecraft/server";
import { PLAYER_ID } from "./ids.js";

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
