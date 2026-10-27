// Sindarin voice: which pool, and whether an elf may speak now (pure; voice.js plays it). Design: docs/SINDARIN_VOICE_EVENTS.md.
// One line per accepted interaction, no queue: a line that may not play now is dropped. Cooldowns are tuning values, in game ticks.
export const POOLS = ["opening_neutral", "opening_warm", "trade_positive", "explain", "task_taken", "completion", "refuse_speak", "combat_start", "healing", "thanks", "thanks_warm"];
export const soundIdOf = (pool) => `lothlorien.voice.${pool}`;
const SCRIPT_POOLS = new Set(POOLS.filter((p) => p !== "trade_positive")); // trade_positive is native haggle.yes (sounds.json)
// Commits (a taken task, an accepted completion, a combat start) skip the ordinary wait but never start over a playing line.
export const COMMIT_POOLS = new Set(["task_taken", "completion", "combat_start"]);
export const GREETING_POOLS = new Set(["opening_neutral", "opening_warm", "refuse_speak"]); // the refusal replaces the greeting
export const ELF_GAP_TICKS = 80; // 4 s between ordinary lines of one elf
export const LINE_TICKS = 32; // longest clip 1.53 s
export const GREETING_GAP_TICKS = 600; // 30 s: repeat greeting by the same elf to the same player
export const COMBAT_GAP_TICKS = 300; // 15 s per warden (re-targeting)
export const GROUP_COMBAT_TICKS = 60; // one shout per fight: broadcast anger makes neighbours acquire targets too
export const GROUP_COMBAT_RADIUS = 16;
export const HEALING_GAP_TICKS = 600; // 30 s per healer (sustained injuries)
export const THANKS_GAP_TICKS = 200; // 10 s per warden (a stream of kills)
export const PRUNE_TICKS = 1200;
export const PRUNE_SIZE = 64;
export const VOICE_HEIGHT = 1.6; // mouth height above the feet
const MENU = 0.7; // menu chatter quieter than world speech
export const VOLUME = {
  opening_neutral: MENU, opening_warm: MENU, trade_positive: MENU, explain: MENU, task_taken: MENU,
  completion: MENU, refuse_speak: MENU, healing: 0.8, combat_start: 1.0, thanks: 0.8, thanks_warm: 0.8,
};

// Harmony band -> opening pool: Hated silence, Shunned a curt refusal, Friend warm, Guest/Uneasy neutral.
export function openingPool(band) {
  if (band === "shunned") return "refuse_speak";
  if (band === "friend") return "opening_warm";
  if (band === "guest" || band === "uneasy") return "opening_neutral";
  return null;
}

// Harmony band -> thanks pool of a warden whose quarry a player killed: Hated silence, Friend "Annon allen, mellon".
export function thanksPool(band) {
  if (band === "friend") return "thanks_warm";
  return band === "hated" ? null : "thanks";
}
const THANKS_POOLS = new Set(["thanks", "thanks_warm"]);

export const newVoiceState = () => ({ elves: new Map(), greetings: new Map(), shouts: [], prunedAt: 0 });

const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= GROUP_COMBAT_RADIUS;

// Old entries go when the maps grow, at most once per PRUNE_TICKS: no timer.
function prune(state, now) {
  if (now - state.prunedAt < PRUNE_TICKS || state.elves.size + state.greetings.size <= PRUNE_SIZE) return;
  state.prunedAt = now;
  for (const [id, e] of state.elves) if (now - e.at >= HEALING_GAP_TICKS) state.elves.delete(id); // the longest per-elf gap (thanks is shorter)
  for (const [key, at] of state.greetings) if (now - at >= GREETING_GAP_TICKS) state.greetings.delete(key);
}

// True (and recorded) when `speakerId` may say a line of `pool` now; listenerId = the player spoken to, if any.
export function admit(state, { pool, speakerId, listenerId, now, dimensionId, location }) {
  if (!SCRIPT_POOLS.has(pool) || speakerId === undefined) return false;
  const elf = state.elves.get(speakerId);
  if (elf && now - elf.at < (COMMIT_POOLS.has(pool) ? LINE_TICKS : ELF_GAP_TICKS)) return false;
  const pair = GREETING_POOLS.has(pool) && listenerId !== undefined ? `${speakerId}|${listenerId}` : undefined;
  if (pair !== undefined && state.greetings.has(pair) && now - state.greetings.get(pair) < GREETING_GAP_TICKS) return false;
  if (pool === "healing" && elf?.healAt !== undefined && now - elf.healAt < HEALING_GAP_TICKS) return false;
  if (THANKS_POOLS.has(pool) && elf?.thanksAt !== undefined && now - elf.thanksAt < THANKS_GAP_TICKS) return false;
  if (pool === "combat_start") {
    if (elf?.combatAt !== undefined && now - elf.combatAt < COMBAT_GAP_TICKS) return false;
    state.shouts = state.shouts.filter((s) => now - s.at < GROUP_COMBAT_TICKS);
    if (state.shouts.some((s) => s.dimensionId === dimensionId && near(s.location, location))) return false;
    state.shouts.push({ dimensionId, location: { x: location.x, y: location.y, z: location.z }, at: now });
  }
  state.elves.set(speakerId, {
    at: now,
    healAt: pool === "healing" ? now : elf?.healAt,
    combatAt: pool === "combat_start" ? now : elf?.combatAt,
    thanksAt: THANKS_POOLS.has(pool) ? now : elf?.thanksAt,
  });
  if (pair !== undefined) state.greetings.set(pair, now);
  prune(state, now);
  return true;
}
