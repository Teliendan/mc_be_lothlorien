# Elven village worldgen briefing

2026-10-16; Bedrock 1.26.52. Research/source inspection only; **no pack changes**.
The owner requested a briefing before implementing natural village generation.
Shared engine/schema findings and primary sources:
`../../../.claude/skills/bedrock-modding/references/21-jigsaw-worldgen-policy.md`.

## Current village

`lothlorien:elven_village` is registered for command placement but belongs to no
structure set, so it does not generate naturally. Its biome filter is Lothlorien,
depth is 2, maximum horizontal/vertical distance is 116, projection is
world_surface, terrain adaptation is none, and template pieces use rigid.
Bridge-and-tree combos count as one attachment step. Early ends and fallback
railings/balconies/lookouts are intentional; crowns have fallback sizes.
The runtime planner adds links, residents/furnishings and terrain repairs after
discovery; it does not enforce a minimum village size or biome containment.

Read-only assembly sample from the current files: simulator seeds 1..300,
2026-10-16. Main trees (central plus combo node/tower templates) min/mean/max
3 / 9.3233 / 16; all pieces 13 / 33.94 / 56; largest horizontal box span
57 / 119.7067 / 154 blocks. No central-only layout in that sample. These are
simulated assembly outcomes, not guarantees or natural-terrain measurements;
runtime links are excluded. Historical figures in the earlier settlement note
describe older template revisions.

## Existing natural structures

| Set | Spacing / separation (chunks) | Contents |
| --- | --- | --- |
| giant_mallorn | 6 / 2 | Plain giants, platform/watch trees, root shrine |
| flower_garden | 12 / 4 | Flower garden variants |
| memorial | 12 / 4 | Memorial |

Each has its own salt. A root shrine competes with giant-tree variants at one
candidate; gardens and memorials have independent candidates. A new independent
village set would offer no documented automatic avoidance of these builds.
Within-village piece collision does not establish cross-structure exclusion.

## Policy choices still open

- Desired village rarity; no guarantee of one per biome patch.
- Allow a start near the edge, or require stronger containment using a separately
  researched placement design. Do not assume the biome filter clips child pieces.
- Accept small random villages, or put a minimum viable settlement in the start
  template. No documented minimum-piece cancellation setting exists.
- Independent sets preserve existing attempts but permit intersections. A shared
  set with adequate spacing can coordinate structure choices, at the cost of
  changing their frequencies. Sharing a candidate alone does not prevent
  neighbouring large footprints from meeting.
- Review natural hills, water, forest vegetation and interactions with giants,
  gardens and memorials in newly generated worlds before acceptance.

No rarity, minimum size, containment or implementation policy has been selected yet.

## Follow-up: collision requirement and order

Owner 2026-10-16: collisions must be settled; even a memorial cutting through
central-tree roots is unacceptable. Treat roots/foundations as protected alongside
decks and crowns; overlapping starts cannot simply be tolerated.

The memorial writes dirt at local y -2, grass at -1 and explicit air at y 0..3
around its deck/apron. Reordering alone could therefore cut roots, or let later
roots overwrite the memorial. The general template writer preserves unsupplied
cells as structure void, so village-last placement would not remove a whole
earlier giant: surviving trunk/crown/root fragments could remain.

The vanilla-like small-feature approach worth investigating is a later
placement with whole-build obstacle constraints, rejecting an occupied site.
Memorial size is 13x8x16 and garden 13x5x13, so each could fit inside one chunk
with carefully constrained placement/rotation. Their current centred placement
does not ensure this. This is a research option, not an implemented or tested
guarantee. Large villages versus giants still need coordinated placement or
another validated exclusion design.

## Brainstorm: village-first replacement protection

Owner proposal, 2026-10-16, not an implementation decision:
villages -> platform Mallorns -> root shrines -> gardens -> plain Great Mallorns
-> memorials, with later placements unable to overwrite earlier builds. Owner
correctly notes the first village itself need not reject earlier structures.

Native jigsaw `minecraft:protected_blocks` processors can preserve tagged world
blocks. This option was missed in the earlier briefing and is now recorded in
shared reference 21. It is per-block preservation, not whole-build rejection;
later structures could be partial and unfilled passage/headroom cells need
separate protection. Engine tests are still needed before promising this policy.
Platform Mallorns, root shrines and plain giants currently share one jigsaw
start pool/set; the proposed priorities would require separating that selection.

## Owner decision: complete builds only

2026-10-16: "Every build should be complete". Later placements must not become
partial to preserve earlier ones. Per-block protected processors alone therefore
do not satisfy the collision policy; they can only be a secondary safeguard.
For a selected complete build/layout, placement must establish clearance before
writing, or coordinated placement must prevent the conflict in advance. If it
cannot fit, skip the whole attempt (or find another fully valid location).
Check foundations/roots, explicit air-clearing writes, occupied blocks and usable
passage/headroom space. Normal intentional jigsaw variation remains distinct
from damage caused by collision with another structure.

Village-first priority remains a proposal; no generation changes are authorised
by this brainstorm. The unresolved implementation question is dependable
whole-placement exclusion for the large saved structures, including conflicts
between two village starts and boundaries between generated chunks.

## Implementation direction

Owner rejected scripted placement on approach: native generation is required.
The build/test plan and command-only native grouping prototype are in
`LANDSCAPE_WORLDGEN_PLAN.md`. Natural distribution remains unchanged until its
assembly, terrain and density gates pass. The owner also supplied a Java Forge
tutorial and requested subagent research; the plan records the transferable
complete-piece idea and the Java-only exclusion hook.
