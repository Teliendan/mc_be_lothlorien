import { world, system, BlockPermutation, GameMode, EquipmentSlot } from "@minecraft/server";
import { makeRandom, buildSmallMallorn, buildBigMallorn } from "./mallorn_tree.js";
import { repeatedUse } from "./use_guard.js";
import { hangBloom } from "./nectar.js";
import { treeBloomCount } from "./nectar_rules.js";
import { TREE_WOOD, TREE_LEAVES, readTreeBlock, validSaplingSoil, saplingSoil, saplingLight } from "./tree_interaction_rules.js";

// Phase 4: Mallorn sapling growth, bone meal, leaf decay, and the tree balance instruments.
//   lothlorien:sapling  random tick: stage 0 -> 1 -> grows a small Mallorn (needs light and room);
//                       four saplings in a 2x2 square grow one big Mallorn with a 2x2 trunk
//   lothlorien:leaves   places as persistent (player-placed never decays); random tick: leaves with no
//                       supported tree log/wood within LEAF_REACH steps through leaves break, with drops
// Tree shape: mallorn_tree.js. Balance: `node tests/tree_stats.mjs`. In-game helpers (grow, treecount,
// treestats) live in tools/dev_scripts/, not in the pack.

const NS = "lothlorien";
const LEAVES = `${NS}:mallorn_leaves`;
const LOG = `${NS}:mallorn_log`;
const SAPLING = `${NS}:mallorn_sapling`;
const PERSISTENT = `${NS}:persistent`;
const STAGE = `${NS}:stage`;

const GROW_CHANCE = 1 / 7; // per random tick and stage, like vanilla saplings
const MIN_LIGHT = 9;
const BONE_MEAL_CHANCE = 0.45;
const LEAF_REACH = 10;
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const SOFT_PLANTS = new Set(["minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:snow_layer", SAPLING]);
const growing = new Set();
const positionKey = (dimension, p) => `${dimension.id}|${p.x},${p.y},${p.z}`;

// --- growth ---------------------------------------------------------------------------------

function replaceable(block, allowLeaves) {
  if (!block) return false;
  if (block.isAir || SOFT_PLANTS.has(block.typeId)) return true;
  return allowLeaves && TREE_LEAVES.has(block.typeId);
}

// Grows a Mallorn whose base cell is `base`: the sapling for a small tree, the north-west sapling of a 2x2
// group for a big one. Returns false, changing nothing, when the trunk has no room or a chunk is unloaded.
// Placement is spread over ticks (a big tree is ~1600 blocks).
export function growTree(base, seed, big = false) {
  if (base?.typeId !== SAPLING) return false;
  const build = big ? buildBigMallorn : buildSmallMallorn;
  const tree = build(makeRandom(seed ?? Math.floor(Math.random() * 4294967296)));
  const dim = base.dimension;
  const { x, y, z } = base.location;
  const at = (c) => readTreeBlock(dim, { x: x + c.x, y: y + c.y, z: z + c.z });
  const saplings = (big ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]])
    .map(([dx, dz]) => at({ x: dx, y: 0, z: dz }));
  if (saplings.some(b => b?.typeId !== SAPLING || !validSaplingSoil(b) || growing.has(positionKey(dim, b.location)))) return false;
  const snapshots = saplings.map(b => ({ location: { ...b.location }, permutation: b.permutation }));

  for (const c of tree.logs) {
    const trunk = c.face === "up" && c.x >= 0 && c.x <= 1 && c.z >= 0 && c.z <= 1;
    if (trunk && !replaceable(at(c), true)) return false;
  }
  const leaf = BlockPermutation.resolve(LEAVES, { [PERSISTENT]: false });
  for (const b of saplings) growing.add(positionKey(dim, b.location));
  const job = (function* () {
    try {
      // A job starts later: do not grow from a removed/replaced sapling or changed soil.
      if (snapshots.some(s => {
        const b = readTreeBlock(dim, s.location);
        return b?.typeId !== SAPLING || !s.permutation.matches(b.typeId, b.permutation.getAllStates()) || !validSaplingSoil(b);
      })) return;
      for (const c of tree.logs) {
        const trunk = c.face === "up" && c.x >= 0 && c.x <= 1 && c.z >= 0 && c.z <= 1;
        if (trunk && !replaceable(at(c), true)) return;
      }
      for (const b of saplings) {
        const soil = saplingSoil(b);
        if (soil?.typeId === "minecraft:grass_block") soil.setPermutation(BlockPermutation.resolve("minecraft:dirt"));
      }
      // Commit the small trunk/branch pass before yielding; then only fill currently free canopy cells.
      for (const c of tree.logs) {
        const b = at(c);
        if (b && replaceable(b, true)) b.setPermutation(BlockPermutation.resolve(LOG, { "minecraft:block_face": c.face }));
      }
      let n = 0;
      for (const c of tree.leaves) {
        const b = at(c);
        if (b && replaceable(b, false) && b.typeId !== LEAVES) b.setPermutation(leaf);
        if (++n % 200 === 0) yield;
      }
      // nectar blooms hang under the crown (natural trees get full ones from worldgen, a grown tree starts dry)
      for (let tries = 0, left = treeBloomCount(Math.random()); left > 0 && tries < 40 && tree.leaves.length; tries++) {
        const c = tree.leaves[Math.floor(Math.random() * tree.leaves.length)];
        if (hangBloom(at({ x: c.x, y: c.y - 1, z: c.z }))) left--;
      }
    } finally {
      for (const s of snapshots) growing.delete(positionKey(dim, s.location));
    }
  })();
  try { system.runJob(job); }
  catch {
    for (const s of snapshots) growing.delete(positionKey(dim, s.location));
    return false;
  }
  return true;
}

// The north-west cell of a 2x2 group of saplings that includes `block`, if there is one.
function bigGroupOrigin(block) {
  const { x, y, z } = block.location;
  for (const ox of [0, -1]) {
    for (const oz of [0, -1]) {
      let all = true;
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (readTreeBlock(block.dimension, { x: x + ox + dx, y, z: z + oz + dz })?.typeId !== SAPLING) all = false;
      }
      if (all) return readTreeBlock(block.dimension, { x: x + ox, y, z: z + oz });
    }
  }
  return undefined;
}

function advance(block) {
  if (!validSaplingSoil(block) || growing.has(positionKey(block.dimension, block.location))) return;
  if (block.permutation.getState(STAGE) === 0) {
    block.setPermutation(block.permutation.withState(STAGE, 1));
    return;
  }
  const origin = bigGroupOrigin(block);
  if (origin) growTree(origin, undefined, true);
  else growTree(block);
}

// --- leaf decay -----------------------------------------------------------------------------

// Breadth-first through recognized vanilla/Mallorn leaves; unloaded neighbours count as connected so a chunk edge never
// strips a tree, and so does a search that grows past MAX_NODES. Big crowns put leaves 8+ steps from
// the nearest log, hence the long reach. Every leaf on the path to the log found is remembered as
// connected for CONNECTED_TTL ticks: without that, each random tick on an inner leaf costs hundreds of
// getBlock calls, and a forest ticks thousands of leaves a second.
const MAX_NODES = 4000;
const CONNECTED_TTL = 1200;
const connectedUntil = new Map();
let lastPrune = 0;

function connectedToWood(start) {
  const dim = start.dimension;
  const now = system.currentTick;
  if (now - lastPrune > 6000) {
    lastPrune = now;
    for (const [k, t] of connectedUntil) if (t <= now) connectedUntil.delete(k);
  }
  const keyOf = (p) => `${dim.id}|${p.x},${p.y},${p.z}`;
  const startKey = keyOf(start.location);
  if ((connectedUntil.get(startKey) ?? 0) > now) return true;

  const parent = new Map([[startKey, undefined]]);
  const markPath = (k) => {
    for (; k !== undefined; k = parent.get(k)) connectedUntil.set(k, now + CONNECTED_TTL);
  };
  let frontier = [start.location];
  let nodes = 0;
  for (let step = 0; step < LEAF_REACH; step++) {
    const next = [];
    for (const p of frontier) {
      const pk = keyOf(p);
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const q = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
        const k = keyOf(q);
        if (parent.has(k)) continue;
        parent.set(k, pk);
        if (++nodes > MAX_NODES) return true;
        const b = readTreeBlock(dim, q);
        if (!b) return true;
        if (TREE_WOOD.has(b.typeId)) {
          markPath(pk);
          return true;
        }
        if (TREE_LEAVES.has(b.typeId)) next.push(q);
      }
    }
    if (next.length === 0) return false;
    frontier = next;
  }
  return false;
}

// --- components -----------------------------------------------------------------------------

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent("lothlorien:sapling", {
    onRandomTick({ block }) {
      if (Math.random() >= GROW_CHANCE || saplingLight(block) < MIN_LIGHT) return;
      advance(block);
    },
  });
  blockComponentRegistry.registerCustomComponent("lothlorien:leaves", {
    beforeOnPlayerPlace(event) {
      event.permutationToPlace = event.permutationToPlace.withState(PERSISTENT, true);
    },
    onRandomTick({ block, dimension }) {
      if (block.permutation.getState(PERSISTENT) || connectedToWood(block)) return;
      const { x, y, z } = block.location;
      dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
    },
  });
});

// --- bone meal ------------------------------------------------------------------------------

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (block.typeId !== SAPLING || itemStack?.typeId !== "minecraft:bone_meal") return;
  const { location, dimension } = block;
  // read-only in the before event: cancel, then do the work next tick
  event.cancel = true;
  if (repeatedUse(player, "sapling")) return;
  const held = itemStack.clone(), index = player.selectedSlotIndex, mode = player.getGameMode();
  const target = block.permutation;
  system.run(() => {
    // A queued use can outlive its player. Validate every entity/slot read before any mutation.
    let b, slot;
    try {
      b = readTreeBlock(dimension, location);
      if (b?.typeId !== SAPLING || !target.matches(b.typeId, b.permutation.getAllStates()) || !validSaplingSoil(b) ||
          growing.has(positionKey(dimension, location)) || player.selectedSlotIndex !== index || player.getGameMode() !== mode) return;
      slot = player.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
      const current = slot?.getItem();
      if (!current || current.typeId !== held.typeId || current.amount !== held.amount || !current.isStackableWith(held)) return;
      const origin = bigGroupOrigin(b);
      if (origin) {
        const { x, y, z } = origin.location;
        for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const member = readTreeBlock(dimension, { x: x + dx, y, z: z + dz });
          if (!member || !validSaplingSoil(member)) return;
        }
      }
    } catch { return; }
    if (mode !== GameMode.Creative) {
      if (slot.amount > 1) slot.amount -= 1;
      else slot.setItem(undefined);
    }
    if (Math.random() < BONE_MEAL_CHANCE) advance(b);
    try { dimension.spawnParticle("minecraft:crop_growth_emitter", { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 }); }
    catch { /* A cosmetic particle failure must not prevent the completed growth step. */ }
  });
});
