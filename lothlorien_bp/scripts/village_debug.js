// Debug log switch, shared by the planner, the elf village summary, the warden replacer and the rail mender; `/scriptevent lothlorien:debug` sets it
// (on while the toggling player has the debug tag). Diagnostic log lines go through it; only failures log unconditionally.
let on = false;
export const villageDebug = () => on;
// Module state: after a world reload the switch is off even for a player who still has the debug tag (and sees the HUD); toggle twice to get the log lines back.
export function setVillageDebug(value) { on = value === true; }
