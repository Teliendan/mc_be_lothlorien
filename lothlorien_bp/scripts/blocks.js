import { world, system, BlockPermutation, GameMode } from "@minecraft/server";
import { gateFacingAway, overlapsPlate, pairedDoorHinge, PLATE_RELEASE_TICKS } from "./control_rules.js";
import { captureUse, liveUse, readBlock } from "./deferred_use.js";

// Phase 3 custom block components for the Mallorn wood set.
// Stripping logs and merging slabs are world events (see bottom), not block components: a block
// component's onPlayerInteract swallows block placement against that block (logs could not be built on).
//   lothlorien:toggleable {block_state,..} open/close on interact (trapdoor, fence gate)
//   lothlorien:door {block_state,..}       same for the 2-part door, plus hinge choice on placement
//   lothlorien:button {ticks}              press: powered for `ticks`, then released
//   lothlorien:pressure_plate              powered while any entity stands in the block
//   lothlorien:redstone_toggle {..}        trapdoor/gate/door open while powered (edge-detected)

const NS = "lothlorien";

function consumeHeldItem(player, slot) {
  if (player.getGameMode() === GameMode.Creative) return;
  if (slot.amount > 1) slot.amount -= 1;
  else slot.setItem(undefined);
}

function setState(block, name, value) {
  block.setPermutation(block.permutation.withState(name, value));
}

// Same-facing neighboring doors form a pair. Vanilla's solid-neighbour hinge choice is not expressible (owner: cosmetic limit).
const LEFT_OF_FACING = { north: [-1, 0], south: [1, 0], east: [0, -1], west: [0, 1] };

// Two plank sets share these blocks: silver (from logs) and heartwood (from stripped logs).
const WOODS = ["mallorn", "mallorn_heartwood"];
const GATES = new Set(WOODS.map(w => `${NS}:${w}_fence_gate`));
const plateHoldUntil = new Map();
const positionKey = (dimension, location) => `${dimension.id}:${location.x},${location.y},${location.z}`;

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

// Open/close actions, shared by the player components and the wind charge. `params` are the component parameters
// of the block JSON ({ block_state, enable_sound, disable_sound }).
function toggleOpen(block, params, playerLocation) {
  const next = !block.permutation.getState(params.block_state);
  let permutation = block.permutation;
  if (next && block.typeId.endsWith("_fence_gate")) {
    permutation = permutation.withState("minecraft:cardinal_direction",
      gateFacingAway(permutation.getState("minecraft:cardinal_direction"), block.center(), playerLocation));
  }
  block.setPermutation(permutation.withState(params.block_state, next));
  block.dimension.playSound(next ? params.enable_sound : params.disable_sound, block.center());
}

function toggleDoor(block, params) {
  const next = !block.permutation.getState(params.block_state);
  setDoorOpen(block, params.block_state, next);
  const partner = doublePartner(block);
  if (partner) setDoorOpen(partner, params.block_state, next);
  block.dimension.playSound(next ? params.enable_sound : params.disable_sound, block.center());
}

function pressButton(block) {
  if (block.permutation.getState(`${NS}:powered`)) return;
  setState(block, `${NS}:powered`, true);
  block.dimension.playSound("random.wood_click", block.center(), { pitch: 0.6 });
}

// Arrows and tridents keep a wooden button pressed while they stay stuck beside it.
const PRESSERS = new Set(["minecraft:arrow", "minecraft:thrown_trident", `${NS}:galadhrim_arrow`]);
const stuckProjectile = (block) =>
  block.dimension.getEntities({ location: block.center(), maxDistance: 1 }).some((e) => PRESSERS.has(e.typeId));

const components = {
  "lothlorien:toggleable": {
    onPlayerInteract({ block, player }, { params }) { toggleOpen(block, params, player?.location); },
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
    onPlayerInteract({ block }, { params }) { toggleDoor(block, params); },
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
    onPlayerInteract({ block }) { pressButton(block); },
  },
  "lothlorien:button_release": {
    // Powered-only looping native tick (every 30 ticks): no idle callbacks or lost JS timeout after reload.
    // A stuck arrow keeps the button pressed until the next tick finds it gone.
    onTick({ block, dimension }) {
      if (stuckProjectile(block)) return;
      setState(block, `${NS}:powered`, false);
      dimension.playSound("random.wood_click", block.center(), { pitch: 0.5 });
    },
  },

  "lothlorien:pressure_plate": {
    // minecraft:tick polls; the plate has no collision so step events are not relied on.
    onTick({ block, dimension }) {
      const { x, y, z } = block.location;
      const pressed = dimension
        .getEntities({ location: { x, y, z }, volume: { x: 1, y: 0.25, z: 1 }, excludeGameModes: [GameMode.Spectator] })
        .some((e) => overlapsPlate(block.location, e.getAABB()));
      const powered = block.permutation.getState(`${NS}:powered`);
      const key = positionKey(dimension, block.location);
      if (!pressed && powered && system.currentTick < (plateHoldUntil.get(key) ?? 0)) return;
      if (pressed === powered) return;
      if (pressed) plateHoldUntil.set(key, system.currentTick + PLATE_RELEASE_TICKS);
      else plateHoldUntil.delete(key);
      setState(block, `${NS}:powered`, pressed);
      dimension.playSound(pressed ? "click_on.wooden_pressure_plate" : "click_off.wooden_pressure_plate", block.center());
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

// Buttons and plates have no support-loss handling of their own: when a block is broken, drop any
// of ours that were attached to it. A placed or broken block also re-checks the Mallorn gates beside it
// (explosions and pistons are left to the gate's sparse random tick).
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

world.afterEvents.playerPlaceBlock.subscribe(({ block, dimension }) => updateGatesAround(dimension, block.location));
world.afterEvents.playerBreakBlock.subscribe(({ block, dimension }) => {
  updateGatesAround(dimension, block.location);
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

// --- Projectiles: the engine cannot tell our blocks from vanilla ones, so wind charges and arrows are handled here.
// Wind charge = a small explosion that only toggles (vanilla minecraft:explode power 1.2, toggles_blocks): open or
// close Mallorn doors, trapdoors and gates and press buttons within that radius of the impact.
// Arrow/trident: a collisionless button lets the arrow hit the backing block; press the button on the face that was hit.
// The projectile events take no filter, so each handler returns at once for other projectiles.
const FACE_OFFSET = {
  Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0],
};
const WIND_CHARGES = new Set(["minecraft:wind_charge_projectile", "minecraft:breeze_wind_charge_projectile"]);
const WIND_RADIUS = { "minecraft:wind_charge_projectile": 1.2, "minecraft:breeze_wind_charge_projectile": 3 };
const toggleParams = (open, close) => ({ block_state: `${NS}:open`, enable_sound: open, disable_sound: close });
const WIND_TOGGLES = Object.fromEntries(WOODS.flatMap((w) => [
  [`${NS}:${w}_door`, [toggleDoor, toggleParams("open.wooden_door", "close.wooden_door")]],
  [`${NS}:${w}_trapdoor`, [toggleOpen, toggleParams("open.wooden_trapdoor", "close.wooden_trapdoor")]],
  [`${NS}:${w}_fence_gate`, [toggleOpen, toggleParams("open.fence_gate", "close.fence_gate")]],
]));
const BUTTONS = new Set(WOODS.map((w) => `${NS}:${w}_button`));

function windBurst(dimension, at, radius) {
  const reach = (cell, p) => Math.max(cell - p, p - (cell + 1), 0); // distance from the point to the cell's span
  const done = new Set();
  for (let x = Math.floor(at.x - radius); x <= Math.floor(at.x + radius); x++)
    for (let y = Math.floor(at.y - radius); y <= Math.floor(at.y + radius); y++)
      for (let z = Math.floor(at.z - radius); z <= Math.floor(at.z + radius); z++) {
        if (Math.hypot(reach(x, at.x), reach(y, at.y), reach(z, at.z)) > radius) continue;
        const block = readBlock(dimension, { x, y, z });
        if (!block) continue;
        if (BUTTONS.has(block.typeId)) { pressButton(block); continue; }
        const toggle = WIND_TOGGLES[block.typeId];
        if (!toggle) continue;
        // a door is two blocks (and may have a partner): toggle it once
        const base = block.typeId.endsWith("_door") ? block.getParts()[0].location : block.location;
        const key = `${base.x},${base.y},${base.z}`;
        if (done.has(key)) continue;
        done.add(key);
        if (block.typeId.endsWith("_door")) {
          const partner = doublePartner(block);
          if (partner) {
            const p = partner.getParts()[0].location;
            done.add(`${p.x},${p.y},${p.z}`);
          }
        }
        toggle[0](block, toggle[1]);
      }
}

const FACE_NAME = { Up: "up", Down: "down", North: "north", South: "south", East: "east", West: "west" };
function pressStruckButton({ block, face, faceLocation }) {
  const [dx, dy, dz] = FACE_OFFSET[face], { x, y, z } = block.location;
  const button = readBlock(block.dimension, { x: x + dx, y: y + dy, z: z + dz });
  if (!BUTTONS.has(button?.typeId) || button.permutation.getState("minecraft:block_face") !== FACE_NAME[face]) return;
  // the button covers the middle of the face (its 6 x 4 px footprint, either way round)
  const u = face === "East" || face === "West" ? faceLocation.z : faceLocation.x;
  const v = face === "Up" || face === "Down" ? faceLocation.z : faceLocation.y;
  if (Math.abs(u - 0.5) <= 3 / 16 && Math.abs(v - 0.5) <= 3 / 16) pressButton(button);
}

world.afterEvents.projectileHitBlock.subscribe((event) => {
  // Native wind bursts remove their projectile on impact. typeId remains readable
  // after removal (API 2.8); use the event location/dimension for the burst.
  const id = event.projectile.typeId;
  if (WIND_CHARGES.has(id)) windBurst(event.dimension, event.location, WIND_RADIUS[id]);
  else if (PRESSERS.has(id)) pressStruckButton(event.getBlockHit());
});
world.afterEvents.projectileHitEntity.subscribe((event) => {
  const id = event.projectile.typeId;
  if (WIND_CHARGES.has(id)) windBurst(event.dimension, event.location, WIND_RADIUS[id]);
});

// --- Axe strips logs/wood; slabs merge. Done as world events so ordinary placement against these
// blocks is untouched. Adventure players are left to the engine (it enforces CanPlaceOn/CanDestroy).
const STRIPPED = {
  [`${NS}:mallorn_log`]: `${NS}:mallorn_stripped_log`,
  [`${NS}:mallorn_wood`]: `${NS}:mallorn_stripped_wood`,
};
const DOUBLE_SLAB = Object.fromEntries(WOODS.map((w) => [`${NS}:${w}_slab`, `${NS}:${w}_double_slab`]));

const VANILLA_AXES = new Set(["wooden", "stone", "copper", "iron", "golden", "diamond", "netherite"]
  .map(material => `minecraft:${material}_axe`));
const isAxe = item => VANILLA_AXES.has(item.typeId) || item.hasTag("minecraft:is_axe");

// Calculate all wear before changing the block. Native axes use a fixed damage chance; a tagged
// custom axe with a nonconstant chance range still needs engine comparison (docs/parity/BLOCKS_ITEMS.md).
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

function mergeSlab(target, double, player, itemStack) {
  const use = captureUse(target, itemStack);
  system.run(() => {
    const live = liveUse(use, player);
    if (!live) return;
    live.block.setPermutation(BlockPermutation.resolve(double));
    consumeHeldItem(player, live.slot);
    live.block.dimension.playSound("dig.wood", live.block.center(), { pitch: 0.8 });
  });
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { block, player, itemStack, blockFace, faceLocation } = event;
  if (!itemStack || player.getGameMode() === GameMode.Adventure) return;

  const stripped = STRIPPED[block.typeId];
  if (stripped && isAxe(itemStack)) {
    event.cancel = true;
    if (!event.isFirstEvent) return;
    const use = captureUse(block, itemStack);
    system.run(() => {
      const live = liveUse(use, player);
      if (!live) return;
      const wear = toolWear(player, live.slot.getItem());
      const face = live.block.permutation.getState("minecraft:block_face");
      live.block.setPermutation(
        BlockPermutation.resolve(stripped, face === undefined ? {} : { "minecraft:block_face": face })
      );
      if (wear) live.slot.setItem(wear.item);
      live.block.dimension.playSound("use.wood", live.block.center(), { pitch: 0.8 });
      if (wear?.broken) player.playSound("random.break");
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
      if (event.isFirstEvent) mergeSlab(block, double, player, itemStack);
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
    if (event.isFirstEvent) mergeSlab(target, double, player, itemStack);
  }
});
