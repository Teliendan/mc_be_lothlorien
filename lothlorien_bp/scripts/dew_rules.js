// Pure: Phase 14b morning dew rules (tests/run.mjs imports this).
export const DEW_DROPS = 8; // drops in a full Bottle of morning dew

// Time of day in ticks (0 = sunrise-ish morning, 6000 noon, 12000 dusk): dew from just before sunrise until
// mid-morning, about 4 minutes of a 20 minute day. Sleeping through the night lands inside it.
export const DEW_START = 23000;
export const DEW_END = 3000;

export function inDewWindow(timeOfDay) {
  const t = ((timeOfDay % 24000) + 24000) % 24000;
  return t >= DEW_START || t < DEW_END;
}

export const DEW_LENGTH = (DEW_END - DEW_START + 24000) % 24000;

// Share of the window gone: 0 at DEW_START, 1 at DEW_END.
export function dawnShare(timeOfDay) {
  return ((((timeOfDay - DEW_START) % 24000) + 24000) % 24000) / DEW_LENGTH;
}

// Chance that one random tick makes a dry cover dewy at the start of the window; it falls linearly to 0 at the end.
export const DEW_APPEAR = { "lothlorien:mallorn_leaf_carpet": 1 / 8, "lothlorien:mallorn_blossom": 1 / 4 };
// Chance that one random tick dries a dewy cover at the end of the window (0 at the start); 1 outside the window.
export const DEW_DRY_MAX = 1 / 2;

// Is there Mallorn foliage above? typeAt(dy) gives the block id dy blocks up (undefined = unloaded, stops the scan).
export function leavesAbove(typeAt, isLeaves, maxScan = 40) {
  for (let dy = 1; dy <= maxScan; dy++) {
    const id = typeAt(dy);
    if (id === undefined) return false;
    if (isLeaves(id)) return true;
  }
  return false;
}

// Dew after one random tick. Outside the window any dew dries (chance 1). Inside it a dewy cover dries with
// DEW_DRY_MAX * share, a dry cover turns dewy with appearStart * (1 - share), only under leaves (checked lazily,
// only after the dice succeed). r in [0, 1).
export function dewAfterTick(dewy, timeOfDay, appearStart, r, hasLeavesAbove) {
  if (!inDewWindow(timeOfDay)) return false;
  const f = dawnShare(timeOfDay);
  if (dewy) return r >= DEW_DRY_MAX * f;
  return r < appearStart * (1 - f) && hasLeavesAbove();
}

// A Dew bottle is a durability item: damage counts the missing drops (new bottle: 1 drop = damage 7).
export const NEW_DEW_BOTTLE_DAMAGE = DEW_DROPS - 1;

export function dropsIn(damage) {
  return DEW_DROPS - damage;
}

// Adds one drop: { full: true } when the bottle is now complete, else the new damage.
export function addDrop(damage) {
  const drops = dropsIn(damage) + 1;
  return drops >= DEW_DROPS ? { full: true } : { full: false, damage: DEW_DROPS - drops };
}
