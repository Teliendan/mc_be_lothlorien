// Deer antler block support rule. Pure, so tests/run.mjs can check it offline; the support service adapter imports it.
//
// `minecraft:block_face` holds the face of the support block that was clicked, so the support lies on the
// opposite side of the antler: clicked top ("up") -> support below; clicked underside ("down") -> support above;
// clicked north face -> the block north of the support is the antler, so the support is to the antler's south.
const SUPPORT_OFFSET = {
  up: { x: 0, y: -1, z: 0 },
  down: { x: 0, y: 1, z: 0 },
  north: { x: 0, y: 0, z: 1 },
  south: { x: 0, y: 0, z: -1 },
  east: { x: -1, y: 0, z: 0 },
  west: { x: 1, y: 0, z: 0 },
};

export function supportOffset(face) {
  return SUPPORT_OFFSET[face];
}
