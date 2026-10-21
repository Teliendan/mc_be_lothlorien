# Ground cover and dew interaction review

2026-10-19; target Bedrock1.26.52 / API2.8.0. Owner approved this group with
both-cover full-top support retained and ALL cover bone-meal growth/duplication
removed. New dew must form under Mallorn. Owner2026-10-19 intentionally keeps
formation through intervening roofs: an obstruction check is not worth the
added complexity. Formation policy is unchanged.
Source/documentation and offline-handler evidence; revised interactions are not
newly verified in game. Root deployed the independent work2026-10-19; all three
packs are confirmed in sync. Roof policy is an intentional difference.

Scope: `mallorn_leaf_carpet`, `mallorn_blossom`, same-ID items, amount1-4,
direction/dew/on_grass states, `dew_bottle` and `morning_dew`. Approved flat art,
gold/yellow color, IDs, distribution, recipes, dew timing/chances and eight drops
per bottle are preserved. Bees remain deferred after the owner's unsuccessful
26.52 testing; no extra experiment or workaround was added.

| Interaction | Decision / current disposition |
| --- | --- |
| Side/adjacent merging | IMPLEMENTED: exact target/support permutation and water snapshots, held metadata/count/slot/mode/dimension, safe unloaded/disconnect rejection and concurrent-use rejection. Consume exactly one after a completed merge; sound failure cannot interrupt consumption. Preserve other cover states. |
| Native top addition | IMPLEMENTED: preserve native placement/swing route, capture intended upper permutation through beforeOnPlayerPlace, complete synchronously in privileged playerPlaceBlock. Require unchanged lower/support and player context; changed upper permutation/water is not erased. Native already authorizes/consumes placement: script does not consume again or depend on undocumented inventory-decrement ordering. Refund caches original item ID/metadata before clearing temporary upper cell. Revised callback ordering needs engine acceptance; prior swing observation is scoped to the old route. |
| Full cover | Top refuses more/vertical stacking. Full side clicks retain native adjacent-placement fallback. |
| Deferred dew collection | IMPLEMENTED: same support/target/all states/water, original held type/count/exposed metadata/durability progress/slot/mode/dimension, concurrent request and unloaded/disconnect guards. Nonstackable bottle metadata compares exposed fields, not isStackableWith. Identical item replacement or changes undone before completion cannot be distinguished. |
| Visible dew | INTENTIONAL: remains collectible regardless of time/foliage/roof changes after formation. Full inventory drops new partial bottle; Creative keeps starting glass. Existing partial bottle progresses normally. Seventh drop has no completion deed; eighth converts once. Cosmetic/deed errors do not leave completed source dewy. |
| New dew and roofs | INTENTIONAL owner2026-10-19: retain the bounded40-block Mallorn-leaf scan through roofs; an obstruction check is not worth the complexity. Unreadable upper cells safely postpone new formation. Dewy drying retains accepted time/chance rules. |
| Fuel/compost | IMPLEMENTED native litter5-second fuel, both covers30% compost; blossom remains nonfuel. |
| Blossom dye | IMPLEMENTED shaped1 blossom ->1 yellow dye, matching approved gold/yellow art. No extra item/art, no automatic petal suspicious-stew recipe. |
| Sounds | IMPLEMENTED native leaf_litter/pink_petals sound groups, plus inspected block.leaf_litter.place (pitch0.8) and place.pink_petals (pitch1) for script merges. No-collision footsteps remain engine-unproven. |
| Required support | Owner intentionally keeps BOTH on full-top surfaces, not only flower soils. Preserve the union of existing decorative surfaces and add enumerated full-cube families: stone/brick/ores, lit/unlit full blocks, color materials, glass/slime/honey, planks/logs and custom Mallorn cubes/double slabs. Names validated against pinned vanilla item IDs AND all versioned RP block mappings, including block-only lit twins. Native positive conditions split at64 IDs each; runtime policy uses complete union. This is a finite supported set, NOT a complete geometric classifier. Missing vanilla full cubes, stateful full tops (top slabs/stairs/closed trapdoors) and other add-on blocks without appropriate tags remain OPEN. Original soils such as farmland are preserved approved decorative extras. Both covers have identical surface sets apart from their own temporary top-add ID. |
| Replacement | OPEN: litter replacement is desired, but minecraft:replaceable changes self-item native routing. Existing tested swing/count route retained until native same-cell beforeOnPlayerPlace replacement can preserve count/direction/dew/overlay in game. Neither cover is blindly marked replaceable; blossom replacement was not requested. |
| Bone meal | INTENTIONAL removal from BOTH covers, including partial segment growth and full-cover item duplication. User treats them as fallen material. Other plants/crops/saplings keep their own accepted behavior. Supersedes Group7 cover branch and old parity claim; no dispenser path added. |
| Ordinary loot | CONFIGURED amount1-4 native loot, any tool/hand, no Fortune/tool gate or extra player-break script drops. All four data routes checked; doTileDrops/Creative actual native removals remain engine checks. |
| Support/water/pistons | Existing native water/piston popped and event-local support service retained; no fast forest polling. Expanded multi-condition native support survival, piston departures, water and gamerule counts for all states require engine acceptance. Worldgen distribution unchanged. |
| Explosion/fire/lava | Zero blast resistance, existing flammability60/100 and lava never retained. No guessed explosion_decay added: lack of that function does not establish Bedrock count/decay failure. Actual TNT/creeper/fire/liquid and gamerule combinations remain OPEN. |
| Provided support / snow / falling blocks | OPEN engine matrix: fence support workaround is not shape none and may admit center attachments; snow accumulation/replacement, falling-block replacement/drop behavior and exposed-grass cleanup after non-player removal remain unverified. No guessed support shape/precipitation component added. |
| Collision/light/redstone/mobs | Existing noncollision/light_dampening0/flat art preserved. Native placement/break particles, selection box quarter coverage, observer/sculk events, redstone attachments/conduction, spawn/navigation and sheep grass-under-cover behavior remain engine checks. No bee re-test implied. |

## Validation and remaining engine acceptance

New independent `covers` suite executes real ground_cover.js and dew.js handlers:
side/adjacent/state preservation, Creative and last-item behavior, concurrent
collectors/merges, changed held metadata/progress/slot/mode/dimension/target/support,
water/unload/disconnect rejection, temporary upper identity/refund, sound/deed
failure and seventh/eighth-drop boundaries. It also checks native fuel/compost,
recipe/count routes, complete support-policy union and lit/unlit support twins.
Existing flora and flora-crop suites now verify neither fallen cover reacts to
bone meal; plant/corn behavior remains covered. Offline verification passed:
`mods verify lothlorien --suite covers --suite flora-crop --suite flora --suite nectar-dew --suite support --suite suite-layout`
(10 runners, production0 errors/0 warnings/15 documented exceptions; unchanged
optional probe0 errors/1 warning). Direct covers suite passes9 production
scenarios, including native consumption before OR after its after-event. Pack
regeneration byte-idempotence and scoped git whitespace checks also pass. Revised native callbacks and
expanded surfaces still require actual game acceptance.

Root deployment2026-10-19 used the same10-runner scope and passed. **11 BP files
and1 RP file copied; all three packs confirmed in sync.** Leave and re-enter the
world to reload. No worldgen distribution change.

`tools/configure_cover_interactions.py` runs from configure_support.py and the
cover generator wrapper; it preserves final data/recipe/sound maps without
regenerating art. Regeneration must preserve pack bytes on a second run.

## Sources and limits

Read shared family/support/material/water references and mod harvest/support/
water/dew notes first. Installed latest mappings: RP1.21.70 leaf_litter and
RP1.20.0 pink_petals. Latest pink-dye recipe1.20.10; leaf furnace recipe1.26.40.
Official [26.50 release](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
and [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
were checked before proposing workarounds; no relevant cover fix found, not proof
of an engine limitation.

Reviewed obtaining/breaking/drops, placement/usage, fuel/compost, bone meal,
recipes, bee/nest consumers, states, sounds, color and edition/history. Readable
November2025 Wiki archive, retrieved2026-10-19:
[Leaf Litter](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Leaf_Litter),
[Pink Petals](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Pink_Petals),
[Bone Meal](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Bone_Meal).
Direct litter fetch failed; direct petals has a1.9-year-old crawl. These are
discovery evidence, not current engine tests. Source absence does not establish
permanent unsupported litter bone meal; decide our convenience independently.

Current stable docs describe
[replaceable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_replaceable?view=minecraft-bedrock-stable)
and [bounded raycasts](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockraycastoptions?view=minecraft-bedrock-stable).
Raycast obstruction was considered but intentionally declined by the owner;
do not add it as an unresolved parity fix. Pinned ItemStack
declarations say isStackableWith always returns false for nonstackable items;
apply the existing wood-tool snapshot lesson to partial dew.

Group8 independent implementation is reviewed, deployed and confirmed in sync.
Roof obstruction is intentionally ignored by owner decision2026-10-19; no
roof-policy pack change is required.
Shared research/workflow commit: `c9d83d4` in the workspace repository.
Approved decisions, deployment and reusable findings: workspace commit `1049948`.
Intentional roof decision: workspace commit `76f6904`.
Mod changes remain uncommitted alongside the earlier work.
