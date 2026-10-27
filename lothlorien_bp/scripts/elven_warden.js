// Elven Warden in the running game (rules in elven_warden_rules.js, design docs/mobs/elven_warden.md). Event-driven only,
// no polling:
//  - entitySpawn (one subscriber): natural spawns are judged once (kept or removed by depth / deck), and a warden whose
//    hand is empty gets its bow (structure-placed village wardens may not run the equipment table).
//  - beforeEvents.entityHurt: cancels friendly fire from a warden's arrows (read-only decision, restricted privilege).
//  - afterEvents.dataDrivenEntityTrigger: a warden that acquires a target shouts (voice.js; no polling).
//  - beforeEvents.playerInteractWithEntity: a click greets by Harmony band (never cancelled; silent while fighting that player).
//  - afterEvents.entityHurt: remembers which player hurt a warden, so that player's retaliation target is not shielded;
//    the first hit after PROVOKE_MS without one is a new fight and costs the player harmony (harmony_game.js).
//  - afterEvents.entityDie: a player who kills what a warden was shooting (monster or hunted player) is thanked by that warden.
import { EntityInitializationCause, EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { ANGRY_EVENT, BOW_ID, DECK_BLOCKS, WARDEN_ID, isFriendlyFire, isNewFight, keepNaturalSpawn, PLAYER_ID, recordShot, takeShot } from "./elven_warden_rules.js";
import { HATED_TAG, recordWardenFight } from "./harmony_game.js";
import { FOE_TAG } from "./elf_rules.js";
import { nativeElfUse } from "./elf_native_use.js";
import { greet, speak } from "./voice.js";
import { thanksPool } from "./voice_rules.js";

const provoked = new Map(); // player id -> Date.now() of the last hit on a warden (Date: readable in restricted mode)
const shots = new Map(); // victim id -> { wardenId, at }: the warden's quarry, for thanks (elven_warden_rules.js)

function families(entity) {
  try {
    return entity.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? [];
  } catch {
    return [];
  }
}

function standsOnDeck(dimension, location) {
  try {
    const below = dimension.getBlock({ x: Math.floor(location.x), y: Math.floor(location.y - 0.5), z: Math.floor(location.z) });
    return !!below && DECK_BLOCKS.has(below.typeId);
  } catch {
    return false; // unloaded chunk
  }
}

// Natural spawns only (the spawn rule's herd event sets lothlorien:natural; /summon, eggs and structures do not).
// The flag is cleared after the roll, so a warden is judged once, not again on every chunk load.
function judgeNaturalSpawn(warden, depthAt) {
  try {
    if (!warden.isValid || !warden.getProperty("lothlorien:natural")) return;
    warden.setProperty("lothlorien:natural", false);
    const level = depthAt(warden.dimension, warden.location).level;
    if (!keepNaturalSpawn(level, standsOnDeck(warden.dimension, warden.location), Math.random())) warden.remove();
  } catch {
    // unloaded meanwhile
  }
}

function ensureBow(warden) {
  try {
    if (!warden.isValid) return;
    const hand = warden.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
    if (hand && !hand.hasItem()) hand.setItem(new ItemStack(BOW_ID, 1));
  } catch {
    // unloaded meanwhile
  }
}

// A player who hurt a warden within PROVOKE_MS, or hurt an elf, is being fought: the warden does not greet that player.
function fighting(player) {
  const at = provoked.get(player.id);
  return (at !== undefined && !isNewFight(Date.now() - at)) || player.hasTag(FOE_TAG);
}

// depth(dimension, location) -> { level } from scripts/depth.js (main.js supplies it); bandOf(player) -> Harmony band.
export function startElvenWardens(depthAt, bandOf) {
  world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    try {
      if (entity.typeId !== WARDEN_ID) return;
      // one tick later: the spawn event's property and the equipment table are surely applied by then
      system.runTimeout(() => {
        ensureBow(entity);
        if (cause !== EntityInitializationCause.Loaded) judgeNaturalSpawn(entity, depthAt);
      }, 1);
    } catch {
      // entity gone
    }
  });
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    try {
      const hitter = damageSource.damagingEntity;
      if (hurtEntity.typeId !== WARDEN_ID || hitter?.typeId !== PLAYER_ID) return;
      const at = provoked.get(hitter.id);
      provoked.set(hitter.id, Date.now());
      if (isNewFight(at === undefined ? undefined : Date.now() - at)) recordWardenFight(hitter, hurtEntity);
    } catch {
      // entity gone
    }
  }, { entityTypes: [WARDEN_ID] });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => provoked.delete(playerId));
  world.beforeEvents.playerInteractWithEntity.subscribe(({ player, target, itemStack }) => {
    try {
      if (target.typeId !== WARDEN_ID || nativeElfUse(target, itemStack) || fighting(player)) return;
      const band = bandOf(player);
      system.run(() => greet(target, player, band)); // sound needs privilege; the click itself is left alone
    } catch {
      // entity gone
    }
  });
  world.beforeEvents.entityHurt.subscribe((event) => {
    try {
      const shooter = event.damageSource.damagingEntity;
      if (shooter?.typeId !== WARDEN_ID) return;
      const victim = event.hurtEntity;
      const at = provoked.get(victim.id), fams = families(victim);
      const hated = victim.typeId === PLAYER_ID && victim.hasTag(HATED_TAG), foe = victim.typeId === PLAYER_ID && victim.hasTag(FOE_TAG);
      if (isFriendlyFire({ shooterId: shooter.typeId, victim: { typeId: victim.typeId, families: fams }, hated, foe, sinceProvokedMs: at === undefined ? undefined : Date.now() - at })) {
        event.cancel = true;
      } else if (hated || foe || fams.includes("monster")) {
        recordShot(shots, victim.id, shooter.id, Date.now()); // the warden's quarry; villagers in the line are not
      }
    } catch {
      // entity gone
    }
  });
  // Thanks: the killer of a warden's quarry (free kills, harmony.js) hears that warden; not while fighting the wardens.
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      if (!shots.size) return;
      const wardenId = takeShot(shots, deadEntity.id, Date.now());
      const killer = damageSource.damagingEntity;
      if (wardenId === undefined || killer?.typeId !== PLAYER_ID || fighting(killer)) return;
      const warden = world.getEntity(wardenId), pool = thanksPool(bandOf(killer));
      if (warden && pool) speak(warden, pool, killer);
    } catch {
      // entity gone
    }
  });
  // Combat shout when a warden acquires a target (hostiles, retaliation, broadcast anger); Hated players included.
  // voice_rules.js debounces re-targeting (15 s) and group combat. Not hurt or arrow events.
  world.afterEvents.dataDrivenEntityTrigger.subscribe(({ entity, eventId }) => {
    try {
      if (eventId === ANGRY_EVENT && entity.typeId === WARDEN_ID) speak(entity, "combat_start");
    } catch { /* entity gone */ }
  }, { entityTypes: [WARDEN_ID], eventTypes: [ANGRY_EVENT] });
}
