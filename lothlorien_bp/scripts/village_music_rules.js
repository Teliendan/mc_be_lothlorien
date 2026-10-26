// Village soundtrack rules (docs/SOUNDSCAPE_PLAN.md, owner 2026-10-25): inside a planned village a harp piece plays, then a quiet interval,
// then another piece; never two scores at once. Pure state machine, driven by village_music.js every CHECK_TICKS; tested in tests/village_music.mjs.
//
// Playback per player: play(piece) replaces whatever music runs (vanilla biome music included) and queues REST_ID, a short silent track looped,
// so the music channel stays busy through the interval and the vanilla forest score cannot start in between. The next piece replaces the rest.
// Leaving: only after LEAVE_TICKS outside, so briefly crossing the edge neither stops nor restarts a piece; the "stop" fades into one unlooped rest.
// `fade` is the overlap with the track being replaced (/music semantics). Queue clearing and biome-music return need the game (SOUNDSCAPE_PLAN.md).

export const CHECK_TICKS = 40;
export const LEAVE_TICKS = 200;
export const REST_ID = "music.lothlorien.village_rest";
export const REST_TICKS = [10 * 20, 30 * 20]; // quiet interval after a piece, uniform (owner: 1-3 min too long 2026-10-26, 20-60 s still long 2026-10-27)
export const FADE_IN = 3, FADE_OUT = 5, VOLUME = 1;

// The pool: sound event and length of each encoded piece (tools/prepare_soundscape.py prints the lengths).
export const PIECES = [
  { id: "music.lothlorien.village.1", ticks: 1720 },
  { id: "music.lothlorien.village.2", ticks: 2104 },
  { id: "music.lothlorien.village.3", ticks: 1861 },
  { id: "music.lothlorien.village.4", ticks: 1902 },
  { id: "music.lothlorien.village.5", ticks: 1612 },
  { id: "music.lothlorien.village.6", ticks: 1873 },
];

// state: { phase: "out" | "playing", last, nextAt, outsideSince } | undefined. -> { state, actions: [{ type: "play", id } | { type: "stop" }] }
export function step(state, inside, tick, random = Math.random, pieces = PIECES) {
  const s = state ?? { phase: "out", last: undefined, nextAt: 0, outsideSince: undefined };
  if (!inside) {
    if (s.phase === "out") return { state: s, actions: [] };
    const since = s.outsideSince ?? tick;
    if (tick - since < LEAVE_TICKS) return { state: { ...s, outsideSince: since }, actions: [] };
    return { state: { ...s, phase: "out", outsideSince: undefined }, actions: [{ type: "stop" }] };
  }
  if (!pieces.length || (s.phase === "playing" && tick < s.nextAt)) return { state: { ...s, outsideSince: undefined }, actions: [] };
  const piece = pick(pieces, s.last, random);
  const rest = REST_TICKS[0] + Math.floor(random() * (REST_TICKS[1] - REST_TICKS[0] + 1));
  return {
    state: { phase: "playing", last: piece.id, nextAt: tick + piece.ticks + rest, outsideSince: undefined },
    actions: [{ type: "play", id: piece.id }],
  };
}

// a random piece, never the one that just played (when there is a choice)
export function pick(pieces, last, random = Math.random) {
  const pool = pieces.length > 1 ? pieces.filter((p) => p.id !== last) : pieces;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
