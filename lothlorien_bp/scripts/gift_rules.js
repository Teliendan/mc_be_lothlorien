// M5 balance values. Generators and runtime share this file; regenerate assets/tables after edits.
export const BOW_ID = "lothlorien:bow";
export const ARROW_ID = "lothlorien:galadhrim_arrow";
export const BOW = { drawSeconds: 0.6, durability: 384, enchantability: 1, useSeconds: 3600,
  zoomFov: 60, zoomEaseSeconds: 0.6, watchTicks: 2 };
export const ARROW = { recoveryChance: 1, rank: 2, guestPrice: [1, 8], friendPrice: [1, 10],
  lootWeight: 6, lootCount: { min: 4, max: 8 } };
export const WORN_CHECK_TICKS = 5;
export const CLOAK = { item: "lothlorien:elven_cloak", armor: 3, durability: 80,
  enchantability: 15, repairMaterial: "minecraft:string", repairFraction: 0.25, stillTicks: 20,
  moveTolerance: 0.025, effect: "invisibility", effectTicks: 10, amplifier: 0 };
export const BELT = { item: "lothlorien:silver_belt", effect: "regeneration", effectTicks: 60,
  amplifier: 0, healthFraction: 0.5 };
export const PHIAL_ID = "lothlorien:phial_of_galadriel";
export const PHIAL_LIGHT_BLOCK = "lothlorien:phial_light";
export const PHIAL_LIGHT_LEVEL = 14;
export const PHIAL_POLL_TICKS = 5;
export const PHIAL_SPIDER_RADIUS = 8;
export const PHIAL_SPIDER_FORCE = 0.8;
export const PHIAL_MAX_SPIDERS = 24;
export const PHIAL_CLEANUP_PER_PASS = 64;
export const PHIAL_MAX_PENDING_LIGHTS = 256;
export const PHIAL_OWNERSHIP_PROPERTY = "lothlorien:phial_lights_v1";
export const PHIAL_SPIDER_TYPES = Object.freeze(["minecraft:spider", "minecraft:cave_spider"]);
export const PHIAL_LIGHT_OFFSETS = Object.freeze([{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }]);
export const FINAL_GIFTS = {
  gardener: { item: CLOAK.item, emeralds: 32 },
  healer: { item: BELT.item, emeralds: 32 },
  woodwright: { item: BOW_ID, emeralds: 32 },
  lamplighter: { item: PHIAL_ID, emeralds: 32 },
};
