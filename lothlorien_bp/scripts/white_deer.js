import { message } from "./messages.js";
// White deer guidance in the running game (mobs/white_deer.md; rules in white_deer_rules.js). Offer a Mallorn acorn to a white
// deer (lothlorien:white_deer) as a Friend of Lothlorien: once in its life it leads you to its gift, a Great Mallorn nut
// (great_mallorn.js), at a spot inside Lothlorien 36-56 blocks away, waiting for the player to keep up, and lays the nut
// at its feet on arrival. The spot is kept on the deer (dynamic property) until the gift is given, so a broken-off guidance
// can be taken up again with another acorn. A leashed white deer does not lead (white_deer_rules.js, offerRefusal).
// Natural spawns are thinned by depth.
//
// The deer is never moved by script. While it guides, it sits in the component group `lothlorien:state_guiding`
// (entities/white_deer.json), whose follow goal makes the engine's navigator walk it to the nearest guide beacon: an
// invisible helper entity (entities/guide_beacon.json), one per session, that this script spawns and moves ahead in
// hops of 8-14 blocks. Several guiding deer close together may follow each other's beacon (accepted by the owner).
import { EntityInitializationCause, EquipmentSlot, GameMode, ItemStack, system, world } from "@minecraft/server";
import { onEntity } from "./entity_events.js";
import { harmonyOf, showStatus } from "./harmony_game.js";
import { bandOf } from "./harmony.js";
import { consumeHeld } from "./deferred_use.js";
import { judgeNatural, moveBeacon, playerById, removeBeacon, say } from "./entity_util.js";
import { eatHeldFood, healAnimal, isInjured } from "./animal_food.js";
import { villageDebug } from "./village_debug.js";
import {
  ACORN_ID, ARRIVE_DIST, BEACON_ID, GUIDE_TICKS, WHITE_DEER_ID, canBeGuided, hopStatus, horizontal, keepNaturalSpawn,
  newHop, offerRefusal, phase, pickWaypoint, trackProgress,
} from "./white_deer_rules.js";
import { NUT_ID, borderGrid, giftCandidates, isNatural, pickGiftSpot } from "./great_mallorn_rules.js";

// session: { playerId, beaconId, target, bestDist, stuck, born, phase, hop, skip, bias, waiting }
const sessions = new Map(); // deer id -> session
const searching = new Set(); // deer ids with a gift spot search in progress
const GIFT_SPOT = "lothlorien:gift_spot"; // dynamic property on the deer: JSON {x, y, z, dim} until the gift is given
const GIFTED = "lothlorien:gifted"; // dynamic property on the deer: true once the nut was laid
let depthAt; // (dimension, location) -> { level }, from main.js (natural-spawn rolls need the level)
let insideAt; // (dimension, location) -> boolean, from main.js
let biome; // { id, transparent: Set, at(dimension, x, z) -> surface biome id or undefined (unloaded) }, from main.js
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

const isLeashed = (deer) => deer.getComponent("minecraft:leashable")?.isLeashed ?? false;

// Feet height at column (x, z) found from the top: the first ground under air, plants, leaves and logs (a crown over
// the forest floor is not ground), with two blocks of headroom; undefined for water, an unloaded chunk, no ground, or built
// ground (planks, carpets, slabs, lanterns, chests: a ray lands on a flet or village deck up in the crown; only isNatural
// blocks count, R7 2026-11-22).
// Collision is read with block raycasts, which pass through air and passable plants (as in stand() below), not with the Block
// property isSolid: beta-only, absent from @minecraft/server 2.8.0, it reads undefined and no column had ground (K36, 2026-11-17).
// `tally.n` counts the native calls made (the gift-spot job budgets its steps by it); `tally.why` ("ground", "built", "water",
// "headroom", "none") and `tally.ground` (the block hit) say how the column ended, for the debug summary.
function groundFeet(dimension, x, z, tally = { n: 0 }) {
  tally.why = "none";
  tally.ground = undefined;
  try {
    tally.n++;
    const top = dimension.getTopmostBlock({ x, z });
    if (!top) return undefined;
    let from = top.y + 1.5; // in the air above the column
    for (let i = 0; i < GROUND_RAYS && from > WORLD_BOTTOM; i++) {
      tally.n++;
      const hit = dimension.getBlockFromRay({ x: x + 0.5, y: from, z: z + 0.5 }, DOWN, { includeLiquidBlocks: true, maxDistance: from - WORLD_BOTTOM });
      if (!hit) return undefined;
      if (hit.block.isLiquid) {
        tally.why = "water";
        return undefined;
      }
      if (canopy(hit.block.typeId)) {
        from = hit.block.y - 0.01;
        continue;
      }
      tally.ground = hit.block.typeId;
      if (!isNatural(hit.block.typeId)) {
        tally.why = "built";
        return undefined;
      }
      const feet = hit.block.y + 1;
      const clear = clearBody(dimension, x, feet, z, tally);
      tally.why = clear ? "ground" : "headroom";
      return clear ? feet : undefined;
    }
    return undefined;
  } catch {
    return undefined; // unloaded chunk
  }
}
const GROUND_RAYS = 48; // leaf, branch and trunk blocks a column may look through before it gives up
const GROUND_CALLS = 1 + GROUND_RAYS + 3; // most native calls one groundFeet makes: topmost block, rays, clearBody
const BIOME_CALLS = 3; // one biome.at probe (main.js: topmost block, biome, location)
const STEP_CALLS = 128; // native calls per gift-spot job step
const WORLD_BOTTOM = -64; // Lothlorien is an overworld biome
const canopy = id => id.includes("leaves") || id.endsWith("_log") || id.endsWith("_wood");
const dry = block => !!block && !block.isLiquid && !block.isWaterlogged;
// The feet and head cells at feet height y: no water, and nothing to collide with (an upward ray from the floor meets nothing).
function clearBody(dimension, x, y, z, tally = { n: 0 }) {
  tally.n += 3;
  return dry(dimension.getBlock({ x, y, z })) && dry(dimension.getBlock({ x, y: y + 1, z })) &&
    !dimension.getBlockFromRay({ x: x + 0.5, y: y + 0.05, z: z + 0.5 }, UP, { includeLiquidBlocks: true, maxDistance: 1.9 });
}
// A kept spot is still good when the search's own probe (groundFeet) finds the same feet height there. Only a kept spot is
// re-checked (on the next offer); arrival lays the nut at the deer's feet and checks nothing.
const giftSpace = (dimension, spot) => groundFeet(dimension, spot.x, spot.z) === spot.y;
const insideGift = (dimension, spot) => biome.at(dimension, spot.x, spot.z) === biome.id;

// Debug lines (content log, only while `/scriptevent lothlorien:debug` is on): one per phase change or exit, never per tick.
// `line` is a thunk, so no string is built while the switch is off.
const dlog = (line) => { if (villageDebug()) console.warn(`[lothlorien] white deer: (debug) ${line()}`); };
const fmt = (p) => p ? `${(+p.x).toFixed(1)},${(+p.y).toFixed(1)},${(+p.z).toFixed(1)}` : "none";
const errText = (e) => (e && (e.stack || e.message)) || String(e);

// The gift spot for a deer at `origin` (great_mallorn_rules.js, pickGiftSpot): first the border scan over the loaded grid, then
// the candidates, at most STEP_CALLS native calls per job step. Calls done({x, y, z}) or done(undefined).
function findGiftSpot(dimension, origin, done) {
  system.runJob(
    (function* () {
      try {
        const tally = { n: 0 };
        let steps = 1;
        // Yield before a probe that could take the step past STEP_CALLS native calls (so no step exceeds it).
        const room = (worst) => tally.n + worst <= STEP_CALLS || ((tally.n = 0), (steps++, false));
        const border = [];
        for (const p of borderGrid(origin.x, origin.z)) {
          if (!room(BIOME_CALLS)) yield;
          tally.n += BIOME_CALLS;
          const id = biome.at(dimension, p.x, p.z);
          if (id !== undefined && id !== biome.id && !biome.transparent.has(id)) border.push(p);
        }
        const candidates = giftCandidates(origin.x, origin.z, Math.random() * 2 * Math.PI);
        const why = { outside: 0, built: 0, water: 0, headroom: 0, ground: 0, none: 0 }, builtOn = new Set();
        for (const c of candidates) {
          if (!room(BIOME_CALLS + GROUND_CALLS)) yield;
          tally.n += BIOME_CALLS;
          c.inside = biome.at(dimension, c.x, c.z) === biome.id;
          c.y = c.inside ? groundFeet(dimension, c.x, c.z, tally) : undefined;
          if (!c.inside) why.outside++;
          else {
            why[tally.why]++;
            c.on = tally.ground;
            if (tally.why === "built") builtOn.add(tally.ground);
          }
        }
        const best = pickGiftSpot(candidates, border);
        dlog(() => `search from ${fmt(origin)}: ${candidates.length} candidates: ${why.outside} outside, ${why.built} built (${[...builtOn].join(" ") || "-"}), ` +
          `${why.water} water, ${why.headroom} headroom, ${why.none} none, ${why.ground} ground; ` +
          `${best ? `spot ${best.x},${best.y},${best.z} on ${best.on} ring ${best.ring}` : "none"}; ${steps} steps`);
        done(best && { x: best.x, y: best.y, z: best.z });
      } catch (e) {
        dlog(() => `search failed: ${errText(e)}`);
        done(undefined); // always clears `searching`; the player hears no_spot
      }
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

// Lay one nut at the deer's feet (as the squirrel does), then record lifetime completion. The deer is where the player
// is told it "bows its head"; the guidance spot's own height is never trusted for the nut (R7: a spot on a flet laid the
// nut 16 blocks overhead).
function giveGift(deer, s) {
  const at = { x: deer.location.x, y: deer.location.y + 0.3, z: deer.location.z };
  const nut = new ItemStack(NUT_ID, 1);
  nut.setLore([message("nut.lore.tree"), message("nut.lore.space"), message("nut.lore.plant")]);
  deer.dimension.spawnItem(nut, at);
  deer.setDynamicProperty(GIFTED, true);
  deer.setDynamicProperty(GIFT_SPOT, undefined);
  try { deer.dimension.spawnParticle("minecraft:totem_particle", at); } catch { /* cosmetic only */ }
  return at;
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
  if (sessions.has(deer.id)) { // guiding already: the acorn stays in the hand and the deer answers
    dlog(() => `offer ${deer.id}: ignored (guiding), answered deer.leading`);
    say(player, message("deer.leading"));
    return;
  }
  if (searching.has(deer.id)) {
    dlog(() => `offer ${deer.id}: ignored (searching)`);
    return;
  }
  const refusal = offerRefusal({ band: bandOf(harmonyOf(player).harmony), leashed: isLeashed(deer) });
  if (refusal === "leashed") {
    dlog(() => `offer ${deer.id}: refused (leashed)`);
    say(player, message("deer.leashed"));
    return;
  }
  if (refusal === "untrusted") {
    dlog(() => `offer ${deer.id}: refused (untrusted)`);
    showStatus(player); // the band is the reason
    say(player, message("deer.untrusted"));
    return;
  }
  if (refusal) {
    dlog(() => `offer ${deer.id}: refused (restless)`);
    showStatus(player);
    say(player, message("deer.restless"));
    return;
  }
  if (deer.getDynamicProperty(GIFTED)) {
    // A completed gift never prevents healing; feeding does not reset that gift. Nothing starts, so the deer says it ate.
    if (isInjured(deer) && eatHeldFood(player, deer, ACORN_ID)) {
      dlog(() => `offer ${deer.id}: fed (injured, gifted)`);
      say(player, message("deer.fed"));
      return;
    }
    dlog(() => `offer ${deer.id}: refused (gifted)`);
    say(player, message("deer.gifted"));
    return;
  }
  // A hurt deer that can still guide is not fed first: the acorn that starts the guidance heals it (lead() below), one acorn.
  const offered = { dimension: deer.dimension, index: player.selectedSlotIndex };
  const kept = storedSpot(deer);
  if (kept) {
    if (giftSpace(deer.dimension, kept) && insideGift(deer.dimension, kept)) {
      dlog(() => `offer ${deer.id}: kept spot ${kept.x},${kept.y},${kept.z} ok`);
      lead(player, deer, kept);
      return;
    }
    dlog(() => `offer ${deer.id}: kept spot ${kept.x},${kept.y},${kept.z} stale`);
    deer.setDynamicProperty(GIFT_SPOT, undefined); // blocked, flooded, built over or unreadable meanwhile: search a new spot
  }
  searching.add(deer.id);
  findGiftSpot(offered.dimension, deer.location, (spot) => {
    searching.delete(deer.id);
    try {
      if (!stillOffering(player, deer, offered)) {
        dlog(() => "search result dropped (hand/slot changed or deer gone)");
        return;
      }
      if (spot) lead(player, deer, spot);
      else say(player, message("deer.no_spot"));
    } catch (e) {
      dlog(() => `search failed: ${errText(e)}`); // deer or player gone
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
    dlog(() => wp ? `lead to ${spot.x},${spot.y},${spot.z} (deer ${fmt(deer.location)}): first waypoint ${fmt(wp)}` : "lead: no waypoint");
    if (!wp) {
      say(player, message("deer.no_path"));
      return;
    }
    deer.setDynamicProperty(GIFT_SPOT, JSON.stringify({ ...spot, dim: dimension.id }));
    const beacon = dimension.spawnEntity(BEACON_ID, { x: wp.x, y: wp.y, z: wp.z });
    beaconId = beacon.id;
    deer.triggerEvent("lothlorien:become_tame"); // fed: persistent, and after guiding alarm_over brings it back as state_tame
    deer.triggerEvent("lothlorien:guide_start");
    consumeHeld(player, ACORN_ID); // only now: guidance really starts
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
  } catch (e) {
    dlog(() => `lead failed: ${errText(e)}`);
    sessions.delete(deer.id);
    syncSessionTimer();
    removeBeacon(beaconId);
    try {
      if (deer.getProperty("lothlorien:guiding")) deer.triggerEvent("lothlorien:guide_end");
    } catch { /* deer unloaded */ }
    say(player, message("deer.abort"));
  }
}

// Ends the session: beacon removed, deer released, `key` (a message key, or undefined for silent) said to the player.
// `reason` is only for the debug line.
function end(deerId, deer, player, key, reason = "ended") {
  const s = sessions.get(deerId);
  sessions.delete(deerId);
  syncSessionTimer();
  removeBeacon(s?.beaconId);
  try {
    if (deer?.isValid && deer.getProperty("lothlorien:guiding")) deer.triggerEvent("lothlorien:guide_end");
  } catch {
    // deer unloaded
  }
  if (s) dlog(() => `end (${reason}): ${key && player ? key : "silent"}`);
  if (player && key) say(player, message(key));
}

// The nut lies at the deer's feet; arrival cannot fail. `how`: "at spot", "last hop", "last hop stuck" or "stuck".
function arrive(deerId, deer, player, s, how) {
  const at = giveGift(deer, s);
  dlog(() => `arrive (${how}): deer ${fmt(deer.location)}, spot ${s.spot.x},${s.spot.y},${s.spot.z}, nut at ${fmt(at)}`);
  end(deerId, deer, player, "deer.gift", `arrived, ${how}`);
}


// The session's beacon, respawned at `at` if it was lost (chunk unloaded, killed by /kill). undefined = cannot.
function beaconOf(s, dimension, at) {
  const beacon = world.getEntity(s.beaconId);
  if (beacon?.isValid) return beacon;
  const fresh = dimension.spawnEntity(BEACON_ID, { x: at.x, y: at.y, z: at.z });
  s.beaconId = fresh.id;
  return fresh;
}

// One hop step while walking: follow the current waypoint, pick the next when it is reached, turn when stuck.
// Returns "go", or why the deer counts as arrived ("last hop", "last hop stuck").
function walk(s, deer, beacon) {
  const status = hopStatus(s.hop, deer.location, GUIDE_TICKS);
  if (status === "go") return "go";
  if (status === "next") {
    if (s.hop.wp.final) return "last hop"; // stood at the last waypoint at the spot
    s.skip.clear();
  } else {
    if (s.hop.wp.final) return "last hop stuck"; // 5 s without getting closer to the last waypoint: arrived here (R7)
    s.skip.add(s.hop.wp.deg);
  }
  let wp = pickWaypoint(deer.location, s.target, standIn(deer.dimension), { bias: s.bias, skip: s.skip });
  if (!wp && s.skip.size) {
    s.skip.clear(); // every heading failed once: start the round again
    wp = pickWaypoint(deer.location, s.target, standIn(deer.dimension), { bias: -s.bias });
  }
  dlog(() => `hop ${status}: ${wp ? `waypoint ${fmt(wp)} heading ${wp.deg}${wp.final ? " final" : ""}` : "none"}`);
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
  const player = playerById(s.playerId);
  const dead = !!deer?.isValid && !(deer.getComponent("minecraft:health")?.currentValue > 0);
  const mismatch = deer?.isValid && player?.isValid && (deer.dimension.id !== player.dimension.id || deer.dimension.id !== s.dimensionId);
  if (!deer?.isValid || dead || !activePlayer(player) || mismatch) {
    // nobody to tell when the player is gone; a dead deer is silent; a deer that vanished or a world change gets the abort
    const reason = dead ? "deer dead" : !deer?.isValid ? "deer gone" : !activePlayer(player) ? "player gone" : "dimension";
    return end(deerId, deer, player, !dead && activePlayer(player) ? "deer.abort" : undefined, reason);
  }
  const playerCalm = canBeGuided(bandOf(harmonyOf(player).harmony));
  if (!playerCalm) return end(deerId, deer, player, "deer.abort", "player below Friend");
  if (!deer.getProperty("lothlorien:guiding")) return end(deerId, deer, player, "deer.abort", "alarm cleared the guiding state"); // hurt
  const toTarget = horizontal(deer.location, s.target);
  const toPlayer = horizontal(deer.location, player.location);
  trackProgress(s, toTarget, s.phase === "walk", GUIDE_TICKS);
  const before = s.phase;
  s.phase = phase({
    toTarget,
    toPlayer,
    stuck: s.stuck,
    age: system.currentTick - s.born,
    playerCalm,
    leashed: isLeashed(deer),
  });
  if ((before === "walk" || before === "wait") && (s.phase === "walk" || s.phase === "wait") && before !== s.phase)
    dlog(() => `phase ${before}->${s.phase} (player ${toPlayer.toFixed(1)} blocks)`);
  if (s.phase === "leashed") return end(deerId, deer, player, "deer.stop_leashed", "leashed");
  if (s.phase === "arrived") return arrive(deerId, deer, player, s, toTarget <= ARRIVE_DIST ? "at spot" : "stuck");
  if (s.phase === "abort") return end(deerId, deer, player, "deer.abort", `abort (player ${toPlayer.toFixed(0)} blocks, ${system.currentTick - s.born} ticks, stuck ${s.stuck})`);
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
  const arrived = walk(s, deer, beacon);
  if (arrived !== "go") arrive(deerId, deer, player, s, arrived);
}

function tickSessions() {
  for (const [deerId, s] of sessions) {
    try {
      tickSession(deerId, s);
    } catch (e) {
      // Anything unexpected releases the deer and tells the player; deer and player are read again, they may be what failed.
      dlog(() => `tick failed: ${errText(e)}`);
      let deer, player;
      try { deer = world.getEntity(deerId); player = playerById(s.playerId); } catch { /* unloaded */ }
      end(deerId, deer, player, "deer.abort", "error");
    }
  }
}

// Natural spawns only (the spawn rule's herd event sets lothlorien:natural; /summon and eggs do not): keep the white deer
// with the depth chance of its spot (white_deer_rules.js), otherwise remove it before anyone sees it (distance_filter
// 24-44 from the player). The flag is cleared after the roll, so a deer is judged once, not again on every chunk load.
function judgeNaturalSpawn(deer, depthAt) {
  judgeNatural(deer, () => {
    if (!keepNaturalSpawn(depthAt(deer.dimension, deer.location).level, Math.random())) deer.remove();
  });
}

// depth(dimension, location) -> { level } from scripts/depth.js; inside(dimension, location) -> boolean (depth.js isInside); biomeInfo = { id, transparent, at } (main.js supplies both).
export function startWhiteDeer(depth, inside, biomeInfo) {
  depthAt = depth;
  insideAt = inside;
  biome = biomeInfo;
  onEntity(WHITE_DEER_ID, {
    spawn: ({ entity, cause }) => {
      if (cause === EntityInitializationCause.Loaded) return;
      // one tick later: the spawn event's property is surely applied by then
      system.runTimeout(() => judgeNaturalSpawn(entity, depthAt), 1);
    },
  });
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId !== WHITE_DEER_ID || (beforeItemStack ?? itemStack)?.typeId !== ACORN_ID) return;
      if (!insideAt(target.dimension, target.location)) { // outside Lothlorien: an ordinary tame-by-feeding
        end(target.id, target);
        const fed = eatHeldFood(player, target, ACORN_ID);
        if (fed) {
          target.triggerEvent("lothlorien:become_tame");
          say(player, message("deer.outside"));
        }
        dlog(() => `offer ${target.id}: ${fed ? "fed" : "nothing eaten"} (outside)`);
        return;
      }
      if (target.getProperty("lothlorien:alarmed")) { // hurt by a player a moment ago: the acorn is kept
        dlog(() => `offer ${target.id}: refused (alarmed), answered deer.startled`);
        say(player, message("deer.startled"));
        return;
      }
      offer(player, target);
    } catch (e) {
      dlog(() => `offer failed: ${errText(e)}`); // entity gone
    }
  });
}
