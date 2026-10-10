import { GameMode, system, world } from "@minecraft/server";
import { createStarCanopyHarvestHandler } from "./star_canopy_harvest_service.js";
import { damageRejectedTool } from "./harvestWear.js";
import { supportMotion } from "./support_motion.js";

const handler = createStarCanopyHarvestHandler({
  schedule: (callback) => system.run(callback), damageRejectedTool,
  creativeMode: GameMode.Creative, spectatorMode: GameMode.Spectator,
  onRemoved(dimension, position) {
    supportMotion.invalidate(dimension, position);
    supportMotion.resetAround(dimension, position);
  },
});
world.beforeEvents.playerBreakBlock.subscribe(handler);
world.afterEvents.playerPlaceBlock.subscribe(handler.invalidate);
world.afterEvents.blockExplode.subscribe(handler.invalidate);
