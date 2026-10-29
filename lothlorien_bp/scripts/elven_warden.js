// Elven Warden in the running game (rules in elven_warden_rules.js, design docs/mobs/elven_warden.md). Event-driven only,
// no polling:
//  - entitySpawn (one subscriber): natural spawns are judged once (kept or removed by depth / deck), and a warden whose
//    hand is empty gets its bow (structure-placed village wardens may not run the equipment table).
//  - beforeEvents.entityHurt: cancels friendly fire from a warden's arrows (read-only decision, restricted privilege).
//  - afterEvents.dataDrivenEntityTrigger: a warden that acquires a target shouts (voice.js; no polling).
//  - beforeEvents.playerInteractWithEntity: a click greets by Harmony band (never cancelled; silent while fighting that player).
//  - afterEvents.entityHurt: remembers which player hurt a warden, so that player's retaliation target is not shielded;
//    the first hit after PROVOKE_MS without one is a new fight and costs the player harmony (harmony_game.js).
//  - afterEvents.entityDie: a player who kills a monster the wardens hunt is thanked by the nearest warden within THANKS_RADIUS.
// Civilian elves (rules in elf_rules.js, entity entities/elf.json, design docs/mobs/elves.md) live here too, because the wardens defend them:
//  - the player-hurts-elf case: the elf runs off by itself (panic goal), harmony hears about every new fight (recordElfFight), and the hitter
//    carries the tag lothlorien_elf_foe for FOE_MS, which the village wardens read (entities/elven_warden.json target entry, and the
//    beforeEvents.entityHurt below stops shielding that player from warden arrows). Kills are charged by harmony_game.js (entityDie).
//  - a lead released the elf: entities/elf.json set the engine home to where it stands; script only records it.
import { EntityInitializationCause, EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { ANGRY_EVENT, BOW_ID, DECK_BLOCKS, WARDEN_ID, isFriendlyFire, isNewFight, keepNaturalSpawn, PLAYER_ID, THANKS_RADIUS, isWardenQuarry } from "./elven_warden_rules.js";
import { HATED_TAG, recordElfFight, recordWardenFight } from "./harmony_game.js";
import { ELF_ID, FOE_MS, FOE_TAG, HOME_OF_ELF, MOVED_PROPERTY, REHOME_EVENT, homeCell } from "./elf_rules.js";
import { nativeElfUse } from "./elf_native_use.js";
import { greet, speak } from "./voice.js";
import { thanksPool } from "./voice_rules.js";

const provoked = new Map(); // player id -> Date.now() of the last hit on a warden (Date: readable in restricted mode)
const TICKS_PER_MS = 20 / 1000;
const elfHit = new Map(); // player id -> Date.now() of the last hit on an elf
const foeSerial = new Map(); // player id -> counter: only the latest elf hit's timer removes the foe tag

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

function dropFoeTag(id) {
  try {
    world.getPlayers().find((p) => p.id === id)?.removeTag(FOE_TAG);
  } catch {
    // player gone
  }
}

function watchElves() {
  world.afterEvents.dataDrivenEntityTrigger.subscribe(({ entity, eventId }) => {
    try {
      if (eventId !== REHOME_EVENT || entity?.typeId !== ELF_ID) return;
      entity.setDynamicProperty(HOME_OF_ELF, homeCell(entity.location));
      entity.setDynamicProperty(MOVED_PROPERTY, true);
    } catch {
      // entity gone
    }
  }, { entityTypes: [ELF_ID], eventTypes: [REHOME_EVENT] });
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    try {
      const hitter = damageSource.damagingEntity;
      if (hurtEntity.typeId !== ELF_ID || hitter?.typeId !== PLAYER_ID) return;
      const now = Date.now(), at = elfHit.get(hitter.id);
      elfHit.set(hitter.id, now);
      if (isNewFight(at === undefined ? undefined : now - at)) recordElfFight(hitter, hurtEntity);
      hitter.addTag(FOE_TAG);
      const serial = (foeSerial.get(hitter.id) ?? 0) + 1, id = hitter.id;
      foeSerial.set(id, serial);
      system.runTimeout(() => {
        if (foeSerial.get(id) !== serial) return;
        foeSerial.delete(id);
        dropFoeTag(id);
      }, Math.ceil(FOE_MS * TICKS_PER_MS));
    } catch {
      // entity gone
    }
  }, { entityTypes: [ELF_ID] });
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    try {
      if (initialSpawn && player.hasTag(FOE_TAG)) player.removeTag(FOE_TAG); // a tag left over from before a reload or relog
    } catch {
      // player gone
    }
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    elfHit.delete(playerId);
    foeSerial.delete(playerId);
  });
}

// depth(dimension, location) -> { level } from scripts/depth.js (main.js supplies it); bandOf(player) -> Harmony band.
export function startElvenWardens(depthAt, bandOf) {
  watchElves();
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
      const at = provoked.get(victim.id);
      const hated = victim.typeId === PLAYER_ID && victim.hasTag(HATED_TAG), foe = victim.typeId === PLAYER_ID && victim.hasTag(FOE_TAG);
      if (isFriendlyFire({ shooterId: shooter.typeId, victim: { typeId: victim.typeId, families: families(victim) }, hated, foe, sinceProvokedMs: at === undefined ? undefined : Date.now() - at })) {
        event.cancel = true;
      }
    } catch {
      // entity gone
    }
  });
  // Thanks: a player who kills a monster the wardens hunt hears the nearest warden; not while fighting the wardens.
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      const killer = damageSource.damagingEntity;
      if (killer?.typeId !== PLAYER_ID || !isWardenQuarry(families(deadEntity)) || fighting(killer)) return;
      const pool = thanksPool(bandOf(killer));
      const [warden] = pool ? killer.dimension.getEntities({ type: WARDEN_ID, location: killer.location, maxDistance: THANKS_RADIUS, closest: 1 }) : [];
      if (warden) speak(warden, pool, killer);
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
