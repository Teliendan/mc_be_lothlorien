import { world, system, GameMode } from "@minecraft/server";
import { captureUse, liveUse, readBlock } from "./deferred_use.js";

// Leaf litter and blossoms stack up to AMOUNT 4 in one cell.
//  - Click the top of a cover: native placement (keeps the owner-tested arm swing) puts a second cover above; the
//    after-event folds it into the one below. A full cover refuses (cancelled).
//  - Click a cover's side, or a neighbour block's face that points into a cover: cancelled, merged next tick.
const AMOUNT = "lothlorien:amount", MAX_AMOUNT = 4;
const COVERS = new Set(["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom"]);
const FACE_OFFSET = {
  Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0],
};
function sound(block) {
  const leaf = block.typeId.endsWith("leaf_carpet");
  block.dimension.playSound(leaf ? "block.leaf_litter.place" : "place.pink_petals", block.center(), { pitch: leaf ? 0.8 : 1 });
}
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack, blockFace } = event;
  if (!itemStack || !COVERS.has(itemStack.typeId)) return;
  let target = block;
  if (block.typeId !== itemStack.typeId) {
    const offset = FACE_OFFSET[blockFace];
    if (!offset) return;
    target = readBlock(block.dimension, { x: block.x + offset[0], y: block.y + offset[1], z: block.z + offset[2] });
    if (target?.typeId !== itemStack.typeId) return;
  }
  const amount = target.permutation.getState(AMOUNT);
  const onTop = target === block && blockFace === "Up";
  if (amount >= MAX_AMOUNT) { if (onTop) event.cancel = true; return; }
  if (onTop) return;
  event.cancel = true;
  if (!event.isFirstEvent) return;
  const use = captureUse(target, itemStack);
  system.run(() => {
    const live = liveUse(use, player);
    if (!live) return;
    live.block.setPermutation(live.block.permutation.withState(AMOUNT, amount + 1));
    if (player.getGameMode() !== GameMode.Creative) {
      if (live.slot.amount > 1) live.slot.amount -= 1;
      else live.slot.setItem(undefined);
    }
    sound(live.block);
  });
});

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  if (!COVERS.has(block.typeId)) return;
  const below = block.below();
  const amount = below?.typeId === block.typeId ? below.permutation.getState(AMOUNT) : MAX_AMOUNT;
  if (amount >= MAX_AMOUNT) return;
  block.setType("minecraft:air");
  below.setPermutation(below.permutation.withState(AMOUNT, amount + 1));
  sound(below);
}, { blockTypes: [...COVERS] });
