"""Owner-approved fallen-cover data, 2026-10-19; no art/worldgen changes.

Positive native support lists preserve tested survival. These explicit full-cube
material families expand coverage; they are NOT a complete geometry classifier.
Stateful partial shapes are deliberately excluded until a tested predicate exists.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "lothlorien_bp"
COVERS = ("mallorn_leaf_carpet", "mallorn_blossom")
COLORS = "white orange magenta light_blue yellow lime pink gray light_gray cyan purple blue brown green red black".split()
WOODS = "oak spruce birch jungle acacia dark_oak mangrove cherry pale_oak bamboo crimson warped".split()
# Reviewed pre-audit decorative surfaces, including intentional farmland extras.
LEGACY_SURFACES = """grass_block dirt coarse_dirt podzol dirt_with_roots moss_block mud farmland
    sand red_sand gravel clay stone granite diorite andesite deepslate tuff calcite snow mycelium""".split()


def write(path, data):
    previous = path.read_bytes() if path.exists() else b""
    if previous and json.loads(previous) == data:
        return
    newline = "\r\n" if b"\r\n" in previous else "\n"
    path.write_bytes((json.dumps(data, indent=2) + "\n").replace("\n", newline).encode("utf8"))


def full_cube_supports():
    # Named full-cube material families, rather than tool-tag unions (which also
    # admit fences, piston heads and bottom slabs). No partial-state claims.
    names = """glass tinted_glass slime honey_block pale_moss_block muddy_mangrove_roots
        bedrock obsidian crying_obsidian netherrack end_stone soul_soil
        cobblestone mossy_cobblestone smooth_stone stonebrick mossy_stone_bricks
        cracked_stone_bricks chiseled_stone_bricks bricks nether_brick red_nether_brick
        end_bricks quartz_block smooth_quartz quartz_bricks sandstone red_sandstone
        smooth_sandstone smooth_red_sandstone cut_sandstone cut_red_sandstone
        chiseled_sandstone chiseled_red_sandstone polished_granite polished_diorite
        polished_andesite cobbled_deepslate polished_deepslate deepslate_bricks
        cracked_deepslate_bricks deepslate_tiles cracked_deepslate_tiles chiseled_deepslate
        reinforced_deepslate polished_tuff tuff_bricks chiseled_tuff chiseled_tuff_bricks
        blackstone polished_blackstone chiseled_polished_blackstone polished_blackstone_bricks
        cracked_polished_blackstone_bricks basalt polished_basalt smooth_basalt
        prismarine prismarine_bricks dark_prismarine sea_lantern glowstone
        coal_block iron_block gold_block diamond_block emerald_block lapis_block
        redstone_block netherite_block raw_iron_block raw_gold_block raw_copper_block
        amethyst_block budding_amethyst bone_block dried_kelp_block hay_block
        melon_block pumpkin carved_pumpkin lit_pumpkin packed_mud mud_bricks
        resin_block resin_bricks chiseled_resin_bricks snow_block ice packed_ice blue_ice
        crafting_table furnace lit_furnace blast_furnace lit_blast_furnace smoker lit_smoker
        barrel cartography_table fletching_table smithing_table loom note_block jukebox
        enchanting_table bookshelf chiseled_bookshelf target redstone_lamp lit_redstone_lamp
        dispenser dropper observer redstone_ore lit_redstone_ore coal_ore iron_ore copper_ore
        gold_ore lapis_ore diamond_ore emerald_ore nether_gold_ore quartz_ore ancient_debris
        deepslate_coal_ore deepslate_iron_ore deepslate_copper_ore deepslate_gold_ore
        deepslate_lapis_ore deepslate_redstone_ore lit_deepslate_redstone_ore
        deepslate_diamond_ore deepslate_emerald_ore bamboo_block stripped_bamboo_block bamboo_mosaic""".split()
    # The enchantment table is shorter than one block; its top is not full height.
    names.remove("enchanting_table")
    names += [f"{color}_{material}" for color in COLORS
              for material in ("wool", "concrete", "concrete_powder", "stained_glass", "terracotta", "glazed_terracotta")]
    names += ["hardened_clay"]
    names += [f"{wood}_planks" for wood in WOODS]
    names += [f"{prefix}{wood}_{part}" for wood in WOODS[:9]
              for part in ("log", "wood") for prefix in ("", "stripped_")]
    names += [f"{prefix}{wood}_{part}" for wood in ("crimson", "warped")
              for part in ("stem", "hyphae") for prefix in ("", "stripped_")]
    names += [f"{wax}{age}{part}" for wax in ("", "waxed_")
              for age in ("", "exposed_", "weathered_", "oxidized_")
              for part in ("copper", "cut_copper", "chiseled_copper")]
    names += ["copper_block", "waxed_copper_block"]
    # Validate Bedrock spellings against the pinned installed vanilla item/block
    # catalogue. Some familiar Java names deliberately do not survive this filter.
    catalogue = ROOT.parents[1] / ".claude/skills/bedrock-lookup/reference/vanilla_item_ids.txt"
    if not catalogue.exists():
        raise FileNotFoundError("Locate the installed block catalogue before generating supports")
    known = {line.strip().split()[0] for line in catalogue.read_text(encoding="utf8").splitlines() if line.strip()}
    # Block-only lit variants have no item. All versioned installed RP mappings
    # are part of the ground truth too; do not pop cover when a furnace lights.
    vanilla_rp = ROOT.parents[1] / "reference/vanilla/current/resource_packs"
    for mapping in vanilla_rp.glob("*/blocks.json"):
        # These installed reference files include JSONC/trailing commas. Their
        # top-level block keys use exactly two spaces; do not rewrite/read them
        # as authored strict JSON or confuse nested sound/texture keys with IDs.
        for id in re.findall(r'^  "([^"\n]+)"\s*:', mapping.read_text(encoding="utf-8-sig"), re.M):
            if id != "format_version":
                known.add(id if ":" in id else f"minecraft:{id}")
    vanilla = [f"minecraft:{name}" for name in names if f"minecraft:{name}" in known]
    custom = [f"lothlorien:{name}" for name in (
        "mallorn_log", "mallorn_wood", "mallorn_stripped_log", "mallorn_stripped_wood",
        "mallorn_planks", "mallorn_heartwood_planks", "mallorn_double_slab", "mallorn_heartwood_double_slab")]
    return vanilla + custom


def configure():
    blocks = {name: json.loads((BP / f"blocks/{name}.json").read_bytes()) for name in COVERS}
    shared = list(dict.fromkeys([f"minecraft:{name}" for name in LEGACY_SURFACES] + full_cube_supports()))
    for name, data in blocks.items():
        components = data["minecraft:block"]["components"]
        allowed = shared + [f"lothlorien:{name}"]
        components["minecraft:placement_filter"]["conditions"] = [
            {"allowed_faces": ["up"], "block_filter": allowed[i:i+64]} for i in range(0, len(allowed), 64)]
        components["minecraft:sound"] = {"sound": "leaf_litter" if name == "mallorn_leaf_carpet" else "pink_petals"}
        components["lothlorien:segmented_cover"] = {}
        # Native replacement changes self-item routing. Keep the tested top-add
        # route until replacement plus preserved swing/count has engine evidence.
        components.pop("minecraft:replaceable", None)
        write(BP / f"blocks/{name}.json", data)
        path = BP / f"items/{name}.json"
        item = json.loads(path.read_bytes())
        ic = item["minecraft:item"]["components"]
        ic["minecraft:compostable"] = {"composting_chance": 30}
        if name == "mallorn_leaf_carpet":
            ic["minecraft:fuel"] = {"duration": 5}
        else:
            ic.pop("minecraft:fuel", None)
        write(path, item)
    recipe = {"format_version": "1.26.50", "minecraft:recipe_shaped": {
        "description": {"identifier": "lothlorien:yellow_dye_from_mallorn_blossom"}, "tags": ["crafting_table"],
        "pattern": ["F"], "key": {"F": {"item": "lothlorien:mallorn_blossom"}},
        "unlock": [{"item": "lothlorien:mallorn_blossom"}], "result": {"item": "minecraft:yellow_dye", "count": 1}}}
    write(BP / "recipes/yellow_dye_from_mallorn_blossom.json", recipe)
    path = ROOT / "lothlorien_rp/blocks.json"
    sounds = json.loads(path.read_bytes()) if path.exists() else {"format_version": "1.1.0"}
    sounds["lothlorien:mallorn_leaf_carpet"] = {"sound": "leaf_litter"}
    sounds["lothlorien:mallorn_blossom"] = {"sound": "pink_petals"}
    write(path, sounds)


if __name__ == "__main__":
    configure()
