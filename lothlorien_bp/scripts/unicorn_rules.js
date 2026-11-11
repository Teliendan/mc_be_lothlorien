// Unicorn rules (Phase 15). Pure (no @minecraft/server) so tests/run.mjs can check them offline; unicorn.js wires them to
// the game.
//
// Taming is a bond earned in three offers: a Friend of Lothlorien offers Elanor (the flower) to a unicorn three times,
// at least OFFER_GAP_TICKS apart. The third offer bonds it to that player: it can then be ridden by them, without a saddle.

export const UNICORN_ID = "lothlorien:unicorn";
export const ELANOR_ID = "lothlorien:elanor";
export const TRUST_OFFERS = 3; // offers until the bond
export const OFFER_GAP_TICKS = 200; // 10 s between two offers: the unicorn takes its time. The pause itself is the native timer in
// entities/unicorn.json (group lothlorien:offer_wait, written by tools/make_unicorn.py); a test keeps the two equal.

// Why an offer is refused: "tame" | "restless" (harmony below 0) | "untrusted" (Guest, not yet Friend) |
// "wait" (the pause after the last offer still runs: `ready` is the entity property lothlorien:offer_ready) | undefined (go ahead).
export function offerRefusal({ band, tame, ready }) {
  if (tame) return "tame";
  if (band !== "friend" && band !== "guest") return "restless"; // Uneasy, Shunned, Hated: harmony below 0
  if (band !== "friend") return "untrusted";
  if (!ready) return "wait";
  return undefined;
}

// Trust after one more accepted offer, and whether that completes the bond.
export function nextTrust(trust) {
  const next = Math.min(TRUST_OFFERS, trust + 1);
  return { trust: next, bonded: next >= TRUST_OFFERS };
}

// Only the owner rides a bonded unicorn. A bonded unicorn without a recorded owner (a /summon with the tame event, say)
// is anyone's.
export const mayRide = (ownerId, playerId) => !ownerId || ownerId === playerId;
