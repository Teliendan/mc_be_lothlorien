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

**Since 2026-10-21 (owner) gardens and memorials share one grid**: set `lothlorien:garden_sites`
(`structure_sets/garden_sites.json`, salt 794231583, spacing 9 / separation 3, linear), garden and memorial
weight 1 each, so the two never pair up; combined count about 11 % below the two old 12/4 grids. The paragraph
below is the earlier design.

Owner requested the same frequency as elven gardens on 2026-10-16. The memorial's
independent structure set uses spacing 12, separation 4, linear random spread
and salt 936184257. Gardens keep their existing spacing 12 / separation 4 / salt
794231583; Great Mallorns keep spacing 6 / separation 2 / salt 518204731 and
their existing pool. Each memorial grid cell attempts one memorial, giving the
same long-run attempt density as gardens, about one per four big-tree attempts.
This is not an exact quota per biome patch: terrain, biome edges and placement
success affect observed counts. Independent sets can place sites near each other.

The memorial uses the garden's Lothlorien biome filter, world-surface projection
and start height `-SKIRT.depth` (currently -6): encoded deck y 6 lands at terrain level,
with the foundation beneath it (owner correction, 2026-10-24). The former start -1
raised it five blocks. Offline checked for Bedrock 1.26.52; native placement pending. A buried central
jigsaw anchor becomes dirt during natural placement and preserves the accepted deck.
Six soil layers, a ragged shoulder and four free cells above the deck, as the garden
(`WORLDGEN_FIXES_2026-10-20.md`); it does not fit steep slopes. **Worldgen changes need a new world.**
Natural terrain/distribution review remains pending; the owner accepted the
manually placed structure, not natural counts.

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

Writes `lothlorien:memorial_leaf_01`, a 15 x 12 x 18 template with offset [7, 6, 8],
and its three worldgen definitions. Optional `--preview` renders four textured
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
output and equality with the shipped binary, serialized ground anchor, matching
garden frequency/biome rules, independent salts and unchanged garden membership.
Shared garden tests also pin the existing Great Mallorn grid.
Reusable placement evidence: workspace knowledge commit `041d7c5`,
`Document additive structure density from random-spread grids`.

Final full `mods verify lothlorien` passed on 2026-10-16: 0 errors, 0 warnings,
15 existing documented exceptions. Deployment then ran the shared quick checks,
copied the memorial template and its three worldgen files, and confirmed both
BP and RP in sync with `mods status lothlorien`. Natural terrain/distribution
has offline configuration evidence only; the accepted art was checked in game.
