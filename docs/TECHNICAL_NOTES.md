# Lothlórien: technical notes

Engine facts checked against the installed game data (`C:\mcmods\reference\vanilla\current`) and the docs, kept so nobody re-derives
them. Design lives in `design/`, mob sheets in `mobs/`, the natural placement of builds in `WORLDGEN.md`. This file holds the final
design, verified behaviour, owner decisions and real limits; the build-by-build history is in git. Section titles keep the old phase
numbers in parentheses because skills and other docs link to them. Statuses: "owner-verified" means seen in game by the owner;
"status unverified" means no record of a game check was found.

Pointers for later interaction audits (owner-approved decisions, deferred-use snapshots, native engine checks): [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md)
and [parity/CREATURES.md](parity/CREATURES.md). Water and snow policies: [WATER.md](WATER.md), [SNOW.md](SNOW.md). Post-passes that keep data
policies stable across art regeneration run from `tools/configure_support.py` (flora, decor/rope, food and remedy, leaf and tree interactions,
controls); they preserve rope fuel 15, chandelier stack 64, lantern item tags and the one-antler/four-lantern recipe. Bone meal on leaf litter
and blossoms was removed by the owner (2026-10-19): they are fallen material.

## Biome (was Phase 1)

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
- General biome knowledge: `.claude/skills/bedrock-modding/references/06-biomes.md`. `/locate biome` returns the nearest point of the biome, often its edge
  (possibly shallow water, because replacement keeps the terrain); walk to the centre. The biome is 3D, so caves under a replaced forest are Lothlórien too.

### Tags decide almost everything (No monster)

Spawn rules and feature rules find biomes only by tag. The biome has `overworld` (vanilla ores, caves, structures, spawns), `bee_habitat` and `lothlorien`
(our rules). `animal` gives vanilla passive spawns where wanted. There is **no `monster` tag**, so vanilla hostile surface spawn rules do not match. Not
covered: phantoms, patrols and raids, spawners, mobs walking in, other add-ons' mobs. The `forest` tag was removed once Mallorns existed (vanilla forest
trees stopped). Vanilla plants still matching by tag: tall grass and grass, the dandelion/poppy scatter (1 chunk in 32), pumpkins (1 in 300), reeds near
water, extra mushrooms. They are rare and deliberately not fought: excluding them needs a tag such as `plains` that also switches on villages or mooshroom
spawns. Ferns, forest flowers and forest grass belong to other tags and do not apply.

### Debug commands that stay in the pack

`/scriptevent lothlorien:debug` toggles an action-bar readout (biome id, depth level, hostile mobs within 64 blocks) and switches on every diagnostic
content-log line through `village_debug.js` (planner, elf village summary, rail mender, warden replace); only failures log unconditionally. `depth`
prints the depth estimate and its cost; `harmony [value]` shows or sets Harmony; `renown ...` is described under Renown. Everything else (showcase, grow,
growbig, treestats, treecount, critters, deer, survey, speed, tps, village, elf, trade and the landscape probe) was removed from the pack (cleanups
2026-09-30 and 2026-10-29); copies of the useful ones are in `tools/dev_scripts/` (see its README), the last commit with them in the pack for the first
cleanup is `dc1182e`.

## Depth estimate and the heart (was Phase 2)

`scripts/depth.js` (pure; sampler in `main.js`, `depthAt`) probes rings at 8/16/24/32/40 blocks at the surface under each point (at most 10 blocks apart,
83 probes); the first ring with a foreign biome bounds the border distance. Levels: edge (border <= 16), inner (<= 40), heart (farther);
`minecraft:river` counts as inside. It runs every 3 s per player (`DEPTH_INTERVAL_TICKS`, which reads as lag when crossing a border; accepted), never per
tick. `getBiome` throws in unloaded chunks: an unreadable probe stops the search and the level is the lowest one still certain (shown with `?` in the debug
bar); probes sample at the surface, since biomes are 3D. Owner-verified after that fix (2026-09-29). "Heart" means far from any border, not a designed
centre. The cost per estimate (`/scriptevent lothlorien:depth`, 200-run average) was never recorded; it matters for natural warden and white deer spawns.

Worldgen cannot see depth. The "deeper is richer" feel is approximated by world-position noise zones in the flora rules (below), independent of the biome
border; a scripted post-generation pass keyed to `estimateDepth` is the fallback that was never needed.

## Mallorn wood set (was Phase 3)

Block format **1.26.50**; both manifests need `min_engine_version` 1.26.50 (multi-box collision, `minecraft:tags` and `minecraft:sound` are format-gated; `tag:*`
keys no longer work). Blocks (`lothlorien:mallorn_` + `log`, `stripped_log`, `wood`, `stripped_wood`, `planks`, `leaves`, `stairs`, `slab`, `double_slab` (hidden),
`fence`, `fence_gate`, `door`, `trapdoor`, `button`, `pressure_plate`). Art generators: `tools/make_mallorn_*.py` (status `GRAPHICS_TASKS.md`; lessons
`MALLORN_WOOD_LESSONS.md`). Every block except the double slab has an item that replaces the auto block item (needed for `minecraft:fuel`); the door also has a
2D icon. Recipes and unlocks mirror vanilla wood types.

- **Two plank sets.** Planks from log/wood are silver `mallorn_planks`; planks from stripped log/wood are `mallorn_heartwood_planks`. The heartwood family
  (planks, stairs, slab, double_slab, fence, fence_gate, door, trapdoor, button, pressure_plate) is generated by `tools/make_heartwood_set.py` from the silver
  files (identifiers, texture keys and map colour swapped, geometry shared): change the silver block, then re-run it (a test fails on drift). `blocks.js` lists
  both in `WOODS`; a double door pairs only with the same kind of door; silver and heartwood fences connect to each other.
- **Carved fence and gate** (owner: beautiful, works): `tools/make_mallorn_fence.py` and `make_mallorn_gate.py` (variant C). Each fence rail is one tilted 2x2
  cube (inverted V); post faces use the `*` material `mallorn_fence_post`; selection and collision boxes unchanged. Geometry format 1.26.50: a `shelf` display
  transform is only accepted from 1.26.40, otherwise the whole file is dropped (icons vanished once).
- Tools: every wood block carries `minecraft:is_axe_item_destructible`; leaves use the hoe tag. Logs and bark-covered wood: `block_face` trait plus three-axis
  rotation permutations. Stripping is a guarded world interaction in `blocks.js` (native or tagged axes, native durability chance); the axe swing does not play
  (`OWNER_CHECKS.md`).
- **Stairs:** native corners from `placement_direction` with `minecraft:corner_and_cardinal_direction` (5 shapes x 2 halves x 4 directions = 40 permutations,
  multi-box collision); the engine updates `corner` itself. Left/right follow Java. **Axis trap:** block geometry draws x mirrored while `collision_box` uses world
  x, so the geometry cubes are the collision boxes with x negated (owner-verified 2026-09-29). Regenerate with `.claude/skills/bedrock-blocks/scripts/gen_stairs.py`.
- **Slabs:** `vertical_half`; merging in a `playerInteractWithBlock` world event (also for a neighbouring block whose face points into a slab cell); deferred
  writes revalidate target, water and the original selected slot and item. Both slabs have 15-second fuel and the native combine sound.
- **Fence:** the `connection` trait connects to fences, gates and solid blocks (vanilla uses `minecraft:has_fence_connections`). **Door:** two-part multi-block
  with `open` and `hinge_right` states; a script picks the hinge (same-facing bottom neighbours with their handles toward the new door pair; the full solid-face
  rule is an open limit, see `NOT_IMPLEMENTED.md`); synchronized double doors are owner-approved custom behaviour.
- **Redstone:** trapdoor, gate and door open by interaction and by redstone through `lothlorien:redstone_toggle`, edge-detected against a stored `powered`
  state because the engine also fires updates on placement and chunk load. Button and plate are `minecraft:redstone_producer`; buttons release after 30 ticks
  through a powered-only native tick; the plate polls every 4 ticks idle / 20 ticks powered with a minimum-hold guard and `placement_filter` `allowed_faces: ["up"]`.
  East/west wall buttons use `mallorn_button_ew(_pressed)` (a 4x6 box with `uv_rotation` 90). Support loss for buttons and plates is handled in `blocks.js`.
- **Icons:** every non-cube plank-family block names an icon geometry in `minecraft:item_visual` whose `item_display_transforms.gui` sets rotation, scale 0.625 and
  `fit_to_frame: false` (poses from Kaioga's 1.26.50 templates; rule in `bedrock-block-families/references/families.md` "Item icons"). Owner-verified 2026-10-01.
- Items left out (signs, shelf, ...): `NOT_IMPLEMENTED.md`.

## Saplings, small and big Mallorns, leaf decay (was Phase 4 and 4b)

Files: `scripts/mallorn_tree.js` (pure generator), `scripts/trees.js` (growth, bone meal, decay), `blocks/mallorn_sapling.json`, `items/mallorn_acorn.json`.

- **Loop:** leaves drop acorns (2 % per leaf, `loot_tables/blocks/mallorn_leaves.json`), the acorn places `mallorn_sapling` (hidden from the menu, loot one acorn), the
  sapling grows a tree. Saplings need the approved soil list including mycelium (`placement_filter` plus the event-driven support service); random growth reads
  light >= 9 above, ordinary bone meal can work in darkness. Stage 0 -> 1 -> tree, each step 1/7 per random tick; bone meal advances a step with 45 %. The trunk needs
  room (air, leaves, soft plants). Balance estimate: about 4 acorns if every leaf of a small tree is cleared, so a tree replaces itself; `node tests/tree_stats.mjs [n] [chance]`.
- **Tree:** each tree draws an archetype (slender, round, spreading, tiered, tall): trunk 6-13, 3-5 level branches just under the crown (a base for a platform), 0-3 low
  branches, 1-5 rising ones, leaf blobs. Average about 32 logs and 200 leaves. **Big Mallorn:** four saplings in a 2x2 square grow one tree with a 2x2 trunk (15-24
  high, about 140 logs, about 1500 leaves), placed over ticks with `system.runJob`.
- **Natural trees** (native, no script): `feature_rules/mallorn_trees_feature_rules.json` (surface pass, tag `lothlorien`, 5 tries per chunk) places
  `select_mallorn_tree_with_litter_feature`: weighted 25 simple, 60 fancy (fancy_trunk with branches), 15 mega (2x2 trunk), vanilla `minecraft:tree_feature` shapes with our
  blocks, then a leaf-carpet scatter (90 tries, gaussian +-5), a blossom scatter and nectar blooms (see Nectar). Worldgen leaves have `persistent` false and decay.
  Test: `/place feature lothlorien:select_mallorn_tree_feature ~ ~ ~`. Feature rules cannot call script, so generator archetypes and platform branches exist only for
  saplings; large builds are structures (next section).
- **Leaf decay:** state `lothlorien:persistent`; player-placed leaves are persistent; grown and worldgen leaves break with drops on a random tick if no supported vanilla or
  Mallorn log/wood is within **10** steps through leaves (an unloaded neighbour counts as connected; Bedrock's own reach is 4). Reach 6 stripped live big trees (crown
  leaves sit 8+ steps from a log; game-tested 2026-09-29). Search bound 4000 nodes, verdicts cached 60 s per leaf (a felled tree decays up to a minute later). Details
  `LEAF_HARVEST.md`. The 20-tree cut-down balance test was never run (status unverified).

## Giant Mallorns (was Phase 5; owner-accepted in game 2026-09-30)

Shipped: two lookout trees (`mallorn_round_05`, `round_07`: flet, rope, loot chest) and four plain giants (`roundplain` 2, 3, 6, 8). Placement: `WORLDGEN.md`.

- **Shape.** Round trunk (owner design 2026-10-01: the 4x4 without its corner cells, 12 cells), 30-38 high (tip narrows to 2x2), sunk 5 blocks. Its foot (`roundFoot`) is a skirt
  2 high plus 5-7 buttress ridges of `mallorn_wood` above ground and logs down to -5. A plank platform (radius 5.5-7, fence rim) sits on 6-8 level branches 9-12 below the top;
  an Elven rope (since 2026-10-02; existing worlds keep ladders) runs up the north face through a floor hole; a chest against the east face uses `loot_tables/chests/mallorn_flet.json`;
  no leaves from the floor to 3 above it within radius+4. Variants: `round` (lookout) and `roundplain` (`flet: false`); options `woven` (support branches through the platform)
  and `lush` (whorls of leafy branches); plain giants have 3-6 tilted ring branches (`bentBranch`) with leaves along their tops. Leaves further than 8 steps from a log are
  dropped at generation. Older square-trunk variants are in git before `d09188f`.
- **Pipeline.** Shape in `tools/flet_mallorn.mjs` (pure); `node tools/build_structures.mjs [variant|all] [count] [firstSeed]` writes `structures/lothlorien/mallorn_<variant>_NN.mcstructure`
  (40x54x40, trunk NW cell at x/z 18, ground at y 5, about 700 KB each), `scripts/giant_trees.js` and the legacy pool; the plain command rebuilds exactly `CHOSEN` (curation candidates never enter
  worldgen). Tree NN of every variant uses the same seed. Format traps: `.claude/skills/bedrock-modding/references/09-structures.md`. Tests (`tests/run.mjs`) check over 30 seeds that the
  rope is unbroken, the exit floor exists, the chest has room, leaves are within reach and everything fits the box.
- **Engine facts [V].** Jigsaw structures are stable since 1.21.120. `max_depth` 0 builds nothing (the one cause found after six one-change tests; now 1); `separation` must be less than half of
  `spacing`. `max_distance_from_center` 116. A 40-wide `structure_template_feature` is cut at chunk borders; script-grown markers only appear within simulation distance; jigsaw spans chunks.
  Every piece has a trunk anchor: the bottom trunk cell is a `minecraft:jigsaw` (name `lothlorien:giant_trunk`, empty target and pool, final state `mallorn_log`) named by `start_jigsaw_name`, so
  the trunk sits on the start point however the piece rotates. Spacing and density are discussed in `WORLDGEN.md`.
- **Loot** (`tools/watch_camp_rules.mjs`, then `build_structures.mjs`): pool 1 rolls once (miruvor or lembas); pool 2 rolls 3-5 times from a weighted list (arrows weight 6, rope, antler weight 2, ...);
  pool 3 is the owner's 50 % silver-pattern shield. Chest `LootTable` fills when first opened (owner-verified 2026-09-29), so unopened chests pick up changes. Watch camps: `ELF_SERVICES.md`.

## Flora, ground cover and worldgen tuning (was Phase 6)

- **Plants** `elanor`, `niphredil`, `athelas`, `golden_fern`: `minecraft:geometry.cross` (their own `plant_cross` copy), `alpha_test`, no collision, break instantly, soil-only `placement_filter`; each
  has an item of the same identifier (2D icon, creative group flower) and a block with no menu category. **Ground covers** `mallorn_leaf_carpet` (opaque) and `mallorn_blossom` (cutout), made by
  `tools/generate_ground_cover.py`: state `lothlorien:amount` 1-4 quarter-tiles (`geometry.lothlorien.ground_cover_1..4`), rotated by `placement_direction`; using the item adds a segment, breaking
  drops one item per segment (`scripts/ground_cover.js`). Worldgen places weighted amounts (carpet 4:3:2:1, blossoms 6:3:1:1). All plants and thin blocks have `light_dampening` 0. Art: `GRAPHICS_TASKS.md`.
- **Worldgen (native JSON).** `single_block_feature` uses `enforce_placement_rules: true`, so the plants' `placement_filter` decides where they stand. Zone rules use `query.noise(origin/120)`;
  the lesson of the tuning: **noise thresholds are very steep** (0.3 gave "many", 0.5 gave none), so every flower has a sparse baseline everywhere plus noise zones; do not go above about 0.4 on a
  zone rule without a baseline. Elanor and Niphredil zones are independent noise fields. Current values live in `feature_rules/*_patch_*` and `*_sparse_*` (e.g. Elanor zone threshold 0.4, 2 iterations;
  golden fern 1 iteration, 1 chunk in 2, small gaussian +-4 patches after the owner found it too much on 2026-10-02); densities and their owner decisions: `FLORA_DENSITY.md`. Extra vanilla fern and
  `short_grass` rules add ground cover. The decorative two-block wild flowers (rose bush, peony, lilac) never worked natively and were removed (owner, 2026-10-02); "Elven roses" as our own plant is an idea only.
- **Bone meal** (`scripts/bonemeal.js`, table in `flora_table.js`): on a grass block in the biome it cancels the vanilla effect and scatters tries within 3 blocks (short grass, Elanor, Niphredil, golden
  fern, Athelas, plain fern by weight); on our flora it grows Elanor, Niphredil and golden fern with 4 nearby tries, Athelas with 2 (grass and air required); guarded deferred consumption and debounce
  for the old repeated-event bug.
- **Falling leaves:** `rp/particles/falling_leaf.json` spawned by `fallLeaves` in `main.js` every 12 ticks per player inside the biome in a random column within 14 blocks (`leaf_fall.js` walks down to the
  first leaf with open air below); sparse by design; the texture is a 40x8 sheet picked by Molang (`tools/make_falling_leaf.py`). Rendering status unverified.
- **Grass under plants (owner-verified 2026-10-01).** Bedrock bug MCPE-184249 turns grass under custom plants into dirt in low light even with `light_dampening` 0. **Workaround (remove when Mojang fixes it):**
  Elanor, Niphredil, Athelas, golden fern, leaf carpet and blossoms have state `lothlorien:on_grass`; when true they draw a biome-tinted grass top (`*_grass` geometry twins, material `grass_overlay`).
  Applied by `.claude/skills/bedrock-block-families/scripts/add_grass_overlay.py` (re-run after `gen_ground_cover.py`); `scripts/grass_overlay.js` sets the state on placement over grass, worldgen places it true,
  bone meal calls `markOnGrass`, breaking such a plant turns the dirt back into grass. Place/break events only, no timers (owner). Not covered: removal by explosion, water, piston or fire; slope edges.
  To switch off: revert `defae73`, remove the script and its skill notes. Background: `.claude/skills/bedrock-blocks/references/blocks.md`.

### Mallorn leaf flicker (unsolved; accepted as a known issue, `TODO.md` section 4)

The leaves shimmer at high frequency; vanilla leaves do not. Established with the owner in game (2026-10-02): it is not the art (a vanilla leaf texture on all faces still flickered), not the MERS maps, not
binary alpha. The two saplings stopped flickering when their model changed from box-UV zero-thickness cubes to the single-face `plant_cross`. For the leaves: `alpha_test_to_opaque` fixed the leaves being invisible
from far away (with a dark colour under the transparent texels, `shade_hidden` in `make_mallorn_leaves.py`) and stays, but not the flicker. Data-driven culling (`minecraft:culling_layer.leaves`, with or without a
custom cube) stopped it but made the canopy hollow and needs the experimental toggle (on the plain cube with the toggle off the flicker remained). An inset cube (0.1) stopped it but showed a gap; at 0.05 with
`isotropic` it returned, and the inset-cube experiment was dropped (its generator is deleted, git has it). Conclusion: z-fighting between coplanar faces of touching leaf blocks; the known fixes look worse
(`GRAPHICS_TASKS.md`). Both leaf blocks are plain `geometry.full_block` with `alpha_test_to_opaque` and `isotropic` on up/down.

Mallorn leaves versus vanilla (parameter audit): same render method, sound `grass`, hardness and blast resistance 0.2, flammability 30/60, light dampening 1, no redstone conduction. Deliberate differences:
ambient occlusion 0 (faces next to logs went black, game-verified); colours baked, never biome-tinted; hoe-only tool tag (vanilla drops only with shears or Silk Touch, see `LEAF_HARVEST.md`); persistence state
plus script decay with reach 10; no waterlogging or composting in the first pass (since added, see parity doc).

## Western Corn and Lembas (was Phase 7; game-tested 2026-09-29, owner)

Files: `blocks/western_corn.json`, `scripts/crop.js` (component and bone meal helpers), `scripts/crop_rules.js` (pure growth numbers), `scripts/lembas.js`, items `western_corn_seeds`, `western_corn_grain`,
`lembas_dough`, `lembas_cake`, `lembas_wrapped`, recipes and the `western_corn(.json|_mature.json)` loot tables.

- **Loop:** find wild corn in Lothlórien -> harvest (mature: one grain plus Binomial(3+Fortune, 8/15) seeds; young: one seed, `WESTERN_CORN_HARVEST.md`) -> plant seeds on farmland anywhere -> craft **dough**
  (3 grain + 1 sugar -> 2) -> smelt in furnace or smoker -> **Lembas cake** (6 nutrition, 1.6 s) -> with one Mallorn leaves block -> **wrapped Lembas** (8 nutrition, saturation 19.2, eaten in 1.0 s, lifts Hunger through
  the item component `lothlorien:lembas`). Two Content Log fixes were needed: `saturation_modifier` must be a number, and food needs `minecraft:use_animation: "eat"`.
- **Crop block:** state `lothlorien:growth` 0-7, `geometry.cross`, stage texture by 7 permutations, mature loot chosen by a permutation that overrides `minecraft:loot`. Seeds place only on farmland
  (`block_placer.use_on`); the block's `placement_filter` also allows grass, dirt and podzol so worldgen can stand wild corn on grass. Random-tick growth only on farmland: 1/3 per tick wet, 1/5 dry; x0.6 at light 6-8, x0.3 at
  4-5, none below 4; about 20-35 minutes to ripen; bone meal adds 2-5 stages. Corn keeps a saved wild/farmed state.
- **Worldgen:** `western_corn_patch_feature_rules` (own noise field, threshold 0.4, 1 in 2 chunks in a zone, 7 tries +-2) plus a sparse baseline (1 chunk in 14) so it is always findable; both place growth 7.
- Observed in game: wild corn, growth with bone meal, dough, baking, eating. Status unverified: natural growth speed and low-light behaviour, wet versus dry farmland, the Hunger lift, food balance.
  Not done on purpose: trampled farmland leaving the crop on dirt (it survives but stops growing), water-flow breaking, fortune.

## Athelas salve and Miruvor (was Phase 8)

Items `athelas_salve`, `miruvor`; `scripts/athelas.js` (components `lothlorien:salve`, `lothlorien:miruvor`; effects come from script because item-JSON food effects are not available in 1.26.50).

- **Athelas** drops the plant item (raw Athelas is not edible: one item cannot both place and be eaten). **Salve:** 2 Athelas over a glass bottle; drink 1.6 s, stack 16, Regeneration II 6 s, lifts Poison, returns
  the glass bottle.
- **Miruvor (skin):** `minecraft:durability` 4 = 4 sips, stack 1, 30 s cooldown (native category `lothlorien_miruvor`, started explicitly after completion), drink 2.0 s, `use_modifiers` + `use_animation: drink`; the
  effects and durability loss run in `onCompleteUse`; the last sip removes the item (an empty reusable skin with refill is in `OWNER_CHECKS.md` retests). Per sip: instant health I, Regeneration II 8 s, Speed I
  30 s, lifts Poison. Recipe `ESE / SHS / NLN` = 2 Elanor, 2 Niphredil, 3 salves, 1 Mallorn nectar, 1 leather. Cancelled attempts impose no cooldown (owner-accepted 2026-10-14, `tests/miruvor.mjs`); `onCompleteUse`
  firing for a non-food item, the durability bar and write-back through the main-hand slot are verified in game. Creative sip preservation, plain Lembas compost 85 % and soul-campfire cooking: parity doc.
  Food balance, ingredient-only nectar, no extra corn uses and no raw-swan debuff are intentional.

## Harmony (replaces the earlier Disharmony; spec `design/harmony_rework_plan.md`)

- **Files.** `scripts/harmony.js` (pure: constants, `bandOf`, `DEED_COSTS`, `applyPenalty`, `recordDeed`, `recordDeath`, `tick`, `statusText`, `BAND_ICONS`, serialize/parse), `harmony_game.js` (wiring),
  consumers `deer.js`/`deer_rules.js`, `squirrel_rules.js`, `white_deer_rules.js`, `unicorn_rules.js`, `elven_warden.js` (fight hook).
- **Model.** One integer -60...+10 per player. +1 per 60 s inside the forest (to +10), +1 per 120 s outside but never above 0. A deed restarts the minute timer; above 0 a cost counts double. Bands: Friend +10,
  Guest 0..9, Uneasy -1..-14, Shunned -15..-29, Hated -30..-60. Storage: dynamic property `lothlorien:harmony` = `{harmony, timer}`, written only when the value changes.
- **Deeds** (`entityDie`, only `damageSource.damagingEntity` = player, projectiles included; counts when the player or the victim is in the forest; monster kills and warden-hunted players are free): `inanimate` nothing;
  unicorn 10; white deer 6; Elven Warden kill 6; elf kill 6; player 3; any other animal 3. A warden fight costs 1 (first player hit after 60 s), an elf fight 1 the same way. Dying changes nothing except dying in the
  forest while Hated (set to -29).
- **Hated tag.** The player tag `lothlorien_hated` follows the band; `entities/elven_warden.json` `nearest_attackable_target` has an entry for players with it.
- **Display.** Action bar, inside the forest only: `<icon> <band name>`, no number. Icons are glyphs of `lothlorien_rp/font/glyph_E5.png` (U+E500+n: friend ... hated), generated by `tools/make_harmony_icons.py`
  (technique `bedrock-art/references/font-glyphs.md`). Owner-checked OK in game (2026-10-24). One chat line per band change plus a rate-limited hint (30 s); texts in `localization/catalog.json`.
  The action bar belongs to this status: one-off messages go to chat. The glossary entry `glossary.disharmony` keeps the old word (changing it would invalidate every translation).

## Fauna spawning and despawn (was Phase 10)

Findings from the spike (owner-tested 2026-09-30, 1.26.52). `population_control: "animal"` is a fixed engine pool shared with cows and sheep: Lórien animals compete with vanilla ones for that cap.
**Despawn: use `{"despawn_from_distance": {}}` with no filters**: `filters` replace the engine's standard rules including the instant despawn at the simulation edge, so a mob left far away was never removed.
Standard rules: more than 128 blocks from every player removed at once; 32-128 a 1-in-800 roll after 30 s inactive; at the simulation edge removed at once; name-tagged mobs stay. Every current vanilla mob uses
this. Knowledge: `.claude/skills/bedrock-mobs/references/spawning.md`. The spike entity `test_critter` was replaced by the deer. The sampling tool is `tools/dev_scripts/critter_watch.js`.

## Deer (was Phase 11; sheet `mobs/deer.md`)

- **Wariness without per-player filters.** Entity filters cannot read a player's Harmony (a dynamic property), so the entity has one component group per wariness state
  (`lothlorien:state_calm|l1|l2|l3|friend|alarmed|tame`), each holding its own `behavior.avoid_mob_type` (flight distance, sneaking halves it) and, where allowed, `behavior.tempt`. `scripts/deer.js` runs every 2 s: each
  player votes for deer within 40 blocks, the most severe state among players inside their own state's flight radius wins, and the script fires `lothlorien:set_<state>` only when the `lothlorien:wariness` property
  differs. Trade-off: the avoid component flees from every player at the winning state's distance.
- **Alarm:** hurting or killing a deer fires `lothlorien:alarm` on every deer within 20 blocks: group `state_alarmed` (flee 36, no luring) with a 20 s `minecraft:timer` whose event `alarm_over` re-triggers the stored state;
  the script skips alarmed deer. Alarms cross species (swans, squirrels, white deer).
- **Food:** Western Corn grain only (tempt, `breed_items`, fawn `feed_items`); the acorn belongs to the white deer; seeds do not count.
- **Goal priorities:** breed 2, tempt 3, avoid 4 (tempt must outrank avoid or a lured deer runs at the edge; breeding must outrank both). Priority alone does not keep a lured deer: tempt stops on arrival and avoid takes
  over, so in calm and Friend the player entries of `avoid_mob_type` also need `has_equipment` (hand, the lure item) and `can_get_scared` is false. Fed deer get `lothlorien:tame` -> `state_tame`. Tame and untame are
  entity events (`become_tame`, `untame`), not `setProperty`: a property set by script is invisible to event filters until the next tick, so the state event is re-applied one tick later.
- **Kept deer:** tame or leashed adds group `lothlorien:kept` (`minecraft:persistent`); `untame` removes it only when not leashed, `unleashed` only when not tame.
- **Sex and antlers:** enum property `lothlorien:sex` (client synced) from `entity_spawned`/`entity_born`; geometry `deer_buck` (adult with antlers), `deer` (no antlers), `deer_baby`, picked by
  `query.property` in the render controller. Loot differs by sex through two adult groups (loot conditions cannot test custom properties). Venison carries item tag `minecraft:is_meat` (not inside `minecraft:food`:
  item format 1.26.50 rejects `is_meat` there, which stopped the items loading); the tag alone does not prove wolf feeding (parity doc). One furnace recipe carries furnace, smoker, campfire.
- **Model and animation:** procedural Molang (walk by `query.modified_distance_moved`, gallop pairs weighted `clamp((ground_speed - 3.5) / 2.5, 0, 1)`; the 3.5 m/s threshold is a guess); one slim cube per leg;
  all box sizes whole numbers (a fractional size put box-UV faces between texels and showed holes; `tools/make_deer.py` fails on fractional sizes or unpainted texels); bone z rotation has the same negated handedness
  as x. The engine logs `armor_offset.default_neck` locator warnings for a bone named `neck` (bone renamed `neck_joint`, antlers split into a separate geometry; the log text was not confirmed gone, status unverified).
  Art: `GRAPHICS_TASKS.md`. Sounds: `AMBIENT_SOUNDS.md`.
- Test protocol: `/summon lothlorien:deer`, approach (flight 10 blocks, 5 sneaking), corn lure, `/scriptevent lothlorien:harmony -40` for Hated flight 30, hurt one (herd bolts for 20 s), breeding with corn grain.

### Deer antler block

- `lothlorien:deer_antler` is a block; the same-named item (bucks drop it) is its `block_placer`. Traits `placement_position` (`minecraft:block_face`) and `placement_direction`. **Top face = a shed antler on the floor**,
  **side face = mounted antlers on a plaque** against the wall, **ceiling** too; one model (a big mounted pair filling the 16x16 face), rotated by coordinates in `tools/make_antler_block.py`. Selection boxes: floor/ceiling
  16x4.5x16, wall 16x16x4.5. There is **no `placement_filter`** (it can only name blocks or tags); the item-frame-like survival check is event-driven script (`scripts/antler.js`, `lothlorien:antler_support`,
  rules `antler_rules.js`): `beforeOnPlayerPlace` refuses unreadable or air/liquid support, and after `playerBreakBlock` and `blockExplode` neighbours are checked and an unsupported antler is destroyed. No polling.
  Not covered: pistons, water flow, other mods.
- **Natural drop:** `deer_antler_drop_feature_rules` (after surface pass, tag `lothlorien`, `scatter_chance` 1/16 per chunk, raised from 1/64 on 2026-10-02 because the owner found none), one placement attempt
  within about 3 blocks with a weighted pick of four facings, all `up`. **Owner decision 2026-10-24: solo antlers, no batches** (three attempts looked like a clump). The feature has its own support rule
  (`may_attach_to.bottom`: grass, dirt, coarse dirt, podzol, dirt with roots, moss, mud, stone; `may_replace: [air]`), so an antler never floats on litter; this excludes about a third of the floor. A save scan found
  the rate about 1/50 chunks at 1/64. Status unverified after the 1/16 change and the solo change. Chest loot: the antler in `mallorn_flet.json` pool 2 (weight 2).

## White deer guidance (was Phase 12; owner playtest 1.26.52: guidance, gift and nut growth work; sheet `mobs/white_deer.md`)

**The gift.** Leading the player to hidden flet markers was dropped (2026-09-30): script cannot find placed jigsaw instances, has no world seed, and `getBiome`/`getBlock` throw in unloaded chunks. The deer now picks
the destination: `findGiftSpot` (`white_deer.js`) samples the surface biome on an 8-block grid within 96 blocks (loaded chunks only), then 16 headings on rings 56..36 blocks (`GIFT_RINGS` in
`great_mallorn_rules.js`, inside a 4-chunk simulation distance whatever the player's setting) for Lothlórien biome and standable ground; `pickGiftSpot` takes the spot farthest from any known border (ties within 8
blocks go to the longer walk). Dynamic properties on the deer: `lothlorien:gift_spot` (kept until the gift is laid, so a broken guidance resumes) and `lothlorien:gifted`. On arrival (`ARRIVE_DIST` 3) `giveGift` spawns
the Great Mallorn nut (lore set by script) with totem particles. The marker block and its search were removed (worlds generated before keep one buried unknown block per flet giant).

**The nut** (`items/great_mallorn_nut.json`, `blocks/great_mallorn_sprout.json`, `scripts/great_mallorn.js` + `great_mallorn_rules.js`, art `tools/make_mallorn_seeds.py`): the sprout copies the sapling's states, soil
filter and geometry; random tick stage 0 -> 1 -> grow. Owner decision 2026-10-16: it grows only plain Great Mallorns (`roundplain` 2, 3, 6, 8; no platform, banners, chest or elves). Growing reads the structure's
filled cells once per session (job steps), checks each against the world with `isNatural` (terrain, plants, leaves, unstripped logs, water; anything else is built: wait and tell players within 32 blocks, at most every
5 minutes), then `structureManager.place` with the sprout in trunk cell TRUNK_AT+1 at ground level; the jigsaw anchor is replaced by `mallorn_wood`. Unloaded space means retry; rotation is always north. Growth time
and the obstruction message: status unverified.

**Entity decisions.** Separate `lothlorien:white_deer`, a loner (spawn herd 1, no breeding, baby, ageable or spawn-egg interaction), **leashable** (a lead always wins: a leashed deer refuses the acorn, leashing it
mid-guidance ends it), **always an antlered hart** (geometry `deer_buck`, texture `deer_white.png`). Drops: leather 0-2, venison 1-3 and **one antler on any death**; XP 1-3 on a player kill; killing it costs 6 Harmony.
Spawn rule: weight 3 (deer 10), herd 1 with event `lothlorien:spawn_natural`, `density_limit.surface` 1, `distance_filter` 24-44, pool `animal`. **Spawn thinned by depth** (owner: fewer near edges): the herd event
sets property `lothlorien:natural`; `white_deer.js` on `entitySpawn` (cause not `Loaded`) reads it one tick later, estimates depth at the deer's spot and keeps it with `SPAWN_KEEP_BY_DEPTH` outside 0, edge 0.15, inner
0.5, heart 1, else `entity.remove()` (no loot, no Harmony, no alarm; fails open if the event never arrives; `SPAWN_WEIGHT` is pinned to the spawn rule by a test; `/summon ... lothlorien:spawn_natural` goes through the filter).
Wariness uses the deer's state groups; only the **Mallorn acorn** lures it.

**The offer.** Right-click an adult white deer with a Mallorn acorn as a **Friend** (owner rule 2026-10-02; below 0 "shies from your restless spirit", not yet Friend "does not trust you yet", acorn kept). The entity has a
`minecraft:interact` entry for the held acorn ("Offer Acorn"); whether `playerInteractWithEntity` fires without it is unverified. The acorn is consumed only when guidance starts.

**Walking = engine pathfinding towards a moving helper.** Teleport-walking was rejected (jerky). `lothlorien:guide_beacon`: no gravity, collision or pushability (`minecraft:pushable` made the entity fail to load),
invulnerable, fire immune, 330 s `minecraft:timer` -> `instant_despawn`, a zero-size cube and transparent texture. One beacon per session is spawned at the first waypoint; `state_guiding` adds
`behavior.follow_target_leader` priority 2 (`leader_filters` family `lothlorien_guide_beacon`, `follow_distance` 1, `within_radius` 24, `search_cooldown` 5) plus the wolf/monster avoid goal. The goal choice lives in
`state_guiding`; `tools/dev_scripts/guide_goal/` holds the prepared alternatives (`follow_mob`, `target`) and a switch script, and `tests/run.mjs` fails if the group holds anything else. Every 5 ticks the script:
next waypoint when within 3 blocks (`pickWaypoint`: 14 blocks ahead, down to 8, headings 0, +-30, +-60, +-90), skips a heading after 5 s without progress, moves the beacon to the deer's feet when the player lags
more than 12 blocks, and ends with a final hop to the spot or a standable column within 5 blocks. `stand()` uses a ray from 6 above to 6 below (leaves looked through, liquid and logs reject, 1.9 headroom). The deer is
never teleported.

**Session end:** beacon removed and `guide_end` restores wariness via `alarm_over` when arrived within 3 blocks, the player is beyond 48 blocks, the player loses Harmony, 30 s pass without getting closer (counts as
arrived within 14 blocks), 5 minutes, or the deer is hurt. Sessions are not saved: on load and every 100 ticks every `guide_beacon` without a live session is removed (a beacon named or tagged `guide_beacon` is left
alone); a deer still in `state_guiding` after a reload is released by `deer.js`. Two deer guiding close together may follow each other's beacon (accepted). Not done: sounds on the way and at arrival.
Fallback research and the pathfinding comparison: `.claude/skills/bedrock-mobs/references/pathfinding.md` (dolphin treasure goals cannot target a custom spot; script has no navigation target API).

## Nectar, morning dew and Star canopy (was Phase 14b; status unverified except where noted)

- **Nectar bloom** `lothlorien:nectar_bloom` (`scripts/nectar.js`, `nectar_rules.js`, `tools/make_nectar_bloom.py`): state `lothlorien:nectar` 0-3, hangs under Mallorn leaves, logs or planks (`allowed_faces: ["down"]`),
  grows 1/7 per stage on random ticks only with Mallorn leaves above. A glass bottle on a full bloom gives `lothlorien:mallorn_nectar` and resets it; shears or Silk Touch collect one bloom. Worldgen: scatter
  (8 tries, y +2..18) at the end of the tree-with-litter aggregate; sapling-grown trees get 0-2 dry blooms.
- **Morning dew** (`dew.js`, `dew_rules.js`): bool state `lothlorien:dew` on leaf litter and blossoms (component `lothlorien:dew_cover`, random tick). Window time of day 23000..3000 with share `f` (0 at 23000, 1 at 3000):
  dry cover turns dewy with `DEW_APPEAR * (1 - f)` (litter 1/8, blossom 1/4) if Mallorn leaves are within 40 blocks above; dewy cover dries with `1/2 * f`; outside the window any random tick dries it. A visible dewy patch
  is always collectable (owner wants no empty outcome). Glass bottle -> `dew_bottle` (durability 8 = drops); the eighth drop makes `morning_dew`. Owner: "dew looks OK" (2026-10-11).
- **Star canopy** `lothlorien:star_canopy`: full block, light 6, 6-frame blended flipbook plus emissive MERS strip. Recipe LLL/DDD/TTT = 3 Mallorn leaves, 3 morning dew, 3 deepslate tiles -> 9. Unlock is the Bottle of
  Morning Dew (`OWNER_CHECKS.md`). Whether flipbook and MERS strip render correctly: status unverified.

## Swan, ground squirrel, unicorn (was Phase 15)

Sheets: `mobs/swan.md`, `mobs/squirrel.md`, `mobs/unicorn.md`. Owner tried squirrel and deer in game 2026-10-02 (very good); the swan floats with an occasional dip, left as is.

- **Shared wariness:** swan, squirrel and unicorn carry the deer's state groups, events and properties; `deer.js` drives all (`WARY_TYPES` in `deer_rules.js`); a test pins their flight radii to `FLIGHT_RADIUS` (the unicorn's
  `calm` flees like `l1`, only `friend` has the Elanor lure).
- **Swan** spawns in rivers too (spawn filter `any_of` tag `lothlorien` or `river`); `swan.js` removes natural spawns with no positively read Lothlórien sample within 48 blocks (25 samples, once per spawn). It floats with
  the chicken's float goal (turtle navigation dived, `minecraft:buoyant` sank it).
- **Squirrel errand** reuses the white deer machinery: `squirrel.js` drives `follow_target_leader` with a moved `guide_beacon`; `white_deer.js` exports `stand` and `addBeaconSource` (the stray-beacon sweep would
  delete it); acceptance consumes the stack synchronously and the four-entry gift table is rolled with `LootTableManager`. Gifts need **Friend** (owner rule 2026-10-02, for squirrel and white deer); luring and taming stay open to
  calm players. Outside or leashed squirrel feeding adds `kept`; inside wild healing and errands do not (owner 2026-10-20). Decisions and limits: parity doc.
- **Unicorn:** generated by `tools/make_unicorn.py` from the vanilla horse geometry, animations and white-horse texture (edit the generator). Swimming data equals the installed horse; bonded healing is native `healable`
  (Elanor 2 HP). **Bond = three Elanor offers** (`unicorn.js`: entity property `lothlorien:trust`, dynamic `last_offer` and `owner`); `lothlorien:become_tame` adds group `lothlorien:bonded` (rideable, persistent), which the
  state events never remove. No `minecraft:tameable`/`tamemount` (both consume items or tame without the Friend check). The Friend lure is vanilla `tempt` in a Friend-only group (final design: `OWNER_CHECKS.md`).

## Elven rope (was Phase 17b; owner-accepted 2026-10-02/03)

Recipe: 1 Bottle of morning dew over 1 golden fern -> 1 rope. Item `lothlorien:elven_rope` (stack 64, component `lothlorien:rope`, `onUseOn`); block with state `lothlorien:face` (the clicked face, wall opposite), flat on the wall
like a ladder, a knot every 8 units (art `tools/make_elven_rope.py`; the final icon is a short rope with one overhand knot). Placing (`scripts/elven_rope.js`, rules `elven_rope_rules.js`): on a side face one piece per item
down from the clicked cell, then up; using it on a piece extends that rope. **Breaking any piece breaks the whole rope** (one stack, nothing in Creative; no loot table on purpose); losing the wall of any piece (player or
explosion) drops it too.

**WORKAROUND, climbing by script** (no data-driven climbable for custom blocks in 1.26.52; listed in the workspace `docs/workarounds.md`, re-check after every game update), every tick for a player in a rope cell:
up (jump or forward) is levitation only (`levitationStep` picks the level from the levitation formula to hold `CLIMB.jumpSpeed`/`forwardSpeed` = 4); down is slow falling plus one tick of levitation I whenever the last
tick fell faster than `CLIMB.downSpeed` = 4 (`brakes`; lands at about 3.3 blocks/s, the icon flickers). Targets come from measuring a vanilla ladder. Failed, do not retry: teleporting a step per tick, steering with
`applyKnockback`, slow falling while climbing up, slow falling alone going down. Trap: a missing `brakes` import was hidden by the tick's try/catch (a test checks imports). Effect icons cannot be hidden per effect; replacing
vanilla icon textures was rejected. One-tick effects expire naturally and never remove or replay external potions. The lookout giants and the village use the rope (existing worlds keep ladders).

## Elven lighting (was Phase 17; generator `tools/make_elven_lamps.py`)

Silver **Elven Lantern** `lothlorien:elven_lantern` (light 14; two Mallorn trapdoors + Bottle of Fireflies; stands or hangs by the finial; owner-accepted design and compact icon 2026-10-03) and golden
`elven_lantern_heartwood` (same geometry with the silver-to-heartwood mapping `make_mallorn_wood.to_gold`, silver collar, heartwood trapdoors; in-game verdict unverified). **Elven chandelier** (light 15, ceiling only,
antler arms, five hanging lights; four antlers + Elven rope + silver lantern; placed model owner-accepted 2026-10-02). **Firefly jar** (light 11, floor only, blend glass, moss, animated flies; owner-accepted placed model). All four
use `itemGroup.name.lanterns`; glow and fly tiles use MERS maps. Face-only filters are in `VERIFIER_WARNINGS.md`.

## Elven village (jigsaw; accepted 2026-10-09, finished 2026-10-16)

Final design, owner decisions and toolkit: `design/lothlorien_jigsaw_settlement.md`; finish: `VILLAGES.md`; natural placement: `WORLDGEN.md`. Engine notes: `.claude/skills/bedrock-modding/references/10-jigsaw-pieces.md`.
Rebuild everything (deletes the old pieces first, byte-stable): `node tools/build_village.mjs`, then `.\mods verify lothlorien`.

**Connector standard** (generator and `tests/run.mjs` check it): one `minecraft:jigsaw` per connection in the deck layer on the outer face of the piece box, in the middle of a 3-wide walk opening, facing outward; `name`
`lothlorien:village_deck` (tower upper-level connectors `village_deck_hi`, parent only), `target` `village_deck`, joint `aligned`, `final_state` planks. Cross-section: deck under 5 cells, walk cells -1..+1 with 3 air above, rails
(`lothlorien:mallorn_fence`) at +-2; `writeRails` stores `minecraft:connection_*` states. Heights: `FLOOR_H` 16, `LEVEL_H` 8, `ROOTS` 18; pieces are `rigid`. A tree is platform piece + crown piece: the platform has an upward
jigsaw (joint `rollable`, name = target `lothlorien:village_crown`, final state plain mallorn log) on its trunk axis 5 above the highest deck; the crown box starts 6 above the deck.

| Piece (`lothlorien:village/<name>`) | Box x*y*z | Connectors |
|---|---|---|
| `central_mallorn_01` start: 23x23 octagon court, round trunk, rope, anchor | 23x48x23 | 4, points at combos (crown pool `crowns_central`) |
| `combo_<node>_<entry face>_bridge_<L>` (23 files): one slab-arched straight bridge (7..15) + the node or tower it leads to | 11-17 x 40 (48 with a tower) x 18-32 | 1 entry + 1-4 exits |
| `crown_small / medium / large`, `crown_central_a / b` | 15x16x15 .. 33x34x33 | down jigsaw |
| `balcony_braced` (rim balcony on a log pillar with 8 braces), `lookout_01`, `railing_end` plug | 7x44x7; 9x38x9; 5x2x1 | 1 |

- **Trees:** `flet_mallorn.mjs` shapes (`roundFoot`, `bentBranch`, `trimFarLeaves`); trunk 3x3 (central round), root flare at nominal ground, logs down to ROOTS, woven struts under each deck; crowns keep the trunk up to 40 % and taper,
  7-14 bent branches with blobs. **Bridges:** surface in half blocks `k(z) = min(z, L-1-z, top)` (top 2 for L <= 7, 4 for L >= 9), even k planks, odd k bottom `mallorn_slab`, every step 0.5 block; `scripts/village_bridge.js`
  `bridgeShape(length, offset, rise)` is shared by generator and runtime planner. **Spiral stair** (towers): the 16 ring cells round the 3x3 trunk, one half-step per cell; walkability rules (owner 2026-10-08) are enforced by
  `.claude/skills/bedrock-modding/scripts/structure_walk.mjs` inside `build_village.mjs` and by a shipped-piece sweep in `tests/run.mjs`.
- **Pools:** `start`; `combos` (weight 3, +2 tower combos; early ends railing 10, balcony 6, lookout 2; fallback `exits`); `exits` (railing 4, braced balcony 2, lookout 1; fallback `plugs`); `crowns` (large 3, medium 2; fallback
  `crowns_fallback` large 12, medium 8, small 1); `crowns_small`; `crowns_central`. **Structure** `lothlorien:elven_village`: `max_depth` 2, `start_height` -17 (Bedrock's `world_surface` is the top solid block, so -17 puts tree y 0
  on the first air cell), `terrain_adaptation` none, max distance 116.
- **Engine facts [V]:** vanilla-namespace states (`minecraft:block_face`, `connection_*`) turn with the piece, `lothlorien:*` states do not (the rope uses the structure-only twin `elven_rope_hanging`); Bedrock may drop a fence link toward the
  later-placed neighbour, repaired by `rail_mender` (template entity, once on load, own fences only); template entities are placed in jigsaw pieces (wardens, markers, posts); orphan leaves are trimmed last in `buildTree`/`buildCrown`.
- **Known limits:** a crown beside an upper-level balcony or bridge, or a tower combo box 6-7 blocks from the trunk, may find no room (sim: 0.27 stubs per village; the trunk then ends in a 3x3 log stub); stacked towers
  climb 8 per step (the sim peaks at 3 levels); rigid placement on uneven terrain; the walk checker treats a rail post above a half-high surface as a barrier cell.
- **Simulator** `node tools/village_sim.mjs [seeds] [firstSeed]` reads the real structures and pools, assembles villages with the Java algorithm (geometry verified against a real save) and checks connectors, rails across joints, crown
  continuity, overlaps, termination, 3D walkability, ropes, leaf decay, then runs the planner. 300 seeds: 0 failures, 300 distinct layouts, 6/30.8/51 pieces, 1/8.7/14 trees.

**Loop planner [V in game 2026-10-09: "I think it is finally working!"].** Replaced the per-marker closer (whose 44 markers per village never decided because each waited for every chunk within 36 blocks).
- *Trigger.* Tree and platform pieces carry `lothlorien:loop_marker` entities (one per straight rim run, a fallback on the lowest rail cell; crowns none). The first marker that loads or spawns (`entityLoad`/`entitySpawn`,
  `START_DELAY_TICKS` 5, serial queue) starts the planner. The village is found by flood fill; idempotence is the world property `lothlorien:village_plans` (at most 64 rectangles); markers in a done, running or failed rectangle are removed
  or skipped; all markers in the area are removed after the build.
- *Ticking area.* `discoverVillage` (`village_planner.js`): round 1 is 48 blocks round the first marker, later rounds the chunk-aligned hull of the known markers + margin 32 (28, 24 when `hasCapacity` says no), until no new marker (at most 8
  rounds); the previous area is removed once the next is up, always in `finally`. Verified: `maxChunkCount` 300, 2-3 rounds typical (about 13 s for a manual 4-round run). Over quota with nothing loaded: "over chunk limit", 3 tries per marker.
- *Selection.* Candidates exit-exit, exit-side, side-side, plaza, L; value = min(walking distance saved, 140) - 2 x length - kind cost (exit 0, plaza 3, side 3, side-side 6, L 8) - 6 for a landing - 0.5 |offset|; eligible with a saving
  >= 30 and >= 2.5 x length; greedy with overlay re-enumeration, spread penalty 15 within 12 blocks, budget 3 links, minimum value 10. L-joins: total <= 16, each leg <= 10 (owner: no big L shapes). Builders: arched slab bridge
  (5..17 between rows), two bridges with a 5x5 landing on a log pier for spans up to 30, plaza deck over the rectangle of two facing exits at distance 1..6, L with a landing; a NEW kind of join is refused within 2 cells of another
  structure's deck; only air and leaves are crossed; every join keeps light >= 8 (greedy lanterns) and the walk rules.
- *Runtime* (`scripts/loop_marker.js`): after the last round waits 40 ticks, plans (yielding between candidates) and builds in one `system.runJob` (32 writes per pause, then the fence-link fix), removes markers, writes the done list.
  `sliced(gen, JOB_SLICE_MS)` (2 ms) runs the planner's inner steps until the slice is used. Glue test: `tests/script_glue.mjs`. Trap: `done?.(await planVillageAt(...))` skipped the call when `done` was nullish.
- *Merge join [V]* (`findMerges`/`planMerge`; owner 2026-10-09: "It works. It is not super pretty (just 1 block wide connection), but works."): two pieces whose decks touch (gap 0) or are one cell apart are opened into one deck along the core
  of a stretch of facing rim pairs; the end cell stays as post with `openMinTrim` 2; runs first on the overlay, skipped when an open walk < 10 steps already joins the decks, cap 6, lanterns until light >= 8. Widening the door is an open wish
  in the settlement design doc.
- *Numbers (sim, 300 seeds):* 1.4 links per village, 220/300 villages with a link, 0 walk or light failures, areas 1/2.4/4 rounds, biggest 182 chunks.

**Repairs run after the links** (`scripts/village_repair.js`, `repairGen`; plan shapes `{ kind, blocks }` written like the links): *rope fit* (turns buried lowest pieces back into terrain and hangs more pieces to the ground, at most 24,
stops at water or leaves), *root down* and *root flare* (`planRootDown`, `findPillar`/`planFlare`: from each marker looks 3-4 cells along the axes for a plus of logs under the deck, scans four columns to the ground, 2-4 sides chosen by a
position hash, no root cell with more than 2 wood neighbours), *bare pillar foot* (`planPillarClear`, `REPAIR.PILLAR_LEAF_CLEAR` 4: owner "the leaves shouldn't start at the ground level, like trees"), then forest floor and rails. Pillar life and
crown fit in the generator: `decoratePillar` (ivy, canopy, thin branches; wood is never a mass, the generator throws when an added log has more than 2 wood neighbours), `buildCrown(..., fit)` scales branch-tip blobs 1.0 to 0.5 until
nothing lies in the outermost layer, `bareBranchEnds` (a horizontal log with at most one log neighbour needs >= 6 leaves within Chebyshev 2) is checked for every piece. Owner-accepted in the finished villages (`VILLAGES.md`).

**Elf posts and population (M1).** Tree pieces carry invisible `lothlorien:elf_post` entities (from `postCells` in `build_village.mjs`; `central_mallorn_01` 1 `loremaster` + 4 `reserve`, every `combo_*` 1 `home` post). The planner run
calls `elf_village.js` `populateVillage` after the links and before removing markers: it assigns professions (`elf_rules.js` `assignHomes`), spawns the elves and removes the posts (a post whose elf could not be spawned stays).

## Civilian elves (M1; owner-accepted in game 2026-10-10; sheet `mobs/elves.md`)

Files: `scripts/elf_rules.js` (pure: ids, `PROFESSIONS`, `STATS`, `HOME_RADIUS`, generator tunables `POST_SPACING` 3, `ROPE_CLEARANCE` 2, `RESERVE_POSTS` 4, `HOME_MIN` 5, `HOME_MAX` 7, `FOE_TAG`, `FOE_MS`, `homeSite`, `assignHomes`),
`elf_village.js`, `elven_warden.js` (elf section: hurt-by-player fight cost, foe tag), `entities/elf.json`, `entities/elf_post.json`. Persistent, no despawn, no spawn rule; panic 1.25 and flee monsters within 6; fall damage off;
`blocks_to_avoid` the two rope blocks; base `minecraft:home` and radius groups (Loremaster 6, others 10, healer 64 by day / 10 from dusk); leashable (a released elf takes a new home there). Movement 0.3 stays under
`WRONG_MOVEMENT_ABOVE` of `warden_replace_rules.js`. Home post cells need warden-like margins on the central tree, on nodes only their own cell open. Tests: "civilian elves (M1)" in `tests/run.mjs`, `tests/script_glue.mjs`.

## Elven Warden (sheet and owner decisions `mobs/elven_warden.md`)

Bow-armed defender `lothlorien:elven_warden` (family `irongolem`: vanilla monsters hunt it), natural spawns (spawn rule plus a one-time depth/deck judge in `scripts/elven_warden.js`, constants in `elven_warden_rules.js`) and persistent
village wardens (template entities in `central_mallorn_01` x2, `node_b/c/f`, `tower_a/c` x1; group `lothlorien:village_warden`). A friendly-fire guard sits on `world.beforeEvents.entityHurt`. Event-driven only; despawn is the
standard `despawn_from_distance` with no filters (see Fauna); only the village group adds `minecraft:persistent`. Harmony: fight -1, kill -6, Hated players shot on sight. The depth-estimate cost per natural spawn was never measured
(status unverified).

## Renown and the Loremaster (M2; accepted in game 2026-10-11)

Design: `design/elven_inhabitants.md` sections 2-3. Commits 88dbbe2 (Renown + dialog), 6019c88, f854117, ff61ae2, eb1cc5e, a10653f.

- **Files:** `renown_rules.js` (pure: ranks, points, lessons, chapters, task slot, requests, rotation, delivery plan, `directionTo`, `nearestOf`, `deliveryPlace`, `tagSync`, parse/serialize), `deeds.js` (hook bus), `renown_game.js` (state in the player
  dynamic property `lothlorien:renown`, deed listener, sapling watch, Harmony nudge, inventory, turn-in and hand-over feedback, deliver tag), `loremaster.js` (interception, forms, trader hand-over form, direction line), `fireflies.js`,
  `dew.js`, `entities/elf.json` (prompts), tests `tests/renown.mjs`. Every text goes through `message()` with keys `lothlorien.message.lore.*` (catalog, `.\mods localize build lothlorien`).
- **State v2:** `{ v, points, done, task, offer, queue }`, `task = null | { kind: "lesson", id, ready, since } | { kind: "request", id, spots }`; v1 migrates on read; `parse` tolerates junk.
- **Debug:** `/scriptevent lothlorien:renown` shows the state; `points N`, `reset`, `deed <id>`, `take <lesson id>`, `chapter N`, `offer <request id>`; bands via `harmony <value>`.
- **Interaction:** `beforeEvents.playerInteractWithEntity` on `lothlorien:elf`: cancel, then `system.run` opens the form; lead and name tag return early. `elf.json` has a prompt-only "Speak" in the `lothlorien:loremaster` group and a
  conditional "Hand over" prompt per trader group filtered by `has_tag` `lothlorien_deliver_<profession>` (`syncDeliverTag` keeps exactly that player tag). Forms: `ActionFormData` loop, icons from this pack and `textures/ui/*`; the
  set-aside confirm is a two-button `ActionFormData` (not `MessageFormData`, whose button order is a trap); `UserBusy` retried 10 times every 10 ticks; answers apply only within 12 blocks.
- **Delivery:** `tradersAround` uses `getEntities({ type, location, maxDistance: 96 })` (loaded chunks); none found -> the Loremaster takes the request himself. Direction: 8 compass words, north = -Z, "close by" under 8 blocks.
- **Firefly catch:** the prompt stays in `firefly.json`; `fireflies.js` owns the before-event, deferred capture and release; `firefly_bottle.js` stores name and current health as visible localized raw lore (stackable items cannot hold
  dynamic properties). Offhand bottles do not catch; healthy unnamed bottles stay plain. Details `mobs/firefly.md`.
- **Sapling request:** `afterEvents.playerPlaceBlock` with `mallorn_sapling`; inside the biome it is remembered as a distinct cell (checked at turn-in); outside it prints `lore.saplings.outside`.
- Verified in game 2026-10-11 (owner): dialog redesign, trader hand-over, directions, the missing-trader fallback, firefly catch, Harmony nudge, the acorn request, time-shaped morning dew, Niphredil round 5. Status unverified: the outside-sapling
  line, the Uneasy/Shunned/Hated dialog bands, a v1 save migrating, two players on one firefly, the forms in the AI-drafted locales, completing all 12 requests (testers, `TODO.md` section 2).

## Shops (M3; accepted in game 2026-10-11)

Design and prices: `design/elven_inhabitants.md` section 4; regression checks: `ELF_SERVICES.md`. Reusable evidence: `.claude/skills/bedrock-modding/references/08-trading.md`.

- **Single source:** `scripts/trade_rules.js` (four traders, stock and prices, nine keys `uneasy`, `guest_0..3`, `friend_0..3`, click decisions, nearest/pinned player selection, the final-gift hook). Uneasy always has starting stock.
- **Generator:** `node tools/build_trades.mjs` writes 36 `trading/lothlorien/*.json` and only the generated trade property, groups and events in `entities/elf.json`; `--check` detects drift. One tier, one deterministic trade per group,
  9,999,999 uses, zero trader XP, explicit zero price multipliers (the documented omitted default is 0.05).
- **Entity:** enum `lothlorien:trade` (default `none`, persisted, not client synced); ten events swap the group by profession; the Loremaster has no table; `persist_trades: false` requests rebuilding offers; `trade_with_player` stops
  navigation and a separate `look_at_trading_player` faces the customer; delivery interactions exclude `lothlorien_trade_pass` as well as lead and name tag.
- **Runtime** (`scripts/trade.js`): one bounded six-block query per player every ten ticks, lazy band/rank reads, swaps only when the property changes; a trading player's pin lasts at most 600 ticks while within range, another
  player's mismatch click overrides it. **Click flow:** Shunned/Hated refuse first; a matching request without a pass opens `openTraderForm` (`loremaster.js`); a stale table cancels, swaps and asks for another click; otherwise native
  trading. The Trade button grants that player's next use on that elf for 200 ticks; used passes cover repeat events for ten ticks; pass tokens protect replacements from stale timers; leave/join clear state and tags. Before-handlers only
  read, cancel and touch JS maps; tags, swaps, chat and forms are deferred. The trade debug report was removed 2026-10-29. Hover guidance on the Trade button (grey second line) owner-confirmed (9cdd1a0 on 405d482).
- **Tests:** `tests/trade.mjs` (prices, stock, no cross-band arbitrage, request separation, ids, generation, bindings) and `tests/trade_glue.mjs` (callbacks, timers, form mapping, payment, stale-answer guards; awaited after
  static imports so the fake clock is not shared with the village glue tests).
