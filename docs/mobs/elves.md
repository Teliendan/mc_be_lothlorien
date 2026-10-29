# Civilian Elves (M1: done, accepted in game 2026-10-10)

Milestone M1 of `docs/design/elven_inhabitants.md`, built in commits 30e1eb1, 5631c22, 6f79109, 7b57536, 6b97311. Passes `.\mods verify lothlorien` (verifier, `tests/run.mjs` incl. glue tests, `node tools/village_sim.mjs 300 1`).
Art generator: `tools/make_elves.py` (`--sheet` writes review sheets to `temp/elves/`).

One entity `lothlorien:elf`, profession = `minecraft:variant` = `query.variant`: 0 gardener, 1 healer, 2 woodwright, 3 lamplighter, 4 loremaster
(`PROFESSIONS` in `scripts/elf_rules.js`, a test keeps it equal to `make_elves.py`). Profession events `lothlorien:as_<profession>` (idempotent: each removes the
other four groups); `minecraft:entity_spawned` picks one at random when no profession is set yet (the egg).

## Final design (commits 30e1eb1 base, 5631c22 leads/healer, 6f79109 healer roam)

All verified in game by the owner on 2026-10-10 unless marked otherwise.

- **Models:** accessory cubes that would z-fight (woodwright belt; healer cuffs, sash; lamplighter epaulets, collar; loremaster cuffs, mantle, cord) have `inflate` 0.25 in `tools/make_elves.py`. A test (`elf geometry: no visible coplanar same-facing faces`) finds same-plane overlaps; the only exemption is the hair cap's bottom face. Verified: no flicker.
- **Leads:** every elf is leashable (`presets` soft 4 / hard 6 / max 10). Base components hold `minecraft:home {}`; the radius lives in the radius groups `home_near` 10, `home_lore` 6, `healer_day` 64, `healer_night` 10 (`elf_rules.js` `HOME_RADIUS`, `RADIUS_GROUPS`). `lothlorien:leashed` removes all radius groups; `on_unleash` fires `lothlorien:rehome` (`set_home_position` + the profession's radius group). `elven_warden.js` (elf section) records the move: entity property `lothlorien:home` = floored feet cell, `lothlorien:moved` = true. Verified: lead, release and re-home work.
  The village record `lothlorien:village_homes` is NOT rewritten; **a home step (M7) must treat an elf with `lothlorien:moved` as living at its own `lothlorien:home`.**
- **Healer (owner: own tree, 64 by day, 10 from dusk):** `healer_day` (radius 64, `environment_sensor` `is_daytime` false -> `lothlorien:healer_dusk`) and `healer_night` (radius 10, `is_daytime` true -> `lothlorien:healer_dawn`). The radius is a fence, not a drive, so `healer_day` adds its own `random_stroll` (priority 6, speed 0.6, xz 32, y 4) and `follow_range` 64; `healer_night` repeats the base stroll (8 / 3) and keeps `follow_range` 64 for the walk home. Roam sim on the real pieces: 8 / 3 / 16 reached another tree in 0-80 % of the first 40 strolls, 32 / 4 / 64 in 89-100 %. Values in `elf_rules.js` `STROLL`, `HEALER_ROAM`; no other profession has a stroll or reach override (test). Verified: healers cross bridges by day and return from dusk.
- **Debug:** the `/scriptevent lothlorien:elf home|rehome` command was removed (2026-10-29 debug cleanup). Each radius group still carries `minecraft:mark_variant` 1 home_near, 2 home_lore, 3 healer_day, 4 healer_night (visible in an entity dump; no marker on a lead); the recorded home cell is the `lothlorien:home` dynamic property.
- **Second healer:** a village with at least `HEALER2_MIN_TREES` 6 outer trees gets a second healer on a leftover home post (room first, then farthest from healer 1, then x, z), never on a reserve; sim 241/300 villages.
- **Harmony everywhere:** `elf_fight`, `elf_kill`, `warden_fight`, `warden_kill` count anywhere in the world (`harmony.js` `EVERYWHERE_DEEDS`); other deeds keep the inside-the-forest rule. Verified.
- **Planner speed:** see `docs/TECHNICAL_NOTES.md` "Elven village" (loop planner, timing log, `START_DELAY_TICKS` 5, time-boxed job driver).
- **Village polish** (commits 5631c22, 7b57536, 6b97311; see TECHNICAL_NOTES "Elven village"): rope foot, crowns fit their box, living pillars and planner root flares verified in game. Not yet seen: the pillar ivy start fix of 6b97311 (decoration leaves cleared ground to ground+4, low twigs removed).

## Owner decisions (2026-10-10)

- Hit by a player: panic; flee monsters within 6 blocks. Wardens defend elves: the hitter carries tag `lothlorien_elf_foe` for 60 s (after the LAST hit); wardens target the tag and warden arrows stop being shielded from that player.
- Harmony: 1 per fight (first hit after 60 s without one) + 6 per kill, like a warden. Night: no change. No fall damage, and avoid the rope cells.
- Generated names are locale-only: the planner assigns no personal `nameTag`. Players may use native name tags (`nameable` and shop/dialog handoff). One random spawn egg, `/summon lothlorien:elf ~ ~ ~ ~ ~ lothlorien:as_<profession>` (the rotation `~ ~` is required before an event).
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
88 % of the assigned trees have a 5x5 free square. `elven_warden.js` (elf section; the standalone `elf.js` was merged in because Defender flagged the small file as a false positive) handles the hurt-by-player case only (fight cost via `recordElfFight`, foe tag with a per-player token timer, stale tag removed on first join).

## Design sheet (checklist rows)

Closest vanilla analogues: `villager_v2` (1.26.20) and `wandering_trader`, without their villager-only parts. Audit (`audit_mob.py`): the `[..]` / `[--]` rows below are intended decisions.

| Row | Decision |
| --- | --- |
| A Identity | `lothlorien:elf`, family `lothlorien_elf` + `wandering_trader` + `mob`, name "Elf" (one name for all professions; profession titles `lothlorien.elf.profession.<p>` are in the catalog for M2). Egg "Elf Spawn Egg", one random profession, colours in the client entity. 0.6 x 1.95, health 20, movement 0.3 (below the template-mob threshold 0.5). Summonable and spawnable. |
| B Spawning | No spawn rule (`[..]`): only the village planner, egg, `/summon`. Persistent, no `minecraft:despawn`, no `spawn_rules/elf.json` (a test checks both). |
| C Body | Walk navigation, avoid water and damage blocks, passes doors, does not open them, avoids the two rope blocks (`blocks_to_avoid` with `name`; vanilla goat uses `name` for powder snow, not yet seen working with custom blocks). Floats, jumps, breathes, lava hurts. `damage_sensor`: fall damage off. Pushable. |
| D Behaviour | float 0, panic 1 (x1.25), avoid monsters except endermen within 6 (x1.0 / x1.25), move towards home 5, stroll 6 (x0.6, 8 / 3), look at player 7, look around 8. Home radius per radius group: Loremaster 6, others 10, healer 64 by day / 10 from dusk. Healer by day: stroll 32 / 4 and follow_range 64 (night: stroll 8 / 3, follow_range 64). |
| E Interaction | Lead/re-home and name tags work. M2/M3 provide localized Loremaster lessons/requests and native shops/deliveries. No tempt, breeding, babies, taming or riding. M4 healer: injured elves/wardens/self get Regeneration II within 8 blocks; injured Harmony Friends get I within 6, clear sight, 3-second grants, no cooldown. Finite arm raise and green sparkles; owner accepted 2026-10-11 (bc1da69), see [M4 regression checklist](../M4_HEALER_TEST.md). |
| F Rewards | No loot, no XP (`[..]`, `[--]` experience_reward). Killing costs Harmony 6. |
| G Look and sound | Model, texture, animations, render controller from `make_elves.py` (seen in game, fine). **No sounds** (`[--]`): no `entity_sounds` entry, so the engine defaults play (player hurt / death, silent ambient), the same as the warden. Sounds are a later polish item. |

## Not yet verified / open

- Group16 approved/source fixes deployed2026-10-20: [parity/CREATURES.md](../parity/CREATURES.md). Native cut handoff and matching prompts; ordinary idle-shears dialogs retained; wandering_trader civilian target family added. Existing lead/rehome, shops/healing and fixed professions retained; nine runners passed, native game acceptance pending.
- The pillar ivy start fix (6b97311): deployed, not yet seen in game.
- Whether Bedrock's stroll picks only standable targets or any (affects how far the healer wanders; behaviour looked right in game).
- `blocks_to_avoid` with `{ "name": ... }` on custom blocks (rope); walking speed 0.3 x 0.6.
- A fallen elf lives on the ground for good. Home buildings, and whether 3x3 / 4x4 sites (node_e; node_a, node_d, tower_c) are enough: M3/M7.

## Art (looks stage, 2026-10-08)

- One geometry + one texture per profession (`geometry.lothlorien.elf_<p>`, `textures/entity/elf/<p>.png`, 64x64 or 64x96); render controller
  indexes `Array.geos[query.variant]` / `Array.skins[query.variant]`. Same head, skin, 1.95 block height and ramps as the Elven Warden.
- Hair is a 9x9x9 cap on the `hat` bone with a window onto the face (alpha test), pointed ears are tilted sub-bones, long hair is a cube on
  bone `hair` (sways). Robes/coats are stepped skirts on bone `robe` (sways with the stride), lantern swings on bone `lantern`.
- Accent per profession: gardener moss + flower wreath + apron/braid; healer pale green-silver robe + blue sash + satchel; woodwright
  forest brown + leather apron/tool belt + auburn ponytail; lamplighter twilight-blue coat + silver trim + lantern; loremaster grey robe +
  dark-green mantle/stole + gold hem + scroll case.
- Open: game check of face mapping and robe/leg clipping while walking; hair/face/gender variants as data later.
