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

## Natural generation

The memorial stays a natural jigsaw (`structures/memorial.json`, pool `memorial`, 15 x 12 x 18 template
`memorial_leaf_01`, buried anchor, six soil layers, two shoulder rings) because it carries the
`memorial_sound` entity and it is unknown whether a feature places template entities.

**Since 2026-10-28 (TEST BUILD, not accepted)** it has its own set `lothlorien:memorial_sites`
(`structure_sets/memorial_sites.json`), replacing the shared `garden_sites` set now that gardens are a feature.
The shared set was spacing 9 / separation 3 (one site per 81 chunks, half memorials = one per 162 chunks).
Memorials alone: spacing 13 / separation 4 (one per 169 chunks, 4 % fewer; 12.7 would be exact; separation
below spacing / 2 as the engine requires). Constants `MEMORIAL_SITES.spacing` / `.separation` in
`tools/memorial.mjs` set it; the tests pin the density to within 6 % of the old one.

**Open follow-up (owner, 2026-10-28):** memorials already looked too rare in game. After the garden tests choose a
denser spacing/separation (count the memorials seen during T2, `GARDEN_FEATURE_TEST.md`). Not changed in this build.

### Command-only feature copy (test T1)

`features/memorial_feature.json` places `lothlorien:memorial_leaf_feature_01` (11 x 9 x 15, offset [5, 3, 7]):
deck, one-cell apron, no shoulder, soil 3 deep, no anchor, with the sound entity. Same constraints as the garden
(`tools/site_feature.mjs`), `adjustment_radius 0`, `ground_level 3` (the deck row, which replaces the terrain top).
**No feature rule**: it is never placed by worldgen. Run
`/place feature lothlorien:memorial_feature ~ ~ ~` on flat ground, then
`/testfor @e[type=lothlorien:memorial_sound,r=12]`: if the entity exists, features place template entities and the
memorial can become a feature (then give it a rule, centre extent `[7, 8]`). The jigsaw files stay until then.

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
definition and pool, the `memorial_sites` set, and the feature copy (template + feature JSON). Optional `--preview` renders four textured
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
