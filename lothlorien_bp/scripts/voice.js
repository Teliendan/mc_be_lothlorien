// Plays the Sindarin voice pools at the speaking elf (rules: voice_rules.js; design: docs/SINDARIN_VOICE_EVENTS.md).
// Call only from privileged code (after events, system.run, form continuations): playSound is not allowed in before events.
import { system } from "@minecraft/server";
import { VOICE_HEIGHT, VOLUME, admit, newVoiceState, openingPool, soundIdOf } from "./voice_rules.js";

const state = newVoiceState();

// One line of `pool` from `speaker`, heard around it; `listener` = the player spoken to (greeting cooldown), if any.
export function speak(speaker, pool, listener) {
  try {
    if (!speaker?.isValid) return false;
    const { x, y, z } = speaker.location;
    const location = { x, y: y + VOICE_HEIGHT, z };
    if (!admit(state, { pool, speakerId: speaker.id, listenerId: listener?.id, now: system.currentTick, dimensionId: speaker.dimension.id, location })) return false;
    speaker.dimension.playSound(soundIdOf(pool), location, { volume: VOLUME[pool] });
    return true;
  } catch {
    return false; // entity gone or chunk unloaded: speech is decoration
  }
}

// The opening chosen by the player's Harmony band (Hated: silence, Shunned: refusal).
export function greet(elf, player, band) {
  const pool = openingPool(band);
  return pool ? speak(elf, pool, player) : false;
}
