import { message } from "./messages.js";
// Ground squirrel errands in the running game (mobs/squirrel.md; rules in squirrel_rules.js). A Friend of Lothlorien offers a
// Mallorn acorn: the squirrel takes it, runs off to a spot 10-14 blocks away, digs a moment, comes back and drops a small
// gift (loot_tables/gifts/squirrel.json) at the player's feet. Not a Friend: it sniffs the acorn and keeps it.
//
// Like the white deer (white_deer.js) the squirrel is never moved by script. During the errand it sits in the component
// group `lothlorien:state_guiding` (entities/squirrel.json), whose follow goal makes the engine's navigator walk it to the
// nearest guide beacon; this script moves the beacon: to the away point, to the squirrel's feet while it digs, then onto
// the player. The beacon is the white deer's invisible helper entity (`minecraft:transient`, so none survives a reload).
import { GameMode, system, world } from "@minecraft/server";
import { harmonyOf } from "./harmony_game.js";
import { bandOf } from "./harmony.js";
import { eatHeldFood, healAnimal, isInjured } from "./animal_food.js";
import { noteDeed } from "./deeds.js";
import { moveBeacon, playerById, removeBeacon, say } from "./entity_util.js";
import { consumeHeld } from "./deferred_use.js";
import { stand } from "./white_deer.js";
import { villageDebug } from "./village_debug.js";
import { ACORN_ID, BEACON_ID } from "./white_deer_rules.js";
import {
  GIFT_TABLE, SQUIRREL_ID, SQUIRREL_TICKS, cooldownLeft, digTicks, horizontal, nextPhase, offerRefusal, pickAway, COOLDOWN_TICKS, GIFT_HEIGHT, MAX_TICKS,
} from "./squirrel_rules.js";

const READY_AT = "lothlorien:gift_ready_at"; // dynamic property on the squirrel: world time (ticks) of its next errand
const sessions = new Map(); // squirrel id -> { playerId, beaconId, away, born, phase, phaseStart, digFor }
let insideAt; // (dimension, location) -> boolean, from main.js
let sessionTimer;
function syncSessionTimer() {
  if (sessions.size && sessionTimer === undefined) sessionTimer = system.runInterval(tickSessions, SQUIRREL_TICKS);
  else if (!sessions.size && sessionTimer !== undefined) { system.clearRun(sessionTimer); sessionTimer = undefined; }
}

// Debug lines (content log, only while `/scriptevent lothlorien:debug` is on): one per offer outcome, phase change or exit,
// never per tick. `line` is a thunk, so no string is built while the switch is off.
const dlog = (line) => { if (villageDebug()) console.warn(`[lothlorien] squirrel: (debug) ${line()}`); };
const fmt = (p) => p ? `${(+p.x).toFixed(1)},${(+p.y).toFixed(1)},${(+p.z).toFixed(1)}` : "none";
const errText = (e) => (e && (e.stack || e.message)) || String(e);

export const isErrand = (squirrelId) => sessions.has(squirrelId);

const living = entity => entity?.isValid && entity.getComponent("minecraft:health")?.currentValue > 0;
const eligiblePlayer = player => living(player) && [GameMode.Survival, GameMode.Adventure, GameMode.Creative].includes(player.getGameMode());
const readyAt = (squirrel) => squirrel.getDynamicProperty(READY_AT) ?? 0;

function offer(player, squirrel) {
  if (sessions.has(squirrel.id)) { // already off on an errand: the acorn stays in the hand and the squirrel answers
    dlog(() => `offer ${squirrel.id}: refused (busy)`);
    say(player, message("squirrel.busy"));
    return;
  }
  if (squirrel.getProperty("lothlorien:guiding")) {
    dlog(() => `offer ${squirrel.id}: refused (guiding flag without a session)`);
    return;
  }
  if (squirrel.getProperty("lothlorien:alarmed")) { // a player hit a wary animal nearby: the acorn is kept
    dlog(() => `offer ${squirrel.id}: refused (alarmed)`);
    say(player, message("squirrel.startled"));
    return;
  }
  // A lead wins over errands. It is still possible to feed a squirrel on a lead.
  if (squirrel.getComponent("minecraft:leashable")?.isLeashed) {
    const fed = eatHeldFood(player, squirrel, ACORN_ID);
    if (fed) squirrel.triggerEvent("lothlorien:fed");
    dlog(() => `offer ${squirrel.id}: ${fed ? "fed (leashed)" : "nothing eaten (leashed)"}`);
    return;
  }
  const band = bandOf(harmonyOf(player).harmony);
  const left = cooldownLeft(world.getAbsoluteTime(), readyAt(squirrel));
  const refusal = offerRefusal({ band, cooldownLeft: left });
  if (refusal === "restless") {
    dlog(() => `offer ${squirrel.id}: refused (restless)`);
    return say(player, message("squirrel.restless"));
  }
  if (refusal === "untrusted") {
    dlog(() => `offer ${squirrel.id}: refused (untrusted)`);
    return say(player, message("squirrel.untrusted"));
  }
  if (refusal === "full") {
    // On cooldown nothing starts: a hurt squirrel still eats and heals (a healthy one keeps the acorn).
    if (isInjured(squirrel) && eatHeldFood(player, squirrel, ACORN_ID)) {
      dlog(() => `offer ${squirrel.id}: fed (injured, on cooldown)`);
      return say(player, message("squirrel.fed"));
    }
    dlog(() => `offer ${squirrel.id}: refused (full)`);
    return say(player, message("squirrel.full"));
  }
  const dimension = squirrel.dimension;
  const away = pickAway(squirrel.location, (x, z, y) => stand(dimension, x, z, y), Math.random() * 2 * Math.PI);
  if (!away) {
    dlog(() => `offer ${squirrel.id}: refused (no_path)`);
    return say(player, message("squirrel.no_path"));
  }
  let beaconId;
  try {
    beaconId = dimension.spawnEntity(BEACON_ID, { x: away.x, y: away.y, z: away.z }).id;
    squirrel.triggerEvent("lothlorien:guide_start");
    sessions.set(squirrel.id, { playerId: player.id, dimensionId: dimension.id, actor: squirrel, beaconId, away, born: system.currentTick, phase: "away", phaseStart: system.currentTick, digFor: 0 });
    syncSessionTimer();
    consumeHeld(player, ACORN_ID); // only now: the errand really starts (a failed start keeps the acorn)
    healAnimal(squirrel); // a hurt squirrel is healed by the acorn that starts its errand
    dlog(() => `accept ${squirrel.id}: away ${fmt(away)} (squirrel ${fmt(squirrel.location)})`);
    say(player, message("squirrel.accept"));
    try { noteDeed(player, "squirrel"); } catch { /* optional lesson feedback */ }
  } catch (e) {
    dlog(() => `offer failed: ${errText(e)}`);
    end(squirrel.id, squirrel, player, "squirrel.no_path", "start failed");
    removeBeacon(beaconId);
  }
}

// Ends the errand: beacon removed, the squirrel back to its wild state (or, if it was hurt meanwhile, left alarmed), `key` (a
// message key, or undefined for silent) said to the player. `reason` is only for the debug line.
function end(squirrelId, squirrel, player, key, reason = "ended") {
  const s = sessions.get(squirrelId);
  sessions.delete(squirrelId);
  syncSessionTimer();
  removeBeacon(s?.beaconId);
  try {
    if (squirrel?.isValid && squirrel.getProperty("lothlorien:guiding")) {
      squirrel.triggerEvent(squirrel.getProperty("lothlorien:alarmed") ? "lothlorien:guide_abort" : "lothlorien:guide_end");
    }
  } catch {
    // squirrel unloaded
  }
  if (s) dlog(() => `end (${reason}): ${key && player ? key : "silent"}`);
  if (player && key) say(player, message(key));
}

// undefined while the errand may go on, else why it ends. Leaving the forest is not a reason: an errand that started inside
// finishes wherever it runs (R8, 2026-11-22).
function ineligible(squirrel, player, s) {
  if (!living(squirrel)) return "squirrel dead";
  if (!eligiblePlayer(player)) return "player dead or Spectator";
  if (squirrel.dimension.id !== s.dimensionId || player.dimension.id !== s.dimensionId) return "dimension";
  if (bandOf(harmonyOf(player).harmony) !== "friend") return "player below Friend";
  if (!squirrel.getProperty("lothlorien:guiding")) return "guiding state cleared";
  return undefined;
}
function giveGift(squirrelId, squirrel, player) {
  const { x, y, z } = squirrel.location, at = { x, y: y + .3, z };
  const manager = world.getLootTableManager();
  for (const item of manager.generateLootFromTable(manager.getLootTable(GIFT_TABLE))) squirrel.dimension.spawnItem(item, at);
  squirrel.setDynamicProperty(READY_AT, world.getAbsoluteTime() + COOLDOWN_TICKS);
  try { squirrel.dimension.spawnParticle("minecraft:heart_particle", { x, y: y + .6, z }); } catch { /* cosmetic only */ }
  dlog(() => `gift at ${fmt({ x, y, z })}`);
  end(squirrelId, squirrel, player, "squirrel.gift", "gift");
}

function tickSession(squirrelId, s) {
  const squirrel = world.getEntity(squirrelId);
  const player = playerById(s.playerId);
  if (!player?.isValid) return end(squirrelId, squirrel, undefined, undefined, "player gone"); // nobody to tell
  if (!squirrel?.isValid) return end(squirrelId, squirrel, player, "squirrel.abort", "squirrel gone");
  if (!living(squirrel)) return end(squirrelId, squirrel, undefined, undefined, "squirrel dead"); // a dead squirrel is silent
  if (squirrel.getComponent("minecraft:leashable")?.isLeashed) return end(squirrelId, squirrel, player, "squirrel.stop_leashed", "leashed");
  if (squirrel.getProperty("lothlorien:alarmed")) return end(squirrelId, squirrel, player, "squirrel.alarmed", "alarmed");
  const why = ineligible(squirrel, player, s);
  if (why) return end(squirrelId, squirrel, player, "squirrel.abort", why);
  const now = system.currentTick;
  let beacon = world.getEntity(s.beaconId);
  if (!beacon?.isValid) {
    beacon = squirrel.dimension.spawnEntity(BEACON_ID, { x: s.away.x, y: s.away.y, z: s.away.z }); // lost (chunk unloaded, /kill)
    s.beaconId = beacon.id;
  }
  let next = nextPhase({
    phase: s.phase,
    age: now - s.born,
    phaseAge: now - s.phaseStart,
    toBeacon: horizontal(squirrel.location, s.away),
    toPlayer: horizontal(squirrel.location, player.location),
    digFor: s.digFor,
  });
  // Horizontally near but on another level (a platform the squirrel cannot climb to): keep trying until the time cap.
  if (next === "gift" && Math.abs(squirrel.location.y - player.location.y) > GIFT_HEIGHT) next = "return";
  if (next === "abort") return end(squirrelId, squirrel, player, "squirrel.abort", `abort (${horizontal(squirrel.location, player.location).toFixed(0)} blocks from the player, ${now - s.born} ticks)`);
  if (next === "gift") return giveGift(squirrelId, squirrel, player);
  if (next !== s.phase) {
    dlog(() => `phase ${s.phase}->${next} (${horizontal(squirrel.location, s.away).toFixed(1)} blocks from away, ${now - s.phaseStart} ticks in ${s.phase})`);
    s.phase = next;
    s.phaseStart = now;
    if (next === "dig") {
      s.digFor = digTicks(Math.random());
      moveBeacon(beacon, squirrel.location); // stand still and dig
    }
  }
  if (s.phase === "return") moveBeacon(beacon, player.location);
}

function tickSessions() {
  for (const [squirrelId, s] of sessions) {
    if (system.currentTick - s.born > MAX_TICKS) {
      end(squirrelId, s.actor, playerById(s.playerId), "squirrel.abort", "time cap");
      continue;
    }
    try {
      tickSession(squirrelId, s);
    } catch (e) {
      // Anything unexpected releases the squirrel and tells the player; both are read again, they may be what failed.
      dlog(() => `tick failed: ${errText(e)}`);
      let squirrel, player;
      try { squirrel = world.getEntity(squirrelId); player = playerById(s.playerId); } catch { /* unloaded */ }
      end(squirrelId, squirrel, player, "squirrel.abort", "error");
    }
  }
}

// inside(dimension, location) -> boolean (main.js insideAt); the default derives it from `depth`, which only tests supply.
export function startSquirrels(depth = () => ({ level: 1 }), inside = (dimension, location) => depth(dimension, location).level > 0) {
  insideAt = inside;
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId !== SQUIRREL_ID || (beforeItemStack ?? itemStack)?.typeId !== ACORN_ID) return;
      if (!insideAt(target.dimension, target.location)) {
        // Outside Lothlorien: an ordinary tame-by-feeding, and the player is told it runs no errands. An errand squirrel
        // clicked out here (it ran past the forest edge) ends first.
        const had = sessions.has(target.id);
        end(target.id, target, player, had ? "squirrel.abort" : undefined, "outside");
        const fed = eatHeldFood(player, target, ACORN_ID);
        if (fed) {
          target.triggerEvent("lothlorien:fed");
          say(player, message("squirrel.outside"));
        }
        dlog(() => `offer ${target.id}: ${fed ? "fed" : "nothing eaten"} (outside)`);
        return;
      }
      offer(player, target);
    } catch (e) {
      dlog(() => `offer failed: ${errText(e)}`); // squirrel or player gone
    }
  });
}
