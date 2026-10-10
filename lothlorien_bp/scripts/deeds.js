// Deeds that feed Renown: the hooks (dew.js, nectar.js, lembas.js, elven_rope.js, squirrel.js, white_deer.js, unicorn.js, renown_game.js)
// call noteDeed(player, "<id>"); renown_game.js listens. No imports, so every hook can use it without an import cycle
// (squirrel.js and unicorn.js already import harmony_game.js). Ids: dew, nectar, lembas, rope, fireflies, squirrel, white_deer, unicorn.
const listeners = [];

export function onDeed(listener) {
  listeners.push(listener);
}

export function noteDeed(player, id) {
  for (const listener of listeners) {
    try {
      listener(player, id);
    } catch {
      // a listener must never break the deed that called it
    }
  }
}
