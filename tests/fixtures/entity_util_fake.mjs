// Stand-ins for scripts/entity_util.js and scripts/ids.js in the data-URL harnesses (their `load` rewrites a script's imports into
// bindings). The real module is tested in tests/entity_util.mjs. `bindings.world` is read at call time.
import * as ids from "../../lothlorien_bp/scripts/ids.js";
export function entityUtilFake(bindings) {
  return {
    ...ids,
    say: (player, text) => { try { player.sendMessage(text); } catch { /* player left */ } },
    playerById: (id) => { const e = id ? bindings.world.getEntity(id) : undefined; return e?.typeId === ids.PLAYER_ID ? e : undefined; },
    familiesOf: (entity) => { try { return entity.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? []; } catch { return []; } },
    judgeNatural: (entity, judge) => {
      try {
        if (!entity.isValid || !entity.getProperty("lothlorien:natural")) return;
        entity.setProperty("lothlorien:natural", false); judge(entity);
      } catch { /* unloaded meanwhile */ }
    },
    removeBeacon: (id) => { try { const b = id && bindings.world.getEntity(id); if (b?.isValid) b.remove(); } catch { /* gone */ } },
    moveBeacon: (beacon, to) => beacon.teleport({ x: to.x, y: to.y, z: to.z }),
    // deferred_use.js consumeHeld, with the harness's own enums
    consumeHeld: (player, typeId) => {
      const slot = player.getComponent("equippable")?.getEquipmentSlot(bindings.EquipmentSlot.Mainhand);
      if (!slot?.hasItem() || slot.typeId !== typeId) return false;
      if (player.getGameMode() !== bindings.GameMode.Creative) { if (slot.amount > 1) slot.amount -= 1; else slot.setItem(undefined); }
      return true;
    },
  };
}
