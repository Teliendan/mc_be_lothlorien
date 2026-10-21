import { world, system, GameMode } from "@minecraft/server";
import { repeatedUse } from "./use_guard.js";
import { captureCoverUse, liveCoverUse, originalCoverBlock } from "./cover_use.js";

// Native top placement preserves the owner-tested arm swing. Complete its
// two-cell merge synchronously in the privileged after-event, not next tick.
const AMOUNT = "lothlorien:amount", MAX_AMOUNT = 4;
const COVERS = new Set(["lothlorien:mallorn_leaf_carpet", "lothlorien:mallorn_blossom"]);
const TOP_USES = new Map();
const FACE_OFFSET = {
  Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0],
};
function upperCell(snapshot, block) {
  return block.dimension.id === snapshot.dimension.id && block.x === snapshot.target.location.x &&
    block.y === snapshot.target.location.y + 1 && block.z === snapshot.target.location.z;
}
system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:segmented_cover", {
    beforeOnPlayerPlace(event) {
      const snapshot = event.player && TOP_USES.get(event.player.id);
      if (snapshot && upperCell(snapshot, event.block)) {
        snapshot.upper = event.permutationToPlace;
      }
    },
  });
});
function sound(block) {
  try {
    block.dimension.playSound(block.typeId.endsWith("leaf_carpet") ? "block.leaf_litter.place" : "place.pink_petals",
      block.center(), { pitch: block.typeId.endsWith("leaf_carpet") ? 0.8 : 1 });
  } catch { /* cosmetics must not interrupt item/count completion */ }
}
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack, blockFace } = event;
  if (!itemStack || !COVERS.has(itemStack.typeId)) return;
  let target = block;
  if (block.typeId !== itemStack.typeId) {
    const offset = FACE_OFFSET[blockFace];
    if (!offset) return;
    const [dx, dy, dz] = offset;
    try { target = block.dimension.getBlock({ x: block.x + dx, y: block.y + dy, z: block.z + dz }); }
    catch { return; }
    if (target?.typeId !== itemStack.typeId) return;
  }
  const amount = target.permutation.getState(AMOUNT);
  if (!Number.isInteger(amount) || amount < 1) return;
  const onTop = target === block && blockFace === "Up";
  if (amount >= MAX_AMOUNT) { if (onTop) event.cancel = true; return; }
  const snapshot = captureCoverUse(target, player, itemStack);
  if (onTop) {
    if (!snapshot) { event.cancel = true; return; }
    TOP_USES.set(player.id, snapshot);
    system.run(() => { if (TOP_USES.get(player.id) === snapshot) TOP_USES.delete(player.id); });
    return;
  }
  event.cancel = true;
  if (repeatedUse(player, "merge")) return;
  system.run(() => {
    const live = liveCoverUse(snapshot, player);
    if (!live) return;
    live.block.setPermutation(live.block.permutation.withState(AMOUNT, amount + 1));
    if (snapshot.mode !== GameMode.Creative) {
      if (live.slot.amount > 1) live.slot.amount -= 1;
      else live.slot.setItem(undefined);
    }
    sound(live.block);
  });
});

world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => {
  if (!COVERS.has(block.typeId)) return;
  const snapshot = TOP_USES.get(player.id);
  if (!snapshot || !upperCell(snapshot, block) || block.typeId !== snapshot.item.typeId) return;
  TOP_USES.delete(player.id);
  if (!snapshot.upper || block.isWaterlogged || block.permutation.getState(AMOUNT) !== 1 ||
      !snapshot.upper.matches(block.typeId, block.permutation.getAllStates())) return; // changed placed cell
  // Native placement owns item consumption; never consume the current hand again.
  const refund = snapshot.item.clone(); refund.amount = 1;
  // Inventory decrement ordering within the native after-event is not an API
  // guarantee. This already-authorized native placement never consumes by script.
  const samePlayerContext = player.dimension.id === snapshot.dimension.id &&
    player.selectedSlotIndex === snapshot.index && player.getGameMode() === snapshot.mode;
  const below = originalCoverBlock(snapshot.target), support = originalCoverBlock(snapshot.support);
  const amount = below?.permutation.getState(AMOUNT);
  const valid = samePlayerContext && support && below && Number.isInteger(amount) && amount >= 1 && amount < MAX_AMOUNT &&
    block.permutation.getState(AMOUNT) === 1;
  const dimension = block.dimension, position = block.center();
  block.setType("minecraft:air");
  if (valid) {
    below.setPermutation(below.permutation.withState(AMOUNT, amount + 1));
    sound(below);
  } else if (snapshot.mode !== GameMode.Creative) {
    // Cached original item (including metadata), never block.typeId after air.
    dimension.spawnItem(refund, position);
  }
});
