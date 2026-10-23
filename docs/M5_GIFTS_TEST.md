# M5 gifts: final design and game checklist

2026-10-12; Bedrock 1.26.52 / stable Script API 2.8.0.
Finalization commit: `Finalize selected Galadriel worn gifts`.
Status: implemented; owner confirmed belt mechanics, phial gameplay and corrected
cloak invisibility in game. Final artwork is selected/accepted from previews:

| Asset | Final selection |
| --- | --- |
| Bow | C, slender mallorn longbow; nocked arrows in all pull textures |
| Arrow icon | 3, broad silver point with green feathers |
| Phial | D/P4, faceted moon crystal |
| Belt | B4-v2 Broad clasp, worn model and matching icon; stays offhand |
| Cloak | C2-v2 Silver river worn model; C4 Golden Mallorn inventory icon retained |

Selected wearable previews were accepted as "Much better". Geometry uses whole
model units and one face texel per unit, with painted decoration. Belt position
is raised two units. Cloak renewal occurs before expiry; bow camera easing uses
`EasingType.Linear`. Native shooter, custom critical threshold, pull-frame charge
and zoom ease now share 0.6s (12 ticks). The owner requested a more noticeable
speed difference after 0.8s felt too close to vanilla. Corrected bow rendering,
0.6s feel/zoom and broader equipment/multiplayer engine cases remain pending.
Do not treat preview acceptance or offline verification as full M5 engine coverage.
M6 has not started.

Offline validation covers production runtime callbacks, trade/loot bindings,
native projectile parity, camera cleanup, effect ownership and asset density.
Final shared verification/project regressions passed: 0 errors / 15 warnings.
The shared verifier fixture suite passes 1493 assertions. Generators reproduce
the final packs; use the verification/deploy procedure below after further edits.

Leave and re-enter the world after deployment. Existing elves gain the new stock;
no new world is required. Already-filled chests retain their contents; arrow loot
is available when new/unopened Great Mallorn chests resolve the updated table.

Owner decision: **all four final gifts cost 32 emeralds**. They require both
Harmony Friend (+10) and Renown Elf-friend (15 points). Balance source of truth:
`lothlorien_bp/scripts/gift_rules.js`.

| Gift / ammunition | Mechanics |
| --- | --- |
| Bow of the Galadhrim | Main hand; 0.6s draw, 384 durability, native damage, flight and bow enchantments. Four pull sprites with nocked arrows, native meshes and lowered third-person grip. Zoom FOV 60 while drawing, 0.6s ease. |
| Galadhrim arrows | Native vanilla trajectory; 100% item recovery after a destroyed entity hit, native ground pickup. No trail or crafting. Galadhrim bow and approved native dispenser launch; vanilla bow/crossbow custom ammo restriction retained. Dispenser engine check pending. Elven bow also fires vanilla arrows. |
| Elven cloak | Chest slot, 3 armour, 80 durability. Sneak without moving for 20 ticks to receive invisibility; movement/unsneak/unequip stops renewal. Short grants expire within 10 ticks. Cloak mesh hides while invisible; other equipped gear follows native visibility. |
| Silver belt | Off-hand, visible at the waist, raised two model units after owner feedback. Regeneration I while living health is strictly below half effective maximum; 60-tick grants finish before renewal. Residual regeneration can last 3s after unequip/recovery. |
| Phial of Galadriel | Off-hand. One invisible light-14 helper in available head/feet/overhead air; never replaces plants, solids or liquids. Repels both spider types within 8 blocks with native horizontal impulses, at most 24 spiders per holder each 5 ticks. |

Arrows unlock at Trusted: 8 per emerald for Guests, 10 for Friends. Great Mallorn
resource loot adds stacks of 4-8 arrows at weight 2. Final gifts remain renewable;
no gift recipes. Cloak and belt preserve external effects, and never clear a
potion on exit. Phial cells share ownership among players; persisted cleanup
removes only exact helper blocks and waits for unloaded chunks without loading them.

For isolated testing, use a test world and record existing reputation first:

```text
/scriptevent lothlorien:harmony 10
/scriptevent lothlorien:renown points 15
/give @s lothlorien:elven_cloak
/give @s lothlorien:bow
/give @s lothlorien:silver_belt
/give @s lothlorien:phial_of_galadriel
/give @s lothlorien:galadhrim_arrow 32
```

The reputation commands change saved progression; use them only for testing.
Keep Survival active for ammunition consumption, durability and damage checks.

| Check | Expected |
| --- | --- |
| Four shops at Friend + Elf-friend | Correct final gift in each shop, exactly 32 emeralds each. Guest Elf-friend / Friend Trusted lack all final gifts. |
| Trusted woodwright / Great Mallorn loot | Arrow stock has the correct count; new chest loot can include arrows. |
| Bow first/third person, tap/hold/full draw | Recognizable bow, lower grip, native two-arm pose, all pull frames, full draw near 0.6s (12 ticks). |
| Bow release, cancel, slot swap, death, portal, logout/reload | Zoom restores the player's normal FOV; multiplayer players clean up independently. |
| Table/anvil, Power/Punch/Flame/Infinity | Native enchantments work. Check M0 behavior against final assets. |
| Vanilla/custom arrows at 0.6s and 1s | Same flight/aim as vanilla; custom crit threshold is 0.6s, vanilla ammo retains its native threshold. Compare actual damage/crit timing. |
| Mob hit, bounce, ground, blocked/no-damage target | Destroyed custom arrow returns once; bounce does not also drop an item; ground pickup is custom ammo. |
| Infinity and creative with custom ammo | Count consumed/recovered arrows; M0 did not establish custom-ammo consumption under Infinity. Flag duplication or lost ammo; recovery deliberately remains 100%. |
| Bow/arrow interaction follow-up, 2026-10-18 | Follow [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md): same-bow anvil/crafting/grindstone repair, 10-second fuel, offhand ammo, dispenser launch, native controls, shields/immune targets/fluids/kill credit/enchantments. Each new engine result remains pending. Mallorn buttons remain an open controls gap; elven-bow dispenser crafting is intentionally excluded. |
| Cloak still sneak, drift, walk, jump, unsneak, unequip | Invisibility only after one stationary second; ends within half a second after leaving the condition. Corrected effect continuity is owner-confirmed; check selected C2-v2 mesh and other armour visibility separately. |
| Cloak chest protection and wear | Leather-level protection and native durability; held/inventory cloak grants no effect. |
| Cloak/belt ordinary interaction review | Follow [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md): native use/swap/dispenser equipping, stand/mob display, repair/curses/death, external clearing and frozen-state distinction. Rejected `wearable.dispensable` removed 2026-10-21; check item parsing after reload and compare native dispenser behavior. Other new engine comparisons pending. Dyeing/trims intentionally omitted. |
| Cloak enchanting table / enchanted books at anvil | Normal chestplate enchantments: Protection variants, Thorns, Unbreaking, Mending and applicable curses; native incompatibilities. Helmet/boot enchantments rejected. Added 2026-10-18; engine acceptance pending. |
| Damaged cloak + string / second cloak at anvil; Mending XP | String restores 20 durability each, capped at 80. Second cloak contributes remaining durability; check native XP costs and enchantment merging. Mending repairs the equipped cloak from collected XP. Belt/phial have no durability or enchanting/repair support. |
| Belt 9/20 vs 10/20 health, off-hand vs main hand | Healing below half only, at native Regeneration I cadence; selected B4-v2 belt sits at the raised waist position. |
| Long/strong potion plus either worn gift | Potion duration/potency preserved; unequipping does not erase it. |
| Phial indoors/outdoors, movement/unequip/death/portals | Smooth useful light with no lingering loaded helpers. Existing light/solid/plant/water/lava blocks remain intact. |
| Two phial holders in one cell, then separate | One shared light remains until neither holder needs it; correct cleanup per dimension. |
| Phial departure/reload with unloaded old cell | Persisted orphan cleans up after the cell loads. Player replacements survive cleanup. |
| Building, water/lava arrival, piston at helper | Invisible replaceable helper blocks no building/collision; no item drops or relocated helper. Fluid arrival needs native confirmation. |
| Spiders/cave spiders, walls/elevation/multiple holders | Noticeable repulsion without teleporting through terrain; no damage or upward launch. Contact attacks are still possible. |
| Nine languages / Content Log | Names resolve and native screens display correctly; no new load/API errors. |

Offline suites run production callbacks against the shared mock:
`tests/archery.mjs`, `tests/worn_gifts.mjs`, `tests/phial.mjs`, and expanded
trade/loot regressions. The shared verifier checks all pack bindings and rules.
Original 16px icons were compared with vanilla using the shared icon sheet;
cloak/belt meshes were rendered and inspected in Blockbench. Those previews do
not establish owner-bone binding, native lighting, gameplay balance or animation.

Regenerate after editing rules:

```powershell
python -B tools/make_galadhrim_archery.py
python -B tools/make_worn_gifts.py
python -B tools/make_phial.py
node tools/build_trades.mjs
node tools/build_gift_loot.mjs
```

From the workspace, run `mods localize build lothlorien`, `mods verify lothlorien`,
then `mods deploy lothlorien` and confirm `mods status` is in sync.
Detailed evidence/limits: [ARCHERY.md](ARCHERY.md),
[M5_WORN_GIFTS_NOTES.md](M5_WORN_GIFTS_NOTES.md),
[M5_PHIAL_NOTES.md](M5_PHIAL_NOTES.md). Reusable archery template is in
`.claude/skills/bedrock-items/templates/custom_archery/`; supporting shared skill
notes are in `.claude/skills/bedrock-items/references/`.
