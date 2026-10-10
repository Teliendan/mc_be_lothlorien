import { message } from "./messages.js";
// The Loremaster's dialog (M2): using the Loremaster elf opens forms with the chapters of his teaching, the Renown rank and the
// requests of the other elves. Rules and values: renown_rules.js; state, inventory and feedback: renown_game.js.
// The before event only decides and cancels (read-only mode); the forms open next tick, because show() is not allowed in read-only mode.
// All form text is RawMessage { translate } (server-ui 2.1.0 accepting RawMessage in title, body and buttons is documented, UNVERIFIED in game).
import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ELF_ID, PROFESSIONS } from "./elf_rules.js";
import { bandOf } from "./harmony.js";
import { harmonyOf } from "./harmony_game.js";
import { repeatedUse } from "./use_guard.js";
import {
  abandon, accept, activate, completeHarmony, completeLore, currentOffer, deliver, deliveryPlan, lessonById, lessonDone,
  menuFor, nextRank, rankOf, requestById, requestsLeft,
} from "./renown_rules.js";
import { celebrate, inventoryCounts, renownOf, saveRenown, saplingsPlanted, takeItems } from "./renown_game.js";

const LOREMASTER_VARIANT = PROFESSIONS.indexOf("loremaster");
const MAX_DISTANCE = 8; // the Loremaster must still be this close when an answer is applied
const BUSY_RETRIES = 10;
const BUSY_WAIT_TICKS = 10;
const SKIP_ITEMS = new Set(["minecraft:lead", "minecraft:name_tag"]); // these keep their usual effect on the Loremaster

const open = new Set(); // player ids with a dialog running

const t = (key, ...values) => message(key, ...values);
const join = (...parts) => ({ rawtext: parts.map((p) => (typeof p === "string" ? { text: p } : p)) });

function isLoremaster(entity) {
  try {
    return entity.typeId === ELF_ID && entity.getComponent("minecraft:variant")?.value === LOREMASTER_VARIANT;
  } catch {
    return false;
  }
}

const wait = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));

// Shows a form; "UserBusy" (another screen open, or the interaction itself still closing) is retried. undefined = closed or gave up.
async function show(player, form) {
  for (let i = 0; i < BUSY_RETRIES; i++) {
    const res = await form.show(player);
    if (!res.canceled) return res;
    if (res.cancelationReason !== "UserBusy") return undefined;
    await wait(BUSY_WAIT_TICKS);
  }
  return undefined;
}

// An action form from { title, body, buttons: [rawmessage...] }; resolves to the chosen index, or undefined.
async function choose(ctx, body, buttons) {
  const form = new ActionFormData().title(ctx.title).body(body);
  for (const label of buttons) form.button(label);
  const res = await show(ctx.player, form);
  return ctx.ok() ? res?.selection : undefined; // the world went on while the form was open: apply nothing if it changed
}

function makeContext(player, elf) {
  const nameTag = elf.nameTag;
  return {
    player,
    elf,
    title: nameTag ? { text: nameTag } : t("lore.title"),
    ok() {
      try {
        return player.isValid && elf.isValid && elf.dimension.id === player.dimension.id
          && Math.hypot(elf.location.x - player.location.x, elf.location.z - player.location.z, (elf.location.y - player.location.y) / 2) <= MAX_DISTANCE;
      } catch {
        return false;
      }
    },
  };
}

// ---- Lesson screen ----
// readOnly = a reminder, or a lesson the player cannot complete now (band): no activation, no completion.
async function lessonScreen(ctx, id, readOnly) {
  const { player } = ctx;
  const state = renownOf(player);
  const lesson = lessonById(id);
  if (!readOnly && activate(state, id, system.currentTick)) saveRenown(player);
  const completable = !readOnly && !lessonDone(state, id) && (lesson.kind === "lore" || lesson.kind === "harmony");
  const buttons = completable ? [t(lesson.kind === "lore" ? "lore.btn.understand" : "lore.btn.done"), t("lore.btn.back")] : [t("lore.btn.back")];
  const pick = await choose(ctx, t(`lore.lesson.${id}.text`), buttons);
  if (!completable || pick !== 0) return;
  // answer arrived: the state is re-read (it may have changed while the form was open)
  const result = lesson.kind === "lore" ? completeLore(state, id) : completeHarmony(state, harmonyOf(player).harmony);
  if (result) {
    saveRenown(player);
    celebrate(player, [result], ctx.elf);
  } else if (lesson.kind === "harmony") ctx.notice = t("lore.harmony.not_yet");
}

// ---- Reminders ----
async function remindScreen(ctx, ids) {
  const pick = await choose(ctx, t("lore.remind.body"), [...ids.map((id) => t(`lore.lesson.${id}.name`)), t("lore.btn.back")]);
  if (pick !== undefined && pick < ids.length) await lessonScreen(ctx, ids[pick], true);
  return pick !== undefined; // false = the form was closed
}

// ---- Requests ----
function progressLine(player, request) {
  if (request.deed) return t("lore.saplings.counted", Math.min(request.deed.count, saplingsPlanted(player)), request.deed.count);
  const plan = deliveryPlan(request, inventoryCounts(player));
  return t("lore.req.have", plan.have, plan.need);
}

async function requestScreen(ctx) {
  const { player } = ctx;
  const state = renownOf(player);
  const offer = currentOffer(state);
  saveRenown(player); // a new pull changes the state
  if (!offer) return;
  if (!state.request) {
    const pick = await choose(ctx, join(t(`lore.req.${offer.id}.text`)), [t("lore.btn.accept"), t("lore.btn.notnow")]);
    if (pick !== 0 || !accept(state)) return; // "Not now" keeps the offer for next time
    saveRenown(player);
  }
  const request = requestById(state.request.id);
  const pick = await choose(ctx, join(t(`lore.req.${request.id}.text`), "\n\n", progressLine(player, request)), [t("lore.btn.deliver"), t("lore.btn.abandon"), t("lore.btn.back")]);
  if (pick === 1) {
    const sure = await choose(ctx, t("lore.abandon.ask"), [t("lore.btn.abandon_yes"), t("lore.btn.keep")]);
    if (sure === 0 && abandon(state)) {
      saveRenown(player);
      ctx.notice = t("lore.abandon.done");
    }
  } else if (pick === 0) tryDeliver(ctx, state, request);
}

// Counting and removing happen here, in the same tick, after the answer (ctx.ok() was checked by choose()).
function tryDeliver(ctx, state, request) {
  const { player } = ctx;
  if (request.deed) {
    if (saplingsPlanted(player) < request.deed.count) {
      saveRenown(player); // vanished cells were dropped
      ctx.notice = t("lore.saplings.missing");
      return;
    }
  } else {
    const plan = deliveryPlan(request, inventoryCounts(player));
    if (!plan.ok || !takeItems(player, plan.take)) {
      ctx.notice = t("lore.deliver.missing");
      return;
    }
  }
  const result = deliver(state);
  saveRenown(player);
  if (result) celebrate(player, [result], ctx.elf);
}

// ---- Main screen ----
function greetingKey(band) {
  return band === "friend" ? "lore.greet.friend" : band === "guest" ? "lore.greet.guest" : "lore.greet.uneasy";
}

function mainBody(ctx, band, menu, state) {
  const parts = [t(greetingKey(band))];
  if (menu.renown) {
    parts.push("\n\n", t("lore.rank.line", t(`lore.rank.${rankOf(state.points)}`)));
    const next = nextRank(state.points);
    parts.push("\n", next ? t("lore.rank.next", t(`lore.rank.${next.next}`), next.needed) : t("lore.rank.max"));
    if (!menu.requests) parts.push("\n\n", t("lore.requests.locked"));
    else if (!state.request && requestsLeft(state) === 0) parts.push("\n\n", t("lore.requests.none"));
  } else if (state.request) parts.push("\n\n", t("lore.requests.paused"));
  if (ctx.notice) {
    parts.push("\n\n", ctx.notice);
    ctx.notice = undefined;
  }
  return join(...parts);
}

async function dialog(ctx) {
  const { player } = ctx;
  for (let guard = 0; guard < 50; guard++) {
    if (!ctx.ok()) return;
    const band = bandOf(harmonyOf(player).harmony);
    const state = renownOf(player);
    const menu = menuFor(band, state);
    if (menu.mode === "hated") return;
    if (menu.mode === "shunned") {
      player.sendMessage(t("lore.shunned"));
      return;
    }
    const actions = [];
    const buttons = [];
    for (const id of menu.lessons) {
      actions.push({ lesson: id });
      buttons.push(t("lore.btn.lesson", t(`lore.lesson.${id}.name`)));
    }
    if (menu.remind.length) {
      actions.push({ remind: true });
      buttons.push(t("lore.btn.remind"));
    }
    if (menu.requests && (state.request || requestsLeft(state) > 0)) {
      actions.push({ request: true });
      buttons.push(t(state.request ? "lore.btn.request_active" : "lore.btn.request_new"));
    }
    actions.push({ farewell: true });
    buttons.push(t("lore.btn.farewell"));
    const pick = await choose(ctx, mainBody(ctx, band, menu, state), buttons);
    const action = pick === undefined ? undefined : actions[pick];
    if (!action || action.farewell) return;
    if (action.lesson) await lessonScreen(ctx, action.lesson, menu.mode !== "full" || lessonDone(state, action.lesson));
    else if (action.remind) await remindScreen(ctx, menu.remind);
    else if (action.request) await requestScreen(ctx);
  }
}

async function openDialog(player, elf) {
  if (open.has(player.id)) return;
  open.add(player.id);
  try {
    await dialog(makeContext(player, elf));
  } catch {
    // player or Loremaster gone mid-dialog
  } finally {
    open.delete(player.id);
  }
}

export function startLoremaster() {
  world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target, itemStack } = event;
    if (!isLoremaster(target)) return;
    if (itemStack && SKIP_ITEMS.has(itemStack.typeId)) return; // a lead or a name tag keeps working on him
    event.cancel = true;
    if (open.has(player.id) || repeatedUse(player, "loremaster")) return; // the event repeats for one use
    system.run(() => {
      if (target.isValid && player.isValid) openDialog(player, target);
    });
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => open.delete(playerId));
}
