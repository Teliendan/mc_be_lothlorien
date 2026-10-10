"""Apply production support metadata after regenerating blocks; no art changes.

Run python -B tools/configure_support.py after any block generator.
The native placement filters remain authoritative for eligibility.
"""
import json
import importlib.util
import subprocess
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


def configure_water(block):
    """Explicit approved inventory: unknown new blocks must get a water decision."""
    body = block["minecraft:block"]
    name = body["description"]["identifier"].split(":")[1]
    if name not in WATER_POP | WATER_SOLID | WATER_LOGGABLE:
        raise ValueError(f"No water policy decided for {name}; see docs/WATER.md")
    rule = {"liquid_type": "water", "can_contain_liquid": name in WATER_LOGGABLE,
            "on_liquid_touches": "popped" if name in WATER_POP else "blocking"}
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
    # Owner 2026-10-10: native/default full-cube particles, native single-shape48.
    # Other partial-family recipes retain48 pending actual native engine comparison.
    if name in FULL_WOOD | SINGLE_WOOD_SHAPES:
        c.setdefault("minecraft:destruction_particles", {})["particle_count"] = 100 if name in FULL_WOOD else 48
    if name == "golden_fern":
        c.pop("minecraft:replaceable", None)  # Owner: break it before replacement.
    configure_water(block)
    # Counterpart parity, also for blocks without a support-survival dependency.
    # These four shapes are single slabs/stairs; double slabs remain solid cubes.
    if name in {"mallorn_slab", "mallorn_heartwood_slab", "mallorn_stairs", "mallorn_heartwood_stairs"}:
        c.setdefault("minecraft:light_dampening", 0)
        c.setdefault("minecraft:redstone_conductivity", {"redstone_conductor": False})
    if name in {"mallorn_leaves", "mallorn_golden_leaves"}:
        c.setdefault("minecraft:movable", {"movement_type": "popped"})
    placement = c.get("minecraft:placement_filter")
    if not (placement or name in MOUNTED or name in EXTRA):
        return None
    c["minecraft:movable"] = {"movement_type": "popped"}
    c["lothlorien:motion_support"] = {}
    c.setdefault("minecraft:tick", {"interval_range": [2, 2], "looping": True})
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
    return {"mount": "face" if name in MOUNTED else "rope" if name.startswith("elven_rope") else
            "door" if name.endswith("_door") else "ceiling" if condition.get("allowed_faces") == ["down"] else "floor",
            "allowed": condition.get("block_filter")}


def main():
    policies = {}
    for path in sorted((BP / "blocks").glob("*.json")):
        block = json.loads(path.read_text(encoding="utf8"))
        policy = configure(block)
        if policy is not None:
            policies[block["minecraft:block"]["description"]["identifier"]] = policy
        # Preserve the repository's newline convention on Windows.
        baseline = subprocess.run(["git", "show", "HEAD:" + path.relative_to(ROOT).as_posix()],
                                  cwd=ROOT, capture_output=True).stdout
        newline = "\r\n" if b"\r\n" in baseline else "\n"
        with path.open("w", encoding="utf8", newline="") as stream:
            stream.write((json.dumps(block, indent=2) + "\n").replace("\n", newline))
    (BP / "scripts/support_policies.js").write_text(
        "// Generated from the native block placement filters by tools/configure_support.py.\n"
        "export const SUPPORT_POLICIES = " + json.dumps(policies, indent=2) + ";\n", encoding="utf8")
    for name in COVERS:
        for count in range(1, 5):
            loot = {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"lothlorien:{name}",
                "functions": [{"function": "set_count", "count": count}]}]}]}
            suffix = "" if count == 1 else f"_{count}"
            (BP / f"loot_tables/blocks/{name}{suffix}.json").write_text(json.dumps(loot, indent=2) + "\n", encoding="utf8")
    (BP / "loot_tables/blocks/elven_rope.json").write_text(json.dumps({"pools": [{"rolls": 1,
        "entries": [{"type": "item", "name": "lothlorien:elven_rope"}]}]}, indent=2) + "\n", encoding="utf8")
    print(f"Configured piston support for {len(policies)} block definitions.")


if __name__ == "__main__":
    main()
