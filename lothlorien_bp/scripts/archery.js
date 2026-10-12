// Native shooter handles aim, damage, ammunition, durability and enchantments.
// M5 adds only drawing FOV and recovery after a custom arrow is destroyed on a mob,
// plus a hint when a vanilla bow refuses to draw while the player carries Galadhrim arrows.
import { EasingType, ItemStack, system, world } from "@minecraft/server";
import { BOW_ID, ARROW_ID, BOW, ARROW } from "./gift_rules.js";
import { message } from "./messages.js";

const ZOOM_PROPERTY = "lothlorien:bow_zoom";
const VANILLA_BOW_ID = "minecraft:bow";
const drawing = new Map();
const recovered = new Set();
// Players whose vanilla bow use has not (yet) started a draw this tick.
const refused = new Set();
// The hint goes to chat (the action bar belongs to the Harmony status), so repeated clicks are throttled.
const HINT_COOLDOWN_TICKS = 200;
const lastHint = new Map();
let timer;
let started = false;
const reportedCameraFailures = new Set();

function reportCameraFailure(action, error) {
  // One Content Log warning per action per script load; no repeated chat/tick spam.
  if (reportedCameraFailures.has(action)) return;
  reportedCameraFailures.add(action);
  console.warn(`[Lothlorien archery] Camera ${action} failed: ${String(error)}`);
}

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
  } catch (error) {
    // Dead/unloaded cameras retain the marker for spawn/reload cleanup.
    if (player.isValid) reportCameraFailure("cleanup", error);
  }
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
    // Script enums are capitalized (EasingType.Linear); command syntax uses "linear".
    // Ease across the native draw, rather than snapping to full zoom immediately.
    player.camera.setFov({ fov: BOW.zoomFov,
      easeOptions: { easeTime: BOW.zoomEaseSeconds, easeType: EasingType.Linear } });
    drawing.set(player.id, { player, dimension: player.dimension.id, slot: player.selectedSlotIndex,
      until: system.currentTick + BOW.useSeconds * 20 });
    if (timer === undefined) timer = system.runInterval(checkDrawing, BOW.watchTicks);
  } catch (error) {
    reportCameraFailure("zoom", error);
    clearZoom(player); // cosmetic failure cannot prevent the native shot
  }
}

function carriesGaladhrimArrows(player) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (container) {
    for (let i = 0; i < container.size; i++) if (container.getItem(i)?.typeId === ARROW_ID) return true;
  }
  return player.getComponent("minecraft:equippable")?.getEquipmentSlot("Offhand")?.typeId === ARROW_ID;
}

// In game (1.26.52): a vanilla bow with only Galadhrim arrows fires itemUse but never itemStartUse;
// a normal draw fires both in the same tick. So "use without a start" means the bow found no ammo.
function noteVanillaBowUse({ source: player, itemStack }) {
  if (itemStack?.typeId !== VANILLA_BOW_ID) return;
  refused.add(player.id);
  system.run(() => {
    if (!refused.delete(player.id)) return; // the draw started
    if (system.currentTick - (lastHint.get(player.id) ?? -Infinity) < HINT_COOLDOWN_TICKS) return;
    try {
      if (player.isValid && carriesGaladhrimArrows(player)) {
        lastHint.set(player.id, system.currentTick);
        player.sendMessage(message("archery.normal_bow")); // chat: the action bar belongs to the Harmony status (harmony_game.js)
      }
    } catch { /* player left or inventory unavailable; the hint is optional */ }
  });
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
  world.afterEvents.itemStartUse.subscribe(event => { refused.delete(event.source.id); begin(event); });
  world.afterEvents.itemUse.subscribe(noteVanillaBowUse);
  // Stop can omit itemStack on dimension transfer. Only our tracked/marked players are cleared.
  world.afterEvents.itemReleaseUse.subscribe(({ source }) => clearZoom(source));
  world.afterEvents.itemStopUse.subscribe(({ source }) => clearZoom(source));
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (deadEntity.typeId === "minecraft:player") clearZoom(deadEntity);
  });
  world.afterEvents.playerDimensionChange.subscribe(({ player }) => clearZoom(player));
  world.afterEvents.playerLeave.subscribe(({ playerId }) => { drawing.delete(playerId); lastHint.delete(playerId); stopIfEmpty(); });
  world.afterEvents.playerSpawn.subscribe(({ player }) => clearZoom(player));
  world.afterEvents.projectileHitEntity.subscribe(returnArrow);
  // A script reload can interrupt a draw without a release event.
  for (const player of world.getPlayers()) clearZoom(player);
}
