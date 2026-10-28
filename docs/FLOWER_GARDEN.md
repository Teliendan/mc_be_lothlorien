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

## Natural placement: TEST BUILD 2026-10-28, not accepted

Plan and simulation: workspace `temp/garden-features/PLAN.md`, `SIMULATION.md`. Test procedure:
`GARDEN_FEATURE_TEST.md`. Owner decisions for this build: option A footprint, tuned constraints, chance 1,
flora may grow in the aisles, trees may root on the garden grass.

- `features/flower_garden_feature.json`: `structure_template_feature` of `lothlorien:flower_garden_01`,
  `rotate_around_center`, `facing_direction random`, `adjustment_radius 1`, `ground_level 2`, constraints
  `grounded`, `unburied`, `leveled {max_steepness 2}`, `block_intersection` with a terrain-only allowlist
  (air, soils, stone types, gravel, sand, clay, ground plants; no water, logs, leaves or built blocks).
  Allowlist and constraints are shared with the memorial feature (`tools/site_feature.mjs`).
- `feature_rules/flower_garden_feature_rules.json`: pass `before_surface_pass`, biome tag `lothlorien`
  (as the old jigsaw), one candidate chunk per 4 x 4 chunks (64-block minimum gap), `x`/`z` extent `[7, 8]`,
  `y = query.heightmap(worldx, worldz) - 1`.
- Template 13 x 7 x 13, offset [6, 3, 6]: beds and aisles to +-5, one ragged shoulder ring to +-6, soil 3 deep
  (grass + 2 dirt), 4 free cells above the grass, no buried jigsaw. The old 15 x 10 x 15 template, two shoulder
  rings and six soil layers are gone: `leveled` and `block_intersection` refuse slopes and water instead.
- Vertical reasoning: `q.heightmap` is the first air cell above the top block, so `- 1` is the top block.
  `ground_level` 2 is the encoded row of the grass (local y -1, 3 rows of soil under it start at encoded 0).
  A feature puts the template's `ground_level` row at the rule y, so the grass lands exactly on the
  top terrain block and replaces it, as the owner required on 2026-10-24; the planting layer is then level
  with the surrounding grass top. Calibrate in T1 (off by one is a one-line change).
- Chunk fit: half width 6 plus adjustment 1 is 7, so centres 7 or 8 keep every facing inside one chunk.
- Density: `GARDEN_CHANCE` in `tools/flower_garden.mjs` is 1/1 for the test (every lattice point is an
  attempt, so T2 measures acceptance a). Production value to keep the old garden count (one per 162 chunks):
  `8 / (81 a)`, capped at 1. Simulation: a about 0.2 on real Lothlorien terrain, so about 0.5.
- Retired with this build: `worldgen/structures/flower_garden.json`, `template_pools/flower_garden.json`,
  shared set `garden_sites.json` (the memorial now has `memorial_sites`, see `MEMORIAL.md`). Existing worlds
  keep built gardens; new gardens need a new world. `/locate structure` no longer finds gardens.
- Wiki: untouched in this build; update its garden records only after acceptance.

Manual check on level grass (the template origin is the centre column; the grass row is at foot height - 1):

```mcfunction
/place feature lothlorien:flower_garden_feature ~ ~ ~
```

From the mod repo, `node tools/build_flower_garden.mjs` rebuilds the template, loot table, feature and rule
and deletes the retired jigsaw files. Add `--preview` for disposable views in `temp/flower-garden/`.

`tests/flower_garden.mjs` (part of `mods verify lothlorien`) checks access, support, barrel loot, no jigsaw,
odd centred box, ground_level row, allowlist, chunk fit for the whole extent, lattice and chance, feature and
rule equal to the generator, shipped template and determinism. Offline checks do not establish in-game placement.
