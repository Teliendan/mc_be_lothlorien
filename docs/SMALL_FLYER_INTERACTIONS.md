# Songbird, butterfly and firefly interaction review

Group15,2026-10-20; Bedrock1.26.52 / stable server API2.8.0.
**Owner decisions implemented, verified offline and deployed2026-10-20; all3
packs confirmed in sync. No new game observations.** Previous care and real
deferred Group9 bottle checks remain in force.

IDs: lothlorien:songbird (blue/yellow/pink), lothlorien:butterfly (eight wing
variants), lothlorien:firefly (wild/released), bottle_of_fireflies, glass_bottle;
linked grain/flower care and existing bottle recipes/firefly_jar.

## Final owner decisions and source changes

Owner: "1. I think that no flocking would be better, wouldn't it? ; Rest is OK,
do it." Independent flight was accepted; no same-species flocking substitute.

| # | Finding | Recommendation / evidence |
| --- | --- | --- |
|1 | Generic follow_mob was not songbird flocking. | **OWNER CHOICE IMPLEMENTED:** remove follow_mob entirely; no same-species following/flock replacement. Preserve random_fly, no tree landing, speed, remaining priorities/tempt/panic, spawn/art/sound balance. Naturally spawned groups need not move as an AI flock. |
|2 | Songbird/butterfly lead anchors absent. | **IMPLEMENTED:** native leashable_to:{} beside existing leashable, matching current adult parrot/bee. Firefly remains bottle-only/no lead. Actual attachment/cutting/towing native acceptance remains open. |
|3 | Insect flap game events omitted. | **IMPLEMENTED:** native game_event_movement_tracking emit_flap:true on butterfly/firefly. Songbird already had it. Silence/audio unchanged; no scripted vibration loop. Native flap/sculk output still needs observation. |
|4 | Capture lost current health and name. | **IMPLEMENTED:** localized structured RawMessage lore carries only captured name/current health; restore before spending the bottle. Plain healthy unnamed captures remain metadata-free. Same item/max16; actual merge behavior for metadata-bearing bottles needs native acceptance. No stackable item DP, hidden JSON, effect/owner/AI/entity serialization or new item IDs. |
|5 | Simple-species counterpart omissions needed explicit disposition. | **OWNER-ACCEPTED INTENTIONAL:** no parrot pet/sit/shoulder/teleport/mimic/dance/cookie poison; no bee hive/honey/sting/colony/breeding/pollination/growth/poison-flower rules. No butterfly bottle, extra foods or variants. Preserve accepted care, ordinary hazards and deferred bees. |

## Captured identity/health and bottle policy

Pinned API2.8 forbids ItemStack dynamic properties on stackable items; keep the
bottle's max16 and use documented localized RawMessage lore instead. Three
contextual keys display "Firefly: <name>", continuation name parts, and "Health:
<value>" in all9 locales plus existing aliases. These are visible descriptive
tooltips, not hidden JSON. Captured-name parts stay<=24 UTF-16 units without
splitting surrogate pairs; translated lines remain<=50 characters and at most20
lines. Exact raw values are read through getRawLore, not translated display text.
API clone copies custom data. Both documented with:string[] and the shared
message helper's with.rawtext form are accepted. Runtime persistence/normalization
of these raw messages and actual native item merging remain acceptance checks.

The capture callback reads actual living entity state in its privileged deferred
execution before removal. Bottle creation/required lore writes must succeed
first. Empty-glass name/lore never transfers. The bottle title stays the ordinary
localized item name; canonical captured name is in descriptive lore. Anvil
renaming a full bottle changes its title only and does not rename the animal.
Unrelated bottle lore is not animal identity. Ordinary full-health2/unnamed
captures have no added lore/title and remain the plain bottle representation.

Release reads its original validated bottle lore, spawns the existing persistent
released variant, restores captured name/current health, then exchanges for
plain empty glass. Failed required name/health restoration or bottle exchange
attempts best-effort removal of the new actor and retains the original bottle
where possible. No arbitrary effects or altered maximum health are serialized;
stored health is clamped to the released animal's effective maximum if a
temporary modifier had raised it above ordinary2HP. Ordinary current health,
including fractional injury, is preserved exactly. There is no fallback spawn,
new rollback/retry loop or atomic engine-write guarantee.

Crafting a jar/lantern/other ingredient consumer is normal resource use, not a
persistent named-animal enclosure. Recipes and artwork are unchanged. A named
or injured captured animal can therefore be spent as that ingredient; no hidden
protection/recipe substitution was added. Native stack cap stays16; metadata can
prevent merging, so do not promise all identical-looking captured bottles stack.

## Counterpart inventory / dispositions

| Interaction | Current implementation/design and remaining checks |
| --- | --- |
| Body/variants/spawn | Songbird4HP/.4speed/.4x.5 hitbox/three plumages40:30:30; butterfly2HP/.06 movement/.05 flying/.3x.3/eight equal colors; firefly2HP/.08 movement/.06 flying/.2x.2. Native summon/egg, spawn properties/render bindings retained. Exact distributions/render/commands remain acceptance. |
| Population and environment | All animal pool, Lothlorien surface grass/dirt, distance10-40. Songbird light8-15/weight40/herd2-4/surface cap10; butterfly8-15/10/3-5/10; firefly0-7/6/2-4/6. These are actual pack values, not older species-sheet numbers. Light gating is not a clock-only day/night guarantee: shade/artificial light/weather can differ. No density/worldgen retuning proposed. |
| Despawn/persistence | Standard distance despawn. Native naming keeps animals; accepted bird/butterfly feeding adds persistent, released fireflies persistent. Wild fireflies remain wild-distance despawn. Persistence is not confinement/invulnerability; actual reload/unload/biome/dimension outcomes remain native acceptance. |
| Movement/idle | Songbird native fly/random_fly, ground landing allowed; tree landing intentionally disabled after owner observed diving2026-10-02. Butterfly/firefly hover1-2/1-3 blocks. No bat ceiling sleep or bee nesting/weather routine. No forced dawn removal/night removal; do not infer that light-gated spawns make existing animals vanish. |
| Flocking/reciprocal mobs | Songbird independent flight intentional; follow_mob removed. Insects idle/passive panic only. Distinct mod+mob families/arthropod retained, not a promise every vanilla mob ignores them. No parrot/bee/bat/prey aliases, automatic frog-food/fox-prey/bee swarm. Bane configured; native combat remains acceptance. |
| Lure/heal/feed | Songbird wheat and Western Corn grain, native2HP/force_use:true/vertical lure12; butterfly explicit27 vanilla +4 Lothlorien plant items, same native2HP/force_use/vertical lure12. Accepted full-health feeding grants persistence. Native owns food/heal; no later player-status cancellation. No extra corn uses. No need to import parrot seeds/cookie or bee breeding/poison rules. |
| Flower list boundaries | Butterfly list includes closed/open eyeblossom and wither rose without bee poisoning; excludes Athelas/golden fern and flowering branches/leaves/propagules. Custom lothlorien:flower classification alone does not confer butterfly food behavior. Existing care names four custom foods; retain under owner-accepted item5. Bee crop/block targeting remains owner-deferred after failed tests, not reopened by this audit. |
| Transport | Ordinary leads and native lead anchors on songbird/butterfly. No firefly lead/lure/feed/heal, bottle-only transport. Native boat/minecart/portal/pushing/clearance/trapdoors remain acceptance; no script bypass. |
| Education balloons | Songbird retains balloonable like parrot. Butterfly/firefly omit it; Education-only balloon behavior is outside this ordinary Bedrock target and is not evidence for adding another transport system. |
| Flap/sounds/sculk | All3 now declare emit_flap. Ordinary move/swim native defaults retained. Songbird accepted ambient songs2026-10-16 retained; insects intentionally silent and firefly emissive visual is not dynamic light. Native vibration output remains separate from audio/visual acceptance. |
| Hazards | All native fall immunity, finite air15, lava4 damage/tick, ordinary fire/water/suffocation/explosion/freezing. Navigation avoids water/damage for insects; no water breathing, bee contact-water harm, bee berry-bush immunity or new fire/powder-snow protection proposed. Native actual effects, collision/cliffs/ice/slime/honey/cobwebs and environmental/navigation outcomes remain acceptance. |
| Care/exclusive pet features | Intentional no babies/breeding/taming/owner/ride/armor/inventory/sit/shear/milk/bucket/shoulder/mimic/dance/cookie poison. No bee colony/poison/pollination/growth systems. Butterfly no capture; firefly bottle is the deliberate exception. Existing27+4 butterfly foods and2 grain foods remain exact, bees remain deferred. |
| Naming and firefly identity | Native nameable on all3, no owner gate. Firefly capture now preserves current name/health through localized raw lore; anvil bottle titles do not rename animals. Native name consumption/special-name rendering/reload/lore persistence remain acceptance; no new skin. |
| Catch/release | Existing real before-event -> system.run boundaries and shared held-source/metadata/dimension/reach/block/container checks retained from Group9. Competition/full inventory/stack/Creative cases already offline-covered; no repeated same-callback player-race claim. Existing nontransactional remove/inventory/spawn limits remain explicit; no new speculative rollback/retry. |
| Capture automation | Current capture/release is player-scripted; no native dispenser bottle deployment or automatic capture configured. Generic bucket dispenser behavior is not proof a custom glass bottle spawns fireflies. Keep OPEN supported-path/design investigation, no invented dispenser component. Recipes/crafted bottle handling remain existing resource use. |
| Rewards | Songbird one feather roll0-1 plus existing Looting0-1 function and1-2XP player kill; custom balance differs from parrot1-2 feathers/1-3XP. No insect death loot/XP. Preserve design/tables; kill credit, pet kills, Looting context, doMobLoot and death/signal outcomes remain native acceptance. No passive egg/feather breeding system imported. |
| Terrain/gamerules/commands | No terrain grazing, bee pollination/crop growth, item pickup/equipment/attack/colony aggression/transformation. Native interaction gating, Peaceful/Creative/Spectator, mobGriefing/drop/fire rules and command/structure placement remain acceptance. Do not invent unexpected callback states as normal player behavior. |

## Evidence and sources

Read shared modding/mob/care references and current species/care/Group9/tag notes,
entity/spawn/loot/item/scripts/tests first. Newest installed counterparts:
parrot vanilla_1.21.90, bee vanilla_1.26.30, bat vanilla_1.20.80, frog vanilla_1.26.50.
Parrot adult and bee adult both contain leashable_to:{}; all parrot/bee/bat
base definitions contain emit_flap:true. Native frog eat_mob is specific prey
selection, not authority to turn the custom firefly into frog food.

Official [26.50 changelog](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
checked before workaround: stricter follow_mob/movement-tracking schema; follow_mob
stopping now interrupts navigation. These do not fix the custom flock filter or
add omitted flap settings. [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
has no relevant custom flock/capture update. Keep pinned API2.8.0; no API migration.

- [follow_mob](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitygoals/minecraftbehavior_follow_mob): nonempty filters override defaults; default excludes own type. Page updated2026-08-25.
- [movement tracking](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_game_event_movement_tracking): implicit mob component, emit_flap defaults false, move/swim true.
- [leashable_to](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_leashable_to): native mob anchor/retrieve/shear handling, format>=1.21.90.
- Direct Parrot Wiki read failed. **November2025 archive** [Parrot](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Parrot): spawning/drops, other-mob curiosity, taming/food/cookie, shoulder transport, mimic/dance, edition/history.
- Same archive [Bee](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Bee): hover/leads/hazards/arthropods, flower foods, poison exceptions, hive/weather/day routine, breeding/pollination/crops and death. This does not reopen deferred bees.
- Same archive [Bat](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Bat): passive flight/resting, cave spawn/drops, no leads/breeding, hazards and edition-specific collision behavior. Used for ambient/no-drop aspect, not insect identity.
- Generic aquatic-bucket archive URLs failed. Accessible [Bucket of Axolotl](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Bucket_of_Axolotl): capture/release/non-despawn/dispenser and naming. Bedrock captured names are represented in the bucket label; listed health/entity NBT fields are explicitly Java, not Bedrock proof.

## Verification and native acceptance

New independent small-flyers suite has12 production/data scenarios: native
policy declarations; plain healthy/unnamed; name/injury/fractional health through
capture/clone/release; actual entity-state read after the deferred boundary;
255-unit Unicode name/all9 locale line bounds; both raw argument forms; anvil/
unrelated-lore exclusion; stacked/full-inventory/Creative container policy;
distinct/identical raw capture data; invalid capture state; failed name/health
restore cleanup; and actual deferred bottle-lore change rejection. Mock stackable
DP writes throw. The tests never claim native item merge or raw-message storage
has been observed. A shared bottle fixture contains no test bodies on import;
decor-rope retains all15 production scenarios and16 chandelier combinations.

Selected small-flyers, animal-home, decor-rope, performance, suite-layout:
5 runners passed; localization build/check passed. Production BP/RP0 errors/
0 warnings/15 exceptions; unchanged probe0 errors/1 warning. New catalog text
is ai-draft with reviewed context/fingerprints; generated locale text is the
only RP change. All3 art generators are art-only and were not executed; the
entity JSON remains behavior authority, so no artificial generator post-pass
was added. Root deploy repeated the same5 selected runners successfully and
copied5 BP +11 RP files,0 removed; probe unchanged. Production0 errors/0 warnings/
15 exceptions; probe0 errors/1 unchanged warning. Root status confirmed all3 packs
in sync, main@be368ff with264 dirty entries preserved. Protected bottles.js,
interaction_use.js, animal_food.js, harmony_game.js and unicorn.js hashes unchanged.
No worldgen changes or new native observation. Shared tracker and scripting
knowledge are committed separately in workspace `4accf79`; next owner review is
Group16 elves/wardens, with six further groups plus final reconciliation.

Game checks: independent bird flight without following other species, existing
ground landing/no-tree policy, native lead anchors/cutting/towing, insect flap
events at sculk while sound stays silent, named/injured firefly catch/release,
fractional health, inventory/drop/save/reload and locale switching of raw lore,
actual compatible/incompatible bottle stacking, full inventory/Creative and
release failure boundaries. Existing old visual/sound/catch observations retain
their exact historical scope.
