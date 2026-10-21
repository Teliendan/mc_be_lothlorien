# Native constrained-feature bridge test

## Current result: direct-template baseline PASSED (2026-10-18)

Owner natural-generation observation: all **eight** amethyst sites inspected had
full trees and full glass/sea-lantern roofs. Record this as an owner-reported
in-game visual completeness pass on target Bedrock 1.26.52, not a block-by-block
save comparison. No missing/partial direct-control build was reported. No further
floating-tree or repeated-direction checks are requested for this baseline.
Coordinates, rotations and exact exploration order were not supplied.

This clears the first completeness gate for the tested ordinary single-template
jigsaw child. It does not establish feature-element completeness, terrain fitting,
biome footprint coverage, or whole-build rejection against other structures.

The owner engine rejected the iron envelope's `minecraft:list_pool_element` at
world entry. Its ElementType error explicitly permits only empty, single and
feature pool elements. The missing-pool error follows from that parse failure.
This is a loader failure; revision 2 never tested the bounding-envelope hypothesis.
Official documentation listing list composition disagrees with target 1.26.52.

Revision 3 removes the iron case and all seven obsolete envelope files, including
its invalid pool JSON. Natural diagnostics select only the amethyst direct
template; the older four command fixtures remain available as history. Ordinary
Lothlorien generation is unchanged. The shared verifier now rejects unsupported
pool element types and passes 1536 fixture assertions, including positive controls
for all three accepted types and negative list/legacy/unknown/missing/malformed cases.

Cleanup deployment 2026-10-18: focused probe checks, full project regressions and
shared verification passed. The optional BP retains its one expected inventory
warning; core BP/RP have zero errors/warnings and 15 documented exceptions.
Managed `mods deploy lothlorien --quick` and subsequent `mods status lothlorien`
confirmed all three packs in sync. Shared rule/evidence commit: `041cf16`.

Completed baseline procedure (reference only): reload the disposable test world
after deployment and inspect **three different
amethyst sites** using:

```mcfunction
/locate structure lothlorien:feature_probe_direct_natural
```

The tree should be complete, with four continuous glass sides and four
sea-lantern corners. The tree/glass intentionally float around Y=220..273;
fly around Y=250..285. Record X/Z for any missing/partial build, then save and
leave the world. Existing amethyst sites from revision 2 count: that template,
child pool and structure definition are unchanged. Worldgen distribution changes
need a fresh world for a clean retest, but existing direct-control observations
are still useful. Do not repeat iron tests or east/west worlds.

The observed baseline pass establishes only tested direct-template completeness.
It does not repair the feature bridge, provide intersection rejection, or settle
production collision policy. No supported replacement for list-based feature
bounds was found in this investigation; do not substitute a sibling helper and
assume it changes an individual feature's bounds.

## Revision 2 history: envelope rejected by loader

The following describes the now-retired comparison, not current test instructions.

Revision 2 was deployed but the iron pool failed to parse. It selected two cases
with equal weights in the optional **Lothlorien — Worldgen Test** pack. Ordinary
Lothlorien distribution remained unchanged.

Deployment 2026-10-18: focused geometry/source checks and the full project
regression/verification run passed. Core BP/RP: zero errors/warnings, 15 documented
exceptions. Optional BP: zero errors and its one expected empty-inventory warning.
Managed deployment copied 17 optional-pack files; both core packs already matched.
`mods status lothlorien` confirmed all three packs in sync. Worldgen changes need
a fresh world for this test. Shared diagnostic notes: workspace commit `072e696`.

| Block below the build | Case | Expected result |
| --- | --- | --- |
| Iron | Feature inside a full-size template envelope | Complete tree and complete glass square |
| Amethyst | Same saved tree as an ordinary template child | Complete tree and complete glass square |

Create **one fresh normal Creative world** with normal Lothlorien and the extra
Worldgen Test pack enabled. These are intentionally floating diagnostics, with
the child nominally beginning at Y=220 and the glass at Y=273. The marker is
below, nominally Y=208. Do not judge terrain fitting in this test.

Find each type with:

```mcfunction
/locate structure lothlorien:feature_probe_envelope_natural
/locate structure lothlorien:feature_probe_direct_natural
```

Use the returned X/Z coordinates to travel nearby at about Y=250, then fly to
the build. Inspect **three of each type**, moving several hundred blocks before
locating the next so it is a different site. Check whether the tree exists and
whether the glass has all four continuous sides and all four sea-lantern corners.
Record X/Z and the marker type for a missing/partial build. One world is enough
for this first gate; repeated approach directions are deferred. Save and leave
the world after checking, so a copied-save audit can inspect fully flushed data.
Send any world-entry warning/error before interpreting missing builds.

Optional loaded-command smoke test in a separate disposable flat world:
run `/function lothlorien/feature_bounds_setup`, wait a few seconds, then run
`/function lothlorien/feature_bounds`. Iron is near (8,100,8), amethyst near
(200,100,8); glass is nominally Y=153. Release the temporary ticking areas using
`/function lothlorien/feature_bounds_release`. Commands do not establish natural
completeness; the fresh normal world is the test that matters.

Implementation: both roots are 1x12x1 marker/connector helpers. Each attaches a
40x54x40 child by an input connector at file-local (20,0,20), on the bottom face,
so child and parent bounds abut vertically. The iron child is a rigid list with
a full-size otherwise-void single template first and an unchecked feature second.
The amethyst child contains the same entire payload plus the same connector as a
direct single template. The bounded feature uses ground_level=0 and
rotate_around_center=false to share the template origin. No projection field is
put on feature elements. Both preserve the accepted source and all156 perimeter
blocks. Feature rotation/alignment within the envelope remains an engine-test
question; the declared full box is a diagnostic hypothesis, not a verified fix.
No collision obstacles or intersection gate are included in these two cases.
Even a completeness pass does not establish atomic cross-chunk collision veto.

Reference: [official list-element composition](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/worldgenreference/examples/jigsawpoolelementlist?view=minecraft-bedrock-stable)
documents grouped elements; [feature ground/centering options](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraft_structure_template_feature?view=minecraft-bedrock-stable)
document origin adjustments. Neither promises rollback or natural completeness.

## Revision 1 history

2026-10-17, target Bedrock 1.26.52. **Command test passed; natural-generation
gate FAILED in owner west/east testing. Do not use this design for production.**
No north/south testing is needed to establish that failure.

Owner natural-generation report:

- Selected gold/emerald starts: coloured block only.
- Selected lapis start: coloured block and diamond only.
- Selected redstone start: coloured block, diamond, tree and half a glass frame.
- Additional gold/emerald starts sometimes included trees, with incomplete
  glass frames; no complete natural glass square was observed.
- An additional redstone start had only its coloured block and diamond.

This fails completeness even in unchecked controls. The natural obstacle fixture
also fails to establish reliable whole-payload exclusion. Its diamond remains
part of the carrier, so a tree plus diamond does not by itself prove constraints
ignore an already-present obstacle. Chunk-limited feature writes/feature-element
bounds and write ordering are candidate explanations, not isolated engine facts.
Owner follow-up: the same positions always produced the same outcomes from
east and west. This is repeatable location-dependent failure in the tested
worlds, with no observed approach-direction effect. Do not explain the variation
between different sites as a measured difference between directions at one site.

Further owner clarification: every incomplete glass frame lacked the same part,
identified as lower X and probably lower Z. There was no random variation in
the missing portion. Investigate a systematic spatial cut-off before treating
this as a general prohibition on the feature bridge.

Read-only save audit (owner explicitly authorised West/East inspection): copied
only their LevelDB table/log files into unique workspace temp directories and
used the existing parser without its delete helpers. Saved markers are at
Y=208 and X/Z multiples of16; the command fixtures use offsets8 modulo16.
Saved glass entries found so far are at Y=267. The source has a complete156-block
perimeter, so its absent portion is not missing from the generated asset.
Some expected saved blocks/subchunks are absent; a fully flushed save is needed
before interpreting every absence as an actual empty block.

An inferred parse of tag0x77 records finds a third indexed box at the selected
redstone site (10048,9840), identical in both worlds:
min=(10049,220,9841), max=(10048,219,9840), inclusive size=(0,0,0).
Other entries at that chunk cover the12-block helper or a14-block overall
vertical range ending Y=221, not the54-block payload reaching Y=267.
A gold site at (9648,10368) has the same zero-volume pattern. Other gold entries
contain only helper records. This is a concrete bounding-volume lead, not a
fully documented binary-format interpretation or a verified causal fix.
The next diagnostic candidate was a full-size template envelope through a list
element. Revision 2 above implements that comparison; its engine result remains
pending. Do not assume list grouping provides whole-operation rollback.

Further save evidence: inferred tag0x78 start-record parsing consumed every byte
of21 West and24 East probe records. Each has the known carrier asset followed
by the known feature ID, position, rotation, bounds and junction data. ALL45
feature entries have inclusive size(0,0,0), while the payload is40x54x40.
For a `none` rotation at chunk-corner position P, the saved box is P through
P-(1,1,1); for `_180`, X/Z min is P+1 and max is P. The latter remains in the
same horizontal chunk; the former straddles the boundary with an inverted box.
Under ordinary AABB/chunk intersection rules this explains why different seeded
rotations can be skipped consistently at different locations. This causal step
is inferred; native scheduler code was not inspected.

All three West sites with glass found in the copied snapshot correspond to
`_180` feature instances: (9216,10064), (9648,10368), (9824,10240). Other currently
saved block fragments may be incomplete snapshots; no exact full-world equality
claim is made. The matching redstone start at(10048,9840) has identical `_180`
feature bounds in both worlds. This strengthens the explicit-bounds diagnostic
proposal. It does not prove that fixing bounds also makes collision veto atomic
across chunks.

The command result remains valid for loaded terrain with independently preplaced
obstacles. It cannot justify deploying this wrapper for large trees, villages or
shrines in natural worldgen. Ordinary Lothlorien distribution was not changed.
The optional test pack can now be disabled in ordinary/test worlds; existing
diagnostic blocks remain in test-world saves. The instructions below are the
completed experiment's reference, not a request for more direction trials.

This experiment answers whether a jigsaw-called saved-tree
feature spans chunks and rejects its whole payload against a distant obstacle.
It does not change ordinary Lothlorien distribution. Everything lives in the
optional **Lothlorien — Worldgen Test** behavior pack
(`lothlorien_feature_probe_bp`), dependent on the normal Lothlorien pack.
Enable that extra pack only in disposable test worlds. Its natural diagnostics
are enabled when the pack is active. No script places these trees.

Deployment status, 2026-10-17: full Lothlorien project regressions passed.
The optional pack passed shared verification with zero errors and one expected
inventory warning (no item/block/entity definitions in this worldgen-only BP).
All three packs are deployed and confirmed in sync. Native results remain pending.

Owner world-entry log, 2026-10-17, rejected `projection` on the two feature
pool elements and the unchecked feature's missing `constraints` object. The
generator now omits feature-element projection and writes `constraints: {}`
for the control. Carrier single-template elements retain their valid projection.
Focused checks and 1527 shared-verifier fixture assertions pass. The initial
registration failure does not establish any placement or clipping result;
corrected engine loading and all four placement cases remain to be tested.

Schema correction deployed 2026-10-17: full project verification passed; exactly
three optional-pack JSON files copied. Core packs needed no copying. All three
packs confirmed in sync; the optional pack retains only its expected inventory
warning. Reload before repeating the command fixture; natural-generation tests
need fresh worlds/chunks and cannot reuse starts generated while the feature
was unregistered.

Owner command observation after the schema correction: four trees, each with
its coloured block beneath and a glass square with sea-lantern corners above.
Those coloured blocks are what the earlier guide called labels. The original
single diamond's location/state was not observed, so rejection is inconclusive.
The diamond lived in the same carrier as the feature connector; its writes may
occur after the feature check. That is an ordering hypothesis, not an engine fact.

The revised runner independently places four visible diamond pillars before
invoking each obstructed case. Each pillar is 6x6 and 21 blocks tall (Y=90..110),
at the four outer corners of the lapis/redstone fixtures, in other chunks.
Under the existing positioning model these touch diagnostic air, not saved
tree solids or the glass frame; focused offline checks enforce that geometry.
This removes dependence on carrier writes for the command obstacle fixture.

Visible-obstacle revision deployed 2026-10-17: full project verification passed;
two optional-pack function files copied, all three packs confirmed in sync.
Reload and rerun setup/runner in the existing command-test world. New pillar
rejection observations are pending.

Owner result after that deployment: gold/emerald had coloured block, tree and
glass; lapis had coloured block, diamond, tree and glass; redstone had coloured
block and diamond only. This is a visual pass for positive invocation and
whole visible payload rejection against independently preplaced obstacles.
The owner did not separately describe the lapis pillar air band or supply an
exact block comparison; those details must not be invented. Natural chunk
completion/order, independent village-before-tree scheduling, terrain fitting
and reserved empty settlement space remain outside this result.

## Quick command test

Use a **new disposable FLAT Creative world** with normal Lothlorien, the additional
**Lothlorien — Worldgen Test** behavior pack, and cheats enabled, after the current
packs have been deployed. The runner clears four fixed sky
volumes around x=8,136,264,392 / z=8, from y=80 through 159. This is a deliberately
floating diagnostic, not terrain integration. Do not run it in a valued world.

```
/function lothlorien/feature_probe_setup
```

Wait a few seconds for its four rectangular ticking areas to load, then:

```
/function lothlorien/feature_probe
```

The function resets all four fixtures, places diamond pillars at the lapis and
redstone cases, then invokes their native jigsaws. It moves you beside the
redstone case facing it. The gold/emerald/lapis/redstone blocks underneath are
case identifiers. Fly west (decreasing X) to inspect the other three cases.

| x / label | Case | Expected if this mechanism works |
| --- | --- | --- |
| 8 / gold | No constraints, clear | Whole tree and full glass square; no diamond |
| 136 / emerald | Intersection constraint, clear | Same whole tree and full square |
| 264 / lapis | No constraints, preplaced diamond pillars | Whole tree and square; an air band cut through the pillars |
| 392 / redstone | Intersection constraint, same preplaced pillars | Coloured block and four uncut pillars; **no tree, glass or sea lanterns anywhere** |

The redstone pillars occupy X=371..376 or 408..413, Z=-13..-8 or 24..29,
Y=90..110. They should be obvious from the runner's final viewpoint. To return
to that view without resetting the experiment:

```
/function lothlorien/feature_probe_view
```

Each payload contains the unchanged accepted plain Mallorn `roundplain_02`
(40×54×40), plus test-only additions in previously void cells: an explicit-air
plane at local y=4, and a glass perimeter with sea-lantern corners at local y=53.
The air plane deliberately tests intersection checks including saved air; it
would carve existing blocks in the unchecked control. It is not a production
clearance design. All original saved tree entries are preserved.

Nominal positions, inferred from the native anchor/adjacent-connector convention:
the root connector is at y=100; payload invocation at y=101; payload base 95,
ground 101, diagnostic top 148; case label 89; diamond 99. The square should extend
about 20 blocks in all horizontal directions from each start. Check the observed
positions before interpreting results; offset/centering behavior is still an
engine question. The legacy single diamond is 18 blocks diagonally from the start,
rotating with the carrier, so it is in another chunk on both axes for these
command coordinates. Its expected x/z is `(start x ±18, 8 ±18)`.

The carrier is mostly structure void. All four have the same 41×12×41 bounding
box. The feature connector points upward, with its intended child point above
that box; the case label is below the entire payload. This avoids building a
carrier that occupies the feature's attachment cell. The obstacle intersects
diagnostic **air**, not a tree root, under either plausible integer centering
convention. Offline tests check those coordinates and every quarter turn.

Interpret results in this order:

1. No case label: carrier placement/loading failed. Read the command result and
   Content Log; absence of the tree is not a successful rejection.
2. Gold label but no tree/square: feature invocation failed. Do not classify the
   redstone case as a pass. On this already cleared fixture, troubleshoot with
   `/place feature lothlorien:feature_probe_control 8 101 8`. If this direct call
   works, the bridge/connection is suspect; if it fails, investigate the feature,
   template, placement height or log. This troubleshooting changes the fixture;
   rerun the runner for a clean comparison.
3. Gold works but emerald does not: the checked-clear control failed, so a
   redstone-only result does not establish obstacle rejection. Constraints may
   be checking another placement context, or coordinates may differ.
4. Lapis has a tree but no air band through any pillar: the payload did not
   reach the intended obstacle plane, or explicit air is handled differently.
   Inspect its actual height/position; redstone is inconclusive.
5. Gold, emerald and lapis have whole trees/full squares, lapis pillars have
   an air band, and redstone retains uncut pillars with zero payload remnants:
   **command-path pass** against independently preplaced obstacles.
6. A tree over redstone with a matching air band through its pillars means the
   required air-volume rejection did not occur. Preserve that observation; do
   not claim all other intersection constraints are ineffective. Missing or
   shifted pillars are an inconclusive fixture until their reach is established.
   Any cropped tree/frame also needs investigation as a completeness failure.

Inspect all four edges and corners across chunk borders. A full top square is
a useful clipping indicator, not proof that every trunk/root entry survived;
also compare the source tree geometry. Record command messages, Content Log,
coordinates, case colours and which chunks contain missing parts. Re-running
the runner resets the four fixtures, including old labels and diamonds.

Individual commands below are invocation troubleshooting only: they do not
independently preplace the pillars. Use the full runner for collision testing.

```
/place structure lothlorien:feature_probe_control 8 100 8
/place structure lothlorien:feature_probe_checked 136 100 8
/place structure lothlorien:feature_probe_control_blocked 264 100 8
/place structure lothlorien:feature_probe_checked_blocked 392 100 8
```

After inspection, release the command-test ticking areas:

```
/function lothlorien/feature_probe_release
```

## Natural generation: indispensable second gate

The revised command gate has visually passed. Loaded
command placement does not establish worldgen safety. The optional test
pack already contains the natural diagnostic set. The ordinary packs contain
none of its definitions or starts. Regeneration/deployment from the workspace is:

```powershell
node mods/lothlorien/tools/build_constrained_feature_probe.mjs
.\mods deploy lothlorien
.\mods status lothlorien
```

Only the optional pack contains `worldgen/structure_sets/feature_probe_natural.json`. It selects the
same four cases equally, spacing 12/separation 4 with its own salt. Existing tree,
garden and memorial sets are untouched. This test set applies to Overworld-tagged
biomes. Natural probes use absolute y=220, with no heightmap projection, to isolate
chunk behavior from slope/terrain. Expect label 209, diamond 219, payload 215..268
and ground 221; these are likewise inferred until observed. Avoid mountainous
sites whose terrain enters that range. Floating diagnostic trees are intentional.

Create a discovery world with a recorded seed, the optional test pack enabled,
and unchanged pack/settings.
Far from spawn, find candidate coordinates with:

```
/tp @s 10000 280 10000
/locate structure lothlorien:feature_probe_control_natural
/locate structure lothlorien:feature_probe_checked_natural
/locate structure lothlorien:feature_probe_control_blocked_natural
/locate structure lothlorien:feature_probe_checked_blocked_natural
```

Record one distant start of each case, and inspect the discovery world to check
that all positive controls can actually generate. Then create **two fresh worlds
with that same seed, packs and settings**, both with the test set already active.
Do not use the command fixture functions or ticking areas in these worlds.

For each recorded candidate `(X,Z)`, use render distance 8 chunks, teleport to
`(X-1024,280,Z)` in world A and `(X+1024,280,Z)` in world B, then fly steadily toward
the start from west/east respectively. Do not teleport directly into its footprint
or visit it beforehand. The 1024-block stand-off keeps the candidate outside the
initial generated view. Discovery, A and B must be independent worlds: already
generated chunks do not test another generation order. Test a north/south pair
too if the first pair passes.

Natural cases retain the original carrier-contained single diamond. They do
not receive the command runner's preplaced pillars. For natural controls, the
unchecked obstructed case must establish where that diamond is written, while
the checked obstructed case must retain it with no payload. If carrier ordering
prevents a valid obstacle check, this natural design has not established safety,
even if preplaced command obstacles work.

Repeat several candidates: natural
starts may have other within-chunk offsets than the fixed command fixture. A
failure in either approach direction rejects this architecture. If native
placement generates payload blocks separately while the carrier diamond is
written later, the redstone case may expose exactly that order problem.
The test's own single diamond may also be missing/clipped: that is an inconclusive
fixture, not a rejection pass, until both obstacle controls have been checked.

After this experiment, leave the optional test pack disabled in ordinary worlds.
It can stay installed. The generator always creates its diagnostic set; enabling
the optional pack is the opt-in, with no production-set changes. Removing the
pack from an existing test world does not remove diagnostic trees already built.

## Limits and sources

Passing would establish this particular payload/check bridge under tested chunk
orders. It would not prove independent village/tree scheduling, reservation of
village airspace, terrain suitability or a minimum gap. The allowlist here is
air-only and has no terrain constraints, intentionally isolating one question.

Formats checked against installed 26.50 abandoned-camp feature pools and 26.30
sulfur-spring structure-template features, plus current official docs/changelog:

- [Feature pool element](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/worldgenreference/examples/jigsawpoolelementfeature?view=minecraft-bedrock-stable)
- [Structure-template feature](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecraft_structure_template_feature?view=minecraft-bedrock-stable)
- [26.20 release, feature-pool support](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-20-changelog)
- [Place command](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/place?view=minecraft-bedrock-stable)

Run `node mods/lothlorien/tests/constrained_feature_probe.mjs` for focused offline
checks and `.\mods verify lothlorien` for the shared verifier/full suite. Neither
can certify engine results. The owner-observed command result is recorded above;
natural-generation observations remain pending.
