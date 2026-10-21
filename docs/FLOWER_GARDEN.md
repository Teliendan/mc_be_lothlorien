# Flower garden

Accepted by the owner on 2026-10-16: "I like it." Second standalone woodland place,
following the root shrine. Target: Bedrock 1.26.52 / API 2.8.0. Overall garden
acceptance; individual barrel observations were not supplied. Natural generation
requested the same day and still needs in-game terrain/distribution review.

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

## Placement and rebuilding

**Since 2026-10-21 (owner) gardens and memorials share one grid**: set `lothlorien:garden_sites`
(`structure_sets/garden_sites.json`, salt 794231583, spacing 9 / separation 3, linear), garden and memorial
weight 1 each, so the two never pair up; combined count about 11 % below the two old 12/4 grids. The paragraph
below is the earlier design.

Natural generation adds gardens to Lothlorien at about one per four big trees,
counting all plain, platform and shrine variants together. A separate structure set
uses spacing 12, separation 4, salt 794231583 and linear random spread. The existing
Great Mallorn set remains spacing 6, separation 2, salt 518204731, with its pool
weights unchanged (including 25% shrines). One attempt per 12 x 12 chunk cell versus
one per 6 x 6 gives a 1:4 attempt ratio without replacing existing tree attempts.
This is a long-run density target, not a quota in every small patch; biome boundaries
and placement success affect observed counts. Independent sets do not exclude each
other, so natural terrain and occasional proximity to trees need an in-game review.
The garden shares the giants' biome filter and world-surface projection. Its buried
anchor becomes dirt; start height 0 puts the garden grass one block above the terrain
(-2 until 2026-10-20, which sank it one block and flooded one in a lake; see
`WORLDGEN_FIXES_2026-10-20.md`). Worldgen changes need a new world.

Leave and re-enter the world after deployment. Stand on level grass and load a
fresh garden centred roughly seven blocks ahead:

```mcfunction
/structure load lothlorien:flower_garden_01 ~-7 ~-6 ~
```

Template: 15 x 10 x 15; offset [7, 6, 7]. Top of soil is at player foot height.
Unused cells remain structure void. Six soil layers under the patch and a ragged
one-/two-step shoulder (`tools/ground_skirt.mjs`) carry it on gentle slopes and over
water; this is not a slope-fitting generator and cannot reject a bad site. The manual template load retains one buried
jigsaw block at its centre; `/place structure lothlorien:flower_garden` consumes it
to dirt when using the jigsaw definition in a world that recognises the new definition.

From the mod repo, `node tools/build_flower_garden.mjs` rebuilds the template,
loot table, jigsaw definition and pool. Add `--preview` for disposable textured
views in `temp/flower-garden/`. Accepted review scratch was removed; no unused
composition variants remain.

`tests/flower_garden.mjs` is part of `mods verify lothlorien`. It checks all four
approaches, bench/barrel access without jumping, flower/edging support, guaranteed
nuts, serialized native barrel loot and coordinates, unchanged chest identity,
buried anchor, unused void, no residents/saplings, deterministic rebuilds, shipped
asset equality, separate guaranteed tools, the 1:4 attempt ratio, same biome filter
and unchanged existing tree grid. Offline checks do not establish natural terrain
placement or exact in-game counts.
Implementation commit: `Add accepted flower gardens with additive one-to-four worldgen`.

Initial implementation passed full verification and deployment on 2026-10-16:
0 errors, 0 warnings, 15 documented exceptions. Owner then accepted the garden.
Reusable container evidence: workspace commit `54fb600`,
`Document generated barrel loot and flower preview evidence`.
Additive-density evidence: workspace commit `041d7c5`,
`Document additive structure density from random-spread grids`.
Final owner loot and natural-generation registration passed full
`mods verify lothlorien` on 2026-10-16: 0 errors, 0 warnings,
15 existing documented exceptions. Natural terrain/count review remains pending.
