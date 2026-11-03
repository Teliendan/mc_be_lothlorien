# Block materials

M5 phial helper (2026-10-11): `phial_light` is a temporary airlike utility,
functionally analogous to `minecraft:light_block`. Its ledger uses the existing
redstone-device destruction profile solely for zero mining/blast resistance, no preferred
tool and nonflammability; this is a deliberate utility choice, not a claim of
vanilla light-block mining parity. Empty loot prevents collection. It emits 14,
blocks no movement or sight selection, dampens no light, conducts no redstone
and pops without drops under piston movement so it cannot leave an untracked
relocated helper. Source/mock reviewed; native light, fluid and piston behavior
needs Bedrock 1.26.52 acceptance. See [GIFTS.md](GIFTS.md).

2026-10-09, Bedrock 1.26.52. Policy: `lothlorien_bp/block_materials.json`.
Shared standard: `C:/mcmods/.claude/skills/bedrock-blocks/references/materials.md`.
All choices are reference-based; new engine timing/fire/explosion tests are pending.

Owner game acceptance, 2026-10-10 / target 1.26.52: the tested door worked well.
Exact variant and scenario were not specified; this does not certify every door
state/variant or all destruction parameters. Other game checks below remain pending.

Remaining-property batch, 2026-10-10: both single slabs and both stairs now use
oak shape dampening 0 and explicit nonconduction. Both leaf blocks use native
leaf piston reaction `popped`; default push/pull was unintended. Exact values
and sources are enforced by `property_checks` in the existing material policy.
The support post-pass retains these defaults after regeneration and preserves
reviewed explicit values. Double slabs retain their separate solid-cube policy.
No support-survival script, geometry or door behavior was rewritten.

## Block support shape (owner decision 2026-11-04)

Vanilla thin and decorative blocks (flowers, ferns, leaf litter, petals, buttons, plates, lanterns, doors,
gates) give no support, so nothing should stand on or hang from them. Custom blocks cannot say "none" natively;
the owner chose the "stair trick": `"minecraft:support": {"shape": "stair"}` on a block that declares no
stair states. It is applied by `tools/configure_support.py` (set `NO_SUPPORT`, so a regenerated block cannot
drift; `tests/stair_support.mjs` asserts the set and that no permutation overrides it):

athelas, elanor, niphredil, golden_fern, mallorn_sapling, great_mallorn_sprout, western_corn, deer_antler,
both elven lanterns, elven_chandelier, firefly_jar, phial_light, both buttons, both pressure plates, both
doors, both fence gates, mallorn_leaf_carpet (all four amounts) and mallorn_blossom (the two covers were `fence`
before). Unchanged: elven_rope and elven_rope_hanging (vanilla chain gives centre support; lanterns hang from
the rope), trapdoors, slabs, stairs, fences (`fence`) and full blocks. Not in the set: memorial_seed (a log
look-alike full cube), star_canopy (full cube) and nectar_bloom (a hanging bloom with a placement filter only);
all three keep default support.

Evidence: the trick was verified in game on the `supportprobe` pack (Bedrock 1.26.60.5, 2026-11-03/04):
nothing can be placed on the top or bottom face, side clicks redirect the item to the floor or the face behind,
worlds with torches, redstone, buttons and lanterns around the probes reloaded 2-3 times after full restarts
without a crash. **The Lothlorien blocks themselves are not yet checked in game.** Open: the doors, gates,
deer_antler, carpets and blossom declare a direction trait (no `vertical_half`); the shared verifier warns
for that partial state set because the probe tested blocks with no stair states at all.
Shared record: `.claude/skills/bedrock-blocks/references/support-collision-properties.md`.

Shared schema checks now cover support, placement, boxes, friction, replacement,
connections, light/redstone/movement, sounds/particles/weather/transforms/ticks,
flower-pot markers and fence leash anchors. Current declarations pass; schema
acceptance does not establish geometry, weather, knot-height or connection parity.
Owner answers, 2026-10-10: golden fern stays nonreplaceable; framed lights keep
wood sounds and ropes keep grass sounds as approved exceptions. These choices
now have checked property records (including absence and RP sound precedence).
Trapdoors should match vanilla Bedrock. Correction to the earlier question:
extracted Bedrock 1.26.30 trapdoor thickness is 0.1825 block = 2.92 units, already our
collision size. Retain matching selection and the existing 2.9-unit recipe mesh;
do not substitute 3 units from a generic/Java trapdoor assumption. Mesh/selection
native parity is not independently measured; collision source and limits are
in the shared support reference. Exact base boxes are recorded against drift.

Vanilla particle choice: eight full wood cubes/double slabs currently use 100;
four single slabs/stairs and 12 other partials use 48. Evidence correction: 100 is
the custom component default and 48 comes from wool/concrete shapes; neither
proves native oak counts. All are candidates awaiting engine measurement.
Owner requests vanilla; no aesthetic exception is approved.
The support post-pass restores reviewed counts after regeneration. The normal
shared verifier enforces recorded matched values and approved exceptions.
Earlier five design questions are resolved; slab/stair lighting, leaf pistons, particles and
other current behavior need game acceptance after reloading the deployed pack.

| Family | Counterpart | Mining parameter / blast | Efficient tools |
| --- | --- | --- | --- |
| Planks, slab/double slab, stairs, fence/gate (both colours) | Oak wood construction | 2 / 3 | axe |
| Log, wood, stripped variants | Oak log | 2 / 2 | axe |
| Door/trapdoor (both colours) | Oak door/trapdoor | 3 / 3 | axe |
| Button/pressure plate (both colours) | Oak button/plate | 0.5 / 0.5 | axe |
| Both leaves | Oak leaves | 0.2 / 0.2 | hoe, shears |
| Lanterns/chandelier | Lantern | 3.5 / 3.5 | pickaxe |
| Firefly jar | Glass | 0.3 / 0.3 | any |
| Antler | Bone block | 2 / 2 | pickaxe |
| Star canopy (stone-backed recipe) | Deepslate tiles | 3.5 / 6 | pickaxe |
| Both ropes | Ladder | 0.4 / 0.4 | axe |
| Flowers, fern, crop, sapling, segmented cover | Corresponding plant family | 0 / 0 | any; fern shears |

Logs now use fire 5/5; plank construction remains 5/20; leaves remain 30/60.
Wooden doors and controls are nonburning; sapling and corn use nonflammable
sapling/crop profiles. Rope and segmented cover deliberately retain 60/100
organic fire as documented custom exceptions. The great-tree sprout remains
mining 0 / blast 1200 for its protected scripted growth lifecycle.

Harvest remains separate from speed: normal leaves collect exactly one leaf item
with shears or Silk Touch, suppressing auxiliary drops. Other tools and decay use
independent 2% stick (1–2 items) and custom 2% acorn pools. Native explosion decay
processes these item entries. Owner retains custom acorn rarity with Fortune:
2/2.5/3.333.../4%; sticks use Wiki rates 2/2.222.../2.5/3.333...% at standard
levels. See [LEAF_HARVEST.md](LEAF_HARVEST.md); engine acceptance is pending.
Golden decorative leaves
intentionally always self-drop and do not decay. Nectar bloom is explicitly
collectible with shears or Silk Touch (owner 2026-10-11), with native blast decay.
Owner 2026-10-13: golden fern collects like a flower, one fern with any tool
or by hand, instant mining, no wheat-seed pool or Fortune bonus. Native decay
remains. Deer antlers now also mine instantly with any tool or by hand; a
reasoned mining override retains their bone blast/fire/sound policy. See
[GOLDEN_FERN_HARVEST.md](GOLDEN_FERN_HARVEST.md) for source/engine limits.
Both double slabs use set_count2 followed by native explosion_decay, matching
the installed data-driven double-slab recipe.

Owner policy corrected 2026-10-10: the efficient tool generally changes mining
time rather than restricting collection. Star canopy collects with any tool or
hand; pickaxe remains its efficient tool. Native self loot and explosion decay
remain authoritative. The added scripted collection gate and its private tool
wear helper were removed. The explicit fern collection restriction and separate
Starstone ore gate remain governed by their recorded policies. See
[STAR_CANOPY_HARVEST.md](STAR_CANOPY_HARVEST.md).
The ordinary-block loot audit and nectar-bloom repair are recorded in
[ORDINARY_HARVEST.md](ORDINARY_HARVEST.md).

Owner 2026-10-10: firefly jar is reusable and deer antler is an any-tool collectible.
Their existing native default self-drops already satisfy this; no collection gate
is added from the separate glass/bone material or efficient-tool profile.
Regression checks protect their ungated base/permutation loot route.

Western corn harvest now follows Bedrock wheat: young crop one seed; mature
crop one grain and Binomial(3+Fortune, 8/15) seeds at standard levels I–III.
Custom grain/seed identities and growth remain. This is Wiki-documented and
regression-tested, pending native engine acceptance. See
[WESTERN_CORN_HARVEST.md](WESTERN_CORN_HARVEST.md).

Owner 2026-10-10 reports that potted plants were tested and worked. Exact tested
plants, pot contents and removal scenarios were not specified, so this records
the owner's successful report without claiming every pot/state route was tested.

Generators for lamps, nectar bloom and star canopy now keep these material
numbers. Run the shared verifier after regeneration; it reports policy drift.

Pending game acceptance: compare all wood subfamilies with oak (including fire
and lava separately), leaves with hoe/shears/hand and correct drops, framed lamps
versus glass jar, rope break/removal lifecycle, protected growth marker and TNT
cleanup. Static verification does not establish native tool multipliers or lava parity.
