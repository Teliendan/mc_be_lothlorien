import { EquipmentSlot, system, GameMode } from "@minecraft/server";

// Phase 8: Athelas salve and Miruvor. Food JSON gives the drinking (animation, duration, can always
// be drunk); these components add the effects. First balance is deliberately conservative: the salve
// is a modest heal-over-time (about 5 HP), Miruvor about 10 HP plus a short speed boost, and it costs
// a salve, both rare flowers and Mallorn nectar. Ticks: 20 per second.
// Miruvor is a skin, not a stack: 4 sips (durability), 30 s after each completed sip.
// It is not food, so the sip comes from onCompleteUse (use_modifiers duration) and the item survives.
// The JSON cooldown duration is zero: native use-start must not penalize an interrupted drink.
// Keep its category for native blocking/display; start the real cooldown only after the effects.
const MIRUVOR_COOLDOWN_CATEGORY = "lothlorien_miruvor";
const MIRUVOR_COOLDOWN_TICKS = 30 * 20;
const MIRUVOR = "lothlorien:miruvor";
const EFFECTS = {
  "lothlorien:salve": [["regeneration", 120, 1]],
  "lothlorien:miruvor": [
    ["instant_health", 1, 0],
    ["regeneration", 160, 1],
    ["speed", 600, 0],
  ],
};

function apply(source, effects) {
  let outcome = false;
  for (const [effect, duration, amplifier] of effects) {
    try {
      if (effect !== "instant_health") {
        const existing = source.getEffect(effect);
        // Never downgrade, shorten or replace an infinite grant. Do not remove
        // and replay it: that cannot preserve the engine's hidden effect stack.
        if (existing && (existing.amplifier > amplifier || existing.duration < 0 || !Number.isFinite(existing.duration) ||
            existing.duration >= duration)) { outcome = true; continue; }
      }
      source.addEffect(effect, duration, { amplifier, showParticles: true });
      outcome = true; // addEffect may return undefined on a successful call.
    } catch { /* one failed grant cannot discard another successful outcome */ }
  }
  try { if (source.removeEffect("poison")) outcome = true; } catch { /* entity gone/effect unavailable */ }
  return outcome;
}

function skinProgress(item) {
  if (item?.typeId !== MIRUVOR || item.amount !== 1) return undefined;
  const durability = item.getComponent("minecraft:durability");
  if (!durability || durability.maxDurability !== 4 || !Number.isInteger(durability.damage) ||
      durability.damage < 0 || durability.damage >= durability.maxDurability) return undefined;
  return durability;
}

function sipFromSkin(player, { slot, item }) {
  if (player.getGameMode() === GameMode.Creative) return;
  const durability = skinProgress(item);
  if (durability.damage + 1 >= durability.maxDurability) {
    slot.setItem(undefined);
    try { player.playSound("random.break"); } catch { /* cosmetic only */ }
  } else {
    durability.damage += 1;
    slot.setItem(item);
  }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("lothlorien:salve", {
    onConsume({ source }) {
      try {
        apply(source, EFFECTS["lothlorien:salve"]);
      } catch {
        // entity gone mid-drink
      }
    },
  });
  itemComponentRegistry.registerCustomComponent("lothlorien:miruvor", {
    onCompleteUse({ source, itemStack }) {
      try {
        // The native completion callback is the authority for completed use.
        // Global chargeable start/stop hooks are not established for this skin.
        // Read the actual skin/slot once for charging. This callback does not
        // yield; an immediate deep snapshot comparison adds no timing boundary.
        if (!skinProgress(itemStack) || source.getItemCooldown(MIRUVOR_COOLDOWN_CATEGORY) > 0) return;
        const slot = source.getComponent("equippable")?.getEquipmentSlot(EquipmentSlot.Mainhand), item = slot?.getItem();
        if (!skinProgress(item)) return;
        const hand = { slot, item };
        if (!apply(source, EFFECTS["lothlorien:miruvor"])) return;
        try { sipFromSkin(source, hand); }
        finally { source.startItemCooldown(MIRUVOR_COOLDOWN_CATEGORY, MIRUVOR_COOLDOWN_TICKS); }
      } catch {
        // player gone mid-drink
      }
    },
  });
});
