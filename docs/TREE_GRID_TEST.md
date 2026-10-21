# Village on the existing tree grid

2026-10-18, target Bedrock1.26.52. Owner-requested density/collision/terrain
behaviour experiment. Implemented in the main Lothlorien BP; native results pending.
This replaces the sparse-grid/coordinated-group direction for the next test.

Create a **fresh normal Creative world with the normal Lothlorien packs**.
Leave **Lothlorien — Worldgen Test** disabled: that older optional pack generates
the floating amethyst diagnostics. This experiment uses surface placement and
the actual Lothlorien biome, without glass roofs, coloured labels or new scripts.
Worldgen changes require a fresh world for a clean test. This temporary build
also affects new terrain generated in existing worlds using the updated main BP.

Find the biome and villages with:

```mcfunction
/locate biome lothlorien:lothlorien
/locate structure lothlorien:elven_village
```

Travel normally/fly to the returned X/Z at surface height. Inspect approximately
three villages and nearby woodland, including at least one sloping site if
available. Check:

- Village/tree/shrine intersections, including buried roots, platforms and crowns.
- Gardens/memorials cutting village roots, decks or pathways, or being overwritten.
- Ground contact: exposed undersides, buried floors and abrupt terrain edges.
- Whether the existing-density scatter feels natural and villages are findable.

Record X/Z and what intersects/floats/is buried. A problem at one site is already
useful; there is no requirement to count a large statistical sample or repeat
multiple directions/worlds at this stage. Report any Content Log loading errors
first. Save and leave the world if a subsequent copied-save audit is needed.

## Distribution

The original tree grid retains spacing6/separation2/salt518204731, with a single
structure-set choice at each candidate:

| Kind | Weight | Chance |
| --- | --- | --- |
| Village | 6 | 15.79% |
| Platform Mallorn | 9 | 23.68% |
| Plain Great Mallorn | 15 | 39.47% |
| Root shrine | 8 | 21.05% |

Gardens and memorials keep their original independent spacing12/separation4
sets and salts. Total nominal site-attempt density is preserved; villages replace
some tree/shrine attempts. Counts are probabilistic and depend on biome eligibility.
Expected ratio before differing eligibility:1 village:1.5 platforms:2.5 plain
giants:1.33 shrines:1.58 gardens:1.58 memorials. No village-per-biome guarantee.

The village references its unchanged original definition: max_depth2,
surface offset-17, village anchor and start pool. Three new tree-category
definitions retain every original giant ground/assembly setting and partition
the unchanged mixed pool into two platform variants, four plain variants and
one shrine. Relative variant weights are retained. The legacy mixed structure
remains callable by command but has no natural set during the dense test.
Saved structures, loot, residents, items and interaction behavior were not edited.

## Limits and maintenance

This experiment deliberately retains the dense grid without a proven exclusion
mechanism. **It does not guarantee intact builds where independent starts overlap.**
Whole-build completeness remains the production requirement; this test measures
the actual failure patterns before another design choice. Small structures remain
independent by owner preference. Terrain adaptation remains the existing `none`;
this is a baseline, not a new foundation/terrain fix or feature-rejection wrapper.

Generator: `node tools/build_tree_grid_test.mjs`. Restore the original tree/shrine
selection with `node tools/build_tree_grid_test.mjs --restore`, then verify/deploy.
Restore removes only the six named category JSON files and restores the old set.
It cannot undo already generated terrain. The original mixed-pool tree/shrine
builders remain intact; rebuilding assets does not overwrite the shared test set.

Scoped regression selection: `tree-grid-test`, `root-shrine`, `giant-trees`,
`flower-garden`, `memorial`, `worldgen-spacing`, `suite-layout`. The new independent
suite checks weights, candidate placement, exact partition of unchanged assets,
native anchor existence, per-category ground/depth rules and absence of duplicate
natural sets. It also accepts the explicit restored profile.

Deployment 2026-10-18: all seven selected feature runners, localization and shared
pack checks passed. Core BP/RP: zero errors/warnings and15 documented exceptions.
Optional old diagnostic BP: zero errors and its one expected inventory warning.
Managed deployment copied seven main-BP JSON files; the subsequent
`mods status lothlorien` confirmed all three packs in sync. Native observations
remain pending. The original village definition and garden/memorial set files
were also checked byte-for-byte against pre-test snapshots and are unchanged.
Logs: `temp/tree-grid-test/verify.log` (initial failures were old exact-membership
assertions in the garden/memorial tests) and `temp/tree-grid-test/deploy.log`
(corrected independent-grid assertions and all selected checks passed).

Weights changed 2026-10-20 (owner, Test G review): village 4 / platform 10 / plain 17 / shrine 9, village 1 in 10;
see `WORLDGEN_FIXES_2026-10-20.md`.
Weights changed 2026-10-21 (owner): village 10 / platform 19 / plain 33 / shrine 18, village 1 in 8. Gardens and
memorials now share one grid (`garden_sites.json`, 9/3).
