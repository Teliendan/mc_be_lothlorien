# lothlorien: tag/family audit

2026-10-13; target Bedrock 1.26.52 / Script API 2.8.0. Source revision `8a959d9`.

Status: source inventory and official-documentation review. Approved classifications implemented 2026-10-13; no new engine tests. A reasoned omission is a valid audit result. See the implementation update below.

Scope: 45 block definitions, 19 entity definitions, across every `*_bp` pack in this mod. Relevant explicit item tags were cross-checked for the block/item distinction.

## Recommendations and effects

Owner decisions, implemented 2026-10-13:

1. Butterfly and firefly: existing own-family + `mob` lists now include
   `arthropod`. This enables arthropod filters and expected Bane damage/slowness
   per official documentation; the effect needs an engine check.
2. Western Corn: block tags now include `minecraft:crop`. This supplies crop
   classification, with no promised change to growth, farming or harvesting.
3. Elf posts: retain role-group families and an unclassified base. Exact-ID
   queries and the unassigned-post fallback already handle the pre-role state;
   an existing regression explicitly asserts group-owned families. No current
   practical benefit was found for the proposed base-family addition.

Retain all other families and block tags/omissions. Animals already use distinct mod families plus `mob`; there is no need for a blanket `animal` family. Keep the Warden's intentional `irongolem` family, the arrow's `projectile`/`arrow`, boat families and existing helper classifications. Do not substitute vanilla prey families (`rabbit`, `chicken`, etc.). Keep both `leaves` and `minecraft:leaves`: local tree `may_replace` predicates still query the bare spelling, while current vanilla trees use the namespaced spelling. Leaf carpet remains a thin cover, not full leaves.

Flowers now carry custom classification lothlorien:flower; approved membership and effects are below. Potting/composting are separate components; current pottable decisions, including stateful exclusions, are outside the proposed tag-only changes. No invented vanilla flower tag is recommended. Existing wood recipe item tags are listed below and must stay separate from block tags.

## Complete block inventory

Tags below are declared in root components. `omitted` and `[]` both mean no declared tags; they are retained by design unless a proposal above says otherwise. The material profile records the existing mining/harvest policy; a tag is not a harvest gate.

| Block | Declared tags | Profile / decision |
| --- | --- | --- |
| [lothlorien:athelas](../lothlorien_bp/blocks/athelas.json) | `lothlorien:flower` | `flower`; retain |
| [lothlorien:deer_antler](../lothlorien_bp/blocks/deer_antler.json) | `minecraft:is_pickaxe_item_destructible` | `bone`; retain |
| [lothlorien:elanor](../lothlorien_bp/blocks/elanor.json) | `lothlorien:flower` | `flower`; retain |
| [lothlorien:elven_chandelier](../lothlorien_bp/blocks/elven_chandelier.json) | `minecraft:is_pickaxe_item_destructible` | `lantern`; retain |
| [lothlorien:elven_lantern](../lothlorien_bp/blocks/elven_lantern.json) | `minecraft:is_pickaxe_item_destructible` | `lantern`; retain |
| [lothlorien:elven_lantern_heartwood](../lothlorien_bp/blocks/elven_lantern_heartwood.json) | `minecraft:is_pickaxe_item_destructible` | `lantern`; retain |
| [lothlorien:elven_rope](../lothlorien_bp/blocks/elven_rope.json) | `minecraft:is_axe_item_destructible` | `ladder`; retain |
| [lothlorien:elven_rope_hanging](../lothlorien_bp/blocks/elven_rope_hanging.json) | `minecraft:is_axe_item_destructible` | `ladder`; retain |
| [lothlorien:firefly_jar](../lothlorien_bp/blocks/firefly_jar.json) | omitted | `glass`; retain |
| [lothlorien:golden_fern](../lothlorien_bp/blocks/golden_fern.json) | `minecraft:is_shears_item_destructible`, `lothlorien:flower` | `fern`; retain |
| [lothlorien:great_mallorn_sprout](../lothlorien_bp/blocks/great_mallorn_sprout.json) | `[]` | `sapling`; retain |
| [lothlorien:mallorn_blossom](../lothlorien_bp/blocks/mallorn_blossom.json) | `lothlorien:flower` | `ground_cover`; retain |
| [lothlorien:mallorn_button](../lothlorien_bp/blocks/mallorn_button.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_control`; retain |
| [lothlorien:mallorn_door](../lothlorien_bp/blocks/mallorn_door.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_door`; retain |
| [lothlorien:mallorn_double_slab](../lothlorien_bp/blocks/mallorn_double_slab.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_planks`; retain |
| [lothlorien:mallorn_fence](../lothlorien_bp/blocks/mallorn_fence.json) | `wood`, `minecraft:is_axe_item_destructible`, `minecraft:has_fence_connections` | `wood_planks`; retain |
| [lothlorien:mallorn_fence_gate](../lothlorien_bp/blocks/mallorn_fence_gate.json) | `wood`, `minecraft:is_axe_item_destructible`, `minecraft:has_fence_connections` | `wood_planks`; retain |
| [lothlorien:mallorn_golden_leaves](../lothlorien_bp/blocks/mallorn_golden_leaves.json) | `minecraft:is_hoe_item_destructible`, `leaves`, `minecraft:leaves`, `minecraft:is_shears_item_destructible` | `leaves`; retain |
| [lothlorien:mallorn_heartwood_button](../lothlorien_bp/blocks/mallorn_heartwood_button.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_control`; retain |
| [lothlorien:mallorn_heartwood_door](../lothlorien_bp/blocks/mallorn_heartwood_door.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_door`; retain |
| [lothlorien:mallorn_heartwood_double_slab](../lothlorien_bp/blocks/mallorn_heartwood_double_slab.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_planks`; retain |
| [lothlorien:mallorn_heartwood_fence](../lothlorien_bp/blocks/mallorn_heartwood_fence.json) | `wood`, `minecraft:is_axe_item_destructible`, `minecraft:has_fence_connections` | `wood_planks`; retain |
| [lothlorien:mallorn_heartwood_fence_gate](../lothlorien_bp/blocks/mallorn_heartwood_fence_gate.json) | `wood`, `minecraft:is_axe_item_destructible`, `minecraft:has_fence_connections` | `wood_planks`; retain |
| [lothlorien:mallorn_heartwood_planks](../lothlorien_bp/blocks/mallorn_heartwood_planks.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_planks`; retain |
| [lothlorien:mallorn_heartwood_pressure_plate](../lothlorien_bp/blocks/mallorn_heartwood_pressure_plate.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_control`; retain |
| [lothlorien:mallorn_heartwood_slab](../lothlorien_bp/blocks/mallorn_heartwood_slab.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_planks`; retain |
| [lothlorien:mallorn_heartwood_stairs](../lothlorien_bp/blocks/mallorn_heartwood_stairs.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_planks`; retain |
| [lothlorien:mallorn_heartwood_trapdoor](../lothlorien_bp/blocks/mallorn_heartwood_trapdoor.json) | `wood`, `minecraft:is_axe_item_destructible`, `trapdoors`, `one_way_collidable` | `wood_door`; retain |
| [lothlorien:mallorn_leaf_carpet](../lothlorien_bp/blocks/mallorn_leaf_carpet.json) | omitted | `ground_cover`; retain |
| [lothlorien:mallorn_leaves](../lothlorien_bp/blocks/mallorn_leaves.json) | `minecraft:is_hoe_item_destructible`, `leaves`, `minecraft:leaves`, `minecraft:is_shears_item_destructible` | `leaves`; retain |
| [lothlorien:mallorn_log](../lothlorien_bp/blocks/mallorn_log.json) | `wood`, `minecraft:is_axe_item_destructible`, `log` | `wood_log`; retain |
| [lothlorien:mallorn_planks](../lothlorien_bp/blocks/mallorn_planks.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_planks`; retain |
| [lothlorien:mallorn_pressure_plate](../lothlorien_bp/blocks/mallorn_pressure_plate.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_control`; retain |
| [lothlorien:mallorn_sapling](../lothlorien_bp/blocks/mallorn_sapling.json) | `[]` | `sapling`; retain |
| [lothlorien:mallorn_slab](../lothlorien_bp/blocks/mallorn_slab.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_planks`; retain |
| [lothlorien:mallorn_stairs](../lothlorien_bp/blocks/mallorn_stairs.json) | `wood`, `minecraft:is_axe_item_destructible` | `wood_planks`; retain |
| [lothlorien:mallorn_stripped_log](../lothlorien_bp/blocks/mallorn_stripped_log.json) | `wood`, `minecraft:is_axe_item_destructible`, `log` | `wood_log`; retain |
| [lothlorien:mallorn_stripped_wood](../lothlorien_bp/blocks/mallorn_stripped_wood.json) | `wood`, `minecraft:is_axe_item_destructible`, `log` | `wood_log`; retain |
| [lothlorien:mallorn_trapdoor](../lothlorien_bp/blocks/mallorn_trapdoor.json) | `wood`, `minecraft:is_axe_item_destructible`, `trapdoors`, `one_way_collidable` | `wood_door`; retain |
| [lothlorien:mallorn_wood](../lothlorien_bp/blocks/mallorn_wood.json) | `wood`, `minecraft:is_axe_item_destructible`, `log` | `wood_log`; retain |
| [lothlorien:nectar_bloom](../lothlorien_bp/blocks/nectar_bloom.json) | `lothlorien:flower` | `flower`; retain |
| [lothlorien:niphredil](../lothlorien_bp/blocks/niphredil.json) | `lothlorien:flower` | `flower`; retain |
| [lothlorien:phial_light](../lothlorien_bp/blocks/phial_light.json) | omitted | `redstone_device`; retain |
| [lothlorien:star_canopy](../lothlorien_bp/blocks/star_canopy.json) | `minecraft:is_pickaxe_item_destructible` | `stone_tiles`; retain |
| [lothlorien:western_corn](../lothlorien_bp/blocks/western_corn.json) | `minecraft:crop` | `crop`; approved classification implemented |

Inspected all block permutations: 0 tag-component overrides. Other components still vary by state; no all-state engine behavior is claimed.

## Complete entity inventory

| Entity | Base families | Group overrides / decision |
| --- | --- | --- |
| [lothlorien:butterfly](../lothlorien_bp/entities/butterfly.json) | `lothlorien_butterfly`, `mob`, `arthropod` | Approved arthropod classification implemented |
| [lothlorien:deer](../lothlorien_bp/entities/deer.json) | `lothlorien_deer`, `mob` | Retain |
| [lothlorien:elf](../lothlorien_bp/entities/elf.json) | `lothlorien_elf`, `mob` | Retain |
| [lothlorien:elf_post](../lothlorien_bp/entities/elf_post.json) | omitted | `lothlorien:post_loremaster`: `lothlorien_elf_post`, `elf_post_loremaster`, `inanimate`; `lothlorien:post_reserve`: `lothlorien_elf_post`, `elf_post_reserve`, `inanimate`; `lothlorien:post_home`: `lothlorien_elf_post`, `elf_post_home`, `inanimate`; Retain role-group ownership; no useful current base-family consumer |
| [lothlorien:elven_warden](../lothlorien_bp/entities/elven_warden.json) | `lothlorien_warden`, `irongolem`, `mob` | Retain |
| [lothlorien:firefly](../lothlorien_bp/entities/firefly.json) | `lothlorien_firefly`, `mob`, `arthropod` | Approved arthropod classification implemented |
| [lothlorien:galadhrim_arrow](../lothlorien_bp/entities/galadhrim_arrow.json) | `projectile`, `arrow` | Retain |
| [lothlorien:guide_beacon](../lothlorien_bp/entities/guide_beacon.json) | `lothlorien_guide_beacon`, `inanimate` | Retain |
| [lothlorien:loop_marker](../lothlorien_bp/entities/loop_marker.json) | `lothlorien_loop_marker`, `inanimate` | Retain |
| [lothlorien:mallorn_boat](../lothlorien_bp/entities/mallorn_boat.json) | `boat`, `inanimate` | Retain |
| [lothlorien:mallorn_chest_boat](../lothlorien_bp/entities/mallorn_chest_boat.json) | `boat`, `inanimate` | Retain |
| [lothlorien:mallorn_heartwood_boat](../lothlorien_bp/entities/mallorn_heartwood_boat.json) | `boat`, `inanimate` | Retain |
| [lothlorien:mallorn_heartwood_chest_boat](../lothlorien_bp/entities/mallorn_heartwood_chest_boat.json) | `boat`, `inanimate` | Retain |
| [lothlorien:rail_mender](../lothlorien_bp/entities/rail_mender.json) | `lothlorien_rail_mender`, `inanimate` | Retain |
| [lothlorien:songbird](../lothlorien_bp/entities/songbird.json) | `lothlorien_songbird`, `mob` | Retain |
| [lothlorien:squirrel](../lothlorien_bp/entities/squirrel.json) | `lothlorien_squirrel`, `mob` | Retain |
| [lothlorien:swan](../lothlorien_bp/entities/swan.json) | `lothlorien_swan`, `mob` | Retain |
| [lothlorien:unicorn](../lothlorien_bp/entities/unicorn.json) | `lothlorien_unicorn`, `mob` | Retain |
| [lothlorien:white_deer](../lothlorien_bp/entities/white_deer.json) | `lothlorien_white_deer`, `mob` | Retain |

## Related explicit item tags

These are item-component tags, not block tags. This is a cross-check, not a request to classify every inventory item.

| Item | Tags |
| --- | --- |
| [lothlorien:lembas_cake](../lothlorien_bp/items/lembas_cake.json) | `minecraft:is_food` |
| [lothlorien:lembas_wrapped](../lothlorien_bp/items/lembas_wrapped.json) | `minecraft:is_food` |
| [lothlorien:mallorn_heartwood_planks](../lothlorien_bp/items/mallorn_heartwood_planks.json) | `minecraft:planks` |
| [lothlorien:mallorn_heartwood_slab](../lothlorien_bp/items/mallorn_heartwood_slab.json) | `minecraft:wooden_slabs` |
| [lothlorien:mallorn_log](../lothlorien_bp/items/mallorn_log.json) | `minecraft:logs`, `minecraft:logs_that_burn` |
| [lothlorien:mallorn_planks](../lothlorien_bp/items/mallorn_planks.json) | `minecraft:planks` |
| [lothlorien:mallorn_slab](../lothlorien_bp/items/mallorn_slab.json) | `minecraft:wooden_slabs` |
| [lothlorien:mallorn_stripped_log](../lothlorien_bp/items/mallorn_stripped_log.json) | `minecraft:logs`, `minecraft:logs_that_burn` |
| [lothlorien:mallorn_stripped_wood](../lothlorien_bp/items/mallorn_stripped_wood.json) | `minecraft:logs`, `minecraft:logs_that_burn` |
| [lothlorien:mallorn_wood](../lothlorien_bp/items/mallorn_wood.json) | `minecraft:logs`, `minecraft:logs_that_burn` |
| [lothlorien:venison_cooked](../lothlorien_bp/items/venison_cooked.json) | `minecraft:is_food`, `minecraft:is_meat` |
| [lothlorien:venison_raw](../lothlorien_bp/items/venison_raw.json) | `minecraft:is_food`, `minecraft:is_meat` |

## Evidence and follow-up

- Shared decision rules and primary sources: [tags and families](../../../.claude/skills/bedrock-modding/references/14-tags.md).
- Cross-mod findings and verification status: [workspace audit](../../../docs/tag-audit-2026-10-13.md).
- Existing runtime quest/hostility/debug tags are separate from these families. No new runtime tags or cleanup mechanisms are proposed.
- If accepted, update any responsible generator, run `mods verify <mod>`, deploy and confirm `in sync`, then record relevant engine observations here.

## Final owner decisions and validation (2026-10-13)

Added lothlorien:flower to both blocks and explicit items for Elanor, Niphredil,
Athelas, nectar bloom, Mallorn blossom and golden fern. Item membership is the
same six IDs, in addition to the item-tag inventory above. This supports custom
group classification/filtering, with no automatic vanilla flower mechanics.

Golden fern now drops one fern with any tool or hand, no wheat seeds/Fortune
bonus; antlers mine instantly. Nectar retains its approved shears/Silk Touch
collection restriction. Responsible loot and regeneration postpass updated.
Great Mallorn nut intentionally remains noncompostable (owner confirmed today).

Full configured regressions pass; no new engine tests. Reviewed diagnostics:
0 errors, 0 warnings, 15 documented exceptions with exact reasons/evidence;
see [documented exceptions](VERIFIER_WARNINGS.md). Check the workspace audit for
deployment status. Original inventory revision is retained above as provenance.
Implementation commit: `Classify flowers and make fern and antlers easy to collect`.
