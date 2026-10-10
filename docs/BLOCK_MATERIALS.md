# Block materials

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

Shared schema checks now cover support, placement, boxes, friction, replacement,
connections, light/redstone/movement, sounds/particles/weather/transforms/ticks,
flower-pot markers and fence leash anchors. Current declarations pass; schema
acceptance does not establish geometry, weather, knot-height or connection parity.
Owner answers, 2026-10-10: golden fern stays nonreplaceable; framed lights keep
wood sounds and ropes keep grass sounds as approved exceptions. These choices
now have checked property records (including absence and RP sound precedence).
Trapdoors should match vanilla Bedrock. Correction to the earlier question:
extracted Bedrock1.26.30 trapdoor thickness is0.1825block=2.92units, already our
collision size. Retain matching selection and the existing2.9-unit recipe mesh;
do not substitute3units from a generic/Java trapdoor assumption. Mesh/selection
native parity is not independently measured; collision source and limits are
in the shared support reference. Exact base boxes are recorded against drift.

Vanilla particle choice: eight full wood cubes/double slabs currently use100;
four single slabs/stairs and12other partials use48. Evidence correction:100 is
the custom component default and48 comes from wool/concrete shapes; neither
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
processes these item entries. Full Fortune numeric parity and the acorn's
sapling-equivalent rate remain pending; see [LEAF_HARVEST.md](LEAF_HARVEST.md).
Golden decorative leaves
intentionally always self-drop and do not decay. Nectar bloom's existing shears
loot gate remains. Golden fern now follows the native baseline: shears collect
one fern, otherwise a1/8wheat-seed chance, with native decay. Enchantment parity
is still pending; see [GOLDEN_FERN_HARVEST.md](GOLDEN_FERN_HARVEST.md).
Both double slabs use set_count2 followed by native explosion_decay, matching
the installed data-driven double-slab recipe. Other tool gates remain audited
but unresolved; see workspace `docs/block-loot-particles-questions.md`.

Generators for lamps, nectar bloom and star canopy now keep these material
numbers. Run the shared verifier after regeneration; it reports policy drift.

Pending game acceptance: compare all wood subfamilies with oak (including fire
and lava separately), leaves with hoe/shears/hand and correct drops, framed lamps
versus glass jar, rope break/removal lifecycle, protected growth marker and TNT
cleanup. Static verification does not establish native tool multipliers or lava parity.
