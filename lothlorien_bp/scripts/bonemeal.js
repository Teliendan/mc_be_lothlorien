import { world, system, GameMode } from "@minecraft/server";
import { BONEMEAL_TABLE, SPREAD_TRIES, pickWeighted } from "./flora_table.js";
import { CROP, growCrop, isMature, validCropSoil } from "./crop.js";
import { captureUse, liveUse, readBlock } from "./deferred_use.js";
import { SUPPORT_POLICIES } from "./support_policies.js";
import { repeatedUse } from "./use_guard.js";
import { markOnGrass } from "./grass_overlay.js";

// Bone meal in Lothlorien (the vanilla action is cancelled and replaced):
//  - on a grass block inside the biome: a scatter of ~12 tries within 3 blocks (grass, our flora), not vanilla flowers;
//  - on one of our plants (anywhere): more of the same nearby, like vanilla flowers; Athelas grows fewer;
// Fallen litter/blossoms deliberately do not grow or duplicate with bone meal (owner2026-10-19).
const BIOME_ID = "lothlorien:lothlorien";
const GRASS_TRIES = 12;
const RADIUS = 3;

function inBiome(block) {
  try {
    return block.dimension.getBiome(block.location).id === BIOME_ID;
  } catch {
    return false;
  }
}

// Try to put `typeId` on grass with air above near `center`; `variant` may adjust the block afterwards.
function scatter(center, tries, pick, after) {
  const { dimension } = center;
  const rnd = () => Math.round((Math.random() + Math.random() - 1) * RADIUS);
  for (let i = 0; i < tries; i++) {
    const x = center.x + rnd(), z = center.z + rnd();
    for (const dy of [0, 1, -1]) {
      const soil = readBlock(dimension, { x, y: center.y + dy, z });
      const above = readBlock(dimension, { x, y: center.y + dy + 1, z });
      if (soil?.typeId !== "minecraft:grass_block" || above?.typeId !== "minecraft:air") continue;
      above.setType(pick());
      markOnGrass(above);
      after?.(above);
      break;
    }
  }
}

function effects(block) {
  try {
    block.dimension.playSound("item.bone_meal.use", block.center());
    block.dimension.spawnParticle("minecraft:crop_growth_emitter", { x: block.x + 0.5, y: block.y + 0.5, z: block.z + 0.5 });
  } catch {
    // particle name unverified; the growth itself is what matters
  }
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (itemStack?.typeId !== "minecraft:bone_meal") return;
  const id = block.typeId;
  let act, valid = () => true;
  if (id === "minecraft:grass_block" && inBiome(block)) {
    valid = inBiome;
    act = b => scatter(b, GRASS_TRIES, () => pickWeighted(BONEMEAL_TABLE, Math.random()));
  } else if (SPREAD_TRIES[id]) {
    valid = supported;
    act = b => scatter(readBlock(b.dimension, { x: b.x, y: b.y - 1, z: b.z }), SPREAD_TRIES[id], () => id);
  } else if (id === CROP) {
    if (isMature(block)) return; // nothing to grow: keep the bone meal
    valid = b => !isMature(b) && validCropSoil(b);
    act = growCrop;
  } else {
    return;
  }
  event.cancel = true;
  if (repeatedUse(player, "bonemeal")) return;
  const snapshot = captureUse(block, player, itemStack);
  system.run(() => {
    const live = liveUse(snapshot, player);
    if (!live || !valid(live.block)) return;
    act(live.block);
    if (snapshot.mode !== GameMode.Creative) {
      if (live.slot.amount > 1) live.slot.amount -= 1;
      else live.slot.setItem(undefined);
    }
    effects(live.block);
  });
});

function supported(block) {
  const soil = readBlock(block.dimension, { x: block.x, y: block.y - 1, z: block.z });
  if (!soil) return false;
  const allowed = SUPPORT_POLICIES[block.typeId]?.allowed;
  return allowed ? allowed.includes(soil.typeId) : !soil.isAir && !soil.isLiquid;
}
