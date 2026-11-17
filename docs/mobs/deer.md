# Deer (`lothlorien:deer`) - design sheet

Archetype: skittish prey (herd grazer). Analogues: rabbit (avoid player, panic), cow/sheep (breed, baby,
tempt). Built 2026-09-30. The Tested column records only the explicitly
reported game observations; all other rows remain unverified in game. Parity decisions: [parity/CREATURES.md](../parity/CREATURES.md).
Files: BP `entities/deer.json` (generated once from a throw-away script, now edited by hand), `spawn_rules/deer.json`,
`loot_tables/entities/deer.json` + `deer_buck.json`, `items/venison_raw|venison_cooked|deer_antler.json`,
`recipes/furnace_venison.json`, `scripts/deer.js` + `deer_rules.js`. RP `entity/deer.entity.json`,
`models/entity/deer.geo.json`, `animations/deer.animation.json`, `render_controllers/deer.render_controllers.json`,
`textures/entity/deer/`, `sounds.json`. Art is produced by `tools/make_deer.py` (see "Art" below).

## A. Identity and body

| Question | Decision | Tested |
| --- | --- | --- |
| Identifier, name, egg | `lothlorien:deer`, "Deer", egg brown `#9a6a3e` / cream `#f1e4c3` | no |
| Families | `lothlorien_deer`, `mob`. Not `rabbit`/`sheep`: vanilla wolves and foxes must not hunt it by family | no |
| Size | collision 0.9 x 1.4, baby `scale 0.5`, dedicated fawn geometry (client scale 2) | no |
| Health, speed | 14 hp, movement 0.24 (between cow 0.2 and rabbit 0.3); no attack, no knockback resistance | no |
| Summonable / spawnable | yes / yes | no |
| Sex | property `lothlorien:sex` doe/buck (client synced), 50/50; bucks have antlers | no |

## B. Where and how many

| Question | Decision | Tested |
| --- | --- | --- |
| Biomes, surface | surface, on `grass_block` or `dirt` (dirt: grass under our plants dies, MCPE-184249), biome tag `lothlorien` only | no |
| Light, time | light 7-15 (day and moonlit clearings; no time filter) | no |
| Group | herd 2-4, weight 10, `density_limit.surface 8`, `distance_filter` 12-44; 10 % of spawns are fawns | no |
| Pool | `population_control: animal` (shared with cows and sheep; engine pools are fixed) | no |
| Special spawns | none. The white deer is a separate entity since 2026-09-30 (`docs/mobs/white_deer.md`) | - |
| Despawn | standard `despawn_from_distance`; name tag keeps it (verified for the Phase 10 critter) | no |

**All Lothlorien animals (spike, owner-tested 2026-09-30, 1.26.52).** `population_control: "animal"` is a fixed engine pool shared with cows and sheep: Lórien animals compete with vanilla ones for that cap.
**Despawn: use `{"despawn_from_distance": {}}` with no filters**: `filters` replace the engine's standard rules including the instant despawn at the simulation edge, so a mob left far away was never removed.
Standard rules: more than 128 blocks from every player removed at once; 32-128 a 1-in-800 roll after 30 s inactive; at the simulation edge removed at once; name-tagged mobs stay. Every current vanilla mob uses
this. Knowledge: `.claude/skills/bedrock-mobs/references/spawning.md`. The spike entity `test_critter` was replaced by the deer. The sampling tool is `tools/dev_scripts/critter_watch.js`.

## C. Body in the world

| Question | Decision | Tested |
| --- | --- | --- |
| Movement | walks; `jump.static`; avoids water and damage blocks; no `can_climb` (no ladders, vines, scaffolding) | no |
| Water | floats (`behavior.float`), breathes air | no |
| Hazards | lava 4/tick like vanilla; fire and fall damage are engine defaults | no |
| Pushed, leash | pushable by entities and blocks; leashable (adult can be a leash anchor) | no |
| Lightning | nothing | - |

## D. Behaviour

Goal priorities: 0 float, 1 panic (x1.8), 2 breed, 3 tempt, 4 avoid, 5 follow parent (baby), 6 stroll (x0.7),
7 look at player, 9 look around.

| Question | Decision | Tested |
| --- | --- | --- |
| Idle life | strolls, looks around, ears and tail flick (animation). **No grazing**: `eat_block` turns grass into dirt and would bare the golden forest floor | no |
| Reaction to the player | flees by the player's **own Harmony band** (see below); sneaking halves the flight distance | flees in survival below Harmony 0 (band Uneasy and worse); not from a **creative** player (1.26.52, 2026-09-30) |
| Reaction to mobs | flees wolves within 12 and monsters within 8 | no |
| Vanilla mobs reacting to it | none (own family) | - |
| Panic | on any damage (x1.8); fawns too | no |
| Hostile | not hostile, no attack | - |

**Native per-player wariness** (LM-01, 2026-11-12; replaces the 2026-10-07 poll of component groups `state_<band>`). The Harmony band is a
player tag (`lothlorien_friend|uneasy|shunned|hated`, Guest = none; `docs/TAGS.md`) and one `avoid_mob_type` in `lothlorien:state_wild` judges
each player by their own tag (table in `tools/wildlife_wariness.py`, `--matrix` prints it; plan and decisions in `docs/review-2026-11-10/`):

| Band | Flight distance (walking / sneaking) | Speed (walk / sprint) | Holding corn |
| --- | --- | --- | --- |
| Friend (+10) | 3 / 2 | 1.1 / 1.3 | not fled |
| Guest (0 to +9) | 10 / 5 | 1.3 / 1.6 | not fled |
| Uneasy (-1 to -14) | 13 / 6 | 1.4 / 1.7 | fled (come-and-flee, accepted 2026-11-11) |
| Shunned (-15 to -29) | 20 / 10 | 1.5 / 1.9 | fled |
| Hated (-30 to -60) | 30 / 15 | 1.6 / 2.1 | fled |
| Alarmed (any player, 20 s) | 36 / 18 | 1.6 / 2.1 | fled |

A player hurting or killing a wary animal alarms every wary animal within 20 blocks (`lothlorien:alarm`, group `state_alarmed` with a 20 s timer, then
`alarm_over` returns to `state_wild`, or `state_tame` for a tame deer). The reaction is immediate and each player counts for themselves: a Friend next to a Hated player
can stand 4 blocks from the deer while the Hated one is fled from at 30. Deer saved by a build before LM-01 have no flight group until alarmed (no migration).

## E. Player interaction

| Question | Decision | Tested |
| --- | --- | --- |
| Luring | **Western Corn grain only** (`lothlorien:western_corn_grain`, the harvested crop; not the seeds, since 2026-09-30 owner decision; before: Mallorn acorn or apple), Guest and Friend: a player holding the grain is not fled from (avoid filter `has_equipment` hand !=), `can_get_scared` false (playtest 2026-09-30: lured deer came close, then fled even from a standing player); tempt priority 4 below the flight (3), `within_radius` 10; Uneasy and worse are fled from even with grain, and the alarm still wins | no |
| Tame | feeding corn (breeding or a fawn) sets property `lothlorien:tame`: the deer takes `state_tame` (lure, flees wolves and monsters and Uneasy, Shunned or Hated players, never Guest or Friend). A player hurting it clears tame; Uneasy, Shunned, Hated, panic and the alarm still make it flee | no |
| Kept (no despawn) | tame **or** leashed adds group `lothlorien:kept` (`minecraft:persistent`), like vanilla tamed animals; wild deer keep `despawn_from_distance`. Events: `become_tame`, `untame` (keeps it while leashed), `leashed`/`unleashed` from `leashable.on_leash/on_unleash` (keeps it while tame). Whether removing `minecraft:persistent` really lets it despawn again is untested | no |
| Leading | leashable | no |
| Breeding | corn grain only (`breed_items`), `require_tame false`, any doe/buck pair, fawn follows parent, grows up in 20 min (corn grain speeds it up, `ageable.feed_items`) | no |
| Babies | fawn model with spots; spawn egg on an adult makes a fawn | no |
| Taming, healing, riding | not wanted | - |
| Other | name tag (nameable) | no |
| Mod systems | Harmony bands via the player tags (the white deer shares them, `docs/mobs/white_deer.md`); no guidance. A kill costs 3 Harmony (a white deer 6), counted when the player or the deer is inside the forest | no |

## F. Death and rewards

| Question | Decision | Tested |
| --- | --- | --- |
| Drops | doe: leather 0-2, raw venison 1-3 (cooked if killed burning), looting +0-1. Buck: the same + **deer antler** 30 % (+5 % per looting level), player kills only. Fawns drop nothing | no |
| Venison | raw: 3 hunger, 1.8 saturation; cooked: 8 hunger, 12.8 saturation (steak level); tagged `minecraft:is_meat`, which alone does not prove wolf feeding. Furnace, smoker, campfire and soul campfire configured; native wolf-consumer acceptance pending in [../parity/BLOCKS_ITEMS.md](../parity/BLOCKS_ITEMS.md),2026-10-19 | no |
| XP | 1-3 on player kill, 1-7 on breeding | no |
| Antler use | Placeable floor/wall trophy, rare natural biome drop and one in flet chests. Current chandelier recipe uses1 antler +4 silver/gold lanterns, including mixed colors; [../parity/BLOCKS_ITEMS.md](../parity/BLOCKS_ITEMS.md), owner 2026-10-19 | - |

## G. Look and sound

| Question | Decision | Tested |
| --- | --- | --- |
| Model | generated box model, fallow-deer look (tawny coat, pale spots, white rump, dark spine). Three geometries in one file: doe, buck (with antler bones `antler_l/r`), fawn; the render controller picks one (`is_baby`, then `lothlorien:sex`). No bone is called `head` (`head_joint`): the engine derives an armour locator from a `head` bone and the fawn's clashed with the adult's (see `bedrock-mobs` client.md) | loads without content-log errors (1.26.52, 2026-09-30) |
| Variants | none (the white coat belongs to `lothlorien:white_deer`) | - |
| Animations | procedural Molang: `walk` (diagonal legs, speed weighted), `run` (gallop pairs, body bob, raised tail, weight from `query.ground_speed` 3.5..6 m/s, **threshold unverified**), `idle` (ear and tail flicks), own `look_at_target` (copy of the vanilla one for `head_joint`) | no |
| Sounds | Owner-approved local MOSS ambient calls, seeds 122/123 (2026-10-16), configured 35–80 s interval; horse hurt/death/step and fawn breathing retained. See `../AUDIO.md`; native playback check pending | listening accepted; game pending |
| Particles | none | - |

## H. Health of the world

Protocol: `.claude/skills/bedrock-mobs/references/testing.md`; instruments `/scriptevent lothlorien:critters [watch]`
(counts deer) and `/scriptevent lothlorien:deer` (tame state, sex, fawns, alarmed) were removed from the pack in the
2026-09-30 cleanup: copies in `tools/dev_scripts/`, code in git at `dc1182e`.

| Question | Decision | Tested |
| --- | --- | --- |
| Counts bounded after travel | as Phase 10 (same despawn and density rules) | no |
| Crowds out vanilla animals | shares the `animal` pool; watch numbers next to cows/sheep | no |
| Named mobs survive | as Phase 10 | no |

## Art (model, body textures and antler icon final 2026-09-30; open items in `GRAPHICS_TASKS.md` step 11)

`tools/make_deer.py` writes geometry, both entity textures and the three item icons; `.claude/skills/bedrock-mobs/scripts/preview_entity.py`
renders a software preview (orthographic, approximate rotation convention) for judging shapes before the game.
The texture was made by rule (colour ramps with hue shift, hand-placed spots, top/front light, AA-free flat shapes)
following `bedrock-art/references/style.md`. Accepted in game (1.26.52, 2026-09-30).

## Antler block

- `lothlorien:deer_antler` is a block; the same-named item (bucks drop it) is its `block_placer`. Traits `placement_position` (`minecraft:block_face`) and `placement_direction`. **Top face = a shed antler on the floor**,
  **side face = mounted antlers on a plaque** against the wall, **ceiling** too; one model (a big mounted pair filling the 16x16 face), rotated by coordinates in `tools/make_antler_block.py`. Selection boxes: floor/ceiling
  16x4.5x16, wall 16x16x4.5. There is **no `placement_filter`** (it can only name blocks or tags); the item-frame-like survival check is the shared support service (`lothlorien:motion_support`, `scripts/support_motion.js`,
  offsets in `antler_rules.js`): `beforeOnPlayerPlace` refuses unreadable or air/liquid support, and after `playerBreakBlock` and `blockExplode` neighbours are checked and an unsupported antler is destroyed. No polling.
  Not covered: pistons, water flow, other mods.
- **Natural drop:** `deer_antler_drop_feature_rules` (after surface pass, tag `lothlorien`, `scatter_chance` 1/16 per chunk, raised from 1/64 on 2026-10-02 because the owner found none), one placement attempt
  within about 3 blocks, one list feature with four facings (equal weights), all `up` (list form since 2026-11-12, verified in game (owner, 1.26.63, 2026-11-17): mixed facings). **Owner decision 2026-10-24: solo antlers, no batches** (three attempts looked like a clump). The feature has its own support rule
  (`may_attach_to.bottom`: grass, dirt, coarse dirt, podzol, dirt with roots, moss, mud, stone; `may_replace: [air]`), so an antler never floats on litter; this excludes about a third of the floor. A save scan found
  the rate about 1/50 chunks at 1/64. Status unverified after the 1/16 change and the solo change. Chest loot: the antler in `mallorn_flet.json` pool 2 (weight 2).

## Implementation (from the technical notes, 2026-11-12)

- **Native per-player wariness (LM-01, 2026-11-12).** The design is section D. Implementation: the Harmony band is mirrored into player tags (`harmony.js` `BAND_TAGS`, `docs/TAGS.md`); one `behavior.avoid_mob_type` (priority 3) in the group `lothlorien:state_wild` carries ten player entries and the unchanged wolf and monster entries; the old 2 s poll, the five `state_<band>` groups, the `set_*` events and the `lothlorien:wariness` property are gone. The positive `has_tag` test inside avoid entries is seen working only indirectly (owner J30, 1.26.63, 2026-11-17: a tame deer fled an Uneasy player, not a Guest or Friend). **The goal carries its own `max_dist` and `max_flee`** (the largest entry values, 30/34 wild, 36/40 alarmed): without them the engine searched only its default 3 blocks and every band was fled from at about 3 (owner J27, 1.26.63, 2026-11-17; Mojira MCPE-182041). Each entry keeps its own `max_dist` and `max_flee` = max(10, distance + 4); that an entry still narrows its band inside the goal radius is documented, not yet seen in game. Hand-written entity files get the avoid/tempt blocks from `python -B tools/wildlife_wariness.py --write <species>`; `--check` and the suite `wildlife-wariness` compare them with the table and run every band x sneaking x held-item case through a small filter evaluator (exactly one entry matches, none for a lure-holding Guest or Friend).
- **Alarm:** hurting or killing a wary animal fires `lothlorien:alarm` on every wary animal within 20 blocks (one `getEntities` query around the victim in `deer.js`): group `state_alarmed` (flee every player at 36/18, no luring)
  with a 20 s `minecraft:timer` whose event `alarm_over` returns to `state_wild`, or `state_tame` for a tame deer. Alarms cross species (swans, squirrels, white deer, unicorns).
- **Food:** Western Corn grain only (tempt, `breed_items`, fawn `feed_items`); the acorn belongs to the white deer; seeds do not count.
- **Goal priorities:** breed 2, avoid 3, tempt 4 (breeding must outrank both). A wolf or an unwelcome player therefore beats the lure, and a lured animal flees a wolf (changed from tempt-over-avoid by LM-01). Priority alone does not keep a
  lured deer: tempt stops on arrival and avoid takes over, so the Guest and Friend player entries of `avoid_mob_type` also need `has_equipment != <lure item>` (one flat test per item) and `can_get_scared` is false; the tempt goal has an explicit
  `within_radius` 10. Uneasy, Shunned and Hated entries have no exemption: with the lure they come close sneaking and are fled from again (come-and-flee, accepted by the owner 2026-11-11). Fed deer get `lothlorien:tame` -> `state_tame`.
  Tame and untame are entity events (`become_tame` swaps `state_wild` for `state_tame` itself, `untame`), not `setProperty`.
- **Kept deer:** tame or leashed adds group `lothlorien:kept` (`minecraft:persistent`); `untame` removes it only when not leashed, `unleashed` only when not tame.
- **Sex and antlers:** enum property `lothlorien:sex` (client synced) from `entity_spawned`/`entity_born`; geometry `deer_buck` (adult with antlers), `deer` (no antlers), `deer_baby`, picked by
  `query.property` in the render controller. Loot differs by sex through two adult groups (loot conditions cannot test custom properties). Venison carries item tag `minecraft:is_meat` (not inside `minecraft:food`:
  item format 1.26.50 rejects `is_meat` there, which stopped the items loading); the tag alone does not prove wolf feeding (parity doc). One furnace recipe carries furnace, smoker, campfire.
- **Model and animation:** procedural Molang (walk by `query.modified_distance_moved`, gallop pairs weighted `clamp((ground_speed - 3.5) / 2.5, 0, 1)`; the 3.5 m/s threshold is a guess); one slim cube per leg;
  all box sizes whole numbers (a fractional size put box-UV faces between texels and showed holes; `tools/make_deer.py` fails on fractional sizes or unpainted texels); bone z rotation has the same negated handedness
  as x. The engine logs `armor_offset.default_neck` locator warnings for a bone named `neck` (bone renamed `neck_joint`, antlers split into a separate geometry; the log text was not confirmed gone, status unverified).
  Art: `GRAPHICS_TASKS.md`. Sounds: `AUDIO.md`.
- Test protocol: `/summon lothlorien:deer`, approach (flight 10 blocks, 5 sneaking), corn lure, `/scriptevent lothlorien:harmony -40` for Hated flight 30, hurt one (herd bolts for 20 s), breeding with corn grain.
- **Shared wariness:** swan, squirrel and unicorn use the same table and the same `state_wild`/`state_alarmed` groups and alarm events as the deer (`WARY_TYPES` in `deer_rules.js`; `tools/wildlife_wariness.py`; the unicorn file comes from
  `tools/make_unicorn.py`, which imports the table). A Guest unicorn is fled from like an Uneasy player (13/6); only a Friend holding Elanor is exempt, and the Elanor lure is its own group `lure`, added at spawn.
  Animals saved by a build before LM-01 carry no flight group and stay fearless until the first alarm (owner 2026-11-11: no migration).
