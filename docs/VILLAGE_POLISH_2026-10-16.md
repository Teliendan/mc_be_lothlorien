# Finished elven villages

Owner accepted M7 in game on 2026-10-16: "I love it, villages done."
Target: Bedrock 1.26.52 / stable server 2.8.0.
Final mod commit: **Finish accepted elven villages**. No push.

## Final design and owner decisions

- Generic home pavilions receive profession-specific furnishings after the planner
  assigns homes. The central Hall and reading circle serve the Loremaster; healer,
  gardener, woodwright and lamplighter sets scale to the available room.
- Roofed view bays have two adjacent cushions. Pots and firefly jars move to nearby
  free rail positions to leave the view clear; omit an obstruction if none fits.
- Wood posts continue down to the deck. Generator and runtime share the explicit
  fence-target policy, including Mallorn slabs and moss. Runtime repairs follow
  furnishing, bridges and local player edits; unloaded directions retain their
  state. Repair jobs are finite and serialized, with no idle fence polling.
- Unused flat connector mouths receive rails when no onward surface exists,
  including at the lower half-step. Existing bridges and stairs remain open.
- Moss beds receive open trapdoor borders on every available side, including
  path-facing and off-deck sides supported by moss. Occupied furniture/cushion
  cells stay free. Runtime completes home beds and nearby deferred static sides
  after selecting the furniture layout.
- Only correctly facing open Mallorn trapdoors mounted against moss count as
  thin skirts in walking, lighting and bridge models. Opposite 2.92/16-thick
  panels leave 0.635 blocks for the vanilla 0.6-wide player. Bridge air writes
  preserve them. Other screens and closed trapdoors remain obstacles.
- Crown lanterns use waxed oxidized copper chains. Froglights sit within supported
  foliage, with no exposed white cubes on the Hall roof. Small fallback crowns
  and intrinsic low leaf caps prevent bare stubs when larger crown boxes cannot fit.
- Existing blocks suffice: no new lamp cord, basin, leaf-roof or screen block.
  Stair basins occupy suitable decks; cramped homes use cauldrons.

## Performance and validation

Village foliage is persistent, avoiding decay searches while natural trees retain
their normal decay. The production callback sample of 100 leaves fell from 6,034
mocked world reads to zero. The initial lighting audit across 34 templates reduced
hidden lights from 251 to 150 by counting actual lamps, jars, berries and lit
candles; subsequent border corrections retain modeled lighting coverage. These
are offline work/count measurements, not Minecraft CPU or FPS measurements.

Non-debug players skip the periodic depth cache. Initial generation uses two-ms
cooperative slices, 32-write batches and yielding walking-distance searches.
One native call may exceed a cooperative slice.

Owner-reported loaded-village samples, 2026-10-16:

| 30-second run | Ticks | TPS | Average gap | p95 | p99 | Longest | Gaps >100 ms | Support callbacks/s | Support records |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 601 | 20.0 (100%) | 49.9 ms | 63 ms | 65 ms | 80 ms | 0 | 6 | 180 |
| 2 | 601 | 20.0 (100%) | 50.0 ms | 63 ms | 64 ms | 64 ms | 0 | 7 | 341 |

Owner accepted these results (the `/scriptevent lothlorien:tps` probe that produced them was removed
on 2026-10-29; git history keeps it). These windows establish healthy tick cadence; they do not measure
FPS, isolate callback CPU or certify every device. No further profiling is required
for this accepted milestone.

Final offline checks: full `mods verify lothlorien` passed with zero errors,
zero warnings and 15 existing documented exceptions. Simulation seeds 1..100
produced 100 distinct layouts with zero failures, unreachable walk cells or link
walk/light failures. Regressions cover seats, wood supports, fence targets and
edits, unload safety, planter coverage, cushion protection and bridge preservation.
All available static planter faces were covered (261 correctly mounted panels),
with runtime healer/gardener coverage in all four orientations and sizes k 4..7.

Final corrective deployment copied 30 BP files; RP was current and both packs
were in sync. Owner subsequently accepted the villages. Changes are one-shot:
existing structures do not regenerate; natural worldgen changes need a new world.
Iteration scratch was removed upon acceptance. Production generators and tests
remain for maintenance. Shared evidence is recorded separately in workspace
commits a6218e2, 469a0ae and a56c3de, followed by the owner-acceptance record.
