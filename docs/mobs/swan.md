# Swan (`lothlorien:swan`) - final design

**Finished and accepted by the owner, 2026-10-14.** Target Bedrock 1.26.52 /
Script API 2.8.0. Feature commit: `2810ce3` (`Finish swan drops and visible
feather shedding`). Final art/cleanup commit: `Finalize swan art and remove
runtime diagnostics`.

Owner decision 2026-10-20: natural swans still require a readable Lothlorien sample nearby; missing-only data does not
authorize them. Native chicken-style fall immunity added; explicit air+water breathing kept. Details: [parity/CREATURES.md](../parity/CREATURES.md).

| Area | Final decision |
| --- | --- |
| Identity | Plain white swan with orange beak, dark knob/lore and black legs; no gold/silver on animals. Families `lothlorien_swan`, `mob`; water-creature spawn category |
| Body | Collision 0.8 x1.2,10HP, no attack/taming/riding. Leashable/nameable; native fall immunity and explicit air+water breathing, no added flight |
| Care | Wheat or Western Corn grain lure calm/Friend swans and breed adults. No food healing because swans breed. Cygnets use 45% adult scale, follow parents, grow in 20 minutes and grow faster with grain; born babies stay persistent |
| Spawning | Lothlorien or river water; water-animal pool; weight 10, herds 1-2, density limit 3, distance 12-40. Natural spawns include 10% cygnets. Once-only 25-point check requires observed Lothlorien within 48 blocks; missing-only samples remove natural swans intentionally (owner 2026-10-20). Eggs/summons/born animals without the natural flag stay. **Surface fix (owner decision 2026-11-02, not checked in game):** the spawn rule is the vanilla fish pattern (any water depth), so the same one-shot check (`swan.js` `judgeNaturalSpawn`, pure `swan_rules.js` `surfaceAction`) follows the water column up from the swan (water/flowing water, max 16 blocks); two air blocks above the top water block -> teleport to that block's y (x/z/rotation kept), anything overhead (bank, leaves) -> remove; already at the surface or not in water (land) -> unchanged. Weight not changed. **In-game check:** assumed `floor(location.y)` of a swimming swan is the top water block or the air block just above it, and teleporting to `y = top water block` leaves it floating (not sunk/bobbing); `/summon lothlorien:swan ~ ~ ~ ~ ~ lothlorien:spawn_natural` in deep water, under a bank, at the surface and on land near Lothlorien |
| Despawn | Standard `despawn_from_distance`; naming, leads/keeping and born persistence use the established lifecycle |
| Movement | Chicken-style walk navigation with water pathing; stroll priority 6, panic 1. **Floating, accepted by the owner in game 2026-11-25 (1.26.65)** after tester reports of neck- or head-deep dips: `minecraft:buoyant` base 0.6, `apply_gravity` false, `movement_type` `none`, auto-step from liquid, water only; float goal priority 0 with `chance_per_tick_to_float` 0; swim animation body offset 0 px (was -1.5). It never goes under while swimming. Rejected, tested side by side: horse `bobbing` (bounce grew until fully under), base 1.0 (sat on the surface, could not steer, splashed constantly), 0.9/0.75 (worse than 0.6), 0.5/0.4 (bounced out of the water, legs showing), +1/-1 px offsets. Known limit: splash particles while swimming (engine-drawn, no per-entity switch). No fish-style random swimming |
| Wariness | Native per-player flight, the deer's table (`tools/wildlife_wariness.py`): Guest 10 / 5 sneaking, Uneasy 13 / 6, Shunned 20 / 10, Hated 30 / 15, Friend 3 / 2, alarmed 36 / 18 for 20 s; Guest and Friend holding wheat or corn are not fled from (one flat `has_equipment !=` per item), worse bands are. Wolves scare swans (monsters no longer, 2026-11-22); hurting/killing a deer/swan/squirrel alarms nearby creatures within 20 blocks |
| Harmony | Player kill costs 3 animal Harmony when player or swan is in Lothlorien |
| Passive feathers | One ordinary feather per living adult every random **1-5 minutes**, native `minecraft:spawn_entity`; no added script polling/scans/callbacks. Original 10-20 minutes rejected as too rare to discover; chicken eggs are 5-10 minutes |
| Death drops | **Exactly one swan meat**, including with Looting, plus existing 1-2 feathers with their Looting bonus. XP 1-3 on player kill. Cygnets shed nothing and have no death loot |
| Food | Raw nutrition 2 / saturation modifier 0.3; cooked 6 / 0.6; no raw-food debuff. Furnace/smoker/campfire recipe; burning adult deaths use native `furnace_smelt`. Food/meat tags match venison |
| Animation | Idle neck/tail sway, land waddle, swimming leg paddle, look-at-target; accepted 1.35-second feather shake with body roll, neck counter-sway, tail ruffle and slight wing lift |
| Meat art | Accepted angled poultry leg with full meaty end, narrow neck, exposed ivory bone/knuckle. Shared raw/cooked silhouette, pink raw / browned cooked, 16x16, top-left highlights. Original boneless oval rejected as a ball |
| Sounds | Owner-approved MOSS ambient contact calls, seeds 122/123 (2026-10-16), configured 25–60 s interval and ambient pitch 0.95–1.05 (`../AUDIO.md`); native playback check pending. Chicken hurt/death/step retained; shedding uses empty spawn sound |

The native item-spawn event toggles the client-synced `lothlorien:shed_phase`;
the RP controller plays one shake on either edge, then returns to idle. The
feather appears as shaking starts. Normal walk/swim animations remain active.
Controller initialization avoids replaying historical drops.

The dev-world adult migration (`adult_initialized`) was removed in the LM-06 commit; no pre-2026-10-14 swans matter.
Babies retain their age. The five-second test group and test events were removed
from BP; RP contains only the production shake animation/controller.

Source: BP `entities/swan.json`, `spawn_rules/swan.json`, `loot_tables/entities/swan.json`,
`scripts/swan.js` and `swan_rules.js`; the alarm in `scripts/deer.js`, flight in `entities/swan.json` (`state_wild`).
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

## Implementation (from the technical notes, 2026-11-12)

Owner tried squirrel and deer in game 2026-10-02 ("very good"); the swan floats with an occasional dip, left as is.

- **Shared wariness:** same table and groups as the deer ("Implementation" in `deer.md`; `WARY_TYPES` in `deer_rules.js`). Animals saved by a build before LM-01 carry no flight group and stay fearless until the first alarm (owner 2026-11-11: no migration).
- **Swan** spawns in rivers too (spawn filter `any_of` tag `lothlorien` or `river`); `swan.js` removes natural spawns with no positively read Lothlórien sample within 48 blocks (25 samples, once per spawn). It floats with
  `minecraft:buoyant` base 0.6 without bobbing since 2026-11-25 (Movement row; turtle navigation dived; the 2026-10-02 `buoyant` with the obsolete
  `simulate_waves` field sank it; the chicken float goal dipped neck deep).
