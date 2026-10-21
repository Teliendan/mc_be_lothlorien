// Shared ground/rotation anchor for every piece in the Great Mallorn start pool.
import { ROOT_DEPTH } from "./flet_mallorn.mjs";

export const TRUNK_ANCHOR = "lothlorien:giant_trunk";
export const ANCHOR_AT = Object.freeze({ x: 1, y: -ROOT_DEPTH, z: 1 });

export function anchorMallorn(blocks) {
  blocks.set(`${ANCHOR_AT.x},${ANCHOR_AT.y},${ANCHOR_AT.z}`, {
    name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 },
    jigsaw: TRUNK_ANCHOR, finalState: "lothlorien:mallorn_log",
  });
}
