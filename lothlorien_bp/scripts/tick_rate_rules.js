// Tick-rate measurement for `/scriptevent lothlorien:tps [seconds] [off]` (debug only; game glue in tick_rate.js).
// Pure (no @minecraft/server) so tests/run.mjs checks it offline. Every game clock of the mod (the Harmony timer, mob
// sessions, crops, the day) runs on game ticks: at 10 ticks per second they all run at half the speed of real time.

export const NORMAL_TPS = 20;
export const DEFAULT_SECONDS = 10;
export const MAX_SECONDS = 60;

// Argument text -> { seconds, pause }. `off` pauses the support checks of plants and lamps during the window, so two
// runs (with and without `off`) show what those checks cost.
export function parseTpsArgs(text) {
  const parts = String(text ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  let seconds = DEFAULT_SECONDS;
  let pause = false;
  for (const p of parts) {
    if (p === "off") pause = true;
    else {
      const n = Number.parseFloat(p);
      if (Number.isFinite(n) && n > 0) seconds = Math.min(n, MAX_SECONDS);
    }
  }
  return { seconds, pause };
}

// Start of a window: real time (ms, Date.now()) and the game tick (system.currentTick).
export function createTickClock(startMs, startTick, calls = 0) {
  return { startMs, startTick, startCalls: calls, lastMs: startMs, longestMs: 0, gaps: [] };
}

// One callback per game tick: remembers the longest real gap between two of them (one slow tick shows up here).
export function addTick(clock, nowMs) {
  const gap = nowMs - clock.lastMs;
  clock.gaps.push(gap);
  if (gap > clock.longestMs) clock.longestMs = gap;
  clock.lastMs = nowMs;
}

export const isDone = (clock, nowMs, seconds) => nowMs - clock.startMs >= seconds * 1000;

// Result of a window: game ticks per real second, game speed in percent of real time, average and longest tick in ms,
// and support-check callbacks per real second (`calls` = the running callback counter at the end).
export function summarizeTicks(clock, endMs, endTick, calls = 0) {
  const ms = Math.max(1, endMs - clock.startMs);
  const ticks = Math.max(0, endTick - clock.startTick);
  const seconds = ms / 1000;
  const tps = ticks / seconds;
  const sorted = [...clock.gaps].sort((a,b) => a-b);
  const percentile = q => sorted.length ? sorted[Math.ceil(sorted.length*q)-1] : 0;
  return {
    ticks,
    seconds,
    tps,
    percent: (tps / NORMAL_TPS) * 100,
    averageMs: ticks > 0 ? ms / ticks : ms,
    longestMs: clock.longestMs,
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    over100Ms: sorted.filter(ms => ms > 100).length,
    callsPerSecond: Math.max(0, calls - clock.startCalls) / seconds,
  };
}
