# Snow

Bedrock 1.26.52, reviewed 2026-10-25. Documented and source-checked; game checks pending.

Elanor, Niphredil and Athelas follow small ground flowers; Golden Fern follows the
one-block fern. Their native `minecraft:precipitation_interactions` component uses
`precipitation_behavior: snowlogging`. The block post-pass in
`tools/configure_support.py` preserves this after regeneration. No script or timer.

Snowlogging means snow layers sharing the plant's cell, not snow resting on a
block's upper surface. It is not a blanket setting for collision-free blocks:

- Mallorn Sapling and Great Mallorn Sprout follow saplings; Western Corn follows crops.
- Mallorn Blossom follows pink petals/wildflowers; Mallorn Leaf Carpet follows leaf litter.
- Nectar Bloom hangs beneath a block, like a spore blossom; it is not a ground flower.
- Wood, leaves and furnishings retain existing precipitation behavior. Solid-block
  snow cover is separate from snowlogging; do not fill solid blocks with snow.

## Engine check

In a test world, put each of the four plants on grass beside a poppy or fern.
Place snow layers into each plant, add layers, then remove the snow and check
the plant survives with its state intact. Repeat after leaving/re-entering the world.
Check snowfall and falling snow in a cold biome against the vanilla control,
including the grass-overlay appearance. Snow-golem trails are not a vanilla
snowlogging route. Check that saplings, corn, covers and hanging blooms retain
their existing behavior. No new world is needed for these definition changes.

## Evidence

- Installed `vanilla_1.26.50/blocks/red_shrub.block.json` in the 1.26.52 reference
  uses `snowlogging` for a non-colliding small plant.
- [26.30 release notes](https://www.minecraft.net/en-us/article/minecraft-26-30-bedrock-changelog),
  Technical Updates / Blocks: released snowlogging without experiments, kept
  minimum format 1.21.120, renamed `snow_log_no_collision` to `snowlogging`.
- [Creator component reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_precipitation_interactions):
  supported values and version gate. The mod's blocks already use format 1.26.50.
- [Minecraft Wiki: Snowlogging](https://minecraft.wiki/w/Snowlogging), reviewed
  2026-10-25: small-flower/fern scope, snow placement/removal and snow-golem exclusion.
  Its plant list excludes saplings, crops, petals, litter and hanging blossoms.
- Official 26.50 and 26.52 changelogs checked; no later relevant snowlogging fix.

## Validation

2026-10-25: pack verification and the flora/flora-crop suites pass (zero errors
or warnings); the four-plant regeneration post-pass is idempotent. The wiki
export/contract preview passes for a temporary snapshot containing this change
and current wiki records (83 features, 54 recipes); all 14 exporter tests pass.
Full current-source preview export also passes after the source review recorded
in WIKI_EXPORT.md.
Rendering, snow removal and snowfall still need the engine check above.
