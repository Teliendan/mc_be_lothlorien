// Renown and the Loremaster's teaching (M2): every tunable value and the pure logic. No @minecraft/server import, so
// tests/renown.mjs can run it offline. The game side is renown_game.js (state, inventory, feedback) and loremaster.js (forms).
// Design: docs/design/elven_inhabitants.md sections 2-3. Owner decisions 2026-10-10: lessons are chapters, deeds count only
// while their lesson is active, requests open after chapters I and II, no cooldown, a random permutation of the professions per
// round, every request can be completed once.

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
// kind "lore": completes when read ("I understand"); "deed": completes by a deed hook while the lesson is active (deed = hook id);
// "harmony": completes when the player presses "It is done" while Harmony >= HARMONY_NEEDED (and the lesson is active).
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

// ---- State: { v, points, done: {id: true}, active: {lessonId: tick}, request: {id, spots: []} | null, offer: id | null, queue: [professions] } ----
export const STATE_VERSION = 1;
export const newState = () => ({ v: STATE_VERSION, points: 0, done: {}, active: {}, request: null, offer: null, queue: [] });
export const serialize = (state) => JSON.stringify(state);

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
// Tolerates missing or damaged data: unreadable parts fall back to the fresh values; unknown ids are dropped.
export function parse(text) {
  const state = newState();
  try {
    const raw = JSON.parse(text);
    if (!isObj(raw) || raw.v !== STATE_VERSION) return state;
    if (Number.isFinite(raw.points) && raw.points >= 0) state.points = Math.trunc(raw.points);
    if (isObj(raw.done)) for (const k of Object.keys(raw.done)) if (raw.done[k] === true) state.done[k] = true;
    if (isObj(raw.active)) for (const k of Object.keys(raw.active)) if (lessonById(k) && Number.isFinite(raw.active[k])) state.active[k] = raw.active[k];
    if (isObj(raw.request) && requestById(raw.request.id)) {
      state.request = { id: raw.request.id, spots: Array.isArray(raw.request.spots) ? raw.request.spots.filter((s) => typeof s === "string").slice(0, REQUEST_SPOT_CAP) : [] };
    }
    if (typeof raw.offer === "string" && requestById(raw.offer) && !state.request) state.offer = raw.offer;
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
// Lowest chapter with an unfinished lesson; CHAPTERS.length + 1 when the teaching is complete.
export function openChapter(state) {
  for (const n of CHAPTERS) if (lessonsOfChapter(n).some((l) => !lessonDone(state, l.id))) return n;
  return CHAPTERS.length + 1;
}
export const availableLessons = (state) => lessonsOfChapter(openChapter(state)).filter((l) => !lessonDone(state, l.id));
export const doneLessons = (state) => LESSONS.filter((l) => lessonDone(state, l.id));
export const lessonActive = (state, id) => id in state.active && !lessonDone(state, id);
export const requestsOpen = (state) => openChapter(state) >= 3;

// The player opened the screen of a lesson of the open chapter: from now on its deed counts. Returns true when newly given.
export function activate(state, id, now) {
  if (!availableLessons(state).some((l) => l.id === id) || id in state.active) return false;
  state.active[id] = now;
  return true;
}

// Marks a lesson done and pays it. Returns { points, rank, chapterOpened } (chapterOpened = new open chapter number or undefined).
function finish(state, lesson) {
  const chapterBefore = openChapter(state);
  state.done[lesson.id] = true;
  delete state.active[lesson.id];
  const pts = lessonPoints(lesson);
  const rank = award(state, pts);
  const chapterAfter = openChapter(state);
  return { lesson: lesson.id, points: pts, rank, chapterOpened: chapterAfter > chapterBefore ? chapterAfter : undefined };
}

// "I understand" on a lore lesson (must be available and given). Returns the finish result or undefined.
export function completeLore(state, id) {
  const lesson = lessonById(id);
  if (!lesson || lesson.kind !== "lore" || !availableLessons(state).some((l) => l.id === id)) return undefined;
  activate(state, id, 0);
  return finish(state, lesson);
}

// "It is done" on the Harmony lesson: needs the lesson active and Harmony >= HARMONY_NEEDED now.
export function completeHarmony(state, harmony) {
  const lesson = lessonById("harmony");
  if (!lessonActive(state, "harmony") || !availableLessons(state).some((l) => l.id === "harmony")) return undefined;
  if (!(harmony >= HARMONY_NEEDED)) return undefined;
  return finish(state, lesson);
}

// A deed hook fired. Completes the matching lesson only while it is active (given and not done). Returns a list of finish results.
export function noteDeed(state, deedId) {
  const results = [];
  for (const lesson of LESSONS) {
    if (lesson.kind === "deed" && lesson.deed === deedId && lessonActive(state, lesson.id)) results.push(finish(state, lesson));
  }
  return results;
}

// ---- What the Loremaster offers per band (A6) ----
// mode: full (friend, guest) | uneasy | shunned | hated. lessons = ids to list; remind = completed lessons to list; requests = may offer / deliver.
export function menuFor(band, state) {
  if (band === "hated") return { mode: "hated", lessons: [], remind: [], requests: false, renown: false };
  if (band === "shunned") return { mode: "shunned", lessons: [], remind: [], requests: false, renown: false };
  if (band === "uneasy") return { mode: "uneasy", lessons: ["harmony"], remind: [], requests: false, renown: false };
  return {
    mode: "full",
    lessons: availableLessons(state).map((l) => l.id),
    remind: doneLessons(state).map((l) => l.id),
    requests: requestsOpen(state),
    renown: true,
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
  if (state.request) return requestById(state.request.id);
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

// "I will": the offer becomes the active request.
export function accept(state) {
  if (state.request || !state.offer || state.done[state.offer]) return false;
  state.request = { id: state.offer, spots: [] };
  state.offer = null;
  return true;
}

// Abandon: nothing taken, no points; not marked done (it may come again); the rotation moves on (the offer is dropped).
export function abandon(state) {
  if (!state.request) return false;
  state.request = null;
  state.offer = null;
  return true;
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
  const r = state.request;
  if (!r || !requestById(r.id)?.deed || r.spots.includes(cell)) return false;
  if (r.spots.length >= REQUEST_SPOT_CAP) r.spots.shift();
  r.spots.push(cell);
  return true;
}
// Counts the remembered cells that still hold a sapling or a grown tree; `valid(cell)` returns true/false (an unloaded chunk: true).
// Cells that went missing are dropped (so breaking and replanting one cell never counts twice).
export function saplingProgress(state, valid) {
  const r = state.request;
  if (!r) return 0;
  r.spots = r.spots.filter((c) => valid(c) !== false);
  return r.spots.length;
}

// Delivery of the active request, checked by the caller (counts / saplings). Pays and marks it done.
// Returns { request, points, rank } or undefined.
export function deliver(state) {
  const r = state.request;
  if (!r) return undefined;
  state.done[r.id] = true;
  state.request = null;
  state.offer = null;
  return { request: r.id, points: POINTS.request, rank: award(state, POINTS.request) };
}
