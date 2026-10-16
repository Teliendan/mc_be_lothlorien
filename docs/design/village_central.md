# The central tree of the Elven village (M7 WP2): Court, stair, Hall, stream, reading circle

Status 2026-10-15: built and green (generator checks, sim 300 seeds, tests, verify); **nothing here is verified in game yet** (owner's showcase test is
the next step, together with the healer set and the dressing). Design authority: `village_style.md` sections 0, 7.1, 7.3, 7.6, 7.10. Code:
`tools/village_central.mjs` (Hall, stream, Court furniture), `tools/village_mallorn.mjs` (`buildTree` with the round-trunk stair and the
`hooks.structure` hook, `SHAPES.octagon23`), `tools/village_dress.mjs` (all dressing, options `lampBudget`, `arms`, `bannerFaces`, `rimStep`, `rimMax`,
`gardenR`, `islands`), `tools/build_village.mjs` (the central block: levels, hook, elf cells, markers). Pieces: `central_mallorn_01` (23 x 48 x 23) plus
the unchanged crown pools `crowns_central` (crown box starts at Hall + 6).

## Layout (tree coordinates: trunk axis 0,0; x east, z south; Court deck y 16, Hall deck y 24)

- **Court** (`SHAPES.octagon23`, 23 x 23, corners cut in 2-cell steps): connectors N (x -3), E (z +2), S (x -5), W (z +2 -> -11 side); the Elven rope at
  (0, -3) on the trunk's north face with its anchor jigsaw below; the heartwood ring at Chebyshev 5; the walk ring (kept clear) at 4; main paths
  from each connector straight to the ring. It was 21 x 21 before M7; the Court grew to 23 because the stair ring (3), walk ring (4), heartwood ring (5)
  and the 5x5 rail-free window the 7 elf cells need (2 wardens, Loremaster, 4 reserves) left no room on 21.
- **Trunk**: round 5x5 (corners missing). Between the Court and Hall + 4 the four missing corner cells are filled with logs (the stair's inner wall: no
  pit between ring and trunk); above that the trunk is round again into the crown piece.
- **Stair**: slab spiral on the 24-cell ring at Chebyshev 3 (`RING7`); the climb uses 16 cells (0.5 block each = 8 blocks, `STAIR7`), clockwise from the
  east side (3, -2), exit on the west side at (-3, 0) / (-3, -1); the 8 other ring cells are flat deck on the north side with the rope. Same rules as
  the towers: headroom per tread (`STAIR_FULL / TOP / CUT`), outer stair rails at 4, walk ring outside on both decks, exit cells and the two cells
  outside them without rail.
- **Hall** (`HALL_ROWS` 15 x 15, corners cut in 2 steps, + the lookout bay x 8..9, |z| <= 2 on the east): stair opening railed, walk ring at 5 (kept
  clear, 2 high), seats at 6 on a heartwood ring, 17 stripped-log posts on the rim rails (2 + 3 high), a stripped-log ring beam at +4, bark ribs from
  the trunk at +4 (N, W, E; the south rib is the trough), a leaf dome (+4 inside Chebyshev ~5.4, lattice to 6.4, +5 crest with golden spokes, windows in
  the cut corners), a leaf fringe outside the beam with glow berries and moss, a chandelier under the east rib at (5, 0), gold lanterns under the N and W
  rib tips and the bay's gate beam, 3 froglights (verdant, pearlescent, verdant) on the ribs in the crest, 2 spore blossoms under ribs, 4 banners on posts,
  13 seats (mallorn stairs; cushions are native entities, so no cushions in the structure), 5 candle groups, jars on the rim rails. Bay: a bench of three
  stairs facing east, two gate posts with a beam, a lantern, a banner, a jar and a pot.
- **Stream (7.3)**: spring = niche at (1, 2, Hall + 4) cut into the trunk's south face (heartwood on both sides and below, trunk behind, an upside-down
  heartwood stair as the hood at +5); trough along x = 1 from z = 3 to 8 (heartwood floor at +3, stripped-wood walls at +4, water sources at +4, carried by
  the rim post (1, 7)); the fall at (1, 9) from Hall + 4 down to the **basin** on the Court: raised vessel x 0..2, z 8..10 (stripped-wood walls and log
  corners at Court + 1, floor = the deck, water at Court + 1), 3 lily pads, a waterlogged sea pickle, a firefly jar on each corner post. The basin replaces the Court's rim rail on the south side. Water cells: 15 sources + 11 falling cells (`flowing_water`,
  `liquid_depth` 8). `waterCheck` passes without declared extra cells (the fall lands on the basin source).
- **Reading circle** (Court, north rim, x 1..5, z -10..-7): chiseled and plain bookshelves against the north rim rail (inside it), the lectern in
  front, 6 mallorn-stair seats in a half ring, a light-blue carpet, a candle group, a decorated pot, a banner on a stripped-log pole; the lane east of
  it (x 6) is kept open so the strip between circle and rim is not a closed pocket.
- **Court trunk**: 2 banners on the north face either side of the rope (watch + ivory design), one gold arm lamp (west face: the other faces are under the stair's keep-clear columns or beside the rope), heartwood ring, garden islands,
  rim scenes (denser than on a node: `rimStep` 3), lamp posts (6 gold: one per bridgehead, a second on two of them) - all through `dressTree`.
- **Elves**: 2 wardens, the Loremaster (nearest open cell to the rope that is not on a bridge path), 4 reserve posts; computed in the `structure` hook from the
  finished structure and reserved (3 x 3 x 3) before the dressing. Loop markers: Court rim runs only (the Hall has none), never a run whose five rails
  include a connector rail post (a joined bridge deck lies outside it).

## Lamps and light

Visible lamps (lanterns + chandelier): 11 (Court: 6 posts + 1 arm; Hall: chandelier, N rib tip, W rib tip, the bay's gate beam), within the 8-12 of the style
guide; plus 3 froglights in the crest, glow-berry strands round the Hall eaves (the warm halo that shows from the Court and at night), jars (basin corners,
Hall rim rails, bay), lit candle groups. Hidden lights (safety) 18, none in the keep-clear columns. The lamp budget moved from the WP3 default (8 posts)
to 6 posts so that the total stays <= 12.

## Decisions and traps

- The stream is the trough variant of the brief; it needs 2 free blocks under its floor (+3), so the Hall walk ring and the south seats pass under it at
  2.0 blocks of headroom (walk checker: need 1.9). It stays within Hall + 5; the spring's hood replaces a trunk log (the cell above, Hall + 6, belongs to the crown piece).
- The Hall hangs no woven struts and leaf blobs into the Court's air (towers do); the Court stays open and visible from the Hall.
- The rope hole (0, -3) exists on the Court only: `buildTree` gives the Hall deck its own `inner` set without it.
- Heartwood planks count as a walking surface for the sim: do not stand lone heartwood blocks on the deck (basin corners are stripped logs).
- A slab with a candle on it is a "low ceiling step" for the walk checker: candles stand on the deck.
- Elf cells: with a stair ring at 3, a walk ring at 4 and a heartwood ring at 5 only the band at Chebyshev 6..7 and a few ring cells are open deck;
  a smaller Court cannot host 7 posts.
- Waterlogged blocks: see `.claude/skills/bedrock-modding/references/09-structures.md` (layer 1, marker state `__water`).

## Open questions for the in-game test (all untested, 2026-10-15)

1. Does a jigsaw-placed structure keep `flowing_water` (`liquid_depth` 8) cells and the sources as written, or does the engine re-flow them on load
   (the column is fed from the trough end source; the basin sources are stable)?
2. `minecraft:chiseled_bookshelf` `direction` 0 is assumed to face south (documented states only), `minecraft:lectern` `minecraft:cardinal_direction` the
   same; both turn with a rotated piece in the sim.
3. The waterlogged sea pickle (liquid layer) and the lily pads on the basin.
4. The headroom under the trough (2 blocks) and under the lamp-post / stair rails near the stair foot.
5. Night impression: the Hall is lit by berries, froglights, the chandelier and 3 lanterns; the Court by its 6 lamp posts and the arm lamp.
