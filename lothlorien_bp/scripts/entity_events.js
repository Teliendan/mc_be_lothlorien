// The pack's single entityLoad/entitySpawn subscription pair (rules in entity_events_rules.js). A script registers its
// types with onEntity(types, { load, spawn }) where it used to subscribe, so timing does not change.
import { world } from "@minecraft/server";
import { createEntityRouter } from "./entity_events_rules.js";

const router = createEntityRouter(world);
export const onEntity = router.on;
export const resetEntityEvents = router.reset; // tests only: the mock drops subscriptions on reset
