// Swans in the running game (Phase 15; rules in swan_rules.js). Their flight is native (entities/swan.json state_wild: each player judged by their own band tag); the alarm is in
// deer.js (they are in WARY_TYPES). This file only judges natural spawns: the spawn rule lets
// swans spawn in any river (see swan_rules.js), and one that spawned where no Lothlorien biome is near is removed. A submerged one floats up to the open surface,
// or is removed when a bank is overhead.
import { EntityInitializationCause, system } from "@minecraft/server";
import { onEntity } from "./entity_events.js";
import { judgeNatural } from "./entity_util.js";
import { SWAN_ID, nearBiome, surfaceAction } from "./swan_rules.js";

// The spawn rule's herd event sets lothlorien:natural (/summon and eggs do not, so they always stay). The flag is cleared
// after the roll, so a swan is judged once and not again on every chunk load.
function judgeNaturalSpawn(swan, biome) {
  judgeNatural(swan, () => {
    const { x, y, z } = swan.location;
    if (!nearBiome((dx, dz) => biome.at(swan.dimension, x + dx, z + dz), biome.id)) { swan.remove(); return; }
    // fish-style spawn rule: a swan can start submerged. Open water above -> float at the surface; bank overhead -> remove.
    const fix = surfaceAction(y, by => swan.dimension.getBlock({ x, y: by, z })?.typeId);
    if (fix.action === "remove") swan.remove();
    else if (fix.action === "move") swan.teleport({ x, y: fix.y, z });
  });
}

// biome = { id, at(dimension, x, z) -> surface biome id or undefined } (main.js supplies it).
export function startSwans(biome) {
  onEntity(SWAN_ID, {
    spawn: ({ entity, cause }) => {
      if (cause === EntityInitializationCause.Loaded) return;
      // one tick later: the spawn event's property is surely applied by then
      system.runTimeout(() => judgeNaturalSpawn(entity, biome), 1);
    },
  });
}
