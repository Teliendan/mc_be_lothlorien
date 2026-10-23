// M5 worn gifts. Poll equipment only for online players; no entity scans or persistent tags.
import { system, world } from "@minecraft/server";
import { WORN_CHECK_TICKS, CLOAK, BELT } from "./gift_rules.js";

const still = new Map();
let timer;
let started = false;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function cloak(player, equipment, now) {
  const id = player.id;
  if (equipment?.getEquipment("Chest")?.typeId !== CLOAK.item || !player.isSneaking) {
    still.delete(id);
    return;
  }
  const location = player.location, dimension = player.dimension.id;
  const previous = still.get(id), velocity = player.getVelocity();
  // Anchor to the start of a still period: small movements cannot accumulate unnoticed.
  const moving = Math.hypot(velocity.x, velocity.y, velocity.z) > CLOAK.moveTolerance / WORN_CHECK_TICKS;
  if (!previous || previous.dimension !== dimension || distance(previous.location, location) > CLOAK.moveTolerance || moving) {
    still.set(id, { location: { ...location }, dimension, since: now });
    return;
  }
  if (now - previous.since < CLOAK.stillTicks) return;
  const effect = player.getEffect(CLOAK.effect);
  // Renew before the next equipment poll can observe expiry. The old existence-only
  // gate let native invisibility expire before reapplying it, exposing a render/AI gap.
  // Invisibility has no source token: renew only a same-strength, finite effect in
  // its last poll window. This also hands a potion over to the cloak without ever
  // shortening it. Infinite and stronger effects remain entirely untouched.
  if (effect && (effect.amplifier !== CLOAK.amplifier || effect.duration < 0
    || effect.duration > WORN_CHECK_TICKS)) return;
  player.addEffect(CLOAK.effect, CLOAK.effectTicks, { amplifier: CLOAK.amplifier, showParticles: false });
  // Never remove an effect on exit: another source may have replaced ours. This short grant
  // expires naturally within half a second; external invisibility is neither shortened nor erased.
}

function belt(player, equipment, health) {
  if (equipment?.getEquipment("Offhand")?.typeId !== BELT.item
    || health.currentValue >= health.effectiveMax * BELT.healthFraction) return;
  const effect = player.getEffect(BELT.effect);
  // Let equal/stronger regeneration finish. Refreshing each pulse resets native healing timing.
  if (effect && effect.amplifier >= BELT.amplifier) return;
  player.addEffect(BELT.effect, BELT.effectTicks, { amplifier: BELT.amplifier, showParticles: false });
}

function pulse() {
  const players = world.getPlayers(), seen = new Set();
  for (const player of players) {
    seen.add(player.id);
    try {
      const health = player.getComponent("minecraft:health");
      if (!player.isValid || !health || health.currentValue <= 0) { still.delete(player.id); continue; }
      const equipment = player.getComponent("minecraft:equippable");
      cloak(player, equipment, system.currentTick);
      belt(player, equipment, health);
    } catch { still.delete(player.id); } // leave/death/equipment races cannot stop the other players
  }
  for (const id of still.keys()) if (!seen.has(id)) still.delete(id);
  if (!players.length && timer !== undefined) {
    system.clearRun(timer);
    timer = undefined;
  }
}

function wake() {
  if (timer === undefined) timer = system.runInterval(pulse, WORN_CHECK_TICKS);
}

export function startWornGifts() {
  if (started) return;
  started = true;
  world.afterEvents.playerSpawn.subscribe(({ player }) => { still.delete(player.id); wake(); });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => still.delete(playerId));
  pulse();
  if (world.getPlayers().length) wake();
}
