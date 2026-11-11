// Stand-ins for scripts/entity_util.js and scripts/ids.js in the data-URL harnesses (their `load` rewrites a script's imports into
// bindings). The real module is tested in tests/entity_util.mjs. `bindings.world` is read at call time.
import * as ids from "../../lothlorien_bp/scripts/ids.js";
export function entityUtilFake(bindings) {
  return {
    ...ids,
    say: (player, text) => { try { player.sendMessage(text); } catch { /* player left */ } },
    playerById: (id) => { const e = id ? bindings.world.getEntity(id) : undefined; return e?.typeId === ids.PLAYER_ID ? e : undefined; },
  };
}
