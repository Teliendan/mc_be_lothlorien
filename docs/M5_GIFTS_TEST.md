# M5 gifts: implementation and game checklist

2026-10-11; Bedrock 1.26.52 / stable Script API 2.8.0.
Implementation commit: `Implement M5 Galadriel gifts and Galadhrim arrows`.
Status: implemented; owner confirmed belt mechanics and the phial, then requested
cloak/bow fixes and visual alternatives. Follow-up corrections need engine
acceptance. Stop here before M6.

2026-10-11 feedback: keep the belt offhand and raise its worn position. Cloak
invisibility briefly expired and the belt/cloak appeared to flicker together.
Renew before expiry and isolate visible mesh transforms from bound anchors.
Bow pull sprites now include a nocked arrow; a capitalized Script API easing
enum corrects the failed zoom, eased over its 0.8-second draw. Default bow is
slimmer and larger. Phial gameplay and its default art remain as accepted.
Review-only alternatives live in workspace `temp/elven_inhabitants/m5_polish/`.
Follow-up commit: `Polish M5 gift visibility and native bow drawing`.
Validation: shared verify 0 errors / 15 warnings; full project regressions passed.
Bow/worn generators rerun with zero pack-byte drift. Shared verifier fixture
suite passes 1493 assertions. These checks do not establish native rendering.

Leave and re-enter the world after deployment. Existing elves gain the new stock;
no new world is required. Already-filled chests retain their contents; arrow loot
is available when new/unopened Great Mallorn chests resolve the updated table.

Owner decision: **all four final gifts cost 32 emeralds**. They require both
Harmony Friend (+10) and Renown Elf-friend (15 points). Balance source of truth:
`lothlorien_bp/scripts/gift_rules.js`.

| Gift / ammunition | Mechanics |
| --- | --- |
| Bow of the Galadhrim | Main hand; 0.8s draw, 384 durability, native damage, flight and bow enchantments. Four pull sprites with nocked arrows, native meshes and lowered third-person grip. Zoom FOV 60 while drawing, 0.8s ease. |
| Galadhrim arrows | Native vanilla trajectory; 100% item recovery after a destroyed entity hit, native ground pickup. No trail or crafting. Only the Galadhrim bow fires them in Survival; it also fires vanilla arrows. |
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
| Bow first/third person, tap/hold/full draw | Recognizable bow, lower grip, native two-arm pose, all pull frames, full draw near 0.8s. |
| Bow release, cancel, slot swap, death, portal, logout/reload | Zoom restores the player's normal FOV; multiplayer players clean up independently. |
| Table/anvil, Power/Punch/Flame/Infinity | Native enchantments work. Check M0 behavior against final assets. |
| Vanilla/custom arrows at 0.8s and 1s | Same flight/aim as vanilla; custom crit threshold is 0.8s, vanilla ammo retains its native threshold. Compare actual damage/crit timing. |
| Mob hit, bounce, ground, blocked/no-damage target | Destroyed custom arrow returns once; bounce does not also drop an item; ground pickup is custom ammo. |
| Infinity and creative with custom ammo | Count consumed/recovered arrows; M0 did not establish custom-ammo consumption under Infinity. Flag duplication or lost ammo; recovery deliberately remains 100%. |
| Cloak still sneak, drift, walk, jump, unsneak, unequip | Invisibility only after one stationary second; ends within half a second after leaving the condition. Check cloak and other armour visibility separately. |
| Cloak chest protection and wear | Leather-level protection and native durability; held/inventory cloak grants no effect. |
| Belt 9/20 vs 10/20 health, off-hand vs main hand | Healing below half only, at native Regeneration I cadence; belt sits at waist. |
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
[M5_PHIAL_NOTES.md](M5_PHIAL_NOTES.md). Reusable archery template is staged in
workspace `docs/templates/custom_archery/`; supporting shared skill notes are in
`.claude/skills/bedrock-items/references/`.
