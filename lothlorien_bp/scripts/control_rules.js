// Geometry/timing rules shared by the controls and their independent offline tests.
export const PLATE_RELEASE_TICKS = 20;
export const GATE_OPEN_VECTOR = {
  north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0],
};
const OPPOSITE = { north: "south", south: "north", east: "west", west: "east" };

// The existing open gate model points north before its cardinal transformation.
export function gateFacingAway(facing, center, playerLocation) {
  const direction = GATE_OPEN_VECTOR[facing];
  if (!direction || !playerLocation) return facing;
  const side = (playerLocation.x - center.x) * direction[0] +
    (playerLocation.z - center.z) * direction[1];
  return side > 0 ? OPPOSITE[facing] : facing;
}

// Collision intersection, not entity origin: feet outside the cell can still overlap.
// The Wiki specifies the bottom quarter-block; precise Bedrock edge insets need game comparison.
export function overlapsPlate(location, { center, extent }) {
  return center.x + extent.x > location.x && center.x - extent.x < location.x + 1 &&
    center.z + extent.z > location.z && center.z - extent.z < location.z + 1 &&
    center.y + extent.y > location.y && center.y - extent.y < location.y + 0.25;
}

export function pairedDoorHinge(facing, typeId, left, right) {
  const match = (neighbor, hingeRight) => neighbor?.typeId === typeId &&
    neighbor.permutation.getState("minecraft:cardinal_direction") === facing &&
    neighbor.permutation.getState("minecraft:multi_block_part") === 0 &&
    neighbor.permutation.getState("lothlorien:hinge_right") === hingeRight;
  const leftPair = match(left, false), rightPair = match(right, true);
  if (leftPair && !rightPair) return true;
  if (rightPair && !leftPair) return false;
  return false; // Bedrock default; solid-face tie-break remains an explicit open audit row.
}
