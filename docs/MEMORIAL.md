# Leaf memorial

Accepted by the owner on 2026-10-16, including the corrected straight pillar:
"It's OK now." Third standalone woodland place, after the root shrine and garden.
Target Bedrock 1.26.52 / Script API 2.8.0. Existing blocks only.
Implementation commit: `Add accepted leaf memorials at garden frequency`.

## Final design and decisions

A 9-wide, 11-long silver Mallorn leaf deck, with a short golden stem at its
rounded heel. Its pointed end, tapered sides and one-block heartwood vein define
the shape. The full plank floor stands one block above the ground; bottom slabs
form a half-height rim so the deck can be approached without jumping.

A straight four-log silver Mallorn pillar stands near the heel, with one small
golden slab cap. The owner rejected horizontal arms because they made a Christian
cross silhouette. Silver bark is intentional: the existing
stripped-log texture is honey-coloured. The main green/lime banner hangs on two
opposite faces, with its existing light-gray border changed to white. Two short
silver stair benches face inward. Three repeated soil pockets each contain two
Niphredil and one lily of the valley; plants stand on full grass blocks.

Only the deck, a one-cell ground apron and monument clearance are authored;
unused template corners and the surrounding canopy remain structure void.
No residents, planted saplings, loot, scripts or new art assets. Accepted iteration
previews were removed; the generator retains only this final design.

## Natural generation (accepted 2026-10-28)

The memorial is a native constrained feature like the garden: `features/memorial_feature.json` places
`lothlorien:memorial_leaf_feature_01` (11 x 9 x 15, offset [5, 3, 7]: deck, one-cell apron, no shoulder, soil 3 deep,
no anchor), `adjustment_radius 0`, `ground_level 3` (the deck row replaces the terrain top). It shares the garden's
site lattice and constraints (`FLOWER_GARDEN.md`, `SITES` in `tools/site_feature.mjs`): each candidate picks garden or
memorial 1:1, chance 2/5. Centre 7 keeps the rotated 15-long side inside the chunk. Mod commits `e05926f`, `4d79dad`,
`40f8a72`, `90ced4b`.

Owner decisions 2026-10-28: memorials as dense as gardens (~24 per km2); no memorials in water (several jigsaw
memorials stood in lakes); the leaf lies level in the ground. Raising the deck 1 block was tried and rejected (the slab
rim read as steps). The trench came from the one-cell apron, grass one row below the deck; now the rim is full planks
and the apron is grass at deck level (jigsaw and feature templates both).

The jigsaw (`structures/memorial.json`, pool `memorial`, template `memorial_leaf_01`) is kept for
`/place structure` only; its set `memorial_sites` was removed.

**Sound source.** A feature does not place the template's `memorial_sound` entity (owner, `/testfor`, 2026-10-28). So
the top pillar log of the feature template is `lothlorien:memorial_seed`, a look-alike of the upright Mallorn log (same
components, hidden from menus) with a one-shot `minecraft:tick` [10, 20]. `scripts/memorial_seed.js` spawns the sound
1.6 above it (the jigsaw template's position) and turns it into the plain log. Blocks tick only within simulation
distance, so this happens when a player first comes near; nothing visible changes. Owner accepted a script here;
seen working in game (owner, 2026-10-28).

Engine note: `/place feature lothlorien:memorial_feature` answered with a syntax error while nothing placed the
feature; once a rule used it, the command knew it.

### Missing-memorial investigation (2026-10-24)

Bedrock 1.26.52, saved-world evidence from the owner's `Test` world: an intact
memorial is centred at X -1152, deck Y 104, Z 80. All 77 distinctive solid blocks
(deck, pillar, banners, benches and flowers) match the shipped template after
rotation; the buried jigsaw is dirt. Nearby terrain and leaves may obscure it
from above. The same saved snapshot contains three intact garden matches.
This confirms a placed memorial, not the generation date or a large-sample ratio.

Source and deployed definitions retain the intended equal weights (1 garden :
1 memorial) on the shared grid. The latest height correction lowered both
definitions by five blocks; no memorial-specific registration or template fault
was found. Scoped `flower-garden` and `memorial` verification passed: 0 errors,
0 warnings, 15 existing documented exceptions. Owner accepted that this was
probably normal variation; no pack change was made for this investigation.

## Build and verification

From `C:\mcmods\mods\lothlorien`:

```powershell
node tools/build_memorial.mjs
```

Writes `lothlorien:memorial_leaf_01`, a 15 x 12 x 18 template with offset [7, 6, 8], its jigsaw
definition and pool, and the feature copy (template + feature JSON); the shared site rule comes from
`build_flower_garden.mjs`. Optional `--preview` renders four textured
views into disposable `temp/memorial/` for future changes.

After deployment, leave and re-enter the world. On level ground, place a fresh
copy a few blocks south (+Z) of the player:

```mcfunction
/structure load lothlorien:memorial_leaf_01 ~-7 ~-6 ~2
```

Manual loading retains the buried jigsaw anchor. `/place structure lothlorien:memorial`
uses the natural definition and consumes it to dirt in a world that recognises
the new registration. Existing placed copies retain their saved blocks.

`tests/memorial.mjs` runs in the standard mod suite: four connected approaches,
bench access, supported soil/flowers/seats, native six-layer banner data and
hanging clearance, no clipped template cells, preserved void, deterministic
output and equality with the shipped binary, serialized ground anchor, memorial-only set density, giant biome rules, independent salts, and the feature
copy (no anchor, entity saved, centred box, constraints equal to the garden, no rule).
Reusable placement evidence: workspace knowledge commit `041d7c5`,
`Document additive structure density from random-spread grids`.

Final full `mods verify lothlorien` passed on 2026-10-16: 0 errors, 0 warnings,
15 existing documented exceptions. Deployment then ran the shared quick checks,
copied the memorial template and its three worldgen files, and confirmed both
BP and RP in sync with `mods status lothlorien`. Natural terrain/distribution
has offline configuration evidence only; the accepted art was checked in game.
