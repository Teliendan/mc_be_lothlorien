// Load the DIAG pack against the mock server; fire startup + worldLoad, run timers, fake a 3 s freeze inside a leaf break.
// Usage: node tools/diag/load_test.mjs <out dir holding lothlorien_bp>   (prints "ASSERTS OK" on success, exit code 1 otherwise)
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./mock/hooks.mjs", import.meta.url); // "@minecraft/server" -> ./mock/server.mjs (the module imported below)
const { subs, intervals, timeouts, chat, system, world, Dimension, StructureManager, Player } = await import("./mock/server.mjs");
const outDir = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) { console.error("usage: node load_test.mjs <out dir>"); process.exit(2); }
const errors = [], warns = [];
console.error = (m) => errors.push(String(m)); console.warn = (m) => warns.push(String(m));
await import(pathToFileURL(path.join(outDir, "lothlorien_bp/scripts/main.js")).href);
const comps = {};
const reg = { registerCustomComponent: (n, c) => { comps[n] = c; } };
for (const cb of subs["system.before.startup"] ?? []) cb({ blockComponentRegistry: reg, itemComponentRegistry: reg, customCommandRegistry: { registerCommand() {}, registerEnum() {} } });
const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
for (const cb of subs["after.worldLoad"] ?? []) cb({});
// 0.8.4: mocked time of day, one player near 38 entities, spawn/remove events, real dew flips (dewy cover outside the dew window)
let tod = 12000;
world.getTimeOfDay = () => tod;
const fakePlayers = () => [{ name: "T", location: { x: 1, y: 64, z: 2 }, dimension: { getBiome: () => ({ id: "minecraft:forest" }), getEntities: () => Array.from({ length: 38 }, () => ({ typeId: "x" })) } }];
const dewBlock = { typeId: "lothlorien:leaf_litter", location: { x: 0, y: 64, z: 0 }, setPermutation() {}, permutation: { getState: () => true, withState: () => ({}) } };
for (let i = 0; i < 3; i++) comps["lothlorien:dew_cover"].onRandomTick({ block: dewBlock, dimension: {} });
for (let i = 0; i < 4; i++) for (const cb of subs["after.entitySpawn"] ?? []) cb({ entity: { typeId: i < 3 ? "minecraft:bee" : "lothlorien:firefly" } });
for (const cb of subs["before.entityRemove"] ?? []) cb({ removedEntity: {} });
const tick = () => { system.currentTick++; clock += 50; for (const [fn, n] of intervals) if (system.currentTick % n === 0) { try { fn(); } catch (e) { errors.push("interval: " + e); } } };
for (let i = 0; i < 5; i++) tick();
// a leaf break whose decay bookkeeping "takes" 3 s: must be timed and named as the slowest call
const leaf = comps["lothlorien:leaves"];
let touched = false;
const dim = new Proxy({}, { get: (t, k) => { touched = true; if (k === "id") { clock += 3000; return "minecraft:overworld"; } return undefined; } });
try { leaf.onBreak({ block: { location: { x: 0, y: 64, z: 0 } }, dimension: dim }); } catch (e) { errors.push("onBreak: " + e); }
tick(); tick();
// script freeze: a crop random tick that "takes" 3 s
const slow = new Proxy({}, { get: () => { clock += 3000; throw new Error("x"); } });
try { comps["lothlorien:crop"].onRandomTick({ block: slow, dimension: slow }); } catch {}
tick(); tick(); tick();
// engine freeze: 2.5 s with no script work
clock += 2500; tick(); tick(); tick();
tod = 23450;
for (let i = 0; i < 1300; i++) tick();
// native call timing (0.8.10): the FIRST getBiome of an interval "takes" 135 ms (the world-load warm-up the owner saw twice); a later structure placement 40 ms
let biomeSlow = true; const natDim = new Dimension();
globalThis.__nativeCost = (n) => { if (n === "Dimension.getBiome" && biomeSlow) { biomeSlow = false; clock += 135; } else if (n === "StructureManager.place") clock += 40; };
const interval = intervals.length; intervals.push([() => natDim.getBiome(), 20]);
for (let i = 0; i < 20; i++) tick();
new StructureManager().place(); tick(); tick();
intervals.length = interval;
// 0.8.12 callback accounting + getters: a Harmony-like interval (registered through the wrapped system, as the pack files do) reads player.location / dimension /
// onScreenDisplay (wrapped getters). Its FIRST call takes 130 ms of plain script (no slow native); its 2nd call 60 ms inside the Entity.location getter.
// Both are logged at once with their native counts, and the 130 ms gap names "41+ native calls inside".
const { __diagSystem } = await import(pathToFileURL(path.join(outDir, "lothlorien_bp/scripts/diag_wrap.js")).href);
const player = new Player(); let harmonyCalls = 0;
const harmonyCost = globalThis.__nativeCost;
globalThis.__nativeCost = (n) => { harmonyCost?.(n); if (n === "Entity.location" && harmonyCalls === 2) clock += 60; };
const itvBefore = intervals.length;
__diagSystem("harmony_probe.js").runInterval(() => {
  harmonyCalls++;
  for (let i = 0; i < 40; i++) player.hasTag("x");
  player.location; player.dimension.heightRange; player.onScreenDisplay.setActionBar("t");
  if (harmonyCalls === 1) clock += 130;
}, 20);
for (let i = 0; i < 60; i++) tick();
intervals.length = itvBefore;
// 20 more gaps of 200 ms: only 5 immediate lines (plus the earlier ones), all counted in the next summary
for (let i = 0; i < 20; i++) { clock += 200; tick(); }
world.getPlayers = fakePlayers;
clock += 60000; tick(); tick();
Date.now = realNow;
console.log("components:", Object.keys(comps).length, "intervals:", intervals.length, "leaf touched block:", touched);
console.log("errors:\n " + errors.join("\n "));
console.log("warns:\n " + warns.slice(0, +(process.env.WARNS ?? 4)).join("\n "));
console.log("chat:", chat);
const sums = chat.filter((c) => /\] min \d+:/.test(c));
console.log("summary lines:", sums.length); console.log("first:", sums[0]); console.log("last:", sums.at(-1));
const bad = [];
if (!sums.length) bad.push("no summary");
if (!/dew 3;/.test(sums[0] ?? "")) bad.push("dew counter != 3");
if (!/spawned 4, removed 1; ents -; time 23450/.test(sums[0] ?? "") || !/ents 38; time 23450/.test(sums.at(-1) ?? "")) bad.push("spawn/removed/ents/time");
if (!/gaps >=150: [1-9]/.test(sums.at(-1) ?? "")) bad.push("last summary has no gaps");
if (chat.filter((c) => /\] (gap|freeze) /.test(c)).length > 5 * sums.length + 0) bad.push("too many immediate lines");
const gapNative = chat.filter((c) => /slowest native: Dimension\.getBiome 135 ms/.test(c));
if (!gapNative.length) bad.push("no chat line names the slowest native getBiome 135 ms");
if (!warns.some((w) => /gap \d+ ms.*slowest native Dimension\.getBiome 135 ms/.test(w))) bad.push("gap log line lacks 'slowest native Dimension.getBiome 135 ms'");
if (!warns.some((w) => /slow native call Dimension\.getBiome 135 ms \(call #1 of this method.*FIRST call/.test(w))) bad.push("no immediate log of the slow first getBiome");
if (!warns.some((w) => /slow native call StructureManager\.place 40 ms/.test(w))) bad.push("no immediate log of the slow structure placement");
if (!/Natives: slowest (Dimension\.getBiome 135|StructureManager\.place 40) ms; .*Dimension\.getBiome 135ms\/\d+x \(max 135\)/.test(warns.find((w) => /summary min/.test(w) && /Natives: slowest Dimension/.test(w)) ?? "")) bad.push("summary lacks the Natives list");
if (!warns.some((w) => /slow callback harmony_probe.js runInterval\(20\) 130 ms \(its FIRST call\): 4\d native calls inside took 0 ms, so 130 ms were plain script/.test(w))) bad.push("no immediate log of the slow first harmony callback with its native count");
if (!warns.some((w) => /slow callback harmony_probe.js runInterval\(20\) 6\d ms: 4\d native calls inside took 60 ms, so \d ms were plain/.test(w))) bad.push("slow getter call not counted inside its callback");
if (!warns.some((w) => /Entity\.location\(get\) 60ms\/\d+x \(max 60\)/.test(w))) bad.push("getter Entity.location is missing from the Natives list");
if (!warns.some((w) => /Lothlorien scripts in it: \d+ ms in \d+ calls; slowest single call harmony_probe.js runInterval\(20\) 130 ms \(4\d natives 0 ms inside it\)/.test(w))) bad.push("gap line lacks the native count of the slowest call");
console.log(bad.length ? "FAIL: " + bad.join("; ") : "ASSERTS OK")
if (bad.length) process.exitCode = 1;
