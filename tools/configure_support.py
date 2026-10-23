"""Apply production support metadata after regenerating blocks; no art changes.

Run python -B tools/configure_support.py after any block generator.
The native placement filters remain authoritative for eligibility.
"""
import json
import importlib.util
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "lothlorien_bp"
STAIRS_SOURCE = ROOT.parents[1] / ".claude/skills/bedrock-block-families/scripts/gen_stairs.py"
_stairs_spec = importlib.util.spec_from_file_location("stairs_water", STAIRS_SOURCE)
_stairs = importlib.util.module_from_spec(_stairs_spec)
_stairs_spec.loader.exec_module(_stairs)
MOUNTED = {"deer_antler", "elven_lantern", "elven_lantern_heartwood", "firefly_jar", "elven_chandelier",
           "mallorn_button", "mallorn_heartwood_button"}
EXTRA = {"mallorn_door", "mallorn_heartwood_door", "elven_rope", "elven_rope_hanging"}
COVERS = {"mallorn_leaf_carpet", "mallorn_blossom"}
WATER_POP = {"athelas", "elanor", "golden_fern", "nectar_bloom", "niphredil",
             "western_corn", "mallorn_sapling", "great_mallorn_sprout"} | COVERS
WATER_SOLID = {"mallorn_log", "mallorn_wood", "mallorn_stripped_log", "mallorn_stripped_wood",
               "mallorn_planks", "mallorn_heartwood_planks", "mallorn_double_slab",
               "mallorn_heartwood_double_slab", "star_canopy"}
WATER_LOGGABLE = {"deer_antler", "elven_chandelier", "elven_lantern", "elven_lantern_heartwood",
                 "firefly_jar", "elven_rope", "elven_rope_hanging", "mallorn_leaves", "mallorn_golden_leaves"}
WATER_LOGGABLE |= {prefix + part for prefix in ("mallorn_", "mallorn_heartwood_")
                  for part in ("slab", "stairs", "fence", "fence_gate", "trapdoor", "door", "button", "pressure_plate")}
FULL_WOOD = {"mallorn_log", "mallorn_wood", "mallorn_stripped_log", "mallorn_stripped_wood",
             "mallorn_planks", "mallorn_heartwood_planks", "mallorn_double_slab", "mallorn_heartwood_double_slab"}
SINGLE_WOOD_SHAPES = {prefix + part for prefix in ("mallorn_", "mallorn_heartwood_")
                     for part in ("slab", "stairs")}


def write_json(path, data):
    """Keep unrelated formatting when a post-pass changes no JSON values."""
    previous = path.read_bytes() if path.exists() else b""
    if previous and json.loads(previous) == data:
        return
    newline = "\r\n" if b"\r\n" in previous else "\n"
    path.write_bytes((json.dumps(data, indent=2) + "\n").replace("\n", newline).encode("utf8"))


def configure_water(block):
    """Explicit approved inventory: unknown new blocks must get a water decision."""
    body = block["minecraft:block"]
    name = body["description"]["identifier"].split(":")[1]
    if name not in WATER_POP | WATER_SOLID | WATER_LOGGABLE | {"phial_light"}:
        raise ValueError(f"No water policy decided for {name}; see docs/WATER.md")
    rule = {"liquid_type": "water", "can_contain_liquid": name in WATER_LOGGABLE,
            "on_liquid_touches": "popped" if name in WATER_POP else "blocking"}
    if name == "phial_light":
        rule["on_liquid_touches"] = "broken"  # Temporary light must yield to incoming water without loot.
    if name in WATER_LOGGABLE:
        # Match current 1.26 rendering explicitly; multipart/empty colliders need game checks.
        rule.update(use_liquid_clipping=False, stops_liquid_flowing_from_direction=[])
    body["components"]["minecraft:liquid_detection"] = {"detection_rules": [rule]}
    if name in {"mallorn_stairs", "mallorn_heartwood_stairs"}:
        _stairs.configure_stair_water(body)


def configure(block):
    b = block["minecraft:block"]
    name = b["description"]["identifier"].split(":")[1]
    c = b["components"]
    if name in {"elanor", "niphredil", "athelas", "nectar_bloom", "mallorn_blossom", "golden_fern"}:
        tags = c.setdefault("minecraft:tags", [])
        if "lothlorien:flower" not in tags:
            tags.append("lothlorien:flower")
    if name == "deer_antler":
        c["minecraft:destructible_by_mining"] = {"seconds_to_destroy": 0}
    # Owner 2026-10-10 requests vanilla: retain custom default100/full,48/partial
    # candidates until native oak counts are measured (particle-parity.md).
    if name in FULL_WOOD | SINGLE_WOOD_SHAPES:
        c.setdefault("minecraft:destruction_particles", {})["particle_count"] = 100 if name in FULL_WOOD else 48
    if name == "golden_fern":
        c.pop("minecraft:replaceable", None)  # Owner: break it before replacement.
        c["minecraft:loot"] = "loot_tables/blocks/golden_fern.json"
    if name == "star_canopy":
        c["minecraft:loot"] = "loot_tables/blocks/star_canopy.json"
    configure_water(block)
    # Counterpart parity, also for blocks without a support-survival dependency.
    # These four shapes are single slabs/stairs; double slabs remain solid cubes.
    if name in {"mallorn_slab", "mallorn_heartwood_slab", "mallorn_stairs", "mallorn_heartwood_stairs"}:
        c.setdefault("minecraft:light_dampening", 0)
        c.setdefault("minecraft:redstone_conductivity", {"redstone_conductor": False})
    if name in {"mallorn_stairs", "mallorn_heartwood_stairs"}:
        c.setdefault("minecraft:chest_obstruction", {"obstruction_rule": "never"})
    if name in {"mallorn_leaves", "mallorn_golden_leaves"}:
        c.setdefault("minecraft:movable", {"movement_type": "popped"})
    placement = c.get("minecraft:placement_filter")
    if not (placement or name in MOUNTED or name in EXTRA):
        return None
    c["minecraft:movable"] = {"movement_type": "popped"}
    c["lothlorien:motion_support"] = {}
    # Support uses events plus sparse native random ticks. Pressure plates retain
    # their separate occupancy timer; no other support block needs scheduled ticks.
    if name not in {"mallorn_pressure_plate", "mallorn_heartwood_pressure_plate"}:
        c.pop("minecraft:tick", None)
    if name in COVERS:
        c["minecraft:loot"] = f"loot_tables/blocks/{name}.json"
        permutations = b.setdefault("permutations", [])
        permutations[:] = [p for p in permutations if not p.get("components", {}).get("minecraft:loot", "").startswith(f"loot_tables/blocks/{name}_")]
        for count in range(2, 5):
            permutations.append({"condition": f"q.block_state('lothlorien:amount') == {count}",
                "components": {"minecraft:loot": f"loot_tables/blocks/{name}_{count}.json"}})
    elif name.startswith("elven_rope"):
        c["minecraft:loot"] = "loot_tables/blocks/elven_rope.json"
    condition = placement["conditions"][0] if placement else {}
    allowed = condition.get("block_filter")
    if name in COVERS:
        # Placement conditions are alternatives; cover support families exceed
        # the per-condition64-ID native limit, so preserve their complete union.
        allowed = list(dict.fromkeys(id for part in placement["conditions"] for id in part["block_filter"]))
    return {"mount": "face" if name in MOUNTED else "rope" if name.startswith("elven_rope") else
            "door" if name.endswith("_door") else "ceiling" if condition.get("allowed_faces") == ["down"] else "floor",
            "allowed": allowed}


def main():
    policies = {}
    for name in ("elanor", "niphredil", "athelas", "nectar_bloom", "mallorn_blossom", "golden_fern"):
        path = BP / f"items/{name}.json"
        item = json.loads(path.read_text(encoding="utf8"))
        tags = item["minecraft:item"]["components"].setdefault("minecraft:tags", {"tags": []})["tags"]
        if "lothlorien:flower" not in tags:
            tags.append("lothlorien:flower")
            newline = "\r\n" if b"\r\n" in path.read_bytes() else "\n"
            path.write_bytes((json.dumps(item, indent=2) + "\n").replace("\n", newline).encode("utf8"))
    for path in sorted((BP / "blocks").glob("*.json")):
        block = json.loads(path.read_text(encoding="utf8"))
        policy = configure(block)
        if policy is not None:
            policies[block["minecraft:block"]["description"]["identifier"]] = policy
        write_json(path, block)
    (BP / "scripts/support_policies.js").write_text(
        "// Generated from the native block placement filters by tools/configure_support.py.\n"
        "export const SUPPORT_POLICIES = " + json.dumps(policies, indent=2) + ";\n", encoding="utf8")
    for name in COVERS:
        for count in range(1, 5):
            loot = {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"lothlorien:{name}",
                "functions": [{"function": "set_count", "count": count}]}]}]}
            suffix = "" if count == 1 else f"_{count}"
            write_json(BP / f"loot_tables/blocks/{name}{suffix}.json", loot)
    write_json(BP / "loot_tables/blocks/elven_rope.json", {"pools": [{"rolls": 1,
        "entries": [{"type": "item", "name": "lothlorien:elven_rope"}]}]})
    fern_loot = runpy.run_path(str(ROOT / "tools/golden_fern_loot.py"))["fern_loot"]
    write_json(BP / "loot_tables/blocks/golden_fern.json", fern_loot())
    corn_loot = runpy.run_path(str(ROOT / "tools/western_corn_loot.py"))["corn_loot"]
    for mature, name in [(False, "western_corn"), (True, "western_corn_mature")]:
        write_json(BP / f"loot_tables/blocks/{name}.json", corn_loot(mature))
    print(f"Configured piston support for {len(policies)} block definitions.")


if __name__ == "__main__":
    main()
