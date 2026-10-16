# Home furnishing at runtime (M7 showcase WP4b, 2026-10-14)

Status: implemented and checked offline (tests, simulator); **nothing verified in game**. Healer set only; the code takes any profession that has a
layout in `lothlorien_bp/scripts/home_furnish.js` (`SETS`). Deployment note for the owner: furnishing happens when a village is populated (the planner
run), so it needs a new world or a village that has not been populated yet.

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
- Untested in game: the structure ids, cauldron/candle/straw bed states written through `BlockPermutation.resolve`, banner block entity from the
  structure, the texture of decorated pots (brick red, the only non-palette colour in the set).
