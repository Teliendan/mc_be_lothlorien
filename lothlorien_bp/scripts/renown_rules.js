// Renown and the Loremaster's teaching (M2): every tunable value and the pure logic. No @minecraft/server import, so
// tests/renown.mjs can run it offline. The game side is renown_game.js (state, inventory, feedback) and loremaster.js (forms).
// Design: docs/design/elven_inhabitants.md sections 2-3. Owner decisions 2026-10-10: lessons are chapters, requests open after
// chapters I and II, no cooldown, a random permutation of the professions per round, every request can be completed once.
// Owner decisions 2026-10-11 (dialog redesign): ONE current-task slot shared by deed lessons (Harmony included) and requests;
// a deed only makes the task ready, Renown is paid at turn-in; deeds done while their lesson is not the task are lost.

// ---- Ranks ----
export const RANKS = ["stranger", "welcome", "trusted", "elf_friend"];
export const THRESHOLDS = [0, 3, 8, 15]; // points from which each rank holds
export const POINTS = { deed_lesson: 1, lore_lesson: 0, request: 2 };

export function rankIndexOf(points) {
  let rank = 0;
  for (let i = 0; i < THRESHOLDS.length; i++) if (points >= THRESHOLDS[i]) rank = i;
  return rank;
}
export const rankOf = (points) => RANKS[rankIndexOf(points)];
// { next, needed, threshold } for the next rank (threshold = points from which it holds), or undefined at the highest one.
export function nextRank(points) {
  const i = rankIndexOf(points);
  return i + 1 < RANKS.length ? { next: RANKS[i + 1], needed: THRESHOLDS[i + 1] - points, threshold: THRESHOLDS[i + 1] } : undefined;
}

// ---- Lessons, in chapters ----
// kind "lore": completes when read ("I understand"), needs no slot; "deed": becomes ready by a deed hook while it is the task
// (deed = hook id) and is paid at turn-in; "harmony": ready is computed at talk time (Harmony >= HARMONY_NEEDED), paid at turn-in.
export const HARMONY_NEEDED = 3;
export const LESSONS = [
  { id: "harmony", chapter: 1, kind: "harmony" },
  { id: "elves", chapter: 1, kind: "lore" },
  { id: "renown", chapter: 1, kind: "lore" },
  { id: "dew", chapter: 1, kind: "deed", deed: "dew" },
  { id: "nectar", chapter: 1, kind: "deed", deed: "nectar" },
  { id: "depth", chapter: 2, kind: "lore" },
  { id: "lembas", chapter: 2, kind: "deed", deed: "lembas" },
  { id: "fireflies", chapter: 2, kind: "deed", deed: "fireflies" },
  { id: "rope", chapter: 2, kind: "deed", deed: "rope" },
  { id: "gifts", chapter: 3, kind: "deed", deed: "squirrel" },
  { id: "white_animals", chapter: 3, kind: "lore" },
  { id: "trades", chapter: 3, kind: "lore" },
];
export const CHAPTERS = [1, 2, 3];
export const lessonById = (id) => LESSONS.find((l) => l.id === id);
export const lessonPoints = (lesson) => (lesson.kind === "lore" ? POINTS.lore_lesson : POINTS.deed_lesson);
export const lessonsOfChapter = (n) => LESSONS.filter((l) => l.chapter === n);

// ---- Requests ----
export const PROFESSIONS = ["gardener", "healer", "woodwright", "lamplighter"];
export const SAPLING_BLOCK = "lothlorien:mallorn_sapling";
export const SAPLING_GROWN = ["lothlorien:mallorn_log"]; // a spot where the sapling grew into a tree still counts
export const REQUESTS = [
  { id: "g_acorns", profession: "gardener", deed: { block: SAPLING_BLOCK, count: 5 } },
  { id: "g_dew", profession: "gardener", items: [{ ids: ["lothlorien:morning_dew"], count: 2 }] },
  { id: "g_bonemeal", profession: "gardener", items: [{ ids: ["minecraft:bone_meal"], count: 16 }] },
  { id: "h_athelas", profession: "healer", items: [{ ids: ["lothlorien:athelas"], count: 4 }] },
  { id: "h_nectar", profession: "healer", items: [{ ids: ["lothlorien:mallorn_nectar"], count: 2 }] },
  { id: "h_flowers", profession: "healer", items: [{ ids: ["lothlorien:elanor"], count: 4 }, { ids: ["lothlorien:niphredil"], count: 4 }] },
  { id: "w_logs", profession: "woodwright", items: [{ ids: ["minecraft:birch_log", "minecraft:cherry_log"], count: 32 }] },
  { id: "w_fletching", profession: "woodwright", items: [{ ids: ["minecraft:string"], count: 8 }, { ids: ["minecraft:feather"], count: 8 }] },
  { id: "w_iron", profession: "woodwright", items: [{ ids: ["minecraft:iron_ingot"], count: 6 }] },
  { id: "l_fireflies", profession: "lamplighter", items: [{ ids: ["lothlorien:bottle_of_fireflies"], count: 3 }] },
  { id: "l_coal", profession: "lamplighter", items: [{ ids: ["minecraft:coal", "minecraft:charcoal"], count: 16 }] },
  { id: "l_glass", profession: "lamplighter", items: [{ ids: ["minecraft:glass"], count: 16 }] },
];
export const requestById = (id) => REQUESTS.find((r) => r.id === id);
export const REQUEST_SPOT_CAP = 32; // most remembered sapling cells

// ---- State: { v, points, done: {id: true}, task, offer: id | null, queue: [professions] } ----
// task = null | { kind: "lesson", id, ready, since } | { kind: "request", id, spots: [] }   (v1 had `active` and `request`)
export const STATE_VERSION = 2;
export const newState = () => ({ v: STATE_VERSION, points: 0, done: {}, task: null, offer: null, queue: [] });
export const serialize = (state) => JSON.stringify(state);

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const spotsOf = (r) => (Array.isArray(r?.spots) ? r.spots.filter((s) => typeof s === "string").slice(0, REQUEST_SPOT_CAP) : []);
// Tolerates missing or damaged data: unreadable parts fall back to the fresh values; unknown ids are dropped.
// v1 -> v2: points, done, offer and queue are kept; the v1 request becomes the task; v1 `active` lessons are dropped (players take them again).
export function parse(text) {
  const state = newState();
  try {
    const raw = JSON.parse(text);
    if (!isObj(raw) || (raw.v !== 1 && raw.v !== 2)) return state;
    if (Number.isFinite(raw.points) && raw.points >= 0) state.points = Math.trunc(raw.points);
    if (isObj(raw.done)) for (const k of Object.keys(raw.done)) if (raw.done[k] === true) state.done[k] = true;
    const t = raw.v === 1 ? (isObj(raw.request) ? { kind: "request", ...raw.request } : null) : raw.task;
    if (isObj(t) && t.kind === "request" && requestById(t.id) && !state.done[t.id]) state.task = { kind: "request", id: t.id, spots: spotsOf(t) };
    else if (isObj(t) && t.kind === "lesson" && isTaskLesson(lessonById(t.id)) && !state.done[t.id]) {
      state.task = { kind: "lesson", id: t.id, ready: t.ready === true, since: Number.isFinite(t.since) ? t.since : 0 };
    }
    if (typeof raw.offer === "string" && requestById(raw.offer) && !state.task) state.offer = raw.offer;
    if (Array.isArray(raw.queue)) state.queue = raw.queue.filter((p) => PROFESSIONS.includes(p));
  } catch {
    // no saved state
  }
  return state;
}

// ---- Points and ranks ----
// Adds points; returns { before, after, rankedUp } (rank names).
export function award(state, pts) {
  const before = rankOf(state.points);
  state.points += Math.max(0, Math.trunc(pts));
  const after = rankOf(state.points);
  return { before, after, rankedUp: before !== after };
}

// ---- Chapters and lessons ----
export const lessonDone = (state, id) => state.done[id] === true;
export const isTaskLesson = (lesson) => lesson?.kind === "deed" || lesson?.kind === "harmony"; // lessons that use the task slot
// Lowest chapter with an unfinished lesson; CHAPTERS.length + 1 when the teaching is complete.
export function openChapter(state) {
  for (const n of CHAPTERS) if (lessonsOfChapter(n).some((l) => !lessonDone(state, l.id))) return n;
  return CHAPTERS.length + 1;
}
export const availableLessons = (state) => lessonsOfChapter(openChapter(state)).filter((l) => !lessonDone(state, l.id));
export const doneLessons = (state) => LESSONS.filter((l) => lessonDone(state, l.id));
export const requestsOpen = (state) => openChapter(state) >= 3;
export const lessonTask = (state) => (state.task?.kind === "lesson" ? state.task : null);
export const requestTask = (state) => (state.task?.kind === "request" ? state.task : null);

// "Take this task": a deed or Harmony lesson of the open chapter becomes the current task (the slot must be empty).
export function takeLesson(state, id, now) {
  const lesson = lessonById(id);
  if (state.task || !isTaskLesson(lesson) || !availableLessons(state).some((l) => l.id === id)) return false;
  state.task = { kind: "lesson", id, ready: false, since: now };
  return true;
}

// Marks a lesson done and pays it. Returns { lesson, points, rank, chapterOpened } (chapterOpened = new open chapter number or undefined).
function finish(state, lesson) {
  const chapterBefore = openChapter(state);
  state.done[lesson.id] = true;
  if (state.task?.kind === "lesson" && state.task.id === lesson.id) state.task = null;
  const pts = lessonPoints(lesson);
  const rank = award(state, pts);
  const chapterAfter = openChapter(state);
  return { lesson: lesson.id, points: pts, rank, chapterOpened: chapterAfter > chapterBefore ? chapterAfter : undefined };
}

// "I understand" on a lore lesson of the open chapter (no slot needed). Returns the finish result or undefined.
export function completeLore(state, id) {
  const lesson = lessonById(id);
  if (!lesson || lesson.kind !== "lore" || !availableLessons(state).some((l) => l.id === id)) return undefined;
  return finish(state, lesson);
}

// A deed hook fired. Only the current task counts: its lesson becomes ready (no points yet). Deeds done while the lesson is not
// the task are lost. Returns [{ lesson, ready: true }] or [].
export function noteDeed(state, deedId) {
  const task = lessonTask(state);
  const lesson = task && lessonById(task.id);
  if (!lesson || lesson.kind !== "deed" || lesson.deed !== deedId || task.ready) return [];
  task.ready = true;
  return [{ lesson: lesson.id, ready: true }];
}

// "active" | "ready" | undefined (no task). `ctx` = { harmony, counts (inventory), saplings (planted count) }, all read by the caller.
export function taskStatus(state, ctx = {}) {
  const task = state.task;
  if (!task) return undefined;
  if (task.kind === "lesson") {
    const lesson = lessonById(task.id);
    return task.ready || (lesson.kind === "harmony" && ctx.harmony >= HARMONY_NEEDED) ? "ready" : "active";
  }
  const request = requestById(task.id);
  if (request.deed) return (ctx.saplings ?? 0) >= request.deed.count ? "ready" : "active";
  return deliveryPlan(request, ctx.counts ?? {}).ok ? "ready" : "active";
}

// "It is done" on the task lesson: needs it ready (Harmony is re-checked now). Pays and clears the task. Returns the finish result or undefined.
export function turnIn(state, harmony) {
  const task = lessonTask(state);
  if (!task || taskStatus(state, { harmony }) !== "ready") return undefined;
  return finish(state, lessonById(task.id));
}

// ---- What the Loremaster offers per band (A6) ----
// mode: full (friend, guest) | uneasy | shunned | hated. teaching = { chapter, offered: deed/Harmony lessons to take, lore: lore lessons to read,
// done: finished lessons to re-read }; canOfferRequest = "A task from my kin" is shown (requests open, slot free, something left).
export function menuFor(band, state) {
  const none = { chapter: openChapter(state), offered: [], lore: [], done: [] };
  const off = { renown: false, requestsOpen: false, canOfferRequest: false };
  if (band === "hated") return { mode: "hated", ...off, teaching: none };
  if (band === "shunned") return { mode: "shunned", ...off, teaching: none };
  if (band === "uneasy") {
    const read = lessonDone(state, "harmony");
    return { mode: "uneasy", ...off, teaching: { ...none, offered: read ? [] : ["harmony"], done: read ? ["harmony"] : [] } };
  }
  const open = availableLessons(state);
  return {
    mode: "full",
    renown: true,
    teaching: {
      chapter: openChapter(state),
      offered: open.filter(isTaskLesson).map((l) => l.id),
      lore: open.filter((l) => l.kind === "lore").map((l) => l.id),
      done: doneLessons(state).map((l) => l.id),
    },
    requestsOpen: requestsOpen(state),
    canOfferRequest: requestsOpen(state) && !state.task && requestsLeft(state) > 0,
  };
}

// ---- Requests: random permutation rounds, each request once ----
const remainingOf = (state, profession) => REQUESTS.filter((r) => r.profession === profession && !state.done[r.id]);
export const requestsLeft = (state) => REQUESTS.filter((r) => !state.done[r.id]).length;

// Fisher-Yates with an injectable rng (() => [0, 1)).
export function shuffled(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The request on offer: the active one, else the kept offer, else a new pull (a random not-yet-done request of the next profession in
// the round; a new round is a fresh permutation of all four). undefined when everything is done. Pulling sets state.offer.
export function currentOffer(state, rng = Math.random) {
  if (requestTask(state)) return requestById(state.task.id);
  if (state.offer && !state.done[state.offer]) return requestById(state.offer);
  state.offer = null;
  if (requestsLeft(state) === 0) return undefined;
  for (let round = 0; round < 2; round++) {
    while (state.queue.length) {
      const profession = state.queue.shift();
      const pool = remainingOf(state, profession);
      if (pool.length === 0) continue;
      const pick = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
      state.offer = pick.id;
      return pick;
    }
    state.queue = shuffled(PROFESSIONS, rng);
  }
  return undefined;
}

// "I will": the offer becomes the current task (the slot must be empty).
export function accept(state) {
  if (state.task || !state.offer || state.done[state.offer]) return false;
  state.task = { kind: "request", id: state.offer, spots: [] };
  state.offer = null;
  return true;
}

// Set the current task aside: no points, nothing done. A lesson goes back to offered (its deed must be done again after taking it);
// a request may come again and the rotation moves on (the offer is dropped). Returns the kind of the task set aside, or false.
export function abandonTask(state) {
  const kind = state.task?.kind;
  if (!kind) return false;
  state.task = null;
  if (kind === "request") state.offer = null;
  return kind;
}

// ---- Delivery ----
// counts: { typeId: n } of the player's main inventory. Returns { ok, have, need, missing, take } where take = [{ id, count }]
// (any-of entries are taken in the listed order). have/need sum the entries (each capped at its count).
export function deliveryPlan(request, counts) {
  const take = [];
  let have = 0, need = 0;
  const missing = [];
  for (const entry of request.items ?? []) {
    need += entry.count;
    let left = entry.count;
    for (const id of entry.ids) {
      const n = Math.min(left, counts[id] ?? 0);
      if (n > 0) { take.push({ id, count: n }); left -= n; }
    }
    have += entry.count - left;
    if (left > 0) missing.push({ ids: entry.ids, count: left });
  }
  return { ok: missing.length === 0 && need > 0, have, need, missing, take: missing.length ? [] : take };
}

// Sapling request: remember a planted cell (distinct, capped). Returns true when it was new. Only while that request is active.
export function addSaplingSpot(state, cell) {
  const r = requestTask(state);
  if (!r || !requestById(r.id)?.deed || r.spots.includes(cell)) return false;
  if (r.spots.length >= REQUEST_SPOT_CAP) r.spots.shift();
  r.spots.push(cell);
  return true;
}
// Counts the remembered cells that still hold a sapling or a grown tree; `valid(cell)` returns true/false (an unloaded chunk: true).
// Cells that went missing are dropped (so breaking and replanting one cell never counts twice).
export function saplingProgress(state, valid) {
  const r = requestTask(state);
  if (!r) return 0;
  r.spots = r.spots.filter((c) => valid(c) !== false);
  return r.spots.length;
}

// Delivery of the active request, checked by the caller (counts / saplings). Pays and marks it done.
// Returns { request, points, rank } or undefined.
export function deliver(state) {
  const r = requestTask(state);
  if (!r) return undefined;
  state.done[r.id] = true;
  state.task = null;
  state.offer = null;
  return { request: r.id, points: POINTS.request, rank: award(state, POINTS.request) };
}
