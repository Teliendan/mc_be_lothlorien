// Village soundtrack, runtime side: one bounded check every CHECK_TICKS for each player; the decisions are in village_music_rules.js.
// Per-player music (Player.playMusic / queueMusic / stopMusic), so each player hears the village they stand in and nobody else's.
import { system, world } from "@minecraft/server";
import { CHECK_TICKS, FADE_IN, FADE_OUT, REST_ID, VOLUME, step } from "./village_music_rules.js";

const states = new Map();

// inVillage(dimension, location) -> inside a recognized village area (village_area.js inVillageArea)
export function startVillageMusic(inVillage) {
  world.afterEvents.playerLeave.subscribe(({ playerId }) => states.delete(playerId));
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      const inside = inVillage(player.dimension, player.location);
      const { state, actions } = step(states.get(player.id), inside, system.currentTick);
      states.set(player.id, state);
      for (const action of actions) {
        try {
          if (action.type === "play") {
            player.playMusic(action.id, { fade: FADE_IN, loop: false, volume: VOLUME });
            player.queueMusic(REST_ID, { loop: true, volume: VOLUME });
          } else player.playMusic(REST_ID, { fade: FADE_OUT, loop: false, volume: VOLUME }); // fades the piece out (stopMusic has no fade); afterwards the biome music returns
        } catch (e) {
          console.warn(`[lothlorien] village music: ${action.type} ${action.id ?? ""}: ${e?.message ?? e}`);
        }
      }
    }
  }, CHECK_TICKS);
}
