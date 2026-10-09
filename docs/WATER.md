# Water decisions

2026-10-09, Bedrock 1.26.52 / API 2.8.0. Owner rule: flowers pop, and other blocks
follow their Bedrock vanilla counterparts unless deliberately different.
Owner accepted these policies and requested stair face parity in the same session.
These are implemented source policies; engine flow, rendering and exact counterpart
parity still need side-by-side in-game checks.

| Policy | Complete block inventory (prefix `lothlorien:`) | Counterpart / reason |
| --- | --- | --- |
| Pop, no waterlogging | `athelas`, `elanor`, `golden_fern`, `nectar_bloom`, `niphredil` | Land flowers/herbs/fern; owner decision |
| Pop, no waterlogging | `western_corn`, `mallorn_sapling`, `great_mallorn_sprout` | Land crop and saplings |
| Pop, no waterlogging | `mallorn_blossom`, `mallorn_leaf_carpet` | Petals/leaf litter; native loot counts every segment |
| Waterlog, survive | `mallorn_slab`, `mallorn_heartwood_slab`, `mallorn_stairs`, `mallorn_heartwood_stairs` | Single slabs/stairs; current native concrete sample recipe |
| Waterlog, survive | `mallorn_fence`, `mallorn_heartwood_fence`, `mallorn_fence_gate`, `mallorn_heartwood_fence_gate` | Fences/gates |
| Waterlog, survive | `mallorn_trapdoor`, `mallorn_heartwood_trapdoor`, `mallorn_door`, `mallorn_heartwood_door` | Bedrock doors/trapdoors (do not assume Java air-pocket mechanics) |
| Waterlog, survive | `mallorn_button`, `mallorn_heartwood_button`, `mallorn_pressure_plate`, `mallorn_heartwood_pressure_plate` | Bedrock small controls; exact flow comparison pending |
| Waterlog, survive | `mallorn_leaves`, `mallorn_golden_leaves` | Leaves |
| Waterlog, survive | `elven_rope`, `elven_rope_hanging` | Ladder analogue; rope does not wash away |
| Waterlog, survive | `deer_antler` | Deliberate custom recommendation; skull shape does not establish flow survival; compare skull/amethyst cluster before claiming parity |
| Waterlog, survive, remain lit | `elven_lantern`, `elven_lantern_heartwood`, `elven_chandelier`, `firefly_jar` | Lantern analogue; chandelier carries hanging lights, jar is sealed |
| Survive, block water, no waterlogging | `mallorn_log`, `mallorn_wood`, `mallorn_stripped_log`, `mallorn_stripped_wood`, `mallorn_planks`, `mallorn_heartwood_planks` | Solid wood |
| Survive, block water, no waterlogging | `mallorn_double_slab`, `mallorn_heartwood_double_slab`, `star_canopy` | Full building cubes |

Totals: 44 blocks = 10 pop, 25 waterlog, 9 solid blockers. Waterlogging rules use
`blocking` for incoming flow, matching the installed native slab/stair sample recipe,
with outgoing restrictions empty except for stairs. Both stair sets now declare all 40
shape/half/facing policies: upright blocks down, upside-down blocks up; straight adds
the tall back, inner corners add both full sides, outer corners add no side wall.
Complete liquid overrides retain bucket containment, incoming blocking and clipping.
These world directions follow the actual rotated collision shape, not just visual rotation.
`tests/stair_water.mjs` checks all 80 production cases against occupied boundary voxels
and rejects deliberately broken leak/rotation cases. Vanilla direction flags and live
physics still need comparison; other partial blocks retain their previous outgoing policy.
Validation on 2026-10-09: full `mods verify lothlorien` passes with zero errors
(14 warnings); stair postprocessing matches the checked-in block policies and is
idempotent. Shared generator/guidance and verifier fixtures: workspace commit `cfa1d2a`.
See `C:/mcmods/docs/vanilla-water-counterparts.md`. Buttons/plates do not inherit
repeaters' flow-through behavior.
Every waterloggable block explicitly retains `use_liquid_clipping: false`, the current
1.26 default; inspect water appearance on partial/multipart shapes before changing it.

`tools/configure_support.py` reapplies this exact inventory alongside support metadata
after regeneration and fails for undecided new IDs. The shared verifier independently
rejects missing/malformed policies, including incomplete permutation overrides. Native
state-conditioned loot handles corn maturity and all 1-4 cover segments. No new liquid
polling or bucket-emulation script was introduced.

Pending engine checks: bucket placement/removal (including custom interact handlers),
placing blocks into water, incoming side/above flow, outgoing flow, break/reload,
open/closed doors/gates/trapdoors, leaves decaying while waterlogged, both rope variants,
and waterlogged slab merging into a non-waterloggable double slab. Check crop-stage and
cover-amount drops. The existing grass-overlay workaround restores grass on player
break only; water removal can expose dirt, as with other non-player destruction paths.

This supersedes the older missing-waterlogging/water-flow-breaking notes in
`TECHNICAL_NOTES.md` and `NOT_IMPLEMENTED.md`. Those files retain historical context.
