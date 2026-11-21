import { system, world } from "@minecraft/server";
import { SUPPORT_POLICIES } from "./support_policies.js";
import { createSupportMotionService } from "./support_motion_service.js";
import { supportOffset } from "./antler_rules.js";
import { dropWholeRope } from "./elven_rope.js";
import { readBlock } from "./world_util.js";
import { cornSoilAllowed, CORN_ORIGIN } from "./crop_rules.js";

const AXES = [{ x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }];
// Named support lists as sets: blossom and leaf carpet allow ~400 block ids, checked on each support read.
const ALLOWED = new Map(Object.entries(SUPPORT_POLICIES).filter(([, p]) => p.allowed).map(([id, p]) => [id, new Set(p.allowed)]));
export function describeSupport(block) {
  const policy = SUPPORT_POLICIES[block.typeId];
  if (!policy) return undefined;
  const p = block.permutation, part = p.getState("minecraft:multi_block_part") || 0;
  const face = policy.mount === "rope" ? p.getState(block.typeId.endsWith("_hanging") ?
    "minecraft:cardinal_direction" : "lothlorien:face") : p.getState("minecraft:block_face");
  const offset = policy.mount === "face" || policy.mount === "rope" ? supportOffset(face) :
    { x: 0, y: policy.mount === "ceiling" ? 1 : -1 - (policy.mount === "door" ? part : 0), z: 0 };
  if (!offset) return undefined;
  const { x, y, z } = block.location;
  const cropOrigin = block.typeId === "lothlorien:western_corn" ? p.getState(CORN_ORIGIN) === true : undefined;
  return { identity: `${block.typeId}|${face || policy.mount}|${part}${cropOrigin === undefined ? "" : `|wild=${cropOrigin}`}`,
    supports: [{ position: { x: x + offset.x, y: y + offset.y, z: z + offset.z },
      valid: support => cropOrigin !== undefined ? cornSoilAllowed(cropOrigin, support.typeId) :
        policy.allowed ? ALLOWED.get(block.typeId).has(support.typeId) : !support.isAir && !support.isLiquid }] };
}
let writes = 0, blastPass = false; // counters for the explosion job's step budget; blastPass: inside that job
function remove(block) {
  if (block.typeId.startsWith("lothlorien:elven_rope")) {
    const face = block.permutation.getState(block.typeId.endsWith("_hanging") ? "minecraft:cardinal_direction" : "lothlorien:face");
    dropWholeRope(block.dimension, block.location, face, { defer: blastPass });
    return;
  }
  // Native multiblock destruction handles the other door part and a single item.
  writes++;
  const { x, y, z } = block.location;
  block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
}
let reads = 0;
export const supportMotion = createSupportMotionService({ now: () => system.currentTick,
  schedule: (fn, ticks) => system.runTimeout(fn, ticks), read: (dimension, position) => { reads++; return readBlock(dimension, position); }, describe: describeSupport, remove,
  onGone(dimension, record) {
    if (!record.identity.startsWith("lothlorien:elven_rope")) return;
    const [, face] = record.identity.split("|");
    // Native popped loot covers the vanished piece; remove the connected remainder.
    dropWholeRope(dimension, record.position, face, { defer: blastPass });
  },
});
system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  const onPlace = ({ block }) => supportMotion.observe(block, { reset: true });
  blockComponentRegistry.registerCustomComponent("lothlorien:motion_support", {
    beforeOnPlayerPlace(event) {
      const policy = SUPPORT_POLICIES[event.permutationToPlace.type.id];
      if (policy?.mount !== "face") return;
      const face = String(event.face).toLowerCase();
      const offset = supportOffset(face);
      if (!offset) { event.cancel = true; return; }
      // Bind the actual clicked face without resetting powered or other states.
      event.permutationToPlace = event.permutationToPlace.withState("minecraft:block_face", face);
      const { x, y, z } = event.block.location;
      const support = readBlock(event.dimension, { x: x + offset.x, y: y + offset.y, z: z + offset.z });
      if (!support || support.isAir || support.isLiquid) event.cancel = true;
    },
    onRandomTick({ block }) {
      supportMotion.tick(block);
    },
    onPlace,
  });
  // Plants whose native placement_filter already covers soil loss: no random tick at all.
  blockComponentRegistry.registerCustomComponent("lothlorien:motion_support_native", { onPlace });
});
world.afterEvents.pistonActivate.subscribe(event => {
  try {
    const position = event.block.location;
    supportMotion.onPiston({ dimension: event.dimension, position,
      axis: AXES[event.block.permutation.getState("facing_direction")], isExpanding: event.isExpanding, piston: event.piston });
  } catch { /* unloaded piston */ }
});
world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => {
  supportMotion.invalidate(dimension, block.location);
  supportMotion.resetAround(dimension, block.location);
});
world.afterEvents.playerPlaceBlock.subscribe(({ block, dimension }) => {
  supportMotion.invalidate(dimension, block.location);
  supportMotion.observe(block, { reset: true });
  supportMotion.resetAround(dimension, block.location);
});
// An explosion fires blockExplode once per destroyed block (a TNT cluster: thousands), and each position's support check
// reads its neighbours. The callback only notes the position (no native read); one job checks them in counted steps
// (<= 128 reads and 16 removals between two yields, checked per position). Forgetting the exploded block's own record
// stays in the callback: it reads nothing.
const SUPPORT_STEP_READS = 96, SUPPORT_STEP_WRITES = 10; // one position reads about 6-20 and removes at most 6 blocks
const blasted = []; // flat: dimension, x, y, z per exploded block
let blastJob = false;
function* checkBlasted() {
  try {
    let r0 = reads, w0 = writes;
    for (let i = 0; i < blasted.length; i += 4) { // the list may grow while the job runs
      if (reads - r0 >= SUPPORT_STEP_READS || writes - w0 >= SUPPORT_STEP_WRITES) { yield; r0 = reads; w0 = writes; }
      blastPass = true; // a rope that lost its wall is removed by its own job, not inside this step
      try { supportMotion.resetAround(blasted[i], { x: blasted[i + 1], y: blasted[i + 2], z: blasted[i + 3] }); }
      catch { /* unloaded */ }
      finally { blastPass = false; }
    }
  } finally { blasted.length = 0; blastJob = false; }
}
world.afterEvents.blockExplode.subscribe(({ block, dimension }) => {
  const { x, y, z } = block.location;
  supportMotion.invalidate(dimension, { x, y, z });
  blasted.push(dimension, x, y, z);
  if (blastJob) return;
  blastJob = true;
  try { system.runJob(checkBlasted()); } catch { blasted.length = 0; blastJob = false; }
});
