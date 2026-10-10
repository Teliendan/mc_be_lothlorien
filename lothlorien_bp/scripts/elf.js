// Civilian elves in the running game (rules in elf_rules.js, entity in entities/elf.json, design docs/mobs/elves.md). Event-driven, no polling.
// Only the player-hurts-elf case lives here: the elf runs off by itself (panic goal), harmony hears about every new fight, and the hitter
// carries the tag lothlorien_elf_foe for FOE_MS, which the village wardens read (entities/elven_warden.json target entry, and
// elven_warden.js stops shielding that player from warden arrows). Kills are charged by harmony_game.js (entityDie).
import { system, world } from "@minecraft/server";
import { ELF_ID, FOE_MS, FOE_TAG } from "./elf_rules.js";
import { PLAYER_ID, isNewFight } from "./elven_warden_rules.js";

const TICKS_PER_MS = 20 / 1000;
const lastHit = new Map(); // player id -> Date.now() of the last hit on an elf (Date: readable in restricted mode)
const tokens = new Map(); // player id -> counter: only the latest hit's timer removes the tag

const playerOf = (id) => world.getPlayers().find((p) => p.id === id);

function removeTag(id) {
  try {
    playerOf(id)?.removeTag(FOE_TAG);
  } catch {
    // player gone
  }
}

// recordFight(player, elf): harmony_game.js recordElfFight
export function startElves({ recordFight }) {
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    try {
      const hitter = damageSource.damagingEntity;
      if (hurtEntity.typeId !== ELF_ID || hitter?.typeId !== PLAYER_ID) return;
      const now = Date.now(), at = lastHit.get(hitter.id);
      lastHit.set(hitter.id, now);
      if (isNewFight(at === undefined ? undefined : now - at)) recordFight(hitter, hurtEntity);
      hitter.addTag(FOE_TAG);
      const token = (tokens.get(hitter.id) ?? 0) + 1;
      tokens.set(hitter.id, token);
      const id = hitter.id;
      system.runTimeout(() => {
        if (tokens.get(id) !== token) return;
        tokens.delete(id);
        removeTag(id);
      }, Math.ceil(FOE_MS * TICKS_PER_MS));
    } catch {
      // entity gone
    }
  });
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    try {
      if (initialSpawn && player.hasTag(FOE_TAG)) player.removeTag(FOE_TAG); // a tag left over from before a reload or relog
    } catch {
      // player gone
    }
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    lastHit.delete(playerId);
    tokens.delete(playerId);
  });
}
