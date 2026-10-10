import { message } from "./messages.js";
// Renown in the running game (rules and every tunable value: renown_rules.js). State is kept per player in the dynamic property
// `lothlorien:renown` (one JSON, v: 1), cached, and written only when it changed. This file also owns:
//  - the deed listener (deeds.js hooks) and the sapling count of the "plant acorns" request,
//  - the firefly catch detection (the catch happens in entities/firefly.json, there is no script path: see watchFireflies),
//  - inventory counting and removal for deliveries, the rank-up feedback, and the debug command `/scriptevent lothlorien:renown`.
import { system, world } from "@minecraft/server";
import { onDeed, noteDeed } from "./deeds.js";
import {
  LESSONS, POINTS, REQUESTS, SAPLING_BLOCK, SAPLING_GROWN, TALES,
  addSaplingSpot, noteDeed as rulesNoteDeed, openChapter, parse, rankOf, requestById, saplingProgress, serialize, newState,
} from "./renown_rules.js";
import { harmonyOf } from "./harmony_game.js";

const PROPERTY = "lothlorien:renown";
const PLAYER_ID = "minecraft:player";
const FIREFLY_ID = "lothlorien:firefly";
const GLASS_BOTTLE = "minecraft:glass_bottle";
const FIREFLY_BOTTLE = "lothlorien:bottle_of_fireflies";
const FIREFLY_CHECK_TICKS = 5; // the engine swaps the bottle within a tick or two of the interaction

const states = new Map();
let isInside = () => false;

// State of a player (parsed from the dynamic property on first use).
export function renownOf(player) {
  let state = states.get(player.id);
  if (!state) {
    state = parse(player.getDynamicProperty(PROPERTY));
    states.set(player.id, state);
  }
  return state;
}

export function saveRenown(player) {
  try {
    player.setDynamicProperty(PROPERTY, serialize(renownOf(player)));
  } catch {
    // player gone
  }
}

const say = (player, text) => {
  try {
    player.sendMessage(text); // chat: the action bar belongs to the Harmony status (harmony_game.js)
  } catch {
    // player left
  }
};

// Chat line, sound and particles for results of the rules (finish results, tale results, a request delivery).
// `at` = the Loremaster entity when the player stands at him (particles there), else the particles circle the player.
export function celebrate(player, results, at) {
  for (const r of results) {
    if (r.lesson) {
      say(player, message("lore.done.lesson", message(`lore.lesson.${r.lesson}.name`)));
      if (r.chapterOpened) say(player, message("lore.chapter.opened"));
    } else if (r.tale) say(player, message("lore.tale"));
    else if (r.request) say(player, message("lore.deliver.ok"));
    if (r.rank?.rankedUp) {
      say(player, message(`lore.rankup.${r.rank.after}`));
      try {
        player.playSound("random.levelup");
        const where = at?.isValid ? at.location : player.location;
        player.dimension.spawnParticle("minecraft:totem_particle", { x: where.x, y: where.y + 1.6, z: where.z });
      } catch {
        // chunk unloaded or player gone: feedback is decoration
      }
    }
  }
}

// ---- Deeds ----
function onPlayerDeed(player, id) {
  // Deed hooks may run in an after-style callback; do the work next tick, where state and sounds are always allowed.
  system.run(() => {
    try {
      if (!player.isValid) return;
      const state = renownOf(player);
      const results = rulesNoteDeed(state, id);
      if (results.length === 0) return;
      saveRenown(player);
      celebrate(player, results);
    } catch {
      // player left
    }
  });
}

// ---- Firefly catch ----
// Catching a firefly is pure entity JSON (the glass bottle becomes lothlorien:bottle_of_fireflies through transform_to_item), so there is
// no script path to hook. UNVERIFIED in game: the before event of an interaction with a firefly while holding a glass bottle snapshots
// the number of firefly bottles in the pack; a few ticks later more bottles mean the catch worked.
const pendingCatch = new Set();
function watchFireflies() {
  world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target, itemStack } = event;
    if (target.typeId !== FIREFLY_ID || itemStack?.typeId !== GLASS_BOTTLE || pendingCatch.has(player.id)) return;
    pendingCatch.add(player.id);
    const before = inventoryCounts(player)[FIREFLY_BOTTLE] ?? 0;
    system.run(() => system.runTimeout(() => {
      pendingCatch.delete(player.id);
      try {
        if (player.isValid && (inventoryCounts(player)[FIREFLY_BOTTLE] ?? 0) > before) noteDeed(player, "fireflies");
      } catch {
        // player left
      }
    }, FIREFLY_CHECK_TICKS));
  });
}

// ---- Inventory ----
const containerOf = (player) => player.getComponent("inventory")?.container;

// { typeId: count } over the main inventory (hotbar and the 27 slots above; armor and offhand are not in the container).
export function inventoryCounts(player) {
  const counts = {};
  const container = containerOf(player);
  if (!container) return counts;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item) counts[item.typeId] = (counts[item.typeId] ?? 0) + item.amount;
  }
  return counts;
}

// Removes `take` ([{ id, count }]) in the same tick as the counting. Returns false (and takes nothing) if anything is short.
export function takeItems(player, take) {
  const container = containerOf(player);
  const have = inventoryCounts(player);
  if (!container || take.some((t) => (have[t.id] ?? 0) < t.count)) return false;
  for (const { id, count } of take) {
    let left = count;
    for (let i = 0; i < container.size && left > 0; i++) {
      const item = container.getItem(i);
      if (item?.typeId !== id) continue;
      const n = Math.min(left, item.amount);
      left -= n;
      if (n === item.amount) container.setItem(i, undefined);
      else {
        item.amount -= n;
        container.setItem(i, item);
      }
    }
  }
  return true;
}

// ---- Saplings ----
const cellOf = (block) => `${block.dimension.id}|${block.location.x},${block.location.y},${block.location.z}`;
// true while the cell holds a sapling or a tree grown from one; an unloaded chunk (or any read failure) counts as fine.
export function spotValid(cell) {
  try {
    const [dim, xyz] = cell.split("|");
    const [x, y, z] = xyz.split(",").map(Number);
    const block = world.getDimension(dim).getBlock({ x, y, z });
    if (!block) return true;
    return block.typeId === SAPLING_BLOCK || SAPLING_GROWN.includes(block.typeId);
  } catch {
    return true;
  }
}

export function saplingsPlanted(player) {
  return saplingProgress(renownOf(player), spotValid);
}

function watchSaplings() {
  world.afterEvents.playerPlaceBlock.subscribe(({ player, block }) => {
    try {
      if (block.typeId !== SAPLING_BLOCK || !isInside(block.dimension, block.location)) return;
      const state = renownOf(player);
      if (!addSaplingSpot(state, cellOf(block))) return;
      saveRenown(player);
      const need = requestById(state.request.id).deed.count;
      say(player, message("lore.saplings.counted", Math.min(need, saplingsPlanted(player)), need));
    } catch {
      // player or block gone
    }
  });
}

// ---- Debug: /scriptevent lothlorien:renown [points N | reset | deed <id> | chapter N | offer <request id>] ----
function describe(player, state) {
  const active = Object.keys(state.active).join(",") || "-";
  const request = state.request ? `${state.request.id} (${state.request.spots.length} sapling cells)` : state.offer ? `offer ${state.offer}` : "-";
  say(player, message("lore.debug.state", state.points, message(`lore.rank.${rankOf(state.points)}`), openChapter(state), active, request, harmonyOf(player).harmony));
}

// Points for what is marked done (lessons that pay, tales, requests): used by the debug `chapter N` so state and points agree.
function pointsOfDone(state) {
  let pts = 0;
  for (const l of LESSONS) if (state.done[l.id]) pts += l.kind === "lore" ? POINTS.lore_lesson : POINTS.deed_lesson;
  for (const t of Object.values(TALES)) if (state.done[t]) pts += POINTS.tale;
  for (const r of REQUESTS) if (state.done[r.id]) pts += POINTS.request;
  return pts;
}

export function handleRenownEvent(event, player) {
  if (event.id !== "lothlorien:renown") return false;
  const state = renownOf(player);
  const [cmd, arg] = event.message.trim().split(/\s+/);
  if (cmd === "reset") {
    states.set(player.id, newState());
  } else if (cmd === "points" && Number.isFinite(Number(arg))) {
    state.points = Math.max(0, Math.trunc(Number(arg)));
  } else if (cmd === "deed" && arg) {
    noteDeed(player, arg);
    system.runTimeout(() => describe(player, renownOf(player)), 2);
    return true;
  } else if (cmd === "chapter" && Number.isFinite(Number(arg))) {
    const n = Math.trunc(Number(arg));
    state.done = {};
    state.active = {};
    for (const l of LESSONS) if (l.chapter < n) state.done[l.id] = true;
    state.points = pointsOfDone(state);
  } else if (cmd === "offer" && requestById(arg)) {
    state.request = null;
    state.offer = arg;
  }
  saveRenown(player);
  describe(player, renownOf(player));
  return true;
}

export function startRenown(inside) {
  isInside = inside;
  onDeed(onPlayerDeed);
  watchFireflies();
  watchSaplings();
  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    states.delete(playerId);
    pendingCatch.delete(playerId);
  });
}
