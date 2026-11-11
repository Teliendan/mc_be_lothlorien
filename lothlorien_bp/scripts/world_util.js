// Small pure helpers shared by the block scripts. No @minecraft/server import, so rule modules may use them.
// None of these keys is persisted; they only index in-memory maps.

// Offset of the cell a block face points into, by the face names the interaction events report.
export const FACE_OFFSET = {
  Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0],
};

export const cellKey = (dimension, { x, y, z }) => `${dimension.id}|${x},${y},${z}`;

export const BIOME_ID = "lothlorien:lothlorien";

// The block at `location`, or undefined when its chunk is unloaded or the position is outside the world.
export function readBlock(dimension, location) {
  try { return dimension.getBlock(location); } catch { return undefined; }
}

// The biome id at `location`, or undefined (unloaded chunk or outside world bounds).
export function biomeAt(dimension, location) {
  try {
    return dimension.getBiome(location).id;
  } catch {
    return undefined;
  }
}
