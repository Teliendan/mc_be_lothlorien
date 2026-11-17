// Debug log switch, shared by the planner, the elf village summary, the warden replacer and the rail mender; `/scriptevent lothlorien:debug` sets it
// (on while the toggling player has the debug tag). Diagnostic log lines go through it; only failures log unconditionally.
let on = false;
export const villageDebug = () => on;
// Module state, reset on every script load; main.js re-derives it from the debug tag at world load and when a tagged player joins.
export function setVillageDebug(value) { on = value === true; }
// Derives the switch from the persistent debug tag: on while any player carries it. main.js calls it at world load and when a tagged player joins.
export function syncVillageDebug(world, tag) { on = world.getPlayers({ tags: [tag] }).length > 0; }
