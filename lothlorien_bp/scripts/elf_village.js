// Population of a new Elven village, run by the village planner (loop_marker.js planVillageAt) while the whole village is loaded.
// The tree pieces carry invisible `lothlorien:elf_post` entities (tools/build_village.mjs): one `loremaster` post and RESERVE_POSTS `reserve`
// posts on the central tree, one `home` post on every outer tree. This pass reads them all, lets elf_rules.js assignHomes decide who stands
// where (the Loremaster on the central tree, healer / gardener / woodwright / lamplighter on trees of their own, leftovers on reserve posts),
// spawns one elf per assignment with the profession event, records the result for the home milestone and removes the posts.
// Idempotent by construction: the posts are gone after one run, so a second run finds none and spawns nothing.
import { BlockPermutation, world } from "@minecraft/server";
import { drive } from "./village_geom.js";
import { furnishHomeGen, populateGen } from "./village_populate.js";

// The work itself is village_populate.js (generators: the planner runs them as a job in steps, loop_marker.js). These wrappers run one to the end in a single call for
// tests and tools; the engine objects come from @minecraft/server here, so village_populate.js stays free of it.
export const ENGINE = { BlockPermutation, world };
export { populateGen };
export const furnishHome = (dimension, post, profession) => drive(furnishHomeGen(dimension, post, profession, ENGINE));
export const populateVillage = (dimension, rect, at) => drive(populateGen(dimension, rect, at, ENGINE));
