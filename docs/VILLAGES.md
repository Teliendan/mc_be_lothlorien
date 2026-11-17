# Finished elven villages

Accepted by the owner in game on 2026-10-16: "I love it, villages done." Bedrock 1.26.52 / server 2.8.0. Final commit
**Finish accepted elven villages**. Layout and jigsaw design: `design/lothlorien_jigsaw_settlement.md`; style: `design/village_style.md`;
central tree: `design/village_central.md`; crowns: `design/village_crowns.md`; homes: `design/home_furnishing.md`; where villages
generate: `WORLDGEN.md`. Changes are one-shot: existing structures do not regenerate.

## Final design and owner decisions

- Generic home pavilions get profession furnishings once the planner assigns homes. The central Hall and reading circle serve
  the Loremaster; healer, gardener, woodwright and lamplighter sets scale to the room available.
- Roofed view bays have two adjacent cushions; pots and firefly jars move to nearby free rail positions to leave the view
  clear, or are omitted if none fits.
- Wood posts continue down to the deck. Generator and runtime share one explicit fence-target policy (including Mallorn slabs
  and moss). Runtime repairs follow furnishing, bridges and local player edits, never poll idle, and keep unloaded directions
  as they were. Repair jobs are finite and serialized. Fence links repair basically instantly after a break or TNT (verified in game (owner, 1.26.63, 2026-11-17)).
- Unused flat connector mouths get rails when no onward surface exists, including at the lower half-step; existing bridges and
  stairs stay open.
- Moss beds get open trapdoor borders on every available side (path-facing and off-deck sides supported by moss included);
  occupied furniture and cushion cells stay free. Only correctly facing open Mallorn trapdoors mounted against moss count as thin
  skirts in walking, lighting and bridge models: opposite 2.92/16-thick panels leave 0.635 blocks for the 0.6-wide player. Other
  screens and closed trapdoors are obstacles. Check 16, verified in game (owner, 1.26.63, 2026-11-17): the skirts stand on `light_block_0` beds, intact and walkable.
- Owner fixes of 2026-11-17 (`6d2247e`, not re-tested): the healer bed said "obstructed" (inferred cause: the `light_block_0` headroom shield round the bed; its cells are now cleared to air at +0..+2); the Court gets two cushions and a decorated pot at its rest corner (F17); the village debug switch follows the debug tag after a reload (E14).
- Crown lanterns hang on waxed oxidized copper chains; froglights sit inside supported foliage with no exposed white cubes on the
  Hall roof; small fallback crowns and low leaf caps prevent bare stubs where a larger crown box does not fit.
- Existing blocks suffice: no new lamp cord, basin, leaf roof or screen block. Stair basins occupy suitable decks and cramped
  homes use cauldrons.

## Performance

Village foliage is persistent (it never decays; natural trees keep normal decay). Leaves have no random tick since 2026-11-08
(event-driven decay); before that, persistence cut a production sample of 100 leaf ticks from 6,034 mocked world reads to zero. Counting actual lamps, jars, berries and lit candles cut hidden lights across 34 templates
from 251 to 150. Non-debug players skip the periodic depth cache. Initial generation uses 2 ms cooperative slices, 32-write
batches and yielding walking-distance searches (one native call may still exceed a slice). Slow initial building is acceptable;
lag in an already loaded village is what matters.

Offline, `tools/village_light.mjs` `addHiddenLights` computes the light field once on a typed array and raises it incrementally after each placed light (exact: the 34 pieces come out byte-identical; a test ties `lightGrid` to the shared flood fill). `node tools/build_village.mjs` takes about 3 s instead of 29 s.
A village's first marker records its territory and later markers inside it write nothing; both village lists (territory and planned) keep 256 villages (was 64).
The write phase is one pass over every planned cell, then one fence mend of every written cell and its four neighbours (the old separate rails pass is gone).

Owner-run 30-second samples in loaded villages (2026-10-16) held 20.0 TPS (average gap 50 ms, p99 65 ms, longest 80 ms, no gap
above 100 ms, 6-7 support callbacks per second). The owner accepted them; they show healthy cadence, not FPS, callback CPU or
every device. The `tps` probe command that produced them was removed 2026-10-29 (git history keeps it). Later script work:
`SCRIPT_PERFORMANCE.md`.

## Offline coverage

Simulation seeds 1..40 (`node tools/village_sim.mjs 40`) give 40 distinct layouts with no failures, unreachable walk cells, link walk/light failures or furnishing failures; the `village-simulation` suite re-checks furnishing on 12 seeds. Furnishing and skirt checks use the runtime's own free-cell tests (`isFree`, `PANEL_AIR`), so the `light_block_0` headroom shield counts as free; real lights `light_block_1..15` never do.
Regressions cover seats, wood supports, fence targets and edits, unload safety, planter coverage (261 correctly mounted panels,
healer and gardener in all four orientations and sizes k 4..7), cushion protection and bridge preservation. Production
generators and tests remain for maintenance (`tools/build_village.mjs`, `tests/village_*.mjs`). Shared evidence for the
technique: skill `bedrock-worldgen` reference 20 (`20-structure-polish.md`).
