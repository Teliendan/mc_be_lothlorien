// harmony regression tests; run independently or via tests/run.mjs.
import { test, finish, catalogEntries } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "../lothlorien_bp/scripts/harmony.js";
import * as R from "../lothlorien_bp/scripts/deer_rules.js";
import * as W from "../lothlorien_bp/scripts/white_deer_rules.js";
import * as EW from "../lothlorien_bp/scripts/elven_warden_rules.js";

const hs = (harmony, timer = 0) => ({ harmony, timer });
const afterPenalty = (h, p) => { const s = hs(h); H.applyPenalty(s, p); return s.harmony; };

test("harmony: band table incl. every edge, wariness and boundary constants", () => {
  const band = (h) => H.bandOf(h);
  assert.deepEqual([10, 9, 0, -1, -14, -15, -29, -30, -60].map(band),
    ["friend", "guest", "guest", "uneasy", "uneasy", "shunned", "shunned", "hated", "hated"]);
  assert.deepEqual([H.FRIEND_FROM, H.GUEST_FROM, H.UNEASY_FROM, H.SHUNNED_FROM, H.MIN_HARMONY, H.MAX_HARMONY], [10, 0, -14, -29, -60, 10]);
  assert.deepEqual(H.BANDS, ["hated", "shunned", "uneasy", "guest", "friend"]);
  assert.ok(H.isFriend(hs(10)) && !H.isFriend(hs(9)) && H.isHated(hs(-30)) && !H.isHated(hs(-29)));
});

test("harmony: recovery is +1 per 60 s inside up to 10, +1 per 120 s outside and never above 0", () => {
  const a = hs(0); H.tick(a, true, 59); assert.equal(a.harmony, 0); H.tick(a, true, 1); assert.equal(a.harmony, 1);
  H.tick(a, true, 100000); assert.equal(a.harmony, 10, "capped at +10");
  const b = hs(-5); H.tick(b, false, 119); assert.equal(b.harmony, -5); H.tick(b, false, 1); assert.equal(b.harmony, -4);
  H.tick(b, false, 10000); assert.equal(b.harmony, 0, "outside stops at 0");
  const c = hs(6); H.tick(c, false, 10000); assert.equal(c.harmony, 6, "positive harmony is kept outside, not raised");
  const d = hs(-3); H.tick(d, true, 60); assert.equal(d.harmony, -2, "inside recovers from below zero too");
  const e = hs(10, 40); H.tick(e, true, 1); assert.equal(e.timer, 0, "no credit piles up at the cap");
});

test("harmony: a deed restarts the minute timer", () => {
  const s = hs(0); H.tick(s, true, 50); H.recordDeed(s, "animal"); assert.equal(s.harmony, -3); assert.equal(s.timer, 0);
  H.tick(s, true, 59); assert.equal(s.harmony, -3); H.tick(s, true, 1); assert.equal(s.harmony, -2);
});

test("harmony: above 0 a penalty point costs 2, from 0 down 1 (point by point)", () => {
  assert.equal(afterPenalty(4, 3), -1, "2, 0, -1");
  assert.equal(afterPenalty(5, 3), -1, "3, 1, -1");
  assert.equal(afterPenalty(1, 1), -1);
  assert.equal(afterPenalty(10, 1), 8);
  assert.equal(afterPenalty(10, 3), 4);
  assert.equal(afterPenalty(0, 3), -3, "at 0 and below one point costs one");
  assert.equal(afterPenalty(-10, 3), -13);
  assert.ok(!H.isFriend(hs(8)), "any deed loses Friend");
});

test("harmony: floor at -60", () => {
  assert.equal(afterPenalty(-58, 10), -60);
  const s = hs(-60); H.recordDeed(s, "unicorn"); assert.equal(s.harmony, -60);
});

test("harmony: every deed cost", () => {
  assert.deepEqual(H.DEED_COSTS, { animal: 3, monster: 1, white_deer: 6, unicorn: 10, warden_fight: 1, warden_kill: 6, elf_fight: 1, elf_kill: 6, player: 3 });
  for (const [kind, cost] of Object.entries(H.DEED_COSTS)) { const s = hs(0); H.recordDeed(s, kind); assert.equal(s.harmony, -cost, kind); }
  const s = hs(10); H.recordDeed(s, "monster"); assert.equal(s.harmony, 8);
  const u = hs(10); H.recordDeed(u, "unicorn"); assert.equal(u.harmony, -5, "8, 6, 4, 2, 0, then five at 1 each");
  const n = hs(3, 7); H.recordDeed(n, "nonsense"); assert.deepEqual(n, hs(3, 7), "unknown deed kinds count nothing");
});

test("harmony: victims are classified into deed kinds (inanimate counts nothing, wardens and players are their own kinds)", () => {
  const k = H.deedKindOf;
  assert.equal(k("minecraft:armor_stand", ["inanimate", "mob"]), undefined);
  assert.equal(k("lothlorien:deer", ["mob"]), "animal");
  assert.equal(k("minecraft:cow", ["cow", "animal", "mob"]), "animal");
  assert.equal(k("minecraft:villager_v2", ["villager"]), "animal");
  assert.equal(k("minecraft:zombie", ["zombie", "monster", "mob"]), "monster");
  assert.equal(k(W.WHITE_DEER_ID, ["mob"]), "white_deer");
  assert.equal(k("lothlorien:unicorn"), "unicorn");
  assert.equal(k(EW.WARDEN_ID, ["lothlorien_warden", "irongolem", "mob"]), "warden_kill");
  assert.equal(k("minecraft:player", ["player"]), "player");
  assert.equal(k("minecraft:cow"), "animal");
  assert.equal(k("lothlorien:elf", ["lothlorien_elf", "mob"]), "elf_kill", "a civilian elf is its own kind (was a plain animal, 3)");
  assert.equal(k("lothlorien:elf_post", ["lothlorien_elf_post", "elf_post_home", "inanimate"]), undefined, "a post counts nothing");
});

test("harmony: deedCounts - elf and warden deeds count anywhere, every other kind only inside the forest, no kind never", () => {
  for (const kind of ["warden_fight", "warden_kill", "elf_fight", "elf_kill"]) { assert.equal(H.deedCounts(kind, false), true, kind); assert.equal(H.deedCounts(kind, true), true, kind); }
  for (const kind of ["animal", "monster", "white_deer", "unicorn", "player"]) { assert.equal(H.deedCounts(kind, false), false, `${kind} outside`); assert.equal(H.deedCounts(kind, true), true, `${kind} inside`); }
  assert.equal(H.deedCounts(undefined, true), false); assert.equal(H.deedCounts(undefined, false), false);
  assert.deepEqual([...H.EVERYWHERE_DEEDS].sort(), ["elf_fight", "elf_kill", "warden_fight", "warden_kill"]);
});

test("harmony: death changes nothing, except inside the forest while Hated (-> -29)", () => {
  const cases = [[-30, true, -29], [-60, true, -29], [-30, false, -30], [-29, true, -29], [-20, true, -20], [-20, false, -20], [5, true, 5], [10, true, 10]];
  for (const [h, inside, want] of cases) { const s = hs(h, 33); H.recordDeath(s, inside); assert.equal(s.harmony, want, `${h} inside=${inside}`); }
  assert.equal(H.bandOf(H.HATED_DEATH_HARMONY), "shunned");
});

test("harmony: chat lines per band change and direction; Friend gained / lost; the deed hint is rate limited", () => {
  const m = H.changeMessages;
  assert.deepEqual(m(9, 10), ["friend.gained"]);
  assert.deepEqual(m(10, 8), ["friend.lost"]);
  assert.deepEqual(m(10, -5), ["friend.lost", "harmony.worse.uneasy"]);
  assert.deepEqual(m(5, -2), ["harmony.worse.uneasy"]);
  assert.deepEqual(m(-10, -16), ["harmony.worse.shunned"]);
  assert.deepEqual(m(-20, -31), ["harmony.worse.hated"]);
  assert.deepEqual(m(-30, -29), ["harmony.better.shunned"]);
  assert.deepEqual(m(-15, -14), ["harmony.better.uneasy"]);
  assert.deepEqual(m(-1, 0), ["harmony.better.guest"]);
  assert.deepEqual(m(3, 2), [], "same band: no band line");
  const entries = catalogEntries();
  for (const key of ["harmony.worse.uneasy", "harmony.worse.shunned", "harmony.worse.hated", "harmony.better.shunned", "harmony.better.uneasy", "harmony.better.guest", "harmony.hint", "harmony.debug", "friend.gained", "friend.lost"]) {
    assert.ok(entries[`lothlorien.message.${key}`], key);
  }
  assert.ok(!Object.keys(entries).some((k) => k.includes("disharmony")), "the Disharmony keys are retired");
  assert.ok(H.hintDue(undefined, 5) && !H.hintDue(1000, 1000 + H.HINT_GAP_MS - 1) && H.hintDue(1000, 1000 + H.HINT_GAP_MS));
  assert.equal(H.HINT_GAP_MS, 30000);
});

test("harmony: the action bar shows the band name inside the forest only; saved state round-trips; junk is tolerated", () => {
  const entries = catalogEntries();
  for (const [h, band] of [[10, "friend"], [0, "guest"], [-5, "uneasy"], [-20, "shunned"], [-40, "hated"]]) {
    assert.deepEqual(H.statusText(hs(h), true), { rawtext: [{ text: H.BAND_ICONS[band] }, { translate: `lothlorien.message.status.${band}` }] }, band);
    assert.equal(H.statusText(hs(h), false), undefined);
    assert.ok(entries[`lothlorien.message.status.${band}`], band);
  }
  const glyphs = Object.values(H.BAND_ICONS).map((i) => i.trim());
  assert.deepEqual(glyphs, ["\uE500", "\uE501", "\uE502", "\uE503", "\uE504"], "one glyph per band, U+E500...U+E504 in band order");
  assert.equal(new Set(glyphs).size, 5);
  const png = readFileSync(new URL("../lothlorien_rp/font/glyph_E5.png", import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [256, 256], "glyph page: 16x16 cells of 16 px");
  const s = hs(-7, 12.5);
  assert.deepEqual(H.parse(H.serialize(s)), s);
  assert.deepEqual(H.parse(undefined), H.newState()); assert.deepEqual(H.parse("{oops"), H.newState());
  assert.deepEqual(H.parse('{"harmony":"x","timer":-4}'), H.newState());
  assert.deepEqual(H.parse('{"harmony":500,"timer":3}'), hs(10, 3), "clamped");
  assert.deepEqual(H.parse('{"harmony":-500}'), hs(-60, 0));
  assert.deepEqual(H.parse('{"points":3,"calm":9,"friend":2}'), H.newState(), "the old Disharmony format is ignored");
});

test("harmony: the game wiring - deeds need player or victim inside, only a player killer, saves only on change, hated tag, debug event", () => {
  const game = readFileSync(new URL("../lothlorien_bp/scripts/harmony_game.js", import.meta.url), "utf8");
  assert.ok(game.includes('"lothlorien:harmony"') && !game.includes("isharmony"));
  assert.ok(/isInside\(player\.dimension, player\.location\) \|\| isInside\(victim\.dimension, victim\.location\)/.test(game), "player OR victim inside");
  assert.ok(game.includes("damageSource.damagingEntity") && game.includes("deedKindOf(deadEntity.typeId"));
  assert.ok(/if \(state\.harmony === before\) return false;[\s\S]*setDynamicProperty\(PROPERTY/.test(game), "save only when harmony changed");
  assert.ok(game.includes("HATED_TAG") && game.includes("addTag") && game.includes("removeTag"));
  assert.ok(game.includes("handleHarmonyEvent"));
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes("startHarmony(inBiome, DEBUG_TAG)"));
});

test("harmony: a white deer kill costs 6 (two animals), a unicorn 10, a warden 6 on top of 1 per fight", () => {
  const cost = (kind) => { const x = hs(0); H.recordDeed(x, kind); return -x.harmony; };
  assert.equal(cost(H.deedKindOf(W.WHITE_DEER_ID)), 6);
  assert.equal(cost(H.deedKindOf(R.DEER_ID)), 3);
  assert.equal(cost("white_deer"), 2 * cost("animal"));
  assert.equal(H.bandOf(-cost("white_deer")), "uneasy");
  assert.equal(cost(H.deedKindOf(EW.WARDEN_ID)) + cost("warden_fight"), 7);
  assert.equal(cost(H.deedKindOf("lothlorien:elf")) + cost("elf_fight"), 7, "an elf is charged like a warden: 1 per fight + 6 per kill");
});

test("harmony: the timer is a game-tick clock - one second per 20 game ticks (at 10 tps it runs at half real speed)", () => {
  const game = readFileSync(new URL("../lothlorien_bp/scripts/harmony_game.js", import.meta.url), "utf8");
  assert.ok(game.includes("const TICK_SECONDS = 1;") && game.includes("tick(state, here, TICK_SECONDS)") && game.includes("}, TICK_SECONDS * 20);"));
  const s = H.newState(); s.harmony = -5;
  for (let i = 0; i < 59; i++) H.tick(s, true, 1);
  assert.deepEqual([s.harmony, s.timer], [-5, 59]);
  H.tick(s, true, 1);
  assert.deepEqual([s.harmony, s.timer], [-4, 0], "60 runs of the 20-tick interval = +1");
});

finish();
