# Test feedback 2026-10-27: lone great Mallorn in a river

Tester report: a great Mallorn stood in a river with no ordinary Mallorns around; past the river and a grass
strip, the forest started roughly 100 blocks away.

## Evidence (read-only save scan, world "Riki Lothlorien")

`python -B tools/world_scan.py "Riki Lothlorien" --biomes -260 -140 -100 40` and `--dump` around the tree:

- The build is `lothlorien:tree_grid_platform` (`mallorn_round_05`), start chunk -12,-5 (block -192,-80).
- Its start lies in a real Lothlorien patch (custom biome id 30000), about 5x4 chunks, wedged between two
  river arms with plains to the south (~130 blocks of plains before the main Lothlorien at z ~140).
- **Every column of that patch is water** (water top y62, lake bed ~y54). The ordinary tree feature needs ground,
  so it placed nothing there; only the four chunks under the giant's crown hold Mallorn wood.
- `world_surface` counts the water top, so with start -5 the trunk ends at y57: it hovers over two blocks of
  water above the dirt bed.

So the engine did what the JSON allows: `biome_filters` only checks the biome tag at the start, and no
native jigsaw field can reject a water site (see WORLDGEN_FIXES_2026-10-20.md, row 4b). Nothing was changed.
Open owner decision: how giant Mallorns should behave on water sites.
