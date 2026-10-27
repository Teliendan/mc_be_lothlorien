// Deer in the running game: wariness follows the nearest player's Harmony band, and a player
// hurting a deer alarms the herd. The flight behaviour itself is JSON (entities/deer.json, entities/white_deer.json).
import { GameMode, world, system } from "@minecraft/server";
import { harmonyOf } from "./harmony_game.js";
import { bandOf } from "./harmony.js";
import { isGuiding } from "./white_deer.js";
import { isErrand } from "./squirrel.js";
import { ALARM_RADIUS, CORN_ID, DEER_ID, DEER_TYPES, WARY_TYPES, WATCH_RADIUS, UNICORN_ID, pickWariness, setEventFor, warinessFor } from "./deer_rules.js";

const INTERVAL_TICKS = 40;
const PLAYER_ID = "minecraft:player";
const loaded = new Map();
let warinessTimer;
let unicornReadiness;

// Reuse this service's existing load/bootstrap/removal paths for the unicorn's
// one-shot offer pause instead of adding another world query or polling loop.
export function watchUnicornReadiness(onLoad, onRemove) {
  unicornReadiness = { onLoad, onRemove };
  for (const entity of loaded.values()) if (entity.typeId === UNICORN_ID) onLoad(entity);
}

function stopIfEmpty() {
  if (!loaded.size && warinessTimer !== undefined) {
    system.clearRun(warinessTimer);
    warinessTimer = undefined;
  }
}
function trackCreature(entity) {
  try {
    if (!WARY_TYPES.includes(entity.typeId) || !entity.isValid) return;
    loaded.set(entity.id, entity);
    if (warinessTimer === undefined) warinessTimer = system.runInterval(updateWariness, INTERVAL_TICKS);
    if (entity.typeId === UNICORN_ID) unicornReadiness?.onLoad(entity);
  } catch { /* entity removed before delivery */ }
}

const nearDeer = (dimension, location, maxDistance) =>
  [...loaded.values()].filter(entity => {
    try {
      const p = entity.location;
      return entity.isValid && entity.dimension.id === dimension.id &&
        Math.hypot(p.x-location.x, p.y-location.y, p.z-location.z) <= maxDistance;
    } catch { return false; }
  });

function updateWariness() {
  const players = new Map();
  let nearbyPlayers;
  try { nearbyPlayers = world.getPlayers(); } catch { return; }
  for (const player of nearbyPlayers) {
    try {
      // Creative counts (owner 2026-10-26): vanilla lures work in Creative, and the unicorn's lure exists only in its
      // Friend state. The engine still never flees a Creative player.
      if (!player.isValid || player.getGameMode() === GameMode.Spectator ||
          !(player.getComponent("minecraft:health")?.currentValue > 0)) continue;
      const wariness = warinessFor(bandOf(harmonyOf(player).harmony));
      const id = player.dimension.id;
      if (!players.has(id)) players.set(id, []);
      players.get(id).push({ location: player.location, wariness });
    } catch { /* one unreadable player must not suppress other players */ }
  }
  for (const [id, deer] of loaded) {
    try {
      if (!deer.isValid) { loaded.delete(id); continue; }
      const p = deer.location, candidates = [];
      for (const player of players.get(deer.dimension.id) || []) {
        const dx = p.x-player.location.x, dy = p.y-player.location.y, dz = p.z-player.location.z;
        if (dx*dx+dy*dy+dz*dz <= WATCH_RADIUS*WATCH_RADIUS)
          candidates.push({distance:Math.hypot(dx,dz), wariness:player.wariness});
      }
      if (!candidates.length) continue;
      if (deer.getProperty("lothlorien:alarmed")) continue; // the alarm timer hands back to the state
      if (deer.getProperty("lothlorien:guiding")) {
        // a guiding white deer or errand squirrel keeps its guiding state; one with no session (world reloaded mid-way) is released
        if (!isGuiding(deer.id) && !isErrand(deer.id)) deer.triggerEvent("lothlorien:guide_end");
        continue;
      }
      const wariness = pickWariness(candidates);
      if (wariness && deer.getProperty("lothlorien:wariness") !== wariness) deer.triggerEvent(setEventFor(wariness));
    } catch {
      // A property/location read can fail while a valid actor remains loaded.
      // Removal events or a confirmed-invalid handle own tracking removal.
      try { if (deer.isValid === false) loaded.delete(id); } catch { /* retry next pulse */ }
    }
  }
  stopIfEmpty();
}

// Fed = tame. lothlorien:become_tame sets the property and makes the deer persistent (like a vanilla tamed animal).
// Re-applying the current state event then swaps state_calm/state_friend for state_tame. One tick later: a property
// change is not visible (to getProperty or to event filters) before the next tick.
function tame(deer) {
  if (deer.getProperty("lothlorien:tame")) return;
  deer.triggerEvent("lothlorien:become_tame");
  system.runTimeout(() => {
    try {
      if (!deer.getProperty("lothlorien:alarmed") && !deer.getProperty("lothlorien:guiding")) {
        deer.triggerEvent(setEventFor(deer.getProperty("lothlorien:wariness")));
      }
    } catch {
      // deer unloaded meanwhile
    }
  }, 1);
}

function alarmAround(dimension, location) {
  for (const deer of nearDeer(dimension, location, ALARM_RADIUS)) {
    try {
      deer.triggerEvent("lothlorien:alarm");
    } catch {
      // deer unloaded meanwhile
    }
  }
}

export function startDeer() {
  world.afterEvents.entitySpawn.subscribe(({ entity }) => trackCreature(entity));
  world.afterEvents.entityLoad.subscribe(({ entity }) => trackCreature(entity));
  // Only wary types are tracked (the unicorn readiness timers too), so the native filters skip every other entity.
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    loaded.delete(removedEntityId); stopIfEmpty();
    unicornReadiness?.onRemove(removedEntityId);
  }, { entityTypes: WARY_TYPES });
  // One-time bootstrap for already loaded animals; no recurring entity query.
  for (const id of ["overworld", "nether", "the_end"]) {
    try {
      const dimension = world.getDimension(id);
      for (const type of WARY_TYPES) for (const entity of dimension.getEntities({ type })) trackCreature(entity);
    } catch { /* dimension unavailable */ }
  }
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    if (!WARY_TYPES.includes(hurtEntity.typeId) || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
    try {
      // untame (no longer persistent unless leashed); the alarm below rebuilds its state without state_tame 20 s later.
      // Swans and squirrels are never tamed, so they have no such event.
      if (DEER_TYPES.includes(hurtEntity.typeId)) hurtEntity.triggerEvent("lothlorien:untame");
    } catch {
      // deer died of the hit
    }
    alarmAround(hurtEntity.dimension, hurtEntity.location);
  }, { entityTypes: WARY_TYPES });
  // Feeding corn (breeding or a fawn) tames a deer. The white deer is tamed by the acorn in white_deer.js.
  world.afterEvents.playerInteractWithEntity.subscribe(({ target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId === DEER_ID && (beforeItemStack ?? itemStack)?.typeId === CORN_ID) tame(target);
    } catch {
      // deer gone
    }
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      loaded.delete(deadEntity.id); stopIfEmpty();
      unicornReadiness?.onRemove(deadEntity.id);
      if (!WARY_TYPES.includes(deadEntity.typeId) || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
      alarmAround(deadEntity.dimension, deadEntity.location);
    } catch {
      // entity already gone
    }
  }, { entityTypes: WARY_TYPES });
}
