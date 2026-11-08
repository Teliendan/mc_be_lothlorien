import { system } from "@minecraft/server";

// Leaf litter and blossoms stack up to AMOUNT 4 in one cell, through native placement (owner 2026-11-08: the engine's own
// arm swing, also in first person; native item use and place sound):
//  - both covers are `minecraft:replaceable`, like vanilla leaf litter, so the engine puts a placement aimed at a cover
//    (any face, or a neighbour face pointing into its cell) into the cover's own cell;
//  - `lothlorien:cover_stack` turns placing the same cover there into the old permutation with one more segment
//    (direction, dew and grass top kept) and refuses a full cover. Any other block replaces the cover, as in vanilla
//    (grass_overlay.js gives the grass back under it).
// Configured by tools/configure_support.py, which also keeps a cover off the top of another cover.
const AMOUNT = "lothlorien:amount", MAX_AMOUNT = 4;

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:cover_stack", {
    beforeOnPlayerPlace(event) {
      if (event.block.typeId !== event.permutationToPlace.type.id) return;
      const existing = event.block.permutation, amount = existing.getState(AMOUNT);
      if (amount >= MAX_AMOUNT) { event.cancel = true; return; }
      event.permutationToPlace = existing.withState(AMOUNT, amount + 1);
    },
  });
});
