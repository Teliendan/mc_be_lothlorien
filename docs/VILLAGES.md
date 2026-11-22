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
- Runtime light rule (owner decision 2026-11-21, `village_loop.js` `lightFill`; not verified in game): bridges (`planLights`), plazas (`plazaLanterns`)
  and merges (`mergeLanterns`) share ONE rule. Start from the existing emitters, find the first walk cell below `LOOP.lightTarget` (8) in a fixed scan
  order, put a light on the allowed candidate nearest to it (bridges: the hidden `light_block_14` above the walk strip or a rail post; plazas and merges:
  the light on the nearest rail post top), update the light field round that one light, repeat; no candidate within reach of a dark cell is the same
  "cannot light" error as before. One round per job step. It replaces the old "light that helps most" greedy: the same villages, links and
  repairs, but different (still invisible) hidden-light cells, and about 50 % more of them (842 span shapes: 4,022 -> 6,028 lights; 24 simulated villages:
  bridges 35 -> 48, plazas 4 -> 6). The bridge safety counts the hidden lights alone, as before (a visible lamp may be broken).
- Population runs as a job (2026-11-21, not verified in game): the posts query, one elf spawn per step, the pavilion furnishing in steps (<= 16 block writes, one structure placement
  per step), so the elves and the furnishing appear over about a second after the bridges instead of in one frame (`village_populate.js`, `docs/SCRIPT_PERFORMANCE.md`).
- Unused flat connector mouths get rails when no onward surface exists, including at the lower half-step; existing bridges and
  stairs stay open.
- Moss beds get open trapdoor borders on every available side (path-facing and off-deck sides supported by moss included);
  occupied furniture and cushion cells stay free. Only correctly facing open Mallorn trapdoors mounted against moss count as thin
  skirts in walking, lighting and bridge models: opposite 2.92/16-thick panels leave 0.635 blocks for the 0.6-wide player. Other
  screens and closed trapdoors are obstacles. Check 16, verified in game (owner, 1.26.63, 2026-11-17): the skirts stand on `light_block_0` beds, intact and walkable.
- Skirts and elf paths (owner saw in game, 1.26.63, 2026-11-22: elves try to JUMP over the open Mallorn trapdoors of the moss-bed skirts; offline hop model, cause of the cut-off cells not proven in game; `.claude/skills/bedrock-mobs/references/pathfinding.md`). A hop needs headroom, so a skirt in a 1-wide link can box in an elf post or a deck. Two generator rules, new villages only (existing villages untouched; the 1-2-cell nooks stay as they are, owner: only these two rules): (1) `home_furnish.js` `planFurnishGen`: no runtime skirt in a home's door lane (the marker lantern hangs over it) and none that is the only link, skirts counted as obstacles, to a deck cell of the pavilion square or its margin that was reachable from outside before (`keepLinks`); the structure builder reserves the whole home interior (door lane and post cell too) in `village_polish.mjs finishDressing`. (2) `tools/village_dress.mjs` `bothSidesSkirted`: no rim planter (`rimDressing`, `dressBalcony`, `dressLookout`) whose skirts would fill the cells at both ends of its row with a rail or no deck beyond one end (the 3-wide trunk-rail lane of `combo_node_e_*`, `balcony_braced`, `lookout_01`); the trunk-foot L beds and garden islands are not covered. Pots instead of the rejected beds (owner 2026-11-22, `bedPots` in `village_dress.mjs`): where `bothSidesSkirted` rejects a bed, one flower pot (a Lothlorien flower, about a quarter vanilla) stands on the nearest rail post, now and then a second item on another post (firefly jar or a second pot) and a decorated pot on the deck cell where the bed was only when `potKeepsLinks` allows it (every walkable cell of the level stays connected, no 1-wide lane); a rail top is no walk cell, so these pots cannot box an elf in. Own random stream per bed cell, so the dressing's stream does not move; the shipped pieces `combo_node_e_*` gain 4 pots and 2 decorated pots each, node_b and tower_b one pot, tower_c two jars. Hop model after the pots: cut-off cells and posts equal to the 246a9da numbers (strict lost 24 over 24 villages, posts 0; +y3 lost 159, posts 3). Homes (runtime `planFurnishGen`): no extra pots; the designed layouts already carry them and only about one panel per village was dropped there (limit, owner may ask again). Tests: `village-polish` (pots on the node_e rail posts, no floor pot or jar cuts the deck or stands in a 1-wide lane). Tests: `village-simulation` (30 seeds: no skirt in a door lane, every home post leads out with skirts as obstacles), `village-polish` (shipped `combo_node_e_*`, `balcony_braced`, `lookout_01`). Hop model over 24 simulated villages (`temp/trapdoor-paths/td2.mjs`, 2026-11-22), HEAD -> now: panels on routes median 141 -> 127; strict cut-off cells median 3 -> 1 (garden islands only), home posts cut off in the doubtful (+y3) variant 31 -> 3 over 24 villages, areas of 3+ cells 26 -> 3, largest cut-off area 131 -> 20 cells; hop pairs blocked at y+2 by the marker lantern 95 -> 2.
- Beds (owner decision 2026-11-21): a bed is "obstructed" when the cells round it are `light_block_0` (the worldgen headroom shield; verified in game 2026-11-20 on the healer bed after clearing its ring). The village builder now replaces EVERY `light_block_0` of a newly built village with air as its last step (`village_clear.js`; after planning, writing and populating, still inside the ticking areas), so any bed, also one a player places, works in a newly built village. This replaces the per-bed ring clearing of `6d2247e` (`bedClears`, removed). Villages that were already built keep their shield (no command, no migration; owner decision). A few leaves from later-generated trees may appear at the rim (accepted). Simulator, 20 seeds: about 7,900 cells per village (4,900 to 11,400) in 108 to 210 fill calls, Y band 21 to 37 layers.
- Owner fixes of 2026-11-17 (`6d2247e`, not re-tested; its bed-ring clearing is superseded by the line above): the healer bed said "obstructed" (inferred cause: the `light_block_0` headroom shield round the bed); the Court gets two cushions and a decorated pot at its rest corner (F17); the village debug switch follows the debug tag after a reload (E14).
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
