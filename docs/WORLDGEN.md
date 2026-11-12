# Natural world generation

Final design as shipped for Bedrock 1.26.x. The 2026-10-16..29 history (group probes, sparse-grid audit, constrained-feature
probe pack, dense-grid test) lives in git; the last commit that still has the probe documents is `edcaf72`.
Engine facts and primary sources: workspace skill `bedrock-worldgen`, references `10-jigsaw-pieces.md`,
`21-jigsaw-worldgen-policy.md` and `24-structure-placement-survey.md`. **Worldgen changes need a new world.**

## The biome

| File | Role |
|---|---|
| `lothlorien_bp/biomes/lothlorien.biome.json` | server biome: climate, surface, replacement, tags |
| `lothlorien_rp/biomes/lothlorien.client_biome.json` | grass/foliage/water/sky colours, fog, music, Vibrant Visuals identifiers |
| `lothlorien_rp/fogs/lothlorien_fog_setting.json` | `lothlorien:fog_lothlorien` |

- **Only `minecraft:replace_biomes` makes a custom biome generate** (stable since 1.21.110; `format_version` at least `1.21.110`). It re-labels part of the
  areas the vanilla generator chose as a target biome and **cannot change terrain shape**: Lothlórien has forest terrain because it replaces forests.
- `targets` are **namespaced** ids; bare `forest` (older docs) fails in 1.26 with "No biome found with name" and the whole biome is dropped. Custom
  biomes cannot be targets, so a nested "heart" biome is not possible.
- **Shipped replacement:** targets `minecraft:forest`, `birch_forest`, `birch_forest_mutated`, `flower_forest`, `amount` 0.4, `noise_frequency_scale` 1.25.
  Findings from the tuning series (several seeds, owner in game): `amount` is the dial for both coverage and connectivity (near 0.5 the replaced side of the
  noise is one connected web); frequency only sets the scale, and at 1 or below the blobs are larger than any forest, so the target union bounds the
  region and lower frequency just spaces regions out. A forest cannot be converted "whole or not at all" from JSON; the outline follows vanilla forest
  shapes. Append new replacement entries at the end of the array, inserting earlier shifts the noise of existing ones. `roofed_forest` was dropped
  (dark forest would likely lose woodland mansions); `plains` would widen regions most but is very common (undecided). River-transparent depth is liked.
  Final region size is judged by testers (`TODO.md` section 2).
- Stable server components: `climate`, `creature_spawn_probability`, `humidity`, `map_tints`, `mountain_parameters`, `partially_frozen`, `replace_biomes`,
  `surface_builder`, `surface_material_adjustments`, `tags`. Fog, sky and grass colour are **client** components (`minecraft:client_biome`). Client
  grass/foliage take a flat `"color": "#rrggbb"` or a `color_map`.
- General biome knowledge: `.claude/skills/bedrock-worldgen/references/06-biomes.md`. `/locate biome` returns the nearest point of the biome, often its edge
  (possibly shallow water, because replacement keeps the terrain); walk to the centre. The biome is 3D, so caves under a replaced forest are Lothlórien too.

### Tags decide almost everything (no `monster` tag)

Spawn rules and feature rules find biomes only by tag. The biome has `overworld` (vanilla ores, caves, structures, spawns), `bee_habitat` and `lothlorien`
(our rules). `animal` gives vanilla passive spawns where wanted. There is **no `monster` tag**, so vanilla hostile surface spawn rules do not match. Not
covered: phantoms, patrols and raids, spawners, mobs walking in, other add-ons' mobs. The `forest` tag was removed once Mallorns existed (vanilla forest
trees stopped). Vanilla plants still matching by tag: tall grass and grass, the dandelion/poppy scatter (1 chunk in 32), pumpkins (1 in 300), reeds near
water, extra mushrooms. They are rare and deliberately not fought: excluding them needs a tag such as `plains` that also switches on villages or mooshroom
spawns. Ferns, forest flowers and forest grass belong to other tags and do not apply.

### Depth estimate (script) and the heart

`scripts/depth.js` (pure; sampler in `main.js`, `depthAt`) probes rings at 8/16/24/32/40 blocks at the surface under each point (at most 10 blocks apart,
83 probes); the first ring with a foreign biome bounds the border distance. Levels: edge (border <= 16), inner (<= 40), heart (farther);
`minecraft:river` counts as inside. It runs every 3 s per player (`DEPTH_INTERVAL_TICKS`, which reads as lag when crossing a border; accepted), never per
tick. `getBiome` throws in unloaded chunks: an unreadable probe stops the search and the level is the lowest one still certain (shown with `?` in the debug
bar); probes sample at the surface, since biomes are 3D. Owner-verified after that fix (2026-09-29). "Heart" means far from any border, not a designed
centre. The cost per estimate (`/scriptevent lothlorien:depth`, 200-run average) was never recorded; it matters for natural warden and white deer spawns.

Worldgen cannot see depth. The "deeper is richer" feel is approximated by world-position noise zones in the flora rules (below), independent of the biome
border; a scripted post-generation pass keyed to `estimateDepth` is the fallback that was never needed.

## What generates

| Content | How | Where it is described |
|---|---|---|
| Lothlorien biome | custom biome, tags, features | "The biome" below, `FLORA_DENSITY.md` |
| Ordinary Mallorn trees, flora | feature rules | "Ordinary Mallorn trees" below, `FLORA_DENSITY.md` |
| Village, platform Mallorn, plain Great Mallorn, root shrine | **one jigsaw structure set, the tree grid** (below) | this page, `ROOT_SHRINE.md`, `design/lothlorien_jigsaw_settlement.md` |
| Flower garden, leaf memorial | native constrained `structure_template_feature`s on one shared site lattice | `FLOWER_GARDEN.md`, `MEMORIAL.md` |

## Ordinary Mallorn trees

Natural trees are native, no script: `feature_rules/mallorn_trees_feature_rules.json` (surface pass, tag `lothlorien`, 5 tries per chunk) places
`select_mallorn_tree_with_litter_feature`: weighted 25 simple, 60 fancy (fancy_trunk with branches), 15 mega (2x2 trunk), vanilla `minecraft:tree_feature` shapes with our
blocks, then a leaf-carpet scatter (90 tries, gaussian +-5), a blossom scatter and nectar blooms (see Nectar); each cover feature is one weighted `places_block` list (amounts 4:3:2:1 and 6:3:1:1 in four directions, since 2026-11-12; in-game check pending). Worldgen leaves have `persistent` false and decay.
Test: `/place feature lothlorien:select_mallorn_tree_feature ~ ~ ~`. Feature rules cannot call script, so generator archetypes and platform branches exist only for
saplings; large builds are structures (see "Giant Mallorn builds").

Ground plants and their placement rules: `FLORA_DENSITY.md` ("Placement rules and owner decisions").

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

## Giant Mallorn builds

Owner-accepted in game 2026-09-30.

Shipped: two lookout trees (`mallorn_round_05`, `round_07`: flet, rope, loot chest) and four plain giants (`roundplain` 2, 3, 6, 8). Placement: the tree grid above.

- **Shape.** Round trunk (owner design 2026-10-01: the 4x4 without its corner cells, 12 cells), 30-38 high (tip narrows to 2x2), sunk 5 blocks. Its foot (`roundFoot`) is a skirt
  2 high plus 5-7 buttress ridges of `mallorn_wood` above ground and logs down to -5. A plank platform (radius 5.5-7, fence rim) sits on 6-8 level branches 9-12 below the top;
  an Elven rope (since 2026-10-02; existing worlds keep ladders) runs up the north face through a floor hole; a chest against the east face uses `loot_tables/chests/mallorn_flet.json`;
  no leaves from the floor to 3 above it within radius+4. Variants: `round` (lookout) and `roundplain` (`flet: false`); options `woven` (support branches through the platform)
  and `lush` (whorls of leafy branches); plain giants have 3-6 tilted ring branches (`bentBranch`) with leaves along their tops. Leaves further than 8 steps from a log are
  dropped at generation. Older square-trunk variants are in git before `d09188f`.
- **Pipeline.** Shape in `tools/flet_mallorn.mjs` (pure); `node tools/build_structures.mjs [variant|all] [count] [firstSeed]` writes `structures/lothlorien/mallorn_<variant>_NN.mcstructure`
  (40x54x40, trunk NW cell at x/z 18, ground at y 5, about 700 KB each), `scripts/giant_trees.js` and the legacy pool; the plain command rebuilds exactly `CHOSEN` (curation candidates never enter
  worldgen). Tree NN of every variant uses the same seed. Format traps: `.claude/skills/bedrock-worldgen/references/09-structures.md`. Tests (`tests/giant_trees.mjs`) check over 30 seeds that the
  rope is unbroken, the exit floor exists, the chest has room, leaves are within reach and everything fits the box.
- **Engine facts [V].** Jigsaw structures are stable since 1.21.120. `max_depth` 0 builds nothing (the one cause found after six one-change tests; now 1); `separation` must be less than half of
  `spacing`. `max_distance_from_center` 116. A 40-wide `structure_template_feature` is cut at chunk borders; script-grown markers only appear within simulation distance; jigsaw spans chunks.
  Every piece has a trunk anchor: the bottom trunk cell is a `minecraft:jigsaw` (name `lothlorien:giant_trunk`, empty target and pool, final state `mallorn_log`) named by `start_jigsaw_name`, so
  the trunk sits on the start point however the piece rotates. Spacing and density: the tree grid above.
- **Loot** (`tools/watch_camp_rules.mjs`, then `build_structures.mjs`): pool 1 rolls once (miruvor or lembas); pool 2 rolls 3-5 times from a weighted list (arrows weight 6, rope, antler weight 2, ...);
  pool 3 is the owner's 50 % silver-pattern shield. Chest `LootTable` fills when first opened (owner-verified 2026-09-29), so unopened chests pick up changes. Watch camps: `ELF_SERVICES.md`.

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
