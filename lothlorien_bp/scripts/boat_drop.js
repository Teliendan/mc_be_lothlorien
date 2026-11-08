// WORKAROUND (docs/workarounds.md): breaking a Mallorn boat with an axe made the engine's boat class drop an oak boat (see boat_drop_rules.js). This swaps that
// item for the Mallorn one. The boat's location is read in the before-remove event, which takes no type filter, so the
// handler returns after one type check for every other entity. The swap runs one tick later, when the drop exists and
// writes are allowed. A break that already dropped the Mallorn item through the loot table leaves no oak item to swap.
import { ItemStack, system, world } from "@minecraft/server";
import { BOAT_DROPS, ITEM_ENTITY, SEARCH_RADIUS, shouldConvert } from "./boat_drop_rules.js";

const distanceSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const itemTypeOf = (entity) => entity.getComponent("minecraft:item")?.itemStack?.typeId;

function storedCount(boat, typeId) {
  const container = boat.getComponent("minecraft:inventory")?.container;
  if (!container) return 0;
  let count = 0;
  for (let slot = 0; slot < container.size; slot++) if (container.getItem(slot)?.typeId === typeId) count++;
  return count;
}

function swapDrop({ dimension, location, drop, stored }) {
  try {
    const vanilla = dimension.getEntities({ type: ITEM_ENTITY, location, maxDistance: SEARCH_RADIUS })
      .filter((entity) => itemTypeOf(entity) === drop.vanilla);
    if (!shouldConvert(vanilla.length, stored)) return;
    const oak = vanilla.reduce((a, b) => (distanceSq(b.location, location) < distanceSq(a.location, location) ? b : a));
    const own = dimension.spawnItem(new ItemStack(drop.own, 1), oak.location);
    own.applyImpulse(oak.getVelocity());
    oak.remove();
  } catch {
    // area unloaded (the boat was removed by a chunk unload) or the item is gone already
  }
}

world.afterEvents.worldLoad.subscribe(() => {
  world.beforeEvents.entityRemove.subscribe(({ removedEntity }) => {
    const drop = BOAT_DROPS[removedEntity.typeId];
    if (!drop) return;
    try {
      const record = { dimension: removedEntity.dimension, location: removedEntity.location, drop, stored: storedCount(removedEntity, drop.vanilla) };
      system.run(() => swapDrop(record));
    } catch {
      // the boat is already invalid: nothing to read
    }
  });
});
