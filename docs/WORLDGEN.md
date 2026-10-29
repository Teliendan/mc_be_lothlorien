# Natural world generation

Final design as shipped for Bedrock 1.26.x. The 2026-10-16..29 history (group probes, sparse-grid audit, constrained-feature
probe pack, dense-grid test) lives in git; the last commit that still has the probe documents is `edcaf72`.
Engine facts and primary sources: workspace skill `bedrock-modding`, references `10-jigsaw-pieces.md`,
`21-jigsaw-worldgen-policy.md` and `24-structure-placement-survey.md`. **Worldgen changes need a new world.**

## What generates

| Content | How | Where it is described |
|---|---|---|
| Lothlorien biome | custom biome, tags, features | `TECHNICAL_NOTES.md` (Biome), `FLORA_DENSITY.md` |
| Ordinary Mallorn trees, flora | feature rules | `TECHNICAL_NOTES.md`, `FLORA_DENSITY.md` |
| Village, platform Mallorn, plain Great Mallorn, root shrine | **one jigsaw structure set, the tree grid** (below) | this page, `ROOT_SHRINE.md`, `design/lothlorien_jigsaw_settlement.md` |
| Flower garden, leaf memorial | native constrained `structure_template_feature`s on one shared site lattice | `FLOWER_GARDEN.md`, `MEMORIAL.md` |

## The tree grid (release design)

`worldgen/structure_sets/giant_mallorn.json`: `random_spread`, spacing 6, separation 2, salt 518204731 (the original giant
tree grid). Each candidate picks one structure by weight:

| Kind | Structure | Weight | Chance |
|---|---|---|---|
| Village | `lothlorien:elven_village` | 10 | 12.5 % (1 in 8) |
| Platform Mallorn (watch camp) | `lothlorien:tree_grid_platform` | 19 | 23.75 % |
| Plain Great Mallorn | `lothlorien:tree_grid_plain` | 33 | 41.25 % |
| Root shrine | `lothlorien:tree_grid_shrine` | 18 | 22.5 % |

Expected ratio per village: 1.9 platform : 3.3 plain : 1.8 shrines, plus gardens and memorials from their own lattice. These are
ratios over many attempts, not a quota per biome patch; there is no village-per-biome guarantee.

- `tools/build_tree_grid.mjs` writes the set and the three tree-category structures and pools; it splits the legacy mixed
  pool `template_pools/giant_mallorn.json` (written by `tools/build_structures.mjs`) into platform (2 variants), plain (4)
  and shrine (1) and keeps every original ground and assembly setting. `lothlorien:giant_mallorn` (the mixed structure) is
  command-only. `tests/tree_grid.mjs` checks weights, placement, the exact partition of the assets, per-category anchors and
  heights, and that no other set duplicates a kind.
- **Giants** (`tree_grid_*`): start height -5, `heightmap_projection ocean_floor`, `max_depth` 1, terrain adaptation `none`,
  biome tag `lothlorien`. `ocean_floor` measures from the lake bed: on land it equals `world_surface` (structures run before
  trees exist), on water the trunk stands on the bed (owner decision 2026-10-27, after a tester found a giant hovering over a
  river). A lone giant in a small all-water patch still happens, and a deep lake can submerge the lower crown (wiki
  limitation `lothlorien:great_mallorn/lake-sites`).
- **Village**: start height -17, `world_surface`, `max_depth` 2, horizontal and vertical limit 116, one rigid build at one
  height. Runtime repair (script) adds what the rigid jigsaw cannot: roots to the real ground or lake bed, flares, forest
  floor, rails and furnishing (`design/lothlorien_jigsaw_settlement.md`, `VILLAGES.md`).
- **Gardens and memorials** are not in this set. Their lattice is `SITES` in `tools/site_feature.mjs`.

### Limit: independent starts can overlap

Owner decision 2026-10-24: after the 2026-10-20/21 fixes were tested in a new world, the owner accepted the tree grid as
"as good as we can make it", overlaps included. Bedrock offers no native way to reject a start because another structure is
near (`biome_filters` is the only start filter; there is no exclusion list like the Java mods use). What was checked:

- A single shared set spaced for the village's reach (116 blocks plus finishing margin) would have 17 to 47 times fewer
  candidates than the old grid. The owner rejected that as too rare; `tools/worldgen_spacing.mjs` and `tests/worldgen_spacing.mjs`
  keep the arithmetic (suite `worldgen-spacing`).
- Coordinated multi-build groups looked artificial and were rejected; scripted placement on approach (builds popping in) is
  rejected too. Native generation only.
- `minecraft:protected_blocks` processors only preserve blocks; they would leave later builds partial, which the owner
  forbids ("every build should be complete"). Not used.
- Constrained `structure_template_feature` rejects a whole template when it would hit an obstacle, but a feature is cut at
  chunk borders, so it only works for builds that fit in one chunk (garden 13 x 13, memorial 11 x 15). Large saved trees stay
  jigsaw. List pool elements are rejected by the 1.26.52 loader; only empty, single and feature elements parse.
- Direct single-template jigsaw children generate complete (8 of 8 natural sites checked by the owner).

So where independent starts overlap, a build can be cut. This is a known issue (`TODO.md` section 4).

## Terrain and water decisions

- Terrain adaptation is `none` everywhere; every build is rigid. Slopes are handled by deep roots and buried foundations, not by
  bending the build. Terrain-matching links alone did not solve slopes and the engine's mixed-projection handling already
  fixes the one-block sink (no compensating offset).
- Village supports reach the ground whatever the height: root down, root flare and loop piers search the whole overworld
  height (`WORLD_HEIGHT` 384 in `village_repair.js`, `LOOP.pierMaxDepth` in `village_loop.js`). Over water the prop roots leave
  the trunk two blocks above the surface and step out and down, with no leaves under water.
- Village foliage that would fill a lookout: explicit air up to three blocks above anything solid is `minecraft:light_block_0`
  (`shieldHeadroom`, `tools/build_village.mjs`); tree-feature leaves may replace air, never a light block.
- Gardens and memorials: `tools/ground_skirt.mjs` and the feature templates put soil under the footprint; the grass or deck
  row is level with the terrain top, extra dirt is below (owner correction 2026-10-24, starts -5 and -6 for the jigsaw
  copies). Water sites are refused by the feature allowlist.
- Water sites cannot be excluded for jigsaw builds (only `biome_filters`, `heightmap_projection` and waterlogging settings
  exist), so villages may stand at lakes.
- A structure does not set a biome. `inBiome` (Harmony, Renown) accepts village territory through `village_area.js`: loading the
  first loop marker records a search box, and only Mallorn planks, heartwood, slabs or stairs within two blocks horizontally of
  a 5x5 column query count (natural logs, leaves and empty margins do not). Biome colours and fog are unchanged; the API has
  no biome setter.
- Trees may root on garden grass (accepted). Deep piles in templates, "Beard" terrain adaptation (conflicts with the deep
  roots) and village streets at individual heights are not used (owner, 2026-10-28, after the survey of other add-ons).

## Owner checks still open for worldgen (new world)

Hanging village trees rooted to the ground or lake bed, no leaves in lookouts and decks, cushions present; hilltop villages
with supports to the ground; giants on land unchanged and a giant in a lake standing on the bed; garden soil and memorial
deck level with the terrain, shoreline flooding; Harmony and Renown at a village edge outside the biome; village frequency
feel; the shared site lattice (chance 2/5) as seen in game. The worldgen items in `TODO.md` section 2 are for testers.
