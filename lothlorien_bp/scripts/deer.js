// The wildlife's alarm and feeding in the running game: a player hurting or killing a wary animal alarms every wary animal near it,
// and corn tames a deer. The flight itself is native JSON: each animal judges every player by that player's own Harmony band tag
// (entities/{deer,white_deer,swan,squirrel,unicorn}.json, generated from tools/wildlife_wariness.py); no script polls it.
import { world } from "@minecraft/server";
import { onEntity } from "./entity_events.js";
import { PLAYER_ID } from "./ids.js";
import { isGuiding } from "./white_deer.js";
import { isErrand } from "./squirrel.js";
import { ALARM_RADIUS, CORN_ID, DEER_ID, DEER_TYPES, SQUIRREL_ID, WARY_TYPES, WHITE_DEER_ID } from "./deer_rules.js";

// Fed = tame. lothlorien:become_tame sets the property, makes the deer persistent (like a vanilla tamed animal) and swaps
// state_wild for state_tame itself (entities/deer.json).
function tame(deer) {
  if (deer.getProperty("lothlorien:tame")) return;
  deer.triggerEvent("lothlorien:become_tame");
}

// A white deer or squirrel saved while guiding has no session after a reload (sessions live in script memory): release it once, when it loads.
// Animals saved by a build before LM-01 carry no flight group and stay fearless until the alarm (owner 2026-11-11: no migration).
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
  onEntity([WHITE_DEER_ID, SQUIRREL_ID], { load: ({ entity }) => settleOnLoad(entity) });
  // One-time bootstrap for animals already loaded; no recurring entity query.
  for (const id of ["overworld", "nether", "the_end"]) {
    try {
      const dimension = world.getDimension(id);
      for (const type of [WHITE_DEER_ID, SQUIRREL_ID]) for (const entity of dimension.getEntities({ type })) settleOnLoad(entity);
    } catch { /* dimension unavailable */ }
  }
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    if (!WARY_TYPES.includes(hurtEntity.typeId) || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
    try {
      // untame (no longer persistent unless leashed); the alarm below rebuilds its state without state_tame 20 s later.
      // Swans, squirrels and unicorns are never tamed this way, so they have no such event.
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
      if (!WARY_TYPES.includes(deadEntity.typeId) || damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
      alarmAround(deadEntity.dimension, deadEntity.location);
    } catch {
      // entity already gone
    }
  }, { entityTypes: WARY_TYPES });
}
