# Bow and arrow vanilla interaction review

2026-10-18; target Bedrock **1.26.52**, stable server API **2.8.0**.
Applies to item `lothlorien:bow`, item/entity `lothlorien:galadhrim_arrow`,
all bow pull frames and enchantment states, and both ammunition entries
(`lothlorien:galadhrim_arrow` and `minecraft:arrow`, including native aux variants).
Linked custom controls: both Mallorn/heartwood buttons and pressure plates.

Owner decisions on this date: normal same-bow repair **yes**; furnace fuel **yes**;
using this bow to craft a vanilla dispenser **no**; arrow activation and dispenser
launch **yes where supported**; audit shields, immunity/deflection, fluids, kill
credit and enchantments. No rationale was supplied for the dispenser-recipe
exclusion; it is an explicit owner choice. Faster draw, art, ammunition restrictions
and recovery decisions remain as recorded in [ARCHERY.md](ARCHERY.md).

Follow-up owner decisions, also 2026-10-18: **no potion tipping/custom tipped
Galadhrim-arrow variants**, because they would create too many new items.
Mob equipping/use is low importance: only a straightforward supported data-only
addition is allowed; no scripted emulation, new mob definitions/variants or
vanilla mob overrides for this feature. No concrete missing setting was found
within that limit, so expanding mob support is intentionally deferred. Incidental
native compatibility is retained but remains unverified, not declared impossible.

`Configured` below means implementation/documentation evidence, not a new engine
observation. `Open` identifies a missing implementation, unproved engine path or
unresolved variant. None of this review was tested in Minecraft. Earlier M0
owner observations are dated 2026-10-10 and must not be extended to untested cases.

| Interaction | Disposition / implementation evidence | Verification still needed |
| --- | --- | --- |
| Two damaged elven bows in anvil | **Configured:** native `repairable` accepts this item only; donor contributes `context.other->query.remaining_durability`, following installed iron spear. No string/wood/vanilla-bow repair input. | Result durability/cap, native bonus, rename, merging/incompatibilities, XP/prior-work cost. |
| Crafting-grid repair | **Configured native path:** durability + repairable; official 1.20.0 notes explicitly support combining custom items. No ordinary recipe that would discard donor durability. | Both inventory/table grids, two damaged bows, 5% bonus, cap, enchantment/curse handling; compare vanilla. |
| Grindstone repair and disenchanting | **Configured native path:** same durable/enchantable/repairable item. Current component documentation does not separately guarantee the grindstone path. | One enchanted bow and two damaged bows; ordinary enchantment removal, curse preservation and XP; compare vanilla. Keep open until tested. |
| Furnace fuel, including damaged/enchanted bow | **Configured:** `minecraft:fuel.duration: 10` seconds, Bedrock's one furnace smelt per bow. Java's 15 seconds is not the counterpart value. | Furnace insertion/consumption, damaged and enchanted donors, automation; smoker/blast furnace native fuel timing. |
| Dispenser crafting ingredient | **Intentional exclusion, owner 2026-10-18:** no elven-bow dispenser recipe or ingredient tag. Installed vanilla recipe explicitly requires `minecraft:bow`. | Source checked; negative recipe matching can be checked in game. |
| Dispenser launches custom arrow | **Documented native support, already configured:** item `minecraft:projectile` names the custom projectile; official component docs explicitly cover dispensers. Base entity uses ordinary-arrow power 1.1; no player group for ownerless launch. | All six directions, one-item consumption, projectile identity, ground/hit recovery, damage versus native dispenser arrow. Wiki's old Bedrock dispenser damage exception needs current comparison. |
| Dropper/hopper/container transport | **Native ordinary items:** no script intercepts inventory transport; stack sizes 1 bow / 64 arrows. A dropper drops/transfers an item, whereas a dispenser launches projectile ammunition. | Hopper routing, dispenser supply and full inventories. |
| Offhand arrow equipment and selection | **Configured:** custom ammo explicitly `allow_off_hand: true`; shooter's existing `use_offhand` and `search_inventory` handle selection. Earliest inventory slot selection was M0 owner-tested. | Offhand custom/normal/tipped priority and fallback, including a belt/phial occupying the slot. Equip permission and shooter search are different components. |
| Vanilla bow/crossbow using custom ammo | **Intentional restriction retained:** custom ammo belongs to elven bow; vanilla bow survival refusal owner-tested. Dispenser launch is the newly approved exception. Crossbow-specific entity branches remain omitted. | Crossbow refusal, Creative fallback and wrong-bow hint; do not add crossbow support during this review. |
| Elven bow using normal/tipped arrows | **Configured native ammunition:** `minecraft:arrow` entry retained. Tipped Bedrock arrows use native item aux data. | Each potion variant, consumption, effects, shields and Infinity; generic `arrow` entry alone does not prove all aux variants. |
| Charge, movement, minimum shot, critical hit, aim | **Established balance:** native shooter, 0.6s full draw and custom critical threshold; movement modifier 0.2. Native flight data unchanged. | Accepted 0.6s feel/visual/crit checks in ARCHERY.md remain pending; normal ammo retains its native critical threshold. |
| Bow durability and melee use | **Established 384 max durability retained.** Archive labels vanilla Bedrock 385 versus Java 384; do not silently change accepted balance in an interaction audit. Native shooter owns wear; no script subtracts it. | Shot/failed draw/Creative/melee/block-break wear and Unbreaking versus vanilla. Archive numbering/use-count difference remains an edition caveat. |
| Power/Punch/Flame/Infinity | **Native, M0 owner-tested** on custom shooter; no damage/launch/enchantment script replacement. | Final charge timing, arrow variants, levels and table/anvil acceptance. |
| Unbreaking/Mending/Vanishing and incompatibilities | **Configured native `enchantable.slot: bow`, value 1.** No `all` slot or scripted substitute; Mending/Infinity incompatibility expected natively. | Actual wear odds, XP repair in hand, curse death/keepInventory, merge/disenchant behavior. No new in-game proof. |
| Shields, blocking, bounce and fire | **Native component parity:** ordinary vanilla `impact_damage`, blocking knockback setting, `arrow_effect`, and `should_bounce: if_no_damage_dealt` unchanged in every ordinary branch. Recovery drops only after projectile destruction; live bounce yields no duplicate item. | Front/back block, shield durability, Punch, Flame, deflected follow-up hit, potion variants. Preserve native Bedrock effects rather than infer Java behavior. |
| Enderman and no-damage targets | **Native target handling retained:** installed 26.50 Enderman teleport component handles incoming projectiles. Same bounce policy as ordinary arrow. | Teleport success/failure, ridden Enderman, spawning Wither/invulnerability, recovery only if actually destroyed. 26.50 changed Enderman handling; old Wiki description is not current proof. |
| Breeze, closed Shulker, armored Wither, perched dragon | **Open engine identity checks:** custom entity keeps arrow runtime and `projectile`/`arrow` families. Installed Breeze rejects non-wind-charge projectile damage but reflection uses a list containing `arrow`; docs do not establish whether it matches custom runtime or exact identifier. | Reflection direction/speed and owner transfer; closed/open Shulker, Wither above/below half health, flying/perched dragon. Do not edit vanilla mob definitions speculatively. |
| Deflecting fireballs/wind charges | **Documented native path:** 26.0 notes say all projectiles deflect `reflect_on_hurt:true` projectiles. Installed wind-charge entities use it; arrow itself retains vanilla non-reflectable defaults. | Arrow striking both wind-charge variants and ghast fireball, reflected damage/kill credit. |
| Player/mob/ownerless damage, kill credit, XP/loot | **Native:** engine shooter creates projectile owner; stable API describes owner as attacker attribution. Recovery script only spawns ammunition, never applies damage or assigns ownership. Ordinary player/mob/base groups match installed arrow. | Player versus dispenser kills, Looting held at impact, retaliation, PvP/friendly fire, reflected attacker, advancements/achievements where enabled. |
| Fluids, rain and fire | **Native parity:** `isolated_physics:false`, ordinary gravity and default air/liquid inertia, `hurt_on_condition` lava and native fire handling unchanged. No forced `hit_water`. | Flight/drag and crit/damage through water, rain extinguishing, lava/fire ignition and destruction, burning targets. Compare same target release. |
| Solid blocks, ground pickup, support removal and despawn | **Native arrow runtime**, `stick_in_ground`, physics and push-by-block unchanged; custom ground pickup M0 owner-tested. | Different block shapes, dislodging/support break, piston, chunk reload, despawn and dimension boundary. No permanent-arrow guarantee. |
| Entity-hit recovery / Infinity / Creative / mobs | **Intentional 100% destroyed-hit recovery retained.** Script deduplicates notifications and leaves live bounces/native ground pickup alone. Existing offline callbacks also cover an ownerless event. | Native consumption and pickup flags under Infinity, Creative, mob/dispenser sources; count before/after for duplication. A recovery decision does not prove consumption. |
| Native wooden buttons | **Native arrow-runtime path retained; engine support unproved for custom identifier.** Stone/polished-blackstone buttons must stay unaffected. | Every attachment face, sustained press until pickup/despawn, release timing and reload. |
| Native wooden/weighted plates and tripwire | **Native entity/runtime path retained.** Generic Arrow page lists wood plates/tripwire; weighted plates detect entities, stone plates do not detect arrows. | Arrow above/touching boundary, stuck/moving/picked-up/despawned arrow, powered output; tripwire archive unavailable. |
| Native target block | **Native projectile/runtime path retained.** No scripted `setblock` imitation of a hardcoded target. | Signal 1–15 by hit position, arrow's 20-tick pulse rather than generic-projectile 8 ticks, repeated hits, observer edition differences. |
| Mallorn/heartwood pressure plates | **Existing script includes arrows:** `onTick` queries entities without an arrow exclusion; no arrow-specific implementation added. | Both varieties and exact arrow/plate bounds, fall/support, pickup/despawn/reload. Current broad entity bounds are a controls-group open issue. |
| Mallorn/heartwood buttons | **Open implementation gap for controls review:** only player interaction presses them. `collision_box:false` means a normal block-hit event cannot be assumed to hit their selection shape. | A supported solution must cover six faces, exact shape, a stuck arrow holding the button, release/pickup/despawn/reload, and preserve player pulses. No guessed handler, collision change or projectile/world scan added. |
| Arrow breaking/activating other native blocks | **Native runtime path; open game proof:** chorus flower/decorated pot destruction, flaming TNT/candle/campfire ignition and applicable bell/dripleaf interactions. Respect `projectilesCanBreakBlocks` and relevant native gamerules. | Compare native/custom arrows under both gamerule settings, burning/unlit and ownerless sources; edition-specific outcomes. |
| Mob-held elven bow | **Intentional low-priority non-expansion, owner 2026-10-18:** straightforward data-only support was permitted; no concrete missing item/entity setting was established. Existing bow already has shooter/use modifiers; vanilla skeleton has its own ranged AI/shooter, `has_ranged_weapon` checks, equip/pickup goals and explicit `minecraft:bow` shareable entry. Existing custom archers keep their current shooter. No scripts, mob additions/variants or vanilla overrides. | Incidental native custom-bow equipment/pickup/recognition/firing/drops/durability remain **unverified**, not proved unsupported. Owner scope does not require emulating them. |
| Tipping/cauldron/crafting variants of custom arrows | **Intentional exclusion, owner 2026-10-18:** no potion-tipped Galadhrim-arrow variants or custom tipping recipes/cauldron conversion, because that would create too many new items. | Source checked: no variant definitions/recipes added. Existing elven-bow support for **vanilla** normal/tipped ammunition is retained and separately needs game checks. Spectral arrows are Java-only. |
| Obtaining/crafting, trades and loot | **Established design:** woodwright and custom chest pools, no gift/ammunition crafting. Vanilla fishing/fletcher/mob drops/bartering are ordinary-arrow/bow sources, not automatic custom rare-gift sources. | Existing trade/loot tests cover source bindings; no replacement of vanilla sources introduced. |
| Ordinary item lifetime/display/destruction | **Native items:** no fire resistance/never-despawn override; icons/localization and held art unchanged. | Dropped fire/lava/cactus/explosion/despawn, hopper pickup, frame/stand display, death/keepInventory and multiplayer persistence. |

## Evidence and source boundaries

Research order: existing item/scripting/lookup skills and mod design; installed
`vanilla_1.26.50/entities/arrow.json` plus Enderman, Breeze, Wither, dragon and wind
charge definitions; `vanilla_1.26.0/items/iron_spear.json`; installed vanilla
dispenser recipe; pinned 2.8.0 projectile owner and hit-event declarations; official
target/recent changes; Creator docs; Minecraft Wiki pages and linked mechanics.
The offline archery suite compares all ordinary projectile components/groups and
spawn filters directly with the installed arrow; crossbow groups are excluded on purpose.

Mob follow-up: inspected installed `vanilla_1.26.50/entities/skeleton.json` and
existing `lothlorien_bp/entities/elven_warden.json`; reviewed official
[item shooter](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_shooter?view=minecraft-bedrock-stable),
[entity shooter](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_shooter?view=minecraft-bedrock-stable)
and [has_ranged_weapon filter](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/filters/has_ranged_weapon?view=minecraft-bedrock-stable).
The filter's docs describe holding a ranged weapon without establishing custom
item recognition; item shooter fields configure player use, while entity shooter
selects projectiles for ranged AI. The [November 2025 Skeleton archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Skeleton)
was checked for equipment/behavior and edition notes; it does not establish
custom-item compatibility. No verified missing data-only switch emerged. This
follow-up changed documentation only; pack verification/deployment was not rerun.

Official sources reviewed 2026-10-18:

- [26.50 changes](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog): projectile schema, spatial owner/vehicle immunity, Enderman teleport and projectile families. [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog): no identified change replacing these native paths.
- [1.20.0 custom-item changes](https://feedback.minecraft.net/hc/en-us/articles/16421714461453-Minecraft-Trails-Tales-1-20-0-Bedrock): native custom-item combining and removal of nonfunctional `on_repaired`.
- [26.0 projectile deflection](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.26.0?view=minecraft-bedrock-stable).
- Creator [repairable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_repairable?view=minecraft-bedrock-stable), [fuel](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_fuel?view=minecraft-bedrock-stable), [offhand permission](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_allow_off_hand?view=minecraft-bedrock-stable), [item projectile](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_projectile?view=minecraft-bedrock-stable), [entity projectile](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_projectile?view=minecraft-bedrock-stable) and [reflect projectiles](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_reflect_projectiles?view=minecraft-bedrock-stable). Reflect-projectiles docs still label that component experimental; no new dependency on it was introduced.

Canonical Wiki counterparts: [Bow](https://minecraft.wiki/w/Bow),
[Arrow](https://minecraft.wiki/w/Arrow), [Item repair](https://minecraft.wiki/w/Item_repair),
[Anvil mechanics](https://minecraft.wiki/w/Anvil_mechanics),
[Grindstone](https://minecraft.wiki/w/Grindstone), [Shield](https://minecraft.wiki/w/Shield),
[Dispenser](https://minecraft.wiki/w/Dispenser), [Target](https://minecraft.wiki/w/Target),
[Wooden Button](https://minecraft.wiki/w/Wooden_Button),
[Pressure Plate](https://minecraft.wiki/w/Pressure_Plate), [Tripwire](https://minecraft.wiki/w/Tripwire).
Direct Bow/Arrow access failed. The reviewed copies use the **November 2025** archive
at `https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/<page>`
([Bow](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Bow),
[Arrow](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Arrow));
the other listed copies loaded except Tripwire/Tripwire Hook. No revision IDs were
available. Reviewed infobox, obtaining, usage/recipes/repair/fuel, enchantments,
behavior/common properties/redstone/immunity, edition labels, sounds and history;
linked repair, shield, dispenser and redstone pages refine the rows above.
Arrow's technical-physics section explicitly says its details were checked in Java:
use installed Bedrock data instead of transplanting those algorithms or numeric tables.

## Validation and engine checklist

Run `C:/mcmods/mods.cmd verify lothlorien --suite archery` after pack changes.
On 2026-10-18 this command passed localization, the named archery suite and shared
pack checks: production BP/RP **0 errors, 0 warnings, 15 documented exceptions**;
the pre-existing optional feature-probe BP had **0 errors, 1 warning**.
The suite verifies native projectile parity, timing/frame bindings, event recovery,
camera cleanup and native repair/fuel/offhand declarations. These are offline tests.
Engine acceptance remains pending for every newly configured interaction above;
record actual Bedrock version/date/results here when tested. [M5_GIFTS_TEST.md](M5_GIFTS_TEST.md)
links this list.

Root reviewed and deployed with `mods deploy lothlorien --suite archery` on
2026-10-18; the same checks passed and exactly the two item JSON files were
copied. `mods status lothlorien` confirmed production BP, RP and optional probe
all **in sync**. Leave the world and re-enter to load the items; no new world
is needed. Deployment is not in-game acceptance. Potion-tipped custom-arrow
variants are now intentionally excluded and mob-support expansion is limited
as recorded above (owner 2026-10-18);
Mallorn buttons remain a controls implementation gap, not an approved omission.
