import { system, world } from "@minecraft/server";

// The playerInteractWithBlock event can fire several times for one use of an item (held button, both hands, retries).
// Anything that consumes an item or changes the world from that event must act once: call repeatedUse(player, "<action name>") and
// return early when it says true. Convention checked by the shared verifier: the guard's name contains "repeat" or "debounce".
const DEBOUNCE_TICKS = 10;
const lastUse = new Map(); // player id -> Map(action -> tick of the last use)

export function repeatedUse(player, action = "") {
  const now = system.currentTick;
  let uses = lastUse.get(player.id);
  if (!uses) lastUse.set(player.id, uses = new Map());
  const last = uses.get(action);
  if (last !== undefined && now - last < DEBOUNCE_TICKS) return true;
  uses.set(action, now);
  return false;
}

// A player who left takes their entries with them (no entry outlives the session).
world.afterEvents.playerLeave.subscribe(({ playerId }) => lastUse.delete(playerId));
