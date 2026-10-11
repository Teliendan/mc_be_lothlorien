// M4 healing and blessing tunables. Rules are pure; make_elves.py also reads BLESSING for the pose.
import { ELF_ID, PROFESSIONS } from "./elf_rules.js";
import { WARDEN_ID } from "./elven_warden_rules.js";

export const HEALER_VARIANT = PROFESSIONS.indexOf("healer");
export const PATIENT_TYPES = [ELF_ID, WARDEN_ID];
export const CHECK_TICKS = 20;
export const EFFECT = "regeneration";
export const EFFECT_TICKS = 60;
export const ELF_CARE = { radius: 8, amplifier: 1 }; // Regeneration II
export const FRIEND_CARE = { radius: 6, amplifier: 0 }; // Regeneration I; Harmony, not Renown
export const BLESSING = {
  animation: "animation.lothlorien.elf.bless",
  seconds: 0.8,
  blendOutSeconds: 0.15,
  armDegrees: 75,
  spreadDegrees: 12,
  particle: "minecraft:villager_happy",
  particleHeight: 1.2,
};

export const injured = (health) => !!health && health.currentValue > 0 && health.currentValue < health.effectiveMax;
export const inRange = (a, b, radius) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= radius;
// Let existing equal/stronger regeneration finish: no shortened potions, no refresh resetting its healing cadence.
// Use existence/potency rather than a positive-duration test, including for infinite effects.
export const needsRegeneration = (effect, amplifier) => !effect || effect.amplifier < amplifier;
