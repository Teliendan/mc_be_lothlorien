# Leaves, saplings and tree growth interactions

Owner accepted this complete review group on 2026-10-19. Target Bedrock
1.26.52 / Script API 2.8.0. Evidence below is source/data/documentation and
offline handler tests; no new in-game observation is claimed.

| Interaction | Disposition and implementation | Confidence / remaining check |
| --- | --- | --- |
| Leaf composting | Both leaf variants have explicit same-ID block items with native 30% composting. | Data implemented; test player and hopper-fed composters. |
| Leaf smelting | Each leaf smelts to one existing Mallorn leaf litter in a furnace. Existing golden-leaf/litter crafting conversions remain. | Installed latest oak recipe is `vanilla_1.26.40/recipes/furnace_oak_leaves.json`, priority240; test furnace and XP. |
| Acorn fuel/compost | Ordinary acorn: native5-second fuel and existing30% composting. | Implemented data; furnace/composter check pending. |
| Great nut fuel/compost | Intentionally nonfuel (owner2026-10-19), noncompostable (owner2026-10-13): rare white-deer gift. | Intentional differences, no silent fallback. |
| Leaf block items | Same IDs replace automatic items, keep Creative group, native block rendering (no sprite icon), placement and translated existing block display names. | All nine locales/source bindings checked; old stacks, Creative duplicates, inventory/held art and player persistence need game checks. |
| Ordinary sapling pots | Existing root `minecraft:flower_pottable:{}` retained. Acorn's native block placer targets the sapling. | Native configuration, not new runtime evidence; verify acorn into pot, potted geometry, removal/break returning the correct acorn/block item. |
| Great sprout pots | No pottability added to the special giant-tree gift. | Separate custom gift design, pending owner review if desired. |
| Mixed-species leaf support | Ordinary leaves search through ordinary/golden Mallorn and explicit vanilla leaf families, accepting vanilla overworld log/wood and stripped variants (including Poplar). Bamboo is not a log. | Implemented handler tests. Vanilla leaves' reverse recognition of custom Mallorn wood is still OPEN: native decay uses internal identities, not proven by item tags. Third-party/fungus support also unverified; no guessed universal tag consumer. |
| Decay/persistence | Preserve intentional reach10 versus Bedrock4, 4000-node cap, unreadable-neighbor preservation and1200-tick positive path cache. Player leaves persist; golden leaves never decay. | Existing owner rules; tests cover persistence/cache/unreadable boundary. |
| Ordinary harvest | Existing shears/Silk Touch exclusive collection, custom acorn rarity/Fortune, sticks and native explosion processing unchanged. Golden leaves always self-drop. | [Harvest ledger](LEAF_HARVEST.md); engine loot/probability acceptance pending. |
| Soils | Both sprouts accept existing grass/dirt/coarse/podzol/rooted dirt/moss/mud/farmland plus mycelium. Native placement filter, event-driven support policies and growth checks agree. | Data and handlers checked; support loss/piston reload test pending. |
| Light/stages | Ordinary and Great random growth check the block above at light>=9, with1/7 stage chance; unreadable light postpones growth. Ordinary bone meal may work in darkness. | Script implemented/tested; native light values remain game checks. |
| Ordinary tree obstruction | Preserve species-specific custom shapes/trunk clearance and branch/canopy clipping. Trunks can replace other species' leaves, cannot replace built blocks/vanilla logs. Grass directly under saplings becomes dirt. | Custom shape is intentional, not an oak clearance-volume claim. |
| Ordinary growth jobs | Reserve each sapling in a group, revalidate sapling state/soil and trunk before first mutation, commit logs before yielding canopy placement, fill only currently replaceable cells. | Handler tests cover duplicate requests, stale bases, obstruction and construction during canopy yield. No global scan. |
| Bone-meal completion | Revalidate target permutation, soil, selected slot, mode, held stack amount and native stack metadata before consuming/growing. A second request cannot advance the same old stage twice. | Offline handler tests; survival/Creative/rapid clicks need engine check. |
| Dispenser bone meal | OPEN. Current sapling growth hook is a player interaction; no documented general stable dispenser-use event or custom native fertilization component has been established. | Do not simulate by searching all dispensers or infer support from plant tags. |
| Bee nests on grown trees | OPEN. Oak/birch/cherry can grow populated nests near flowers; custom scripted Mallorn growth does not currently create populated nests. | Native tree-feature/worldgen nest decorations are not a callable sapling-growth hook; pinned API has no documented hive-occupant insertion component. No empty nest/loose-bee substitute. |
| Great nut growth | Keep no bone meal, plain giant choice, rare gift, stage rules and existing build-protection scan. Added valid soil/above-light checks at stage advance and before final structure placement. | Giant structure files/worldgen distribution unchanged. |
| Great scan boundary | Existing400-cell yielded obstacle scan is not transactional: construction in an already-scanned cell before final structure placement can escape it. | OPEN known race; final sapling state/soil/light are revalidated, but this does not recheck every earlier obstacle cell. No synchronous86,400-cell scan added. |
| Leaf fire/lava | Both retain native catch30/destroy60/lava always. Native burning should not invoke player harvest. | Data matches counterpart; fire drops and waterlogged fire prevention pending engine checks. |
| Water/pistons | Both retain native water containment/flow-face rules and piston-pop movement; saplings are water/piston popped with existing native loot and support service. | Data covered; bucket/incoming flow, sticky/slime/honey and drop contexts pending. |
| Light/redstone/chests | Both leaf blocks damp light1, do not conduct redstone and now explicitly never obstruct chests. No Java-only leafstone behavior added. | Data implemented; grass survival, skylight, chest opening and observer updates need engine checks. |
| Collision/spawning/pathfinding | Preserve full leaf collider, transparent material and native leaf tags. | OPEN native special-case parity: suffocation, attachments, snow, hostile spawn prevention, exceptions and navigation cannot be inferred from leaf tags/full geometry. No global spawn interception added. |
| Leaf art/particles | Preserve selected green/silver/gold art, alpha_test_to_opaque, isotropic faces and existing falling-leaf implementation. | Existing art decisions; biome tint, snowy coloration and rain-drip parity remain OPEN rather than silently deemed irrelevant. |
| Species-specific mechanics | Mangrove propagules, cherry/flowering-azalea bee feeding, Java-only distance-state redstone and pale-oak creaking-heart behavior do not apply to ordinary Mallorn leaves. | Counterpart-specific inapplicable mechanics. |
| Acquisition/trades | Existing custom acorn/deer/forest acquisition retained; vanilla wandering-trader sapling offers do not automatically include custom species. | OPEN acquisition-policy question, not a native item component promise. |

## Sources and repeatable checks

Research followed existing skills/harvest/tree notes, installed reference and
official current release notes before Wiki/component documentation. Readable
Wiki pages are the **November2025 archive**, retrieved2026-10-19:
[Leaves](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Leaves),
[Sapling](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Sapling).
The archived bee section mixes edition labels; the sapling Bedrock history
specifically records same-level flowers within2 blocks. No Java datapack tag
behavior was imported.

[26.50 release notes](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
fix sapling growth under leaves and make all saplings nonflammable; retained
`flammable:false`. The same release adds native `minecraft:leaves` replacement
support, which is separate from native decay support. The
[26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
does not document a missing dispenser-growth or hive-occupant API.
[Flower pottable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_flower_pottable?view=minecraft-bedrock-stable)
belongs at root components;
[chest obstruction](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_chest_obstruction?view=minecraft-bedrock-stable)
`never` is stable for our format.

`python -B tools/configure_leaf_tree_interactions.py` regenerates this group's
data without art/loot/worldgen changes. `configure_support.py` runs that post-pass
before deriving placement policies. Independent runner:
`node tests/leaf_tree_interactions.mjs`; deployment suite: `leaf-tree`.
Shared pack verification and existing leaf-harvest/flora contracts are required.

Game acceptance after deployment: compare both leaf items/old stacks, player and
hopper composting, both furnace recipes, acorn fuel, pots and return item, dark
bone meal versus random light,1x1/2x2 soil/obstruction, mixed canopy decay,
water/fire/pistons, chest access, spawning/collision and unload boundaries.
Existing worlds only need leave/re-enter; this group changes no worldgen content.

Root validation/deployment2026-10-19: `mods deploy lothlorien --suite leaf-tree
--suite support --suite suite-layout` passed five runners, including13 focused
leaf/tree groups. Production verification:0 errors/0 warnings/15 documented
exceptions; unchanged optional probe:0 errors/1 warning.13 BP files copied, RP
unchanged; all three packs confirmed in sync. Shared verifier explicit-name-key
fix passed1540 regression assertions. Both standalone leaf regeneration and
full support regeneration preserve final pack bytes on repeat runs. No new
agent-run in-game observations; the acceptance list above remains pending.
Shared research/verifier/workflow commit: `a1bb031` in the workspace repository.
Mod changes remain uncommitted alongside the preexisting mod work.
