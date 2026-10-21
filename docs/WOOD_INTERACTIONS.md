# Mallorn wood and shape interactions

2026-10-18; Bedrock 1.26.52 / stable server API 2.8.0. Owner accepted this
group: logs, bark-covered wood, stripped variants, both plank sets and their
slabs/double slabs/stairs. Evidence is source/documentation and offline tests;
no new in-game observations were supplied. Controls and leaves have separate
reviews. Accepted artwork and silver/heartwood acquisition are preserved.

## Changes

Deferred stripping and slab merging now re-read the target and the original
selected slot before writing. Target identity, states and water status must
match; held amount, exposed metadata and game mode must remain unchanged.
Stackable slabs additionally use native `isStackableWith`. That method always
rejects non-stackable tools, so axes use exposed metadata comparison instead.
Duplicate callbacks and competing players cannot merge an unchanged slab twice.
An identical replacement restored before the callback cannot be distinguished
from the original block; this is not a universal transaction/permission API.

Stripping accepts exact native axe IDs, including copper, and custom items with
the documented `minecraft:is_axe` tag. A name ending `_axe` alone grants nothing.
Wear is calculated before block mutation using `getDamageChance`, Unbreaking
0..3, Creative and `unbreakable`. Higher command-only levels clamp to the API's
supported range. The final zero-remaining-durability use follows the documented
Bedrock distinction. Custom nonconstant damage-chance ranges remain unverified.
Native wood use sound replaces the previous slab breaking sound.

Both slab items now burn for **15 seconds** (Bedrock 1.5 smelts), replacing the
Java 7.5-second value. Both bark-covered wood blocks now support the same three
placement axes as their log counterparts, with orientation retained on stripping.
Both stair blocks explicitly declare `chest_obstruction: never`, following the
latest installed native stair definitions. Shared generation and the mod's
support post-pass preserve that setting across all 80 stair states.

## Interaction ledger

| Interaction | Disposition / evidence | Remaining boundary |
| --- | --- | --- |
| Log/wood orientation | Implemented: placement face maps to three axes for all four log/wood IDs | Native placement and previously saved blocks need game comparison |
| Stripping result and orientation | Implemented guarded conversion, preserves axis | All faces, Creative and external add-ons |
| Axe recognition | Native axe IDs plus documented axe tag; suffix inference removed | Other add-ons must classify their tools; no arbitrary-name compatibility promised |
| Wear/Unbreaking/unbreakable | Native chance API and Bedrock final-use rule configured/tested | Engine acceptance; custom chance ranges and command-only enchantment parity |
| Delayed target/item changes | Guards selected slot, amount/metadata/mode, target permutation/water/unload | Identical replacement history and native permission enforcement are not established |
| Slab complementary-half merging | Both species, direct/neighbor face routes, one write/one item | All real click positions, water displacement and several players |
| Ordinary placement / mismatched species | Existing native route retained; no mixed-species double slabs | Native placement contexts and item consumption |
| Creative / final inventory item | Creative spends none; last Survival slab clears its original slot | Full inventory, relog/departure and native inventory UI |
| Single/double slab loot | Existing two-slab count followed by native explosion decay retained | Every native destruction cause, doTileDrops and explosion execution |
| Generic crafting | Existing planks/slab/log/logs-that-burn tags retained; latest native recipes inspected | Actual recipe book and mixed-species generic recipes |
| Plank repair of vanilla wooden tools/shields | **Open native consumer**: crafting tags do not prove anvil eligibility | No verified public extension found; no vanilla item overrides or guessed tags added |
| Fuel | Logs/wood/planks/stairs/slabs all 15 seconds; slab edition mismatch fixed | Furnace execution; fuel is distinct from placed-block flammability |
| Charcoal | Existing logs-that-burn classification/native recipe consumer retained | Confirm all four log/wood forms in furnace |
| Species-specific recipes | **Existing intentional design:** normal wood gives silver, stripped gives heartwood | Preserve established recipes; no vanilla wood-set replacement |
| Cocoa | **Inapplicable:** Wiki identifies jungle logs, not every wood species | No cocoa support added to Mallorn |
| Stair halves/corners | Existing native corner traits, 40 permutations per species and multi-box shapes retained | Mixed-material neighbors, all directions, updates and reload |
| Water by shape | Existing explicit slab/double/stair policies retained; 80-state stair oracle passes | Buckets, merge displacement, incoming/outgoing flow and native fluid rendering |
| Attachment support | Existing shape support declarations retained | Every supplied face, top/bottom slab, stair corner and attachment removal |
| Collision / stepping / fall / navigation | Existing shape boxes and native engine path retained | Small/large mobs, vehicles, player walking/exhaustion and falling actors |
| Spawn surfaces | **Open native comparison**, no blanket spawn tag invented | Top/bottom/double slabs and upright/inverted stair surfaces |
| Suffocation / visibility / light | Existing cube/partial dampening and shapes retained | Bedrock-specific lighting, sight and suffocation; Wiki stairs has an explicit BE uncertainty |
| Redstone conduction / wire stepping | Single shapes nonconducting, double slabs conducting; native wire-step default retained | Up/down dust paths, components and native updates by state |
| Chest opening above stairs | Implemented `obstruction_rule: never` in both sets and generators | Real chest opening in every stair state; full cubes/double slabs keep separate policy |
| Hopper collection / falling blocks | **Open engine cases** | Items above bottom slabs; sand/gravel landing on slab/stair shapes; no custom item transport script |
| Observer / sculk | Native block permutation writes retained | Actual signals/vibrations, exactly one conversion update; action sound alone is not vibration evidence |
| Fire, lava, mining and blast | Existing reviewed material/tool policies retained | Native destruction/drop/gamerule behavior |
| Pistons / sticky movement | Existing native movement and event-local support recovery retained | Moved shapes, attached blocks, water and exactly-once drops |
| Sound / note blocks / inventory transport | Existing bass instruments, native item transport; wood use sound corrected | Actual volume/pitch, note instrument and UI behavior |
| Adventure / permissions / multiplayer | **Open native authorization comparison** | Cancelled use plus scripted mutation must be tested against Adventure CanPlaceOn/CanDestroy and other protection systems |

Open rows are investigations or game checks, not approved omissions. Existing
control and leaf decisions are not reopened by this group.

## Sources and verification

Research followed existing skills/material/water notes, installed versioned
reference, official [26.50](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
and [26.52](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
notes, then creator docs and Wiki. Native `vanilla_1.26.50/blocks/*_concrete_stairs.block.json`
declares chest obstruction; `vanilla_1.20.10/recipes/shield.json` accepts the plank
tag. These are source declarations, not custom-runtime acceptance.

Readable November2025 Wiki archive pages, retrieved 2026-10-18:
[Wooden Axe](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Wooden_Axe),
[Durability](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Durability),
[Wood](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Wood),
[Wooden Slab via Cherry Slab](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Cherry_Slab),
[Slab](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Slab),
[Stairs](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Stairs).
Some open requests failed while search-cache retrieval succeeded. Stairs' light
description explicitly requests more Bedrock evidence. Canonical Log/Planks
pages were readable with browser-reported 1.5-year-old crawls; archive age is
preserved as a limitation rather than presenting a current engine measurement.

Creator [chest obstruction](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_chest_obstruction?view=minecraft-bedrock-stable)
documents the default shape/AABB behavior and stable format1.26.20 route.
Pinned `reference/server-2.8.0.d.ts` establishes durability chance bounds,
unbreakable, slot access and the non-stackable `isStackableWith` limitation.

Eight production-handler scenarios in `tests/wood_interactions.mjs` cover
merging, stale/duplicate/competing actions, metadata/mode/slot/water changes,
axis/classification and wear. Shape/fuel/loot contracts and the existing
80-state stair oracle also pass. Run `--suite wood-interactions`; use `wood`,
`controls` and `support` when changing the shared handlers/family generation.
None of these checks simulates
native anvil, chest, hopper, light, spawn, fluid or permission behavior.

Root deployed with `mods deploy lothlorien --suite wood-interactions --suite wood
--suite controls --suite support --suite suite-layout` on 2026-10-18. Six selected
independent runners and localization passed. Production: **0 errors, 0 warnings,
15 documented exceptions**; existing optional probe: **0 errors, 1 warning**.
`mods status lothlorien` confirmed all three packs **in sync**. Original RP art
is unchanged. Reload the world; no new world is required.

The subagent completed the implementation/tests but reached its usage limit
before documentation; root completed this ledger and shared notes. Root also
removed twelve unrelated formatting-only changes after JSON-equality checks and
made the support post-pass preserve semantically unchanged files. Regeneration
then changed zero pack bytes. Mod changes remain uncommitted alongside existing
workspace work; shared knowledge is committed separately in the workspace repo.
