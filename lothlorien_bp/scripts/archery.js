// Native shooter handles aim, damage, ammunition, durability and enchantments.
// M5 adds only drawing FOV and recovery after a custom arrow is destroyed on a mob.
import { ItemStack, system, world } from "@minecraft/server";
import { BOW_ID, ARROW_ID, BOW, ARROW } from "./gift_rules.js";

const ZOOM_PROPERTY = "lothlorien:bow_zoom";
const drawing = new Map();
const recovered = new Set();
let timer;
let started = false;

function stopIfEmpty() {
  if (!drawing.size && timer !== undefined) {
    system.clearRun(timer);
    timer = undefined;
  }
}

function clearZoom(player) {
  drawing.delete(player.id);
  try {
    if (player.getDynamicProperty(ZOOM_PROPERTY)) {
      // No FOV means clear the override; do not hard-code the player's normal FOV.
      player.camera.setFov();
      player.setDynamicProperty(ZOOM_PROPERTY, undefined);
    }
  } catch { /* dead/unloaded camera: the persistent marker is retried at spawn/reload */ }
  stopIfEmpty();
}

function checkDrawing() {
  for (const state of drawing.values()) {
    const p = state.player;
    try {
      if (!p.isValid || p.dimension.id !== state.dimension || p.selectedSlotIndex !== state.slot
        || p.getComponent("minecraft:equippable")?.getEquipmentSlot("Mainhand")?.typeId !== BOW_ID
        || !(p.getComponent("minecraft:health")?.currentValue > 0)
        || system.currentTick >= state.until) clearZoom(p);
    } catch { clearZoom(p); }
  }
}

function begin({ source: player, itemStack }) {
  if (itemStack?.typeId !== BOW_ID) return;
  // Repeated start events must not stack zooms or timers.
  if (drawing.has(player.id)) return;
  try {
    player.setDynamicProperty(ZOOM_PROPERTY, true);
    player.camera.setFov({ fov: BOW.zoomFov, easeOptions: { easeTime: BOW.zoomEaseSeconds, easeType: "linear" } });
    drawing.set(player.id, { player, dimension: player.dimension.id, slot: player.selectedSlotIndex,
      until: system.currentTick + BOW.useSeconds * 20 });
    if (timer === undefined) timer = system.runInterval(checkDrawing, BOW.watchTicks);
  } catch { clearZoom(player); } // cosmetic failure cannot prevent the native shot
}

function returnArrow(event) {
  try {
    const arrow = event.projectile;
    // id/typeId remain readable after destruction. Never access its components/location.
    if (arrow.typeId !== ARROW_ID || arrow.isValid || recovered.has(arrow.id)) return;
    recovered.add(arrow.id);
    // A bounded ring is enough for duplicate hit notifications; no arrow polling/timers.
    if (recovered.size > 256) recovered.delete(recovered.values().next().value);
    if (Math.random() < ARROW.recoveryChance) event.dimension.spawnItem(new ItemStack(ARROW_ID, 1), event.location);
  } catch { /* chunk unloaded or projectile disappeared before its identifiers could be read */ }
}

export function startArchery() {
  if (started) return;
  started = true;
  world.afterEvents.itemStartUse.subscribe(begin);
  // Stop can omit itemStack on dimension transfer. Only our tracked/marked players are cleared.
  world.afterEvents.itemReleaseUse.subscribe(({ source }) => clearZoom(source));
  world.afterEvents.itemStopUse.subscribe(({ source }) => clearZoom(source));
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId === "minecraft:player") clearZoom(deadEntity);
  });
  world.afterEvents.playerDimensionChange.subscribe(({ player }) => clearZoom(player));
  world.afterEvents.playerLeave.subscribe(({ playerId }) => { drawing.delete(playerId); stopIfEmpty(); });
  world.afterEvents.playerSpawn.subscribe(({ player }) => clearZoom(player));
  world.afterEvents.projectileHitEntity.subscribe(returnArrow);
  // A script reload can interrupt a draw without a release event.
  for (const player of world.getPlayers()) clearZoom(player);
}
