// Mallorn boats run on the engine's hard-coded boat class (runtime_identifier minecraft:boat / minecraft:chest_boat).
// When an axe breaks one, that class drops the item of the boat's variant, and a spawned Mallorn boat is variant 0 = oak
// (owner report 2026-11-08). The vanilla boat loot table is empty, so the class picks the item in code, not through
// minecraft:loot. The ordinary break reported on 2026-10-18 dropped the Mallorn boat. boat_drop.js swaps the oak item for
// the matching Mallorn one. Pure rules here.
export const ITEM_ENTITY = "minecraft:item";
// How far from the removed boat the engine's drop can land within a tick (hull 1.4 wide, item pops up with a small velocity).
export const SEARCH_RADIUS = 2.5;

// removed boat entity -> the vanilla item the engine drops for it and the item it should drop
export const BOAT_DROPS = Object.freeze({
  "lothlorien:mallorn_boat": { vanilla: "minecraft:oak_boat", own: "lothlorien:mallorn_boat" },
  "lothlorien:mallorn_heartwood_boat": { vanilla: "minecraft:oak_boat", own: "lothlorien:mallorn_heartwood_boat" },
  "lothlorien:mallorn_chest_boat": { vanilla: "minecraft:oak_chest_boat", own: "lothlorien:mallorn_chest_boat" },
  "lothlorien:mallorn_heartwood_chest_boat": { vanilla: "minecraft:oak_chest_boat", own: "lothlorien:mallorn_heartwood_chest_boat" },
});

// The engine drops exactly one boat item. A chest boat can also hold vanilla boat items that spill beside it; those stay.
// So convert one item only when more vanilla items lie there than the chest held.
export const shouldConvert = (foundVanilla, storedVanilla) => foundVanilla > storedVanilla;
