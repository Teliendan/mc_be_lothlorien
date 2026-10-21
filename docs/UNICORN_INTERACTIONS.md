# Unicorn interaction review

Group14,2026-10-20; target Bedrock1.26.52 / stable API2.8.0.
**Group14 owner review and approved source fixes are complete/deployed2026-10-20:
swimming, native healing and per-player Friend luring. Owner-only bonded naming
and no equipment are intentional. Native acceptance and unsupported comparisons
remain open; this does not declare complete native parity.**
Owner interrupted discovery to challenge root's hand-switch premise. See
[synchronous guard review](../../../docs/synchronous-validation-review.md)
before resuming. The separate approved synchronous cleanup is recorded in
[SYNCHRONOUS_VALIDATION.md](SYNCHRONOUS_VALIDATION.md). This checkpoint is not a
native-tested parity declaration; the counterpart disposition inventory is below.

## Owner clarification and evidence correction

Bond offering executes synchronously with no yield between its reads and charge.
The earlier changed-hand/free-offer reproduction injected contradictory event
and current-hand data. It does not establish a normal player hand-switch race.
The dead/Spectator/distant/different-dimension cases likewise injected callback
inputs, not proof Minecraft permits those interactions. Do not present them as
observed gameplay defects or justify repeated same-callback validation with them.

Owner: "Queued healing should happen, I guess without any conditions..." Root
agreed: once valid feeding is accepted, later movement/slot/context changes should
not revoke it. Native healable in the bonded group now owns Elanor2HP
healing+consumption together; the owner gate is unchanged. No extra deferred
ownership/reach/dimension/trust/slot cancellation was added.

Accepted healing semantics are **implemented natively**: remove the owner
injured-Elanor cancel/system.run branch and add bonded-only healable with
force_use:false. No food-healing script queue remains, so later player context
does not revoke accepted healing. Full-health mounting remains intended; exact
native healing/mount precedence still needs game acceptance. Current record:
[NATIVE_ANIMAL_HEALING.md](NATIVE_ANIMAL_HEALING.md).

Root reviewed/deployed native healing with4 selected runners passing,
production0 errors/0 warnings/15 exceptions, unchanged probe1 warning and all3
packs in sync. Two BP files copied; no RP/worldgen change. Shared policy and
handoff commit `cfb84b3`; native healing/mount acceptance remains pending.

Retired read-only `temp/interaction-group14/audit.mjs` recorded10 injected outcomes
and has been removed after meaningful permanent tests replaced it.
Changed-hand/dead/Spectator/range/dimension offers were artificial mismatches.
Owner-write exception can leave trust3/announce trust3 while tame is unset;
this is fault-injection evidence about partial failure, not a routine-timing bug.
The earlier queued implementation survived moving away but lost healing when
the hand changed; that queue is now replaced by native healing. The injected
tests did not establish an ordinary synchronous player hand-switch race.
The owner gate also cancels stranger name-tag use; the owner has now explicitly
retained owner-only bonded naming. An owner-read exception remains injected
failure evidence, not a new demonstrated gameplay timing defect.

## Swimming implemented and deployed2026-10-20

This earlier approved unicorn change copied newest installed
vanilla1.26.50 horse float/buoyancy behavior. Both entities/unicorn.json and
tools/make_unicorn.py now declare float priority0/chance0/underwater passenger
dismount2s and buoyant base1/apply_gravity:false/auto-step:true/movement_type:bobbing
for water, flowing_water, lava and flowing_lava. Preserve existing breath supply15,
no water breathing, existing lava4 damage/tick declaration, best-horse stats,
owner riding, step height, artwork and all care/bond settings. The generator was
not executed; an AST-only comparison confirmed its literal data matches the
pack and current native horse. RP remains unchanged.

Offline unicorn assertions check exact data and retained hazard declarations.
Root deployed the combined cleanup/swimming batch with14 selected runners
passing, production0 errors/0 warnings/15 exceptions and unchanged probe1 warning;
all3 packs confirmed in sync. No new native swimming observation or worldgen
change. Leave/re-enter the world to load it.

Native acceptance still needs unmounted and owner-ridden surface crossings,
bank exit/one-block step, sustained-submersion passenger dismount, and preserved
drowning/lava damage. Data matching does not prove those outcomes in game.

## Counterpart findings to finish reviewing

### Owner decisions and Friend-only lure implementation2026-10-20

Owner: "1. Yes, 2. No, only owner, 3. Yes".

| Decision | Final implementation/disposition |
| --- | --- |
|1 Friend-only lure | IMPLEMENTED native follow_target_leader replaces generic tempt in the Friend state. Its required leader predicate is actual player + lothlorien_friend runtime tag + held Elanor. Both standing/sneaking player avoidance entries negate this exact predicate, so an unqualified Elanor holder does not receive the no-flight exemption. |
|2 Bonded name tags | INTENTIONAL owner-only naming; keep the existing foreign-owner before-event gate unchanged. Owner access passes through to native nameable/healable/rideable handling; stranger name tags remain cancelled. No mount-only reinterpretation of that gate. |
|3 Equipment | INTENTIONAL no horse armor/equipment/inventory, equip/shear-removal/dispenser route, saddle slot or chest/bags. Preserve saddle-free owner riding, fixed stats and no-lead/no-breeding design. No new foods, foals, coats, drops or XP. |

`harmony_game.js` synchronizes Friend/Hated band tags through its existing
update/20-tick refresh. State/deed/death/debug/recovery changes update them
without a new interval, global entity query or animal movement script. Friend
is solely the actual Harmony band, independent of game mode. Existing refresh
repairs persisted stale membership on join/reload; existing leave handling
clears the state cache. [Tag authority/consumers](TAGS.md) records the contract.

Native goal values: priority3/speed1 retained, follow_distance1.5 (documented
tempt stop-distance default), explicit within_radius10, always_look_for_leader:true,
search_cooldown20 ticks. The old tempt radius was omitted and its documented0
default does not establish the effective native search range; exact range
equivalence is not claimed. Current entity and source generator match; the
generator was not run and RP is unchanged.

Shared40-tick nearest-player wariness is unchanged: a nearer Guest may select
calm and suppress luring entirely. The Friend-state filter does not override
that global decision. Native acceptance should first keep nearest Friend
empty-handed and slightly farther Guest holding Elanor: Guest must not lure.
Then Friend holds Elanor and should be followed; dropping it or losing Friend
must invalidate/retarget following. Check standing/sneaking exemption, multiple
Friends, native goal timing/search range and panic/wolf/monster priority. The
filter matrix test asserts eligible membership only while Friend state is
active; it does not prove a farther Friend wins over global nearest-player state.

Offline: new independent unicorn-luring runner has8 production-tag/filter
scenarios (persisted/stale refresh, debug/mode, deed/recovery, fight/death,
leave/rejoin, exact predicate matrix, unqualified near player, bounded goal data).
Animal-home also checks actual owner/stranger name-tag before-event handoff.
Selected unicorn-luring, unicorn, harmony, animal-home, performance, suite-layout:
6 runners passed; production0 errors/0 warnings/15 exceptions, unchanged probe1
warning. Generator AST-only check confirms follow/avoid predicates without
executing it. Root reviewed/deployed the exact6 suites2026-10-20:2 BP files copied
(harmony_game.js and unicorn.json),0 removed; RP/probe unchanged. Subsequent
mods status confirmed all3 packs in sync at main@be368ff,246 uncommitted.
No worldgen change or new native observation. Leave/re-enter to load it.
Shared native-filter evidence, owner decisions and current handoff are committed
separately in workspace `4c63460`; no mod commit made. Group14 owner review and
approved source fixes are complete, with native/support investigations open.

Known-first research: shared pathfinding guidance and shipped white-deer/squirrel
goal data were read before current docs. The white-deer goal was owner-tested
in1.26.52; absence from installed vanilla is not absence of custom-goal evidence.
Official26.50/26.52 notes reveal no relevant lure change. Official leader goal
docs confirm format>=1.26.20, leader_filters and bounded search; format1.26.50
meets that requirement. Per-player/held-item filtering and native retargeting
are still new acceptance work.

The partial-owner-write/trust3 message scenario remains fault-injection evidence
only. A success-message-after-success ordering cleanup is possible, but it is
not presented as a reproduced gameplay timing defect or a reason for deep
synchronous snapshots. Native error frequency/transaction guarantees are unknown.

### Counterpart inventory and remaining native checks

Horse Wiki archive, linked Name Tag/Riding archive and current native horse/data
reviewed2026-10-20. Archives are November2025 and predate current swimming.
Official26.50 and26.52 changelogs rechecked; no specific lure/naming fix found.
Rows group only mechanics with the same policy; OPEN outcomes stay open.

| Interaction | Disposition / evidence / next check |
| --- | --- |
| Natural spawn, eggs/summon, caps | Existing uncommon single Lothlorien spawn, grass/dirt/light/distance/cap settings retained. Native spawning accepted broadly2026-10-02; exact frequency/caps/commands/difficulty remain acceptance. No horse plains/herds imported. |
| Body, stats and variations | Existing adult horse-size body, fixed best-horse stats, one pearl/lilac coat retained. No random stat/coat inheritance. Accepted riding/step/head-turn scope remains separate from all hazard outcomes. |
| Wild despawn, named/bonded persistence | Standard distance despawn plus nameable and bonded persistent. Owner identity is saved as a dynamic property; save/reload/dimension persistence still native acceptance. No player-disconnect untaming. |
| Lure, approach and avoidance | Friend-only native leader predicate and identical no-flight exemption implemented; generic tempt removed. Existing nearest-player state selection/alarm/wolf/monster avoidance retained. Native retarget/range acceptance open. |
| Trust/taming | Three accepted Elanor offers,10s spacing,2HP, Friend gate and Creative food rule retained. Replaces horse temper/bucking/tamemount. No hotbar interleaving premise. |
| Food, feeding and healing | Elanor only; wild trust healing synchronous and bonded healing native. Completed2026-10-20. Initial owner gate retained; no later player-dependent revocation. Cap/Creative/native feed-versus-mount acceptance remains pending. |
| Name tags | Native nameable configured. Owner explicitly retained owner-only bonded naming; stranger gate unchanged and tested offline. Name consumption/persistence/name effects remain native acceptance. |
| Saddles, armor, UI and shears | Owner explicitly retained no saddle slot, horse armor/equipment/inventory, equip/shear-removal/dispenser route or chest/bags/mule inventory. Saddle-free owner riding remains. |
| Leads, fences, towing, lead anchors | Explicit owner no-lead design; all lead attachment/towing/anchor routes excluded. Do not restore via horse family. |
| Breeding, babies, growth and hybrid mules | No breeding per accepted care design2026-10-11. No foals/growth/golden-food love mode/horse-donkey crossbreeding/inheritance/breeding XP. No added food consumers. |
| Mount/steer/jump/step/dismount | Native bonded one-player rideable/ground control/power jump; owner accepted saddle-free riding/one-block step2026-10-02. Exact charge/UI, sneak dismount, clearance/suffocation and input variants remain native checks. Wild/undead jockey riding excluded by no wild rideable/player-only bonded family. |
| Water/banks/submersion/bubbles | Current horse buoyancy/float copied and deployed. Ridden/unridden crossing, bank exit, bubble behavior and2s submerged dismount remain game acceptance. No water breathing. |
| Land/ice/honey/slime/rails/navigation | Native physics/walk/pushing/jump/avoid-damage settings retained. Terrain friction, narrow gaps, cliffs, doors, collisions and minecart transport are native comparisons; no demonstrated missing override. Workspace animals intentionally do not climb ladders/vines. |
| Fall damage and rider routing | Archive describes horse reduction and shared rider damage, but custom equivalent is not established by JSON. OPEN native comparison, not a proven missing component. No invulnerability or speculative scripted replacement. |
| Passive health recovery | Archive describes horse recovery; custom/native mechanism not established. OPEN comparison; no timer/polling added solely from absent JSON. |
| Fire/lava/air/freezing/suffocation/explosions | Finite air/lava damage and ordinary native hazards retained; no blanket immunity/powder-snow walking. Actual custom outcomes remain native acceptance. No horse armor protection because armor absent. |
| Potions/beacons/enchantments | Ordinary custom-mob effect/damage handling retained. Horse-specific jump-boost exceptions and fall outcomes require comparison; do not import Java assumptions or add undocumented families. |
| Portals, teleport, minecarts/boats | Native transport and dimensions remain game acceptance; horse/width and Bedrock portal rules have edition/version details. No command interception, special portal protection or scripted transportation. Owner dynamic property should survive travel; not yet observed. |
| Reciprocal mobs, retaliation and terrain/item use | Passive panic/avoidance only; no attack/owner defense/crop grazing/item pickup/equipment/terrain destruction. Distinct mod+mob families retained by accepted tag policy, no vanilla horse/prey family for speculative engine features. Alarm/Harmony harm rules retained. |
| Lightning/zombie/skeleton/special variants | No custom transformation or undead/trap variants; horse counterpart does not justify adding a new unicorn species. General lightning/damage remains native acceptance. |
| Death, loot, XP and pet notification | Existing no loot/XP design retained, so Looting/equipped-item/breeding drops have no added route. Native tamed death-notification/owner attribution is not established by is_tamed plus scripted owner; keep OPEN for observation. Player kill Harmony/alarm behavior already source-configured. |
| Sounds, animation, signals and commands | Existing horse ambient/hurt/death/step and walk/look, no added rear/graze/tail art. Native vibrations/plates/sculk, entity removal/gamerules and client presentation remain acceptance. No eat_block terrain conversion for a grazing visual. |

This inventory records completed owner decisions/source fixes; native-support
investigations mean full unicorn coverage/parity is not declared complete.

- Preserve accepted three Elanor offers/10s spacing/2HP care, Friend bond rule,
  fixed best-horse stats, saddle-free owner riding, no leads, persistence and
  no death loot/XP. Old sheet's test column/open text predates owner-accepted
  spawn/bond/riding/one-block step/head-turn observations; retain exact scope.
- Swimming data now matches newest installed1.26.50 horse as recorded above.
  Official1.21.130 release says ridden mounts no longer sink; unicorn native
  acceptance remains open. No water-breathing/lava immunity is implied.
- Official26.10 replaced buoyant simulate_waves with movement_type and added
  can_auto_step_from_liquid (format>=1.26.10). The old custom swan experiment
  rejecting simulate_waves is not proof current mob buoyancy is unsupported.
  Do not change the separately accepted swan navigation in this group.
- Per-player Friend luring now uses filtered follow_target_leader and the
  existing Harmony-service tag; native AI acceptance is still required.
  Shared wariness's multiplayer state selection is unchanged, not replaced by
  the player filter. No extra global loop or player-moving script was added.
- Owner explicitly retained no armor/equipment/inventory/shear/dispenser routes.
  No breeding/foals remains accepted care design. No extra corn/wheat foods;
  Elanor care is accepted. Earlier "was not asked for" wording is superseded by
  explicit owner policy, not used as the implementation rationale.
- Archived Horse describes equine fall damage/rider routing and passive health
  recovery; newest native JSON does not expose an equivalent setting for each.
  Custom equivalence remains OPEN for engine comparison, not proven missing and
  not permission to add speculative horse families, invulnerability or polling.
- Continue native transport/portal/dismount/hazards/potion/ownership/reload/
  command/gamerule comparison checks from the completed disposition inventory.
  Saddle, lead and shared native prey-family decisions already have authority;
  species-specific jobs are not automatically required for every equine mob.

## Sources checked

Shared mobs/scripting/modding skills, lifecycle/pathfinding/coverage references,
animal-care reference; current unicorn sheet, generator, production scripts/data,
existing unicorn/animal-home tests; newest installed
`reference/vanilla/current/behavior_packs/vanilla_1.26.50/entities/horse.json`.
Sources support the source changes recorded above; no new game observations.

- Direct [Horse Wiki](https://minecraft.wiki/w/Horse) read failed; retrieved
  [November2025 archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Horse)
  for spawn/drops, behavior/food/care, body/statistics, breeding and edition notes.
  Archive predates later water-mount changes; it is not a current revision.
- Follow-up2026-10-20 also checked archived [Name Tag](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Name_Tag)
  usage/persistence and [Riding](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Riding)
  passenger damage, minecart/boat pickup, portal and edition notes. Conflicting
  older portal descriptions remain native/version comparisons, not new scripts.
- Official [26.50](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog),
  [26.52](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog),
  [1.21.130](https://www.minecraft.net/en-us/article/minecraft-1-21-130-bedrock-changelog),
  [26.10](https://feedback.minecraft.net/hc/en-us/articles/44418129038733-Minecraft-Bedrock-Edition-26-10-Tiny-Takeover).
- Official [buoyant](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_buoyant?view=minecraft-bedrock-stable),
  [float](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitygoals/minecraftbehavior_float?view=minecraft-bedrock-stable),
  [healable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_healable?view=minecraft-bedrock-stable),
  [rideable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_rideable?view=minecraft-bedrock-stable),
  [tempt](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitygoals/minecraftbehavior_tempt?view=minecraft-bedrock-stable),
  [follow_target_leader](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitygoals/minecraftbehavior_follow_target_leader?view=minecraft-bedrock-stable).
  Pinned2.8 APIs read for owner/tame/ride/damage capabilities; no native owner
  component was added or assumed from the custom dynamic property.
