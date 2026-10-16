// Final decoration relationships, after all seats and gardens have been chosen.
import { isFence } from "../lothlorien_bp/scripts/rail_mender_rules.js";
import { relinkFences, frameArea, frameCell } from "./village_dress.mjs";
import { isAirName } from "./village_checks.mjs";
import { planPlanterPanels } from "../lothlorien_bp/scripts/planter_panels.js";

const key = (x, y, z) => `${x},${y},${z}`;
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const deck = (n) => /^lothlorien:mallorn_(heartwood_)?planks$/.test(n ?? "");

export function groundWoodPosts(blocks) {
  for (const [k, b] of [...blocks]) {
    if (!/^lothlorien:mallorn_(stripped_)?(log|wood)$/.test(b.name)) continue;
    const [x, y, z] = k.split(",").map(Number);
    const post = { name: `lothlorien:mallorn_${b.name.includes("stripped") ? "stripped_" : ""}log`, states: { "minecraft:block_face": "up" } };
    for (let yy = y - 1; isFence(blocks.get(key(x, yy, z))?.name); yy--) blocks.set(key(x, yy, z), post);
  }
}

export function clearSeatViews(blocks, keep, cushions) {
  const views = new Set();
  for (const c of cushions) for (const [dx, dz] of D4) if (isFence(blocks.get(key(c.x + dx, c.y + 1, c.z + dz))?.name)) views.add(key(c.x + dx, c.y + 2, c.z + dz));
  for (const k of views) {
    const item = blocks.get(k);
    if (!item || !/flower_pot$|firefly_jar$/.test(item.name)) continue;
    const [x, y, z] = k.split(",").map(Number);
    let moved = false;
    for (const distance of [1, 2, 3]) {
      for (const [dx, dz] of D4) {
        const nk = key(x + dx * distance, y, z + dz * distance);
        if (views.has(nk) || keep.has(nk) || !isAirName(blocks.get(nk)?.name) || !isFence(blocks.get(key(x + dx * distance, y - 1, z + dz * distance))?.name)) continue;
        blocks.set(nk, item); moved = true; break;
      }
      if (moved) break;
    }
    blocks.set(k, { name: "minecraft:air", states: {} });
  }
}

export function framePlanters(blocks, keep, reserved = new Set()) {
  // Skirts can stand beside a protected path: their actual thin face stays against
  // the moss, outside the player's center lane. Keep future furniture/actors free.
  const coords=[...blocks.keys()].map(k=>k.split(",").map(Number));
  const x0=Math.min(...coords.map(p=>p[0])),x1=Math.max(...coords.map(p=>p[0]));
  const z0=Math.min(...coords.map(p=>p[2])),z1=Math.max(...coords.map(p=>p[2]));
  const beds=[];
  for (const [k, b] of [...blocks]) {
    if (b.name !== "minecraft:moss_block") continue;
    const [x,y,z]=k.split(",").map(Number);
    if (deck(blocks.get(key(x,y-1,z))?.name)) beds.push({x,y,z});
  }
  const panels=planPlanterPanels((x,y,z)=>blocks.get(key(x,y,z))?.name,beds,{allowVoid:true,
    canPlace:p=>p.x>=x0&&p.x<=x1&&p.z>=z0&&p.z<=z1&&!reserved.has(key(p.x,p.y,p.z))});
  for(const p of panels) blocks.set(key(p.x,p.y,p.z),{name:p.name,states:p.states});
  return panels;
}

export function finishDressing(blocks, keep, cushions = [], home = null) {
  clearSeatViews(blocks, keep, cushions);
  groundWoodPosts(blocks);
  const reserved = new Set(home ? frameArea(home).map(([u,v]) => {const [x,z]=frameCell(home,u,v);return key(x,home.y+1,z);}) : []);
  for(const c of cushions) reserved.add(key(c.x,c.y+1,c.z));
  framePlanters(blocks, keep, reserved);
  relinkFences(blocks);
}
