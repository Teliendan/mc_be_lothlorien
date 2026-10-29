# Owner checks: accepted results, engine limits, open retests

Result of the owner's broad in-game round of 2026-10-25/26 (Bedrock 1.26.52 and later) and the follow-up fixes. The history of
each fix is in git (commits `ff60d20`, `de0928d`..`3efa7b8`, `138bf7a`). Open work is listed in `TODO.md` ("Owner feedback
backlog"); the workspace checklist for the remaining focused checks is `docs/game-checks.md`.

## Accepted by the owner

| Check | Result |
|---|---|
| Buttons, arrows including Galadhrim, leaves touching Mallorn, elf interactions, leashable songbird/butterfly/warden | pass |
| Rope: ordinary controls; crafting returns; bonded unicorn death message; unicorn healing, riding, swimming | pass |
| Sindarin voice | "Good", accepted overall |
| Firefly capture: metadata, full inventory (delivery before removal), all-five-pack compatibility, native orb XP | works; capture plays vanilla `bottle.dragonbreath` (accepted 2026-10-26) |
| Empty Miruvor skin | own flat 16 px icon, "Looks good" (2026-10-26) |
| Star canopy and elven rope recipe unlock | stays on Bottle of Morning Dew; the eighth drop also runs `recipe give` (`dew.js`); works (2026-10-26) |
| Unicorn lure | accepted 2026-10-26: vanilla `tempt` on Elanor in a `lothlorien:lure` group that only the wild Friend state adds; `unicorn.js` fires `lure_off`/`lure_on` around the ten-second offer wait; a Friend is never fled from; wariness counts Creative players. By owner request the Friend state keeps 3 blocks from a Friend without Elanor (accepted 2026-10-27). Details: `mobs/unicorn.md` |
| Harmony action-bar icons, elven bow, unicorn art | checked OK (2026-10-24) |
| Mob hurt and death sounds | kept as they are (2026-10-28) |

## Engine limits (deferred, owner-accepted)

- **Stripping swing.** Scripted stripping works and wears the axe, but the vanilla axe swing does not play; no documented stable
  2.8 API forces the native use animation. Revisit when a supported route exists. (Wiki limitation `stripping-animation`.)
- **Wall arm beside a gate.** The Mallorn fence gate lowers beside a cobblestone wall, but the wall draws no arm toward it.
  Native connection modes cannot narrowly advertise a custom gate as a vanilla gate to walls; broad connection changes would
  alter unrelated blocks. (Wiki limitation `wall-connection`.)
- **Boat hull lift.** A dispensed Mallorn boat is placed in water only (the water filter works), but the long hull rises above
  the dispenser to fit. Placing by hand avoids it; a hull or spawn-position redesign is a later task. (Wiki limitation
  `dispenser-clearance`.)
- **Leaf flicker** is z-fighting between leaf faces; see `TODO.md` section 4 and `GRAPHICS_TASKS.md`.
- Other engine limits: `parity/BLOCKS_ITEMS.md`, `NOT_IMPLEMENTED.md`.

## Open retests (also listed in `TODO.md`)

Source fixes made, owner retest pending:

- Miruvor: empty skin, refill, last sip.
- Star Canopy discovery in Survival (the unlock is the Bottle of Morning Dew, see above).
- Friend unicorn lure, native AI (explicit move/look goal ownership).
- Wind charges: removed-projectile event handling, Breeze radius, paired-door deduplication.
- Rope while a foreign Slow Falling potion is active (the potion is preserved while climb, hold and slide work).
- Firefly release now plays `bottle.dragonbreath` at pitch 1.3.
- Water-only boat dispensing.
- Village railings: the upward half-step bridge join (a connected y+1 surface was misclassified as an unused exit; recognition
  corrected with rotation tests). Existing closures are saved blocks and are not removed automatically; the photographed
  location was (1040, 141, -1338).

Untested, no result inferred: **L8** deer with a blocked kept gift spot, **L9** squirrel with an unreachable destination
(explicit setups in the workspace checklist).

Deferred work: creature-recognizable spawn egg art (shared Bedrock art guide, reproducible generators), the stripping swing,
the wall arm, the boat hull lift.
