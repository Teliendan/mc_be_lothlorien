# M5 worn gifts

Interaction review, owner decisions and current engine checklist (2026-10-18):
[parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md). Correction 2026-10-21:
the owner Content Log rejects `wearable.dispensable`; it was removed from both
items and their generator. Native dispenser equipping still needs a game check.
Cloak dyeing/trims are intentionally excluded to preserve selected artwork;
stand/mob compatibility remains native/data-only. Full freezing protection has
no verified straightforward path; the owner chose on 2026-10-18 to leave it
pending, without a partial cold-damage replacement. Native protection/repair/enchanting and equip results need game
acceptance; existing conditional-effect results retain their dated scope.

2026-10-12; Bedrock 1.26.52 / stable Script API 2.8.0.
Finalization commit: `Finalize selected Galadriel worn gifts`.
Owner accepted the revised wearable previews ("Much better") and selected
**B4-v2 Broad clasp belt, including its icon**, and **C2-v2 Silver river worn
cloak**. The cloak retains the separately selected **C4 Golden Mallorn inventory
icon**. These are final art decisions; final in-game fit remains a separate check.
The owner confirmed belt mechanics and corrected cloak invisibility in game.

`gift_rules.js` owns balance; `tools/make_worn_gifts.py` deterministically builds
the selected items, icons, material sheets, body-bound geometry and attachables.
The belt stays offhand by owner decision, raised two model units at the waist,
with a centered symmetric broad silver clasp. The cloak has teal cloth, silver
trim and broad painted folds. All cubes have whole-unit dimensions; face UVs map
one texture texel per model unit. Fractional origins position the meshes without
adding resolution. No sub-unit ornaments, inflated cubes or scaled UV swatches.
Separate body-bound anchors and mesh children isolate visibility transforms.

The cloak replaces the chestplate: armour 3, durability 80. Native chestplate
enchantments and repairs added 2026-10-18 (target 1.26.52; source/docs and offline
verification, engine acceptance pending). `minecraft:enchantable` uses
`armor_torso`, with enchantability 15 as a balance choice: Protection variants,
Thorns, Unbreaking, Mending and applicable curses follow native chestplate rules
and incompatibilities. This does not grant helmet/boot-specific enchantments.
At an anvil, string restores 25% maximum durability (20 per piece); a second
cloak contributes its remaining durability using the installed vanilla spear
repair expression. Mending uses native XP repair. Belt and phial deliberately
remain without durability, enchantability or repair components.
Generator and balance source retain these settings across regeneration.
Shared component evidence: `.claude/skills/bedrock-items/references/armor-enchanting-repair.md`.
For cloak/belt changes, run `mods deploy lothlorien --tests tests/worn_gifts.mjs`
from the workspace, then confirm `mods status lothlorien` is in sync. This keeps
all shared pack checks and runs only the relevant feature regression suite;
village simulations belong to broader village/full-suite verification.

While equipped,
sneaking without moving for 20 ticks grants Invisibility I. The five-tick service
measures displacement from the stillness period's original position and resets
on velocity, movement or dimension changes. It renews a ten-tick grant before
expiry, avoiding the render/AI gap observed with expiry-before-renewal.
The owner confirmed this correction works. The cloak mesh hides through
`query.is_invisible`; other armour and held items follow native invisibility.
Exact mesh hiding, Steve/Alex fit and first-person suppression remain game checks.

The belt grants Regeneration I strictly below half effective maximum health.
Its 60-tick grants finish before renewal, preserving native regeneration timing.
Equal/stronger regeneration potions finish untouched. The cloak preserves longer
same-strength invisibility until the final polling window, then hands over
without shortening it; infinite and stronger potions remain untouched.
Neither gift calls `removeEffect`. Leaving an equipment/effect gate stops renewal;
remaining cloak invisibility expires within 0.5s and regeneration within 3s.
Death/leave/respawn discard stillness state. The timer sleeps with no players;
there are no entity scans, player tags or block changes.

`node tests/worn_gifts.mjs` exercises production callbacks: slots, stillness,
movement/drift/velocity/dimension changes, overlap, health boundaries, effective
maximum health, external/infinite potions, lifecycle and timer sleep/wake.
It observes invisibility before each service tick for a full minute to expose
expiry gaps, and checks potion handover and exit tails. Asset checks cover unique
anchors, child-only hiding, raised belt center, whole-unit cubes and exact UV spans;
the generator requires every sampled texel to be painted. Offline tests do not
establish native durability, healing cadence or final worn rendering.

Remaining game checks: selected belt/cloak fit while walking/crouching (Steve
and Alex), first-person suppression, cloak mesh hiding, chest protection and
durability, belt native healing cadence, potion interactions, removal/death/rejoin
and multiplayer. Use [M5_GIFTS_TEST.md](M5_GIFTS_TEST.md) for the shared checklist.

Evidence: installed vanilla armour/attachables and `reference/server-2.8.0.d.ts`;
M0 owner-tested body binding; official
[wearable component](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_wearable?view=minecraft-bedrock-stable)
and [invisibility query](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_is_invisible?view=minecraft-bedrock-stable).
The [26.50 changelog](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
and [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
were checked before the effect correction; no matching native fix was identified.
Invisibility remains normal engine invisibility, not unconditional safety from mobs.
