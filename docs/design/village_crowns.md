# Crown stars and the end of stub trees (M7 phase 3)

Status 2026-10-16: complete; owner accepted the finished villages in game. Final commit: **Finish accepted elven villages**. Code: `tools/village_mallorn.mjs` (`addCrownStars`, `buildNubCrown`, the leaf cap in `buildTree`),
`tools/build_village.mjs` (crown calls and pools), `tools/village_sim.mjs` (stub check), tests in `tests/village_central.mjs`.

## Crown stars (style guide 5)
- Lanterns (gold `elven_lantern_heartwood` and silver `elven_lantern`) hang on 1-2 links of `minecraft:waxed_oxidized_copper_chain` under the leaf blobs, preferring the outer, lower
  leaves (that is where they are seen); box margin rule kept (|x|, |z| <= h - 1, y <= H - 2). Per crown: small 2, medium 3, large 4, **central a 10, central b 8**, tiny 1, nub 1.
- Froglights (verdant / pearlescent alternating) replace a leaf cell **inside** a blob: at most one open face, never the top one (the owner rejected bare white cubes on the Hall
  roof), and only where no leaf loses its path to wood (checked per candidate). small 1, medium 2, large 3, central 3 each. `supportCheck` accepts a froglight held by >= 5 leaf / wood
  neighbours ("glowing fruit"); anywhere else it needs a carrier below like any block.
- Central crowns: 2 `spore_blossom` under the lowest boughs (they hang from a leaf).

## Why a crown is refused (offline overlap investigation, 100 seeds)
A crown piece is a box that starts at the jigsaw cell, 6 above the deck. Every refusal was a box-box overlap with a neighbour: another tree's crown box (crown_medium / crown_large:
9 of 14), a tower combo box (tower_a/b/c: 6), a railing end or node box (3); several at once in some cases. `crown_small` (15 x 16 x 15) is too big for these gaps;
a 7 x 8 x 7 box was free in 13 of 14, a 5 x 7 x 5 box in 14 of 14. The jigsaw fallback is one level only.

## Fallback design
1. Two last-resort crowns in the pools `crowns_fallback` and `crowns_small` (weights 1 each, the others scaled x4 so that they are picked first nearly always):
   `crown_tiny` (7 x 8 x 7: a tapering trunk, a leaf cap, a gold lantern on a chain) and `crown_nub` (5 x 8 x 5: a hand-built cap).
2. The 300-seed sim still found one case (seed 111): the refused cell lies INSIDE a neighbour's crown box, so no piece at all can start there. Rule met in the piece itself: every tree
   piece ends in a **leaf cap** (layer deck + 4 ring, deck + 5 section and ring, persistent leaves; only the jigsaw cell stays a log), so a refused crown leaves a rounded cap, not a bare
   trunk; with a crown on top the cap is its collar. Nothing above deck + 5.
3. Sim: a refused crown jigsaw without a leaf cap beside it is a failure ("stub tree"); refused-but-capped is allowed (about 0.003 per village).
