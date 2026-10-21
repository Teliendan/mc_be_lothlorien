# Elf and elven warden interaction inspection

Group 16, 2026-10-20; target Bedrock **1.26.52**, stable server API **2.8.0**.
**Owner-approved source fixes implemented, verified offline and deployed2026-10-20.**
All three packs confirmed in sync. Group16 owner review/source work is complete;
native game acceptance remains open. No new game observations.

## Scope and established decisions

- `lothlorien:elf`: gardener (variant 0), healer (1), woodwright (2),
  lamplighter (3), loremaster (4). All five share body, persistence, leash,
  hazard and fleeing rules. Healer day/night and leashed home states differ.
- Four trading professions each have nine tables: `uneasy`, `guest_0` through
  `guest_3`, `friend_0` through `friend_3`. `none` removes their shop. The
  Loremaster never trades. All 36 table files and 304 offers were inspected.
- `lothlorien:elven_warden`: natural, summoned/egg, persistent village/watch-camp,
  named and temporary angry states. Linked equipment `minecraft:bow`, projectile
  `minecraft:arrow`, gear/arrow loot, spawn rule and structure replacement.
- Linked player paths: leads, shears, name tags, native trading, request delivery,
  Loremaster forms, Harmony/Renown and healer blessings. `elf_post` and other
  implementation actors belong to Group 17; they are not biological NPCs.

Authority: [elves](mobs/elves.md), [warden](mobs/elven_warden.md),
[accepted inhabitants design](design/elven_inhabitants.md),
[M3 shops](M3_TRADES_TEST.md), [M4 healing](M4_HEALER_TEST.md), [tags](TAGS.md).
Owner decisions from 2026-10-07 through 2026-10-16 remain in force: fixed
professions, nonrenewable village residents, native shops with custom prices and
Renown, lead/rehome for civilians, no civilian fall damage, custom healer care,
bow combat and specified warden targets/drops. Do not reopen these as defaults.

## Final owner decisions and implementation

Owner: "Ok, now I agree with all final propositions." This includes the clarified
permanence-on-leading choice and the explained civilian hostile-target behavior.

| # | Accepted behavior | Implementation and limits |
| --- | --- | --- |
| 1 | Native leash cutting takes precedence over elf dialogs/shops. | `elf_native_use.js` is shared by the trader and Loremaster before-events: leads/name tags always pass, shears pass when the target is leashed. All five profession prompt filters exclude that same cut condition. Unattached shears retain normal dialogs. The engine owns cutting, wear, lead recovery and existing elf rehome. Native event dispatch/drop behavior still needs game acceptance. |
| 2 | Wardens accept leads and act as lead anchors. First deliberate leash permanently retains even a natural guard; release sets its new home. | Base `home:{}`, native `leashable` with the existing civilian 4/6/10 distances, cut enabled/theft disabled, plus `leashable_to:{}`. On leash, replace the village/home group with `kept_warden` (persistent, unrestricted). On any unleash, return to the persistent `village_warden` group and set home at the released position, radius20. Untouched natural guards keep their current lifecycle. No new script timer/motion service; native anchor retrieval retains its default false. |
| 3 | Zombies and ordinary illager civilian targeting should include elves; skeletons retain their ordinary civilian distinction. | Elf families now `lothlorien_elf,wandering_trader,mob`. This supersedes only the October13 elf-family retain choice. Warden `irongolem` remains unchanged and is still a skeleton target. No villager family, vanilla override, token damage or scanning service. Classification is source-configured; native AI comparisons remain pending. |
| 4 | Preserve the simple custom NPC roles and explicitly omit counterpart-only systems. | Intentional: no villager POI/bed/workstation/job/restock/demand/tier-XP/farming/breeding/village-raid/golem-cat production system; no zombie/witch/cure loop; no iron repair/cracks/poppy/construction, equipment expansion or extra direct feeding. Existing fixed shops/Harmony/Renown/healer/night/nonrenewability/combat/rewards remain accepted. Other native hazards/potions/transport remain acceptance work. |

## Per-interaction dispositions

`E` below means the exact five elf variants above; `W` means both natural and
persistent warden classes unless the row narrows it. Existing owner-tested
results have only the scope recorded in the linked sheets. Every pending native
case below targets 1.26.52; mock/source success is not a native result.

| IDs / states | Interaction / counterpart aspect | Required outcome and disposition | Source / next verification |
| --- | --- | --- | --- |
| E | Acquisition, professions | **Intentional:** planner population once; egg/summon available; no ordinary natural spawn, breeding, babies, taming or player riding. Five fixed professions, no job-block reassignment. | `elf_village.js`, `elf_rules.js`, entity profession events; accepted M1/M7. Commands, repeat planner and cross-version loading remain native checks. |
| W natural | Acquisition/population | **Intentional:** Lothlorien ground/deck spawns, pillager population pool; weight 8, herd 1-2, density 4, distance 16-48. Edge/deck keep 100%, inner keep 30%. Peaceful natural-spawn omission accepted. | Spawn JSON, `elven_warden_rules.js`, event-driven spawn judgement. Preserve completed shared depth change. Patrol/cap coexistence and deck sampling remain open. |
| W village/watch camp | Population and replacement | **Intentional/native configuration:** persistent structure guards with home radius 20; known template-default attribute replacement retained. No automatic replacement after death. | `warden_replace.js`, village/watch-camp builders, accepted inhabitants nonrenewability. Replacement preserves location/yaw/name, not arbitrary health/effects/relationships; normal reload must not be claimed to serialize all of these through replacement. |
| E; W by class | Despawn/save/load | E persistent without despawn. W ordinary distance despawn; village group persistent; native naming expected to preserve a natural guard. **Implemented/native; runtime pending** outside earlier observations. First-leash permanent retention and release-home are implemented. | Entity components; reload/unload, named guard and dimension/structure cases. The presence of the despawn component does not override native player-interaction persistence. |
| E | Body and movement | **Established custom values:** 20 HP, .6 x 1.95, movement .3; float/jump/walk, avoid water/damage/ropes, pass doors but do not open them. Panic/flee except endermen. | Entity base, accepted M1. Real rope avoidance, doors, cliffs, trapdoors, rails, slime/honey/ice and collision remain native checks. |
| E | Home, leads, schedule | **Intentional/custom, owner-tested in scope:** ordinary leads remove radius groups; any unleash records current home/moved state. Loremaster radius 6; ordinary 10; healer day 64/night 10. | `elf.js`, rehome events and radius groups; 2026-10-10 lead/rehome/roaming observations. Breaking/cutting/fence-unleash and dimension travel need acceptance. No new ordinary night schedule. |
| E | Shears and interaction precedence | **Implemented**, owner-approved item 1. Do not cancel a native cut in favor of shop/refusal/dialog. | Explicit skip lists and handler branches; official release/docs confirm native cutting. Test all five professions, active delivery, refusal and mismatched tables; observe returned lead, cut connections and rehome. No synthetic same-callback hand race. |
| W | Leads, anchors, shears | **Implemented**, owner-approved item 2. Keep named guards, class persistence, normal lead physics and combat policy. | Neither component exists; native golem has both. Verify leading, fence/mob anchors, cutting, break distance, unload, combat and village rehome if accepted. |
| E | Mob-to-mob anchor | Current civilian actor has no `leashable_to`; current villager also lacks it. **Inapplicable as a demonstrated villager parity defect.** | Adding this would be a separate custom transport decision, not a prerequisite for the ordinary lead/shears correction. |
| E/W | Naming | **Implemented/native:** nameable, no ownership restriction. E shop/dialog skip native name tags. The planner sets no per-elf `nameTag`; that is not a prohibition on player naming. | Entity JSON, `trade.js`, `loremaster.js`; native consumption, special-name rendering and reload are acceptance. Old “names lang-only” wording is clarified in the species sheet. |
| Four E shops | Currency, stock, prices | **Intentional:** native emerald exchange; Harmony prices/access and Renown unlocks. All 304 offers use max_uses 9999999, reward_exp false, trader_exp 0; one tier/table; wants price_multiplier 0. | `trade_rules.js`, 36 generated tables, accepted M3. No normal restock/demand/tier-XP system added. These are high finite use limits, not mathematical unlimited use. |
| Four E shops | Screen and multiplayer | **Implemented/custom:** nearest band/rank within 6 blocks each 10 ticks; 30-second nearby-player pin; differing click may swap, asking to use again. Matching request form and scoped 10-second Trade pass; native goals stop/face customer. | `trade.js`, accepted M3 overall; exact simultaneous screens, open-screen swaps and after-leave state remain native tests. No new claim of per-player independent native screens. |
| Loremaster and four E shops | Dialog, requests, automation | **Intentional:** Loremaster is sole quest giver; deliveries to matching profession or Loremaster fallback. Renown on player; dialogs are player UI, not hopper/dispenser trades. | `loremaster.js`, `renown_game.js`; accepted M2/M3. Keep real deferred form/session checks; no new synchronous race guards. Source audit does not migrate API2.8.0. |
| E | Beds/workstations and overnight healing | **Existing fixed-role/night design retained:** no POI, claim/release, sleep or restock goals. No dawn/level-up healing configured; accepted nearby healer care is separate. | Base/groups have home radii, not `dweller` or bed goals. Do not claim beds are impossible for custom actors; not needed for existing shops. |
| E | Farming, breeding inventory and food sharing | **Intentional role scope / owner-approved item 4:** no private food inventory/pickup/farming/harvest/compost/breeding system. Gardener shop/request is not a native farmer. | No inventory/shareables/farming/age/breed groups; nonrenewability already accepted. Ordinary dropped-item movement is not an NPC pickup implementation. |
| E/W | Native villages, bells, reputation and raids | **Intentional, owner-approved item 4:** retain custom homes/Harmony and no POI registration, raid shelter/bell routine, golem/cat summoning or Hero-of-the-Village mechanics. | No dweller/raid goals. An unrelated vanilla village introduced nearby can still trigger vanilla events; do not claim the custom buildings prevent all raids. Java gossip/siege/gifts must not be imported as Bedrock requirements. |
| E | Reciprocal hostility | **Approved and configured**, item 3. Added civilian family matches the named hostiles' ordinary clauses; general targets can also attack. | Latest zombie/husk/drowned, pillager/vindicator/evoker/ravager/vex JSON. Wither, zoglin and Johnny-vindicator general filters are counterexamples to “no monsters attack elves.” |
| W | Reciprocal hostility | **Intentional/native configuration:** `irongolem` family supplies existing monster targeting; `mob` supplies ordinary arrow shooter handling. Preserve existing family and exclusions. | Current W entity/vanilla target and arrow definitions; earlier range/kiting/ally-assist owner observations retained with their scope. Test individual opponents/difficulty rather than universal claims. |
| W | Combat, anger, player status | **Intentional:** 26 HP, .25 movement, .2 knockback resistance, range 18, intervals 1.5-2.5 seconds, native arrows/kiting/25s ally anger. Hated and temporary elf-foe players targeted. | Entity, `elven_warden.js`; creepers and daylight spiders explicitly accepted, dangerous/unsuitable exclusions retained. No iron-golem melee launch, 100 HP, player-built immunity or arbitrary ally-defense expansion. Creative/Spectator and target loss remain native checks. |
| E/W | Friendly fire and fight/kill costs | **Implemented custom policy:** shield own namespace, animals, unprovoked players from W damage; hated/foe/recent aggressor not shielded. Villagers/vanilla golems in the arrow path accepted. Fight -1, kill -6, everywhere. | `elf.js`, `elven_warden.js`, Harmony handlers. `entityHurt` requires actual damage; zero-damage provocation is not newly promised. Pet/environment kill attribution, shields/knockback and reload anger remain acceptance. |
| Healer; E/W patients | Healing | **Accepted custom:** Regeneration II to injured elves/wardens/self within 8 and sight; Friend players get I within 6. Three-second effects finish naturally, stronger/equal potions preserved. | `healer.js`, `healer_rules.js`, accepted M4. No delayed food-healing player gate; do not reopen animal-healing cleanup. Native cadence/LOS/stacking remains pending in M4 checklist. |
| W | Iron repair/cracks/poppy/build ritual | **Intentional/inapplicable, owner-approved item 4:** flesh-and-blood bow guard, not an iron construct. No iron feeding, cracked skins, poppy offering or pumpkin/iron construction. | No corresponding interact/appearance/spawn route; healer already cares for W. Do not import 25HP-per-ingot native golem repair merely because W has its family. |
| E/W | Equipment, use, pickup and removal | **Retain authored roles**, owner-approved item 4: no player inventory/chest UI or gear expansion. W equips ordinary bow, never drops it, has no melee fallback; arrows are ammunition-independent native mob shots. | Gear table, equipment slot drop chance 0, `ensureBow`, no pickup/equip goals. Dispenser/equipment recognition must be tested if desired; Java villager armor rules are not proof of Bedrock support. |
| E/W | Care items and exclusive pet systems | **Established/simple roles:** no lure/feed/breed/tame/sit/mount/saddle/shear-body/milk/bucket routes; native name/lead are separate. **Owner-approved no new direct NPC food/heal route**, item 4. | No matching components/handlers. Healing is existing healer magic and native potion handling, not golem repair or an animal feeding system. |
| E/W | Fall, water, lava and other hazards | E fall immunity is explicitly accepted. W normal fall damage intentionally retained in its design. Both finite air15, lava4/tick, float/avoid water. **Configured/custom; native environmental acceptance open.** | No golem drowning/fall immunity imported into W. Test fire, submersion/bank exit, suffocation/freezing, explosions/projectiles, lightning and ordinary beneficial/harmful effects. No new immunity or damage polling proposed. |
| E | Infection/lightning/cure | **Intentional, owner-approved item 4:** retain no zombie/witch conversion or golden-apple cure loop. | Native villager owns explicit damage-sensor/events/transformation groups; E has only fall sensor. Candidate target-family change does not copy these definitions. Exact hardcoded effects remain game acceptance. |
| E/W | Transport and persistence across dimensions | **Open native acceptance:** push/boat/minecart entry/exit/portals, identity/profession/name/home/healer rediscovery and W persistence after reload/travel. | Current native body and event-driven bookkeeping. No teleport/recovery system added. An old Overworld home after dimension travel is a real test case; do not label it fixed or invent a demonstrated failure. |
| E/W | Loot/XP and rules | E no loot/XP. W0-2 arrows plus existing Looting function, no bow/XP. **Intentional accepted rewards.** No terrain eating or griefing system. | Loot/equipment and absent XP component; no change to balance. Native doMobLoot/doMobSpawning/mobGriefing/difficulty, kill attribution and spawn-egg/command exceptions remain test cases, not guarantees inferred from omissions. |
| E/W | Art, sound and game events | **Preserve accepted art/animations and existing audio scope.** Do not substitute villager mumbles/iron stomps or claim silence proves no vibration. | Current RP has no elf/warden sound mapping; separate sound work is not part of parity batch. Native steps/swim/attack/sculk events and visual equipment remain acceptance. |

## Target-family investigation

Latest installed definitions were selected by numeric pack version, not lexical
filename order. `villager_v2` and `iron_golem` are in `vanilla_1.26.20`;
`wandering_trader` in `vanilla_1.21.0` (entity format 1.26.0). Current readable
entity JSON using the `wandering_trader` family contains these ten consumers,
all in `nearest_attackable_target`:

| Actors | Newest installed pack | Important conditions |
| --- | --- | --- |
| zombie, husk, drowned | `vanilla_1.26.50` | Zombie/husk civilian clauses bypass sight; drowned also gates by nighttime or wet target. |
| zombie_villager | `vanilla_1.20.80` | Civilian target clause; source selection, not a new infection implementation. |
| zombie_villager_v2 | `vanilla_1.26.20` | Ordinary target list includes this family. |
| pillager, vindicator, evocation_illager, vex | `vanilla_1.21.50` | Visibility/distance and goal/group requirements remain native. |
| ravager | `vanilla_1.21.90` | Family appears in hostile group; do not substitute the archive's Java-only wandering-trader statement for current Bedrock JSON. |

This scan is source evidence about the latest installed **entity files** only.
It cannot prove absence of hardcoded/other-pack consumers. Adding a family
does not import the wandering trader's timed despawn, llamas, potion drinking,
trades or village AI. Exact native outcomes must still be compared. The owner approved this elf-family addition; other `TAGS.md` retain decisions remain active.

## Sources, confidence and verification

Research order: shared skills/notes and accepted mod sheets first, current
installed counterparts and API declarations, official changelogs, official
component docs, then the requested Minecraft Wiki object/family pages.

- Official [26.50 notes](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound): strict home/interact and other schemas; current ranged attack fields; trade-screen UI changes. [26.51](https://feedback.minecraft.net/hc/en-us/articles/48915928859789-Minecraft-Bedrock-Edition-26-51-Hotfix-Changelog) is a connected-block crash fix; [26.52](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog) includes Spectator projectile protection. No listed change supplies the missing custom lead/target configuration. Keep API2.8.0; newer released APIs are outside this task.
- Official [1.21.90 release](https://www.minecraft.net/en-us/article/minecraft-1-21-90-bedrock-changelog): native shears cutting and leash attachment precedence already exist. Do not build a script replacement or report a new engine bug.
- Official [leashable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_leashable): can_be_cut, on_leash/on_unleash and presets; [leashable_to](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_leashable_to): native anchor support, can_retrieve_from defaults false. Neither implies the script form may cancel the use.
- Official [type_family](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_type_family), [dweller](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_dweller), [economy_trade_table](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_economy_trade_table): classification, village-role and shop mechanisms are separate. `persist_trades` documentation does not establish open-screen swap safety. The direct sleep_in_bed documentation URL failed; installed villager groups remain the source, with no platform-impossibility claim.
- Canonical [Villager](https://minecraft.wiki/w/Villager) and [Iron Golem](https://minecraft.wiki/w/Iron_Golem) requests failed. Read **November 2025 archive**, retrieved 2026-10-20: [Villager](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Villager) (acquisition, pathing/doors, items/equipment, jobs/sleep/healing, trade, hostility/conversion, sounds/history/edition notes); [Iron Golem](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Iron_Golem) (creation/drops, patrol/targets/provocation, leads/hazards, repair, path/climb, sounds/history). Historic or Java-specific statements are not current Bedrock observations.
- Related archived [Trading](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Trading), [Village](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Village), [Lead](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Lead), [Wandering Trader](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Wandering_Trader): reviewed stock/tiers, village recognition/events, transport/cutting and civilian analogue boundaries. No current revision ID obtained; archive date is not retrieval date.

## Verification, deployment and game checks

`mods deploy lothlorien --suite npc-interactions --suite elves --suite wardens --suite trade --suite renown --suite healer --suite performance --suite suite-layout`
passed all **9 runners**, localization and shared verification. Production:
**0 errors, 0 warnings, 15 documented exceptions**. Optional probe:
**0 errors, 1 unchanged warning**. **6 BP files copied, 0 removed; RP/probe
unchanged.** Subsequent `mods status lothlorien` confirmed all three packs in sync.

Four new offline NPC scenarios check authored wild/village lead-state transitions,
persistence/home release and repeat moves, conditional native-use eligibility,
all-five prompt agreement and civilian classification/exclusion boundaries.
Two production-handler scenarios also check all-five native handoff across
refusal/request/table-mismatch conditions and ordinary idle-shears dialogs.
Existing renown/trade/elf/warden assertions were updated for the accepted behavior;
healing/performance checks remained intact. The JSON event-state checks are not
native AI, physics, serialization or reload simulation.

Native acceptance: lead a wild and a village guard, move/release each, leave and
reload the world, travel away/back and confirm identity/permanence/home; repeat
cut/break/fence and mob-anchor cases. Cut leashed elves of every profession,
including a request/refusal case, and observe native lead recovery plus rehome.
Compare zombie/illager approach to civilians with skeleton ignoring and skeleton
hostility to wardens. Native UI/transport/hazards/gamerules in the inventory remain
open. Leave/re-enter the world to load changes; no new world is required.

No art, sounds, stock, recipes, balance, spawn rules, terrain generation or shared
healer/wariness/animal-food code was changed. No mod commit was made amid the
existing uncommitted parity work. Shared inspection/clarification history is in
workspace commits `666fbfe` and `c155239`; completion knowledge is committed as
`572a394` (`Record approved NPC parity fixes and deployment`) separately from mod work.

## Clarification evidence

The [November2025 Mob spawning archive, Bedrock despawning section](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Mob_spawning#Bedrock_Edition)
documents persistence from leashing continuing after release. This is documented
gameplay, not a custom-warden1.26.52 observation; accepted persistence is explicit
in native groups rather than relying on an unverified incidental exemption.
Current installed skeleton/stray/bogged/parched ordinary targets omit
villager/wandering_trader; wither skeleton also targets piglins but omits these
civilian families. Zombie/illager civilian clauses include them. Classification
is not biological/lore ancestry or an inherited complete mob implementation.
The earlier broad keep-family audit did not explain a separate predation choice;
the owner approved the now-explained change.
