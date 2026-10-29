// Memorial sound seed (docs/MEMORIAL.md): a `structure_template_feature` does not place template entities (owner, 2026-10-28),
// so the natural memorial's top pillar log is this look-alike block. Its one-shot tick, which runs once a player is within
// simulation distance, adds the invisible sound source above the cap and turns the seed into the plain upright log.
import { BlockPermutation, system } from "@minecraft/server";

export const MEMORIAL_SEED = Object.freeze({
  log: "lothlorien:mallorn_log", entity: "lothlorien:memorial_sound", offset: { x: 0.5, y: 1.6, z: 0.5 },
});

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:memorial_seed", {
    onTick({ block, dimension }) {
      const { x, y, z } = block.location, o = MEMORIAL_SEED.offset;
      dimension.spawnEntity(MEMORIAL_SEED.entity, { x: x + o.x, y: y + o.y, z: z + o.z });
      block.setPermutation(BlockPermutation.resolve(MEMORIAL_SEED.log, { "minecraft:block_face": "up" }));
    },
  });
});
