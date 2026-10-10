# Star canopy harvest

Updated 2026-10-10 for Bedrock 1.26.52 / stable Script API 2.8.0. Configuration
and regression checks pass; collection and explosion behavior still need direct
target-game acceptance.

The owner corrected the collection policy: an inefficient tool generally makes
mining slower and must not silently prevent collection. Star canopy therefore
drops one tile with **any tool or hand**. Pickaxes remain its efficient mining
tool through `minecraft:is_pickaxe_item_destructible`; mining parameter 3.5 and
blast resistance 6 retain the deepslate-tile material counterpart. This owner
instruction governs collection separately from that material profile.

The explicit native loot table has one unconditional self-item entry, with
`set_count:1` followed by `explosion_decay`. Normal mining and environmental
removal retain native loot evaluation and real explosion context/gamerules.
Fortune and Silk Touch do not change this one-item collection recipe.

The newly added before-break gate, deferred no-loot removal and its private
tool-wear helper/tests were removed. No canopy-specific script intercepts the
player break; native engine handling owns wear, sounds, particles, statistics
and ordinary after-break events. Both the star-canopy generator and support
postpass preserve the explicit native loot route. Corn, leaf and fern harvest
changes are separate and unchanged.

The earlier deepslate-tile research remains evidence about vanilla, rather than
authority to override the owner's collection instruction. Its documented
pickaxe-only collection was the reason for the removed gate:
[Minecraft Wiki, Deepslate Tiles revision 2731188](https://minecraft.wiki/w/Deepslate_Tiles?oldid=2731188).
That snapshot is from 2024; it was not a current engine extraction or a verified
star-canopy gameplay result.

`node tests/star_canopy_harvest.mjs` checks the real unconditional table, native
decay ordering, unchanged pickaxe efficiency/mining/blast values, permutation
routes, obsolete script/import removal, generator persistence and deliberately
broken tool predicates. It does not simulate native loot or certify gameplay.

Pending engine checks: collect with hand, non-pickaxe tools and every pickaxe
tier, compare mining times, then test environmental removal/explosion decay
separately with relevant gamerules. No new owner question is needed for this
explicit correction.
