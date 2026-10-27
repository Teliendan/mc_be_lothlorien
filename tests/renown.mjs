// Renown rules (M2): pure logic of lothlorien_bp/scripts/renown_rules.js plus data checks (request item ids, catalog keys, elf entity).
// Imported by tests/run.mjs; assertions throw.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as R from "../lothlorien_bp/scripts/renown_rules.js";

const text = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
function test(name, fn) { fn(); console.log(`ok   renown: ${name}`); }
// deterministic rng (mulberry32)
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const OPEN = (s) => R.availableLessons(s).map((l) => l.id);
// finishes every lesson of the open chapter the way the game does (lore: read; others: take, deed, turn in); returns the finish results
function doChapter(s) {
  const out = [];
  for (const l of R.availableLessons(s)) {
    if (l.kind === "lore") { out.push(R.completeLore(s, l.id)); continue; }
    assert.equal(R.takeLesson(s, l.id, 1), true, `take ${l.id}`);
    if (l.kind === "deed") assert.deepEqual(R.noteDeed(s, l.deed), [{ lesson: l.id, ready: true }]);
    out.push(R.turnIn(s, 5));
  }
  return out;
}
const finishRequest = (s, rng) => { R.currentOffer(s, rng); R.accept(s); return R.deliver(s); };

test("thresholds 3 / 8 / 15 with their edges", () => {
  assert.deepEqual(R.THRESHOLDS, [0, 3, 8, 15]);
  for (const [pts, rank] of [[0, "stranger"], [2, "stranger"], [3, "welcome"], [7, "welcome"], [8, "trusted"], [14, "trusted"], [15, "elf_friend"], [99, "elf_friend"]]) assert.equal(R.rankOf(pts), rank, `${pts}`);
  assert.deepEqual(R.nextRank(14), { next: "elf_friend", needed: 1, threshold: 15 });
  assert.equal(R.nextRank(15), undefined);
});

test("points: deed lesson 1, lore lesson 0, request 2", () => {
  assert.deepEqual(R.POINTS, { deed_lesson: 1, lore_lesson: 0, request: 2 });
  assert.equal(R.REQUESTS.length, 12);
});

test("chapters: only the open chapter is available; the next one opens when every lesson of this one is complete", () => {
  const s = R.newState();
  assert.deepEqual(OPEN(s), ["harmony", "elves", "renown", "dew", "nectar"]);
  assert.equal(R.openChapter(s), 1);
  R.completeLore(s, "elves");
  assert.deepEqual(OPEN(s), ["harmony", "renown", "dew", "nectar"], "a finished lesson leaves the list");
  assert.equal(R.takeLesson(s, "lembas", 1), false, "a lesson of a later chapter cannot be taken");
  assert.equal(R.completeLore(s, "depth"), undefined);
  doChapter(s);
  assert.equal(R.openChapter(s), 2);
  assert.deepEqual(OPEN(s), ["depth", "lembas", "fireflies", "rope"]);
});

test("pacing: chapter I = 3 (Welcome), chapter II = 6 (Trusted needs 1 request), chapter III deeds = 7 (Elf-friend needs 4 requests)", () => {
  const s = R.newState(), rng = seeded(7);
  doChapter(s);
  assert.equal(s.points, 3); assert.equal(R.rankOf(s.points), "welcome");
  doChapter(s);
  assert.equal(s.points, 6); assert.equal(R.rankOf(s.points), "welcome", "chapters alone do not make Trusted");
  assert.equal(R.requestsOpen(s), true, "requests open with chapter III");
  finishRequest(s, rng);
  assert.equal(s.points, 8); assert.equal(R.rankOf(s.points), "trusted");
  doChapter(s);
  assert.equal(s.points, 9, "chapter III deeds pay 1 (the gifts lesson)");
  assert.equal(R.openChapter(s), 4, "the teaching is complete");
  for (let i = 0; i < 3; i++) finishRequest(s, rng);
  assert.equal(s.points, 15); assert.equal(R.rankOf(s.points), "elf_friend");
  for (let i = 0; i < 8; i++) finishRequest(s, rng);
  assert.equal(R.requestsLeft(s), 0);
  assert.equal(s.points, 31, "points keep counting after the last rank (15 + 8 requests x 2)");
});

test("a deed counts only while its lesson is the task: it makes the task ready, the turn-in pays", () => {
  const s = R.newState();
  assert.deepEqual(R.noteDeed(s, "dew"), [], "no task yet: the deed is lost");
  assert.equal(R.takeLesson(s, "dew", 5), true);
  assert.deepEqual(R.noteDeed(s, "nectar"), [], "another lesson's deed is lost");
  assert.equal(R.taskStatus(s), "active");
  assert.deepEqual(R.noteDeed(s, "dew"), [{ lesson: "dew", ready: true }]);
  assert.equal(s.points, 0, "a deed alone pays nothing"); assert.equal(R.taskStatus(s), "ready");
  assert.deepEqual(R.noteDeed(s, "dew"), [], "ready already");
  const r = R.turnIn(s, 0);
  assert.equal(r.points, 1); assert.equal(s.points, 1); assert.equal(s.done.dew, true); assert.equal(s.task, null);
  assert.equal(R.turnIn(s, 5), undefined, "pays once, ever");
  assert.deepEqual(R.noteDeed(s, "dew"), []);
  assert.equal(R.takeLesson(s, "dew", 6), false, "a finished lesson cannot be taken again");
  assert.deepEqual(R.noteDeed(s, "lembas"), [], "a lesson of a later chapter is never the task");
});

test("one task slot: lessons and requests exclude each other, lore never needs the slot", () => {
  const s = R.newState();
  assert.equal(R.takeLesson(s, "elves", 1), false, "lore is not a task");
  assert.equal(R.takeLesson(s, "dew", 1), true);
  assert.equal(R.takeLesson(s, "nectar", 1), false, "slot taken");
  assert.equal(R.completeLore(s, "elves").lesson, "elves", "lore completes while a task is held");
  assert.equal(s.task.id, "dew");
  R.noteDeed(s, "dew"); R.turnIn(s, 0); // finish the held task first, then the rest of chapter I and chapter II
  doChapter(s);
  doChapter(s);
  assert.equal(R.takeLesson(s, "gifts", 1), true);
  s.offer = "g_dew";
  assert.equal(R.accept(s), false, "a request cannot be accepted while a lesson is the task");
  R.abandonTask(s);
  assert.equal(R.accept(s), true);
  assert.equal(R.takeLesson(s, "gifts", 1), false, "a lesson cannot be taken while a request is the task");
  assert.equal(R.menuFor("guest", s).canOfferRequest, false, "kin offer hidden while the slot is full");
});

test("abandon: a lesson goes back to offered (not done, ready cleared, deed again), a request is not done and the rotation moves on", () => {
  const s = R.newState();
  R.takeLesson(s, "nectar", 1); R.noteDeed(s, "nectar");
  assert.equal(R.taskStatus(s), "ready");
  assert.equal(R.abandonTask(s), "lesson");
  assert.equal(s.task, null); assert.equal(s.points, 0); assert.equal(s.done.nectar, undefined);
  assert.ok(R.menuFor("guest", s).teaching.offered.includes("nectar"), "offered again");
  assert.equal(R.takeLesson(s, "nectar", 2), true);
  assert.equal(R.taskStatus(s), "active", "the old deed is gone");
  assert.equal(R.abandonTask(R.newState()), false, "nothing to set aside");
});

test("the Harmony lesson: ready is computed at talk time (Harmony >= +3), paid by turn-in once", () => {
  const s = R.newState();
  assert.equal(R.turnIn(s, 10), undefined, "not taken");
  assert.equal(R.takeLesson(s, "harmony", 1), true);
  assert.equal(R.taskStatus(s, { harmony: 2 }), "active");
  assert.equal(R.taskStatus(s, { harmony: -5 }), "active");
  assert.equal(R.taskStatus(s, { harmony: 3 }), "ready");
  assert.deepEqual(R.noteDeed(s, "harmony"), [], "no deed hook for Harmony");
  assert.equal(R.turnIn(s, 2), undefined);
  assert.equal(R.turnIn(s, 3).points, 1);
  assert.equal(R.turnIn(s, 10), undefined, "once");
});

test("request status is computed from the inventory or the planted saplings", () => {
  const s = R.newState();
  s.task = { kind: "request", id: "h_nectar", spots: [] };
  assert.equal(R.taskStatus(s, { counts: { "lothlorien:mallorn_nectar": 1 } }), "active");
  assert.equal(R.taskStatus(s, { counts: { "lothlorien:mallorn_nectar": 2 } }), "ready");
  s.task = { kind: "request", id: "g_acorns", spots: [] };
  assert.equal(R.taskStatus(s, { saplings: 4 }), "active");
  assert.equal(R.taskStatus(s, { saplings: 5 }), "ready");
  assert.equal(R.taskStatus(R.newState(), { harmony: 9 }), undefined, "no task, no status");
});

test("rank-up result is reported on the point that crosses a threshold", () => {
  const s = R.newState();
  for (const id of ["dew", "nectar"]) { R.takeLesson(s, id, 1); R.noteDeed(s, id); R.turnIn(s, 0); }
  R.takeLesson(s, "harmony", 1);
  const r = R.turnIn(s, 3);
  assert.deepEqual(r.rank, { before: "stranger", after: "welcome", rankedUp: true });
});

test("gating by band: friend and guest full; uneasy only the Harmony lesson; shunned and hated nothing", () => {
  const s = R.newState();
  for (const band of ["friend", "guest"]) {
    const m = R.menuFor(band, s); assert.equal(m.mode, "full"); assert.equal(m.renown, true); assert.equal(m.requestsOpen, false, "chapters I and II not complete yet"); assert.equal(m.canOfferRequest, false);
    assert.deepEqual(m.teaching, { chapter: 1, offered: ["harmony", "dew", "nectar"], lore: ["elves", "renown"], done: [] });
  }
  assert.deepEqual(R.menuFor("uneasy", s), { mode: "uneasy", renown: false, requestsOpen: false, canOfferRequest: false, teaching: { chapter: 1, offered: ["harmony"], lore: [], done: [] } });
  assert.equal(R.menuFor("shunned", s).mode, "shunned"); assert.deepEqual(R.menuFor("shunned", s).teaching.offered, []);
  assert.equal(R.menuFor("hated", s).mode, "hated");
  doChapter(s); doChapter(s);
  assert.equal(R.menuFor("guest", s).canOfferRequest, true);
  assert.equal(R.menuFor("uneasy", s).canOfferRequest, false, "no requests while uneasy");
  assert.ok(R.menuFor("guest", s).teaching.done.includes("dew"), "finished lessons stay readable under Earlier lessons");
  assert.deepEqual(R.menuFor("uneasy", s).teaching, { chapter: 3, offered: [], lore: [], done: ["harmony"] }, "Harmony read-only once done");
});

test("an active task survives a drop to Uneasy (kept, paused) and the state round-trips", () => {
  const s = R.newState(); doChapter(s); doChapter(s);
  R.currentOffer(s, seeded(1)); R.accept(s);
  const id = s.task.id;
  R.menuFor("uneasy", s);
  const back = R.parse(R.serialize(s));
  assert.equal(back.task.id, id);
  assert.deepEqual(back, s);
});

test("no cooldown: the next request is offered right after delivery and right after abandoning", () => {
  const s = R.newState(), rng = seeded(3);
  const first = R.currentOffer(s, rng); R.accept(s); R.deliver(s);
  const second = R.currentOffer(s, rng);
  assert.ok(second && second.id !== first.id);
  R.accept(s); assert.equal(R.abandonTask(s), "request");
  assert.ok(R.currentOffer(s, rng), "a new offer immediately");
  assert.equal(R.REQUEST_GAP_TICKS, undefined, "no gap constant exists");
});

test("'Not now' keeps the same offer; abandon pays nothing and does not complete the request", () => {
  const s = R.newState(), rng = seeded(4);
  const a = R.currentOffer(s, rng), b = R.currentOffer(s, rng);
  assert.equal(a.id, b.id, "same offer next time");
  R.accept(s);
  const pts = s.points;
  R.abandonTask(s);
  assert.equal(s.points, pts); assert.equal(s.done[a.id], undefined); assert.equal(s.offer, null); assert.equal(s.task, null);
});

test("each request can be completed once ever: 12 deliveries use all 12 requests exactly once, then nothing is offered", () => {
  for (const seed of [1, 2, 3, 99]) {
    const s = R.newState(), rng = seeded(seed), seen = [];
    for (let i = 0; i < 12; i++) { const o = R.currentOffer(s, rng); assert.ok(o, `offer ${i}`); seen.push(o.id); R.accept(s); R.deliver(s); }
    assert.deepEqual([...seen].sort(), R.REQUESTS.map((r) => r.id).sort(), `seed ${seed}`);
    assert.equal(R.currentOffer(s, rng), undefined);
    assert.equal(R.requestsLeft(s), 0);
    assert.equal(R.accept(s), false);
  }
});

test("rotation: a round is a random permutation of the four professions (each once), with a seeded rng", () => {
  const s = R.newState(), rng = seeded(11), professions = [];
  for (let i = 0; i < 8; i++) { const o = R.currentOffer(s, rng); professions.push(o.profession); R.accept(s); R.deliver(s); }
  assert.deepEqual([...professions.slice(0, 4)].sort(), [...R.PROFESSIONS].sort(), "round 1 has every profession once");
  assert.deepEqual([...professions.slice(4, 8)].sort(), [...R.PROFESSIONS].sort(), "round 2 has every profession once");
  // same seed, same sequence
  const again = R.newState(), rng2 = seeded(11), ids = [], ids2 = [];
  const one = R.newState(), rng1 = seeded(11);
  for (let i = 0; i < 12; i++) { ids.push(R.currentOffer(one, rng1).id); R.accept(one); R.deliver(one); ids2.push(R.currentOffer(again, rng2).id); R.accept(again); R.deliver(again); }
  assert.deepEqual(ids, ids2);
  // different seeds do shuffle differently
  const orders = new Set();
  for (let seed = 1; seed <= 20; seed++) orders.add(R.shuffled(R.PROFESSIONS, seeded(seed)).join());
  assert.ok(orders.size > 3);
  // exhausted professions are skipped; the last remaining request still comes
  const t = R.newState();
  for (const r of R.REQUESTS) if (r.id !== "l_glass") t.done[r.id] = true;
  assert.equal(R.currentOffer(t, seeded(5)).id, "l_glass");
});

test("delivery: any-of log count (birch + cherry), all or nothing", () => {
  const logs = R.requestById("w_logs");
  const ok = R.deliveryPlan(logs, { "minecraft:birch_log": 20, "minecraft:cherry_log": 20, "minecraft:oak_log": 64 });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.take, [{ id: "minecraft:birch_log", count: 20 }, { id: "minecraft:cherry_log", count: 12 }]);
  const short = R.deliveryPlan(logs, { "minecraft:birch_log": 20, "minecraft:cherry_log": 11 });
  assert.equal(short.ok, false); assert.deepEqual(short.take, [], "nothing is taken when short");
  assert.equal(short.have, 31); assert.equal(short.need, 32);
  const flowers = R.requestById("h_flowers");
  assert.equal(R.deliveryPlan(flowers, { "lothlorien:elanor": 4 }).ok, false, "both entries are needed");
  assert.equal(R.deliveryPlan(flowers, { "lothlorien:elanor": 5, "lothlorien:niphredil": 4 }).ok, true);
  const coal = R.requestById("l_coal");
  assert.deepEqual(R.deliveryPlan(coal, { "minecraft:charcoal": 10, "minecraft:coal": 10 }).take, [{ id: "minecraft:coal", count: 10 }, { id: "minecraft:charcoal", count: 6 }]);
});

test("saplings: distinct cells only, vanished cells drop out, an unloaded chunk counts as fine", () => {
  const s = R.newState(); s.task = { kind: "request", id: "g_acorns", spots: [] };
  assert.equal(R.addSaplingSpot(s, "o|1,2,3"), true);
  assert.equal(R.addSaplingSpot(s, "o|1,2,3"), false, "the same cell twice");
  for (const c of ["o|2,2,3", "o|3,2,3", "o|4,2,3", "o|5,2,3"]) R.addSaplingSpot(s, c);
  assert.equal(R.saplingProgress(s, () => true), 5);
  assert.equal(R.saplingProgress(s, (c) => c !== "o|2,2,3"), 4, "a broken sapling no longer counts");
  assert.equal(R.addSaplingSpot(s, "o|2,2,3"), true, "replanting the cell counts again once");
  assert.equal(R.saplingProgress(s, (c) => (c === "o|5,2,3" ? undefined : true)), 5, "unloaded = fine");
  const other = R.newState(); other.task = { kind: "request", id: "g_dew", spots: [] };
  assert.equal(R.addSaplingSpot(other, "o|1,1,1"), false, "only for the sapling request");
  assert.equal(R.addSaplingSpot(R.newState(), "o|1,1,1"), false, "only while the request is active");
});

test("a sapling set outside the wood is announced only during the sapling request", () => {
  const s = R.newState(); s.task = { kind: "request", id: "g_acorns", spots: [] };
  assert.equal(R.saplingOutsideNotice(s, R.SAPLING_BLOCK, false), true);
  assert.equal(R.saplingOutsideNotice(s, R.SAPLING_BLOCK, true), false, "inside the wood it counts");
  assert.equal(R.saplingOutsideNotice(s, "minecraft:oak_sapling", false), false, "another block");
  const other = R.newState(); other.task = { kind: "request", id: "g_dew", spots: [] };
  assert.equal(R.saplingOutsideNotice(other, R.SAPLING_BLOCK, false), false, "another task");
  assert.equal(R.saplingOutsideNotice(R.newState(), R.SAPLING_BLOCK, false), false, "no task");
});

test("parse tolerates junk, other versions and unknown ids", () => {
  const fresh = R.newState();
  for (const junk of [undefined, "", "not json", "null", "[]", "42", '{"v":3,"points":99}', '{"points":99}']) assert.deepEqual(R.parse(junk), fresh, String(junk));
  const p = R.parse(JSON.stringify({ v: 2, points: "x", done: { dew: true, bogus: 1 }, task: { kind: "lesson", id: "elves" }, offer: "g_dew", queue: ["healer", "baker"] }));
  assert.equal(p.points, 0); assert.deepEqual(p.done, { dew: true }); assert.equal(p.task, null, "a lore lesson is no task");
  assert.equal(p.offer, "g_dew"); assert.deepEqual(p.queue, ["healer"]);
  assert.equal(R.parse(JSON.stringify({ v: 2, task: { kind: "lesson", id: "dew", ready: true, since: 9 } })).task.ready, true);
  assert.equal(R.parse(JSON.stringify({ v: 2, done: { dew: true }, task: { kind: "lesson", id: "dew" } })).task, null, "a done lesson is no task");
  assert.equal(R.parse(JSON.stringify({ v: 2, task: { kind: "request", id: "nope" } })).task, null);
  assert.equal(JSON.parse(R.serialize(R.newState())).v, 2);
});

test("migration v1 -> v2: points, done, offer and queue kept, the active request becomes the task, active lessons are dropped", () => {
  const v1 = { v: 1, points: 7, done: { harmony: true, elves: true, renown: true, dew: true, nectar: true, bogus: 1 }, active: { depth: 3 },
    request: { id: "g_acorns", spots: ["o|1,2,3", 5] }, offer: "h_athelas", queue: ["healer", "baker", "gardener"] };
  const p = R.parse(JSON.stringify(v1));
  assert.equal(p.v, 2); assert.equal(p.points, 7);
  assert.deepEqual(p.done, { harmony: true, elves: true, renown: true, dew: true, nectar: true });
  assert.deepEqual(p.task, { kind: "request", id: "g_acorns", spots: ["o|1,2,3"] });
  assert.equal(p.offer, null, "an offer is dropped when a request is the task");
  assert.deepEqual(p.queue, ["healer", "gardener"]);
  assert.equal("active" in p, false); assert.equal("request" in p, false);
  assert.equal(R.taskStatus(p, { saplings: 5 }), "ready");
  const q = R.parse(JSON.stringify({ v: 1, points: 2, done: {}, active: { dew: 1 }, request: null, offer: "g_dew", queue: [] }));
  assert.equal(q.task, null); assert.equal(q.offer, "g_dew");
  assert.deepEqual(R.parse(R.serialize(p)), p, "v2 round-trips");
});

test("every request item id exists (vanilla catalog or this mod's items/blocks)", () => {
  const catalog = new Set(text("../../../.claude/skills/bedrock-lookup/reference/current_catalog_ids.txt").split(/\r?\n/).map((l) => l.trim()));
  const ids = R.REQUESTS.flatMap((r) => (r.items ?? []).flatMap((e) => e.ids));
  assert.ok(ids.length >= 15);
  for (const id of ids) {
    if (id.startsWith("minecraft:")) assert.ok(catalog.has(id) || [...catalog].some((l) => l.split(/\s/).includes(id) || l.endsWith(id)), `${id} in the vanilla catalog`);
    else assert.ok(existsSync(new URL(`../lothlorien_bp/items/${id.split(":")[1]}.json`, import.meta.url)), `${id} has an item file`);
  }
  assert.equal(R.SAPLING_BLOCK, "lothlorien:mallorn_sapling"); assert.ok(existsSync(new URL("../lothlorien_bp/blocks/mallorn_sapling.json", import.meta.url)));
});

test("every translation key the dialog uses exists in the resource catalog", () => {
  const cat = JSON.parse(text("../localization/catalog.json"));
  const keys = new Set(Object.keys(cat.packs.lothlorien_rp.entries));
  const need = [
    ...R.LESSONS.flatMap((l) => [`lore.lesson.${l.id}.name`, `lore.lesson.${l.id}.text`]),
    ...R.REQUESTS.map((r) => `lore.req.${r.id}.text`),
    ...R.RANKS.map((r) => `lore.rank.${r}`),
    ...R.RANKS.slice(1).map((r) => `lore.rankup.${r}`),
    ...R.LESSONS.filter(R.isTaskLesson).map((l) => `lore.lesson.${l.id}.goal`),
    ...R.PROFESSIONS.map((p) => `lore.req.prof.${p}`),
    ...[1, 2, 3].map((n) => `lore.chapter.${n}`),
    ...R.PROFESSIONS.flatMap((p) => [`lore.who.${p}`, `lore.where.none.${p}`, `lore.status.bring.${p}`]),
    ...R.DIRECTIONS.map((d) => `lore.dir.${d}`),
    "lore.where.dir", "lore.where.near", "lore.btn.handover",
    ...["title", "greet.friend", "greet.guest", "greet.uneasy", "rank.line", "rank.next", "rank.max", "requests.locked", "requests.none", "requests.paused",
      "task.header", "status.active", "status.ready", "status.done", "ready.chat", "harmony.ready_chat", "btn.teaching", "teach.count", "teach.busy",
      "btn.take", "btn.continue", "btn.earlier", "btn.set_aside", "btn.request_new", "btn.farewell", "btn.understand", "btn.done", "btn.back", "btn.accept", "btn.notnow",
      "btn.keep", "remind.body", "result.renown", "result.learned", "too_far", "busy", "harmony.not_yet", "abandon.ask", "abandon.done", "lesson.task",
      "deliver.ok", "deliver.missing", "saplings.counted", "saplings.outside", "saplings.missing", "req.have", "done.lesson", "chapter.opened", "shunned", "debug.state"].map((k) => `lore.${k}`),
  ];
  for (const k of need) assert.ok(keys.has(`lothlorien.message.${k}`), `catalog has lothlorien.message.${k}`);
  assert.ok(keys.has("action.interact.lothlorien.speak"));
  assert.ok(keys.has("action.interact.lothlorien.hand_over"));
  // keys used in the scripts as literals also exist
  for (const f of ["loremaster.js", "renown_game.js"]) for (const m of text(`../lothlorien_bp/scripts/${f}`).matchAll(/\bt?\(?message\(\s*"(lore\.[\w.]+)"|\bt\(\s*"(lore\.[\w.]+)"/g)) assert.ok(keys.has(`lothlorien.message.${m[1] ?? m[2]}`), `${f}: ${m[1] ?? m[2]}`);
});

test("lesson texts are short (2-5 sentences) in English", () => {
  const cat = JSON.parse(text("../localization/catalog.json")).packs.lothlorien_rp.entries;
  for (const l of R.LESSONS) {
    const src = cat[`lothlorien.message.lore.lesson.${l.id}.text`].source;
    const sentences = src.split(/[.!?]+(?:\s|$)/).filter((x) => x.trim()).length;
    assert.ok(sentences >= 2 && sentences <= 5, `${l.id}: ${sentences} sentences`);
  }
});

test("goal lines: one sentence each, deed lesson texts end without the goal sentence", () => {
  const cat = JSON.parse(text("../localization/catalog.json")).packs.lothlorien_rp.entries;
  for (const l of R.LESSONS.filter(R.isTaskLesson)) {
    const goal = cat[`lothlorien.message.lore.lesson.${l.id}.goal`].source;
    const sentences = goal.split(/[.!?]+(?:\s|$)/).filter((x) => x.trim()).length;
    assert.equal(sentences, 1, `${l.id} goal: ${sentences} sentences`);
  }
  assert.equal(cat["lothlorien.message.lore.lesson.nectar.goal"].source, "Fill a glass bottle from a full bloom.");
  assert.ok(cat["lothlorien.message.lore.lesson.nectar.text"].source.includes("Fill a glass bottle from a full bloom, and the bloom begins to fill again."));
  assert.ok(cat["lothlorien.message.lore.lesson.dew.text"].source.includes("Fill a glass bottle from each dewy patch"));
});

test("script glue: the Loremaster form does not use header / label / divider (selection maps through actions[] of button() calls)", () => {
  const src = text("../lothlorien_bp/scripts/loremaster.js");
  assert.ok(!/\.(header|label|divider)\(/.test(src.replace(/\/\/.*$/gm, "")), "no non-button elements in the form");
  assert.ok(/MAX_DISTANCE = 12/.test(src));
});

// ---- Round 2: delivery to the traders ----
test("directionTo: 8 compass words (north is -Z, east is +X) and 'nearby' under 8 blocks", () => {
  const D = (dx, dz) => R.directionTo(dx, dz);
  assert.deepEqual(R.DIRECTIONS, ["north", "north_east", "east", "south_east", "south", "south_west", "west", "north_west"]);
  assert.equal(D(0, -20), "north");
  assert.equal(D(15, -15), "north_east");
  assert.equal(D(20, 0), "east");
  assert.equal(D(15, 15), "south_east");
  assert.equal(D(0, 20), "south");
  assert.equal(D(-15, 15), "south_west");
  assert.equal(D(-20, 0), "west");
  assert.equal(D(-15, -15), "north_west");
  assert.equal(D(5, -5), "nearby", "7.07 blocks");
  assert.equal(D(0, 0), "nearby");
  assert.equal(D(0, -8), "north", "8 blocks is no longer nearby");
  // sector edges: 22.5 degrees splits north from north-east (tan 22.5 = 0.414)
  assert.equal(D(8, -20), "north");
  assert.equal(D(10, -20), "north_east");
  assert.equal(D(-10, -20), "north_west");
});

test("nearestOf / deliveryPlace: the nearest elf of the profession within 96 blocks, else the Loremaster takes it", () => {
  const elves = [
    { profession: "gardener", x: 40, z: 0 }, { profession: "gardener", x: -10, z: -30 },
    { profession: "healer", x: 0, z: 50 }, { profession: "woodwright", x: 200, z: 0 },
  ];
  const from = { x: 0, z: 0 };
  assert.equal(R.nearestOf("gardener", elves, from), elves[1]);
  assert.equal(R.nearestOf("lamplighter", elves, from), undefined);
  assert.deepEqual(R.deliveryPlace("gardener", elves, from), { who: "trader", elf: elves[1], direction: "north" });
  assert.equal(R.deliveryPlace("healer", elves, from).direction, "south");
  assert.deepEqual(R.deliveryPlace("lamplighter", elves, from), { who: "loremaster" }, "no such elf: fallback");
  assert.deepEqual(R.deliveryPlace("woodwright", elves, from), { who: "loremaster" }, "too far away: fallback");
  assert.equal(R.deliveryPlace("woodwright", elves, from, 250).who, "trader");
  assert.equal(R.deliveryPlace("healer", [{ profession: "healer", x: 1, z: 2 }], from).direction, "nearby");
  assert.deepEqual(R.deliveryPlace("healer", [], from), { who: "loremaster" });
});

test("delivery tag: exactly the tag of the current request's profession, set / cleared with the state", () => {
  assert.deepEqual(R.DELIVER_TAGS, ["lothlorien_deliver_gardener", "lothlorien_deliver_healer", "lothlorien_deliver_woodwright", "lothlorien_deliver_lamplighter"]);
  const s = R.newState();
  assert.equal(R.requestProfession(s), null);
  assert.deepEqual(R.tagSync(s, []), { add: [], remove: [] });
  assert.deepEqual(R.tagSync(s, ["other", "lothlorien_deliver_healer"]), { add: [], remove: ["lothlorien_deliver_healer"] }, "no request: stale tag removed, others kept");
  s.offer = "h_nectar";
  assert.deepEqual(R.tagSync(s, []), { add: [], remove: [] }, "an offer is not a request");
  assert.equal(R.accept(s), true);
  assert.equal(R.requestProfession(s), "healer");
  assert.deepEqual(R.tagSync(s, []), { add: ["lothlorien_deliver_healer"], remove: [] });
  assert.deepEqual(R.tagSync(s, ["lothlorien_deliver_healer"]), { add: [], remove: [] }, "in step: nothing to do");
  assert.deepEqual(R.tagSync(s, ["lothlorien_deliver_gardener", "x"]), { add: ["lothlorien_deliver_healer"], remove: ["lothlorien_deliver_gardener"] });
  assert.equal(R.elfAccepts(s, "healer"), true);
  assert.equal(R.elfAccepts(s, "gardener"), false);
  assert.equal(R.elfAccepts(s, "loremaster"), false);
  R.deliver(s);
  assert.deepEqual(R.tagSync(s, ["lothlorien_deliver_healer"]), { add: [], remove: ["lothlorien_deliver_healer"] }, "delivered: tag cleared");
  // a lesson task is not a request
  const t = R.newState();
  R.takeLesson(t, "harmony", 1);
  assert.equal(R.requestProfession(t), null);
  assert.equal(R.elfAccepts(t, "gardener"), false);
  // abandon clears; a migrated v1 save with a request gets its tag
  const u = R.parse(JSON.stringify({ v: 1, points: 3, done: {}, request: { id: "w_iron", spots: [] } }));
  assert.deepEqual(R.tagSync(u, []).add, ["lothlorien_deliver_woodwright"]);
  R.abandonTask(u);
  assert.deepEqual(R.tagSync(u, ["lothlorien_deliver_woodwright"]).remove, ["lothlorien_deliver_woodwright"]);
});

test("elf entity: delivery prompts yield to native leads, names and leash cutting", () => {
  const elf = JSON.parse(text("../lothlorien_bp/entities/elf.json"))["minecraft:entity"].component_groups;
  for (const p of R.PROFESSIONS) {
    const entry = elf[`lothlorien:${p}`]["minecraft:interact"].interactions[0];
    const all = entry.on_interact.filters.all_of;
    assert.ok(all.some((f) => f.test === "has_tag" && f.subject === "other" && f.value === R.deliverTagOf(p)), `${p}: has_tag on the player`);
    assert.ok(all.some((f) => f.test === "is_family" && f.subject === "other" && f.value === "player"), `${p}: players only`);
    const exclusions = all.find((f) => f.none_of).none_of;
    const none = exclusions.filter((f) => !f.all_of).map((f) => f.value).sort();
    assert.deepEqual(none, ["lothlorien_trade_pass", "minecraft:lead", "minecraft:name_tag"], `${p}: lead and name tag keep working; trade pass skips delivery prompt`);
    assert.deepEqual(exclusions.find((f) => f.all_of), { all_of: [
      { test: "has_equipment", domain: "hand", subject: "other", value: "minecraft:shears" },
      { test: "is_leashed", subject: "self", value: true },
    ] }, `${p}: a native leash-cut use takes precedence`);
    assert.equal(entry.interact_text, "action.interact.lothlorien.hand_over");
    assert.equal(entry.use_item, false);
  }
});
