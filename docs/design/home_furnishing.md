# Home furnishing at runtime (M7 showcase WP4b, 2026-10-14)

Status: complete, accepted as part of the finished villages in game on 2026-10-16. Final commit: **Finish accepted elven villages**.
The central reading circle serves the Loremaster; `SETS` in `home_furnish.js` supplies the other profession layouts. Furnishing happens once when a village is populated; existing populated villages do not refurnish automatically.

- `findHome(at, post)` finds the pavilion from live blocks: the gold marker lantern (`elven_lantern_heartwood`) at deck +3, 2/3/4 cells from the
  elf post along the pavilion's depth axis, the k x k deck square, the outer corner posts. It returns the frame of `tools/village_dress.mjs homeFrame`
  in world coordinates. `siteOf` gives the assignment (elf_rules `assignHomes`, room = k >= 5) the pavilion's square, else the old `homeSite`.
- Furnishing area = interior u 1..k-2, v 0..k-2 at +1/+2 minus the post cell and the door lane. The whole aisle column u = cu stays free: pavilions on
  the deck rim are entered from the trunk side only. A group that would wall in a walkable cell, or that meets a block, moves to the nearest free cell
  or is dropped; odd k also tries the mirror image.
- Healer set: k 4 cauldron + brewing stand; k 5 cauldron, brewing stand, athelas planter, straw bed, barrel with 3 lit white candles, white rug;
  k 6 adds the white banner post, bed-side candles, two herb planters (athelas, niphredil), rugs, a decorated pot; k 7 adds a second bed, barrels
  with decorated pots (the bottle shelf), four planters, candle groups. Cauldron full of water; candles lit (the healer works at night).
- The healer banner (white, silver curly border, light-blue rhombus, white flower) is placed as a pre-built structure per facing
  (`tools/build_furnish.mjs` -> `structures/lothlorien/furnish/`), because script cannot set banner patterns.
- Overall village appearance is owner accepted; no separate exhaustive engine-state certification is claimed.

## Phase 3: gardener, woodwright, lamplighter (2026-10-16)

Accepted moss-bed borders (2026-10-16): `planFurnish` returns a separate `panels` list after selecting its
furniture layout. These moss-mounted thin skirts may extend onto the neighboring
aisle or one-cell pavilion margin; they do not reserve furniture cells. The runtime
writer applies them after furniture/structures and excludes existing cushion
actors. It also completes adjacent static beds after the furniture reservation
is resolved. Details: `../VILLAGES.md`.

Same mechanics as the healer's set (`SETS` in `home_furnish.js`, sets for k 4, 5, 6, 7; k >= 8 uses the 7 set); the healer retains its approved layout.

- **Gardener** (green): composter, a cauldron of water (the watering vessel), moss planters with Lothlorien flowers (about a quarter pretty vanilla ones), ferns, bushes and
  flowering azalea, planted flower pots on barrels, decorated pots on the floor, two cushions (green), at k 6/7 a post with the original watch banner.
- **Woodwright** (gold): fletching table with a heartwood slab top, a pile of stripped logs lying sideways (2 high + 1), a post with a rope hank (`elven_rope`) over a barrel,
  barrels, planted pots, yellow cushions, at k 7 a watch banner post.
- **Lamplighter** (bright): firefly jars, standing lanterns on barrels, a lantern bough (2 to 4 lanterns, silver and gold, hanging on `waxed_oxidized_copper_chain` at +3 from the
  roof over a barrel, so nothing hangs below +3 over a walk cell; dropped when there is no roof block at +4), lit white candles, white cushions, at k 6/7 a white-bordered banner post.
- **Basin**: the style guide's one-block stair basin (water + four stairs) needs a plus of five free cells; the furnishing area never has one next to the free aisle column
  (two columns at most), so the watering vessel is a cauldron of water. A stair basin would need a different place (outside the pavilion) or giving up the aisle.
- **New runtime pieces**: `structures` in the plan = banners (4 designs: healer, watch, lightblue, white; x 4 facings), planted flower pots (14 plants incl. empty, in a pot the
  plant is block entity data) and cushions (5 colours; an actor on a structure void cell). `tools/build_furnish.mjs` writes all 35 files into `structures/lothlorien/furnish/`.
  A cushion is placed only when no cushion stands in its cell yet. The chain may sit at +3 (the only thing besides the marker lantern); `findHome` ignores it.
- **Owner's rules honoured**: nothing floats (supportScan in tests and the sim), no lantern beside a fence (sim + test), nothing hanging below +3 over a walk cell, decorated pots only on
  the floor (planted pots only on barrels, never on rails inside), seats are cushions, the original watch banner is the main banner.
- Final border, seat-view and connection rules and the accepted performance evidence are in [the finishing record](../VILLAGES.md).
