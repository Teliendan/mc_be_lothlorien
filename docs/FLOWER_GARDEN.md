# Flower garden

Accepted by the owner on 2026-10-16: "I like it." Second standalone woodland place,
following the root shrine. Target: Bedrock 1.26.52 / API 2.8.0. Overall garden
acceptance; individual barrel observations were not supplied. Natural generation
was a jigsaw until 2026-10-28; it is now a feature (below).

## Design and supplies

An open, roughly 11-block garden with four six-flower beds, low silver Mallorn
slab edging and broad grass aisles. A three-stair silver bench with trapdoor arms
sits at the south rim. No walls, roof, residents, planted saplings or new assets.
Existing canopy above the four-block clearing height is preserved (two blocks until 2026-10-20).

Beds pair Niphredil with lily of the valley, allium with Niphredil, Elanor with
orange tulips, and blue orchids with cornflowers. Each flower stands on grass.

The owner-edited barrel guarantees 2-5 ordinary Mallorn Acorns, 4-8 bone meal,
two flower rolls of 1-3 items each, one wooden hoe AND one shears. Flower rolls may
select the same species. The barrel is visible and reachable without digging.
Corrected two item IDs in the owner's otherwise valid loot layout:
`lothlorien:mallorn_nut` -> `lothlorien:mallorn_acorn`, and
`minecraft:wood_hoe` -> `minecraft:wooden_hoe`. The separate guaranteed tool pools
and increased nut count are preserved in both the table and its generator.

## Natural placement (accepted 2026-10-28)

The garden is a native constrained `structure_template_feature`, placed with the memorial on one shared site
lattice. Mod commits: `a010568` (feature), `a51dbcc` (shuffled lattice), `90ced4b` (shared site rule).

- `features/flower_garden_feature.json`: `lothlorien:flower_garden_01`, `rotate_around_center`, `facing_direction
  random`, `adjustment_radius 1`, `ground_level 2`, constraints `grounded`, `unburied`, `leveled {max_steepness 2}`,
  `block_intersection` with a terrain-only allowlist (air, soils, stone types, gravel, sand, clay, ground plants; no
  water, logs, leaves or built blocks). Allowlist and constraints are shared with the memorial (`tools/site_feature.mjs`).
- Placement: `feature_rules/site_feature_rules.json` places `features/site_select_feature.json`, a
  `weighted_random_feature` of garden and memorial 1:1. Pass `before_surface_pass`, biome tag `lothlorien`, one
  candidate chunk per 4 x 4 chunks at a scrambled position in the cell (`shuffledLatticeIterations`; candidates at
  least 32 blocks apart; the same layout in every world, since a rule sees no seed), chance 2/5, centre extent `[7, 8]`
  (the engine always takes 7), `y = query.heightmap(worldx, worldz) - 1`. The constants are `SITES` in
  `tools/site_feature.mjs`.
- Template 13 x 7 x 13, offset [6, 3, 6]: beds and aisles to +-5, one ragged shoulder ring to +-6, soil 3 deep,
  4 free cells above the grass, no jigsaw anchor. `ground_level` 2 is the grass row, so the grass replaces the
  terrain top block (owner, 2026-10-24) and the planting layer is level with the surrounding grass.
- Chunk fit: half width 6 plus adjustment 1 is 7, so centre 7 keeps every facing inside one chunk.
- Owner decisions (2026-10-28): flora may grow in the aisles; trees may root on the garden grass; no visible grid
  ("very regularly placed" on a plain lattice); ~24 gardens and ~24 memorials per km2 of Lothlorien; gardens and
  memorials share the grid so they never crowd each other.
- In-game round 1, world "Test Gardens" (1.26.60, 2026-10-28, owner + save scan, plain lattice, chance 1): 117 gardens
  per km2, all complete, none in water or on a hillside, grass level with the surrounding top (median 0), no cut edges.
  Acceptance about 0.5 (refusals: water, steep, gentle 4-5 block range, another build in the footprint). The shuffled
  lattice was then seen in game by the owner; the shared site rule with chance 2/5 is not yet seen in game.
- Retired: the garden jigsaw (`worldgen/structures/flower_garden.json`, its pool and set) and the shared
  `garden_sites.json` set. `/locate structure` does not find gardens. New gardens need a new world.
- `/place feature lothlorien:flower_garden_feature ~ ~ ~` is known to the command but usually answers "not a good
  place" at the player's feet (owner, 2026-10-28; cause not checked; natural placement works).

From the mod repo, `node tools/build_flower_garden.mjs` rebuilds the template, loot table, feature, the shared site
pick and rule, and deletes retired files. Add `--preview` for disposable views in `temp/flower-garden/`.

`tests/flower_garden.mjs` (part of `mods verify lothlorien`) checks access, support, barrel loot, no jigsaw,
odd centred box, ground_level row, allowlist, chunk fit for the whole extent, the shared lattice and chance, files
equal to the generator, shipped template and determinism. Offline checks do not establish in-game placement.
