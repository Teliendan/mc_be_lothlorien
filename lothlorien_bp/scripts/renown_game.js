import { message } from "./messages.js";
// Renown in the running game (rules and every tunable value: renown_rules.js). State is kept per player in the dynamic property
// `lothlorien:renown` (one JSON, v: 2), cached, and written only when it changed. This file also owns:
//  - the deed listener (deeds.js hooks; a deed only makes the current task ready) and the sapling count of the "plant acorns" request,
//  - the Harmony nudge (chat line when Harmony reaches the level while the Harmony lesson is the task),
//  - inventory counting and removal for deliveries, the rank-up feedback, and the debug command `/scriptevent lothlorien:renown`.
// The firefly catch is script-owned in fireflies.js (it calls noteDeed like the other hooks).
import { system, world } from "@minecraft/server";
import { onDeed, noteDeed } from "./deeds.js";
import {
  HARMONY_NEEDED, LESSONS, POINTS, REQUESTS, SAPLING_BLOCK, SAPLING_GROWN,
  addSaplingSpot, deliver, deliveryPlan, lessonTask, nextRank, noteDeed as rulesNoteDeed, openChapter, parse, rankOf, requestById, requestTask, saplingProgress,
  serialize, newState, tagSync, takeLesson, turnIn,
} from "./renown_rules.js";
import { harmonyOf } from "./harmony_game.js";

const PROPERTY = "lothlorien:renown";
const PLAYER_ID = "minecraft:player";
const NUDGE_INTERVAL_TICKS = 40;

const states = new Map();
const harmonyReady = new Map(); // player id -> was Harmony at the level at the last check (for the one-time nudge)
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

// Keeps the delivery tag in step with the state: exactly the tag of the current request's profession (the traders' hover prompt tests it).
export function syncDeliverTag(player) {
  try {
    const { add, remove } = tagSync(renownOf(player), player.getTags());
    for (const tag of remove) player.removeTag(tag);
    for (const tag of add) player.addTag(tag);
  } catch {
    // player gone
  }
}

export function saveRenown(player) {
  try {
    player.setDynamicProperty(PROPERTY, serialize(renownOf(player)));
    syncDeliverTag(player);
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

// "Progress to <rank>: n / m" or the highest-renown line.
export function rankProgress(state) {
  const next = nextRank(state.points);
  return next ? message("lore.rank.next", message(`lore.rank.${next.next}`), state.points, next.threshold) : message("lore.rank.max");
}

// Chat feedback of a turn-in (round 2: no result screen): the done line, the renown line, the progress line, a chapter line.
// The rank-up line follows from celebrate().
function turnInChat(player, first, result, state) {
  say(player, first);
  say(player, message("lore.result.renown"));
  say(player, rankProgress(state));
  if (result.chapterOpened) say(player, message("lore.chapter.opened"));
}

// "It is done" on the task lesson at the Loremaster (Harmony is re-checked). Returns true when it was paid; otherwise tells why in chat.
export function turnInLesson(player, state, at) {
  const result = turnIn(state, harmonyOf(player).harmony);
  if (!result) {
    say(player, message("lore.harmony.not_yet"));
    return false;
  }
  saveRenown(player);
  turnInChat(player, message("lore.done.lesson", message(`lore.lesson.${result.lesson}.name`)), result, state);
  celebrate(player, [result], at);
  return true;
}

// Hands the current request over (at its trader, or at the Loremaster when no trader lives near): counts and removes in the same tick.
// Returns true when it was paid; otherwise tells why in chat and changes nothing.
export function handOver(player, state, at) {
  const task = requestTask(state);
  if (!task) return false;
  const request = requestById(task.id);
  if (request.deed) {
    if (saplingsPlanted(player) < request.deed.count) {
      saveRenown(player); // vanished cells were dropped
      say(player, message("lore.saplings.missing"));
      return false;
    }
  } else {
    const plan = deliveryPlan(request, inventoryCounts(player));
    if (!plan.ok || !takeItems(player, plan.take)) {
      say(player, message("lore.deliver.missing"));
      return false;
    }
  }
  const result = deliver(state);
  saveRenown(player);
  if (!result) return false;
  turnInChat(player, message("lore.deliver.ok"), result, state);
  celebrate(player, [result], at);
  return true;
}

// Sound, particles and the rank-up chat line for results of the rules (finish results, a request delivery); the other turn-in
// texts are chat lines (turnInChat).
// `at` = the Loremaster entity when the player stands at him (particles there), else the particles circle the player.
export function celebrate(player, results, at) {
  for (const r of results) {
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
      for (const r of results) {
        say(player, message("lore.ready.chat", message(`lore.lesson.${r.lesson}.name`)));
        try {
          player.playSound("random.orb");
        } catch {
          // decoration
        }
      }
    } catch {
      // player left
    }
  });
}

// ---- Harmony nudge ----
// The Harmony lesson is ready by a computed condition, not by a deed hook: a light check tells the player once when Harmony crosses the level.
function checkHarmonyNudges() {
  for (const player of world.getAllPlayers()) {
    try {
      const task = lessonTask(renownOf(player));
      if (task?.id !== "harmony") {
        harmonyReady.delete(player.id);
        continue;
      }
      const ready = harmonyOf(player).harmony >= HARMONY_NEEDED;
      if (ready && harmonyReady.get(player.id) === false) say(player, message("lore.harmony.ready_chat"));
      harmonyReady.set(player.id, ready);
    } catch {
      // player left
    }
  }
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
      const need = requestById(requestTask(state).id).deed.count;
      say(player, message("lore.saplings.counted", Math.min(need, saplingsPlanted(player)), need));
    } catch {
      // player or block gone
    }
  });
}

// ---- Debug: /scriptevent lothlorien:renown [points N | reset | deed <id> | take <lesson id> | chapter N | offer <request id>] ----
function describe(player, state) {
  const lesson = lessonTask(state);
  const active = lesson ? `${lesson.id}${lesson.ready ? " (ready)" : ""}` : "-";
  const request = requestTask(state) ? `${state.task.id} (${state.task.spots.length} sapling cells)` : state.offer ? `offer ${state.offer}` : "-";
  say(player, message("lore.debug.state", state.points, message(`lore.rank.${rankOf(state.points)}`), openChapter(state), active, request, harmonyOf(player).harmony));
}

// Points for what is marked done (lessons that pay, requests): used by the debug `chapter N` so state and points agree.
function pointsOfDone(state) {
  let pts = 0;
  for (const l of LESSONS) if (state.done[l.id]) pts += l.kind === "lore" ? POINTS.lore_lesson : POINTS.deed_lesson;
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
    state.task = null;
    for (const l of LESSONS) if (l.chapter < n) state.done[l.id] = true;
    state.points = pointsOfDone(state);
  } else if (cmd === "take" && arg) {
    state.task = null;
    takeLesson(state, arg, system.currentTick);
  } else if (cmd === "offer" && requestById(arg)) {
    state.task = null;
    state.offer = arg;
  }
  saveRenown(player);
  describe(player, renownOf(player));
  return true;
}

export function startRenown(inside) {
  isInside = inside;
  onDeed(onPlayerDeed);
  watchSaplings();
  system.runInterval(checkHarmonyNudges, NUDGE_INTERVAL_TICKS);
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (initialSpawn) system.run(() => syncDeliverTag(player)); // a tag left from an older state (or a v1 save) is put right on joining
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    states.delete(playerId);
    harmonyReady.delete(playerId);
  });
}
