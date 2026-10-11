# M5 worn gifts

2026-10-11; target Bedrock 1.26.52 / Script API 2.8.0. Source/documentation review
and offline tests only. M5 owner testing is pending.

`gift_rules.js` owns the balance. `make_worn_gifts.py` regenerates the item
definitions, 16-pixel icons, green woven cloak and silver belt texture sheets,
body-bound geometry, attachables and first-person hide animations.

The cloak uses native `minecraft:wearable` chest protection and native durability,
replacing a chestplate. Script polls online players every five ticks. Sneaking
starts a stationary period; displacement is measured from the period's original
location, so repeated tiny steps cannot accumulate without detection. Velocity
and dimension changes also restart the period. After one second it grants short
invisibility. This is the normal engine effect; other armor and held items retain
their usual invisibility behavior. The cloak mesh additionally scales to zero
when `query.is_invisible` is true, without replacing the player render controller.
This query's behavior in the attachable owner context still needs an in-game check.

The belt uses the offhand slot and a literal body-bone binding, following the
owner-tested M0 waist spike. It grants Regeneration I strictly below half the
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
- [Official 26.50 changelog](https://www.minecraft.net/nl-nl/article/minecraft--bedrock-edition-26-50-changelog):
  searched for wearable, regeneration and invisibility; no matching changes.
- [Official invisibility query](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_is_invisible?view=minecraft-bedrock-stable)
  and local vanilla Enderman/spider/phantom render controllers document the query.

Game checks: equip and remove the cloak (first/third person, Steve/Alex), check
armor points/durability, crouch stationary for one second then move/stand/teleport,
check that cloak mesh vanishes with invisibility, combine with invisibility
potions and other equipment. Equip belt offhand, check waist position while
walking/crouching, health just below and exactly at half, longer/stronger regen
potions, removal, death/rejoin and multiple players. First-person visibility and
left-arm suppression in the belt attachable were not separately judged in M0.
