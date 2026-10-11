import { message } from "./messages.js";
// The Loremaster's dialog (M2, redesigned 2026-10-11): using the Loremaster elf opens a short chain of screens. Rules and values:
// renown_rules.js; state, inventory and feedback: renown_game.js. Screens: main, teaching (a chapter), lesson, task (the current task),
// kinOffer (a request on offer), abandon (confirm), earlier (finished lessons), result (what a turn-in did). Lore lessons have no result screen:
// "I understand" returns to the teaching screen with a "You have learned" line on top.
// The before event only decides and cancels (read-only mode); the forms open next tick, because show() is not allowed in read-only mode.
// All form text is RawMessage { translate }. Selections are mapped through an array filled only by button() calls; the forms use no
// header / label / divider elements (whether those count in `selection` is unconfirmed), all other text lives in the body.
import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ELF_ID, PROFESSIONS } from "./elf_rules.js";
import { bandOf } from "./harmony.js";
import { harmonyOf } from "./harmony_game.js";
import { repeatedUse } from "./use_guard.js";
import {
  abandonTask, accept, completeLore, currentOffer, deliver, deliveryPlan, isTaskLesson, lessonById, lessonDone, menuFor,
  nextRank, rankOf, requestById, requestsLeft, requestTask, takeLesson, taskStatus, turnIn,
} from "./renown_rules.js";
import { celebrate, inventoryCounts, renownOf, saveRenown, saplingsPlanted, takeItems } from "./renown_game.js";

const LOREMASTER_VARIANT = PROFESSIONS.indexOf("loremaster");
const MAX_DISTANCE = 12; // the Loremaster must still be this close when an answer is applied (he strolls up to 6 blocks from home)
const BUSY_RETRIES = 10;
const BUSY_WAIT_TICKS = 10;
const MAX_SCREENS = 100;
const SKIP_ITEMS = new Set(["minecraft:lead", "minecraft:name_tag"]); // these keep their usual effect on the Loremaster

const ICON = {
  ready: "textures/ui/confirm", done: "textures/ui/check", offered: "textures/items/book_writable", lore: "textures/items/book_normal",
  teaching: "textures/items/book_enchanted", kin: "textures/items/paper", setAside: "textures/ui/trash_default", back: "textures/ui/arrow_left",
  farewell: "textures/ui/cancel", next: "textures/ui/arrowRight",
};
// Icon of the task: its item in this pack (lessons) or the profession's typical item (requests).
const LESSON_ICON = {
  harmony: "mallorn_blossom", dew: "morning_dew", nectar: "mallorn_nectar", lembas: "lembas_wrapped", fireflies: "bottle_of_fireflies",
  rope: "elven_rope", gifts: "mallorn_acorn",
};
const PROFESSION_ICON = { gardener: "mallorn_acorn", healer: "mallorn_nectar", woodwright: "elven_rope", lamplighter: "bottle_of_fireflies" };
const itemIcon = (name) => `textures/items/${name}`;

const open = new Set(); // player ids with a dialog running
const BUSY = Symbol("busy");

const t = (key, ...values) => message(key, ...values);
const join = (...parts) => ({ rawtext: parts.map((p) => (typeof p === "string" ? { text: p } : p)) });
const lines = (list) => join(...list.flatMap((x, i) => (i ? ["\n\n", x] : [x])));

function isLoremaster(entity) {
  try {
    return entity.typeId === ELF_ID && entity.getComponent("minecraft:variant")?.value === LOREMASTER_VARIANT;
  } catch {
    return false;
  }
}

const wait = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));
const say = (player, key) => {
  try {
    player.sendMessage(t(key));
  } catch {
    // player left
  }
};

// Shows a form; "UserBusy" (another screen open, or the interaction itself still closing) is retried.
// Resolves to the response, undefined (closed) or BUSY (gave up).
async function show(player, form) {
  for (let i = 0; i < BUSY_RETRIES; i++) {
    const res = await form.show(player);
    if (!res.canceled) return res;
    if (res.cancelationReason !== "UserBusy") return undefined;
    await wait(BUSY_WAIT_TICKS);
  }
  return BUSY;
}

// An action form: body and buttons [{ text, icon?, next }]. Resolves to the chosen button's `next` (a screen step), or undefined.
// A dropped answer (the player walked away, or the busy retries ran out) is told in chat instead of closing silently.
async function choose(ctx, body, buttons) {
  const form = new ActionFormData().title(ctx.title).body(body);
  const actions = []; // filled only by button(): the selection index maps into this array
  for (const b of buttons) {
    if (b.icon) form.button(b.text, b.icon);
    else form.button(b.text);
    actions.push(b);
  }
  const res = await show(ctx.player, form);
  if (res === BUSY) {
    say(ctx.player, "lore.busy");
    return undefined;
  }
  if (!res) return undefined;
  if (!ctx.ok()) { // the world went on while the form was open: apply nothing if it changed
    say(ctx.player, "lore.too_far");
    return undefined;
  }
  return actions[res.selection]?.next;
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

// ---- Shared reads ----
function view(ctx) {
  const state = renownOf(ctx.player);
  const band = bandOf(harmonyOf(ctx.player).harmony);
  return { state, band, menu: menuFor(band, state) };
}

// "active" | "ready" | undefined for the current task (inventory and planted saplings are read now; vanished sapling cells are dropped and saved).
function statusOf(ctx, state) {
  const task = state.task;
  if (!task) return undefined;
  const request = task.kind === "request" ? requestById(task.id) : undefined;
  const status = taskStatus(state, {
    harmony: harmonyOf(ctx.player).harmony,
    counts: request && !request.deed ? inventoryCounts(ctx.player) : {},
    saplings: request?.deed ? saplingsPlanted(ctx.player) : 0,
  });
  if (request?.deed) saveRenown(ctx.player);
  return status;
}

const taskName = (task) => (task.kind === "lesson" ? t(`lore.lesson.${task.id}.name`) : t(`lore.req.prof.${requestById(task.id).profession}`));
const taskIcon = (task) => itemIcon(task.kind === "lesson" ? LESSON_ICON[task.id] : PROFESSION_ICON[requestById(task.id).profession]);
const statusText = (status) => t(status === "ready" ? "lore.status.ready" : "lore.status.active");
const back = (to = "main") => ({ text: t("lore.btn.back"), icon: ICON.back, next: [to] });
const step = (name, arg) => [name, arg];

function progressLine(player, request) {
  if (request.deed) return t("lore.saplings.counted", Math.min(request.deed.count, saplingsPlanted(player)), request.deed.count);
  const plan = deliveryPlan(request, inventoryCounts(player));
  return t("lore.req.have", plan.have, plan.need);
}

const rankLines = (state) => {
  const next = nextRank(state.points);
  return next ? t("lore.rank.next", t(`lore.rank.${next.next}`), state.points, next.threshold) : t("lore.rank.max");
};

// ---- Screens (each resolves to the next step [name, arg], or undefined to end the dialog) ----
async function mainScreen(ctx) {
  const { player } = ctx;
  const { state, band, menu } = view(ctx);
  if (menu.mode === "hated") return undefined;
  if (menu.mode === "shunned") {
    player.sendMessage(t("lore.shunned"));
    return undefined;
  }
  const full = menu.mode === "full";
  const parts = [t(band === "friend" ? "lore.greet.friend" : band === "guest" ? "lore.greet.guest" : "lore.greet.uneasy")];
  const buttons = [];
  if (full) {
    parts.push("\n\n", t("lore.rank.line", t(`lore.rank.${rankOf(state.points)}`)), "\n", rankLines(state));
    if (!menu.requestsOpen) parts.push("\n\n", t("lore.requests.locked"));
    else if (!state.task && requestsLeft(state) === 0) parts.push("\n\n", t("lore.requests.none"));
    if (state.task) {
      const status = statusOf(ctx, state);
      parts.push("\n\n", t("lore.task.header"));
      buttons.push({
        text: join(taskName(state.task), "\n", statusText(status)),
        icon: status === "ready" ? ICON.ready : taskIcon(state.task),
        next: step("task"),
      });
    }
    const waiting = menu.teaching.offered.length + menu.teaching.lore.length;
    if (menu.teaching.chapter <= 3) {
      buttons.push({ text: join(t("lore.btn.teaching", t(`lore.chapter.${menu.teaching.chapter}`)), "\n", t("lore.teach.count", waiting)), icon: ICON.teaching, next: step("teaching") });
    } else if (menu.teaching.done.length) buttons.push({ text: t("lore.btn.earlier"), icon: ICON.done, next: step("earlier") });
    if (menu.canOfferRequest) buttons.push({ text: t("lore.btn.request_new"), icon: ICON.kin, next: step("kinOffer") });
  } else {
    if (state.task) parts.push("\n\n", t("lore.requests.paused"));
    for (const id of [...menu.teaching.offered, ...menu.teaching.done]) {
      buttons.push({ text: t(`lore.lesson.${id}.name`), icon: ICON.lore, next: step("lesson", { id, from: "main" }) });
    }
  }
  buttons.push({ text: t("lore.btn.farewell"), icon: ICON.farewell, next: undefined });
  return choose(ctx, join(...parts), buttons);
}

// A chapter: its lessons (deed lessons hide while a task is held), "Earlier lessons". `notice` = a line for the top ("You have learned: X").
async function teachingScreen(ctx, notice) {
  const { state, menu } = view(ctx);
  if (menu.mode !== "full") return step("main");
  const chapter = menu.teaching.chapter;
  const parts = [];
  if (notice) parts.push(notice);
  parts.push(chapter <= 3 ? t(`lore.chapter.${chapter}`) : t("lore.btn.earlier"));
  if (state.task && menu.teaching.offered.length) parts.push(t("lore.teach.busy"));
  const buttons = [];
  if (!state.task) {
    for (const id of menu.teaching.offered) buttons.push({ text: t(`lore.lesson.${id}.name`), icon: ICON.offered, next: step("lesson", { id, from: "teaching" }) });
  }
  for (const id of menu.teaching.lore) buttons.push({ text: t(`lore.lesson.${id}.name`), icon: ICON.lore, next: step("lesson", { id, from: "teaching" }) });
  if (menu.teaching.done.length) buttons.push({ text: t("lore.btn.earlier"), icon: ICON.done, next: step("earlier") });
  buttons.push(back("main"));
  return choose(ctx, lines(parts), buttons);
}

async function earlierScreen(ctx) {
  const { menu } = view(ctx);
  const ids = menu.teaching.done;
  if (!ids.length) return step("main");
  const buttons = ids.map((id) => ({ text: t(`lore.lesson.${id}.name`), icon: ICON.done, next: step("lesson", { id, from: "earlier" }) }));
  buttons.push(back("main"));
  return choose(ctx, t("lore.remind.body"), buttons);
}

// A lesson. Reminders (finished lessons, Uneasy) are read-only; a lore lesson ends with "I understand", a deed / Harmony lesson with "Take this task".
async function lessonScreen(ctx, { id, from }) {
  const { player } = ctx;
  const { state, menu } = view(ctx);
  const lesson = lessonById(id);
  if (!lesson) return step("main");
  const readOnly = menu.mode !== "full" || lessonDone(state, id);
  const parts = [t(`lore.lesson.${id}.text`)];
  const buttons = [];
  if (!readOnly && isTaskLesson(lesson)) {
    parts.push(t("lore.lesson.task", t(`lore.lesson.${id}.goal`)));
    if (!state.task) buttons.push({ text: t("lore.btn.take"), icon: ICON.ready, next: step("takeLesson", id) });
  } else if (!readOnly) buttons.push({ text: t("lore.btn.understand"), icon: ICON.ready, next: step("learn", id) });
  buttons.push(back(from));
  const next = await choose(ctx, lines(parts), buttons);
  if (next?.[0] === "takeLesson") {
    if (takeLesson(state, id, system.currentTick)) saveRenown(player);
    return step("main");
  }
  if (next?.[0] === "learn") {
    const result = completeLore(state, id);
    if (!result) return step(from);
    saveRenown(player);
    celebrate(player, [result], ctx.elf);
    const notice = result.chapterOpened ? join(t("lore.result.learned", t(`lore.lesson.${id}.name`)), "\n", t("lore.chapter.opened")) : t("lore.result.learned", t(`lore.lesson.${id}.name`));
    return step("teaching", notice);
  }
  return next;
}

// The current task: its text, the status, "It is done" when ready, "Set this aside".
async function taskScreen(ctx) {
  const { player } = ctx;
  const { state, menu } = view(ctx);
  const task = state.task;
  if (!task || menu.mode !== "full") return step("main");
  const status = statusOf(ctx, state);
  const parts = [];
  if (task.kind === "lesson") {
    parts.push(t(`lore.lesson.${task.id}.text`), t("lore.lesson.task", t(`lore.lesson.${task.id}.goal`)));
  } else {
    parts.push(t(`lore.req.${task.id}.text`), progressLine(player, requestById(task.id)));
  }
  parts.push(t(status === "ready" ? "lore.status.done" : "lore.status.active"));
  const buttons = [];
  if (status === "ready") buttons.push({ text: t("lore.btn.done"), icon: ICON.ready, next: step("turnIn") });
  buttons.push({ text: t("lore.btn.set_aside"), icon: ICON.setAside, next: step("abandon") });
  buttons.push(back("main"));
  const next = await choose(ctx, lines(parts), buttons);
  if (next?.[0] === "turnIn") return task.kind === "lesson" ? turnInLesson(ctx, state) : turnInRequest(ctx, state);
  return next;
}

// Rank line of the result screens: the progress to the next rank, and the rank-up line when a threshold was crossed.
function resultLines(first, result, state) {
  const out = [first, t("lore.result.renown"), rankLines(state)];
  if (result.chapterOpened) out.push(t("lore.chapter.opened"));
  if (result.rank?.rankedUp) out.push(t(`lore.rankup.${result.rank.after}`));
  return step("result", out);
}

function turnInLesson(ctx, state) {
  const { player } = ctx;
  const result = turnIn(state, harmonyOf(player).harmony); // Harmony is re-checked now
  if (!result) return step("result", [t("lore.harmony.not_yet")]);
  saveRenown(player);
  celebrate(player, [result], ctx.elf);
  return resultLines(t("lore.done.lesson", t(`lore.lesson.${result.lesson}.name`)), result, state);
}

// Counting and removing happen here, in the same tick, after the answer (ctx.ok() was checked by choose()).
function turnInRequest(ctx, state) {
  const { player } = ctx;
  const request = requestById(requestTask(state).id);
  if (request.deed) {
    if (saplingsPlanted(player) < request.deed.count) {
      saveRenown(player); // vanished cells were dropped
      return step("result", [t("lore.saplings.missing")]);
    }
  } else {
    const plan = deliveryPlan(request, inventoryCounts(player));
    if (!plan.ok || !takeItems(player, plan.take)) return step("result", [t("lore.deliver.missing")]);
  }
  const result = deliver(state);
  saveRenown(player);
  if (!result) return step("main");
  celebrate(player, [result], ctx.elf);
  return resultLines(t("lore.deliver.ok"), result, state);
}

// "A task from my kin": the request on offer; "I will" makes it the current task.
async function kinOfferScreen(ctx) {
  const { player } = ctx;
  const { state, menu } = view(ctx);
  if (!menu.canOfferRequest) return step("main");
  const offer = currentOffer(state);
  saveRenown(player); // a new pull changes the state
  if (!offer) return step("main");
  const next = await choose(ctx, t(`lore.req.${offer.id}.text`), [
    { text: t("lore.btn.accept"), icon: ICON.ready, next: step("accept") },
    { text: t("lore.btn.notnow"), icon: ICON.back, next: step("main") }, // "Not now" keeps the offer for next time
  ]);
  if (next?.[0] === "accept") {
    if (accept(state)) saveRenown(player);
    return step("main");
  }
  return next;
}

async function abandonScreen(ctx) {
  const { player } = ctx;
  const { state } = view(ctx);
  if (!state.task) return step("main");
  const next = await choose(ctx, t("lore.abandon.ask"), [
    { text: t("lore.btn.keep"), icon: ICON.back, next: step("task") },
    { text: t("lore.btn.set_aside"), icon: ICON.setAside, next: step("setAside") },
  ]);
  if (next?.[0] !== "setAside") return next;
  if (!abandonTask(state)) return step("main");
  saveRenown(player);
  return step("result", [t("lore.abandon.done")]);
}

// What an action did: a body of lines and one "Continue".
async function resultScreen(ctx, list) {
  return choose(ctx, lines(list), [{ text: t("lore.btn.continue"), icon: ICON.next, next: step("main") }]);
}

const SCREENS = {
  main: mainScreen, teaching: teachingScreen, earlier: earlierScreen, lesson: lessonScreen, task: taskScreen,
  kinOffer: kinOfferScreen, abandon: abandonScreen, result: resultScreen,
};

// The dialog opens straight on the task screen when the task is ready to be turned in.
function initialScreen(ctx) {
  const { state, menu } = view(ctx);
  return menu.mode === "full" && state.task && statusOf(ctx, state) === "ready" ? step("task") : step("main");
}

async function dialog(ctx) {
  let next = initialScreen(ctx);
  for (let guard = 0; next && guard < MAX_SCREENS; guard++) {
    if (!ctx.ok()) {
      say(ctx.player, "lore.too_far");
      return;
    }
    next = await SCREENS[next[0]](ctx, next[1]);
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
