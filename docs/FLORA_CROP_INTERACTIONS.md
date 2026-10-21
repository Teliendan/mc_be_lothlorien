# Flowers, herbs and crop interaction review

2026-10-19, Bedrock1.26.52 / API2.8.0. **Owner approved Group7**, with the
corn/no-legacy and bee deferral decisions below. Implemented in source with
offline behavioral checks; no new game observations or engine-parity claims.
Root verification/deployment bookkeeping follows in the workspace review tracker.

Root validation/deployment2026-10-19: six selected suites (`flora-crop`, `crops`,
`flora`, `nectar-dew`, `support`, `suite-layout`) passed12 runners, including8
focused production scenarios. Production verifier0 errors/0 warnings/15 existing
documented exceptions; unchanged optional probe0 errors/1 warning.21 BP files
copied, RP unchanged; all three packs confirmed in sync. Shared aux-catalog fix
passed1545 verifier assertions; full regeneration changes zero pack bytes.
No new in-game results. Reload the world; use fresh generated terrain/a new
testing world for natural wild corn. No legacy migration by owner decision.
Shared knowledge/verifier/workflow commit: `4156f23` in the workspace repository.
Mod changes remain uncommitted alongside preexisting mod work.

Scope: blocks/items `elanor`, `niphredil`, `athelas`, `golden_fern`,
`nectar_bloom`, and block `western_corn` with `western_corn_seeds` and
`western_corn_grain`, all in namespace `lothlorien`. Star canopy is a building
tile and belongs with decoration. Blossom/litter segments have their own cover
group. Saplings are already in the leaf/tree group.

## Implemented decisions and interaction ledger

The owner accepted the proposals together, rejected legacy migration (only test
worlds exist), retained corn's specialized uses, and explicitly deferred bee
compatibility after extensive unsuccessful testing. This does not prove every
separate bee consumer impossible. No bee entity/flower/crop workaround was added.

| Interaction | Disposition after implementation |
| --- | --- |
| Ground flowers/herb/fern placement | IMPLEMENTED: existing eight soils plus mycelium, pale moss block and muddy mangrove roots. Generated support policy derives the same lists. |
| Native flower pots | NATIVE CONFIGURED: all four ground plants remain flower_pottable, explicit same-ID items. Pot render/recovery and support-loss outcomes require engine acceptance. |
| Composting | IMPLEMENTED: nectar bloom65%; other ground plants65%, corn seeds30%, grain65% preserved. Native composter consumption/automation remains an engine check. |
| Dye recipes | IMPLEMENTED shaped single-flower recipes: Elanor -> yellow1, Niphredil -> white1. Athelas and golden fern without dye INTENTIONAL. |
| Suspicious stew | IMPLEMENTED shaped2x2 two mushroom-tag slots, bowl and flower. Existing native stew outputs: Elanor5/saturation, Niphredil0/night vision, Athelas8/regeneration. Design effect assignments approved; native effect/duration/recipe-book acceptance needs game check. No new items/localization needed. |
| Ground-flora bone meal | IMPLEMENTED deferred snapshot guard: selected slot, mode, dimension, stack type/count/metadata, target ID/all states and current allowed soil before synchronous completion. Existing nearby-grass spreading, weights and Athelas scarcity preserved. |
| Bone meal on covers | SUPERSEDED by Group8 owner decision2026-10-19: BOTH fallen covers ignore bone meal; no segment growth or item duplication. Other plants/crops retain their guarded paths. See COVER_INTERACTIONS.md. |
| Native grass in biome | Existing biome-specific scatter preserved; target/biome revalidated; each bounded candidate safely skips unreadable cells. |
| Corn bone meal | IMPLEMENTED2-5 capped stages with current state-aware soil check; maturity retains bone meal; no light threshold for bone meal. Concurrent changed snapshots cannot advance twice. |
| Nectar bottle collection | IMPLEMENTED source/held snapshot and current approved ceiling support check, then synchronous item/stage/deed completion. Single bottle replacement, stacked bottles, full-inventory drop and Creative bottle retention preserved. Full bloom on approved planks/wood remains collectable; leaves-only refill is a different rule. |
| Deferred-use limits | Visible snapshot checks cannot distinguish identical replacement/history, or promise permission enforcement/atomic rollback on arbitrary engine write exceptions. Cosmetic growth sound/particle errors occur after growth/consumption and are caught. |
| Nectar refill | Existing0-3 states and1/7 random-tick refill only beneath Mallorn leaves preserved; no extra bone-meal duplication, potting or ground placement. |
| Corn provenance | IMPLEMENTED one saved boolean lothlorien:wild, false default/new player placement, true natural feature at maturity7. No legacy state/migration, second block/item, art or harvest changes. |
| Corn farmed support | IMPLEMENTED farmland-only native permutation and matching production support validity at every stage. Adapter identity includes wild state. After reverted support is observed, service removes farmed corn via existing native-loot destroy path. Native immediate filter timing/trampling recognition is an engine check. |
| Corn wild support | Preserved farmland/grass/dirt/podzol. State remains wild through growth/bone meal. Natural feature explicitly emits wild=true; use a new testing world/generated terrain for this change. Distribution unchanged. |
| Corn random growth | IMPLEMENTED bounded3x3 farmland fertility and same-crop crowding factor, retaining prior baseline rates at uncrowded fertility10 wet/4 dry and shade4/6/9 scaling. Packed corn now grows slower: diagonal corn or corn on both cardinal axes halves fertility; straight rows avoid penalty. Unreadable soil/crop/light postpones. Plant's own light is used. No exact real-time duration claim. |
| Farmland hydration/reversion/trampling | Native. Crop tag does not prove custom corn prevents dry farmland reversion or participates in all vanilla trampling rules. Test separately from our reaction after dirt already exists. No farmland override/scans. |
| Corn harvest | Existing approved wheat-like Bedrock Fortune/seed/grain loot at all stages preserved; see WESTERN_CORN_HARVEST.md. Random tick never changes mature corn. |
| Corn outside Lembas/custom wildlife | INTENTIONAL: no bread/hay/wheat substitution, vanilla livestock/chicken/parrot food, or extra wheat/seed uses. Existing custom deer/swan/songbird role retained. |
| Decorative fern tall form/sheep | INTENTIONAL no tall form/sheep grazing; any-tool instant self-collection, flower grouping, art and copy-spread retained. |
| Bee attraction/feeding/pollination/fertilization | DEFERRED by owner after unsuccessful prior testing. Preserve failed experiment notes, no cloned bee, new workaround or retesting. Do not claim all these separate paths were individually engine-tested. |
| Dispenser bone meal | OPEN: player interaction callback has no dispenser path; no established native registration for custom growable blocks found in installed data/API audit. No global dispenser polling/vanilla overrides. |
| Villager farmer planting/harvesting/composting | OPEN: latest villager farmer definition has no custom crop list; item crop tag alone is not recognition. No blanket vanilla entity override. |
| Fire/lava | NATIVE CONFIGURED: ground flowers60/100/lava-never, corn nonflammable, nectar inherited reviewed policy. Fire consumes according to engine rather than collection loot; confirm doFireTick/fire interactions in game. |
| Water and pistons | NATIVE CONFIGURED popping, no water containment, native loot plus bounded event-driven support reconciliation. Verify drops/counts/source-water timing for every corn/nectar stage. No continuous scans/timers added. |
| Support loss/explosions | Existing native placement/loot and event-local support service retained, with state-aware corn fix. Explosion survival, doTileDrops and reload/unloaded recovery need game checks; JSON/test assertions are not engine proof. |
| Collision, light, mobs | Zero collision/light dampening retained. No added damage, status effects, mob spawning surface or suffocation. Corn/flower tags do not promise mob pathing or mob consumers. Snow replacement, falling-block landing, mob passage/spawn and enderman recognition need engine acceptance. |
| Observer/redstone/sculk | Growth/nectar are ordinary custom state changes; observer pulses, comparator applicability and sculk emissions are OPEN native checks, no scripted guessed vibration route. |
| Gameplay rules/permissions | Native placement/break actions retain engine checks. Scripted growth/collection needs Adventure/protection, randomTickSpeed0, doTileDrops and multiplayer acceptance. No global gamerule compensation was added. |
| Species-specific vanilla routes | Exact flower mob loot/trades, banner recipes, wither-rose damage and eyeblossom cycles are INAPPLICABLE without that species' role; no new such design requested. Nectar's shears/Silk collection and restricted supports intentionally retained. |

Verification: `node mods/lothlorien/tests/flora_crop_interactions.mjs` executes8
production scenarios plus soil/layout/recipe/source-data contracts. Existing
support_motion, crops_lembas, western_corn_harvest, nectar_dew, flora and suite_layout
passed independently. The generator post-pass is semantic/no-op preserving and
rerunning configure_support produces no changed pack bytes. These are offline
checks only. Shared verifier and final deploy are root-owned.

## Approved corn implementation

Owner asked2026-10-19 whether this needs a second block, then explicitly rejected
legacy support because worlds are only testing worlds. Retain western_corn with
boolean lothlorien:wild independent of growth0-7; false is default/player-placed,
true is explicit natural placement. Native permutation support and existing
event-driven adapter agree on farmed farmland-only versus existing wild soils.
No migration, art changes, new IDs or broad world scanning. Existing test corn
without the state receives the farmed default; regenerate/replant as needed.
Native support-loss timing needs target-game checks. The placement hook exists
in pinned API2.8.0 and official
[event documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockcomponentplayerplacebeforeevent?view=minecraft-bedrock-stable).

## Sources and limits

Read existing tags, harvest and technical/design notes and shared block-family,
tag and mob references first. Installed reference was searched across versioned
packs: bee1.26.30, villager1.26.20, chicken/rabbit1.26.50; stew recipes1.26.50.
`suspicious_stew_from_dandelion.json` outputs native data5 and oxeye-daisy data8;
use each selected latest recipe when implementing, including mushroom tags.
Known exact soil/dye IDs were checked in the installed identifier reference.
Preserve the workspace's shaped-recipe policy when authoring custom recipes.

Official [26.50 changelog](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
and [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
were checked before proposing workarounds. No relevant crop/flower fix was found;
absence from release notes does not prove a platform limitation.

Wiki discovery, retrieved2026-10-19:
[Flower](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Flower),
[Fern](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Fern),
[Wheat Seeds](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Wheat_Seeds),
[Crop farming](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Tutorial%3ACrop_farming),
[Bee](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Bee),
[Suspicious Stew](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Suspicious_Stew).
These are November2025 archives. Direct generic Flower/Wheat/Fern fetches failed;
Wheat became readable through search cache. Direct
[Spore Blossom](https://minecraft.wiki/w/Spore_Blossom) is readable but browser
reports a1.9-year-old crawl. Do not call these current revisions.

Reviewed obtaining/breaking/usage/placement, recipes/stew, composting, bone meal,
bee/mob consumers, growth/soil/layout and environmental prompts. Edition-specific
harvest probabilities remain governed by WESTERN_CORN_HARVEST.md, not the generic
Wiki1-4 seed sentence. Crop-farming timing prose mixes editions: no exact minutes
or tick-rate claim is accepted from it here. Flower-specific vanilla trade,
Enderman/golem loot, wither/eyeblossom hazards and banner-pattern recipes do not
automatically apply to every invented species; record the concrete applicability.

Owner grouped decisions are implemented above; root deployment status is tracked
in workspace docs/vanilla-interactions-review.md.
