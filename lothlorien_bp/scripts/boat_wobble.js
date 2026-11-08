// WORKAROUND (docs/workarounds.md): a vanilla boat rocks when hit, but that roll is drawn by the hard-coded boat renderer,
// which a Mallorn boat's own model does not get. Damage events do not fire for boats (MCPE-174388) and query.hurt_time
// reads 0 in resource packs (MCPE-184179), so each player hit bumps the synced `lothlorien:hits` counter and the client
// `wobble` animation (animations/mallorn_boat.animation.json) rocks the hull for half a second when it changes.
import { world } from "@minecraft/server";
import { BOAT_DROPS } from "./boat_drop_rules.js";

export const HIT_PROPERTY = "lothlorien:hits";
export const HIT_COUNT = 8; // property range 0..7 (tools/make_mallorn_boat_family.py); only a change matters, parity flips the roll
export const nextHits = (hits) => ((Number.isInteger(hits) ? hits : 0) + 1) % HIT_COUNT;

world.afterEvents.worldLoad.subscribe(() => {
  world.afterEvents.entityHitEntity.subscribe(({ hitEntity }) => {
    try {
      if (!BOAT_DROPS[hitEntity.typeId] || !hitEntity.isValid) return; // a breaking hit has removed the boat
      hitEntity.setProperty(HIT_PROPERTY, nextHits(hitEntity.getProperty(HIT_PROPERTY)));
    } catch {
      // removed in the same tick
    }
  }, { entityTypes: ["minecraft:player"] });
});
