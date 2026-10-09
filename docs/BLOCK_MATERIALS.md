# Block materials

2026-10-09, Bedrock 1.26.52. Policy: `lothlorien_bp/block_materials.json`.
Shared standard: `C:/mcmods/.claude/skills/bedrock-blocks/references/materials.md`.
All choices are reference-based; new engine timing/fire/explosion tests are pending.

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
