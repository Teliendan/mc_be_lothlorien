// M4: loaded healers bless injured elves (including themselves), wardens and Harmony Friends.
// Two local patient queries per healer per second; no per-tick work or recurring world-wide discovery.
import { system, world } from "@minecraft/server";
import { ELF_ID, PROFESSIONS, spawnEventOf } from "./elf_rules.js";
import {
  HEALER_VARIANT, PATIENT_TYPES, CHECK_TICKS, EFFECT, EFFECT_TICKS, ELF_CARE, FRIEND_CARE,
  BLESSING, injured, inRange, needsRegeneration,
} from "./healer_rules.js";

const loaded = new Map();
let timer;
let bandOf;

function stopIfEmpty() {
  if (!loaded.size && timer !== undefined) {
    system.clearRun(timer);
    timer = undefined;
  }
}

function isHealer(entity) {
  return entity.isValid && entity.typeId === ELF_ID && entity.getComponent("minecraft:variant")?.value === HEALER_VARIANT
    && entity.getComponent("minecraft:health")?.currentValue > 0;
}

function track(entity) {
  try {
    if (isHealer(entity)) {
      loaded.set(entity.id, entity);
      if (timer === undefined) timer = system.runInterval(blessNearby, CHECK_TICKS);
    } else loaded.delete(entity.id);
  } catch { /* entity unloaded before delivery */ }
  stopIfEmpty();
}

function discover(entity) {
  if (entity.typeId !== ELF_ID) return;
  // Spawn/profession events can precede the native variant update. Re-read after it settles.
  system.run(() => track(entity));
}

function visible(healer, patient) {
  if (healer.id === patient.id) return true;
  const from = healer.getHeadLocation(), to = patient.getHeadLocation();
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (!length) return true;
  return !healer.dimension.getBlockFromRay(from, {
    x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length,
  }, { maxDistance: length, includeLiquidBlocks: false, includePassableBlocks: false });
}

function particles(entity) {
  try {
    const p = entity.location;
    entity.dimension.spawnParticle(BLESSING.particle, { x: p.x, y: p.y + BLESSING.particleHeight, z: p.z });
  } catch { /* cosmetic failure must not stop healing */ }
}

function care(healer, patient, rules, renewed) {
  try {
    if (!patient.isValid || renewed.has(patient.id) || patient.dimension.id !== healer.dimension.id
      || !inRange(healer.location, patient.location, rules.radius)
      || !injured(patient.getComponent("minecraft:health"))
      || !needsRegeneration(patient.getEffect(EFFECT), rules.amplifier)
      || !visible(healer, patient)) return false;
    patient.addEffect(EFFECT, EFFECT_TICKS, { amplifier: rules.amplifier, showParticles: false });
    renewed.add(patient.id); // overlapping healers cannot refresh the same patient in this pulse
    particles(patient);
    return true;
  } catch { return false; } // unloaded entity/chunk, including an unreadable sight line: no blessing
}

function blessNearby() {
  const renewed = new Set();
  // Resolve Harmony lazily, once per nearby injured player, shared by overlapping healers.
  const bands = new Map(), players = world.getPlayers();
  for (const [id, healer] of loaded) {
    try {
      if (!isHealer(healer)) { loaded.delete(id); continue; }
      let blessed = care(healer, healer, ELF_CARE, renewed);
      for (const type of PATIENT_TYPES) {
        for (const patient of healer.dimension.getEntities({ type, location: healer.location, maxDistance: ELF_CARE.radius })) {
          if (care(healer, patient, ELF_CARE, renewed)) blessed = true;
        }
      }
      for (const player of players) {
        try {
          if (!player.isValid || player.dimension.id !== healer.dimension.id
            || !inRange(healer.location, player.location, FRIEND_CARE.radius)
            || !injured(player.getComponent("minecraft:health"))) continue;
          if (!bands.has(player.id)) bands.set(player.id, bandOf(player));
          if (bands.get(player.id) === "friend" && care(healer, player, FRIEND_CARE, renewed)) blessed = true;
        } catch { /* player left */ }
      }
      if (blessed) {
        try { healer.playAnimation(BLESSING.animation, { blendOutTime: BLESSING.blendOutSeconds }); } catch { /* cosmetic */ }
        if (!renewed.has(healer.id)) particles(healer);
      }
    } catch { if (!healer.isValid) loaded.delete(id); }
  }
  stopIfEmpty();
}

export function startHealers(deps) {
  bandOf = deps.bandOf;
  world.afterEvents.entitySpawn.subscribe(({ entity }) => discover(entity));
  world.afterEvents.entityLoad.subscribe(({ entity }) => discover(entity));
  world.afterEvents.dataDrivenEntityTrigger.subscribe(({ entity }) => discover(entity), {
    entityTypes: [ELF_ID], eventTypes: PROFESSIONS.map(spawnEventOf),
  });
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => { loaded.delete(removedEntityId); stopIfEmpty(); });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => { loaded.delete(deadEntity.id); stopIfEmpty(); });
  // Already loaded inhabitants on world load; later chunk loads arrive through entityLoad.
  for (const id of ["overworld", "nether", "the_end"]) {
    try {
      for (const entity of world.getDimension(id).getEntities({ type: ELF_ID })) track(entity);
    } catch { /* dimension unavailable */ }
  }
}
