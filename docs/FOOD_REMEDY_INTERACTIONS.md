# Food, drinks, remedies and bottled recipe resources

2026-10-19; target Bedrock1.26.52 / API2.8.0. **Group10 owner approved and implemented2026-10-19.** Source/docs review,
production-handler offline regressions; no new game observations. Deployment
and final shared verification are recorded by the root agent after pack freeze. Prior eating and Miruvor cancellation
acceptance retains its exact scope; it does not prove the failure cases below.

Evidence correction2026-10-20: Miruvor captures then compares its hand snapshot
inside one synchronous completion callback. This is not a player hand-switch
window; the owner-approved cleanup removes the deep immediate comparison in the
[guard review](../../../docs/synchronous-validation-review.md). Native completion,
skin durability, cooldown and consumption remain separate requirements. No
new native ordering result is claimed. Current implementation/verification:
[SYNCHRONOUS_VALIDATION.md](SYNCHRONOUS_VALIDATION.md); deployed2026-10-20,
all3 packs in sync after14 selected runners passed. No new native game result.

## Exact scope and existing choices

Explicit items: `athelas_salve`, `miruvor`, `mallorn_nectar`, `morning_dew`,
`dew_bottle`, `lembas_cake`, `lembas_wrapped`, `lembas_dough`, `venison_raw`,
`venison_cooked`, `swan_meat_raw`, `swan_meat_cooked`, `western_corn_grain`, all
under `lothlorien:`. Linked recipes, native glass bottles, native food consumers
and scripted salve/Miruvor/Lembas effects are included. Firefly exchanges and
dew/nectar gathering remain covered by Groups7-9. Corn planting/growth belongs
to Group7; Great nut decisions remain in Group6. Phial has its later gift group.

Preserve: food nutrition/saturation, use times, artwork, custom recipes and
acquisition; Miruvor four sips/30-second completed-use cooldown and last-sip skin
removal; salve/Miruvor Poison cure and wrapped-Lembas Hunger cure. Nectar is
explicitly an ingredient only, owner2026-10-02; dew is its own decorative/crafting
resource. No edible nectar/honey conversions, additional corn wheat-substitution
uses, bee experiments or speculative vanilla-mob replacements.

## Final decisions and implementation

| Interaction | Final disposition2026-10-19 |
| --- | --- |
| Salve bottle return | IMPLEMENTED native food.using_converts_to minecraft:glass_bottle. Preserve stack16, full-hunger drinking and native consumption; script never subtracts food. Single/stacked/full inventory/Creative returns need engine acceptance. |
| Miruvor completion and progress | IMPLEMENTED validate native event skin and actual mainhand skin type/amount1/max durability4/integer damage0-3 plus current category cooldown. Read the live slot needed for charging once. Owner-approved2026-10-20 cleanup removes immediate deep captureHand/liveHand comparison; this synchronous callback is not a player hand-switch boundary. |
| Native completion/cancellation | PRESERVED onCompleteUse as sole completion authority. No timer/replacement drink, and no new dependency on global start/stop hooks whose chargeable-item delivery is unverified for this nonfood skin. Native selected-slot/dimension/cancel behavior remains an engine case, not something proved by immediate script snapshots. |
| Creative and cooldown | IMPLEMENTED no sip charge/removal in Creative; completed effects/cooldown unchanged. Keep native category duration0, explicit600 ticks after a completed medicinal outcome, four survival sips and final removal. Category guard rejects duplicate completion during cooldown, including Creative and fresh replacement skins. No completed callback means no effect/sip/cooldown. |
| Effect coexistence | IMPLEMENTED preserve any stronger OR longer/equal existing Regeneration/Speed grant, even weaker-longer. Negative/nonfinite duration is conservatively preserved; -1/Infinity tests are defensive representations, not established engine return values. Retain instant healing and Poison-only cure; no milk cleanse or hidden-effect replay. |
| Partial effects/errors | IMPLEMENTED per-effect isolation: a successful grant (including addEffect returning undefined), deliberately preserved grant or actual Poison cure proceeds to sip/cooldown. Without any such outcome, no sip or cooldown is charged. Charge attempt is followed by cooldown in finally; sound is separately optional. API failures are not atomic: a throwing effect may have mutated before throwing, a failed skin write may leave a free sip but the cooldown is still attempted, and a throwing cooldown API cannot guarantee native blocking. No speculative rollback/replay. |
| Wrapped-Lembas Hunger cure | IMPLEMENTED core native-consume callback cure runs independently before isolated player-deed feedback; neither failure suppresses the other. No script food charge. |
| Compost | IMPLEMENTED plain Lembas85% like edible Bread; wrapped/dough85%, grain65% unchanged. Meat/remedies/bottled resources noncompostable. Great nut remains its separate intentional noncompostable decision. |
| Meat cooking | IMPLEMENTED soul_campfire alongside furnace/smoker/campfire for venison and swan. Preserve raw/cooked food values and explicit no-raw-swan-debuff design. Dough deliberately retains furnace/smoker baking only. |
| Food and resource balance | INTENTIONAL unchanged use times, nutrition/saturation, recipes/acquisition, artwork, stack limits and ordinary native full-hunger gate. Nectar remains ingredient-only; dew remains crafting/decor resource. No extra corn wheat-substitution uses or new potion/skin variants; final Miruvor skin disappears. |
| Crafting bottle remainders | OPEN conditional native route: Miruvor empties3 salves +1 nectar (4 bottles), rope empties1 dew, star_canopy empties3 dew. Current documented shaped result arrays do not establish remainder placement/quick-craft/full-inventory semantics; no speculative array or edible-ingredient workaround. Firefly jar and both lanterns intentionally keep their bottle as housing, so never return it. Salve recipe's initial glass bottle becomes the salve container. |
| Wolf consumers | OPEN separately: healing, breeding, baby growth and begging/attraction. Newest installed wolf1.26.50 lists explicit native IDs for all four consumers; custom is_meat tag alone proves none. No simple item-only data route found. No vanilla-wolf replacement or script feeding simulation; absence from lists is not an in-game failure observation. Earlier tag-only compatibility overclaim corrected in deer/technical notes. |
| Fox consumers | Retain existing is_food tags. Newest installed fox1.26.50 has shareables item minecraft:is_food plus all_items:true and eat_carried_item delay28. This is a native route worth acceptance testing, not proof custom pickup, held-food eating or nutrition works in game. OPEN native acceptance; no fox override. |
| Villager consumers | OPEN Lembas pickup/food points/willingness/breeding; newest installed villager_v2 1.26.20 shareables lists explicit vanilla foods/seeds/wheat, so no simple item-only missing setting established. No villager replacement and no additional corn wheat uses. Trade recognition remains independent. |
| Other native surfaces | OPEN ordinary eating/full hunger/offhand/cancellation, saturation UI, persistent hidden effects, item storage/hoppers/dropper/bundle/frame, death/fire/lava/despawn/keepInventory, exact station XP/timing/transfer and campfire recovery. Current furnace schema has no experience field: no guessed Java XP data or runtime XP simulation. Brewing/cauldron/splash/tipped variants do not automatically apply; Group1 tipped variants owner-excluded. |

Regenerate the four data files with tools/configure_food_remedy_interactions.py;
configure_support.py invokes this art-independent, byte-idempotent post-pass.
Existing provisions art generator changes textures only and cannot overwrite these
BP policies. Miruvor recipe's actual pattern is ESE / SHS / NLN (three salves,
one nectar, two of each flower and one leather); corrected the old prose typo.

## Offline validation and native acceptance

Feature suite food-remedy runs tests/food_remedy_interactions.mjs and
tests/miruvor.mjs independently. Ten production medicine scenarios cover:
no-completion attempts, normal balance/player isolation, four sips/final-sound
failure/fresh-skin cooldown, Creative duplicate completion, wrong/stale/renamed/
invalid skins, completion-context slot/dimension/mode changes, stronger/longer/
defensive-infinite grants, total versus partial effect failures, poison/write
failures, and salve native consumption ownership. The food runner executes the
real Lembas callback with throwing deed/cure providers and checks approved data,
station/recipe/balance and intentional ingredient/housing policies.

Engine acceptance remains required: normal and cancelled Miruvor use under slot,
dimension and movement changes; callback item/live-hand snapshot ordering; full
30-second cross-skin cooldown/display, final sip and Creative; long/strong actual
effects and poison/Hunger cures; salve returns with one item, stacked bottles,
full inventory and Creative; composting and four cooking stations. Conditional
crafting remainders and native animal/villager consumer recognition remain OPEN.

## Evidence and confidence

Read item/scripting skills, completed-drink-cooldowns.md, food/tag references,
mod Phase7/8/14b, design plan, native meat and herb notes and existing tests first.
Checked installed vanilla newest versioned recipes and wolf definition, not
just base vanilla. Honey-bottle1.14/bread1.10 files show older native formats;
never copy deprecated food fields into modern1.26.50 items.

Current official26.50 release and26.52 hotfix reviewed before suggesting fixes;
no relevant completed-drink/container fix established. Sources retrieved2026-10-19:

- [Honey Bottle, November2025 Wiki archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Honey_Bottle): drinking, poison-only cure, full hunger, container and crafting uses; not authority to turn nectar into honey.
- [Potion, same archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Potion): consumption, returns, effects, formats, brewing/cauldrons and edition limits.
- [Bread, same archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Bread): eating, villager consumers/trades and85% composting; Lembas is an edible item, not a Cake block.
- [Raw Chicken](https://minecraft.wiki/w/Raw_Chicken), [Cooked Chicken](https://minecraft.wiki/w/Cooked_Chicken), [Steak](https://minecraft.wiki/w/Steak): obtaining, eating/smelting, wolves, trading, sounds/history; readable but1.7-2-year-old crawls. Archive Raw Chicken/Raw Beef/Steak/Cooked Beef fetches failed; raw venison comparison additionally uses pinned native beef data. No fresh Wiki revision claimed.
- [Food component](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_food?view=minecraft-bedrock-stable): native using_converts_to, full-hunger gate, modern saturation; remove_effects is deprecated in modern formats.
- [Shaped recipe](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/recipereference/examples/recipedefinitions/recipe_shaped?view=minecraft-bedrock-stable), [furnace recipe](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/recipereference/examples/recipedefinitions/recipe_furnace?view=minecraft-bedrock-stable), [Entity.addEffect](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable): documented APIs, not native in-game acceptance.

Direct handler reproductions: Miruvor last-sip sound failure => skin removed,
three effect calls, zero cooldowns. Wrapped-Lembas deed failure => thrown callback,
zero Hunger cures. No pack files were modified for these checks.
Owner approved the complete group2026-10-19; implementation delegated as one cohesive food/remedy change. Existing evidence above remains pre-change history, not a claim these failures still occur.
Shared research/corrections recorded in workspace commit `74129e7`; mod findings
remain uncommitted with the ongoing interaction audit.

## Deployment2026-10-19

Root reviewed production handlers/tests and independently compared all four
post-pass outputs without modifying packs. Deployed food-remedy, crops,
flora-crop, deer, swan-squirrel, nectar-dew and suite-layout:11 runners passed;
production0 errors/0 warnings/15 documented exceptions, unchanged optional probe
0 errors/1 warning. Six BP files copied; RP unchanged. Subsequent mods status
confirmed all three packs in sync. No worldgen changes; leave/re-enter the world
to load files. Native acceptance cases above remain open.
Shared implementation knowledge/deployment record: workspace commit `d7b41cc`.

Final scoped verification2026-10-19: food-remedy, crops, flora-crop, deer,
swan-squirrel, nectar-dew and suite-layout all11 runners passed. Production
packs0 errors/0 warnings/15 documented exceptions; optional feature probe remains
0 errors/1 existing warning. Read-only regeneration comparison matched all four
data outputs; scoped whitespace check passed. No commit or deployment performed
by the implementation agent; pack files frozen for root review/deployment.
