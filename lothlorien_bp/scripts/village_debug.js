// Village debug logging switch, shared by the planner, the warden replacer and the rail mender; `/scriptevent lothlorien:village debug` toggles it.
let on = false;
export const villageDebug = () => on;
export function toggleVillageDebug() { on = !on; return on; }
