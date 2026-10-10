// Bounded collection gate: allowed breaks/environmental loot stay native.
// Wrong-tool breaks are completed without loot on the next writable tick.
export const STAR_CANOPY = "lothlorien:star_canopy";

function identity(block) {
  const states = block.permutation.getAllStates();
  return JSON.stringify([block.typeId, Object.keys(states).sort().map((key) => [key, states[key]])]);
}

export function createStarCanopyHarvestHandler({ schedule, damageRejectedTool,
  onRemoved = () => {}, warn = (message) => console.warn(message),
  creativeMode = "Creative", spectatorMode = "Spectator" }) {
  const pending = new Map();
  const cellKey = (dimension, position) => `${dimension.id}|${position.x}|${position.y}|${position.z}`;
  function beforePlayerBreak(event) {
    if (event.cancel || event.block.typeId !== STAR_CANOPY) return;
    try {
      const mode = event.player.getGameMode();
      if (mode === creativeMode || mode === spectatorMode) return;
      if (event.itemStack?.hasTag("minecraft:is_pickaxe")) return;
      const dimension = event.block.dimension, position = { ...event.block.location };
      const previous = identity(event.block), player = event.player;
      const slotIndex = player.selectedSlotIndex, capturedTool = event.itemStack?.clone();
      event.cancel = true;
      const key = cellKey(dimension, position);
      if (pending.has(key)) return;
      const token = {};
      pending.set(key, token);
      schedule(() => {
        try {
          if (pending.get(key) !== token || player.isValid === false) return;
          const currentMode = player.getGameMode();
          if (currentMode === creativeMode || currentMode === spectatorMode) return;
          const current = dimension.getBlock(position);
          // An unloaded/moved/changed cell must not be removed by a stale event.
          if (!current || current.isValid === false || identity(current) !== previous) return;
          current.setType("minecraft:air"); // No destroy command: invalid tools get no loot.
          try { damageRejectedTool(player, slotIndex, capturedTool); }
          finally { onRemoved(dimension, position); }
        } catch (error) { warn(`[star-canopy-harvest] deferred break: ${error}`); }
        finally { if (pending.get(key) === token) pending.delete(key); }
      });
    } catch (error) { warn(`[star-canopy-harvest] before break: ${error}`); }
  }
  beforePlayerBreak.invalidate = ({ block }) => {
    if (block) pending.delete(cellKey(block.dimension, block.location));
  };
  return beforePlayerBreak;
}
