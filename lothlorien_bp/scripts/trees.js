import { world, system, BlockPermutation, GameMode } from "@minecraft/server";
import { makeRandom, buildSmallMallorn, buildBigMallorn } from "./mallorn_tree.js";
import { captureUse, liveUse } from "./deferred_use.js";
import { hangBloom } from "./nectar.js";
import { treeBloomCount } from "./nectar_rules.js";
import { TREE_WOOD, TREE_LEAVES, readTreeBlock, validSaplingSoil, saplingSoil, saplingLight } from "./tree_interaction_rules.js";
import { findDecay, BATCH_SPAN, OTHER, LEAF, DECAYABLE, WOOD, UNKNOWN } from "./leaf_decay.js";

// Phase 4: Mallorn sapling growth, bone meal, leaf decay, and the tree balance instruments.
//   lothlorien:sapling  random tick: stage 0 -> 1 -> grows a small Mallorn (needs light and room);
//                       four saplings in a 2x2 square grow one big Mallorn with a 2x2 trunk
//   lothlorien:leaves   places as persistent (player-placed never decays); natural leaves with no tree log/wood
//                       within LEAF_REACH steps through leaves break, with drops, after a neighbouring log, wood
//                       or leaf is destroyed (leaf_decay.js; no random tick)
//   lothlorien:tree_part  onBreak on Mallorn logs, wood and golden leaves: starts that check
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

  for (const c of tree.logs) {
    const trunk = c.face === "up" && c.x >= 0 && c.x <= 1 && c.z >= 0 && c.z <= 1;
    if (trunk && !replaceable(at(c), true)) return false;
  }
  const leaf = BlockPermutation.resolve(LEAVES, { [PERSISTENT]: false });
  for (const b of saplings) growing.add(positionKey(dim, b.location));
  const job = (function* () {
    try {
      // A job starts later: do not grow from a removed sapling or changed soil.
      if (saplings.some(b => {
        const now = readTreeBlock(dim, b.location);
        return now?.typeId !== SAPLING || !validSaplingSoil(now);
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
      for (const b of saplings) growing.delete(positionKey(dim, b.location));
    }
  })();
  try { system.runJob(job); }
  catch {
    for (const b of saplings) growing.delete(positionKey(dim, b.location));
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

// Event-driven (owner 2026-11-08, rules in leaf_decay.js): natural leaves re-check only when a log, wood or leaf next to
// them is destroyed. Mallorn wood and leaves report it through onBreak (any cause the engine calls a destruction:
// players, explosions, popping); vanilla wood and leaves through the player-break and explosion events. Leaves have no
// random tick any more, so a standing forest runs no script. Not covered: wood moved by a piston, /setblock or /fill
// without `destroy` (nothing is destroyed), until a neighbouring log or leaf breaks.
// One search job runs at a time and takes the reported cells of a dimension near the first one; decaying leaves break
// (with drops) a few at a time over the next seconds, like vanilla.
const DECAY_DELAY_TICKS = 10, DECAY_SPREAD_TICKS = 150, DECAY_PER_TICK = 8, DECAY_FORGET_TICKS = 100;
const VANILLA_TREE_PARTS = [...TREE_WOOD, ...TREE_LEAVES].filter((id) => id.startsWith("minecraft:"));
const VANILLA_TREE_SET = new Set(VANILLA_TREE_PARTS);
const cellKey = (dimId, x, y, z) => `${dimId}|${x},${y},${z}`;
const reported = new Map(); // dimension id -> { dimension, cells: Map(cell key -> {x, y, z}) }
// cell key -> { dimension, x, y, z, at, frontier, brokenAt }: queued by a search, until its own onBreak (or forgotten)
const decaying = new Map();
let searching = false, buckets = new Map(), backlog = [], decayTimer;

function classifyCell(dimension, dimId, x, y, z) {
  const b = readTreeBlock(dimension, { x, y, z });
  if (!b) return UNKNOWN;
  const id = b.typeId;
  if (TREE_WOOD.has(id)) return WOOD;
  if (!TREE_LEAVES.has(id)) return OTHER;
  if (decaying.size && decaying.has(cellKey(dimId, x, y, z))) return OTHER; // already going: counts as gone
  if (id !== LEAVES) return LEAF;
  return b.permutation.getState(PERSISTENT) ? LEAF : DECAYABLE;
}

// A log, wood or leaf at `location` was destroyed: its neighbouring leaves re-check. A leaf our own decay broke is
// already decided, unless the search marked it as a frontier (leaves beyond it were cut off before).
export function treePartDestroyed(dimension, location) {
  const dimId = dimension.id, { x, y, z } = location, key = cellKey(dimId, x, y, z);
  const own = decaying.get(key);
  if (own) {
    decaying.delete(key);
    if (!own.frontier) return;
  }
  let entry = reported.get(dimId);
  if (!entry) reported.set(dimId, entry = { dimension, cells: new Map() });
  entry.cells.set(key, { x, y, z });
  if (searching) return;
  searching = true;
  try { system.runJob(searchJob()); }
  catch { searching = false; }
}

function* searchJob() {
  try {
    while (reported.size) {
      const [dimId, entry] = reported.entries().next().value;
      const origins = [];
      let first;
      for (const [key, p] of entry.cells) {
        first ??= p;
        if (Math.abs(p.x - first.x) > BATCH_SPAN || Math.abs(p.y - first.y) > BATCH_SPAN || Math.abs(p.z - first.z) > BATCH_SPAN) continue;
        origins.push(p);
        entry.cells.delete(key);
      }
      if (!entry.cells.size) reported.delete(dimId);
      const dimension = entry.dimension;
      let found = [];
      try { found = yield* findDecay((x, y, z) => classifyCell(dimension, dimId, x, y, z), origins); }
      catch { found = []; } // the dimension went away mid-search: keep everything
      for (const leaf of found) queueDecay(dimension, dimId, leaf);
    }
  } finally {
    searching = false;
  }
}

function queueDecay(dimension, dimId, { x, y, z, frontier }) {
  const key = cellKey(dimId, x, y, z);
  if (decaying.has(key)) return;
  const at = system.currentTick + DECAY_DELAY_TICKS + Math.floor(Math.random() * DECAY_SPREAD_TICKS);
  const entry = { dimension, x, y, z, key, at, frontier, brokenAt: undefined };
  decaying.set(key, entry);
  let bucket = buckets.get(at);
  if (!bucket) buckets.set(at, bucket = []);
  bucket.push(entry);
  decayTimer ??= system.runInterval(decayTick, 1);
}

function decayTick() {
  const now = system.currentTick;
  for (const [at, bucket] of buckets) {
    if (at > now) continue;
    buckets.delete(at);
    for (const entry of bucket) backlog.push(entry);
  }
  for (const entry of backlog.splice(0, DECAY_PER_TICK)) breakDecayed(entry, now);
  // A broken leaf whose onBreak never came (or a queued one already gone) is forgotten, so its cell counts again.
  for (const [key, entry] of decaying) {
    if (entry.brokenAt !== undefined && now - entry.brokenAt > DECAY_FORGET_TICKS) decaying.delete(key);
  }
  if (!buckets.size && !backlog.length && !decaying.size) {
    system.clearRun(decayTimer);
    decayTimer = undefined;
  }
}

function breakDecayed(entry, now) {
  if (decaying.get(entry.key) !== entry) return; // broken meanwhile by something else
  const b = readTreeBlock(entry.dimension, entry);
  if (b?.typeId !== LEAVES || b.permutation.getState(PERSISTENT)) { decaying.delete(entry.key); return; }
  entry.brokenAt = now;
  try { entry.dimension.runCommand(`setblock ${entry.x} ${entry.y} ${entry.z} air destroy`); }
  catch { decaying.delete(entry.key); }
}

world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => treePartDestroyed(dimension, block.location),
  { blockTypes: VANILLA_TREE_PARTS });
world.afterEvents.blockExplode.subscribe(({ block, dimension, explodedBlockPermutation }) => {
  if (VANILLA_TREE_SET.has(explodedBlockPermutation.type.id)) treePartDestroyed(dimension, block.location);
});

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
    onBreak({ block, dimension }) { treePartDestroyed(dimension, block.location); },
  });
  // Mallorn logs, wood (also stripped) and golden leaves: they carry or support leaves but never decay themselves.
  blockComponentRegistry.registerCustomComponent("lothlorien:tree_part", {
    onBreak({ block, dimension }) { treePartDestroyed(dimension, block.location); },
  });
});

// --- bone meal ------------------------------------------------------------------------------

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack } = event;
  if (block.typeId !== SAPLING || itemStack?.typeId !== "minecraft:bone_meal") return;
  // read-only in the before event: cancel, then do the work next tick
  event.cancel = true;
  if (!event.isFirstEvent) return;
  const use = captureUse(block, itemStack);
  system.run(() => {
    const live = liveUse(use, player);
    if (!live) return;
    if (player.getGameMode() !== GameMode.Creative) {
      if (live.slot.amount > 1) live.slot.amount -= 1;
      else live.slot.setItem(undefined);
    }
    if (Math.random() < BONE_MEAL_CHANCE) advance(live.block);
    const { x, y, z } = live.block.location;
    live.block.dimension.spawnParticle("minecraft:crop_growth_emitter", { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  });
});
