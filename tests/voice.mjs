// Sindarin voice: pool choice, restraint rules, pack bindings, shipped assets and hook placement; run independently or via tests/run.mjs.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test, finish, readJson } from "./test_helpers.mjs";
import * as V from "../lothlorien_bp/scripts/voice_rules.js";
import { ANGRY_EVENT, WARDEN_ID } from "../lothlorien_bp/scripts/elven_warden_rules.js";

const lines = readJson("../tools/audio/sindarin_voice/final/lines.json").lines;
const defs = readJson("../lothlorien_rp/sounds/sound_definitions.json").sound_definitions;
const src = (name) => readFileSync(new URL(`../lothlorien_bp/scripts/${name}`, import.meta.url), "utf8");
const at = (x = 0) => ({ x, y: 70, z: 0 });
const ask = (s, pool, now, o = {}) => V.admit(s, { pool, speakerId: o.speaker ?? "e1", listenerId: o.listener, now,
  dimensionId: o.dim ?? "minecraft:overworld", location: o.location ?? at() });

test("voice: Harmony picks the opening", () => {
  assert.deepEqual(["hated", "shunned", "uneasy", "guest", "friend", undefined].map(V.openingPool),
    [null, "refuse_speak", "opening_neutral", "opening_neutral", "opening_warm", null]);
});

test("voice: one neutral sound event per pool, every text equally likely, files shipped byte for byte", () => {
  for (const pool of V.POOLS) {
    const def = defs[V.soundIdOf(pool)];
    assert.ok(def, pool);
    assert.equal(def.category, "neutral");
    const members = lines.filter((l) => l.pools.includes(pool));
    assert.deepEqual(def.sounds.map((s) => s.name), members.map((l) => `sounds/voice/lothlorien/${l.file}`));
    const perText = {};
    def.sounds.forEach((s, i) => { perText[members[i].sindarin] = (perText[members[i].sindarin] ?? 0) + s.weight; });
    assert.equal(new Set(Object.values(perText)).size, 1, `${pool}: ${JSON.stringify(perText)}`);
  }
  assert.equal(Object.keys(defs).filter((k) => k.startsWith("lothlorien.voice.")).length, V.POOLS.length);
  const dir = new URL("../lothlorien_rp/sounds/voice/lothlorien/", import.meta.url);
  assert.deepEqual(readdirSync(dir).sort(), lines.map((l) => `${l.file}.ogg`).sort());
  for (const l of lines) {
    const shipped = readFileSync(new URL(`${l.file}.ogg`, dir));
    assert.ok(shipped.equals(readFileSync(new URL(`../tools/audio/sindarin_voice/final/${l.file}.ogg`, import.meta.url))), l.file);
  }
});

test("voice: native haggle.yes on the elf plays trade_positive at natural pitch; script never plays it", () => {
  const elf = readJson("../lothlorien_rp/sounds.json").entity_sounds.entities["lothlorien:elf"];
  assert.equal(elf.events["haggle.yes"].sound, V.soundIdOf("trade_positive"));
  assert.equal(elf.events["haggle.yes"].pitch, 1.0);
  assert.equal(elf.events.haggle, undefined);
  assert.equal(elf.events["haggle.no"], undefined);
  assert.equal(ask(V.newVoiceState(), "trade_positive", 0), false);
});

test("voice: 4 s per elf, 30 s per greeting pair, commits skip the wait but never layer", () => {
  const s = V.newVoiceState();
  assert.ok(ask(s, "opening_neutral", 0, { listener: "p1" }));
  assert.ok(!ask(s, "explain", 10), "ordinary line waits 4 s");
  assert.ok(!ask(s, "completion", V.LINE_TICKS - 1), "a commit never starts over a playing line");
  assert.ok(ask(s, "completion", V.LINE_TICKS), "a commit skips the 4 s wait");
  assert.ok(!ask(s, "explain", V.LINE_TICKS + V.ELF_GAP_TICKS - 1), "lower-priority speech after a commit is dropped");
  assert.ok(ask(s, "explain", V.LINE_TICKS + V.ELF_GAP_TICKS));
  assert.ok(ask(s, "task_taken", 2 * V.LINE_TICKS + V.ELF_GAP_TICKS), "taking a task right after the lesson speaks");
  assert.ok(!ask(s, "opening_warm", 300, { listener: "p1" }), "no repeat greeting to the same player within 30 s");
  assert.ok(ask(s, "opening_neutral", 300, { listener: "p2" }), "another player is greeted");
  assert.ok(ask(s, "refuse_speak", 380, { speaker: "e2", listener: "p1" }), "another elf");
  assert.ok(!ask(s, "refuse_speak", 480, { speaker: "e2", listener: "p1" }), "refusals repeat at most every 30 s");
  assert.ok(ask(s, "opening_neutral", V.GREETING_GAP_TICKS, { listener: "p1" }));
});

test("voice: combat 15 s per warden, one shout per fight within 16 blocks and 3 s", () => {
  const s = V.newVoiceState();
  assert.ok(ask(s, "combat_start", 0, { speaker: "w1" }));
  assert.ok(!ask(s, "combat_start", 10, { speaker: "w2", location: at(V.GROUP_COMBAT_RADIUS) }), "broadcast-anger neighbour stays quiet");
  assert.ok(ask(s, "combat_start", 10, { speaker: "w3", location: at(V.GROUP_COMBAT_RADIUS + 1) }), "a separate fight");
  assert.ok(ask(s, "combat_start", 10, { speaker: "w4", dim: "minecraft:nether" }));
  assert.ok(ask(s, "combat_start", 70, { speaker: "w2", location: at(V.GROUP_COMBAT_RADIUS) }), "after 3 s");
  assert.ok(!ask(s, "combat_start", V.COMBAT_GAP_TICKS - 1, { speaker: "w1" }), "re-targeting within 15 s");
  assert.ok(ask(s, "combat_start", V.COMBAT_GAP_TICKS, { speaker: "w1" }));
});

test("voice: healing at most every 30 s per healer", () => {
  const s = V.newVoiceState();
  assert.ok(ask(s, "healing", 0, { speaker: "h" }));
  assert.ok(!ask(s, "healing", V.HEALING_GAP_TICKS - 1, { speaker: "h" }));
  assert.ok(ask(s, "healing", V.HEALING_GAP_TICKS, { speaker: "h" }));
});

test("voice: cooldown maps stay small without a timer", () => {
  const s = V.newVoiceState();
  for (let i = 0; i < 200; i++) ask(s, "opening_neutral", i, { speaker: `e${i}`, listener: "p" });
  assert.ok(ask(s, "opening_neutral", V.PRUNE_TICKS + 200, { speaker: "x", listener: "p" }));
  assert.equal(s.elves.size, 1);
  assert.equal(s.greetings.size, 1);
});

test("voice: hooks sit at the accepted actions, no timers", () => {
  assert.ok(src("trade.js").includes("if (!passValid) system.run(() => greet(target, player, band));"));
  assert.ok(src("trade.js").includes("greet(target, player, band); // a refusal"));
  const lore = src("loremaster.js");
  assert.ok(lore.includes("greetOnce(player, elf);"));
  assert.equal((lore.match(/speak\(ctx\.elf, "explain", player\)/g) ?? []).length, 2);
  assert.equal((lore.match(/speak\(ctx\.elf, "task_taken", player\)/g) ?? []).length, 2);
  assert.ok(lore.includes('speak(ctx.elf, "completion", player)'));
  assert.equal((src("renown_game.js").match(/celebrate\(player, \[result\], at\);\s*speak\(at, "completion", player\)/g) ?? []).length, 2);
  assert.ok(src("healer.js").includes('speak(healer, "healing")'));
  assert.ok(/dataDrivenEntityTrigger\.subscribe\([\s\S]*entityTypes: \[WARDEN_ID\], eventTypes: \[ANGRY_EVENT\]/.test(src("elven_warden.js")));
  const warden = readJson("../lothlorien_bp/entities/elven_warden.json")["minecraft:entity"];
  assert.equal(warden.components["minecraft:on_target_acquired"].event, ANGRY_EVENT);
  assert.ok(warden.events[ANGRY_EVENT]);
  const healer = src("healer.js");
  assert.ok(healer.includes("blessedOther = true") && healer.includes("patient.id !== healer.id"));
  assert.ok(healer.includes('if (blessedOther) speak(healer, "healing")'));
  const wardenJs = src("elven_warden.js");
  const greeting = wardenJs.match(/beforeEvents\.playerInteractWithEntity\.subscribe\([\s\S]*?\n  \}\);/)?.[0] ?? "";
  assert.ok(greeting.includes("target.typeId !== WARDEN_ID") && greeting.includes("nativeElfUse(target, itemStack)") && greeting.includes("fighting(player)"));
  assert.ok(greeting.includes("system.run(() => greet(target, player, band))") && !greeting.includes("cancel"), "the click is never cancelled");
  assert.ok(wardenJs.includes("player.hasTag(FOE_TAG)") && wardenJs.includes("isNewFight(Date.now() - at)"));
  assert.ok(src("main.js").includes("startElvenWardens(depthAt, (player) => bandOf(harmonyOf(player).harmony))"));
  assert.ok(!/runInterval|runTimeout/.test(src("voice.js")) && !/@minecraft/.test(src("voice_rules.js")));
});

finish();
