// Gameplay territory is independent of the one-shot bridge/repair planner's done-list.
// Keep the old done-list readable so already-planned villages need no migration.
import { BlockVolume, world } from "@minecraft/server";
import { VILLAGE_PLANS, addDone, parseDone, villageAreaTest } from "./village_planner.js";

export const VILLAGE_AREAS = "lothlorien:village_areas";
const knownArea = villageAreaTest(() => world.getDynamicProperty(VILLAGE_AREAS));
const plannedArea = villageAreaTest(() => world.getDynamicProperty(VILLAGE_PLANS));
// Discovery boxes include loading padding and sometimes empty corners between
// branches. Use them only as an index; territory follows the built deck columns.
// The two-block horizontal fringe includes tree feet and ground beside a deck.
const DECK_IDS = ["mallorn_planks", "mallorn_heartwood_planks", "mallorn_slab", "mallorn_heartwood_slab", "mallorn_double_slab", "mallorn_heartwood_double_slab", "mallorn_stairs", "mallorn_heartwood_stairs"].map((id) => `lothlorien:${id}`);
export function inVillageArea(dimension, location) {
  const x = Math.floor(location.x), z = Math.floor(location.z);
  if (dimension.id !== "minecraft:overworld" || !(knownArea(x, z) || plannedArea(x, z))) return false;
  const { min, max } = dimension.heightRange;
  const column = new BlockVolume({ x: x - 2, y: min, z: z - 2 }, { x: x + 2, y: max - 1, z: z + 2 });
  // One native filtered query in a 5x5 column, only outside the biome and inside
  // a known village search box. Skip unloaded neighbours during first approach.
  for (const _ of dimension.getBlocks(column, { includeTypes: DECK_IDS }, true).getBlockLocationIterator()) return true;
  return false;
}

const contains = (a, b) => a.x0 <= b.x0 && a.x1 >= b.x1 && a.z0 <= b.z0 && a.z1 >= b.z1;
export function rememberVillageArea(rect) {
  const areas = parseDone(world.getDynamicProperty(VILLAGE_AREAS));
  if ([...areas, ...parseDone(world.getDynamicProperty(VILLAGE_PLANS))].some((r) => contains(r, rect))) return;
  // Once discovery finds the full village, replace its smaller marker-local records.
  world.setDynamicProperty(VILLAGE_AREAS, JSON.stringify(addDone(areas.filter((r) => !contains(rect, r)), rect)));
}
