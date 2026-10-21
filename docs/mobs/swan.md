# Swan (`lothlorien:swan`) - final design

**Finished and accepted by the owner, 2026-10-14.** Target Bedrock 1.26.52 /
Script API 2.8.0. Feature commit: `2810ce3` (`Finish swan drops and visible
feather shedding`). Final art/cleanup commit: `Finalize swan art and remove
runtime diagnostics`.

Group13 owner decision2026-10-20: natural swans still require a positive-readable
Lothlorien sample nearby; missing-only data does not authorize them. Added
native chicken-style fall immunity while intentionally retaining explicit
air+water breathing. Offline data/production tests pass; new native acceptance
pending. Art, navigation, care, shedding timing/animation and natural settings
are unchanged. See [interaction ledger](../SWAN_SQUIRREL_INTERACTIONS.md).

| Area | Final decision |
| --- | --- |
| Identity | Plain white swan with orange beak, dark knob/lore and black legs; no gold/silver on animals. Families `lothlorien_swan`, `mob`; water-creature spawn category |
| Body | Collision 0.8 x1.2,10HP, no attack/taming/riding. Leashable/nameable; native fall immunity and explicit air+water breathing, no added flight |
| Care | Wheat or Western Corn grain lure calm/Friend swans and breed adults. No food healing because swans breed. Cygnets use 45% adult scale, follow parents, grow in 20 minutes and grow faster with grain; born babies stay persistent |
| Spawning | Lothlorien or river water; water-animal pool; weight10, herds1-2, density limit3, distance12-40. Natural spawns include10% cygnets. Once-only25-point check requires observed Lothlorien within48 blocks; missing-only samples remove natural swans intentionally (owner2026-10-20). Eggs/summons/born animals without the natural flag stay |
| Despawn | Standard `despawn_from_distance`; naming, leads/keeping and born persistence use the established lifecycle |
| Movement | Chicken-style walk navigation with water pathing and float priority 0; stroll priority 6, panic 1. Surface floating can occasionally dip; owner accepted this. No fish-style random swimming or added buoyancy |
| Wariness | Shared deer Harmony states/radii: Guest calm 10 / 5 sneaking, Uneasy 13, Shunned 20, Hated 30, Friend 3, alarmed 36 for 20 s. Wolves/monsters scare swans; hurting/killing a deer/swan/squirrel alarms nearby creatures within 20 blocks |
| Harmony | Player kill costs 3 animal Harmony when player or swan is in Lothlorien |
| Passive feathers | One ordinary feather per living adult every random **1-5 minutes**, native `minecraft:spawn_entity`; no added script polling/scans/callbacks. Original 10-20 minutes rejected as too rare to discover; chicken eggs are 5-10 minutes |
| Death drops | **Exactly one swan meat**, including with Looting, plus existing 1-2 feathers with their Looting bonus. XP 1-3 on player kill. Cygnets shed nothing and have no death loot |
| Food | Raw nutrition 2 / saturation modifier 0.3; cooked 6 / 0.6; no raw-food debuff. Furnace/smoker/campfire recipe; burning adult deaths use native `furnace_smelt`. Food/meat tags match venison |
| Animation | Idle neck/tail sway, land waddle, swimming leg paddle, look-at-target; accepted 1.35-second feather shake with body roll, neck counter-sway, tail ruffle and slight wing lift |
| Meat art | Accepted angled poultry leg with full meaty end, narrow neck, exposed ivory bone/knuckle. Shared raw/cooked silhouette, pink raw / browned cooked, 16x16, top-left highlights. Original boneless oval rejected as a ball |
| Sounds | Owner-approved MOSS ambient contact calls, seeds 122/123 (2026-10-16), configured 25–60 s interval and ambient pitch 0.95–1.05 (`../AMBIENT_SOUNDS.md`); native playback check pending. Chicken hurt/death/step retained; shedding uses empty spawn sound |

The native item-spawn event toggles the client-synced `lothlorien:shed_phase`;
the RP controller plays one shake on either edge, then returns to idle. The
feather appears as shaking starts. Normal walk/swim animations remain active.
Controller initialization avoids replaying historical drops.

`lothlorien:adult_initialized` initializes saved adults once, including any saved
with the retired temporary test group. Growing up sets it; becoming a cygnet
clears it. The prior `adult_ready` guard was retired so this cleanup restores
normal adult components once without resetting the timer on every later load.
Babies retain their age. The five-second test group and test events were removed
from BP; RP contains only the production shake animation/controller.

Source: BP `entities/swan.json`, `spawn_rules/swan.json`, `loot_tables/entities/swan.json`,
`scripts/swan.js` and `swan_rules.js`; shared wariness in `scripts/deer.js`.
RP `entity/swan.entity.json`, model, animations/controller, texture and sounds.
Art generators: `tools/make_swan_squirrel.py`, `make_swan_shedding.py` (Blockbench)
and `make_swan_meat.py`. All iteration scratch removed after owner acceptance;
only final generator shapes remain. Developer regression tests stay in `tests/`,
outside shipped packs. Item names/context cover nine locales and compatibility
aliases; translations remain AI drafts.

Evidence: owner confirmed natural feather production, the temporary native test,
the faster interval, shake appearance and final meat shape, then declared swans
finished. Shared verifier/project regressions pass; source checks cover adult-only
shedding, shake retriggers/initialization, migration, absence of runtime test
components and exactly-one-meat cooking bindings. Individual timer save/resume,
unloaded-time, multiplayer, cooking/burning and language checks were not separately
reported. Leave and re-enter the existing world after deployment; no new world.
