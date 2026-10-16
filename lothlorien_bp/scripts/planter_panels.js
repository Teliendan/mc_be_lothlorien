// Moss-bed skirts share one recipe between structure generation and runtime homes.
// An open panel occupies 2.92/16 of the neighboring cell, against the moss face:
// the remaining 13.08/16 (even 10.16/16 between opposite skirts) fits a 0.6-wide player.
// Only this moss-mounted case is transparent to the center-of-cell walk model;
// unrelated trapdoor screens/guards keep their ordinary collision behavior.
export const PANEL_ID = "lothlorien:mallorn_trapdoor";
export const PANEL_DIRS = [
  {name:"east",dx:1,dz:0}, {name:"west",dx:-1,dz:0},
  {name:"south",dx:0,dz:1}, {name:"north",dx:0,dz:-1},
];
const AIR = new Set(["minecraft:air","minecraft:cave_air","minecraft:void_air"]);
export const panelBlock = d => ({name:PANEL_ID,states:{"minecraft:cardinal_direction":d.name,"minecraft:vertical_half":"bottom","lothlorien:open":true}});

export function isPlanterPanel(get, x, y, z, block = get(x,y,z)) {
  if (block?.name !== PANEL_ID || ![true,1].includes(block.states?.["lothlorien:open"])) return false;
  const d = PANEL_DIRS.find(d => d.name === block.states["minecraft:cardinal_direction"]);
  return !!d && get(x-d.dx,y,z-d.dz)?.name === "minecraft:moss_block";
}

// Planner signatures describe clear center lanes, not whole empty block volumes.
// Native writes preserve these skirts when a plan requests air in that lane.
export const planterWalkName = get => (x,y,z) => {
  const b=get(x,y,z);
  return isPlanterPanel(get,x,y,z,b) ? "minecraft:air" : b?.name;
};

// Names only; undefined is void for a bounded generator, but unloaded in game.
export function planPlanterPanels(at, beds, {canPlace = () => true, allowVoid = false} = {}) {
  const out=[],used=new Set();
  for (const bed of beds) for (const d of PANEL_DIRS) {
    const p={x:bed.x+d.dx,y:bed.y,z:bed.z+d.dz}, key=`${p.x},${p.y},${p.z}`;
    const n=at(p.x,p.y,p.z);
    if (used.has(key) || !(AIR.has(n) || (allowVoid && (n===undefined || n===null))) || !canPlace(p)) continue;
    out.push({...p,...panelBlock(d)}); used.add(key);
  }
  return out;
}
