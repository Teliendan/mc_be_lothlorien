// Load the DIAG pack against the mock server; fire startup + worldLoad, run timers, fake a 3 s freeze inside a leaf break.
// Usage: node tools/diag/load_test.mjs <out dir holding lothlorien_bp>   (prints "ASSERTS OK" on success, exit code 1 otherwise)
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./mock/hooks.mjs", import.meta.url); // "@minecraft/server" -> ./mock/server.mjs (the module imported below)
const { subs, intervals, timeouts, chat, system, world } = await import("./mock/server.mjs");
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
// 20 more gaps of 200 ms: only 5 immediate lines (plus the earlier ones), all counted in the next summary
for (let i = 0; i < 20; i++) { clock += 200; tick(); }
world.getPlayers = fakePlayers;
clock += 60000; tick(); tick();
Date.now = realNow;
console.log("components:", Object.keys(comps).length, "intervals:", intervals.length, "leaf touched block:", touched);
console.log("errors:\n " + errors.join("\n "));
console.log("warns:\n " + warns.slice(0, 4).join("\n "));
console.log("chat:", chat);
const sums = chat.filter((c) => /\] min \d+:/.test(c));
console.log("summary lines:", sums.length); console.log("first:", sums[0]); console.log("last:", sums.at(-1));
const bad = [];
if (!sums.length) bad.push("no summary");
if (!/dew 3;/.test(sums[0] ?? "")) bad.push("dew counter != 3");
if (!/spawned 4, removed 1; ents -; time 23450/.test(sums[0] ?? "") || !/ents 38; time 23450/.test(sums.at(-1) ?? "")) bad.push("spawn/removed/ents/time");
if (!/gaps >=150: [1-9]/.test(sums.at(-1) ?? "")) bad.push("last summary has no gaps");
if (chat.filter((c) => /\] (gap|freeze) /.test(c)).length > 5 * sums.length + 0) bad.push("too many immediate lines");
console.log(bad.length ? "FAIL: " + bad.join("; ") : "ASSERTS OK")
if (bad.length) process.exitCode = 1;
