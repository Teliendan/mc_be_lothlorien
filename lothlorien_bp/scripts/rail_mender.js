// Rail mender: village pieces carry one invisible `lothlorien:rail_mender` entity. When the entity loads (the piece's
// chunk loads next to a player) it waits until the whole box is loaded and repairs known fence connections
// (rail_mender_rules.js) and removes itself, so each piece is mended once. If the box never loads in 30 s the marker stays
// and tries again the next time it loads. Known gaps into air/thin decor are cleared too; unloaded targets are preserved.
import { BlockVolume, system, world } from "@minecraft/server";
import { FENCE_IDS, MAX_WAIT_TICKS, MENDER_ID, RETRY_TICKS, START_DELAY_TICKS, scanBox } from "./rail_mender_rules.js";
import { mendFence, mendAround } from "./rail_connections.js";

const busy = new Set();
const pending = [];
let draining = false;

function boxLoaded(dimension, box) {
  for (let cx = box.from.x >> 4; cx <= box.to.x >> 4; cx++) for (let cz = box.from.z >> 4; cz <= box.to.z >> 4; cz++) {
    if (!dimension.isChunkLoaded({ x: cx * 16, y: box.from.y, z: cz * 16 })) return false;
  }
  return true;
}

function* mend(entity, dimension, box) {
  let fixed = 0;
  for (const loc of dimension.getBlocks(new BlockVolume(box.from, box.to), { includeTypes: FENCE_IDS }, true).getBlockLocationIterator()) {
    if (mendFence(dimension, loc)) fixed++;
    yield;
  }
  if (entity.isValid && boxLoaded(dimension, box)) entity.remove();
  if (fixed) console.warn(`[lothlorien] rail mender: ${fixed} fence link(s) repaired`);
}

// One mender job at a time: a village loading dozens of markers cannot demand
// one minimum job iteration per marker in the same engine tick.
function queueMend(entity, dimension, box) {
  pending.push({entity, dimension, box});
  if (draining) return;
  draining = true;
  system.runJob((function* () {
    try {
      while (pending.length) {
        const task = pending.shift();
        try { if (task.entity.isValid && boxLoaded(task.dimension, task.box)) yield* mend(task.entity, task.dimension, task.box); }
        catch (e) { console.warn(`[lothlorien] rail mender: ${e}`); }
        finally { busy.delete(task.entity.id); }
        yield;
      }
    } finally { draining = false; }
  })());
}

function attempt(entity, waited) {
  try {
    if (!entity.isValid) return busy.delete(entity.id);
    const box = scanBox(entity.location);
    const dimension = entity.dimension;
    if (boxLoaded(dimension, box)) {
      queueMend(entity, dimension, box);
    } else if (waited >= MAX_WAIT_TICKS) {
      busy.delete(entity.id);
    } else {
      system.runTimeout(() => attempt(entity, waited + RETRY_TICKS), RETRY_TICKS);
    }
  } catch (e) {
    busy.delete(entity.id);
    console.warn(`[lothlorien] rail mender: ${e}`);
  }
}

function onMarker(entity) {
  if (!entity || entity.typeId !== MENDER_ID || busy.has(entity.id)) return;
  busy.add(entity.id);
  system.runTimeout(() => attempt(entity, 0), START_DELAY_TICKS);
}

world.afterEvents.entityLoad.subscribe(({ entity }) => onMarker(entity));
world.afterEvents.entitySpawn.subscribe(({ entity }) => onMarker(entity));

// Repairs remain local after player edits; no per-fence polling. Defer until native
// neighbor updates settle, then restore all known connections around the edited cell.
const edited = ({block, dimension}) => {
  const p = {...block.location};
  system.runTimeout(() => mendAround(dimension, p), 2);
};
world.afterEvents.playerPlaceBlock.subscribe(edited);
world.afterEvents.playerBreakBlock.subscribe(edited);
world.afterEvents.blockExplode.subscribe(edited);
