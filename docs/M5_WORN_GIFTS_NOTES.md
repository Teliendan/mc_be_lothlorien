# M5 worn gifts

2026-10-12; target Bedrock 1.26.52 / Script API 2.8.0. Owner confirmed the corrected
cloak invisibility works. The earlier feedback was periodic invisibility drops
and synchronized cloak/belt flicker. The belt works and stays offhand. Wearable
art corrections below are provisional and still need the owner's visual verdict;
the phial was accepted independently.

`gift_rules.js` owns the balance. `make_worn_gifts.py` regenerates the item
definitions, 16-pixel icons, green/gold cloak and silver belt texture sheets,
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
Its band stays raised two model units (origin y13.5); the simplified buckle and
band share the center y14.5 and x0. Both worn
meshes have unique body-bound anchor bones and separately named mesh children;
hide animations scale only the children, isolating visibility transforms from
owner-bound bones. The original meshes already had different bone names, so
shared-name animation collision is not established as the cause of flicker.
The cloak's repeated native invisibility expiry explained synchronized appearance
changes. Owner confirmed the corrected invisibility works; first-person appearance
and the revised geometry still require visual checks.
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
hide transforms, and the raised belt center. Asset checks also require whole-number
cube dimensions, no inflate/scale, and per-face UV spans exactly matching physical
face dimensions. Generator assertions additionally require every sampled texel to
be painted. These checks directly catch the rejected ornament density.
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

Owner decisions in the art revision: original `worn/` studies were rejected for
excessive detail density and sub-unit ornaments. The C4 Golden Mallorn inventory
icon alone was selected. Its production generator reproduces the selected PNG
pixel-for-pixel; the generator has no dependency on scratch files. Its four-color
palette triggers generic icon-sheet flatness/shade warnings; preserve the exact
owner-selected pixels rather than changing them to satisfy a heuristic.

The corrected provisional production cloak uses five simple integer-sized cubes,
gold trim, broad cloth folds and a small painted mallorn sprig. Every model face
maps one texture texel to one model unit. Fractional origins position the cloth
without increasing its resolution. There are no sub-unit ornaments, inflated
cubes, scaled UV swatches or enlarged texture detail; the 64px material sheet
only packs the separate full-size faces. The belt is a hollow four-strip band
with one centered symmetric buckle. Its simpler frontal icon is provisional.

New review artifacts are under `temp/elven_inhabitants/m5_polish/worn_v2/`:
`belt_alternatives_v2.png` shows B1-v2 Silver band, B2-v2 Green and gold,
B3-v2 Silver links and B4-v2 Broad clasp. `cloak_alternatives_v2.png` shows
C1-v2 Galadhrim mantle, C2-v2 Silver river, C3-v2 Woodland scout and C4-v2 Golden
Mallorn. Each contains actual Blockbench front/back renders beside the unchanged
vanilla Steve texture to show matching world texel size. `worn_icons_contrast.png`
shows all icons at actual 1x/2x plus 4x on dark and light review tiles; the standard
`production_icons_vanilla.png` adds vanilla Elytra/chestplate inventory references.
Actual geometry, texture, icons and the composite render inputs are retained under
`assets/<code>/`, with full resolution Blockbench screenshots under `renders/`.
Rebuild scratch with `python -B temp/elven_inhabitants/m5_polish/worn_v2/make_review.py`.
The optional alternatives are review assets only; only the provisional C4-v2
wearable and B1-v2 belt are in production. No new wearable design is owner-accepted
yet. Once accepted, remove obsolete variants/scratch and condense these notes.
