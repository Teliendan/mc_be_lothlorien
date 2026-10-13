# Section 9 / M6: Great Mallorn watch camps

2026-10-13; target Bedrock 1.26.52 / stable Script API 2.8.0.
Initial commit: `14a71b7` (`Polish Great Mallorn lookouts as elven watch camps`).
Correction commit: `Shelter watch-camp sleepers and correct indented banner edges`.
Status: owner accepted the camp overall 2026-10-13; bed orientation and indented
banner edges corrected and awaiting retest. Individual seating/drop/shield results
were not supplied.

The owner requested section **9**, not a separate M9. This is the existing M6 scope.
Final values and design: [elven_inhabitants.md section 9](design/elven_inhabitants.md).

Rebuild: `node tools/build_structures.mjs` from this mod. This also regenerates
`loot_tables/chests/mallorn_flet.json`; tune it in `tools/watch_camp_rules.mjs`.
The entry-point guard resolves junctions so this command works from `C:\mcmods`.

## Offline evidence

`tests/watch_camp.mjs`, included by `tests/run.mjs`, checks both shipped lookouts:
complete, supported native bed pairs; cushion support and green/light-gray variant
values; two persistent vulnerable bow wardens; six-layer native banner NBT;
four lanterns and nonzero block light on all open deck cells; connected routes
from the rope to beds, cushions, guards and chest; exact generator/shipped-byte
agreement; unfurnished plain giants; owner-tuned supply/shield loot and 50% chance.
Bed heads must touch the trunk; the banner must use `bts`/`tts` for its three-tooth
edges. The owner's source loot was snapshotted before rebuilding and compared
afterwards: all entries, rolls, functions, weights and counts match exactly.
M5's shared arrow weight is now 6, retaining stacks of 4-8.

`mods verify lothlorien` passes: zero errors/warnings, 15 existing documented
exceptions. A conservative light model and NBT assertions do not establish live
rendering, native seating, sleeping, pattern application, or performance.

## Owner game check

Leave and re-enter after deployment. **Worldgen changes need a new world** for
a clean test; existing trees do not receive furnishings. Newly grown Great Mallorn
nuts also place the furnished lookout templates in existing worlds.

1. Find a new lookout, or place a template in an empty test area:
   `/structure load lothlorien:mallorn_round_05 ~ ~ ~`, then test `_07` too.
   These are 40x54x40 structures; keep the test area clear. To exercise real jigsaw
   rotation, use `/place structure lothlorien:giant_mallorn` (some rolls are plain).
2. Climb the rope, walk around the trunk, open the chest and reach the rest corner.
   Check that the living tree remains the focus and the lamps do not feel excessive.
3. See two guards; reload the world and confirm they persist and move at normal
   warden speed. Their existing replacement log may appear once per new tree.
4. Sit on both cushions. Confirm green/light-gray colors, correct deck height and
   normal dismounting. Break one: it should drop normally, not be invulnerable.
   Confirm survival placement of its dropped item works too.
5. Sleep on a straw bed at night: skip the night, retain the previous spawn point,
   and consume that bed. This one-use behavior is vanilla, not a mod respawn loop.
6. Compare the banner to the silver design in `docs/design/banner.png` (the original
   `banners.txt` also describes the correct pattern). Check three small triangles
   along both indented edges, rather than one large triangle. Bed heads should
   rest against the west trunk face, sideways to the north entry, with feet west.
   Break/re-place it and check that the pattern survives. Repeat on a rotated tree.
7. Generate several samples with `/loot spawn ~ ~1 ~ loot "chests/mallorn_flet"`.
   Roughly 1 in 2 rolls should have a green shield with the same silver-bordered
   six-layer design. Equip it in each hand, block, drop and pick it up. This native
   shield-function behavior remains pending despite offline schema checks.
8. At night inspect light, fences and furniture in the intended graphics mode;
   check the Content Log for rejected block states, entities or loot functions.

Native sources: [26.50 changelog](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound),
[Mojang block metadata](https://github.com/Mojang/bedrock-samples/blob/main/metadata/vanilladata_modules/mojang-blocks.json),
[banner function and dye names](https://feedback.minecraft.net/hc/en-us/articles/360052592091-Minecraft-1-16-100-Bedrock).
Installed camp Java-NBT templates were read from the read-only Store installation;
the reference mirror's copies are zero-length placeholders. Scratch layout previews
and research are in `temp/watch_camp/` until owner acceptance; then remove them under
the workspace cleanup rule.
