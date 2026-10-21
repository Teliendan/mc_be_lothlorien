import { message } from "./messages.js";
// Ground squirrel errands in the running game (Phase 15; rules in squirrel_rules.js). A Friend of Lothlorien offers a
// Mallorn acorn: the squirrel takes it, runs off to a spot 10-14 blocks away, digs a moment, comes back and drops a small
// gift (loot_tables/gifts/squirrel.json) at the player's feet. Not a Friend: it sniffs the acorn and keeps it.
//
// Like the white deer (white_deer.js) the squirrel is never moved by script. During the errand it sits in the component
// group `lothlorien:state_guiding` (entities/squirrel.json), whose follow goal makes the engine's navigator walk it to the
// nearest guide beacon; this script moves the beacon: to the away point, to the squirrel's feet while it digs, then onto
// the player. The beacon is the white deer's invisible helper entity, so white_deer.js's stray sweep is told about ours.
import { EquipmentSlot, GameMode, system, world } from "@minecraft/server";
import { harmonyOf } from "./harmony_game.js";
import { bandOf } from "./harmony.js";
import { repeatedUse } from "./use_guard.js";
import { eatHeldFood, healAnimal, isInjured } from "./animal_food.js";
import { noteDeed } from "./deeds.js";
import { addBeaconSource, stand } from "./white_deer.js";
import { withinReach } from "./interaction_use.js";
import { ACORN_ID, BEACON_ID } from "./white_deer_rules.js";
import {
  GIFT_TABLE, SQUIRREL_ID, SQUIRREL_TICKS, cooldownLeft, digTicks, horizontal, nextPhase, offerRefusal, pickAway, COOLDOWN_TICKS, GIFT_DIST, MAX_TICKS,
} from "./squirrel_rules.js";

const READY_AT = "lothlorien:gift_ready_at"; // dynamic property on the squirrel: world time (ticks) of its next errand
const sessions = new Map(); // squirrel id -> { playerId, beaconId, away, born, phase, phaseStart, digFor }
const delivered = new Map(); // known deliveries whose persistent cooldown could not be confirmed
let depthAt;
let sessionTimer;
function syncSessionTimer() {
  if (sessions.size && sessionTimer === undefined) sessionTimer = system.runInterval(tickSessions, SQUIRREL_TICKS);
  else if (!sessions.size && sessionTimer !== undefined) { system.clearRun(sessionTimer); sessionTimer = undefined; }
}

export const isErrand = (squirrelId) => sessions.has(squirrelId);

const say = (player, text) => {
  try {
    player.sendMessage(text); // chat: the action bar belongs to the Harmony status (harmony_game.js)
  } catch {
    // player left
  }
};

function removeBeacon(beaconId) {
  try {
    const beacon = beaconId && world.getEntity(beaconId);
    if (beacon?.isValid) beacon.remove();
  } catch {
    // already gone
  }
}

const moveBeacon = (beacon, to) => beacon.teleport({ x: to.x, y: to.y, z: to.z });

const living = entity => entity?.isValid && entity.getComponent("minecraft:health")?.currentValue > 0;
const eligiblePlayer = player => living(player) && [GameMode.Survival, GameMode.Adventure, GameMode.Creative].includes(player.getGameMode());
const distance3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function readyAt(squirrel) {
  const now = world.getAbsoluteTime(), remembered = delivered.get(squirrel.id);
  if (remembered !== undefined && remembered <= now) delivered.delete(squirrel.id);
  return Math.max(squirrel.getDynamicProperty(READY_AT) ?? 0, delivered.get(squirrel.id) ?? 0);
}
function spendAcorn(hand, mode) {
  if (mode !== GameMode.Creative) {
    if (hand.item.amount > 1) {
      const remainder = hand.item.clone(); remainder.amount--;
      hand.slot.setItem(remainder);
    } else hand.slot.setItem(undefined);
  }
}

function offer(player, squirrel, hand, mode) {
  if (sessions.has(squirrel.id)) return;
  if (squirrel.getProperty("lothlorien:guiding")) return;
  // A lead wins over errands. It is still possible to feed a squirrel on a lead.
  if (squirrel.getComponent("minecraft:leashable")?.isLeashed) {
    if (eatHeldFood(player, squirrel, ACORN_ID)) squirrel.triggerEvent("lothlorien:fed");
    return;
  }
  const band = bandOf(harmonyOf(player).harmony);
  const left = cooldownLeft(world.getAbsoluteTime(), readyAt(squirrel));
  const refusal = offerRefusal({ band, cooldownLeft: left });
  if (refusal === "restless") return say(player, message("squirrel.restless"));
  if (refusal === "untrusted") return say(player, message("squirrel.untrusted"));
  if (isInjured(squirrel)) {
    eatHeldFood(player, squirrel, ACORN_ID);
    return;
  }
  if (refusal === "full") return say(player, message("squirrel.full"));
  const dimension = squirrel.dimension;
  const away = pickAway(squirrel.location, (x, z, y) => stand(dimension, x, z, y), Math.random() * 2 * Math.PI);
  if (!away) return say(player, message("squirrel.no_path"));
  let beaconId;
  try {
    beaconId = dimension.spawnEntity(BEACON_ID, { x: away.x, y: away.y, z: away.z }).id;
    // Acceptance and charging are synchronous; no player action can interleave
    // the path query/helper spawn and this write. Preserve the accepted stack.
    spendAcorn(hand, mode);
    squirrel.triggerEvent("lothlorien:guide_start");
    healAnimal(squirrel);
    sessions.set(squirrel.id, { playerId: player.id, dimensionId: dimension.id, actor: squirrel, beaconId, away, born: system.currentTick, phase: "away", phaseStart: system.currentTick, digFor: 0 });
    syncSessionTimer();
    say(player, message("squirrel.accept"));
    try { noteDeed(player, "squirrel"); } catch { /* optional lesson feedback */ }
  } catch {
    end(squirrel.id, squirrel);
    removeBeacon(beaconId);
  }
}

// Ends the errand: beacon removed, the squirrel back to its wariness state (or, if it was hurt meanwhile, left alarmed).
function end(squirrelId, squirrel, player, text) {
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
  if (player && text) say(player, text);
}

function sessionEligible(squirrel, player, s) {
  if (!(living(squirrel) && eligiblePlayer(player) && squirrel.dimension.id === s.dimensionId &&
    player.dimension.id === s.dimensionId && bandOf(harmonyOf(player).harmony) === "friend" &&
    squirrel.getProperty("lothlorien:guiding") && !squirrel.getProperty("lothlorien:alarmed") &&
    !squirrel.getComponent("minecraft:leashable")?.isLeashed)) return false;
  const depth = depthAt(squirrel.dimension, squirrel.location);
  if (depth.level > 0) return true;
  return depth.level === 0 && depth.complete === true ? false : undefined;
}
function giftSpace(dimension, at) {
  for (const y of [at.y, at.y + .25]) {
    const block = dimension.getBlock({ ...at, y });
    if (!block || block.isLiquid || block.isWaterlogged || (!block.isAir && block.isSolid !== false)) return false;
  }
  return true;
}
function giveGift(squirrelId, squirrel, player) {
  const s = sessions.get(squirrelId);
  if (!s || cooldownLeft(world.getAbsoluteTime(), readyAt(squirrel)) > 0) return false;
  const { x, y, z } = squirrel.location, at = { x, y: y + .3, z };
  const next = world.getAbsoluteTime() + COOLDOWN_TICKS;
  try {
    if (!giftSpace(squirrel.dimension, at)) return false;
    const manager = world.getLootTableManager(), table = manager.getLootTable(GIFT_TABLE);
    const items = table && manager.generateLootFromTable(table);
    if (!items || items.length !== 1 || !(items[0].amount > 0)) {
      end(squirrelId, squirrel, player, message("squirrel.abort")); return false;
    }
    // Eligibility/proximity were decided by this synchronous session step.
    // Do not turn a thrown/ambiguous spawn into a speculative second attempt.
    if (!squirrel.dimension.spawnItem(items[0], at)) throw Error("Item spawn did not confirm delivery");
  } catch {
    end(squirrelId, squirrel, player, message("squirrel.abort")); return false;
  }
  delivered.set(squirrelId, next); // known delivery, before any fallible persistent/cosmetic writes
  try {
    squirrel.setDynamicProperty(READY_AT, next);
    if (squirrel.getDynamicProperty(READY_AT) === next) delivered.delete(squirrelId);
  } catch { /* retain the runtime cooldown guard; separate engine writes are not atomic */ }
  try { squirrel.dimension.spawnParticle("minecraft:heart_particle", { x, y: y + .6, z }); } catch { /* cosmetic only */ }
  end(squirrelId, squirrel, player, message("squirrel.gift"));
  return true;
}

function tickSession(squirrelId, s) {
  const squirrel = world.getEntity(squirrelId);
  const player = world.getPlayers().find((p) => p.id === s.playerId);
  if (!squirrel?.isValid || !player?.isValid) return end(squirrelId, squirrel, undefined, undefined);
  if (squirrel.getComponent("minecraft:leashable")?.isLeashed) return end(squirrelId, squirrel);
  if (squirrel.getProperty("lothlorien:alarmed")) return end(squirrelId, squirrel, player, message("squirrel.alarmed"));
  const eligibility = sessionEligible(squirrel, player, s);
  if (eligibility === undefined) return; // unknown biome read pauses only this paid, time-bounded session
  if (!eligibility) return end(squirrelId, squirrel, player, message("squirrel.abort"));
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
  if (next === "gift" && distance3(squirrel.location, player.location) > GIFT_DIST) next = "return";
  if (next === "abort") return end(squirrelId, squirrel, player, message("squirrel.abort"));
  if (next === "gift") return giveGift(squirrelId, squirrel, player);
  if (next !== s.phase) {
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
    if (system.currentTick - s.born > MAX_TICKS) { end(squirrelId, s.actor); continue; }
    try {
      tickSession(squirrelId, s);
    } catch {
      // An unreadable actor/biome/beacon does not authorize a gift or erase its
      // tracking. Retry only within this existing, bounded errand lifetime.
    }
  }
}

export function startSquirrels(depth = () => ({ level: 1 })) {
  depthAt = depth;
  addBeaconSource(() => [...sessions.values()].map((s) => s.beaconId));
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId !== SQUIRREL_ID || (beforeItemStack ?? itemStack)?.typeId !== ACORN_ID) return;
      if (!eligiblePlayer(player) || !living(target) || target.dimension.id !== player.dimension.id ||
          !withinReach(player, target.location)) return;
      const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand), item = slot?.getItem();
      if (item?.typeId !== ACORN_ID) return;
      const hand = { slot, item }, mode = player.getGameMode();
      if (repeatedUse(player, "squirrel")) return;
      const depth = depthAt(target.dimension, target.location);
      if (depth.level === 0 && depth.complete === true) {
        end(target.id, target);
        if (eatHeldFood(player, target, ACORN_ID)) target.triggerEvent("lothlorien:fed");
        return;
      }
      if (!(depth.level > 0)) return;
      if (target.getProperty("lothlorien:alarmed")) return;
      offer(player, target, hand, mode);
    } catch {
      // squirrel or player gone
    }
  });
}
