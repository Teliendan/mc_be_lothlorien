// DEV ONLY, not part of the pack. `/scriptevent lothlorien:deer` counted deer within 64 blocks by tame state
// and sex. Removed from scripts/deer.js (recover: git show dc1182e:lothlorien_bp/scripts/deer.js).
// Wire up like tree_debug.js: import, then call from onScriptEvent in main.js.
import { DEER_ID } from "./deer_rules.js";

export function handleDeerEvent(event, player) {
  if (event.id !== "lothlorien:deer") return false;
  const byState = {}, bySex = { doe: 0, buck: 0 };
  let total = 0, babies = 0, alarmed = 0;
  for (const deer of player.dimension.getEntities({ type: DEER_ID, location: player.location, maxDistance: 64 })) {
    total++;
    const w = deer.getProperty("lothlorien:tame") ? "tame" : "wild";
    byState[w] = (byState[w] ?? 0) + 1;
    bySex[deer.getProperty("lothlorien:sex")]++;
    if (deer.getProperty("lothlorien:alarmed")) alarmed++;
    if (deer.getComponent("minecraft:is_baby")) babies++;
  }
  player.sendMessage(
    `[deer] ${total} within 64 (does ${bySex.doe}, bucks ${bySex.buck}, fawns ${babies}, alarmed ${alarmed}); ` +
      `state ${JSON.stringify(byState)}`
  );
  return true;
}
