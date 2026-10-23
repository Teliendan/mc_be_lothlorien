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
  for (const [effect, duration, amplifier] of effects) {
    if (effect !== "instant_health") {
      // Never downgrade or shorten a stronger grant.
      const existing = source.getEffect(effect);
      if (existing && (existing.amplifier > amplifier || existing.duration >= duration)) continue;
    }
    source.addEffect(effect, duration, { amplifier, showParticles: true });
  }
  source.removeEffect("poison");
}

// One sip of the skin: the last one uses it up.
function sip(player, slot) {
  if (player.getGameMode() === GameMode.Creative) return;
  const item = slot.getItem(), durability = item.getComponent("minecraft:durability");
  if (durability.damage + 1 >= durability.maxDurability) {
    slot.setItem(undefined);
    player.playSound("random.break");
  } else {
    durability.damage += 1;
    slot.setItem(item);
  }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("lothlorien:salve", {
    onConsume({ source }) { apply(source, EFFECTS["lothlorien:salve"]); },
  });
  itemComponentRegistry.registerCustomComponent("lothlorien:miruvor", {
    // The native completion callback (mainhand only; the JSON category cooldown blocks use during the cooldown).
    onCompleteUse({ source }) {
      const slot = source.getComponent("equippable").getEquipmentSlot(EquipmentSlot.Mainhand);
      if (slot.getItem()?.typeId !== MIRUVOR) return;
      apply(source, EFFECTS["lothlorien:miruvor"]);
      sip(source, slot);
      source.startItemCooldown(MIRUVOR_COOLDOWN_CATEGORY, MIRUVOR_COOLDOWN_TICKS);
    },
  });
});
