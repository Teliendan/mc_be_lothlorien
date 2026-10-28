# Garden feature test (TEST BUILD 2026-10-28, not accepted)

What is under test: the flower garden as a natural `structure_template_feature` (chance 1 on a 4 x 4 chunk lattice) and a
command-only memorial feature. Design: `FLOWER_GARDEN.md`, `MEMORIAL.md`; plan and simulation in workspace
`temp/garden-features/`. Worldgen needs a **new world**. Record results (game version, date, seed, owner-seen) in these docs.

## T0 Load

`.\mods deploy lothlorien` (done by the orchestrator), `.\mods status` shows in sync. New Creative world with cheats on, a note
of the seed. Read the content log on entry: any error on `flower_garden_feature`, `flower_garden_feature_rules` or
`memorial_feature` stops the test (suspects: `leveled.max_steepness`, `ground_level`, `rotate_around_center`, format 1.26.30,
allowlist ids, `scatter_chance 1/1`).

## T1 Command placement (same world)

Find Lothlorien with `/locate biome lothlorien:lothlorien`. Stand on the spot and run
`/place feature lothlorien:flower_garden_feature ~ ~ ~`, then `/place feature lothlorien:memorial_feature ~ ~ ~`:

- (a) flat grass: expected built. Record: does the garden grass / memorial deck sit level with the surrounding top (ground_level
  and `heightmap - 1` calibration, off by one?), is the box centred on your feet, does the facing vary over 4 spots. Open the
  barrel (loot), check bench and trapdoor facing and the banners.
- (b) **Memorial sound entity**: `/testfor @e[type=lothlorien:memorial_sound,r=12]`. Entity found = features place template
  entities, the memorial may become a feature. Not found = it stays a jigsaw.
- (c) on a lake surface (stand on a placed block or in a boat): expect a failure message, nothing written.
- (d) 1-step slope: expected built. (e) 2-3 step slope: expect refused for steep, built for the +-1 band
  (record the exact steps). (f) within 6 blocks of a Mallorn trunk: expect refused. (g) under a giant's crown (does `unburied`
  refuse a good site?). Note every command message. Also note a gap or cut at a chunk border (x or z a multiple of 16).

## T2 Natural, chance 1

New world. Garden candidates are the lattice chunks: chunk origin x and z multiples of 64, so the centre is at
**x = 64 i + 7 or 8, z = 64 j + 7 or 8** (i, j integers, negatives included). `/tp` to those points over the Lothlorien patch (fly
at y ~ 120, look down). For 20-30 points inside the biome record: garden / nothing, and for nothing the visible reason (water,
slope, tree, giant, village, unknown). On every built garden check: grass level with the surroundings, edge cuts, trees rooted
on the grass (accepted), flora in the aisles (look acceptable?), facings, the barrel.
Acceptance a = built / lattice points in the biome. Then the production chance is `8 / (81 a)` capped at 1
(`GARDEN_CHANCE` in `tools/flower_garden.mjs`).

**Also count memorials** seen on the way (and the area flown): the owner finds them too rare and wants to choose a new
`MEMORIAL_SITES` spacing/separation (`tools/memorial.mjs`, now 13 / 4, one per 169 chunks) after this test.

## T3 Jigsaw order

At lattice points on or next to a giant or village (`/locate structure lothlorien:giant_mallorn`, `lothlorien:elven_village`):
a garden cut through by roots or pieces means the jigsaw came later; a refused or absent garden with jigsaw blocks in the
footprint means the jigsaw came first.

## After the test

Set `GARDEN_CHANCE`, decide the memorial (feature or jigsaw) and its density, rebuild (`node tools/build_flower_garden.mjs`,
`node tools/build_memorial.mjs`), then clean up per the workspace rule and update the wiki records (deferred until acceptance).
