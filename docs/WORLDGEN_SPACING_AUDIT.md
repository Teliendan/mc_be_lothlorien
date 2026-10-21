# Collision spacing audit

2026-10-18, target Bedrock 1.26.52. **Offline source/geometry evidence only.**
No production or optional-pack worldgen definitions were changed in this audit.
The owner observed complete natural direct-template trees/frames at all eight
amethyst sites. That clears the placement baseline, not independent-start
collision rejection. The feature route failed natural completeness; its proposed
list-envelope workaround was rejected by the engine schema.

## Measured inputs

- The existing tree/shrine structure set uses spacing6, separation2: one candidate
  per96x96-block cell, before biome eligibility. This is108.51 candidates per
  million square blocks. There is currently no natural village set.
- The village's configured horizontal expansion limit is116. The previous
  landscape prototype added a12-block finishing allowance around that limit.
- Exhaustive single-path enumeration of current rigid village templates finds
  X/Z bounds[-86,+86]. It traversed567,716 paths, all four start rotations, all
  matching child rotations, normal/fallback pools and ancestor box collisions.
  Terminal fallback pieces reach depth3 despite configured max_depth2.
- Sibling competition is ignored conservatively: other branches can remove
  candidates but cannot extend an individual attachment path. These are bounds
  under the existing local assembly model, not a new native scheduler proof.
  Twenty full simulated assemblies were inside the enumerated union.
- The12-block finishing allowance is still provisional. The smaller86-block
  template bound cannot justify shrinking production reservations until runtime
  finishing, root/support changes and relevant engine geometry are also bounded.

For inclusive padded radius R and G requested empty columns, required start
distance is2R+1+G. Under the random-spread integer-candidate model used by the
existing local tests, neighbouring cells can approach to(separation+1)*16 blocks.
The target engine also requires separation < spacing/2. Choose the smallest
integer separation satisfying the distance, then spacing=2*separation+1.

## Consequences for one shared set of individual builds

| Reservation per candidate | Spacing / separation | Closest starts | Average cell width | Candidates / million square blocks | Fewer candidates than current tree grid |
| --- | --- | --- | --- | --- | --- |
| Configured116 + provisional12 | 33 / 16 | 272 | 528 | 3.59 | 30.25 times |
| Same +64 clear edge columns | 41 / 20 | 336 | 656 | 2.32 | 46.69 times |
| Enumerated86 + provisional12 | 25 / 12 | 208 | 400 | 6.25 | 17.36 times |

Weights village2/platform3/plain5/smaller8 reproduce the owner's rough ratio:
1 village :1.5 platforms :2.5 plain giants :4 smaller places. Thus a village
would take one ninth of individual candidates: only0.40 or0.69 village candidates
per million square blocks in the first/third rows, even before biome rejection.
These are expected candidate densities over eligible area, not a biome quota,
travel distance prediction, or current village frequency.

The lower-density option preserves individual starts, but its spacing is a large
change from the old woodland. Different salts do not establish a geometric
exclusion zone; leaving the old independent tree/garden/memorial sets active
would defeat this reservation policy. A safe shared set must replace them.

The alternative remains coordinated native assemblies with several complete
landmarks per candidate. Offsets, directions, distances and counts would need
substantial variation; the old repeated cross layout was rejected by the owner.
This is an unimplemented alternative, not permission to restore that prototype
or claim the original scatter/density can be retained exactly. Full-size direct
templates and within-assembly box rejection supply a supported basis, but local
terrain placement, supports and the gaps between independent assemblies still
need their own validation. No scripted generation on approach is proposed.

## Review and verification

The owner rejected the sparse result and requests a simple village-on-original-
tree-grid behaviour test. The probability proposal is in LANDSCAPE_WORLDGEN_PLAN.md.
Owner follow-up keeps gardens and memorials on their existing separate grids;
only village/platform/plain/shrine share the dense tree-grid proposal.
The spacing calculations remain conditional safety tradeoffs, not the selected
next distribution. No terrain design has been selected or implemented, and no
additional floating-tree tests are needed.

Run `node tools/worldgen_spacing.mjs` from this mod to regenerate
`C:/mcmods/temp/worldgen-spacing/audit.json` and the standalone interactive
`comparison.html`. The latter compares reservation width, clear edge columns,
minimum separation and density; it does not simulate actual world seed positions.

The independent `worldgen-spacing` suite verifies depth-limit fallbacks using a
small synthetic graph, overlap arithmetic, neighbouring-cell extreme offsets,
invalid inputs and containment of twenty actual simulated villages. It is
registered separately from village simulations. Use workspace command:

```powershell
.\mods verify lothlorien --suite worldgen-spacing --suite suite-layout
```

This scoped verification passed: both project runners, localization and all pack
checks. Core BP/RP report zero errors/warnings and15 documented exceptions;
optional BP reports zero errors and its one expected empty-inventory warning.
The generated HTML's inline JavaScript also passes Node syntax checking. No pack
change or in-game handoff was made, so this audit requires no deployment.

Sources: current local worldgen JSON/templates/simulator, shared
`21-jigsaw-worldgen-policy.md`, and the
[official structure-set placement schema](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/worldgenreference/examples/jigsawstructuresets?view=minecraft-bedrock-stable).
The engine-specific strict spacing restriction comes from previous owner logs.
