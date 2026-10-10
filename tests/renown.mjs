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
// reads and finishes every lesson of the open chapter the way the game does (give it, then complete it); returns the finish results
function doChapter(s) {
  const out = [];
  for (const l of R.availableLessons(s)) {
    R.activate(s, l.id, 1);
    if (l.kind === "lore") out.push(R.completeLore(s, l.id));
    else if (l.kind === "harmony") out.push(R.completeHarmony(s, 5));
    else out.push(...R.noteDeed(s, l.deed));
  }
  return out;
}
const finishRequest = (s, rng) => { R.currentOffer(s, rng); R.accept(s); return R.deliver(s); };

test("thresholds 3 / 8 / 15 with their edges", () => {
  assert.deepEqual(R.THRESHOLDS, [0, 3, 8, 15]);
  for (const [pts, rank] of [[0, "stranger"], [2, "stranger"], [3, "welcome"], [7, "welcome"], [8, "trusted"], [14, "trusted"], [15, "elf_friend"], [99, "elf_friend"]]) assert.equal(R.rankOf(pts), rank, `${pts}`);
  assert.deepEqual(R.nextRank(14), { next: "elf_friend", needed: 1 });
  assert.equal(R.nextRank(15), undefined);
});

test("points: deed lesson 1, lore lesson 0, request 2, tale 1", () => {
  assert.deepEqual(R.POINTS, { deed_lesson: 1, lore_lesson: 0, request: 2, tale: 1 });
  assert.equal(R.REQUESTS.length, 12);
});

test("chapters: only the open chapter is available; the next one opens when every lesson of this one is complete", () => {
  const s = R.newState();
  assert.deepEqual(OPEN(s), ["harmony", "elves", "renown", "dew", "nectar"]);
  assert.equal(R.openChapter(s), 1);
  R.activate(s, "elves", 1); R.completeLore(s, "elves");
  assert.deepEqual(OPEN(s), ["harmony", "renown", "dew", "nectar"], "a finished lesson leaves the list");
  assert.equal(R.activate(s, "depth", 1), false, "a lesson of a later chapter cannot be given");
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
  assert.equal(s.points, 9, "chapter III deeds pay 1 (the gifts lesson); tales are optional");
  assert.equal(R.openChapter(s), 4, "the teaching is complete");
  for (let i = 0; i < 3; i++) finishRequest(s, rng);
  assert.equal(s.points, 15); assert.equal(R.rankOf(s.points), "elf_friend");
  for (let i = 0; i < 8; i++) finishRequest(s, rng);
  assert.equal(R.requestsLeft(s), 0);
  assert.equal(s.points, 31, "points keep counting after the last rank (15 + 8 requests x 2)");
});

test("a deed counts only while its lesson is active; deeds done before the lesson was given are lost", () => {
  const s = R.newState();
  assert.deepEqual(R.noteDeed(s, "dew"), [], "no lesson given yet");
  assert.equal(s.points, 0);
  R.activate(s, "dew", 5);
  assert.equal(R.noteDeed(s, "dew").length, 1);
  assert.equal(s.points, 1); assert.equal(s.done.dew, true);
  assert.deepEqual(R.noteDeed(s, "dew"), [], "pays once, ever");
  assert.deepEqual(R.noteDeed(s, "lembas"), [], "a lesson of a later chapter is never active");
  assert.equal(s.points, 1);
});

test("the Harmony lesson needs the lesson given and Harmony >= +3 at the moment", () => {
  const s = R.newState();
  assert.equal(R.completeHarmony(s, 10), undefined, "not given yet");
  R.activate(s, "harmony", 1);
  assert.equal(R.completeHarmony(s, 2), undefined);
  assert.equal(R.completeHarmony(s, -5), undefined);
  assert.equal(R.completeHarmony(s, 3).points, 1);
  assert.equal(R.completeHarmony(s, 10), undefined, "once");
});

test("rank-up result is reported on the point that crosses a threshold", () => {
  const s = R.newState(); R.activate(s, "dew", 1); R.activate(s, "nectar", 1); R.activate(s, "harmony", 1);
  R.noteDeed(s, "dew"); R.noteDeed(s, "nectar");
  const r = R.completeHarmony(s, 3);
  assert.deepEqual(r.rank, { before: "stranger", after: "welcome", rankedUp: true });
});

test("tales (white deer, unicorn) count once, +1 each, only after the lesson white_animals was read", () => {
  const s = R.newState();
  assert.deepEqual(R.noteDeed(s, "white_deer"), [], "chapter not even reached");
  s.done.white_animals = true;
  const r = R.noteDeed(s, "white_deer");
  assert.equal(r.length, 1); assert.equal(r[0].points, 1); assert.equal(s.points, 1);
  assert.deepEqual(R.noteDeed(s, "white_deer"), []);
  assert.equal(R.noteDeed(s, "unicorn").length, 1); assert.equal(s.points, 2);
});

test("gating by band: friend and guest full; uneasy only the Harmony lesson; shunned and hated nothing", () => {
  const s = R.newState();
  for (const band of ["friend", "guest"]) { const m = R.menuFor(band, s); assert.equal(m.mode, "full"); assert.equal(m.renown, true); assert.equal(m.requests, false, "chapters I and II not complete yet"); assert.deepEqual(m.lessons, OPEN(s)); }
  assert.deepEqual(R.menuFor("uneasy", s), { mode: "uneasy", lessons: ["harmony"], remind: [], requests: false, renown: false });
  assert.equal(R.menuFor("shunned", s).mode, "shunned"); assert.deepEqual(R.menuFor("shunned", s).lessons, []);
  assert.equal(R.menuFor("hated", s).mode, "hated");
  doChapter(s); doChapter(s);
  assert.equal(R.menuFor("guest", s).requests, true);
  assert.equal(R.menuFor("uneasy", s).requests, false, "no requests while uneasy");
  assert.ok(R.menuFor("guest", s).remind.includes("dew"), "finished lessons stay readable under Remind me");
});

test("an active request survives a drop to Uneasy (kept, paused) and the state round-trips", () => {
  const s = R.newState(); doChapter(s); doChapter(s);
  R.currentOffer(s, seeded(1)); R.accept(s);
  const id = s.request.id;
  R.menuFor("uneasy", s);
  const back = R.parse(R.serialize(s));
  assert.equal(back.request.id, id);
  assert.deepEqual(back, s);
});

test("no cooldown: the next request is offered right after delivery and right after abandoning", () => {
  const s = R.newState(), rng = seeded(3);
  const first = R.currentOffer(s, rng); R.accept(s); R.deliver(s);
  const second = R.currentOffer(s, rng);
  assert.ok(second && second.id !== first.id);
  R.accept(s); assert.equal(R.abandon(s), true);
  assert.ok(R.currentOffer(s, rng), "a new offer immediately");
  assert.equal(R.REQUEST_GAP_TICKS, undefined, "no gap constant exists");
});

test("'Not now' keeps the same offer; abandon pays nothing and does not complete the request", () => {
  const s = R.newState(), rng = seeded(4);
  const a = R.currentOffer(s, rng), b = R.currentOffer(s, rng);
  assert.equal(a.id, b.id, "same offer next time");
  R.accept(s);
  const pts = s.points;
  R.abandon(s);
  assert.equal(s.points, pts); assert.equal(s.done[a.id], undefined); assert.equal(s.offer, null); assert.equal(s.request, null);
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
  assert.equal(R.deliveryPlan(flowers, { "lothlorien:elanor": 2 }).ok, false, "both entries are needed");
  assert.equal(R.deliveryPlan(flowers, { "lothlorien:elanor": 5, "lothlorien:niphredil": 2 }).ok, true);
  const coal = R.requestById("l_coal");
  assert.deepEqual(R.deliveryPlan(coal, { "minecraft:charcoal": 10, "minecraft:coal": 10 }).take, [{ id: "minecraft:coal", count: 10 }, { id: "minecraft:charcoal", count: 6 }]);
});

test("saplings: distinct cells only, vanished cells drop out, an unloaded chunk counts as fine", () => {
  const s = R.newState(); s.request = { id: "g_acorns", spots: [] };
  assert.equal(R.addSaplingSpot(s, "o|1,2,3"), true);
  assert.equal(R.addSaplingSpot(s, "o|1,2,3"), false, "the same cell twice");
  for (const c of ["o|2,2,3", "o|3,2,3", "o|4,2,3", "o|5,2,3"]) R.addSaplingSpot(s, c);
  assert.equal(R.saplingProgress(s, () => true), 5);
  assert.equal(R.saplingProgress(s, (c) => c !== "o|2,2,3"), 4, "a broken sapling no longer counts");
  assert.equal(R.addSaplingSpot(s, "o|2,2,3"), true, "replanting the cell counts again once");
  assert.equal(R.saplingProgress(s, (c) => (c === "o|5,2,3" ? undefined : true)), 5, "unloaded = fine");
  const other = R.newState(); other.request = { id: "g_dew", spots: [] };
  assert.equal(R.addSaplingSpot(other, "o|1,1,1"), false, "only for the sapling request");
  assert.equal(R.addSaplingSpot(R.newState(), "o|1,1,1"), false, "only while the request is active");
});

test("parse tolerates junk, other versions and unknown ids", () => {
  const fresh = R.newState();
  for (const junk of [undefined, "", "not json", "null", "[]", "42", '{"v":2,"points":99}', '{"points":99}']) assert.deepEqual(R.parse(junk), fresh, String(junk));
  const p = R.parse(JSON.stringify({ v: 1, points: "x", done: { dew: true, bogus: 1 }, active: { nectar: 7, nope: 1 }, request: { id: "nope" }, offer: "g_dew", queue: ["healer", "baker"] }));
  assert.equal(p.points, 0); assert.deepEqual(p.done, { dew: true }); assert.deepEqual(p.active, { nectar: 7 });
  assert.equal(p.request, null); assert.equal(p.offer, "g_dew"); assert.deepEqual(p.queue, ["healer"]);
  assert.equal(JSON.parse(R.serialize(R.newState())).v, 1);
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
    ...["title", "greet.friend", "greet.guest", "greet.uneasy", "rank.line", "rank.next", "rank.max", "requests.locked", "requests.none", "requests.paused",
      "btn.lesson", "btn.remind", "btn.request_new", "btn.request_active", "btn.farewell", "btn.understand", "btn.done", "btn.back", "btn.accept", "btn.notnow",
      "btn.deliver", "btn.abandon", "btn.abandon_yes", "btn.keep", "remind.body", "harmony.not_yet", "abandon.ask", "abandon.done", "deliver.ok", "deliver.missing",
      "saplings.counted", "saplings.missing", "req.have", "done.lesson", "chapter.opened", "tale", "shunned", "debug.state"].map((k) => `lore.${k}`),
  ];
  for (const k of need) assert.ok(keys.has(`lothlorien.message.${k}`), `catalog has lothlorien.message.${k}`);
  assert.ok(keys.has("action.interact.lothlorien.speak"));
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
