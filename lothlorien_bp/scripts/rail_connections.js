// Finite local connection repair, also used after runtime furnishing/bridge writes.
import { LINKS, isFence, connectionChanges } from "./rail_mender_rules.js";

export function mendFence(dimension, loc) {
  const block = dimension.getBlock(loc);
  if (!block || !isFence(block.typeId)) return false;
  const perm = block.permutation;
  const on = connectionChanges(loc, (x,y,z) => dimension.getBlock({x,y,z})?.typeId, s => perm.getState(s));
  if (!on.length) return false;
  let next = perm;
  for (const [s,value] of on) next = next.withState(s, value);
  block.setPermutation(next);
  return true;
}

export function mendAround(dimension, p) {
  for (const loc of [p, ...LINKS.map(l => ({x:p.x+l.dx,y:p.y,z:p.z+l.dz}))]) {
    try { mendFence(dimension, loc); } catch { /* unloaded */ }
  }
}
