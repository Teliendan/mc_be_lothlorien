// Deer in the running game: wariness follows the nearest player's Harmony band, and a player
// hurting a deer alarms the herd. The flight behaviour itself is JSON (entities/deer.json, entities/white_deer.json).
import { GameMode, world, system } from "@minecraft/server";
import { onEntity } from "./entity_events.js";
import { PLAYER_ID } from "./ids.js";
import { harmonyOf } from "./harmony_game.js";
import { bandOf } from "./harmony.js";
import { isGuiding } from "./white_deer.js";
import { isErrand } from "./squirrel.js";
import { ALARM_RADIUS, CORN_ID, DEER_ID, DEER_TYPES, SQUIRREL_ID, WARY_TYPES, WATCH_RADIUS, WHITE_DEER_ID, pickWariness, setEventFor, warinessFor } from "./deer_rules.js";

const INTERVAL_TICKS = 40;
const loaded = new Map();
let warinessTimer;

function stopIfEmpty() {
  if (!loaded.size && warinessTimer !== undefined) {
    system.clearRun(warinessTimer);
    warinessTimer = undefined;
  }
}
function trackCreature(entity) {
  try {
    if (!entity.isValid) return;
    loaded.set(entity.id, entity);
    if (warinessTimer === undefined) warinessTimer = system.runInterval(updateWariness, INTERVAL_TICKS);
  } catch { /* entity removed before delivery */ }
}

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
      if (deer.getProperty("lothlorien:guiding")) continue; // a guiding white deer or errand squirrel keeps its guiding state (settleOnLoad releases an orphan)
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

// A white deer or squirrel saved while guiding has no session after a reload (sessions live in script memory): release it once, when it loads.
function settleOnLoad(entity) {
  try {
    if (entity.typeId !== WHITE_DEER_ID && entity.typeId !== SQUIRREL_ID) return;
    if (entity.getProperty("lothlorien:guiding") && !isGuiding(entity.id) && !isErrand(entity.id)) entity.triggerEvent("lothlorien:guide_end");
  } catch {
    // entity removed before delivery
  }
}

// One query around the hurt animal; every wary animal in range (the hurt one too) is alarmed.
function alarmAround(dimension, location) {
  let near;
  try { near = dimension.getEntities({ location, maxDistance: ALARM_RADIUS }); } catch { return; }
  for (const animal of near) {
    try {
      if (WARY_TYPES.includes(animal.typeId)) animal.triggerEvent("lothlorien:alarm");
    } catch {
      // animal unloaded meanwhile
    }
  }
}

export function startDeer() {
  onEntity(WARY_TYPES, { spawn: ({ entity }) => trackCreature(entity), load: ({ entity }) => { trackCreature(entity); settleOnLoad(entity); } });
  // Only wary types are tracked, so the native filters skip every other entity.
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    loaded.delete(removedEntityId); stopIfEmpty();
  }, { entityTypes: WARY_TYPES });
  // One-time bootstrap for already loaded animals; no recurring entity query.
  for (const id of ["overworld", "nether", "the_end"]) {
    try {
      const dimension = world.getDimension(id);
      for (const type of WARY_TYPES) for (const entity of dimension.getEntities({ type })) { trackCreature(entity); settleOnLoad(entity); }
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
      if (!WARY_TYPES.includes(deadEntity.typeId) || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
      alarmAround(deadEntity.dimension, deadEntity.location);
    } catch {
      // entity already gone
    }
  }, { entityTypes: WARY_TYPES });
}
