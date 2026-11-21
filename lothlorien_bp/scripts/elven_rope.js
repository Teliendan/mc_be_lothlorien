// Elven rope (TECHNICAL_NOTES.md "Elven rope"): a stackable item that unrolls a rope on the side of a block, and the script that makes it
// climbable. Rope pieces are the block `lothlorien:elven_rope` (state `lothlorien:face`) and its structure-only twin
// `lothlorien:elven_rope_hanging` (state `minecraft:cardinal_direction`, same values: Bedrock rotates that state with a
// rotated structure piece, but not the custom `lothlorien:face`). Both are one rope to every rule below.
//   - Using the rope on the side of a block hangs pieces in the clicked cell, downwards first, then upwards, one per
//     item up to the stack. Using it on a piece extends that rope the same way (down from its bottom, then up).
//   - Breaking any piece breaks the whole rope: every piece drops where it was broken. Losing the wall behind any
//     piece does the same (the shared support service, support_motion.js, handles that).
//   - Climbing: see startRopeClimbing() and CLIMB in elven_rope_rules.js.
import { BlockPermutation, EquipmentSlot, GameMode, ItemStack, system, world } from "@minecraft/server";
import { brakes, CLIMB, dropStacks, isUnsupported, levitationStep, pieceOffset, wallOffset } from "./elven_rope_rules.js";
import { repeatedUse } from "./use_guard.js";
import { noteDeed } from "./deeds.js";
import { readBlock } from "./deferred_use.js";

const ROPE_ID = "lothlorien:elven_rope";
const FACE_STATE = "lothlorien:face";
const HANGING_ID = "lothlorien:elven_rope_hanging";
const HANGING_STATE = "minecraft:cardinal_direction";
const ROPE_IDS = new Set([ROPE_ID, HANGING_ID]);

// the face a rope permutation hangs on, or undefined for any other block
const permFace = (perm) => (perm?.type.id === ROPE_ID ? perm.getState(FACE_STATE) : perm?.type.id === HANGING_ID ? perm.getState(HANGING_STATE) : undefined);
const faceOf = (block) => (block && ROPE_IDS.has(block.typeId) ? permFace(block.permutation) : undefined);

function hasWall(dimension, { x, y, z }, face) {
  const w = wallOffset(face);
  const wall = readBlock(dimension, { x: x + w.x, y, z: z + w.z });
  return wall ? !isUnsupported({ isAir: wall.isAir, isLiquid: wall.isLiquid }) : undefined;
}

const heightBounds = (dimension) => ({ minY: dimension.heightRange.min, maxY: dimension.heightRange.max });

// A rope can be 384 pieces long, so every walk over it is counted (owner rule 2026-11-21): a step makes at most ROPE_READS
// native reads and ROPE_WRITES writes (a piece placed or removed, an item spawn, the hand update, the sound) and then
// yields. The first step runs at once (a short rope is placed or gone before the call returns, as before); a long one
// continues as a job. A `budget` ({ reads, writes }) is shared by everything one job does, so a batch of ropes never
// adds up inside one step.
const ROPE_READS = 128, ROPE_WRITES = 16, EXTEND_PIECES = 12; // 12 pieces + the hand update + sound and deed <= 16 writes
const newBudget = () => ({ reads: 0, writes: 0 });
function runCounted(gen) {
  try {
    if (gen.next().done) return;
    system.runJob((function* () { while (!gen.next().done) yield; })());
  } catch (e) { gen.return(); throw e; }
}

// Ropes being extended right now ("dimension|x,z"), so a second use cannot plan over the first one's job.
const extending = new Set();

// Hangs pieces in column (x, z) on `face`, at most `count`, downwards from `y` first (a new rope) or from the bottom
// piece (an extension: the walk to both ends comes first), then upwards: the rows the rope plan in elven_rope_rules.js picks, row by row. A row takes
// a piece when it is air with a wall behind it, read right before the piece is placed. The hand pays one item per piece
// at the end of each step, and a changed hand stops the rope.
function* hangRope({ player, dimension, x, y: y0, z, face, extend, count, creative, budget: b, guard }) {
  try {
    const { minY, maxY } = heightBounds(dimension);
    let downFrom = y0, upFrom = y0 + 1;
    if (extend) {
      let bottom = y0, top = y0;
      const piece = (row) => { b.reads++; return faceOf(readBlock(dimension, { x, y: row, z })) === face; };
      while (bottom - 1 >= minY) {
        if (b.reads >= ROPE_READS) { yield; b.reads = 0; }
        if (!piece(bottom - 1)) break;
        bottom--;
      }
      while (top + 1 <= maxY) {
        if (b.reads >= ROPE_READS) { yield; b.reads = 0; }
        if (!piece(top + 1)) break;
        top++;
      }
      downFrom = bottom - 1; upFrom = top + 1;
    }
    const permutation = BlockPermutation.resolve(ROPE_ID, { [FACE_STATE]: face });
    const slot = creative ? undefined : player.getComponent("equippable").getEquipmentSlot(EquipmentSlot.Mainhand);
    let avail = Infinity, placed = 0, stepPlaced = 0, firstRow, announced = false;
    const refresh = () => {
      if (!slot) return;
      const held = slot.getItem();
      b.reads++;
      avail = held?.typeId === ROPE_ID ? held.amount : 0;
    };
    const settle = () => { // pay for this step's pieces; sound and deed once the first ones are down
      if (stepPlaced) {
        b.writes++;
        if (slot) { if (avail - stepPlaced > 0) slot.amount = avail - stepPlaced; else slot.setItem(undefined); }
        stepPlaced = 0;
      }
      if (!announced && firstRow !== undefined) {
        announced = true; b.writes += 2;
        noteDeed(player, "rope");
        dimension.playSound("dig.grass", { x: x + 0.5, y: firstRow, z: z + 0.5 });
      }
    };
    refresh();
    let up = false, y = downFrom;
    while (placed < count) {
      if (up ? y > maxY : y < minY) { if (up) break; up = true; y = upFrom; continue; }
      if (b.reads + 3 > ROPE_READS || b.writes >= ROPE_WRITES - 3 || stepPlaced >= EXTEND_PIECES) {
        settle(); yield; b.reads = b.writes = 0; refresh();
      }
      if (stepPlaced >= avail) break; // the hand is empty (or no longer holds rope)
      const cell = readBlock(dimension, { x, y, z });
      b.reads += 2; // the cell and its wall
      if (cell?.isAir && hasWall(dimension, { x, y, z }, face) === true) {
        cell.setPermutation(permutation);
        b.writes++; placed++; stepPlaced++; firstRow ??= y;
        y += up ? 1 : -1;
      } else if (up) break;
      else if (!extend && !placed) break; // a new rope needs its clicked cell
      else { up = true; y = upFrom; }
    }
    settle();
  } finally { extending.delete(guard); }
}

// The rope item is used on a block: hang pieces downwards first, then upwards, one per item in the hand.
function useRope(player, block, blockFace, itemStack) {
  const dimension = block.dimension;
  const clickedFace = faceOf(block);
  let { x, y, z } = block.location;
  let face = clickedFace;
  if (!clickedFace) { // new rope in the cell beside the clicked side face
    face = String(blockFace).toLowerCase();
    const off = pieceOffset(face);
    if (!off) return; // top or bottom face: a rope hangs on the side of a block
    x += off.x;
    z += off.z;
  }
  const guard = `${dimension.id}|${x},${z}`;
  if (extending.has(guard)) return;
  extending.add(guard);
  runCounted(hangRope({ player, dimension, x, y, z, face, extend: !!clickedFace, count: itemStack.amount,
    creative: player.getGameMode() === GameMode.Creative, budget: newBudget(), guard }));
}

// Removes every piece of the rope in column (x, z) that is connected to row y and drops all of them, plus one when
// the piece at y is already gone (`gone`), as stacks at row y. Pieces are counted as they are removed, so two
// overlapping calls never drop twice.
function* ropeRemoval(dimension, { x, y, z }, face, creative, gone, b = newBudget()) {
  const { minY, maxY } = heightBounds(dimension);
  const piece = (row) => {
    b.reads++;
    return faceOf(readBlock(dimension, { x, y: row, z })) === face;
  };
  let bottom = y, top = y;
  while (bottom - 1 >= minY) {
    if (b.reads >= ROPE_READS) { yield; b.reads = 0; }
    if (!piece(bottom - 1)) break;
    bottom--;
  }
  while (top + 1 <= maxY) {
    if (b.reads >= ROPE_READS) { yield; b.reads = 0; }
    if (!piece(top + 1)) break;
    top++;
  }
  let total = gone ? 1 : 0;
  for (let row = bottom; row <= top; row++) {
    if (b.writes >= ROPE_WRITES || b.reads >= ROPE_READS) { yield; b.reads = b.writes = 0; }
    b.reads++;
    const block = readBlock(dimension, { x, y: row, z });
    if (faceOf(block) !== face) continue;
    block.setType("minecraft:air");
    b.writes++;
    total++;
  }
  if (creative || world.gameRules.doTileDrops !== true) return;
  for (const amount of dropStacks(total)) {
    if (b.writes >= ROPE_WRITES) { yield; b.writes = 0; }
    dimension.spawnItem(new ItemStack(ROPE_ID, amount), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    b.writes++;
  }
}
// `defer`: no inline first step, the whole removal runs as a job (a caller that is itself one step of a counted job).
export function dropWholeRope(dimension, location, face, { creative = false, gone = false, defer = false } = {}) {
  const removal = ropeRemoval(dimension, location, face, creative, gone);
  if (!defer) { runCounted(removal); return; }
  system.runJob((function* () { while (!removal.next().done) yield; })());
}

// An explosion fires blockExplode once per destroyed block, and a TNT cluster destroys thousands: the callback only
// notes each exploded rope piece (no native reads); one job walks the notes in counted steps, one removal per piece,
// exactly what a call per piece did (the engine drops the exploded piece itself; the connected rest drops once: the
// first walk removes it, later walks find air).
const exploded = []; // flat: { dimension, face }, x, y, z per piece
let explodedJob = false;
function* explodedRopes() {
  try {
    const b = newBudget();
    for (let i = 0; i < exploded.length; i += 4) { // the list may grow while the job runs
      const { dimension, face } = exploded[i];
      yield* ropeRemoval(dimension, { x: exploded[i + 1], y: exploded[i + 2], z: exploded[i + 3] }, face, false, false, b);
      if (b.reads >= ROPE_READS || b.writes >= ROPE_WRITES) { yield; b.reads = b.writes = 0; }
    }
  } finally { exploded.length = 0; explodedJob = false; }
}
function noteExplodedRope(dimension, { x, y, z }, face) {
  exploded.push({ dimension, face }, x, y, z);
  if (explodedJob) return;
  explodedJob = true;
  try { system.runJob(explodedRopes()); } catch { exploded.length = 0; explodedJob = false; }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("lothlorien:rope", {
    onUseOn({ source, block, blockFace, itemStack }) {
      if (repeatedUse(source, "elven_rope")) return;
      useRope(source, block, blockFace, itemStack);
    },
  });
});

// Breaking a piece breaks the whole rope: the piece is already gone, the rest is removed and everything drops here
world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation, player }) => {
  if (ROPE_IDS.has(brokenBlockPermutation.type.id)) {
    const creative = player.getGameMode() === GameMode.Creative;
    dropWholeRope(block.dimension, block.location, permFace(brokenBlockPermutation), { creative });
  }
});
world.afterEvents.blockExplode.subscribe(({ block, dimension, explodedBlockPermutation }) => {
  if (ROPE_IDS.has(explodedBlockPermutation.type.id)) {
    noteExplodedRope(dimension, block.location, permFace(explodedBlockPermutation));
  }
});

// WORKAROUND (docs/workarounds.md in the workspace; re-check after every game update): no component makes a custom block
// climbable (1.26.52). Remove this when one exists.
// Climbing, by script (a custom block cannot be climbable): in a rope cell Jump or forward climbs (levitation), crouch
// holds your height, and otherwise you sink slowly (slow falling).
// Jump or walking forward climbs (the movement vector's y is positive forward). Returns the climb speed in blocks per
// tick, or 0.
export function climbSpeed(player) {
  const { inputInfo } = player;
  if (inputInfo.getButtonState("Jump") === "Pressed") return CLIMB.jumpSpeed / 20;
  return inputInfo.getMovementVector().y > CLIMB.forwardThreshold ? CLIMB.forwardSpeed / 20 : 0;
}
export function inRope(player) {
  const { x, y, z } = player.location;
  const cx = Math.floor(x);
  const cz = Math.floor(z);
  const feet = readBlock(player.dimension, { x: cx, y: Math.floor(y), z: cz });
  if (!feet) return false;
  const rope = ROPE_IDS.has(feet.typeId) ? feet : readBlock(player.dimension, { x: cx, y: Math.floor(y + 1), z: cz });
  if (!ROPE_IDS.has(rope?.typeId) || rope.isWaterlogged !== false) return false;
  return !(player.isGliding || player.isFlying || player.getComponent("riding")?.entityRidingOn ||
    player.getGameMode() === GameMode.Spectator);
}

// player id -> { player; v: modelled vertical speed while climbing (see levitationStep), else null;
//                y: last height; holdY: height where crouching began, or undefined }
const climbing = new Map();
const ENTRY_TICKS = 4; // no pass-through contact callback for a collision-free rope
let climbingTimer;

// Track our grants as well as their short duration: a potion's last four ticks
// must not be mistaken for a rope grant. Longer replacement effects stay intact.
const grantedEffects = new Map();
const ours = (player, effect) => grantedEffects.get(player.id)?.has(effect) && player.getEffect(effect)?.duration <= CLIMB.effectTicks;
function foreign(player, effect) {
  const active = player.getEffect(effect);
  if (active?.duration > CLIMB.effectTicks) grantedEffects.get(player.id)?.delete(effect);
  return !!active && !ours(player, effect);
}
function grant(player, effect, amplifier) {
  player.addEffect(effect, CLIMB.effectTicks, { amplifier, showParticles: false });
  if (!grantedEffects.has(player.id)) grantedEffects.set(player.id, new Set());
  grantedEffects.get(player.id).add(effect);
}
function clearOurs(player, ...effects) {
  for (const effect of effects) {
    if (ours(player, effect)) player.removeEffect(effect);
    grantedEffects.get(player.id)?.delete(effect);
  }
}

function leaveRope(id, player) {
  climbing.delete(id);
  if (player) clearOurs(player, "levitation", "slow_falling");
  grantedEffects.delete(id);
}

function syncClimbingTimer() {
  if (climbing.size && climbingTimer === undefined) climbingTimer = system.runInterval(tickClimbers, 1);
  else if (!climbing.size && climbingTimer !== undefined) { system.clearRun(climbingTimer); climbingTimer = undefined; }
}

function updateClimber(player) {
  try {
    if (!inRope(player)) {
      leaveRope(player.id, player);
      return;
    }
    const y = player.location.y;
    const last = climbing.get(player.id);
    // External levitation controls vertical motion. Slow Falling can coexist
    // with rope climbing and crouching, and must retain its original duration.
    if (foreign(player, "levitation")) {
      climbing.set(player.id, { player, v: null, y });
      return;
    }
    if (player.isSneaking) {
      // A custom block has no ladder's built-in crouch grip. Hold the first crouched height without changing
      // horizontal movement or the direction the player is facing.
      const holdY = last?.holdY ?? y;
      clearOurs(player, "levitation", "slow_falling");
      player.teleport({ x: player.location.x, y: holdY, z: player.location.z });
      climbing.set(player.id, { player, v: null, y: holdY, holdY });
      return;
    }
    const target = climbSpeed(player);
    let v = null;
    let level; // levitation amplifier this tick, or undefined for none
    if (target > 0) {
      // climbing: levitation alone (it replaces gravity, slow falling would only add an icon). Start from the real
      // speed, then follow the model (the level each tick steers it to the target).
      const step = levitationStep(last?.v ?? player.getVelocity().y, target);
      v = step.v;
      level = step.amplifier;
      clearOurs(player, "slow_falling");
    } else {
      // sliding down: slow falling, braked by a tick of levitation when faster than a ladder
      if (!foreign(player, "slow_falling")) grant(player, "slow_falling", 0);
      if (last && brakes(y - last.y, CLIMB.downSpeed / 20)) level = 0;
    }
    climbing.set(player.id, { player, v, y });
    clearOurs(player, "levitation"); // a lower level would not replace a higher one still running
    if (level !== undefined) grant(player, "levitation", level);
  } catch {
    leaveRope(player.id); // player gone this tick
  }
}

function tickClimbers() {
  for (const { player } of climbing.values()) updateClimber(player);
  syncClimbingTimer();
}

export function startRopeClimbing() {
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      if (climbing.has(player.id)) continue;
      if (inRope(player)) updateClimber(player);
    }
    syncClimbingTimer();
  }, ENTRY_TICKS);
  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    leaveRope(playerId);
    syncClimbingTimer();
  });
}
