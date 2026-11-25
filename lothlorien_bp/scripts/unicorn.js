import { message } from "./messages.js";
// Unicorns in the running game (mobs/unicorn.md; rules in unicorn_rules.js). Their flight is native (entities/unicorn.json state_wild: each
// player is judged by their own Harmony band tag; the alarm is in deer.js): strangers and restless players are fled from, a Friend of Lothlorien may come close
// and lure one with Elanor. This file is the taming: three offers of Elanor from a Friend bond the unicorn to that player
// (the `lothlorien:bonded` group in entities/unicorn.json makes it rideable without a saddle), and only the owner may ride it.
import { system, world } from "@minecraft/server";
import { harmonyOf, showStatus } from "./harmony_game.js";
import { bandOf } from "./harmony.js";
import { healAnimal } from "./animal_food.js";
import { consumeHeld } from "./deferred_use.js";
import { playerById, say } from "./entity_util.js";
import { ELANOR_ID, UNICORN_ID, mayRide, nextTrust, offerRefusal } from "./unicorn_rules.js";

const OWNER = "lothlorien:owner"; // dynamic property on the unicorn: id of the player it is bonded to
const OFFER_READY = "lothlorien:offer_ready"; // entity property: false during the pause the native group lothlorien:offer_wait runs

const REFUSALS = {
  restless: message("unicorn.restless"),
  untrusted: message("unicorn.untrusted"),
  wait: message("unicorn.wait"),
};

const MESSAGES = [
  message("unicorn.trust1"),
  message("unicorn.trust2"),
  message("unicorn.trust3"),
];

// Fed = bonded: the owner is recorded and lothlorien:become_tame adds the bonded group and takes the wild flight and the lure away
// (entities/unicorn.json). No state is re-applied by script.
function bond(unicorn, player) {
  unicorn.setDynamicProperty(OWNER, player.id);
  unicorn.triggerEvent("lothlorien:become_tame");
  try {
    unicorn.dimension.spawnParticle("minecraft:totem_particle", { x: unicorn.location.x, y: unicorn.location.y + 1.2, z: unicorn.location.z });
  } catch {
    // chunk unloaded
  }
}

function offer(player, unicorn) {
  const band = bandOf(harmonyOf(player).harmony);
  const refusal = offerRefusal({
    band,
    tame: !!unicorn.getProperty("lothlorien:tame"),
    ready: unicorn.getProperty(OFFER_READY) !== false,
  });
  if (refusal === "tame") return;
  if (refusal === "restless" || refusal === "untrusted") showStatus(player); // the band is the reason
  if (refusal) return say(player, REFUSALS[refusal]);
  const { trust, bonded } = nextTrust(unicorn.getProperty("lothlorien:trust"));
  consumeHeld(player, ELANOR_ID);
  healAnimal(unicorn);
  unicorn.setProperty("lothlorien:trust", trust);
  say(player, MESSAGES[trust - 1]);
  if (bonded) bond(unicorn, player);
  else {
    unicorn.triggerEvent("lothlorien:offer_taken"); // starts the native pause (entities/unicorn.json), which also turns the lure off
    try {
      unicorn.dimension.spawnParticle("minecraft:heart_particle", { x: unicorn.location.x, y: unicorn.location.y + 1.8, z: unicorn.location.z });
    } catch {
      // chunk unloaded
    }
  }
}

export function startUnicorns() {
  // Like a tamed wolf or horse: the bonded owner is told when their unicorn dies.
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    try {
      const owner = playerById(deadEntity.getDynamicProperty(OWNER));
      if (owner) say(owner, message("unicorn.died"));
    } catch {
      // owner or unicorn unreadable
    }
  }, { entityTypes: [UNICORN_ID] });
  // Only the owner mounts a bonded unicorn: the interaction is cancelled for everyone else (before the engine mounts).
  world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;
    if (target.typeId !== UNICORN_ID || !target.getProperty("lothlorien:tame")) return;
    // Native bonded-group healable owns Elanor healing and consumption together;
    // full health keeps normal mounting. No deferred action can revoke feeding.
    if (mayRide(target.getDynamicProperty(OWNER), player.id)) return;
    event.cancel = true;
    system.run(() => say(player, message("unicorn.other_owner")));
  });
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target, beforeItemStack, itemStack }) => {
    try {
      if (target.typeId !== UNICORN_ID || (beforeItemStack ?? itemStack)?.typeId !== ELANOR_ID) return;
      offer(player, target);
    } catch {
      // entity gone
    }
  });
}
