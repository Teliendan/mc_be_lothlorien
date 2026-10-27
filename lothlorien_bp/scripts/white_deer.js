import { message } from "./messages.js";
// White deer guidance in the running game (Phase 12; rules in white_deer_rules.js). Offer a Mallorn acorn to a white
// deer (lothlorien:white_deer) as a Friend of Lothlorien: once in its life it leads you to its gift, a Great Mallorn nut
// (great_mallorn.js), at a spot inside Lothlorien 36-56 blocks away, waiting for the player to keep up, and lays the nut
// there on arrival. The spot is kept on the deer (dynamic property) until the gift is given, so a broken-off guidance
// can be taken up again with another acorn. A leashed white deer does not lead (white_deer_rules.js, offerRefusal).
// Natural spawns are thinned by depth.
//
// The deer is never moved by script. While it guides, it sits in the component group `lothlorien:state_guiding`
// (entities/white_deer.json), whose follow goal makes the engine's navigator walk it to the nearest guide beacon: an
// invisible helper entity (entities/guide_beacon.json), one per session, that this script spawns and moves ahead in
// hops of 8-14 blocks. Several guiding deer close together may follow each other's beacon (accepted by the owner).
import { EntityInitializationCause, EquipmentSlot, GameMode, ItemStack, system, world } from "@minecraft/server";
import { harmonyOf } from "./harmony_game.js";
import { bandOf } from "./harmony.js";
import { eatHeldFood, healAnimal, isInjured } from "./animal_food.js";
import {
  ACORN_ID, BEACON_ID, GUIDE_TICKS, WHITE_DEER_ID, canBeGuided, hopStatus, horizontal, keepNaturalSpawn,
  newHop, offerRefusal, phase, pickWaypoint, trackProgress,
} from "./white_deer_rules.js";
import { NUT_ID, borderGrid, giftCandidates, pickGiftSpot } from "./great_mallorn_rules.js";

// session: { playerId, beaconId, target, bestDist, stuck, born, phase, hop, skip, bias, waiting }
const sessions = new Map(); // deer id -> session
const searching = new Set(); // deer ids with a gift spot search in progress
const GIFT_SPOT = "lothlorien:gift_spot"; // dynamic property on the deer: JSON {x, y, z, dim} until the gift is given
const GIFTED = "lothlorien:gifted"; // dynamic property on the deer: true once the nut was laid
let depthAt; // (dimension, location) -> { level }, from main.js
let biome; // { id, transparent: Set, at(dimension, x, z) -> surface biome id or undefined (unloaded) }, from main.js
const DIMENSIONS = ["overworld", "nether", "the_end"];
const DOWN = { x: 0, y: -1, z: 0 };
const UP = { x: 0, y: 1, z: 0 };
const PROBE_UP = 6; // a waypoint column is searched from 6 above to 6 below the deer's feet
const PROBE_DOWN = 6;
let sessionTimer;
function syncSessionTimer() {
  if (sessions.size && sessionTimer === undefined) sessionTimer = system.runInterval(tickSessions, GUIDE_TICKS);
  else if (!sessions.size && sessionTimer !== undefined) { system.clearRun(sessionTimer); sessionTimer = undefined; }
}

export const isGuiding = (deerId) => sessions.has(deerId);

// Other users of the guide beacon (the squirrel's errand, squirrel.js) register a function returning their beacon ids,
// so the stray-beacon sweep below leaves them alone.
const beaconSources = [];
export const addBeaconSource = (fn) => beaconSources.push(fn);

const isLeashed = (deer) => deer.getComponent("minecraft:leashable")?.isLeashed ?? false;

const say = (player, text) => {
  try {
    player.sendMessage(text); // chat: the action bar belongs to the Harmony status (harmony_game.js)
  } catch {
    // player left
  }
};

// Feet height at column (x, z) found from the top: the first ground under air, plants, leaves and logs (a crown over
// the forest floor is not ground), with two blocks of headroom; undefined for water, an unloaded chunk or no ground.
function groundFeet(dimension, x, z) {
  try {
    let b = dimension.getTopmostBlock({ x, z });
    while (b && !b.isLiquid && (passable(b) || canopy(b.typeId))) {
      b = b.below();
    }
    if (!b || b.isLiquid || !b.isSolid) return undefined;
    const feet = b.y + 1;
    return clearBody(dimension, x, feet, z) ? feet : undefined;
  } catch {
    return undefined; // unloaded chunk
  }
}
const canopy = id => id.includes("leaves") || id.endsWith("_log") || id.endsWith("_wood");
const passable = block => !!block && !block.isLiquid && !block.isWaterlogged && (block.isAir || block.isSolid === false);
function clearBody(dimension, x, y, z) {
  return passable(dimension.getBlock({ x, y, z })) && passable(dimension.getBlock({ x, y: y + 1, z }));
}
function giftSpace(dimension, spot) {
  try {
    const below = dimension.getBlock({ x: spot.x, y: spot.y - 1, z: spot.z });
    return !!below?.isSolid && !below.isLiquid && !canopy(below.typeId) &&
      clearBody(dimension, spot.x, spot.y, spot.z);
  } catch { return false; }
}
const insideGift = (dimension, spot) => biome.at(dimension, spot.x, spot.z) === biome.id;

// The gift spot for a deer at `origin` (great_mallorn_rules.js, pickGiftSpot): first the border scan over the loaded grid, then
// the candidates, a few dozen probes per job step. Calls done({x, y, z}) or done(undefined).
function findGiftSpot(dimension, origin, done) {
  system.runJob(
    (function* () {
      const border = [];
      let n = 0;
      for (const p of borderGrid(origin.x, origin.z)) {
        const id = biome.at(dimension, p.x, p.z);
        if (id !== undefined && id !== biome.id && !biome.transparent.has(id)) border.push(p);
        if (++n % 40 === 0) yield;
      }
      const candidates = giftCandidates(origin.x, origin.z, Math.random() * 2 * Math.PI);
      for (const c of candidates) {
        c.inside = biome.at(dimension, c.x, c.z) === biome.id;
        c.y = c.inside ? groundFeet(dimension, c.x, c.z) : undefined;
        if (++n % 40 === 0) yield;
      }
      const best = pickGiftSpot(candidates, border);
      done(best && { x: best.x, y: best.y, z: best.z });
    })()
  );
}

function storedSpot(deer) {
  try {
    const raw = deer.getDynamicProperty(GIFT_SPOT);
    const spot = typeof raw === "string" ? JSON.parse(raw) : undefined;
    return spot?.dim === deer.dimension.id ? spot : undefined;
  } catch {
    return undefined;
  }
}

// Lay one nut at the spot, then record lifetime completion. A spot that is no longer clear (or no longer inside Lothlorien)
// is forgotten, so the next acorn searches a new one.
function giveGift(deer, s) {
  const spot = s.spot;
  if (!giftSpace(deer.dimension, spot) || !insideGift(deer.dimension, spot)) {
    deer.setDynamicProperty(GIFT_SPOT, undefined);
    return false;
  }
  const at = { x: spot.x + 0.5, y: spot.y + 0.2, z: spot.z + 0.5 };
  const nut = new ItemStack(NUT_ID, 1);
  nut.setLore([message("nut.lore.tree"), message("nut.lore.space"), message("nut.lore.plant")]);
  deer.dimension.spawnItem(nut, at);
  deer.setDynamicProperty(GIFTED, true);
  deer.setDynamicProperty(GIFT_SPOT, undefined);
  try { deer.dimension.spawnParticle("minecraft:totem_particle", at); } catch { /* cosmetic only */ }
  return true;
}

// Feet height of a deer standing in column (x, z) near feet height y, or undefined: ground within PROBE_UP above to
// PROBE_DOWN below, no liquid, not on a tree trunk, two blocks of headroom. Passable plants (grass, ferns, flowers,
// leaf litter) do not stop the rays; leaves are looked through (a canopy over the forest floor is not ground).
export function stand(dimension, x, z, y) {
  try {
    let from = y + PROBE_UP;
    const bottom = y - PROBE_DOWN;
    for (let i = 0; i < 4 && from > bottom; i++) {
      const hit = dimension.getBlockFromRay({ x, y: from, z }, DOWN, { maxDistance: from - bottom, includeLiquidBlocks: true });
      if (!hit || hit.block.isLiquid) return undefined;
      const id = hit.block.typeId;
      if (id.includes("leaves")) {
        from = hit.block.y - 0.01;
        continue;
      }
      if (id.includes("log") || id.endsWith("_wood")) return undefined;
      const feet = hit.block.y + 1;
      return dimension.getBlockFromRay({ x, y: feet + 0.05, z }, UP, { maxDistance: 1.9 }) ? undefined : feet;
    }
    return undefined;
  } catch {
    return undefined; // unloaded chunk
  }
}

const standIn = (dimension) => (x, z, y) => stand(dimension, x, z, y);

export function consumeAcorn(player) {
  if (player.getGameMode() === GameMode.Creative) return;
  const slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
  if (!slot?.hasItem() || slot.typeId !== ACORN_ID) return;
  if (slot.amount > 1) slot.amount -= 1;
  else slot.setItem(undefined);
}

function removeBeacon(beaconId) {
  try {
    const beacon = beaconId && world.getEntity(beaconId);
    if (beacon?.isValid) beacon.remove();
  } catch {
    // already gone
  }
}

function activePlayer(player) {
  return player?.isValid && player.getGameMode() !== GameMode.Spectator &&
    player.getComponent("minecraft:health")?.currentValue > 0;
}
// A few ticks after the click (the gift spot search is a job): the deer and player are still there, the same acorn is in
// the selected slot.
function stillOffering(player, deer, offered) {
  try {
    if (!player.isValid || !deer.isValid || !(deer.getComponent("minecraft:health")?.currentValue > 0) ||
        deer.dimension.id !== offered.dimension.id || player.selectedSlotIndex !== offered.index) return false;
    return player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand).typeId === ACORN_ID;
  } catch { return false; }
}
function offer(player, deer) {
  if (sessions.has(deer.id) || searching.has(deer.id)) return;
  const refusal = offerRefusal({ band: bandOf(harmonyOf(player).harmony), leashed: isLeashed(deer) });
  if (refusal === "leashed") {
    say(player, message("deer.leashed"));
    return;
  }
  if (refusal === "untrusted") {
    say(player, message("deer.untrusted"));
    return;
  }
  if (refusal) {
    say(player, message("deer.restless"));
    return;
  }
  // A completed gift never prevents healing; feeding does not reset that gift.
  if (isInjured(deer)) {
    eatHeldFood(player, deer, ACORN_ID);
    return;
  }
  if (deer.getDynamicProperty(GIFTED)) {
    say(player, message("deer.gifted"));
    return;
  }
  const offered = { dimension: deer.dimension, index: player.selectedSlotIndex };
  const kept = storedSpot(deer);
  if (kept) {
    if (giftSpace(deer.dimension, kept) && insideGift(deer.dimension, kept)) {
      lead(player, deer, kept);
      return;
    }
    deer.setDynamicProperty(GIFT_SPOT, undefined); // blocked, flooded or unreadable meanwhile: search a new spot
  }
  searching.add(deer.id);
  findGiftSpot(offered.dimension, deer.location, (spot) => {
    searching.delete(deer.id);
    try {
      if (!stillOffering(player, deer, offered)) return;
      if (spot) lead(player, deer, spot);
      else say(player, message("deer.no_spot"));
    } catch {
      // deer or player gone
    }
  });
}

// Start a guidance session to `spot` ({x, y, z}).
function lead(player, deer, spot) {
  let beaconId;
  try {
    const dimension = deer.dimension;
    const target = { x: spot.x + 0.5, z: spot.z + 0.5 };
    const wp = pickWaypoint(deer.location, target, standIn(dimension));
    if (!wp) {
      say(player, message("deer.no_path"));
      return;
    }
    deer.setDynamicProperty(GIFT_SPOT, JSON.stringify({ ...spot, dim: dimension.id }));
    const beacon = dimension.spawnEntity(BEACON_ID, { x: wp.x, y: wp.y, z: wp.z });
    beaconId = beacon.id;
    deer.triggerEvent("lothlorien:become_tame"); // fed: persistent, and after guiding it comes back as state_tame
    deer.triggerEvent("lothlorien:guide_start");
    consumeAcorn(player); // only now: guidance really starts
    healAnimal(deer);
    sessions.set(deer.id, {
      playerId: player.id,
      dimensionId: dimension.id,
      beaconId,
      target,
      spot,
      bestDist: horizontal(deer.location, target),
      stuck: 0,
      born: system.currentTick,
      phase: "walk",
      hop: newHop(wp, deer.location),
      skip: new Set(),
      bias: wp.turn || 1,
      waiting: false,
    });
    syncSessionTimer();
    say(player, message("deer.accept"));
  } catch {
    sessions.delete(deer.id);
    syncSessionTimer();
    removeBeacon(beaconId);
  }
}

function end(deerId, deer, player, text) {
  const s = sessions.get(deerId);
  sessions.delete(deerId);
  syncSessionTimer();
  removeBeacon(s?.beaconId);
  try {
    if (deer?.isValid && deer.getProperty("lothlorien:guiding")) deer.triggerEvent("lothlorien:guide_end");
  } catch {
    // deer unloaded
  }
  if (player && text) say(player, text);
}

function arrive(deerId, deer, player, s) {
  const delivered = giveGift(deer, s);
  end(deerId, deer, player, message(delivered ? "deer.gift" : "deer.no_spot"));
}

const moveBeacon = (beacon, to) => beacon.teleport({ x: to.x, y: to.y, z: to.z });

// The session's beacon, respawned at `at` if it was lost (chunk unloaded, killed by /kill). undefined = cannot.
function beaconOf(s, dimension, at) {
  const beacon = world.getEntity(s.beaconId);
  if (beacon?.isValid) return beacon;
  const fresh = dimension.spawnEntity(BEACON_ID, { x: at.x, y: at.y, z: at.z });
  s.beaconId = fresh.id;
  return fresh;
}

// One hop step while walking: follow the current waypoint, pick the next when it is reached, turn when stuck.
function walk(s, deer, beacon) {
  const status = hopStatus(s.hop, deer.location, GUIDE_TICKS);
  if (status === "go") return "go";
  if (status === "next") {
    if (s.hop.wp.final) return "arrived"; // stood at the last waypoint at the spot
    s.skip.clear();
  } else s.skip.add(s.hop.wp.deg);
  let wp = pickWaypoint(deer.location, s.target, standIn(deer.dimension), { bias: s.bias, skip: s.skip });
  if (!wp && s.skip.size) {
    s.skip.clear(); // every heading failed once: start the round again
    wp = pickWaypoint(deer.location, s.target, standIn(deer.dimension), { bias: -s.bias });
  }
  if (!wp) {
    s.hop.stuck = 0; // keep the old waypoint; the session's own stuck timer ends it if nothing helps
    return "go";
  }
  s.bias = wp.turn || s.bias;
  s.hop = newHop(wp, deer.location);
  moveBeacon(beacon, wp);
  return "go";
}

function tickSession(deerId, s) {
  const deer = world.getEntity(deerId);
  const player = world.getPlayers().find((p) => p.id === s.playerId);
  if (!deer?.isValid || !(deer.getComponent("minecraft:health")?.currentValue > 0) || !activePlayer(player) || deer.dimension.id !== player.dimension.id ||
      deer.dimension.id !== s.dimensionId) return end(deerId, deer, player, undefined);
  const playerCalm = canBeGuided(bandOf(harmonyOf(player).harmony));
  if (!playerCalm) return end(deerId, deer, player, message("deer.abort"));
  if (!deer.getProperty("lothlorien:guiding")) return end(deerId, deer, undefined, undefined); // hurt: the alarm cleared the state
  const toTarget = horizontal(deer.location, s.target);
  const toPlayer = horizontal(deer.location, player.location);
  trackProgress(s, toTarget, s.phase === "walk", GUIDE_TICKS);
  s.phase = phase({
    toTarget,
    toPlayer,
    stuck: s.stuck,
    age: system.currentTick - s.born,
    playerCalm,
    leashed: isLeashed(deer),
  });
  if (s.phase === "leashed") return end(deerId, deer, player, message("deer.stop_leashed"));
  if (s.phase === "arrived") return arrive(deerId, deer, player, s);
  if (s.phase === "abort") return end(deerId, deer, player, message("deer.abort"));
  const beacon = beaconOf(s, deer.dimension, s.waiting ? deer.location : s.hop.wp);
  if (s.phase === "wait") {
    // the player lags: the beacon comes to the deer's feet, so the deer stands and waits
    if (!s.waiting) moveBeacon(beacon, deer.location);
    s.waiting = true;
    return;
  }
  if (s.waiting) {
    s.waiting = false;
    moveBeacon(beacon, s.hop.wp);
    s.hop = newHop(s.hop.wp, deer.location);
    return;
  }
  if (walk(s, deer, beacon) === "arrived") arrive(deerId, deer, player, s);
}

// Beacons with no session: left over from a reload (sessions are not saved) or a chunk that unloaded and came back.
// A beacon named or tagged `guide_beacon` was placed by hand for the goal experiment (tools/dev_scripts/guide_goal) and is kept;
// its own 330 s timer removes it.
function sweepBeacons() {
  const live = new Set([...sessions.values()].map((s) => s.beaconId));
  for (const source of beaconSources) for (const id of source()) live.add(id);
  for (const id of DIMENSIONS) {
    try {
      for (const beacon of world.getDimension(id).getEntities({ type: BEACON_ID })) {
        if (!live.has(beacon.id) && !beacon.hasTag("guide_beacon") && beacon.nameTag !== "guide_beacon") beacon.remove();
      }
    } catch {
      // dimension not available
    }
  }
}

function cleanLoadedBeacon(entity) {
  try { if (entity.typeId !== BEACON_ID) return; } catch { return; }
  // Spawn callbacks can arrive before the creator assigns its session beaconId.
  system.run(() => {
    try {
      if (!entity.isValid || entity.hasTag("guide_beacon") || entity.nameTag === "guide_beacon") return;
      if ([...sessions.values()].some(s => s.beaconId === entity.id)) return;
      if (beaconSources.some(source => source().includes(entity.id))) return;
      entity.remove();
    } catch { /* unloaded again */ }
  });
}

function tickSessions() {
  for (const [deerId, s] of sessions) {
    try {
      tickSession(deerId, s);
    } catch {
      end(deerId, undefined, undefined, undefined); // deer or beacon unloaded mid-tick
    }
  }
}

// Natural spawns only (the spawn rule's herd event sets lothlorien:natural; /summon and eggs do not): keep the white deer
// with the depth chance of its spot (white_deer_rules.js), otherwise remove it before anyone sees it (distance_filter
// 24-44 from the player). The flag is cleared after the roll, so a deer is judged once, not again on every chunk load.
function judgeNaturalSpawn(deer, depthAt) {
  try {
    if (!deer.isValid || !deer.getProperty("lothlorien:natural")) return;
    deer.setProperty("lothlorien:natural", false);
    if (!keepNaturalSpawn(depthAt(deer.dimension, deer.location).level, Math.random())) deer.remove();
  } catch {
    // unloaded meanwhile
  }
}

// depth(dimension, location) -> { level } from scripts/depth.js; biomeInfo = { id, transparent, at } (main.js supplies both).
export function startWhiteDeer(depth, biomeInfo) {
  depthAt = depth;
  biome = biomeInfo;
  sweepBeacons(); // world load: no session survives a reload, so every beacon found is a stray
  world.afterEvents.entityLoad.subscribe(({ entity }) => cleanLoadedBeacon(entity));
  world.afterEvents.entitySpawn.subscribe(({ entity, cause }) => {
    try {
      if (cause === EntityInitializationCause.Loaded || entity.typeId !== WHITE_DEER_ID) return;
      // one tick later: the spawn event's property is surely applied by then
      system.runTimeout(() => judgeNaturalSpawn(entity, depthAt), 1);
    } catch {
      // entity gone
    }
  });
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId !== WHITE_DEER_ID || (beforeItemStack ?? itemStack)?.typeId !== ACORN_ID) return;
      if (depthAt(target.dimension, target.location).level === 0) { // outside Lothlorien: an ordinary tame-by-feeding
        end(target.id, target);
        if (eatHeldFood(player, target, ACORN_ID)) {
          target.triggerEvent("lothlorien:become_tame");
          system.run(() => {
            if (target.isValid && !target.getProperty("lothlorien:alarmed"))
              target.triggerEvent(`lothlorien:set_${target.getProperty("lothlorien:wariness")}`);
          });
        }
        return;
      }
      if (target.getProperty("lothlorien:alarmed")) return;
      offer(player, target);
    } catch {
      // entity gone
    }
  });
}
