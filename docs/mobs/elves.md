# Civilian Elves (M1: built, NOT seen in game)

Status 2026-10-10: milestone M1 of `docs/design/elven_inhabitants.md` is built and passes `.\mods verify lothlorien` (verifier, `tests/run.mjs` incl. glue tests,
`node tools/village_sim.mjs 300 1`). **Nothing here has been seen in game** (M1 and the 2026-10-10 fix round below are deployed). Owner checklist: `temp/elven_inhabitants/m1_plan.md`, section "In-game checklist for the owner".
Plan and rationale: `temp/elven_inhabitants/m1_plan.md` (rev. 2). Art generator: `tools/make_elves.py` (`--sheet` writes review sheets to `temp/elves/`).

One entity `lothlorien:elf`, profession = `minecraft:variant` = `query.variant`: 0 gardener, 1 healer, 2 woodwright, 3 lamplighter, 4 loremaster
(`PROFESSIONS` in `scripts/elf_rules.js`, a test keeps it equal to `make_elves.py`). Profession events `lothlorien:as_<profession>` (idempotent: each removes the
other four groups); `minecraft:entity_spawned` picks one at random when no profession is set yet (the egg).

## Fix round after the owner test of 30e1eb1 (2026-10-10, built, NOT seen in game, deployed)

- **Models:** z-fighting accessory cubes (woodwright belt; healer cuffs and sash; lamplighter epaulets and collar; loremaster cuffs, mantle, cord) got `inflate` 0.25 in `tools/make_elves.py` (UV layout and textures unchanged, only `elf.geo.json`).
  A test (`elf geometry: no visible coplanar same-facing faces`) finds same-plane overlapping faces at rest; the only exemption is the hair cap's bottom face, which is transparent by design.
- **Leads:** every elf is leashable (`presets` soft 4 / hard 6 / max 10). Base components hold `minecraft:home {}` (no restriction); the radius lives in the radius groups `home_near` 10, `home_lore` 6, `healer_day` 64, `healer_night` 10
  (`elf_rules.js` `HOME_RADIUS`, `RADIUS_GROUPS`). `lothlorien:leashed` removes all radius groups, so the lead pulls freely and `move_towards_home_restriction` has nothing to enforce. `on_unleash` (any release: untie, cut, break by distance) fires
  `lothlorien:rehome`: `set_home_position` (first and last in the sequence) + the radius group of the profession. `elf.js` records the move on `dataDrivenEntityTrigger`: entity property `lothlorien:home` = the floored feet cell, `lothlorien:moved` = true.
  The village record `lothlorien:village_homes` is NOT rewritten; **a home step (M7) must treat an elf with `lothlorien:moved` as living at its own `lothlorien:home`.**
  [U] whether `set_home_position` works for a custom entity, whether a group swap keeps the anchor, whether `on_unleash` reaches `dataDrivenEntityTrigger`.
  Fallback if `set_home_position` does nothing: an invisible per-elf anchor entity with `follow_target_leader` (white deer beacon pattern), only on the owner's request.
- **Debug:** `/scriptevent lothlorien:elf home` (nearest elf within 16 blocks: profession, recorded home, distance, on a lead or not), `/scriptevent lothlorien:elf rehome` (re-homes it where it stands, without a lead). Messages in the catalog, nine locales.
- **Healer (owner: own tree, 64 by day, 10 from dusk; a healer moved by a lead also roams 64 by day wherever its new home is):** `healer_day` (radius 64, `environment_sensor` `is_daytime` false -> `lothlorien:healer_dusk`) and `healer_night` (radius 10, `is_daytime`
  true -> `lothlorien:healer_dawn`); each sensor only lives in its own group. One home position per entity, so the "village by day" is a 64 radius around the own tree (the healer's tree is the one nearest the Loremaster). [U] whether the dusk swap keeps the anchor.
- **Second healer:** a village with at least `HEALER2_MIN_TREES` 6 outer trees gets a second healer on a leftover home post (room first, then farthest from healer 1, then x, z), never on a reserve; sim 241/300 villages, all five professions in 300/300, `loremaster + 5 on own trees` in the log.
- **Harmony everywhere:** `elf_fight`, `elf_kill`, `warden_fight`, `warden_kill` count anywhere in the world (`harmony.js` `EVERYWHERE_DEEDS`, `deedCounts`); all other deeds keep the inside-the-forest rule. Band-change chat lines and the deed hint also appear outside.
- **Planner speed:** see `docs/TECHNICAL_NOTES.md` "Elven village", loop planner (timing log, `START_DELAY_TICKS` 5, time-boxed job driver, numeric memo keys).

## Healer roam fix (owner test of 5631c22, 2026-10-10: "healers seem to stay on their platform"; built, NOT seen in game, deployed)

- **Cause [C, sim + data; no in-game proof]:** the radius is a fence, not a drive. The healer had the base `random_stroll` (xz 8, y 3) like every elf, so
  `healer_day`'s radius 64 only allowed far roaming; nothing walked it far. A deck is left only through a 3-wide bridge mouth and a 7..15 bridge, and a
  stroll of a few blocks is a slow random walk that mostly turns back. Roam sim on the real pieces (`temp/elf_roam/roam_sim.mjs`, scratch; 40 villages x 6 runs;
  S = only standable targets, A = any target with a partial path, which one Bedrock uses is [U]):

  | stroll (xz / y / follow_range) | radius | another tree in the first 40 strolls | trees visited per day (90 strolls) | median farthest distance |
  |---|---|---|---|---|
  | 8 / 3 / 16 (was) | 10 | 0 % | 0.0 | 9 |
  | 8 / 3 / 16 (was) | 64 | 36 % (S) / 80 % (A) | 0.8 / 1.6 | 28 / 36 |
  | 32 / 4 / 16 | 64 | 16 % (S) | 0.3 | 14 |
  | **32 / 4 / 64 (now)** | 64 | **89 % (S) / 100 % (A)** | **2.9 / 6.1** | **54 / 62** |

  The row 32 / 4 / 16 shows why the reach matters too: `minecraft:follow_range` bounds the path search (engine default 16 [D]); a far target needs a
  long path. Ruled out from the data: the dusk/dawn swap (sensor + events are vanilla bee pattern, a test pins them), goal priorities (stroll 6 is above
  look 7/8; panic/avoid only fire on a hit or a monster), rope avoidance (rope only on the central tree), slabs (0.5 steps, no jump). Not ruled out [U]:
  whether the healer was in `healer_day` at all (now visible with the debug line below).
- **Fix (data):** `healer_day` adds its own `random_stroll` (priority 6, speed 0.6, **xz 32, y 4**: one stroll can reach past the longest bridge; y covers a
  rise-2 arch and stays below the crowns, 6 above the deck) and `follow_range` 64 (iron golem pattern: xz 16 + 64; villager 128). `healer_night` repeats the
  base stroll (8 / 3) explicitly (not relying on a removed group giving the base component back) and keeps `follow_range` 64 for the dusk walk home from
  up to 64 away. Values in `elf_rules.js` `STROLL`, `HEALER_ROAM`; other professions unchanged (a test checks no other group has a stroll or reach).
- **Debug:** every radius group carries `minecraft:mark_variant` (home_near 1, home_lore 2, healer_day 3, healer_night 4; `RADIUS_MARK`, no client use).
  `/scriptevent lothlorien:elf home` now prints a second line: `radius group healer_day (64 blocks)`, or `none (-)` without a radius (on a lead).
- **Re-test:** by day follow a healer 3-5 minutes: it should cross bridges to other trees (`home` line: distance > 15, group `healer_day`); `/time set 13000`:
  group turns `healer_night` and it walks back to its tree within about a minute. Elves spawned before this change get the new values on reload (same groups).

## Owner decisions (2026-10-10)

- Hit by a player: panic; flee monsters within 6 blocks. Wardens defend elves: the hitter carries tag `lothlorien_elf_foe` for 60 s (after the LAST hit); wardens target the tag and warden arrows stop being shielded from that player.
- Harmony: 1 per fight (first hit after 60 s without one) + 6 per kill, like a warden. Night: no change. No fall damage, and avoid the rope cells.
- Names lang-only (no name tag), one random spawn egg, `/summon lothlorien:elf ~ ~ ~ ~ ~ lothlorien:as_<profession>` (the rotation `~ ~` is required before an event).
- Population: every new village gets all five professions: the Loremaster on the central tree, healer / gardener / woodwright / lamplighter each on an outer tree of their own
  (warden trees allowed, post at least 3 cells from the warden). Fallback F1: with fewer than 4 outer trees the leftover professions stand on reserve posts on the central tree.
  Homes (buildings) are a later milestone; M1 only records which tree belongs to which profession. Existing villages get no elves.
- Using an elf does nothing yet (no trade, interact, inventory, breeding, riding, egg interaction, loot, XP). Exception (fix round): a lead can be put on an elf and the released elf takes a new home where it was released.

## Placement (how a village gets its elves)

A jigsaw piece cannot know its profession, so tree pieces carry invisible **`lothlorien:elf_post`** entities (`entities/elf_post.json`; kind via definitions group `lothlorien:post_<loremaster|reserve|home>`
that adds the family `elf_post_<kind>`): `central_mallorn_01` 1 loremaster + 4 reserve posts, every `combo_*` piece 1 home post (`build_village.mjs` `postCells`). The village planner run
(`loop_marker.js` `planVillageAt`, own `try`, after the links and before the markers go) calls `scripts/elf_village.js` `populateVillage`:
1. read all posts in the discovered rectangle; kind from `getTypeFamilies()` (no kind = home); `site` = `homeSite` on live blocks;
2. `assignHomes` (pure, `elf_rules.js`): outer posts sorted by room first (free square >= `HOME_MIN` 5), then distance to the Loremaster, then x, z; professions in `HOME_ORDER` healer, gardener, woodwright, lamplighter; leftover professions go to reserve posts (nearest to the Loremaster first);
3. spawn one elf per post with `spawnEntity(ELF_ID, ..., { spawnEvent: lothlorien:as_<p> })` (script-spawned: the elves get their JSON attributes, no template-mob default trap), set the entity property `lothlorien:home` = `"x,y,z"`;
4. write the record to the world property `lothlorien:village_homes` (JSON list, 64 max): `{ rect, loremaster: [x,y,z] | null, homes: [{ p, x, y, z, site }] }` where `site` = `{ x0, z0, k }` or `null` on a reserve;
5. remove all posts (a post whose elf could not be spawned stays); log `[lothlorien] elves: village at x,z: loremaster + 4 on own trees (0 on reserves)`.

A re-run finds no posts and spawns nothing (idempotent). Village simulator (300 seeds): all five in 300/300, four on own trees in 94 %, reserves used on average 0.11 per village (max 4),
88 % of the assigned trees have a 5x5 free square. `elf.js` handles the hurt-by-player case only (fight cost via `recordElfFight`, foe tag with a per-player token timer, stale tag removed on first join).

## Design sheet (checklist rows)

Closest vanilla analogues: `villager_v2` (1.26.20) and `wandering_trader`, without their villager-only parts. Audit (`audit_mob.py`): the `[..]` / `[--]` rows below are intended decisions.

| Row | Decision |
| --- | --- |
| A Identity | `lothlorien:elf`, family `lothlorien_elf` + `mob`, name "Elf" (one name for all professions; profession titles `lothlorien.elf.profession.<p>` are in the catalog for M2). Egg "Elf Spawn Egg", one random profession, colours in the client entity. 0.6 x 1.95, health 20, movement 0.3 (below the template-mob threshold 0.5). Summonable and spawnable. |
| B Spawning | No spawn rule (`[..]`): only the village planner, egg, `/summon`. Persistent, no `minecraft:despawn`, no `spawn_rules/elf.json` (a test checks both). |
| C Body | Walk navigation, avoid water and damage blocks, passes doors, does not open them, avoids the two rope blocks (`blocks_to_avoid` with `name`; vanilla goat uses `name` for powder snow, not yet seen working with custom blocks). Floats, jumps, breathes, lava hurts. `damage_sensor`: fall damage off. Pushable. |
| D Behaviour | float 0, panic 1 (x1.25), avoid monsters except endermen within 6 (x1.0 / x1.25), move towards home 5, stroll 6 (x0.6, 8 / 3), look at player 7, look around 8. Home radius per radius group: Loremaster 6, others 10, healer 64 by day / 10 from dusk. Healer by day: stroll 32 / 4 and follow_range 64 (night: stroll 8 / 3, follow_range 64). |
| E Interaction | Lead only (leashable, a release re-homes the elf). No tempt (`[--]`), breeding, baby, taming, riding, interact (`[..]`). Name tags work (`nameable`). Trades, dialogs, Renown come with M2. |
| F Rewards | No loot, no XP (`[..]`, `[--]` experience_reward). Killing costs Harmony 6. |
| G Look and sound | Model, texture, animations, render controller from `make_elves.py` (never seen in game). **No sounds** (`[--]`): no `entity_sounds` entry, so the engine defaults play (player hurt / death, silent ambient), the same as the warden. Sounds are a later polish item. |

## Open / to verify in game

- Fix round: no flicker on the five models (also from above); lead, release and re-home (see the checklist in the fix plan `temp/elven_inhabitants/m1_fix_plan.md`); second healer; Harmony outside the forest.
- Healer roam fix: crosses bridges by day, walks home from dusk (re-test above); whether Bedrock's stroll picks only standable targets (sim S) or any (sim A); whether a far stroll looks natural or makes the healer hug rails.

- Everything: content log (schema errors for `lothlorien:elf` / `elf_post`), the spawn events, whether `entity_spawned` also runs after a `spawnEvent` (the events are idempotent), whether `minecraft:home` from a group is set at the spawn point.
- `blocks_to_avoid` with `{ "name": ... }` on custom blocks; walking speed 0.3 x 0.6 (measure with `/scriptevent lothlorien:speed`).
- Do `lothlorien:elf_post` entities in jigsaw pieces load with their definitions group (kind via `getTypeFamilies`)? Same question class as the village wardens, which do load (2026-10-08).
- A fallen elf lives on the ground for good. Home buildings, and whether 3x3 / 4x4 sites (node_e; node_a, node_d, tower_c) are enough: M3.

## Art (looks stage, 2026-10-08)

- One geometry + one texture per profession (`geometry.lothlorien.elf_<p>`, `textures/entity/elf/<p>.png`, 64x64 or 64x96); render controller
  indexes `Array.geos[query.variant]` / `Array.skins[query.variant]`. Same head, skin, 1.95 block height and ramps as the Elven Warden.
- Hair is a 9x9x9 cap on the `hat` bone with a window onto the face (alpha test), pointed ears are tilted sub-bones, long hair is a cube on
  bone `hair` (sways). Robes/coats are stepped skirts on bone `robe` (sways with the stride), lantern swings on bone `lantern`.
- Accent per profession: gardener moss + flower wreath + apron/braid; healer pale green-silver robe + blue sash + satchel; woodwright
  forest brown + leather apron/tool belt + auburn ponytail; lamplighter twilight-blue coat + silver trim + lantern; loremaster grey robe +
  dark-green mantle/stole + gold hem + scroll case.
- Open: game check of face mapping and robe/leg clipping while walking; hair/face/gender variants as data later.
