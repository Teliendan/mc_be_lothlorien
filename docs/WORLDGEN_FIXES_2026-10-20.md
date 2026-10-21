# Worldgen fixes after Test G (2026-10-20)

Owner review of natural generation in world "Test G" (Bedrock 1.26.52). Owner decisions, what was
built, and what still needs an in-game check. Everything below is offline-tested and deployed;
**nothing here is verified in game yet. Worldgen changes need a new world.**

## Evidence from the save

Read-only dumps with `tools/world_scan.py "Test G" --dump`:
- Flooded garden at -1525..-1515, -1253..-1243: garden grass at y61, flowers at y62 = the lake's
  water top. Start height -2 with `world_surface` counts the **water** top as the surface, so the
  old garden sat one block below it (and one block sunk into dry ground everywhere else).
- "Hanging pillars" at -1360,-1234 and -1393,-1200 are whole village trees, not balcony pillars:
  3x3 trunks with a 5x5 collar ending at y69, over a 20-deep lake (water top 62, bed ~37) and
  6-24 blocks above a stone cliff. The village is one rigid build at one height.

## Decisions and implementation

| # | Owner issue / decision | Built |
|---|---|---|
| 1 | Natural Mallorn leaves filled a lookout; cushions lost | Village pieces: explicit air up to 3 above anything solid is `minecraft:light_block_0` (`shieldHeadroom`, `tools/build_village.mjs`). Tree-feature leaves may replace air, never a light block. Planner/repair/furnish read it as air; furnishing and planter panels may write into it (level 0 only; real hidden lights stay protected). |
| 2 | Edge villages outside the biome: count them as Lothlorien | Gameplay only: `inBiome` (Harmony, Renown) also accepts planned village rects (`lothlorien:village_plans`, `villageAreaTest` in `village_planner.js`). Biome colours/fog unchanged (no biome setter). |
| 3 | Hanging trees: "to the ground through water, but no leaves under water" | Repair pass `planRootDown` (`village_repair.js`): every trunk (and balcony/lookout pillar) column of the lower section incl. the collar goes down to the real ground, two blocks into it. Land: 1-3 lying roots per side following the terrain. Water: prop roots leave the trunk 2 above the water and step out and down two blocks per step (face-connected, never a thin diagonal), then drop to the bed. No leaves. Reach 48; deeper stays as is. Runs before rope fit, flares and forest floor. |
| 4 | Garden: deeper soil, 4 clear above, soil round the sides, no flooding; memorial too | `tools/ground_skirt.mjs`: 6 soil layers under the footprint, ring 1 (~80 %) one step down, ring 2 (~40 %) two steps down. Clearance 4. Raised: garden grass and memorial deck one above the terrain top (start 0 / -1). Over water the build stands on its soil instead of flooding. |
| 5 | Big Mallorns near villages | No change. |
| 6 | Villages too frequent | 2026-10-20: village 4 / platform 10 / plain 17 / shrine 9 (1 in 10). **2026-10-21, owner: 1 in 8** -> village 10 / platform 19 / plain 33 / shrine 18 (total 80, tree ratios kept within 1 %). Neighbouring villages still happen; fewer, not eliminated. |
| 6b | Garden and memorial usually side by side (2026-10-21) | They had two independent 12/4 grids. Now one shared set `lothlorien:garden_sites` (`structure_sets/garden_sites.json`, salt 794231583, spacing 9 / separation 3): each candidate places a garden or a memorial (1:1), so they never pair up; combined count ~11 % below the old two grids. |
| 4b | Exclude water sites? (2026-10-21) | Not possible natively: jigsaw has only `biome_filters` (a lake inside the forest is Lothlorien biome), `heightmap_projection` (world_surface counts the water top; ocean_floor sinks the build) and waterlogging `liquid_settings`. Owner chose to keep the deployed island behaviour (6 soil layers + shoulder, one above the water); no fill to the lake bed. |
| 7 | Biome cover | Not now: same-seed experiment series later (see `06-biomes.md`). |

Rejected for issue 4: a constrained feature in `after_surface_pass` would almost never fit in a
dense forest (a log in the footprint rejects it).

## Test in game (new world)

- `/locate structure lothlorien:elven_village`: hanging trees rooted to ground or lake bed, prop
  roots above water, no leaves in lookouts/decks, cushions present, furnishing still placed.
- Gardens and memorials: raised one block, shoulder looks natural, never flooded.
- Harmony/Renown at a village whose edge leaves the biome.
- Village frequency feel.

Committed in `1855fa8`. Scratch: `temp/worldgen-fixes/` (dumps, debug scripts). Delete when accepted.
