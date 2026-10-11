# M5 worn gifts

2026-10-11; target Bedrock 1.26.52 / Script API 2.8.0. Source/documentation review
and offline tests, with owner feedback: belt works but sits low; cloak invisibility
periodically drops and both worn meshes flicker. Corrections below still need an
engine retest; the phial was accepted independently.

`gift_rules.js` owns the balance. `make_worn_gifts.py` regenerates the item
definitions, 16-pixel icons, green woven cloak and silver belt texture sheets,
body-bound geometry, attachables and first-person hide animations.

The cloak uses native `minecraft:wearable` chest protection and native durability,
replacing a chestplate. Script polls online players every five ticks. Sneaking
starts a stationary period; displacement is measured from the period's original
location, so repeated tiny steps cannot accumulate without detection. Velocity
and dimension changes also restart the period. After one second it grants short
invisibility. The initial implementation waited for an effect to expire before
granting it again, so native render/AI phases could observe a gap at that boundary.
It now renews a finite Invisibility I grant with at most five ticks remaining,
while ten ticks are granted each time. A longer same-strength potion remains
untouched until its final polling window, then hands over without shortening its
remaining duration. Infinite and stronger potions remain untouched. This is the
normal engine effect; other armor and held items retain
their usual invisibility behavior. The cloak mesh additionally scales to zero
when `query.is_invisible` is true, without replacing the player render controller.
This query's behavior in the attachable owner context still needs an in-game check.

The belt stays in the offhand slot by the owner's decision during polish, and
uses a literal body-bone binding, following the owner-tested M0 waist spike.
Its band and buckle have both been raised exactly two model units. Both worn
meshes have unique body-bound anchor bones and separately named mesh children;
hide animations scale only the children, isolating visibility transforms from
owner-bound bones. The original meshes already had different bone names, so
shared-name animation collision is not established as the cause of flicker.
The cloak's repeated native invisibility expiry explains synchronized appearance
changes; this source finding and the isolation correction still need game checks.
It grants Regeneration I strictly below half the
player's effective maximum health. Equal or stronger regeneration, including an
infinite effect, finishes before another grant. Reapplying an active regeneration
effect can reset native healing timing; the belt follows M4's completion-before-
renewal approach. Engine healing cadence itself needs the game.

Neither gift calls `removeEffect`. Another source may replace a gift's effect at
any time, and the API supplies no source token for proving ownership. Allowing
short grants to expire protects external potions: cloak invisibility lasts at
most another half second after movement/unequip, and belt regeneration at most
another three seconds after leaving the health/equipment gate. Leaving, death
and respawn discard the cloak's stillness state. An empty server stops the timer;
player spawn wakes it. No entity scans, persistent player tags or block changes.

`node tests/worn_gifts.mjs` covers correct slots, one-second wait, native item
values, movement/slow drift/velocity/dimension resets, overlapping gifts,
death/respawn, invalid-player isolation, external/infinite potions, regeneration
expiry and renewal, half-health boundary and effective-max health, unequip,
timer sleep/wake and duplicate-start protection. Asset bindings are checked too.
The polish regression observes invisibility before the service runs on every
tick of a full minute, so expiry/reapply in the same script tick cannot conceal
a gap. It also checks seamless same-strength potion handover, a potion replacing
an existing cloak grant, the ten-tick exit tail, separate anchor/mesh names and
hide transforms, and the two-unit belt height correction.
It does not establish rendering, native durability damage or effect healing rate.

Evidence checked in this session:

- Local `reference/server-2.8.0.d.ts`: `Entity.isSneaking`, `getVelocity`,
  `EntityEquippableComponent.getEquipment` (`Chest`, `Offhand`), `Effect.amplifier`
  and `Effect.duration`, `world.afterEvents.playerSpawn/playerLeave/entityDie`.
- Local vanilla player armor and chestplate attachable for body coordinates;
  M0 `temp/elven_inhabitants/spike_files/` for the verified belt binding.
- [Official wearable component](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_wearable?view=minecraft-bedrock-stable):
  chest/offhand slots and protection. Notes a stack-size fix at format 1.26.30;
  these generated items use format 1.26.50.
- [Official 26.50 changelog](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
  and [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog):
  no matching effect-refresh or bound-bone correction identified in the polish audit.
  26.50 does change detection of invisible Armor Stands/Drowned; that does not
  establish changed player invisibility or unconditional safety from zombies.
- [Official invisibility query](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_is_invisible?view=minecraft-bedrock-stable)
  and local vanilla Enderman/spider/phantom render controllers document the query.

Game checks: equip and remove the cloak (first/third person, Steve/Alex), check
armor points/durability, crouch stationary for one second then move/stand/teleport,
check that cloak mesh vanishes with invisibility, combine with invisibility
potions and other equipment. Equip belt offhand, check waist position while
walking/crouching, health just below and exactly at half, longer/stronger regen
potions, removal, death/rejoin and multiple players. First-person visibility and
left-arm suppression in the belt attachable were not separately judged in M0.

Polish alternatives are retained in workspace scratch while the owner chooses:
`temp/elven_inhabitants/m5_polish/worn/belt_alternatives.png` shows B1 Silver
leaf, B2 Braided mithril, B3 Evenstar and B4 Woodland vine with frontal torso
views and close band/clasp views. `cloak_alternatives.png` shows C1 Galadhrim
mantle, C2 Silver river, C3 Woodland scout and C4 Golden mallorn, front and back.
Each option includes its actual 16px icon, 64px material sheet, cube geometry,
attachable and local hide animation under `worn/assets/<code>/`. These are
offline mesh previews, with preview identifiers only; the options are not
registered gameplay items or deployed. Production keeps the existing design
until selection, with the raised belt and visibility-isolation correction.
