# Native landscape generation: first prototype

2026-10-16, Bedrock 1.26.52. Owner requires native worldgen, complete builds,
protected roots/foundations and no scripted structures appearing on approach.
This supersedes the scripted option in the earlier brainstorm.

Next-policy audit, 2026-10-18: [WORLDGEN_SPACING_AUDIT.md](WORLDGEN_SPACING_AUDIT.md)
measures current candidate densities and exhaustively bounds rigid template
attachment paths, including terminal fallbacks. A shared set of individual
builds would be approximately17-30 times sparser than the old tree grid under
the compared reservations. Owner preference between that density tradeoff and
irregular coordinated layouts was subsequently resolved for the next experiment:
the owner rejected the sparse result and requests a simple village-on-tree-grid
behaviour test (proposal below). The old repeated cross-shaped group remains
rejected. No production distribution change has been accepted.

Implementation follow-up, 2026-10-18: the owner asks to check in game. The dense
6/9/15/8 prototype is now implemented as a temporary main-BP worldgen build;
gardens and memorials retain their independent grids. Separate structure
definitions preserve the village and tree ground/assembly settings. See
[TREE_GRID_TEST.md](TREE_GRID_TEST.md) for current instructions and deployment
status. Native collisions/terrain remain unvalidated; this is not production
acceptance of overlapping builds.

## Proposed dense tree-grid behaviour test (2026-10-18)

Owner steering: "This is bad, too rare. I want to test in-game behaviour of some
simple variant - village as a part of tree grid. Propose probabilities of
individual features on the tree grid." This supersedes the pending choice of
sparse individual starts versus new coordinated layouts. The owner asks for a
probability proposal at this step, not implementation of the rejected wide grid.

Current placement is spacing6/separation2/salt518204731. The Mallorn start pool
totals64: platform variants6+6=12 (18.75%), plain variants9*4=36 (56.25%), root
shrine16 (25%). Villages have no natural set. Gardens and memorials each use a
separate spacing12/separation4 set, nominally one quarter the original tree-grid
candidate density apiece before biome rejection; those are additional attempts.

Owner follow-up: keep gardens and memorials on their separate grids because
they are smaller. The initial all-six-types-on-one-grid proposal is superseded.
Revised proposal: one shared structure set on the original tree candidate grid,
containing only village/platform/plain/root shrine:

| Kind | Weight | Chance per selection |
| --- | --- | --- |
| Village | 6 | 15.79% |
| Platform Mallorn | 9 | 23.68% |
| Plain Great Mallorn | 15 | 39.47% |
| Root shrine | 8 | 21.05% |

Total38. Retaining weights6/9/15/8 while removing garden/memorial entries raises
the village share from11.11% to15.79% of tree-grid selections. Before biome
rejection, expected counts per village are1.5 platforms,2.5 plain giants,
1.33 shrines and approximately1.58 each of gardens/memorials (each separate grid
has one quarter the base candidate density). Smaller places total approximately
4.5 per village, close to the rough owner target. These are expected ratios,
not guarantees per biome; actual engine attempts/biome filtering may differ.
Each village remains a complete normal jigsaw attempt with its own anchor,
depth and height settings. Category selection belongs in the shared structure
set, with individual structure definitions; a common start pool would mix
incompatible anchors/ground offsets. Keep existing per-category tree variants.

Gardens and memorials retain their current independent spacing12/separation4
sets and salts. Tree candidate positions retain spacing6/separation2/salt518204731.
There is one selected village/tree/shrine per base candidate, plus the existing
garden/memorial attempts. Nominal total site-attempt density is preserved; some
tree/shrine selections are replaced by villages. Their smaller footprint reduces
overlap exposure but does not establish exclusion against village roots/buildings.

This is explicitly a behaviour experiment at existing density, not a verified
collision-safe production solution. Adjacent starts can still intersect villages;
we need to inspect intact builds, root interference and terrain fitting in game.
The owner's eventual complete-build requirement remains in force. The probability
proposal is now implemented in the temporary main-pack test build; deployment
and native results are tracked in TREE_GRID_TEST.md.

## Current outcome: direct templates pass; feature bridge unresolved (2026-10-18)

Owner checked eight naturally generated amethyst direct-template controls:
all had full trees and full glass/sea-lantern roofs. This is an in-game visual
8/8 pass for the tested single-template child, not a save-level comparison or
proof of every rotation/exploration order. No more floating completeness tests
are needed for this baseline. Collision policy, terrain support and whole-footprint
biome fitting remain separate unresolved production requirements.

Owner west/east testing on target 1.26.52 found missing trees at selected
gold/emerald/lapis starts and an incomplete glass frame on a redstone tree.
Other starts varied: gold/emerald sometimes placed trees, but their glass frames
were never complete; redstone sometimes retained only its identifier and diamond.
Thus the command-pass feature bridge is not suitable for complete natural
landmarks. No north/south repetition is needed to reject this prototype.

Owner clarification: east and west produced the same outcomes at each matched
position. The failure is repeatable by location in these tests. Variation across
sites is not evidence that approach direction changed a site's result.

Reopened diagnosis after read-only West/East save inspection: the owner says the
same lower-X and probably lower-Z glass portion is always absent. Inferred full
start-record decoding finds45 feature entries with zero-sized bounds; saved
glass sites coincide with180-degree feature rotations. This points to a concrete
wrapper bounding-volume problem and a targeted full-envelope comparison, rather
than treating all feature-bridge designs as impossible. On 2026-10-18 the optional
test pack gained a full-envelope iron case and a direct-template amethyst control.
The owner engine rejected `minecraft:list_pool_element` at world entry, so the
iron envelope hypothesis could not be tested. Revision 3 removes its invalid pool
and related files; only the unchanged amethyst direct-template control now spawns
naturally in the optional pack. Its visual completeness result passed at all
eight owner-inspected sites. Production placement remains unchanged. See
`CONSTRAINED_FEATURE_PROBE.md` for the direct-only baseline and the precise limits.

Possible causes are feature placement scope/bounding boxes and chunk write/check
order; they were not isolated. The natural carrier diamond is not an independently
pre-existing obstacle, so do not generalise the redstone observation to all native
constraint behavior. Unchecked natural clipping alone fails the owner's policy.

Do not switch production sets to this approach. Large accepted builds still need
ordinary saved-template jigsaws and a separate spatial collision policy. The old
independent scatter has no proven native village-reservation mechanism. Options
remain a shared set spaced for the largest footprint (lower landmark density),
or coordinated jigsaw assemblies with more varied positions/counts/distances
(a changed distribution). Neither has been selected or implemented as a new
production design. Terrain support/transition is also still unresolved.

## Investigation after owner terrain test (2026-10-17)

The owner stopped implementation: a garden on a small slope had approximately
2-3 blocks exposed into air, insufficient support and an abrupt surrounding
transition; the repeated group layout looked artificial. The design below is
prototype history, not an accepted production choice. Natural sets remain
unchanged. Next requested direction: original scattered Great Mallorn placement,
with some candidates replaced by other places and villages.

Research on target 1.26.52 found no documented native rule to cancel neighbouring
giant starts when one candidate selects a village. Existing giant spacing is
6 / separation 2; platforms, plain giants and root shrines share that pool.
Gardens/memorials are separate sets. Salt changes and biome partitioning do not
establish footprint clearance. A wider shared set reduces candidate density.

New lead: `minecraft:feature_pool_element`, released in 26.20 and used by vanilla
abandoned-camp tree pools, can call a constrained `structure_template_feature`
from native jigsaw generation. Its intersection/terrain constraints reject an
entire template. It has **not** been shown to preserve a 40-wide saved Mallorn
across chunks: our earlier direct-feature approach clipped them. It also does
not inherently reserve village airspace or prove safe chunk-generation order.
No probe or pack changes were made during this investigation.

Recommended next experiment if authorised: isolate that feature bridge with one
40-wide template; test completeness and whole-template rejection against an
obstacle in another chunk, then opposite exploration directions during natural
generation. Separately test a chunk-contained garden with grounded/leveled and
intersection constraints. Only if large-template checks pass should we evaluate
village-first / later scattered landmarks. Otherwise the geometric fallback is
a shared set with varied woodland counts, offsets, distances and omissions,
accepting a different distribution/density. Actual buildings stay rigid; deeper
foundations, wider organic ground transitions and natural terrain adaptation
need separate evaluation. Terrain-matching links alone did not solve slopes.

Reusable sources and precise limits:
`C:/mcmods/.claude/skills/bedrock-modding/references/21-jigsaw-worldgen-policy.md`,
section "Scattered starts revisited". Research only; no new engine test.

## Earlier proposed production design

Implementation follow-up, 2026-10-17: the isolated experiment is now available
in the optional **Lothlorien — Worldgen Test** behavior pack
(`lothlorien_feature_probe_bp`), dependent on the main BP. It contains all four
command controls and a natural diagnostic set; enabling that pack in a disposable
world opts into the test without changing ordinary-world placement. Instructions:
[CONSTRAINED_FEATURE_PROBE.md](CONSTRAINED_FEATURE_PROBE.md). Focused offline
checks pass; native completeness/rejection/order results remain pending. This
implements the experiment above, not a new production placement architecture.

Owner engine result, 2026-10-17 / 1.26.52: revised command fixtures visually pass.
Gold/emerald placed trees and glass frames; lapis placed its tree/frame despite
preplaced diamond pillars; redstone retained diamond and its identifier with
no visible tree/frame. This supports native whole-payload rejection in the
loaded command context. Natural chunk-order/completion, terrain fit and
independent village-first scheduling still require separate tests. The original
scattered-placement design is promising again, not yet production-proven.

One shared structure set selects a village or a woodland group. A group is one
native jigsaw assembly. Whole trees (plain and platform), root shrines, gardens
and memorials are individual complete templates; the engine either attaches a
whole template or omits that optional build when its box does not fit. No
protected-block processor removes parts of buildings. Boxes include roots and
empty space, not just visible solids. Intentional village branches/fallbacks
remain the existing accepted design.

Distinct group starts need enough separation for their largest envelopes,
including the village's later finishing. A conservative first arithmetic target
is horizontal 116 + margin 12, spacing 42 / separation 20 chunks: neighbouring
candidate starts are at least 336 blocks apart. Even two worst-case padded
257-block-wide reservations retain 79 free block columns, exceeding the new
64-block edge-clearance requirement. This supersedes the initial 34 / 16 target,
which prevented overlap but left too little clearance between boundary builds.
This is a safety baseline, not a selected final density. Grouping multiple trees
per woodland start is necessary to avoid the drastic density loss from placing
single giants at that spacing. Existing independent placement sets must be
removed from natural generation when the coordinated set is enabled; leaving
them running would defeat exclusion.

## First engine probe, now implemented

Command-only structures:

- `lothlorien:woodland_group_probe`: exactly two complete ordinary giants and
  two complete smaller places (garden, root shrine or memorial), using exterior
  connectors whose child boxes fit without competing with one another.
- `lothlorien:landscape_probe`: randomly start with the accepted village central
  template or the woodland root, using the same native structure settings.

The generator copies accepted source builders, preserves loot and camp entities,
adds connectors on empty outer faces and pads the boxes down to the village root
depth so the probe can share its start height. Actual builds remain rigid; the
2026-10-17 terrain pass changes only the invisible links to terrain matching.
Terrain fit on hills remains an engine test, not a claimed production solution.
No structure sets are changed and these probes do not generate naturally.

### Owner's density target and prototype weights

Owner 2026-10-16: villages should be easy enough to find but the least frequent
individual kind. Rough target per large Lothlorien: one village, 1-2 platform
Mallorns, about four smaller places total across gardens/root shrines/memorials,
and 2-3 plain Great Mallorns; plus or minus. This describes a ratio, not an exact
quota for every connected biome patch.

The mixed probe chooses one village per two woodland groups on average. Each
woodland has two ordinary giants and two smaller places; ordinary tree weights
are platform 3/8, plain 5/8. Thus the expected ratio is one village : 1.5 platform
Mallorns : 2.5 plain giants : four smaller places. Garden, shrine and memorial
have equal small-place weights (about 1.33 each per village over many attempts).
Individual groups/patches vary. Woodland groups currently place all members at
the same ground plane. This makes the first engine check understandable, not a
final terrain solution.

Start in a NEW FLAT Creative test world, away from existing builds. Use
`/place structure lothlorien:woodland_group_probe` at separate sites (400 blocks
apart), then `/place structure lothlorien:landscape_probe` at separate sites.
The command uses the native jigsaw engine; there is no script placement timer.
Do not place over existing builds: commands bypass the proposed start-spacing
policy. Native assembly and rendering still require engine confirmation.

Check: complete tree crowns/trunks/roots; intact platform camps and residents;
whole gardens and memorials; no leftover jigsaw blocks; normal village finishing.
Then review woodland groups on previously unbuilt sloping terrain in a disposable
normal world. That test assesses local ground alignment and exposure of the
padded anchor, not automatic avoidance of the old independent structures.

## Next gates

Biome/terrain audit, 2026-10-17: only the group definition has a Lothlorien
biome filter. No per-child or full-footprint biome-containment check is
implemented; the documented native filter does not establish such a guarantee.
At that audit all spacer and terminal pools used rigid projection and terrain
adaptation was none. Surface height was chosen for the start; satellite grounds
inherited its plane, so differing local terrain could bury or suspend a memorial,
garden or tree. Wider spacing makes this risk more significant. The flat-world
assembly result does not establish natural terrain compatibility. Native local
height alignment and biome-edge policy remain blocking production-design work;
do not describe this prototype as ready for natural distribution.

Prototype validation/deployment, 2026-10-16: current-source preservation and
300 simulated woodland groups pass, with exactly two ordinary giants and two
whole smaller builds in every sample. Full deployment verification passed with
zero errors/warnings and 15 existing documented exceptions; 21 BP files copied,
RP unchanged. Native engine assembly/terrain observations are pending.

### Wider spacing, 2026-10-17

Owner confirmed the first prototype works, but requested more room, only a bit
closer than today's Great Mallorns; also explicitly required checking adjacent
groups' outer edges. The old giant set has spacing 6 chunks (96 blocks nominal
grid scale), separation 2 (not a fixed 96-block nearest-neighbour distance).
The revised woodland uses 80-block tree-centre spacing rather than 40; small
places move outward by the same additional 40 blocks. The build count and
expected ratios remain unchanged.

Two tiny 1x1x40 spacer templates connect root -> spacer -> full build within
depth 2. Only the two endpoints are written jigsaws, both resolving to air; all
intermediate cells are structure void. No visible path is added, and there is
no oversized padded root asset. The preserved source solids, loot and entities
remain exact. The widened spacer technique is offline-tested, pending its own
engine observation; owner acceptance applied to the earlier direct attachments.

300 woodland layouts retain exactly two ordinary trees and two smaller places.
Tree spacing and spacer void/final states are checked. Cross-boundary tests
include 30 village layouts and all quarter turns, testing both axes/diagonals
with village finishing margin. The conservative grid assertion now requires
at least 64 free columns between group reservations, not merely no overlap.
Natural placement sets are still unchanged: this boundary policy is a tested
design target, not an enabled worldgen switch. For manual neighbour testing,
place starts 336 blocks apart; use 400 for routine separated previews.

Wider revision deployed 2026-10-17: full verification passed with zero errors,
zero warnings and 15 existing documented exceptions. Ten BP files copied; RP
unchanged. Both packs were confirmed in sync. In the 300-layout sample,
root-to-small-build box-centre distances range from 66.5 to about 80 blocks
(small footprints attach closer than 40-wide shrines); ordinary tree centres
are 80 blocks apart along their connecting axis. No new engine observations yet.

1. Base native assembly is owner-confirmed; confirm the widened spacer layout.
2. Solve terrain alignment without deforming trees or introducing script growth;
   vary branch distances/layouts to avoid an obvious orchard grid.
3. Tune group size and weights against old densities; choose village rarity.
4. Enable one coordinated natural set and disable old independent sets together.
5. Inspect new-world boundaries, distributions, roots and full villages; measure
   generation cost before increasing density. Worldgen changes need a new world.

The exact six-stage priority order was a brainstorm, not implemented here. This
design replaces independent competing starts with one coordinated assembly.
It does not promise to avoid unrelated vanilla/add-on structures or player builds.

## Terrain-matching pass, 2026-10-17

Owner authorised terrain work first; biome boundaries are a lower priority.
The two invisible spacer pools now use `terrain_matching`; all complete tree,
shrine, garden, memorial and village templates stay `rigid`. Intended native
behavior: the height-aware link lets the rigid satellite choose a local height
at its attachment, translating the complete build rather than draping its block
columns over a hill. This is a documented/inferred design awaiting an engine
test, not an offline proof of the engine's height calculation.

The official 1.21.100 changelog fixes the mixed-projection one-block sinking
issue; do not add a guessed compensating offset on 1.26.52. Projection support
and processing are documented in the single-pool-element reference. No new
relevant terrain fix was identified in the reviewed 26.50 changelog.

The attempted `woodland_group_rigid_control` was removed after the owner's
2026-10-17 Content Log rejected reused spacer assets with different projections
and warned about the documented alias `type` field. No A/B control is currently
shipped. Default woodland and mixed landscape probes keep the terrain-aware links.

Test after reloading: first place a fresh `woodland_group_probe` on flat ground
to check the baseline ground offset and all four builds. Then place it in clear
rolling terrain where the satellite sites have visibly different elevations.
Use fresh sites at least 400 blocks apart. Note missing builds, one-block
sinking, local-height tracking,
roots, supported memorial/garden decks and intact camp furnishings. Never place
over existing structures: command placement provides no start exclusion.

This addresses start-to-satellite elevation differences. It does not yet prove
that a rigid build's *own footprint* fits a steep slope, supply adaptive deep
foundations or reject cliffs/water. Native terrain tests must guide that next
step. Root village decks remain the accepted rigid connected layout with their
existing rope/root finishing; they are not individually terrain-matched.

Offline checks preserve exact saved solids/loot/entities, enforce matching links
and rigid buildings, and assert that failed control files are absent. The 300 assembly and
neighbour-clearance samples model flat boxes only, not native gravity/heightmaps.
No naturally spawning structure set has been switched yet.

Terrain revision deployed 2026-10-17: full workspace verification passed with
zero errors/warnings and 15 existing documented exceptions. Five BP JSON files
copied; RP unchanged. Both packs confirmed in sync. Engine flat-offset,
mixed-projection elevation and control-alias observations remain pending.

Owner subsequently reported the control's two alias-schema warnings and two
asset-registration errors. The generator now removes exactly those three
retired JSON files; the workspace verifier rejects conflicting asset projections
across pools. Its positive/broken fixtures passed (1519 assertions). The earlier
offline pass did not cover this engine registration trap. Retest only the normal
`woodland_group_probe`; the rigid-control command has been retired. Terrain
placement itself remains pending engine confirmation after this correction.

Corrective deployment 2026-10-17: full verification passed with zero errors,
zero warnings and 15 existing documented exceptions. Exactly the three retired
control JSON files were removed from the managed BP copy; no other pack content
needed copying. BP/RP confirmed in sync. Await owner reload and normal-probe
terrain results; passing offline verification does not certify the new engine log.

### Structure identity versus biome identity

Structures do not assign a biome. `main.js` currently uses
`dimension.getBiome(location).id === "lothlorien:lothlorien"` for its in-biome
callback, consumed by Harmony and Renown. Thus a village placed in plains does
not automatically receive those biome-based conditions or Lothlorien biome
colours/fog. Entity interactions tied to village elves still exist.

A future village gameplay-area rule could include recorded village bounds in
that callback without rewriting the actual biome. That is distinct from native
biome identity/visuals, and was not implemented as part of this terrain pass.
Owner asked that village areas ideally count as Lothlorien; scope/policy for
that follow-up remains open. Stable 2.8.0 local declarations expose biome reads
but no biome setter.

Primary sources checked 2026-10-17:
- https://learn.microsoft.com/en-us/minecraft/creator/reference/content/worldgenreference/examples/jigsawpoolelementsingle?view=minecraft-bedrock-stable
- https://www.minecraft.net/en-us/article/minecraft-1-21-100-bedrock-changelog
- https://learn.microsoft.com/en-us/minecraft/creator/reference/content/worldgenreference/examples/jigsawjigsawstructures?view=minecraft-bedrock-stable

## Tutorial and salt findings

Subagent inspected TelepathicGrunt's Java Forge tutorial branch
`1.18.2-Forge-Jigsaw`, revision `87b45352cbe8f578dacb6bbc2ffc7a2659977c48`.
Its `SkyStructures.java` rejects nearby monument candidates before assembly via
custom Java and `Optional.empty()`; Bedrock JSON has no documented equivalent.
Its side-pool and fallback examples support the complete-piece grouping idea;
Bedrock behavior must be confirmed with our own probe. Source:
https://github.com/TelepathicGrunt/StructureTutorialMod/blob/1.18.2-Forge-Jigsaw/src/main/java/com/telepathicgrunt/structuretutorial/structures/SkyStructures.java

Existing giant, garden and memorial sets already have different salts. Salt
distinguishes scatter patterns; it is not a clearance radius. An avoid/exclusion
list from a Java mod cannot be assumed to exist in native Bedrock JSON. The
current documented Bedrock placement fields expose no such list.

## Survey of other Bedrock add-ons: owner decisions (2026-10-28)

Findings: `.claude/skills/bedrock-modding/references/24-structure-placement-survey.md` (read from source,
not tested in game). Owner decisions on them:

- Village recipe of others (terrain-matching streets, each rigid house at its own height): not used here;
  our village stays one rigid chain with high bridges.
- Script-placed builds on approach (RPG++ seed blocks, `placeJigsawStructure`): still rejected, no pop-in.
- Deep piles in templates: not used; the post-load root-down repair is enough.
- Beard terrain adaptation: conflicts with our deep buried roots (likely carves a pit); not pursued.
- Trees rooting on garden grass is acceptable. Still open: gardens/memorials as constrained
  `structure_template_feature`s in a pass before trees (native, no pop-in), which must keep the whole
  footprint inside one chunk (`extent [0, 16 - width]`).
- Owner saw a balcony/lookout pillar left hanging after repair. Root-down reach is already 48 blocks
  (`REPAIR.rootReach`, `village_repair.js`) against a measured worst drop of 24, so the cause is more likely
  a skip (blocked column, unloaded cell, pillar not found from its marker) than the length. Needs the
  coordinates or the repair log before changing anything.
