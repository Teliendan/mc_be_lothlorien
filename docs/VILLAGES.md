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
  as they were. Repair jobs are finite and serialized.
- Unused flat connector mouths get rails when no onward surface exists, including at the lower half-step; existing bridges and
  stairs stay open.
- Moss beds get open trapdoor borders on every available side (path-facing and off-deck sides supported by moss included);
  occupied furniture and cushion cells stay free. Only correctly facing open Mallorn trapdoors mounted against moss count as thin
  skirts in walking, lighting and bridge models: opposite 2.92/16-thick panels leave 0.635 blocks for the 0.6-wide player. Other
  screens and closed trapdoors are obstacles.
- Crown lanterns hang on waxed oxidized copper chains; froglights sit inside supported foliage with no exposed white cubes on the
  Hall roof; small fallback crowns and low leaf caps prevent bare stubs where a larger crown box does not fit.
- Existing blocks suffice: no new lamp cord, basin, leaf roof or screen block. Stair basins occupy suitable decks and cramped
  homes use cauldrons.

## Performance

Village foliage is persistent (no decay searches; natural trees keep normal decay): a production sample of 100 leaves went from
6,034 mocked world reads to zero. Counting actual lamps, jars, berries and lit candles cut hidden lights across 34 templates
from 251 to 150. Non-debug players skip the periodic depth cache. Initial generation uses 2 ms cooperative slices, 32-write
batches and yielding walking-distance searches (one native call may still exceed a slice). Slow initial building is acceptable;
lag in an already loaded village is what matters.

Owner-run 30-second samples in loaded villages (2026-10-16) held 20.0 TPS (average gap 50 ms, p99 65 ms, longest 80 ms, no gap
above 100 ms, 6-7 support callbacks per second). The owner accepted them; they show healthy cadence, not FPS, callback CPU or
every device. The `tps` probe command that produced them was removed 2026-10-29 (git history keeps it). Later script work:
`SCRIPT_PERFORMANCE.md`.

## Offline coverage

Simulation seeds 1..100 give 100 distinct layouts with no failures, unreachable walk cells or link walk/light failures.
Regressions cover seats, wood supports, fence targets and edits, unload safety, planter coverage (261 correctly mounted panels,
healer and gardener in all four orientations and sizes k 4..7), cushion protection and bridge preservation. Production
generators and tests remain for maintenance (`tools/build_village.mjs`, `tests/village_*.mjs`). Shared evidence for the
technique: skill `bedrock-modding` reference 20 (`20-structure-polish.md`).
