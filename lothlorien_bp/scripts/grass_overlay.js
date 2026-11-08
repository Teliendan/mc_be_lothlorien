import { world, system } from "@minecraft/server";
import { readBlock } from "./deferred_use.js";

// WORKAROUND for MCPE-184249 (https://bugs-legacy.mojang.com/browse/MCPE-184249): in low light the
// engine turns grass under our plants and covers into dirt, whatever their light_dampening (vanilla
// plants are exempt). Blocks patched by .claude/skills/bedrock-block-families/scripts/add_grass_overlay.py
// draw a grass top over that dirt while state `on_grass` is set. Only place and break events run here,
// nothing on a timer. Remove this file and the patch once Mojang fixes the bug.
export const ON_GRASS = "lothlorien:on_grass";
const GRASS = "minecraft:grass_block";
const DIRT = "minecraft:dirt";

// For script placement (bone meal): set the state when the block below is grass.
export function markOnGrass(block) {
  if (!(ON_GRASS in block.permutation.getAllStates())) return;
  if (block.below()?.typeId !== GRASS) return;
  block.setPermutation(block.permutation.withState(ON_GRASS, true));
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:grass_overlay", {
    beforeOnPlayerPlace(event) {
      // A cover replaced by a cover (replaceable) leaves its dirt below: keep drawing the grass top.
      if (event.block.below()?.typeId !== GRASS && event.block.permutation.getState(ON_GRASS) !== true) return;
      event.permutationToPlace = event.permutationToPlace.withState(ON_GRASS, true);
    },
  });
});

// Picking the plant up shows the ground: give back the grass the engine took.
world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
  if (brokenBlockPermutation.getAllStates()[ON_GRASS] !== true) return;
  const below = block.below();
  if (below?.typeId === DIRT) below.setType(GRASS);
});

// The covers are replaceable: another block placed into a grass-top cover's cell removes the cover without a break
// event (onBreak skips replaced blocks). Remember the cell a click may replace; after that placement give the grass back.
const REPLACEABLE = new Set(["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom"]);
const FACE_OFFSET = {
  Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0],
};
const pending = new Map(); // player id -> cell key
const cellKey = (dimension, { x, y, z }) => `${dimension.id} ${x} ${y} ${z}`;
world.beforeEvents.playerInteractWithBlock.subscribe(({ block, blockFace, player }) => {
  pending.delete(player.id);
  let target = block;
  if (!REPLACEABLE.has(block.typeId)) {
    const offset = FACE_OFFSET[blockFace];
    if (!offset) return;
    target = readBlock(block.dimension, { x: block.x + offset[0], y: block.y + offset[1], z: block.z + offset[2] });
  }
  if (REPLACEABLE.has(target?.typeId) && target.permutation.getState(ON_GRASS) === true)
    pending.set(player.id, cellKey(target.dimension, target.location));
});
world.afterEvents.playerPlaceBlock.subscribe(({ block, dimension, player }) => {
  const key = pending.get(player.id);
  if (key === undefined) return;
  pending.delete(player.id);
  if (key !== cellKey(dimension, block.location) || REPLACEABLE.has(block.typeId)) return;
  const below = block.below();
  if (below?.typeId === DIRT) below.setType(GRASS);
});
