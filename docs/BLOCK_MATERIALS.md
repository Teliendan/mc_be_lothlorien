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
Pending owner choices: golden-fern replacement, framed-light/rope sounds,
trapdoor thickness and wood particles. Current behavior remains until answered;
see workspace `docs/block-property-questions.md`. New slab/stair lighting and
leaf piston behavior need game acceptance after reloading the deployed pack.

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

Harvest remains separate from speed: normal leaves collect leaf items with
shears; existing random stick/acorn pools remain (including alongside shearing).
Normal leaf Silk Touch/Fortune parity is still pending. Golden decorative leaves
intentionally always self-drop and do not decay. Nectar bloom's existing shears
loot gate remains. No new tool requirements are imposed on other loot tables.

Generators for lamps, nectar bloom and star canopy now keep these material
numbers. Run the shared verifier after regeneration; it reports policy drift.

Pending game acceptance: compare all wood subfamilies with oak (including fire
and lava separately), leaves with hoe/shears/hand and correct drops, framed lamps
versus glass jar, rope break/removal lifecycle, protected growth marker and TNT
cleanup. Static verification does not establish native tool multipliers or lava parity.
