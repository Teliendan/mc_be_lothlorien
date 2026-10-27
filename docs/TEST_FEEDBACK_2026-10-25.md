# Owner test results - 2026-10-25

Target Bedrock 1.26.52. Source: workspace `temp/testing_feedback.md`, mapped
against the original `docs/game-checks.md`. A source fix still needs game retest.

| Report | Disposition |
| --- | --- |
| L1 buttons | Owner PASS |
| L2 arrows including Galadhrim | Owner PASS |
| L3 wind charges | Fixed in source: removed-projectile event handling, Breeze radius and paired-door deduplication; retest pending |
| L4 rope ordinary controls | Owner PASS before this pass; regression retest with L5 |
| L5 rope with Slow Falling | Fixed in source: preserve foreign potion while allowing climb/hold/slide; retest pending |
| L6 crafting returns | Owner PASS before Miruvor waterskin change; retest new skin/refill route |
| L7 bonded unicorn death message | Owner PASS |
| L8 deer blocked kept gift spot | Not tested: setup unclear; still pending |
| L9 squirrel unreachable destination | Inconclusive: hard to test; still pending |
| L10 stripping / slab use | Owner reports mechanics work, but stripping has no axe swing; stable API animation limit deferred |
| L11 gate beside cobblestone wall | Owner confirms gate lowers; wall does not draw an arm. Deferred native connection limitation |
| L12 vanilla leaves touching Mallorn | Owner PASS |
| L13 boat dispenser | Owner confirms boat dispenses but long hull rises above dispenser to fit. Water-only dispense filter corrected; hull lift remains deferred |
| L14 unicorn healing / riding / swimming | Owner PASS; new lure candidate needs separate retest |
| L15 named injured firefly | Metadata works; owner reports full inventory loses captured firefly. Delivery-before-removal fix added; retest pending |
| L16 elf interactions | Owner PASS |
| L17 leashable songbird/butterfly/warden | Owner PASS |
| Sindarin | Owner reports Good; accepted as an overall pass, no invented per-subcheck observations |
| Miruvor container | Separate reusable empty skin/refill/last-sip return implemented; retest pending |
| Star Canopy recipe | Unlock moved to ordinary deepslate tiles; retest survival discovery |
| Friend unicorn lure oscillates | Explicit move/look goal ownership added; candidate correction, native AI retest pending |
| Creature-shaped spawn eggs | Deferred artwork task; existing eggs remain |
| Village railing screenshot | Connected upward bridge half-step was misclassified as an unused exit; y+1 surface recognition corrected with rotation tests. Exact photographed instance needs retest |

## Deferred details

- Axe swing: canceled scripted stripping works and wears the axe, but does not
  play vanilla's swing. No documented stable 2.8 API forces the native use swing.
- Wall arm: the gate lowers, but neighboring cobblestone walls do not draw their
  gate-facing arm. Available native connection modes cannot narrowly advertise
  a custom gate as a vanilla gate to walls. Broad connection changes are deferred.
- Boat: the long hull can rise over the dispenser. The water filter fixes dry
  dispensing only; a hull/spawn-position redesign is a later task.
- Railing image (scratch, deleted 2026-10-27): shown position
  1040, 141, -1338. Existing closures are one-shot saved blocks; the change prevents
  new false closures and does not automatically remove previously placed fences.
  No structure assets or biome/worldgen distribution changed.

Detailed block findings are in `BLOCK_FEEDBACK_2026-10-25.md` if present; the
main remaining-work list is `TODO.md`. Offline checks, export validation and
managed deployment are recorded in the workspace feedback tracker.
