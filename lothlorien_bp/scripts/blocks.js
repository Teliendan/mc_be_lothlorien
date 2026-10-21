import { world, system, BlockPermutation, EquipmentSlot, GameMode } from "@minecraft/server";
import { gateFacingAway, overlapsPlate, pairedDoorHinge, PLATE_RELEASE_TICKS } from "./control_rules.js";

// Phase 3 custom block components for the Mallorn wood set.
// Stripping logs and merging slabs are world events (see bottom), not block components: a block
// component's onPlayerInteract swallows block placement against that block (logs could not be built on).
//   lothlorien:toggleable {block_state,..} open/close on interact (trapdoor, fence gate)
//   lothlorien:door {block_state,..}       same for the 2-part door, plus hinge choice on placement
//   lothlorien:button {ticks}              press: powered for `ticks`, then released
//   lothlorien:pressure_plate              powered while any entity stands in the block
//   lothlorien:redstone_toggle {..}        trapdoor/gate/door open while powered (edge-detected)

const NS = "lothlorien";
const CLICK = "random.click";

function mainhand(player) {
  return player?.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand);
}

function consumeHeldItem(player, slot) {
  if (player.getGameMode() === GameMode.Creative) return;
  if (!slot?.hasItem()) return;
  if (slot.amount > 1) slot.amount -= 1;
  else slot.setItem(undefined);
}

function setState(block, name, value) {
  block.setPermutation(block.permutation.withState(name, value));
}

// Same-facing neighboring doors form a pair. Full solid-face hinge selection remains open.
const LEFT_OF_FACING = { north: [-1, 0], south: [1, 0], east: [0, -1], west: [0, 1] };

// Two plank sets share these blocks: silver (from logs) and heartwood (from stripped logs).
const WOODS = ["mallorn", "mallorn_heartwood"];
const GATES = new Set(WOODS.map(w => `${NS}:${w}_fence_gate`));
const plateHoldUntil = new Map();
const positionKey = (dimension, location) => `${dimension.id}:${location.x},${location.y},${location.z}`;
const readBlock = (dimension, position) => {
  try { return dimension.getBlock(position); } catch { return undefined; }
};

function updateGateWall(block) {
  if (!block || !GATES.has(block.typeId)) return;
  const { x, y, z } = block.location;
  const facing = block.permutation.getState("minecraft:cardinal_direction");
  const offsets = facing === "north" || facing === "south" ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
  const neighbors = offsets.map(([dx, dz]) => readBlock(block.dimension, { x: x + dx, y, z: z + dz }));
  // Preserve the stored state across an unloaded border rather than guessing absence.
  if (neighbors.some(n => !n)) return;
  const inWall = neighbors.some(n => n.typeId.startsWith("minecraft:") && n.typeId.endsWith("_wall"));
  if (inWall !== block.permutation.getState(`${NS}:in_wall`)) setState(block, `${NS}:in_wall`, inWall);
}

function updateGatesAround(dimension, location) {
  const { x, y, z } = location;
  for (const [dx, dz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    updateGateWall(readBlock(dimension, { x: x + dx, y, z: z + dz }));
  }
}

function setDoorOpen(block, openState, value) {
  for (const part of block.getParts()) setState(part, openState, value);
}

// The other half of a double door: the neighbouring door with the same facing and opposite hinge,
// on the side the hinge is not. Opening one opens both: owner-approved custom convenience.
function doublePartner(block) {
  const perm = block.permutation;
  const left = LEFT_OF_FACING[perm.getState("minecraft:cardinal_direction")];
  if (!left) return undefined;
  const hingeRight = perm.getState(`${NS}:hinge_right`);
  const sign = hingeRight ? 1 : -1; // hinge right: partner is on the left
  const bottom = block.getParts()[0];
  const { x, y, z } = bottom.location;
  const other = block.dimension.getBlock({ x: x + sign * left[0], y, z: z + sign * left[1] });
  if (other?.typeId !== block.typeId) return undefined;
  const p = other.permutation;
  const same = p.getState("minecraft:cardinal_direction") === perm.getState("minecraft:cardinal_direction");
  return same && p.getState(`${NS}:hinge_right`) !== hingeRight ? other : undefined;
}

const components = {
  "lothlorien:toggleable": {
    onPlayerInteract({ block, dimension, player }, { params }) {
      const next = !block.permutation.getState(params.block_state);
      let permutation = block.permutation;
      if (next && block.typeId.endsWith("_fence_gate")) {
        permutation = permutation.withState("minecraft:cardinal_direction",
          gateFacingAway(permutation.getState("minecraft:cardinal_direction"), block.center(), player?.location));
      }
      block.setPermutation(permutation.withState(params.block_state, next));
      dimension.playSound(next ? params.enable_sound : params.disable_sound, block.center());
    },
  },

  "lothlorien:gate_wall": {
    onPlace({ block }) { updateGateWall(block); },
    onRandomTick({ block }) { updateGateWall(block); },
  },

  "lothlorien:door": {
    beforeOnPlayerPlace(event) {
      const perm = event.permutationToPlace;
      const facing = perm.getState("minecraft:cardinal_direction");
      const left = LEFT_OF_FACING[facing];
      if (!left) return;
      const { x, y, z } = event.block.location;
      const leftBlock = event.block.dimension.getBlock({ x: x + left[0], y, z: z + left[1] });
      const rightBlock = event.block.dimension.getBlock({ x: x - left[0], y, z: z - left[1] });
      event.permutationToPlace = perm.withState(`${NS}:hinge_right`,
        pairedDoorHinge(facing, perm.type.id, leftBlock, rightBlock));
    },
    onPlayerInteract({ block, dimension }, { params }) {
      const next = !block.permutation.getState(params.block_state);
      setDoorOpen(block, params.block_state, next);
      const partner = doublePartner(block);
      if (partner) setDoorOpen(partner, params.block_state, next);
      dimension.playSound(next ? params.enable_sound : params.disable_sound, block.center());
    },
  },

  // Redstone opening. The engine also sends redstone updates on placement and chunk load, so the
  // block stores the last power state it acted on and only reacts to a real change; open follows power.
  "lothlorien:redstone_toggle": {
    onRedstoneUpdate({ block, dimension, powerLevel }, { params }) {
      const parts = block.getParts?.() ?? [block];
      const powered = Math.max(powerLevel, ...parts.map((p) => p.getRedstonePower() ?? 0)) > 0;
      if (powered === block.permutation.getState(params.powered_state)) return;
      for (const part of parts) {
        part.setPermutation(
          part.permutation.withState(params.powered_state, powered).withState(params.open_state, powered)
        );
      }
      dimension.playSound(powered ? params.enable_sound : params.disable_sound, block.center());
    },
  },

  "lothlorien:button": {
    onPlayerInteract({ block, dimension }) {
      if (block.permutation.getState(`${NS}:powered`)) return;
      setState(block, `${NS}:powered`, true);
      dimension.playSound(CLICK, block.center(), { pitch: 0.6 });
    },
  },
  "lothlorien:button_release": {
    // Powered-only native scheduled tick: no idle callbacks or lost JS timeout after reload.
    // Native tick scheduling/persistence still needs the engine comparison in CONTROL_INTERACTIONS.md.
    onTick({ block, dimension }) {
      if (!block.permutation.getState(`${NS}:powered`)) return;
      setState(block, `${NS}:powered`, false);
      dimension.playSound(CLICK, block.center(), { pitch: 0.5 });
    },
  },

  "lothlorien:pressure_plate": {
    // minecraft:tick polls; the plate has no collision so step events are not relied on.
    onTick({ block, dimension }) {
      const { x, y, z } = block.location;
      const pressed = dimension
        .getEntities({ location: { x, y, z }, volume: { x: 1, y: 0.25, z: 1 } })
        .some((e) => {
          try {
            if (e.typeId === "minecraft:player" && e.getGameMode() === GameMode.Spectator) return false;
            return overlapsPlate(block.location, e.getAABB());
          } catch { return false; } // entity removed during query
        });
      const powered = block.permutation.getState(`${NS}:powered`);
      const key = positionKey(dimension, block.location);
      if (!pressed && powered && system.currentTick < (plateHoldUntil.get(key) ?? 0)) return;
      if (pressed === powered) return;
      if (pressed) {
        const deadline = system.currentTick + PLATE_RELEASE_TICKS;
        plateHoldUntil.set(key, deadline);
        // Finite bookkeeping cleanup, including plates removed/unloaded while active.
        system.runTimeout(() => {
          if (plateHoldUntil.get(key) === deadline) plateHoldUntil.delete(key);
        }, PLATE_RELEASE_TICKS);
      } else plateHoldUntil.delete(key);
      setState(block, `${NS}:powered`, pressed);
      dimension.playSound(CLICK, block.center(), { pitch: pressed ? 0.8 : 0.7 });
    },
  },
};

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  // literal ids, so the workspace verifier can match them against the block JSON
  blockComponentRegistry.registerCustomComponent("lothlorien:toggleable", components["lothlorien:toggleable"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:door", components["lothlorien:door"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:redstone_toggle", components["lothlorien:redstone_toggle"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:button", components["lothlorien:button"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:button_release", components["lothlorien:button_release"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:pressure_plate", components["lothlorien:pressure_plate"]);
  blockComponentRegistry.registerCustomComponent("lothlorien:gate_wall", components["lothlorien:gate_wall"]);
});

// Local wall edits wake only neighboring gates. Commands/reload use sparse random fallback.
world.afterEvents.playerPlaceBlock.subscribe(({ block, dimension }) => updateGatesAround(dimension, block.location));
world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => updateGatesAround(dimension, block.location));
world.afterEvents.blockExplode.subscribe(({ block, dimension }) => updateGatesAround(dimension, block.location));
world.afterEvents.pistonActivate.subscribe(event => {
  try {
    const positions = event.piston.getAttachedBlocks().map(block => ({ ...block.location }));
    // Probe source and destination neighbors after the finite movement has settled.
    const axes = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
    const axis = axes[event.block.permutation.getState("facing_direction")];
    if (!axis) return;
    for (const delay of [1, 8]) system.runTimeout(() => {
      for (const position of positions) {
        updateGatesAround(event.dimension, position);
        for (const sign of [-1, 1]) updateGatesAround(event.dimension, {
          x: position.x + sign * axis[0], y: position.y + sign * axis[1], z: position.z + sign * axis[2],
        });
      }
    }, delay);
  } catch { /* unloaded piston; sparse gate fallback remains */ }
});

// Buttons and plates have no support-loss handling of their own: when a block is broken, drop any
// of ours that were attached to it.
const PLATE_SUPPORT = () => [0, -1, 0];
const BUTTON_SUPPORT = (perm) =>
  ({ up: [0, -1, 0], down: [0, 1, 0], north: [0, 0, 1], south: [0, 0, -1], west: [1, 0, 0], east: [-1, 0, 0] })[
    perm.getState("minecraft:block_face")
  ];
const ATTACHED_TO = Object.fromEntries(
  WOODS.flatMap((w) => [
    [`${NS}:${w}_pressure_plate`, PLATE_SUPPORT],
    [`${NS}:${w}_button`, BUTTON_SUPPORT],
  ])
);
const NEIGHBOURS = [
  [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
];

world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => {
  const { x, y, z } = block.location;
  for (const [dx, dy, dz] of NEIGHBOURS) {
    const n = dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
    const attached = n && ATTACHED_TO[n.typeId]?.(n.permutation);
    if (!attached) continue;
    if (n.location.x + attached[0] === x && n.location.y + attached[1] === y && n.location.z + attached[2] === z) {
      dimension.runCommand(`setblock ${n.location.x} ${n.location.y} ${n.location.z} air destroy`);
    }
  }
});

// --- Axe strips logs/wood; slabs merge. Done as world events so ordinary placement against these
// blocks is untouched.
const STRIPPED = {
  [`${NS}:mallorn_log`]: `${NS}:mallorn_stripped_log`,
  [`${NS}:mallorn_wood`]: `${NS}:mallorn_stripped_wood`,
};
const DOUBLE_SLAB = Object.fromEntries(WOODS.map((w) => [`${NS}:${w}_slab`, `${NS}:${w}_double_slab`]));
const FACE_OFFSET = {
  Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0],
};

const VANILLA_AXES = new Set(["wooden", "stone", "copper", "iron", "golden", "diamond", "netherite"]
  .map(material => `minecraft:${material}_axe`));
const isAxe = item => VANILLA_AXES.has(item.typeId) || item.hasTag("minecraft:is_axe");

// Non-stackable tools always return false from ItemStack.isStackableWith. Compare their exposed
// mutable data instead; stackable slab items additionally use the engine's metadata comparison.
function heldData(item) {
  const durability = item.getComponent("durability");
  return JSON.stringify({
    type: item.typeId, amount: item.amount, name: item.nameTag, keep: item.keepOnDeath, lock: item.lockMode,
    lore: item.getRawLore(), place: item.getCanPlaceOn(), destroy: item.getCanDestroy(),
    dynamic: item.getDynamicPropertyIds().sort().map(id => [id, item.getDynamicProperty(id)]),
    enchantments: (item.getComponent("enchantable")?.getEnchantments() ?? [])
      .map(e => [e.type.id, e.level]).sort((a, b) => a[0].localeCompare(b[0])),
    durability: durability && [durability.damage, durability.maxDurability, durability.unbreakable],
  });
}

function heldSnapshot(player, item) {
  return { index: player.selectedSlotIndex, item: item.clone(), data: heldData(item), mode: player.getGameMode() };
}

function originalHand(player, held, stackable) {
  if (player.selectedSlotIndex !== held.index || player.getGameMode() !== held.mode) return undefined;
  const slot = mainhand(player), item = slot?.getItem();
  if (!item || heldData(item) !== held.data || (stackable && !item.isStackableWith(held.item))) return undefined;
  return { slot, item };
}

function blockSnapshot(block) {
  return { dimension: block.dimension, location: { ...block.location }, permutation: block.permutation,
    water: block.isWaterlogged };
}

function originalBlock(snapshot) {
  const block = readBlock(snapshot.dimension, snapshot.location);
  return block?.typeId === snapshot.permutation.type.id && block.isWaterlogged === snapshot.water &&
    snapshot.permutation.matches(block.typeId, block.permutation.getAllStates()) ? block : undefined;
}

// Calculate all wear before changing the block. Native axes use a fixed damage chance; a tagged
// custom axe with a nonconstant chance range still needs engine comparison (WOOD_INTERACTIONS.md).
function toolWear(player, item) {
  if (player.getGameMode() === GameMode.Creative) return undefined;
  const durability = item.getComponent("durability");
  if (!durability || durability.unbreakable) return undefined;
  const level = Math.min(3, Math.max(0, item.getComponent("enchantable")?.getEnchantment("unbreaking")?.level ?? 0));
  const chance = durability.getDamageChance(level);
  if (Math.random() * 100 >= chance) return undefined;
  // Bedrock tools retain a zero-remaining-durability use; the API cannot store damage > maximum.
  if (durability.damage >= durability.maxDurability) return { item: undefined, broken: true };
  durability.damage += 1;
  return { item, broken: false };
}

function mergeSlab(target, double, player, held) {
  const snapshot = blockSnapshot(target);
  system.run(() => {
    try {
      const current = originalBlock(snapshot), hand = originalHand(player, held, true);
      if (!current || !hand) return;
      current.setPermutation(BlockPermutation.resolve(double));
      consumeHeldItem(player, hand.slot);
      current.dimension.playSound("use.wood", current.center(), { pitch: 0.8 });
    } catch { /* unloaded block or departed player: no further mutation */ }
  });
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack, blockFace, faceLocation } = event;
  if (!itemStack) return;

  const stripped = STRIPPED[block.typeId];
  if (stripped && isAxe(itemStack)) {
    const snapshot = blockSnapshot(block), held = heldSnapshot(player, itemStack);
    event.cancel = true;
    system.run(() => {
      try {
        const current = originalBlock(snapshot), hand = originalHand(player, held, false);
        if (!current || !hand) return;
        const wear = toolWear(player, hand.item);
        const face = current.permutation.getState("minecraft:block_face");
        current.setPermutation(
          BlockPermutation.resolve(stripped, face === undefined ? {} : { "minecraft:block_face": face })
        );
        if (wear) hand.slot.setItem(wear.item);
        current.dimension.playSound("use.wood", current.center(), { pitch: 0.8 });
        if (wear?.broken) player.playSound("random.break");
      } catch { /* unloaded block, departed player or invalid tool data: abandon the queued action */ }
    });
    return;
  }

  const double = DOUBLE_SLAB[itemStack.typeId];
  if (!double) return;
  const side = blockFace !== "Up" && blockFace !== "Down";

  // 1. Clicking the slab itself: top of a bottom slab, underside of a top slab, or the matching half of a side face.
  if (block.typeId === itemStack.typeId) {
    const half = block.permutation.getState("minecraft:vertical_half");
    const upper = faceLocation.y >= 0.5;
    const merges =
      half === "bottom" ? blockFace === "Up" || (side && upper) : blockFace === "Down" || (side && !upper);
    if (merges) {
      event.cancel = true;
      mergeSlab(block, double, player, heldSnapshot(player, itemStack));
    }
    return;
  }

  // 2. Clicking a neighbouring block whose face points into a cell that already holds a slab: the
  //    new slab would take the half chosen by the click; if that half is empty, merge.
  const offset = FACE_OFFSET[blockFace];
  if (!offset) return;
  const [dx, dy, dz] = offset;
  const { x, y, z } = block.location;
  const target = block.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
  if (target?.typeId !== itemStack.typeId) return;
  const wanted = blockFace === "Up" ? "bottom" : blockFace === "Down" ? "top" : faceLocation.y >= 0.5 ? "top" : "bottom";
  if (wanted !== target.permutation.getState("minecraft:vertical_half")) {
    event.cancel = true;
    mergeSlab(target, double, player, heldSnapshot(player, itemStack));
  }
});
