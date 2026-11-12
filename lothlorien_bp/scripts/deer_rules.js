// Wildlife ids and alarm constants. Pure (no @minecraft/server) so tests/run.mjs can check them offline; deer.js wires them to the game.
//
// Flight is native (LM-01): every animal's avoid_mob_type reads the player's Harmony band tag (harmony.js BAND_TAGS) and the numbers
// live in tools/wildlife_wariness.py, which writes entities/{deer,white_deer,swan,squirrel,unicorn}.json.

import { SQUIRREL_ID, SWAN_ID, UNICORN_ID, WHITE_DEER_ID } from "./ids.js";
export { SQUIRREL_ID, SWAN_ID, UNICORN_ID, WHITE_DEER_ID }; // ids.js owns the ids; re-exported for callers and tests

export const DEER_ID = "lothlorien:deer";
// Both deer share the groups, the alarm and the tame state (entities/deer.json and entities/white_deer.json). The white deer is a loner,
// but it still bolts when a deer near it is hurt.
export const DEER_TYPES = [DEER_ID, WHITE_DEER_ID];
// Every wary animal: the deer, the swan, the ground squirrel and the unicorn carry the same alarm group and event.
export const WARY_TYPES = [...DEER_TYPES, SWAN_ID, SQUIRREL_ID, UNICORN_ID];
// A player hurting a wary animal alarms every wary animal this close to it.
export const ALARM_RADIUS = 20;
// Holding the lure stops a Guest or Friend fleeing from that player (entity filter has_equipment), so a lured deer walks all the way
// up. Feeding it sets lothlorien:tame: it then takes the state_tame group (lure, no flight from Guest or Friend). A player hurting it
// clears tame. The Uneasy, Shunned and Hated bands and the alarm still make it flee.
export const CORN_ID = "lothlorien:western_corn_grain";
