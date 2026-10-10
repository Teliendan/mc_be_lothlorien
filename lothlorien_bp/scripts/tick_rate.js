// `/scriptevent lothlorien:tps [seconds] [off]` (debug only): measures how many game ticks pass per real second.
// Runs only when called: one callback per tick for the window (default 10 s), then a chat report and a content-log line.
// `off` pauses the support checks (support_motion.js onTick) for the window; compare with a run without it.
// Rules and numbers: tick_rate_rules.js.
import { system } from "@minecraft/server";
import { message } from "./messages.js";
import { supportMotion, supportTickStats } from "./support_motion.js";
import { addTick, createTickClock, isDone, parseTpsArgs, summarizeTicks } from "./tick_rate_rules.js";

let running = false;

export function startTickRateProbe(player, text) {
  if (running) {
    player.sendMessage(message("tps.busy"));
    return;
  }
  running = true;
  const { seconds, pause } = parseTpsArgs(text);
  supportTickStats.paused = pause;
  player.sendMessage(message(pause ? "tps.started_off" : "tps.started", seconds));
  const clock = createTickClock(Date.now(), system.currentTick, supportTickStats.calls);
  const handle = system.runInterval(() => {
    const now = Date.now();
    addTick(clock, now);
    if (!isDone(clock, now, seconds)) return;
    system.clearRun(handle);
    supportTickStats.paused = false;
    running = false;
    const r = summarizeTicks(clock, now, system.currentTick, supportTickStats.calls);
    const records = supportMotion.size();
    console.warn(`[lothlorien] tps: ${r.ticks} ticks in ${r.seconds.toFixed(1)} s = ${r.tps.toFixed(1)} tps (${r.percent.toFixed(0)} %), `
      + `avg ${r.averageMs.toFixed(1)} ms, longest ${r.longestMs} ms, support onTick ${r.callsPerSecond.toFixed(0)}/s, `
      + `${records} support records${pause ? ", support checks paused" : ""}`);
    try {
      player.sendMessage(message("tps.result", r.ticks, r.seconds.toFixed(1), r.tps.toFixed(1), r.percent.toFixed(0)));
      player.sendMessage(message("tps.detail", r.averageMs.toFixed(1), r.longestMs, r.callsPerSecond.toFixed(0), records));
    } catch {
      // player left
    }
  }, 1);
}
