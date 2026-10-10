# Civilian Elves (looks stage)

Status 2026-10-08: model + texture + client entity + minimal BP stub written, software preview only, NOT seen in game, not deployed.
Generator: `tools/make_elves.py` (`--sheet` writes review sheets to `temp/elves/`). One entity `lothlorien:elf`, profession = `query.variant`:
0 gardener, 1 healer, 2 woodwright, 3 lamplighter, 4 loremaster. Events `lothlorien:as_<profession>`; `minecraft:entity_spawned` picks at random.

- One geometry + one texture per profession (`geometry.lothlorien.elf_<p>`, `textures/entity/elf/<p>.png`, 64x64 or 64x96); render controller
  indexes `Array.geos[query.variant]` / `Array.skins[query.variant]`. Same head, skin, 1.95 block height and ramps as the Elven Warden.
- Hair is a 9x9x9 cap on the `hat` bone with a window onto the face (alpha test), pointed ears are tilted sub-bones, long hair is a cube on
  bone `hair` (sways). Robes/coats are stepped skirts on bone `robe` (sways with the stride), lantern swings on bone `lantern`.
- Accent per profession: gardener moss + flower wreath + apron/braid; healer pale green-silver robe + blue sash + satchel; woodwright
  forest brown + leather apron/tool belt + auburn ponytail; lamplighter twilight-blue coat + silver trim + lantern; loremaster grey robe +
  dark-green mantle/stole + gold hem + scroll case.
- Open: game check of face mapping and robe/leg clipping while walking; names in lang files; hair/face/gender variants as data later.
