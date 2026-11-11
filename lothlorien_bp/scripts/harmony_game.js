import { message } from "./messages.js";
// Harmony in the running game: deeds and deaths feed the rules in harmony.js, state is kept per player in a dynamic
// property (survives relogging, independent between players) and written only when harmony changes.
import { world, system } from "@minecraft/server";
import { FOE_TAG } from "./elf_rules.js";
import { familiesOf } from "./entity_util.js";
import { PLAYER_ID } from "./ids.js";
import { BAND_TAGS, EVERYWHERE_DEEDS, MAX_HARMONY, MIN_HARMONY, bandOf, markMount, wasMount, changeMessages, deedCounts, deedKindOf, hintDue, parse, recordDeath, recordDeed, serialize, statusText, tick } from "./harmony.js";

const PROPERTY = "lothlorien:harmony";
export const HATED_TAG = BAND_TAGS.hated; // read by entities/elven_warden.json (wardens attack tagged players on sight)
export const FRIEND_TAG = BAND_TAGS.friend; // the wildlife flight distances and the lures in entities/*.json read all four band tags (harmony.js BAND_TAGS)
const TICK_SECONDS = 1;
// Causes that carry a player as damagingEntity (melee, arrows and other projectiles, magic, mace, thorns); fire, fall, drowning and the
// like have none. EntityDamageCause values; strings keep this file importable by the test mock.
const PLAYER_DAMAGE_CAUSES = ["entityAttack", "projectile", "magic", "maceSmash", "thorns"];

const states = new Map();
const lastHint = new Map(); // player id -> Date.now() of the last deed hint
const mounts = new Map(); // mob id -> Date.now() of a player hit while a monster rode it (harmony.js markMount)
let isInside = () => false;

// Current state of a player (loaded from the dynamic property on first use). Consumers read bandOf(state.harmony).
export function harmonyOf(player) {
  let state = states.get(player.id);
  if (!state) {
    state = parse(player.getDynamicProperty(PROPERTY));
    states.set(player.id, state);
  }
  return state;
}

// Band tags follow the band: update() calls this when the band changes, and the one-second tick once for every player it has not
// seen since they joined or the world loaded (a tag left from an older state is corrected then). The first read of a player's state
// cannot do it: other modules read it in read-only before events, where tags cannot be written.
const synced = new Set(); // player ids whose tags were checked since they joined
function syncBandTags(player, state) {
  const band = bandOf(state.harmony);
  for (const [name, tag] of Object.entries(BAND_TAGS)) {
    const needed = name === band;
    if (needed !== player.hasTag(tag)) {
      if (needed) player.addTag(tag);
      else player.removeTag(tag);
    }
  }
}

// Listeners told when a player's Harmony number changed (same shape as deeds.js onDeed); renown_game.js uses it for the Harmony nudge.
const changeListeners = [];
export function onHarmonyChange(listener) {
  changeListeners.push(listener);
}

// Runs `change` on the player's state; chat lines for band changes; saves only when harmony differs after.
// Returns true when a chat line was sent.
function update(player, state, change) {
  const before = state.harmony;
  change();
  if (bandOf(before) !== bandOf(state.harmony)) syncBandTags(player, state);
  if (state.harmony === before) return false;
  const keys = changeMessages(before, state.harmony);
  for (const key of keys) player.sendMessage(message(key));
  player.setDynamicProperty(PROPERTY, serialize(state));
  for (const listener of changeListeners) {
    try {
      listener(player, state);
    } catch {
      // a listener must never break the change that called it
    }
  }
  return keys.length > 0;
}

// A deed that is not a band change gets a short hint, at most once per HINT_GAP_MS.
function hint(player) {
  const now = Date.now();
  if (!hintDue(lastHint.get(player.id), now)) return;
  lastHint.set(player.id, now);
  player.sendMessage(message("harmony.hint"));
}

// A deed of `player` against `victim` (an entity): counts when either stands inside the forest; elf and warden deeds count everywhere.
function deed(player, victim, kind) {
  if (!kind) return;
  if (!EVERYWHERE_DEEDS.has(kind) && !deedCounts(kind, isInside(player.dimension, player.location) || isInside(victim.dimension, victim.location))) return;
  const state = harmonyOf(player);
  const before = state.harmony;
  const said = update(player, state, () => recordDeed(state, kind));
  if (!said && state.harmony < before) hint(player);
}

// A new fight with a warden (elven_warden.js decides what a fight is): a small cost.
export function recordWardenFight(player, warden) {
  try {
    deed(player, warden, "warden_fight");
  } catch {
    // entity gone
  }
}

// A new fight with a civilian elf (elven_warden.js decides what a fight is): the same small cost as a warden fight.
export function recordElfFight(player, elf) {
  try {
    deed(player, elf, "elf_fight");
  } catch {
    // entity gone
  }
}

// `/scriptevent lothlorien:harmony [value]` shows harmony, or sets it (for testing).
export function handleHarmonyEvent(event, player) {
  if (event.id !== "lothlorien:harmony") return false;
  const state = harmonyOf(player);
  const value = Number.parseInt(event.message, 10);
  if (Number.isFinite(value)) {
    update(player, state, () => {
      state.harmony = Math.max(MIN_HARMONY, Math.min(MAX_HARMONY, value));
      state.timer = 0;
    });
  }
  player.sendMessage(message("harmony.debug", state.harmony, message(`status.${bandOf(state.harmony)}`), Math.round(state.timer)));
  return true;
}

export function startHarmony(inside, debugTag) {
  isInside = inside;
  world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
    try {
      // read before recordDeath: a Hated player dying inside drops to Shunned and loses the tag
      const quarry = deadEntity.typeId === PLAYER_ID && (deadEntity.hasTag(HATED_TAG) || deadEntity.hasTag(FOE_TAG));
      const mount = mounts.size > 0 && wasMount(mounts, deadEntity.id, Date.now());
      if (deadEntity.typeId === PLAYER_ID) {
        const state = harmonyOf(deadEntity);
        update(deadEntity, state, () => recordDeath(state, inside(deadEntity.dimension, deadEntity.location)));
      }
      const killer = damageSource.damagingEntity;
      if (killer?.typeId !== PLAYER_ID || killer.id === deadEntity.id) return;
      deed(killer, deadEntity, deedKindOf(deadEntity.typeId, familiesOf(deadEntity), quarry || mount));
    } catch {
      // entity already gone
    }
  });

  // A player hitting a mob that carries a monster (jockey): read-only, so allowed in the before event.
  world.beforeEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    try {
      if (damageSource.damagingEntity?.typeId !== PLAYER_ID) return;
      const riders = hurtEntity.getComponent("minecraft:rideable")?.getRiders();
      if (riders?.some((rider) => familiesOf(rider).includes("monster"))) markMount(mounts, hurtEntity.id, Date.now());
    } catch {
      // entity gone
    }
  }, { allowedDamageCauses: PLAYER_DAMAGE_CAUSES });

  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    states.delete(playerId);
    lastHint.delete(playerId);
    synced.delete(playerId);
  });

  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const state = harmonyOf(player);
      if (!synced.has(player.id)) { synced.add(player.id); syncBandTags(player, state); }
      const here = inside(player.dimension, player.location);
      update(player, state, () => tick(state, here, TICK_SECONDS));
      const text = statusText(state, here);
      // the debug readout owns the actionbar of players who switched it on
      if (text && !player.hasTag(debugTag)) player.onScreenDisplay.setActionBar(text);
    }
  }, TICK_SECONDS * 20);
}
