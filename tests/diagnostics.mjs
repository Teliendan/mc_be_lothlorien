// diagnostics regression tests; run independently or via tests/run.mjs.
import { test, finish, catalogEntries } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as TR from "../lothlorien_bp/scripts/tick_rate_rules.js";
import * as SS from "../lothlorien_bp/scripts/speed_stats.js";



test("tick rate: half speed reads as 10 tps / 50 percent, the longest gap is kept, support callbacks per second", () => {
  const c = TR.createTickClock(1000, 500, 40);
  let t = 1000;
  for (let i = 1; i <= 100; i++) TR.addTick(c, (t += i === 50 ? 400 : 100));
  assert.equal(c.longestMs, 400, "one slow tick shows as the longest gap");
  assert.ok(!TR.isDone(c, 10999, 10) && TR.isDone(c, 11000, 10));
  const r = TR.summarizeTicks(c, 11000, 600, 40 + 25000);
  assert.equal(r.ticks, 100); assert.equal(r.seconds, 10); assert.equal(r.tps, 10); assert.equal(r.percent, 50);
  assert.equal(r.averageMs, 100, "a tick takes 100 ms instead of 50"); assert.equal(r.callsPerSecond, 2500);
  const n = TR.summarizeTicks(TR.createTickClock(0, 0), 10000, 200);
  assert.equal(n.tps, TR.NORMAL_TPS); assert.equal(n.percent, 100); assert.equal(n.averageMs, 50); assert.equal(n.callsPerSecond, 0);
});

test("tick rate: arguments - seconds (default 10, max 60) and `off` in any order; junk falls back", () => {
  assert.deepEqual(TR.parseTpsArgs(""), { seconds: 10, pause: false });
  assert.deepEqual(TR.parseTpsArgs(undefined), { seconds: 10, pause: false });
  assert.deepEqual(TR.parseTpsArgs("20"), { seconds: 20, pause: false });
  assert.deepEqual(TR.parseTpsArgs("off 15"), { seconds: 15, pause: true });
  assert.deepEqual(TR.parseTpsArgs("15 OFF"), { seconds: 15, pause: true });
  assert.deepEqual(TR.parseTpsArgs("999"), { seconds: TR.MAX_SECONDS, pause: false });
  assert.deepEqual(TR.parseTpsArgs("-3 x"), { seconds: 10, pause: false });
});

test("tick rate: the debug event is wired, its chat keys are RP catalog entries, random support checks are counted and pausable", () => {
  const main = readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8");
  assert.ok(main.includes('event.id === "lothlorien:tps"') && main.includes("startTickRateProbe(player, event.message)"));
  const glue = readFileSync(new URL("../lothlorien_bp/scripts/tick_rate.js", import.meta.url), "utf8");
  const entries = catalogEntries();
  for (const key of ["tps.started", "tps.started_off", "tps.busy", "tps.result", "tps.detail"]) {
    assert.ok(glue.includes(`"${key}"`), key);
    assert.ok(entries[`lothlorien.message.${key}`], key);
  }
  assert.ok(/supportTickStats\.paused = false;[\s\S]*summarizeTicks/.test(glue), "the pause ends with the window");
  const sm = readFileSync(new URL("../lothlorien_bp/scripts/support_motion.js", import.meta.url), "utf8");
  assert.ok(/onRandomTick\(\{ block \}\) \{\s*supportTickStats\.calls\+\+;\s*if \(!supportTickStats\.paused\) supportMotion\.observe\(block\);/.test(sm));
});

test("speed probe: speed is distance over elapsed ticks per entity, in blocks per second", () => {
  const st = SS.createStats();
  assert.equal(SS.addSample(st, { key: "a", type: "t", x: 0, z: 0, tick: 0 }), undefined, "first sample has no speed");
  assert.ok(Math.abs(SS.addSample(st, { key: "a", type: "t", x: 3, z: 4, tick: 20 }) - 5) < 1e-9, "5 blocks in 1 s");
  assert.ok(Math.abs(SS.addSample(st, { key: "a", type: "t", x: 3, z: 5, tick: 25 }) - 4) < 1e-9, "1 block in 5 ticks");
  assert.equal(SS.addSample(st, { key: "b", type: "t", x: 100, z: 100, tick: 25 }), undefined, "other entity starts its own series");
});

test("speed probe: summary has count, min/avg/max, moving share and splits flagged samples", () => {
  const st = SS.createStats();
  const walk = (key, type, speeds, flags = []) => {
    let x = 0;
    SS.addSample(st, { key, type, x, z: 0, tick: 0 });
    speeds.forEach((bps, i) => { x += bps / 4; SS.addSample(st, { key, type, x, z: 0, tick: (i + 1) * 5, flag: !!flags[i] }); });
  };
  walk("w1", "minecraft:skeleton", [0, 2, 4, 2]);
  walk("w2", "minecraft:skeleton", [0, 0, 0, 0]);
  walk("g1", "lothlorien:elven_warden", [1, 1, 3, 3], [false, false, true, true]);
  const rows = SS.summarize(st);
  assert.deepEqual(rows.map((r) => r.type), ["lothlorien:elven_warden", "minecraft:skeleton"], "sorted by type id");
  const sk = rows[1];
  assert.equal(sk.count, 2);
  assert.equal(sk.samples, 8);
  assert.ok(Math.abs(sk.min) < 1e-9 && Math.abs(sk.max - 4) < 1e-9 && Math.abs(sk.avg - 1) < 1e-9);
  assert.ok(Math.abs(sk.moving - 3 / 8) < 1e-9, "3 of 8 samples above the moving threshold");
  const gu = rows[0];
  assert.equal(gu.calm.samples, 2);
  assert.equal(gu.flagged.samples, 2);
  assert.ok(Math.abs(gu.calm.avg - 1) < 1e-9 && Math.abs(gu.flagged.avg - 3) < 1e-9);
  assert.equal(SS.summarize(SS.createStats()).length, 0);
});

test("speed probe: teleports are dropped and counted, formatting helpers", () => {
  const st = SS.createStats();
  SS.addSample(st, { key: "a", type: "t", x: 0, z: 0, tick: 0 });
  assert.equal(SS.addSample(st, { key: "a", type: "t", x: 500, z: 0, tick: 5 }), undefined);
  const [row] = SS.summarize(st);
  assert.equal(row.dropped, 1);
  assert.equal(row.samples, 0);
  assert.equal(SS.fmt1(1.005 * 2), "2.01");
  assert.equal(SS.percent(0.375), "38");
});

test("speed probe: scriptevent is wired and its messages are localized", () => {
  const main = readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8");
  assert.ok(main.includes('"lothlorien:speed"') && main.includes("startSpeedProbe"));
  const probe = readFileSync(new URL("../lothlorien_bp/scripts/speed_probe.js", import.meta.url), "utf8");
  const keys = [...probe.matchAll(/message\("(speed\.[a-z]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 5);
  const entries = catalogEntries();
  for (const k of new Set(keys)) assert.ok(entries[`lothlorien.message.${k}`], `catalog entry for ${k}`);
});

test("dash detector: arguments, block text, median", () => {
  assert.equal(SS.parseDashArgs("32"), undefined);
  assert.equal(SS.parseDashArgs(""), undefined);
  assert.deepEqual(SS.parseDashArgs("dash"), { radius: 16, seconds: 20 });
  assert.deepEqual(SS.parseDashArgs("dash 8 5"), { radius: 8, seconds: 5 });
  assert.deepEqual(SS.parseDashArgs("DASH 999 9999"), { radius: 64, seconds: 120 });
  assert.deepEqual(SS.parseDashArgs("dash x -1"), { radius: 16, seconds: 20 });
  assert.equal(SS.fmtBlock("minecraft:air", {}), "air");
  assert.equal(SS.fmtBlock(undefined), "unloaded");
  assert.equal(SS.fmtBlock("lothlorien:mallorn_slab", { "minecraft:vertical_half": "top", color: "x" }), "lothlorien:mallorn_slab[vertical_half=top]");
  assert.equal(SS.median([3, 1, 2]), 2);
  assert.equal(SS.median([4, 1, 2, 3]), 2.5);
  assert.equal(SS.median([]), 0);
});

test("dash detector: one spike per burst, relative and absolute thresholds, since-last", () => {
  const tr = SS.createDashTracker();
  const ctxFn = ({ bps }) => ({ vy: 0, onGround: true, falling: false, water: false, below: "b", frontFeet: "air", frontHead: "air", seen: bps });
  let x = 0;
  const run = (key, type, tick, bps) => { x += bps / 10; return SS.addDashSample(tr, { key, type, x, y: 64, z: 0, tick, ctxFn }); };
  // walks at 2 b/s (0.2 per 2 ticks), bursts at 6.2 b/s for 2 samples at ticks 40-42, again at 100
  let tick = 0; run("warden-aaaa1234", "w", tick, 0);
  const plan = [];
  for (let i = 1; i <= 60; i++) plan.push(i >= 20 && i <= 21 ? 6.2 : i === 50 ? 6.2 : 2);
  for (const bps of plan) { tick += 2; run("warden-aaaa1234", "w", tick, bps); }
  const spikes = SS.findSpikes(tr);
  assert.equal(spikes.length, 2, JSON.stringify(spikes.map((s) => s.start)));
  assert.equal(spikes[0].samples, 2);
  assert.equal(spikes[0].sinceLast, null);
  assert.equal(spikes[1].sinceLast, spikes[1].start - spikes[0].start);
  assert.ok(Math.abs(spikes[0].median - 2) < 1e-9);
  const line = SS.formatSpikeLine(spikes[0]);
  assert.ok(line.includes("w#1234") && line.includes("speed=6.20b/s") && line.includes("ground=1") && line.includes("front_head=air") && line.includes("since=-"), line);
  assert.ok(SS.formatSpikeLine(spikes[1]).includes(`since=${spikes[1].sinceLast}t`));
  const rows = SS.summarizeSpikes(tr, spikes);
  assert.deepEqual(rows.map((r) => [r.type, r.mobs, r.spikes]), [["w", 1, 2]]);
  assert.ok(Math.abs(rows[0].peak - 6.2) < 1e-9);
});

test("dash detector: steady runner is no spike; slow mob needs only the ratio; absolute limit without history", () => {
  const steady = SS.createDashTracker();
  let x = 0;
  SS.addDashSample(steady, { key: "r", type: "t", x, y: 0, z: 0, tick: 0 });
  for (let i = 1; i <= 40; i++) SS.addDashSample(steady, { key: "r", type: "t", x: (x += 0.5), y: 0, z: 0, tick: i * 2 }); // 5 b/s
  assert.equal(SS.findSpikes(steady).length, 0, "constant 5 b/s is its own median");
  const slow = SS.createDashTracker();
  let sx = 0;
  SS.addDashSample(slow, { key: "s", type: "t", x: sx, y: 0, z: 0, tick: 0 });
  for (let i = 1; i <= 30; i++) SS.addDashSample(slow, { key: "s", type: "t", x: (sx += i === 15 ? 0.2 : 0.06), y: 0, z: 0, tick: i * 2 });
  const sp = SS.findSpikes(slow);
  assert.equal(sp.length, 1, "2 b/s against a 0.6 b/s median");
  assert.ok(sp[0].peak.bps < SS.DASH_ABS_BPS);
  const fresh = SS.createDashTracker();
  SS.addDashSample(fresh, { key: "f", type: "t", x: 0, y: 0, z: 0, tick: 0 });
  SS.addDashSample(fresh, { key: "f", type: "t", x: 0.7, y: 0, z: 0, tick: 2 });
  assert.equal(SS.findSpikes(fresh).length, 1, "7 b/s with no history exceeds the absolute limit");
  assert.equal(SS.addDashSample(fresh, { key: "f", type: "t", x: 99, y: 0, z: 0, tick: 4 }), undefined, "teleports are dropped");
});

test("dash detector: scriptevent dispatch and messages are localized", () => {
  const probe = readFileSync(new URL("../lothlorien_bp/scripts/speed_probe.js", import.meta.url), "utf8");
  assert.ok(probe.includes("parseDashArgs") && probe.includes("console.warn(formatSpikeLine"));
  const keys = [...probe.matchAll(/message\("(dash\.[a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)].sort(), ["dash.none", "dash.row", "dash.started"]);
  const entries = catalogEntries();
  for (const k of new Set(keys)) assert.ok(entries[`lothlorien.message.${k}`], `catalog entry for ${k}`);
});

finish();
