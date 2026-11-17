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
| Mallorn boat drop and hit wobble | axe and hand breaks drop the boat's own item; a hit rocks the boat (`mobs/mallorn_boat.md`); "These work too" (2026-11-08) |
| Mallorn boat waterline | 4 px model lift, seats with it: floor dry through the whole wave bob, "It works now" (2026-11-08) |
| Native arm swing | litter/blossoms replaceable, stacking through native placement (`ground_cover.js` `cover_stack`, grass kept under a replacing block); firefly catch in the after event of the native interaction; both swing in first person, "It works" (2026-11-08) |
| Star canopy and elven rope recipe unlock | stays on Bottle of Morning Dew; the eighth drop also runs `recipe give` (`dew.js`); works (2026-10-26) |
| Unicorn lure | accepted 2026-10-26, **back to recheck since LM-01 (2026-11-12)**: vanilla `tempt` on Elanor in a `lothlorien:lure` group, now added at spawn (priority 4 below the flight), exemption `has_tag lothlorien_friend` + Elanor; the ten-second offer wait is the native group `lothlorien:offer_wait` (`unicorn.js` triggers `offer_taken`; the timer's `offer_ready` event restores the lure; LM-05); a Friend is never fled from; wariness counts Creative players. By owner request the Friend state keeps 3 blocks from a Friend without Elanor (accepted 2026-10-27). Details: `mobs/unicorn.md` |
| Harmony action-bar icons, elven bow, unicorn art | checked OK (2026-10-24) |
| Mob hurt and death sounds | kept as they are (2026-10-28) |
| First-round batch of 2026-11-11 (checks A-D, F, K, O; verified in game (owner, 1.26.63, 2026-11-17)) | Support and plants (LW-02, incl. farmed corn and `/setblock` onto stone, see `PISTON_SUPPORT.md`); phial light, rope, dew, bone meal; wardens, healers, deer, swan and white deer spawn; fence links repair almost instantly (C12); village music and Harmony status; village complete and lit, moss-bed skirts intact (check 16); Court reading circle, Loremaster pushed back to the circle, four seats read well; warden arrows and chicken jockey (LM-03), unicorn offers (LM-05), cloak and belt, squirrel errand, swans breeding; inline MERS unchanged in Vibrant Visuals (check 40); LC-10 list covers accepted (`TESTING.md`); 26.60 content log clean |

## Engine limits (deferred, owner-accepted)

- **First-person swing.** The scripted swing (`swing.js`, copy of the vanilla swing) plays for stripping, slab merge, bone meal
  (flora, saplings), nectar and dew bottling and firefly release, and shows in third person (other players, F5), but not in your
  own first-person view: a held normal item's first-person swing is engine code (owner check 2026-11-08; reasons in the
  workspace `bedrock-scripting` reference `arm-swing.md`). Wiki limitation `first-person-swing`.

- **Wall arm beside a gate.** The Mallorn fence gate lowers beside a cobblestone wall, but the wall draws no arm toward it.
  Native connection modes cannot narrowly advertise a custom gate as a vanilla gate to walls; broad connection changes would
  alter unrelated blocks. (Wiki limitation `wall-connection`.)
- **Boat hull lift.** A dispensed Mallorn boat is placed in water only (the water filter works), but the long hull rises above
  the dispenser to fit. Placing by hand avoids it; a hull or spawn-position redesign is a later task. (Wiki limitation
  `dispenser-clearance`.)
- **Leaf flicker** is z-fighting between leaf faces; see `TODO.md` section 4 and `GRAPHICS_TASKS.md`.
- Other engine limits: `parity/BLOCKS_ITEMS.md`, `NOT_IMPLEMENTED.md`.

## Open retests (also listed in `TODO.md`)

Source fixes made, owner retest pending (fixes of 2026-11-17 in `6d2247e`, `87d619d`, `05d1180`: not re-tested; item list: `VILLAGES.md`, `TESTING.md`):

- Miruvor: empty skin, refill, last sip.
- Star Canopy discovery in Survival (the unlock is the Bottle of Morning Dew, see above).
- Friend unicorn lure, native AI (explicit move/look goal ownership), now with the LM-01 per-player flight.
- LM-01 native per-player wildlife flight (2026-11-12; Survival; set the band with `/scriptevent lothlorien:harmony <n>`: Friend 10, Guest 5, Uneasy -5, Shunned -20, Hated -40):
  1. Old world: no group or property errors in the content log; existing animals saved before LM-01 stay fearless until alarmed (no migration), new ones flee. verified in game (owner, 1.26.63, 2026-11-17).
  2. Five species x five bands: flees at about the table distance walking, at the sneak distance sneaking (`tools/wildlife_wariness.py --matrix`). Failed in game (owner, 1.26.63, 2026-11-17: every band fled at about 3 blocks; cause: the goal-level `avoid_mob_type` `max_dist` default 3, MCPE-182041; fixed in `87d619d`, not re-tested); retest after the goal-radius fix, Friend first (a Friend must still get to about 3 blocks, which proves each entry keeps its own distance).
  3. Lure as Guest or Friend: the animal comes and stays (swan: wheat and corn). verified in game (owner, 1.26.63, 2026-11-17).
  4. Lure as Uneasy, Shunned or Hated: expect come-and-flee (accepted); it must never stay close. verified in game (owner, 1.26.63, 2026-11-17).
  5. Unicorn: Guest with Elanor is fled from at 13, never lured; Friend is lured, three offers 10 s apart bond; a fourth click inside the pause says "wait"; the bonded one flees nobody. Friend offers and the "wait" click: verified in game (owner, 1.26.63, 2026-11-17) (LM-05); the Guest and bonded parts untested.
  6. Tame deer and white deer: not fled by Guest or Friend; fled by Uneasy at 13/6; hurt: alarm, untame, after 20 s band flight again. verified in game (owner, 1.26.63, 2026-11-17) (tame not fled by Guest/Friend, hurt: alarm, untame, band flight).
  7. Alarm: hitting one animal makes all five species within 20 blocks flee every player at 36/18 for 20 s. verified in game (owner, 1.26.63, 2026-11-17).
  8. Guiding (white deer guidance failed 2026-11-17 with "nowhere to lead you": beta `Block.isSolid` in the ground probe, fixed in `05d1180`, not re-tested; the squirrel errand worked; retest a Friend's acorn deep in the forest first): a guiding white deer and an errand squirrel do not flee; the white deer is tame after arrival; leaving and re-entering mid-guide releases it.
  9. (Not testable for the owner, still open.) Two players, Friend and Hated: the Friend can stand 4 blocks away while the Hated one is fled from at 30; switching bands reacts within about 1 s. This also confirms the positive `has_tag` test in avoid entries.
  10. Breeding with a Guest next to two deer and two swans.
  11. A wolf near a lured deer: the deer flees the wolf (expected change).
  12. Creative, any band: not fled; a Friend lures the unicorn; a Hated player with corn lures a deer (engine behaviour, accepted). Creative never fled: verified in game (owner, 1.26.63, 2026-11-17).
  13. Spectator flying near each species: record whether it flees. Checked, verified in game (owner, 1.26.63, 2026-11-17); no failure.
- Wind charges: removed-projectile event handling, Breeze radius, paired-door deduplication.
- Rope while a foreign Slow Falling potion is active (the potion is preserved while climb, hold and slide work).
- Firefly release now plays `bottle.dragonbreath` at pitch 1.3.
- Water-only boat dispensing.
- Leaf decay is event-driven (2026-11-08, `TECHNICAL_NOTES.md`). Owner 2026-11-08: fire and TNT work; decay was far
  too fast, so cut-off leaves are now only marked and break on their native random tick. Retest: a felled small and
  giant Mallorn loses its leaves at the pace of a felled oak next to it; leaves of a neighbouring tree with its own trunk
  stay; placing a log back into a decaying crown saves every leaf within 10 steps of it; leave and re-enter mid-decay
  (it continues); breaking one leaf of a floating crown (left by a decay-off test build) clears that crown step by step.
  Player-placed leaves never decay. Freezes while standing in the forest should be rarer (no script call per leaf tick).
- Support random ticks keep no records (2026-11-08, also Starstone and Torchlight; `PISTON_SUPPORT.md`): flowers,
  carpets and lanterns still pop when their support is mined, blown up or pushed by a piston.
- Village railings: the upward half-step bridge join (a connected y+1 surface was misclassified as an unused exit; recognition
  corrected with rotation tests). Existing closures are saved blocks and are not removed automatically; the photographed
  location was (1040, 141, -1338).

Untested, no result inferred: **L8** deer with a blocked kept gift spot, **L9** squirrel with an unreachable destination
(explicit setups in the workspace checklist).

Deferred work: the wall arm, the boat hull lift.
