# Cloak and belt interaction review

2026-10-18; target Bedrock **1.26.52**, stable server API **2.8.0**.
Scope: `lothlorien:elven_cloak` and `lothlorien:silver_belt`, their native item
components, accepted attachables, and `scripts/worn_gifts.js`. The phial has
its own feature review. Updated 2026-10-21: the owner reported item parsing
failures after the parity change; the cloak's Content Log explicitly rejects
`wearable.dispensable` as absent from the schema. Both items contained it.
The field has been removed from both items and their generator. Other behavior
below remains source/docs and offline evidence; dispenser equipping is unverified.
The owner confirmed "Error is gone" after deployment on 2026-10-21; the reported
item parsing error is resolved in game.

Owner accepted native use/swap/dispenser equipping, straightforward data-only
stand/mob equipment, no cloak dyes/trims to retain selected artwork, freezing
protection if straightforward, and an audit of ordinary armor/effect lifecycle.
Existing cloak/belt balance, selected art and gift effects remain authoritative.

| Interaction | Disposition and implementation evidence | Remaining game comparison |
| --- | --- | --- |
| Manual cloak equipment / use-to-equip / swapping | Native chest `wearable`; max stack 1. No script handles inventory movement or consumes equipment. | Empty/occupied chest slot; use from main/offhand; full inventory and Creative; native swap result. |
| Belt equipment | Native offhand `wearable` plus `allow_off_hand:true`, max stack 1. Offhand placement is an established owner choice. | Manual/use-to-equip with shield, arrow or phial already occupying the slot; no item loss. |
| Dispenser equipping | Native wearable slots retained. **`dispensable` removed 2026-10-21:** owner Content Log rejects this documented field on target 1.26.52 / item format 1.26.50. Owner confirmed the parsing error is gone after deployment. Shared verifier now rejects the field. No supported replacement established. | Compare players/stands/eligible mobs, occupied slots, item ejection versus equipment, one-item consumption, all dispenser directions. |
| Armor stand display | Existing identifier-bound attachables and body anchors retained. Latest installed stand client has `enable_attachables:true`. No new player/stand definition override. | Hand/chest/offhand placement, body anchor, poses, invisible stand, item recovery; belt-specific slot behavior. Native declarations do not prove rendering. |
| Mob pickup/equipment | Owner scope is straightforward data only. Native wearable slots retained; installed zombie has pickup/equip goals. No verified extra item setting was established and no mob override/AI/script was added. | Which eligible mobs accept/select/equip each item, protection, drop/persistence rules and rendering. Not declared impossible or universally supported. |
| Gift effects on stand/mob | Existing implementation explicitly services `world.getPlayers()`; magical invisibility/regeneration are player abilities, not effects attached to any actor wearing the mesh. | Native item/armor effects and visuals are separate from the player gift service. |
| Cloak armor/protection | Native protection **3**, durability **80**; existing balance preserved. Script never implements ordinary damage reduction or subtracts wear. | Damage-source reductions, wear and break, knockback, shield interaction; compare the selected ordinary chest-armor behavior. |
| Cloak enchanting | Existing native `armor_torso`, value **15**. No `all` slot or scripted enchantment effects. | Table/books, applicable levels and incompatible pairs; no head/feet-only enchantments. |
| Self/material anvil repair | Existing native repair entries: same cloak donor's remaining durability; string restores 25% maximum (20 of 80). | Result/cap, native bonuses, XP/prior-work costs, rename and enchantment merge. |
| Crafting/grindstone repair | Existing durability/repairable native path retained, no fixed pristine-item recipe added. | Both crafting grids and grindstone; ordinary enchantment removal, curses, XP and bonus durability. These UIs are not simulated by offline tests. |
| Unbreaking/Mending | Native enchantment eligibility; no script replacement. | Wear odds, equipped XP repair, interaction with other Mending equipment. |
| Curses / death / keepInventory | Native armor enchantment slots and engine inventory/death rules. Gift script neither transfers items nor removes curses. | Binding removal in Survival/Creative/death, Vanishing and keepInventory, recoverable drops and full inventories. |
| Belt wear/enchant/repair | **Intentional omission under existing design:** belt has none of these components. Offhand occupancy does not imply armor durability or chestplate enchantments. | Confirm no unintended armor protection/wear or enchantment eligibility. |
| Cloak dyeing / cauldron color / smithing trims | **Intentionally excluded, owner 2026-10-18:** retain selected artwork. No dye component, custom dye recipes, trim ingredient classification or trim art added. | Check native dye/trim UIs do not unexpectedly accept the custom item. |
| Full freezing prevention | **Pending by owner choice, 2026-10-18.** No verified straightforward item immunity field/tag or public freeze-state setter was found. Installed `freezing_immune` belongs to entities; it is not an item component. | Full leather-style prevention is not established. Native damage absorption spends durability and does not document stopping buildup/visual/slowing; simple damage cancellation is also only partial protection. Owner chose to leave full protection pending; no partial replacement added. |
| Powder-snow walking / special material effects | Boot walking is inapplicable to a chest/offhand item. These are cloth/silver gifts, not golden or netherite armor; no gold-neutrality/fireproof-item/knockback tags guessed from appearance. | Ordinary snow movement and dropped-item destruction retain native behavior; freezing choice above is separate. |
| Cloak stillness/invisibility | Existing 20-tick still crouch, movement/velocity/dimension reset, ten-tick grants renewed before expiry, no unconditional safety from mobs. Owner previously confirmed effect works. | Final mesh/AI behavior, first/third person, Steve/Alex and multiplayer. |
| Belt regeneration | Existing strict below-half effective-max threshold; 60-tick grants complete before renewal. No polling reset of native heal cadence. | Actual health cadence, boosted max health, damage between service pulses. |
| External potions / effect replacement | Existing stronger/infinite/longer effects preserved; no `removeEffect` cleanup. Same-strength cloak potion hands over only near expiry. | Real potions, beacons and other add-ons; native effect ordering/HUD. |
| Milk or externally cleared effects | Offline regression now clears active effect state and verifies equipped gifts resume only on the next service pulse; unequipped gifts do not resume. | Actual milk consumption/clearing is native and still needs a game check. This is a state-transition test, not a simulated drink. |
| Unequip/death/leave/rejoin/reload | Existing service drops stale stillness, ignores dead/invalid handles, sleeps without players, wakes on spawn; finite effect tails expire naturally. | Actual death/respawn/chunk/dimension/reload ordering and multiple players. |
| Ordinary item lifetime/display/acquisition | Existing custom gift/trade acquisition and native inventory/drop/display handling retained. No new crafting sources, fuel, recycling or fire-resistance added from name/material guesses. | Hoppers/droppers, frames, dropped fire/lava/cactus/explosion/despawn, death and save/reload. Source absence is not proof of every engine outcome. |

## Sources and confidence

Read local item/mob/scripting/lookup skills and worn-gift notes first; inspected
latest installed armor-stand/zombie data, spear repair recipe and pinned API.
Checked official [26.50](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
and [26.52](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
notes before new limitations; no searched freezing/wearable entry resolved
these questions. Authoritative component/API sources:

- [Wearable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_wearable?view=minecraft-bedrock-stable): slots/protection; still lists `dispensable` as of 2026-10-21, contrary to the owner's engine schema error. The game log takes precedence. Rechecked 26.50/26.52 release notes; no matching wearable/dispenser change found.
- [Repairable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_repairable?view=minecraft-bedrock-stable), [enchantable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_enchantable?view=minecraft-bedrock-stable) and [entity equippable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_equippable?view=minecraft-bedrock-stable): item eligibility versus actor equipment rules.
- [Damage absorption](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_damage_absorption?view=minecraft-bedrock-stable): armor-slot damage is charged to item durability, not documented freeze-state prevention.
- Local `reference/server-2.8.0.d.ts`: freezing damage cause exists; no freeze-state setter identified. `setOnFire` has thaw side effects but igniting players is not a freezing-immunity implementation.
- Canonical [Armor Wiki](https://minecraft.wiki/w/Armor), with the readable [November 2025 archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Armor), retrieved 2026-10-18. Sections reviewed: equipping, repair, dyeing/trims and edition history for leather freezing. Archive age/revision limits remain; no numeric armor table was transplanted.

The old skill entry's 1.21.124 context does not supersede this target's component
versions. Current item format 1.26.50 satisfies the documented wearable gate.
Pending supported behavior stays distinct from an approved omission.

## Validation

2026-10-21 correction: removed the rejected field from source items and generator,
updated wearable assertions, and added shared verifier fixtures for valid native
slots and rejected `dispensable:true/false`. Owner confirmed the reported parsing
error is gone after deployment on 2026-10-21. Native dispenser behavior remains
unverified. Shared schema guidance and verifier fix: workspace commit `fd8ac0d`
(`Reject wearable dispensable after engine schema error`).

Ran `python -B tools/verification/test_verify_addon.py`: **1,551 assertions passed**.
Ran `mods deploy lothlorien --suite worn-gifts`: localization, wearable suite
and pack verification passed; production BP/RP **0 errors, 0 warnings,
15 documented exceptions**, existing optional probe **0 errors, 1 warning**.
`mods status lothlorien` confirmed all three packs **in sync**. Leave and re-enter
the world to load the correction; no new world is needed.

Historical 2026-10-18 validation (did not catch the engine schema rejection):

`python -B tools/make_worn_gifts.py` regenerated both item definitions with the
explicit dispenser policy; art remains unchanged. `node tests/worn_gifts.mjs`
passed 12 groups, including the new cleared-effects regression and existing
native eligibility/asset/lifecycle checks. Native equip/protection/repair and
freezing results still require engine checks. Shared pack verification and
deployment status:

Root ran `mods deploy lothlorien --suite worn-gifts` on 2026-10-18. Localization
and the wearable suite passed; production BP/RP **0 errors, 0 warnings,
15 documented exceptions**; the existing optional probe BP **0 errors,
1 warning**. Exactly the two wearable item JSON files were copied; RP and probe
were already current. `mods status lothlorien` confirmed every pack **in sync**.
Deployment does not establish in-game behavior. Leave
and re-enter the world to reload; no new world is needed. The owner chose on
2026-10-18 to leave full freezing protection pending. No partial damage-only
effect was added; pending work is not recorded as an intentional omission.
