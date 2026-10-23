# Vanilla interaction ledger

2026-10-18 inventory; reconciled2026-10-23.
Target Bedrock **1.26.52** / Script API **2.8.0**.
Source/documentation audit; **no new agent-run engine tests**. Feature follow-ups
include pack changes and explicit owner decisions on 2026-10-18/19. The owner's
boat observations are recorded with their exact scope in the vehicle row and
linked audit; they do not verify every pending native interaction.

2026-10-18 dense native worldgen test: [TREE_GRID_TEST.md](TREE_GRID_TEST.md)
changes only structure-set selection and adds category definitions referencing
unchanged saved assets/loot/residents. Existing interaction policies and open
coverage findings remain in force; no item/block/entity mechanics or new native
parity claims are introduced. Distribution, independent-start collisions and
terrain fitting are explicitly the pending in-game test.

Follow the [shared interaction workflow](../../../.claude/skills/bedrock-modding/references/22-vanilla-interactions.md)
and [source/coverage report](../../../docs/vanilla-interactions-audit-2026-10-18.md).
The source report supplies canonical/archived Wiki URLs, inspected sections and
access/version limits. November 2025 archived pages are discovery evidence, not
proof of current engine behavior.

Every identifier below inherits the shared common prompts and its family row.
Linked block items, entity placers, projectiles and variants must be tested as
one feature. Existing notes establish only the interactions they actually
describe. **OPEN** means discovery/intent/implementation or game behavior remains
unresolved; no family below claims a completed all-interactions parity sweep.
For closure, expand the family row into individual interaction outcomes using
the shared row format and record test version/date.

## Family findings and decisions

2026-10-19 approved [flowers, herbs and crops](FLORA_CROP_INTERACTIONS.md): guarded
use, soils/compost/recipes and state-aware corn support/growth are implemented.
No legacy support or extra wheat uses; bee compatibility is owner-deferred after
prior unsuccessful testing. Native environmental/automation acceptance remains open.

Owner review2026-10-19: [ground cover/dew](COVER_INTERACTIONS.md) approved with
both-cover full-top support and no cover bone meal. Guard/data fixes implemented;
dew formation through roofs is intentional (owner2026-10-19: obstruction checks
are not worth the complexity). Exact surface completeness, replacement and native
engine acceptance remain open. Deployment status is recorded by the root handover.

Owner approved2026-10-19: [lights, decorations and ropes](DECOR_ROPE_INTERACTIONS.md),
including guarded firefly bottle exchange, effect-safe rope service/bounds/loot,
fuel15, waterlogged-contact exclusion, chandelier stack64 and the revised
one-antler/four silver-or-gold lantern recipe. Player-only rope climbing is
intentional. Native physics, environmental and signal acceptance remains open.

Owner approved2026-10-19: [food, remedies and bottled ingredients](FOOD_REMEDY_INTERACTIONS.md).
Group10 owner approved and implemented2026-10-19; native acceptance remains pending. Existing ingredient-only nectar,
dew resource use and corn exclusions remain in force.

Group11 approved and implemented2026-10-19: [Phial and temporary light](PHIAL_INTERACTIONS.md).
Spectator exclusion, fair bounded spider queries, isolated target failures and
explicit helper connection/chest/weather policies are source/offline verified;
native support, fluids, ecology and observers remain open.

Group15 owner-approved small flyers implemented/deployed2026-10-20:
[Songbird, butterfly and firefly](SMALL_FLYER_INTERACTIONS.md). Owner chose no
flocking; follow_mob removed without a replacement flock goal. Songbird/butterfly
native lead anchors and insect flap game events added; firefly bottle preserves
captured name/current health in visible localized raw lore with max16 retained.
Simple-species omissions are intentional; bees remain deferred. All5 selected
runners passed, localization ok,5 BP +11 text RP files copied,0 removed; all3
packs in sync. Production0 errors/0 warnings/15 exceptions, probe1 unchanged
warning. Native anchors/flap/raw-lore persistence/actual stack merging remain
acceptance work. No art/spawn/worldgen retuning. Workspace knowledge `4accf79`;
Group16 completion is recorded below; next Group17, five further groups plus final reconciliation.

Group16 owner-approved2026-10-20: [elves and wardens](NPC_INTERACTIONS.md).
Implemented native elf shears handoff with ordinary unattached-shears dialogs;
warden leads/anchors, explicit permanence from first leash and home20 on release;
elf wandering_trader civilian-target classification; intentional NPC exclusions.
Nine runners passed, localization ok, production0 errors/0 warnings/15 exceptions,
optional probe1 unchanged warning. Six BP files copied,0 removed; RP/probe
unchanged. All three packs confirmed in sync. Native AI/leash/reload/transport
acceptance remains open. No worldgen changes; Group17 inspection is below.

Group17 owner follow-up2026-10-21: [implementation helpers](HELPER_INTERACTIONS.md).
Owner approved2, planner timeout cleanup: attempt-unique area ids, pending
ownership and late-completion cleanup verified/deployed. Three selected runners
passed, deployment repeated2;1 BP file copied, all3 packs confirmed in sync.
Owner accepted withdrawing failed-elf-spawn retry1 because no specific
recoverable condition was established in already loaded terrain; holding native
attack restriction3 until actual helper targeting is demonstrated. Group17
review/approved source work is complete; native parity is not established.
Keep population/attack behavior, beacon
cleanup/expiry, unfinished-work persistence, planner backoff and Group11 Phial.
No new native observations or worldgen change.

| Group | Counterparts / existing evidence | Disposition and remaining interactions |
| --- | --- | --- |
| Wood | Log/Planks/Wood/Wooden Axe/Durability Wiki; [WOOD_INTERACTIONS.md](WOOD_INTERACTIONS.md), material/tag notes | **Owner accepted 2026-10-18:** audit/fix stripping/classification/wear and generic consumers. **Implemented:** guarded target/held-slot snapshots, native/tagged axes, Unbreaking/unbreakable/Bedrock final use, bark-covered wood axes. Existing recipes/art preserved. **OPEN:** native plank-to-vanilla-tool/shield anvil repair, custom chance ranges and engine/game-mode acceptance. Cocoa is jungle-specific and inapplicable. |
| Shapes | Slab/Wooden Slab/Stairs Wiki; [WOOD_INTERACTIONS.md](WOOD_INTERACTIONS.md), water/support/harvest ledgers | **Owner accepted 2026-10-18. Implemented:** duplicate/stale/competing slab-merge guards, Bedrock 15-second slab fuel and combine sound, native stair chest-obstruction opt-out; all 80 stair states checked offline. Existing shape/water/material choices retained. **OPEN engine checks:** spawn, suffocation, light, navigation, support, fluids, hopper/falling-block, observer/sculk and permissions. Search-cache Wiki retrieval resolved earlier fetch failures; edition uncertainty remains explicit. |
| Controls/barriers | Door/Trapdoor/Fence/Gate/Button/Plate Wiki; [CONTROL_INTERACTIONS.md](CONTROL_INTERACTIONS.md), `blocks.js`, `PISTON_SUPPORT.md`, `WATER.md` | **Owner accepted 2026-10-18:** supported interaction fixes and paired-door convenience. **Implemented offline:** plate AABB/spectator/minimum-hold corrections, native powered-only button release, gate opening direction/wall lowering with unchanged 1.5-block collision, precise same-facing door pairing. **Intentional:** synchronized double doors. **OPEN:** full solid-face hinge rule, exact gate wall/nether-brick connection filter, projectile/wind activation, mob recognition, observer/sculk and native scheduling/query/reload comparisons. Existing support/water/material/fuel/note policies retained; detailed per-interaction outcomes and tests are linked. |
| Leaves | Leaves Wiki; [LEAF_TREE_INTERACTIONS.md](LEAF_TREE_INTERACTIONS.md), `LEAF_HARVEST.md` | **Owner accepted2026-10-19. Implemented:** both same-ID native block items with30% composting, furnace conversion to existing litter, chest-obstruction opt-out and mixed-species custom connectivity. Preserve approved harvesting, golden self-drop/no decay, player persistence and intentional reach10 versus Bedrock4. **OPEN:** reverse native connectivity, fire/water/piston contexts, spawn/suffocation/attachments, snowy tint/rain drips and game item/render acceptance. |
| Flora/crops | Flower/Torchflower/Sapling; [LEAF_TREE_INTERACTIONS.md](LEAF_TREE_INTERACTIONS.md), local flora/harvest notes, `TAGS.md` | Preserve pot/compost/harvest/bone-meal choices and custom flower membership. **Owner accepted2026-10-19 sapling group. Implemented:** acorn5-second fuel, mycelium soils, above-block light/soil checks, guarded bone-meal completion and reserved/revalidated ordinary growth jobs. Ordinary native pot component retained; acorn pot/return behavior pending. **Intentional:** Great nut nonfuel/noncompostable, no bone meal/plain giant. **OPEN saplings:** dispenser bone meal, populated bee nests, Great scan construction race and native acceptance. **Owner approved2026-10-19 flora/crops:** [FLORA_CROP_INTERACTIONS.md](FLORA_CROP_INTERACTIONS.md) records expanded soils, bloom compost65%, dyes/stew, guarded use and same-block wild/farmed corn with layout growth. No legacy or wheat-substitution uses. Bees owner-deferred after prior testing. **OPEN:** dispenser/farmer recognition, native farmland/trampling and environmental acceptance; no blanket native-parity claim. |
| Cover | Layered petals/litter; [COVER_INTERACTIONS.md](COVER_INTERACTIONS.md), water/support/harvest notes | Group8 implemented/deployed: guarded counts/refunds/dew, fuel/compost/dye/sounds, broader shared support sets. **Intentional:** both covers decorative full-top support, no bone meal, Mallorn-based dew through roofs (owner2026-10-19). **OPEN:** exact surface completeness, replacement and native environment/gamerule/attachment acceptance. Leaf carpet is not full leaves. |
| Lights/rope/decor | Lantern/ladder/glass/bone/frame/stone by aspect; [DECOR_ROPE_INTERACTIONS.md](DECOR_ROPE_INTERACTIONS.md), material/water/support/harvest ledgers | Owner approved2026-10-19; implemented paired expected-source bottle exchange and held/target guards, rope actual-dimension bounds/safe unknown support, per-piece accounting, doTileDrops and external-effect preservation with one-tick expiry. Rope fuel15; wet-foot climbing excluded; player-only climbing intentional. Chandelier stack64; one antler + four silver/gold lanterns, including mixed colors, via exact item-tag membership. Prior art/sounds/brightness/harvest retained.15 production scenarios and relevant existing suites pass offline. Native effect timing/contact/fall, full support/environment/signals/automation and crafting acceptance remain OPEN. |
| Archery | Bow/Arrow; [ARCHERY_INTERACTIONS.md](ARCHERY_INTERACTIONS.md), `ARCHERY.md`, `M5_GIFTS_TEST.md`, item `bow.json` and arrow entity | **Owner 2026-10-18:** repair/fuel yes; crafting vanilla dispenser with elven bow no; arrow activation/dispenser launch yes where supported; audit native combat/environment/enchantments. **Intentional:** no potion-tipped custom-arrow variants (too many new items); mob equipping/use is low priority, expansion allowed only through straightforward data-only support. No concrete missing setting found, so no scripts, new mob definitions/variants or vanilla overrides added; incidental native mob compatibility remains unverified. **Configured:** same-elven-bow repair, Bedrock 10-second fuel, offhand arrow permission; existing projectile component documents dispenser launch. Native damage/flight/enchantments, 0.6s draw and **100% recovery** retained; vanilla bow/crossbow custom-ammo restriction retained with approved dispenser exception. **OPEN:** engine parity checklist in linked ledger; Mallorn/heartwood buttons require separate controls work. |
| Armor | Armor/Item repair; [WEARABLE_INTERACTIONS.md](WEARABLE_INTERACTIONS.md), `M5_WORN_GIFTS_NOTES.md`, `elven_cloak.json` | **Owner 2026-10-18:** native use/swap/dispenser; stand/mob support through straightforward data; no cloak dyeing/trims to retain art; audit protection/wear/repair/curses/effects. Full freezing protection remains **pending by owner choice**, without a partial replacement; no verified simple item/API path found. **Configured:** chest protection 3/durability 80, armor_torso enchanting/string+self repair. **2026-10-21 correction:** removed `wearable.dispensable` after owner-reported schema rejection. **Owner confirmed 2026-10-21:** parsing error is gone after deployment. **OPEN:** exact native dispenser/equip/stand/mob/repair/curse/game outcomes. Detailed lifecycle and effect evidence in linked ledger. |
| Gifts | Native offhand/consumable/light analogues by aspect; [WEARABLE_INTERACTIONS.md](WEARABLE_INTERACTIONS.md), [PHIAL_INTERACTIONS.md](PHIAL_INTERACTIONS.md), `M5_WORN_GIFTS_NOTES.md`, `M5_PHIAL_NOTES.md` | **Intentional:** belt stays offhand and without durability/enchant/repair, player-only magic effects; phial retains its separate established design. Rejected `wearable.dispensable` removed 2026-10-21; native dispenser/actor support needs game checks. Existing bounded player effect service preserves potions; added external-effect-clearing regression. Phial Group11 approved/implemented: Spectator exclusion, bounded fair type queries, isolated failures/live target revalidation and explicit helper neighbor policies. **OPEN:** remaining native item/display/death/multiplayer and helper support/fluid/light ecology/observer checks. |
| Food/resources | Food and actual recipe inputs; [FOOD_REMEDY_INTERACTIONS.md](FOOD_REMEDY_INTERACTIONS.md), harvest/care notes, `TAGS.md`, recipes in pack | Group10 owner approved and implemented2026-10-19: native salve bottle return, guarded Miruvor completion/Creative/effect policy, sound/deed/partial-effect error isolation, plain Lembas compost85 and soul-campfire meat cooking. Offline production scenarios pass; engine acceptance pending. Preserve ingredient-only nectar, dew resource use, no extra corn uses, existing food balance and no raw-swan debuff. **Intentional:** Great Mallorn nut noncompostable, owner2026-10-13. **OPEN:** supported crafting remainders, full-inventory/Creative/cancel outcomes, native wolf/fox/villager consumers and environment/automation. Meat tags alone do not prove wolf feeding. |
| Animals | Cow/Rabbit/Horse/Parrot and archetype-specific Wiki; `mobs/*.md` | Existing sheets/care decisions retained. Deer grazing omitted to protect floor; no vanilla prey families. Unicorn Group14 owner decisions/source fixes complete: no lead, saddle-free owner riding, no breeding/foals, owner-only bonded naming and explicit no armor/equipment/inventory/shear/dispenser routes; swimming/healing/Friend-only lure implemented/deployed. Songbird no breeding/baby/taming/riding per owner simplicity request. **OPEN:** remaining analogue-specific native usable-item/hazard/potion/reciprocal-target/persistence/transport/gamerule comparisons; Group15 small-flyer owner review/source fixes are complete and deployed; Group17 helper review/source fixes are also complete, with native acceptance open. Horse grazing animation does not consume grass: do not generalize eat_block's effect to every grazing implementation. |
| NPCs | Villager/Iron Golem by aspect; [NPC_INTERACTIONS.md](NPC_INTERACTIONS.md), NPC sheets, trading/healer notes | Group16 owner-approved/source fixes complete and deployed2026-10-20. Elf native-cut handoff; wardens lead/anchor, permanent from first leash and home20 on release; elf civilian target family; intentional counterpart exclusions. Nine runners passed,6 BP files copied, all3 packs in sync. Fixed professions/shops/Harmony/Renown/healer/nonrenewability/combat retained. **OPEN:** native targeting/leash/reload/transport/equipment/hazards/gamerules and exact UI outcomes; source configuration does not prove engine acceptance. |
| Vehicles | Boat / Boat with Chest / Dispenser Wiki; [BOAT_INTERACTIONS.md](BOAT_INTERACTIONS.md), `mobs/mallorn_boat.md` | **Owner 2026-10-18:** leads, boarding, steering, leaving and ordinary self-drop work well; report does not enumerate every variant or chest contents. Fuel and remaining native audits approved. **Configured:** all four items burn for 60 seconds; complete entity source parity retains native physics/bubbles/passengers and siphonable 27-slot chest inventory, with established art/seat/loot adaptations. **OPEN game checks:** exact dispenser conditions, environmental/dimension behavior, passenger edge cases, hopper transfer, stored-content drops and piglin recognition. Direct comparator applicability is not established. Correct Boat with Chest Wiki/archive pages are readable; detailed confidence/source/version evidence in linked ledger. |
| Helpers | Functional guide/post/loop/rail/light helpers; [HELPER_INTERACTIONS.md](HELPER_INTERACTIONS.md), `mobs/*.md`, `BLOCK_MATERIALS.md` | Group17 review/approved source work complete2026-10-21. Timeout ownership cleanup2 verified/deployed;3 runners passed,1 BP copied, all3 packs in sync. Owner accepted withdrawing1/leaving3 unchanged without a real recoverable spawn failure/native helper attack. Population/attack behavior retained. Biological rows inapplicable; retain beacon cleanup/expiry, unfinished work and Group11 light policies. **OPEN:** native hit selection/projectiles, targeting, collision/spawn obstruction/caps, transport/triggers and reload acceptance. No observed native failure claimed. |

Group12 first five findings approved/implemented2026-10-19:
[ordinary and white deer](DEER_INTERACTIONS.md), including common wariness,
safe deferred offers, gift delivery and clear ground/body checks. Natural
white-deer depth policy was approved2026-10-20 and implemented offline: skip
unavailable outer samples, prefer optimistic heart when no readable border is
seen, retain uncertainty metadata/unreadable-centre behavior and unchanged
natural chance tables. Sampler deployed2026-10-20; all three packs confirmed in
sync after9 selected runners passed. Native acceptance remains OPEN.

## Corrections to historical notes

The dated implementation/handoff records below preserve their original sequence.
Groups1-17 are now reviewed; use the current reconciliation above the inventory
and the all-mod final report for remaining work, rather than their old next-group pointers.

Group13 swans/squirrels owner decisions implemented/deployed2026-10-20; complete counterpart
dispositions: [SWAN_SQUIRREL_INTERACTIONS.md](SWAN_SQUIRREL_INTERACTIONS.md).
Intentional: swans require observed nearby Lothlorien, and inside wild squirrel
healing/errands do not add domestication persistence. Implemented guarded
offers/sessions/native loot delivery, squirrel powder-snow walking/lead anchor
and swan fall immunity with existing air+water breathing retained.8 selected
runners pass, including46 new production scenarios;4 BP files copied and all
three packs confirmed in sync. Native acceptance remains OPEN. No art,
gift-table balance or natural-spawn setting changes.

Owner-approved2026-10-20 [synchronous interaction cleanup](SYNCHRONOUS_VALIDATION.md)
is implemented/deployed: simplified squirrel/rope/Miruvor same-callback inventory
handling and duplicate white-deer completion checks while retaining real deferred
and ongoing checks. Current squirrel runner42 scenarios replaces artificial
mid-callback mutation tests. Unicorn swimming alone now uses native horse
float/buoyant data in entity+source generator; art unchanged.14 selected runners
passed; all3 packs in sync. [Group14 unicorn review](UNICORN_INTERACTIONS.md)
owner review/source fixes are now complete, with native/support comparisons
still open. A follow-up implements accepted animal-healing policy with
bonded-only native unicorn Elanor2HP and removes its hand-dependent queue;
initial owner access and wild trust offerings are unchanged.4 relevant runners
passed; follow-up deployed with2 BP files copied and all3 packs in sync.
Shared policy/handoff commit `cfb84b3`. Native water/heal/mount/hazard acceptance
remains open. [Healing record](NATIVE_ANIMAL_HEALING.md).

Final Group14 owner batch deployed2026-10-20: native per-player Friend+Elanor
following and matching no-flight exemption, produced by the existing Harmony
band service; owner-only bonded naming and no armor/equipment/inventory/shear/
dispenser routes explicitly retained.6 selected runners passed,2 BP files copied,
all3 packs in sync. Shared nearest-player wariness remains unchanged; native
player selection/retargeting/naming and other support checks stay open. Next
group is15; this ledger does not claim all native parity is verified.

`NOT_IMPLEMENTED.md` now points to current boat, decay and native multi-part
state. Old phase headings are historical. Squirrel's current care update gives
it lead support; its older compact body row must agree with that update.
Preserve owner omissions; this ledger does not silently promote weak rationale
or a stale implementation note to owner approval.

## Exact authored inventory

Reconciled2026-10-23:45 blocks,64 explicit items and19 entities; all definitions
have an inventory row and valid source link. Groups1-17 owner review is complete;
supported-path investigations, native acceptance and owner-deferred bees/full
cloak freezing remain open. [Final all-mod coverage and test index](../../../docs/vanilla-interactions-final-2026-10-23.md).

### Blocks (45)

| Identifier | Review group | Source |
| --- | --- | --- |
| `lothlorien:athelas` | Flora/crops | [lothlorien_bp](../lothlorien_bp/blocks/athelas.json) |
| `lothlorien:deer_antler` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/blocks/deer_antler.json) |
| `lothlorien:elanor` | Flora/crops | [lothlorien_bp](../lothlorien_bp/blocks/elanor.json) |
| `lothlorien:elven_chandelier` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/blocks/elven_chandelier.json) |
| `lothlorien:elven_lantern` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/blocks/elven_lantern.json) |
| `lothlorien:elven_lantern_heartwood` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/blocks/elven_lantern_heartwood.json) |
| `lothlorien:elven_rope` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/blocks/elven_rope.json) |
| `lothlorien:elven_rope_hanging` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/blocks/elven_rope_hanging.json) |
| `lothlorien:firefly_jar` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/blocks/firefly_jar.json) |
| `lothlorien:golden_fern` | Flora/crops | [lothlorien_bp](../lothlorien_bp/blocks/golden_fern.json) |
| `lothlorien:great_mallorn_sprout` | Flora/crops | [lothlorien_bp](../lothlorien_bp/blocks/great_mallorn_sprout.json) |
| `lothlorien:mallorn_blossom` | Cover | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_blossom.json) |
| `lothlorien:mallorn_button` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_button.json) |
| `lothlorien:mallorn_door` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_door.json) |
| `lothlorien:mallorn_double_slab` | Shapes | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_double_slab.json) |
| `lothlorien:mallorn_fence` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_fence.json) |
| `lothlorien:mallorn_fence_gate` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_fence_gate.json) |
| `lothlorien:mallorn_golden_leaves` | Leaves | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_golden_leaves.json) |
| `lothlorien:mallorn_heartwood_button` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_button.json) |
| `lothlorien:mallorn_heartwood_door` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_door.json) |
| `lothlorien:mallorn_heartwood_double_slab` | Shapes | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_double_slab.json) |
| `lothlorien:mallorn_heartwood_fence` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_fence.json) |
| `lothlorien:mallorn_heartwood_fence_gate` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_fence_gate.json) |
| `lothlorien:mallorn_heartwood_planks` | Wood | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_planks.json) |
| `lothlorien:mallorn_heartwood_pressure_plate` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_pressure_plate.json) |
| `lothlorien:mallorn_heartwood_slab` | Shapes | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_slab.json) |
| `lothlorien:mallorn_heartwood_stairs` | Shapes | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_stairs.json) |
| `lothlorien:mallorn_heartwood_trapdoor` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_heartwood_trapdoor.json) |
| `lothlorien:mallorn_leaf_carpet` | Cover | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_leaf_carpet.json) |
| `lothlorien:mallorn_leaves` | Leaves | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_leaves.json) |
| `lothlorien:mallorn_log` | Wood | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_log.json) |
| `lothlorien:mallorn_planks` | Wood | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_planks.json) |
| `lothlorien:mallorn_pressure_plate` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_pressure_plate.json) |
| `lothlorien:mallorn_sapling` | Flora/crops | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_sapling.json) |
| `lothlorien:mallorn_slab` | Shapes | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_slab.json) |
| `lothlorien:mallorn_stairs` | Shapes | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_stairs.json) |
| `lothlorien:mallorn_stripped_log` | Wood | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_stripped_log.json) |
| `lothlorien:mallorn_stripped_wood` | Wood | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_stripped_wood.json) |
| `lothlorien:mallorn_trapdoor` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_trapdoor.json) |
| `lothlorien:mallorn_wood` | Wood | [lothlorien_bp](../lothlorien_bp/blocks/mallorn_wood.json) |
| `lothlorien:nectar_bloom` | Flora/crops | [lothlorien_bp](../lothlorien_bp/blocks/nectar_bloom.json) |
| `lothlorien:niphredil` | Flora/crops | [lothlorien_bp](../lothlorien_bp/blocks/niphredil.json) |
| `lothlorien:phial_light` | Helpers | [lothlorien_bp](../lothlorien_bp/blocks/phial_light.json) |
| `lothlorien:star_canopy` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/blocks/star_canopy.json) |
| `lothlorien:western_corn` | Flora/crops | [lothlorien_bp](../lothlorien_bp/blocks/western_corn.json) |

### Items (64)

| Identifier | Review group | Source |
| --- | --- | --- |
| `lothlorien:athelas` | Flora/crops | [lothlorien_bp](../lothlorien_bp/items/athelas.json) |
| `lothlorien:athelas_salve` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/athelas_salve.json) |
| `lothlorien:bottle_of_fireflies` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/bottle_of_fireflies.json) |
| `lothlorien:bow` | Archery | [lothlorien_bp](../lothlorien_bp/items/bow.json) |
| `lothlorien:deer_antler` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/items/deer_antler.json) |
| `lothlorien:dew_bottle` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/dew_bottle.json) |
| `lothlorien:elanor` | Flora/crops | [lothlorien_bp](../lothlorien_bp/items/elanor.json) |
| `lothlorien:elven_chandelier` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/items/elven_chandelier.json) |
| `lothlorien:elven_cloak` | Armor | [lothlorien_bp](../lothlorien_bp/items/elven_cloak.json) |
| `lothlorien:elven_lantern` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/items/elven_lantern.json) |
| `lothlorien:elven_lantern_heartwood` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/items/elven_lantern_heartwood.json) |
| `lothlorien:elven_rope` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/items/elven_rope.json) |
| `lothlorien:firefly_jar` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/items/firefly_jar.json) |
| `lothlorien:galadhrim_arrow` | Archery | [lothlorien_bp](../lothlorien_bp/items/galadhrim_arrow.json) |
| `lothlorien:golden_fern` | Flora/crops | [lothlorien_bp](../lothlorien_bp/items/golden_fern.json) |
| `lothlorien:great_mallorn_nut` | Flora/crops; Food/resources | [lothlorien_bp](../lothlorien_bp/items/great_mallorn_nut.json) |
| `lothlorien:lembas_cake` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/lembas_cake.json) |
| `lothlorien:lembas_dough` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/lembas_dough.json) |
| `lothlorien:lembas_wrapped` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/lembas_wrapped.json) |
| `lothlorien:mallorn_acorn` | Flora/crops | [lothlorien_bp](../lothlorien_bp/items/mallorn_acorn.json) |
| `lothlorien:mallorn_blossom` | Cover | [lothlorien_bp](../lothlorien_bp/items/mallorn_blossom.json) |
| `lothlorien:mallorn_boat` | Vehicles | [lothlorien_bp](../lothlorien_bp/items/mallorn_boat.json) |
| `lothlorien:mallorn_button` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_button.json) |
| `lothlorien:mallorn_chest_boat` | Vehicles | [lothlorien_bp](../lothlorien_bp/items/mallorn_chest_boat.json) |
| `lothlorien:mallorn_door` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_door.json) |
| `lothlorien:mallorn_fence` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_fence.json) |
| `lothlorien:mallorn_fence_gate` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_fence_gate.json) |
| `lothlorien:mallorn_heartwood_boat` | Vehicles | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_boat.json) |
| `lothlorien:mallorn_heartwood_button` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_button.json) |
| `lothlorien:mallorn_heartwood_chest_boat` | Vehicles | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_chest_boat.json) |
| `lothlorien:mallorn_heartwood_door` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_door.json) |
| `lothlorien:mallorn_heartwood_fence` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_fence.json) |
| `lothlorien:mallorn_heartwood_fence_gate` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_fence_gate.json) |
| `lothlorien:mallorn_heartwood_planks` | Wood | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_planks.json) |
| `lothlorien:mallorn_heartwood_pressure_plate` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_pressure_plate.json) |
| `lothlorien:mallorn_heartwood_slab` | Shapes | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_slab.json) |
| `lothlorien:mallorn_heartwood_stairs` | Shapes | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_stairs.json) |
| `lothlorien:mallorn_heartwood_trapdoor` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_heartwood_trapdoor.json) |
| `lothlorien:mallorn_leaf_carpet` | Cover | [lothlorien_bp](../lothlorien_bp/items/mallorn_leaf_carpet.json) |
| `lothlorien:mallorn_leaves` | Leaves | [lothlorien_bp](../lothlorien_bp/items/mallorn_leaves.json) |
| `lothlorien:mallorn_golden_leaves` | Leaves | [lothlorien_bp](../lothlorien_bp/items/mallorn_golden_leaves.json) |
| `lothlorien:mallorn_log` | Wood | [lothlorien_bp](../lothlorien_bp/items/mallorn_log.json) |
| `lothlorien:mallorn_nectar` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/mallorn_nectar.json) |
| `lothlorien:mallorn_planks` | Wood | [lothlorien_bp](../lothlorien_bp/items/mallorn_planks.json) |
| `lothlorien:mallorn_pressure_plate` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_pressure_plate.json) |
| `lothlorien:mallorn_slab` | Shapes | [lothlorien_bp](../lothlorien_bp/items/mallorn_slab.json) |
| `lothlorien:mallorn_stairs` | Shapes | [lothlorien_bp](../lothlorien_bp/items/mallorn_stairs.json) |
| `lothlorien:mallorn_stripped_log` | Wood | [lothlorien_bp](../lothlorien_bp/items/mallorn_stripped_log.json) |
| `lothlorien:mallorn_stripped_wood` | Wood | [lothlorien_bp](../lothlorien_bp/items/mallorn_stripped_wood.json) |
| `lothlorien:mallorn_trapdoor` | Controls/barriers | [lothlorien_bp](../lothlorien_bp/items/mallorn_trapdoor.json) |
| `lothlorien:mallorn_wood` | Wood | [lothlorien_bp](../lothlorien_bp/items/mallorn_wood.json) |
| `lothlorien:miruvor` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/miruvor.json) |
| `lothlorien:morning_dew` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/morning_dew.json) |
| `lothlorien:nectar_bloom` | Flora/crops | [lothlorien_bp](../lothlorien_bp/items/nectar_bloom.json) |
| `lothlorien:niphredil` | Flora/crops | [lothlorien_bp](../lothlorien_bp/items/niphredil.json) |
| `lothlorien:phial_of_galadriel` | Gifts | [lothlorien_bp](../lothlorien_bp/items/phial_of_galadriel.json) |
| `lothlorien:silver_belt` | Gifts | [lothlorien_bp](../lothlorien_bp/items/silver_belt.json) |
| `lothlorien:star_canopy` | Lights/rope/decor | [lothlorien_bp](../lothlorien_bp/items/star_canopy.json) |
| `lothlorien:swan_meat_cooked` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/swan_meat_cooked.json) |
| `lothlorien:swan_meat_raw` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/swan_meat_raw.json) |
| `lothlorien:venison_cooked` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/venison_cooked.json) |
| `lothlorien:venison_raw` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/venison_raw.json) |
| `lothlorien:western_corn_grain` | Food/resources | [lothlorien_bp](../lothlorien_bp/items/western_corn_grain.json) |
| `lothlorien:western_corn_seeds` | Flora/crops | [lothlorien_bp](../lothlorien_bp/items/western_corn_seeds.json) |

### Entities (19)

| Identifier | Review group | Source |
| --- | --- | --- |
| `lothlorien:butterfly` | Animals | [lothlorien_bp](../lothlorien_bp/entities/butterfly.json) |
| `lothlorien:deer` | Animals | [lothlorien_bp](../lothlorien_bp/entities/deer.json) |
| `lothlorien:elf` | NPCs | [lothlorien_bp](../lothlorien_bp/entities/elf.json) |
| `lothlorien:elf_post` | Helpers | [lothlorien_bp](../lothlorien_bp/entities/elf_post.json) |
| `lothlorien:elven_warden` | NPCs | [lothlorien_bp](../lothlorien_bp/entities/elven_warden.json) |
| `lothlorien:firefly` | Animals | [lothlorien_bp](../lothlorien_bp/entities/firefly.json) |
| `lothlorien:galadhrim_arrow` | Archery | [lothlorien_bp](../lothlorien_bp/entities/galadhrim_arrow.json) |
| `lothlorien:guide_beacon` | Helpers | [lothlorien_bp](../lothlorien_bp/entities/guide_beacon.json) |
| `lothlorien:loop_marker` | Helpers | [lothlorien_bp](../lothlorien_bp/entities/loop_marker.json) |
| `lothlorien:mallorn_boat` | Vehicles | [lothlorien_bp](../lothlorien_bp/entities/mallorn_boat.json) |
| `lothlorien:mallorn_chest_boat` | Vehicles | [lothlorien_bp](../lothlorien_bp/entities/mallorn_chest_boat.json) |
| `lothlorien:mallorn_heartwood_boat` | Vehicles | [lothlorien_bp](../lothlorien_bp/entities/mallorn_heartwood_boat.json) |
| `lothlorien:mallorn_heartwood_chest_boat` | Vehicles | [lothlorien_bp](../lothlorien_bp/entities/mallorn_heartwood_chest_boat.json) |
| `lothlorien:rail_mender` | Helpers | [lothlorien_bp](../lothlorien_bp/entities/rail_mender.json) |
| `lothlorien:songbird` | Animals | [lothlorien_bp](../lothlorien_bp/entities/songbird.json) |
| `lothlorien:squirrel` | Animals | [lothlorien_bp](../lothlorien_bp/entities/squirrel.json) |
| `lothlorien:swan` | Animals | [lothlorien_bp](../lothlorien_bp/entities/swan.json) |
| `lothlorien:unicorn` | Animals | [lothlorien_bp](../lothlorien_bp/entities/unicorn.json) |
| `lothlorien:white_deer` | Animals | [lothlorien_bp](../lothlorien_bp/entities/white_deer.json) |

