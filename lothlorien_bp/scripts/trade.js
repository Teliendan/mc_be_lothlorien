// M3 shops: native offers belong to the nearest player's band/rank, with a short pin while trading.
// A request form grants one use of the native screen; read-only interaction callbacks only decide and cancel.
import { system, world } from "@minecraft/server";
import { ELF_ID } from "./elf_rules.js";
import { nativeElfUse } from "./elf_native_use.js";
import { greet } from "./voice.js";
import { message } from "./messages.js";
import {
  TRADERS, NO_TABLE, TABLE_PROPERTY, SWAP_RADIUS, SWAP_INTERVAL_TICKS, TRADE_PASS_TICKS,
  PASS_REPEAT_TICKS, PIN_TICKS, PASS_TAG, tableKey, swapEventOf, clickDecision, chooseKey,
} from "./trade_rules.js";

const passes = new Map(); // player id -> { player, elfId, until, usedAt? }; identity guards stale timers
const pins = new Map(); // elf id -> { playerId, until }
const lastCancel = new Map();
const forms = new Map(); // player id -> token, invalidated when the player leaves or respawns
const sessions = new Map(); // guards callbacks queued before leave/rejoin
let deps;

function traderProfession(elf) {
  try {
    return elf.typeId === ELF_ID ? TRADERS[elf.getComponent("minecraft:variant")?.value] : undefined;
  } catch {
    return undefined;
  }
}

function nearby(player, elf) {
  try {
    return player.isValid && elf.isValid && player.dimension.id === elf.dimension.id
      && Math.hypot(player.location.x - elf.location.x, player.location.y - elf.location.y, player.location.z - elf.location.z) <= SWAP_RADIUS;
  } catch {
    return false;
  }
}

const keyFor = (player) => tableKey(deps.bandOf(player), deps.rankOf(player));
const sayKey = (player, key) => {
  try { if (player.isValid) player.sendMessage(message(key)); } catch { /* player left */ }
};

function applyKey(elf, key) {
  try {
    if (elf.isValid && elf.getProperty(TABLE_PROPERTY) !== key) elf.triggerEvent(swapEventOf(key));
  } catch { /* unloaded elf */ }
}

function pin(elf, player) {
  pins.set(elf.id, { playerId: player.id, until: system.currentTick + PIN_TICKS });
}

function endPass(playerId, pass) {
  if (passes.get(playerId) !== pass) return;
  passes.delete(playerId);
  try { if (pass.player.isValid) pass.player.removeTag(PASS_TAG); } catch { /* player left */ }
}

function grantPass(player, elf, profession) {
  // The world and the request can change while the form is open. Never grant a stale/refused pass.
  if (!nearby(player, elf) || traderProfession(elf) !== profession || deps.requestProfession(player) !== profession) return;
  const key = keyFor(player);
  if (key === null) return;
  const pass = { player, elfId: elf.id, until: system.currentTick + TRADE_PASS_TICKS };
  passes.set(player.id, pass);
  player.addTag(PASS_TAG);
  lastCancel.delete(player.id); // the form's click has ended; its answer permits the next use immediately
  applyKey(elf, key);
  sayKey(player, "trade.again");
  system.runTimeout(() => endPass(player.id, pass), TRADE_PASS_TICKS);
}

function openForm(player, elf, profession) {
  if (forms.has(player.id) || !nearby(player, elf)) return;
  const token = {};
  forms.set(player.id, token);
  Promise.resolve().then(() => deps.openRequestForm(player, elf, profession)).then((answer) => {
    if (forms.get(player.id) === token && answer === "trade") grantPass(player, elf, profession);
  }).catch(() => { /* player or elf disappeared, or the form could not open */ }).finally(() => {
    if (forms.get(player.id) === token) forms.delete(player.id);
  });
}

function swapTick() {
  const now = system.currentTick;
  const nearbyElves = new Map();
  for (const player of world.getPlayers()) {
    try {
      const p = player.location;
      const elves = player.dimension.getEntities({ type: ELF_ID, location: p, maxDistance: SWAP_RADIUS });
      let key;
      for (const elf of elves) {
        if (!traderProfession(elf)) continue;
        if (key === undefined) key = keyFor(player) ?? NO_TABLE;
        let entry = nearbyElves.get(elf.id);
        if (!entry) nearbyElves.set(elf.id, entry = { elf, candidates: [] });
        const e = elf.location;
        entry.candidates.push({ playerId: player.id, key, dist: Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z) });
      }
    } catch { /* disconnected player or unloaded dimension */ }
  }
  for (const [elfId, held] of pins) {
    if (held.until <= now || !nearbyElves.get(elfId)?.candidates.some((p) => p.playerId === held.playerId)) pins.delete(elfId);
  }
  for (const { elf, candidates } of nearbyElves.values()) applyKey(elf, chooseKey(candidates, pins.get(elf.id), now));
  for (const [playerId, pass] of passes) {
    if (now >= pass.until || (pass.usedAt !== undefined && now - pass.usedAt >= PASS_REPEAT_TICKS)) endPass(playerId, pass);
  }
  for (const [playerId, at] of lastCancel) if (now - at >= PASS_REPEAT_TICKS) lastCancel.delete(playerId);
}

function onInteract(event) {
  const { player, target, itemStack } = event;
  const profession = traderProfession(target);
  if (!profession || nativeElfUse(target, itemStack)) return;
  const now = system.currentTick;
  const canceledAt = lastCancel.get(player.id);
  if (canceledAt !== undefined && now - canceledAt < PASS_REPEAT_TICKS) {
    event.cancel = true;
    return;
  }
  const pass = passes.get(player.id);
  const passValid = pass?.elfId === target.id && (pass.usedAt === undefined
    ? now < pass.until : now - pass.usedAt < PASS_REPEAT_TICKS);
  let decision, band;
  try {
    band = deps.bandOf(player);
    decision = clickDecision({ profession, band, rank: deps.rankOf(player),
      requestProfession: deps.requestProfession(player), passValid, currentKey: target.getProperty(TABLE_PROPERTY) });
  } catch { return; }
  if (decision.action === "trade") {
    pin(target, player); // JS-only state is safe inside the read-only callback
    if (passValid && pass.usedAt === undefined) {
      pass.usedAt = now; // Anchor once: held-click repeats must never extend this pass.
      system.runTimeout(() => endPass(player.id, pass), PASS_REPEAT_TICKS);
    }
    // The approved native-trade click opens with a greeting (next tick: sound needs privilege). A pass click comes from the
    // delivery form, which already greeted: one opening spans form -> trade. Held-click repeats fall to the 30 s pair cooldown.
    if (!passValid) system.run(() => greet(target, player, band));
    return;
  }
  event.cancel = true;
  lastCancel.set(player.id, now);
  const session = sessions.get(player.id);
  system.run(() => {
    if (sessions.get(player.id) !== session || !nearby(player, target)) return;
    if (decision.action === "refuse") {
      applyKey(target, NO_TABLE);
      sayKey(player, decision.line);
      greet(target, player, band); // a refusal means Shunned (refuse_speak) or Hated (silence)
    } else if (decision.action === "form") {
      openForm(player, target, profession);
    } else if (decision.action === "swap") {
      // Re-read after deferring: harmony or renown may have changed since the click.
      const key = keyFor(player);
      applyKey(target, key ?? NO_TABLE);
      if (key !== null) { pin(target, player); sayKey(player, "trade.again"); }
    }
  });
}

function clearPlayer(playerId) {
  sessions.set(playerId, {});
  const pass = passes.get(playerId);
  if (pass) endPass(playerId, pass);
  forms.delete(playerId);
  lastCancel.delete(playerId);
  for (const [elfId, held] of pins) if (held.playerId === playerId) pins.delete(elfId);
}

export function startTrade(dependencies) {
  deps = dependencies;
  system.runInterval(swapTick, SWAP_INTERVAL_TICKS);
  world.beforeEvents.playerInteractWithEntity.subscribe(onInteract);
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn) return;
    clearPlayer(player.id);
    try { player.removeTag(PASS_TAG); } catch { /* player left */ }
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => clearPlayer(playerId));
}
