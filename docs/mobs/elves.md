# Civilian Elves (M1: built, NOT seen in game)

Status 2026-10-10: milestone M1 of `docs/design/elven_inhabitants.md` is built and passes `.\mods verify lothlorien` (verifier, `tests/run.mjs` incl. glue tests,
`node tools/village_sim.mjs 300 1`). **Nothing here has been seen in game and it is not deployed.** Owner checklist: `temp/elven_inhabitants/m1_plan.md`, section "In-game checklist for the owner".
Plan and rationale: `temp/elven_inhabitants/m1_plan.md` (rev. 2). Art generator: `tools/make_elves.py` (`--sheet` writes review sheets to `temp/elves/`).

One entity `lothlorien:elf`, profession = `minecraft:variant` = `query.variant`: 0 gardener, 1 healer, 2 woodwright, 3 lamplighter, 4 loremaster
(`PROFESSIONS` in `scripts/elf_rules.js`, a test keeps it equal to `make_elves.py`). Profession events `lothlorien:as_<profession>` (idempotent: each removes the
other four groups); `minecraft:entity_spawned` picks one at random when no profession is set yet (the egg).

## Owner decisions (2026-10-10)

- Hit by a player: panic; flee monsters within 6 blocks. Wardens defend elves: the hitter carries tag `lothlorien_elf_foe` for 60 s (after the LAST hit); wardens target the tag and warden arrows stop being shielded from that player.
- Harmony: 1 per fight (first hit after 60 s without one) + 6 per kill, like a warden. Night: no change. No fall damage, and avoid the rope cells.
- Names lang-only (no name tag), one random spawn egg, `/summon` with the `as_<profession>` events.
- Population: every new village gets all five professions: the Loremaster on the central tree, healer / gardener / woodwright / lamplighter each on an outer tree of their own
  (warden trees allowed, post at least 3 cells from the warden). Fallback F1: with fewer than 4 outer trees the leftover professions stand on reserve posts on the central tree.
  Homes (buildings) are a later milestone; M1 only records which tree belongs to which profession. Existing villages get no elves.
- Using an elf does nothing yet (no trade, interact, inventory, lead, breeding, riding, egg interaction, loot, XP).

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
| D Behaviour | float 0, panic 1 (x1.25), avoid monsters except endermen within 6 (x1.0 / x1.25), move towards home 5, stroll 6 (x0.6, 8 / 3), look at player 7, look around 8. Home radius per profession group: Loremaster 6, others 10. |
| E Interaction | None. No tempt (`[--]`), lead (`[--]`), breeding, baby, taming, riding, interact (`[..]`). Name tags work (`nameable`). Trades, dialogs, Renown come with M2. |
| F Rewards | No loot, no XP (`[..]`, `[--]` experience_reward). Killing costs Harmony 6. |
| G Look and sound | Model, texture, animations, render controller from `make_elves.py` (never seen in game). **No sounds** (`[--]`): no `entity_sounds` entry, so the engine defaults play (player hurt / death, silent ambient), the same as the warden. Sounds are a later polish item. |

## Open / to verify in game

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
