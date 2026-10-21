"""Regenerate accepted interaction data without rewriting art, harvest loot or worldgen."""
import json
from pathlib import Path

BP = Path(__file__).resolve().parents[1] / "lothlorien_bp"


def write(path, data):
    previous = path.read_bytes() if path.exists() else b""
    if previous and json.loads(previous) == data:
        return
    newline = "\r\n" if b"\r\n" in previous else "\n"
    path.write_bytes((json.dumps(data, indent=2) + "\n").replace("\n", newline).encode("utf-8"))


def configure():
    for name in ("mallorn_leaves", "mallorn_golden_leaves"):
        identifier = "lothlorien:" + name
        block_path = BP / "blocks" / (name + ".json")
        block = json.loads(block_path.read_text(encoding="utf-8-sig"))
        block["minecraft:block"]["components"]["minecraft:chest_obstruction"] = {"obstruction_rule": "never"}
        write(block_path, block)
        write(BP / "items" / (name + ".json"), {
            "format_version": "1.26.50",
            "minecraft:item": {
                "description": {"identifier": identifier, "menu_category": {"category": "nature", "group": "minecraft:itemGroup.name.leaves"}},
                "components": {
                    "minecraft:block_placer": {"block": identifier, "replace_block_item": True},
                    "minecraft:display_name": {"value": "tile." + identifier + ".name"},
                    "minecraft:compostable": {"composting_chance": 30},
                },
            },
        })
        write(BP / "recipes" / ("furnace_" + name + ".json"), {
            "format_version": "1.21.50",
            "minecraft:recipe_furnace": {
                "description": {"identifier": "lothlorien:furnace_" + name},
                "unlock": [{"item": identifier}], "tags": ["furnace"],
                "input": identifier, "output": "lothlorien:mallorn_leaf_carpet", "priority": 240,
            },
        })
    path = BP / "items" / "mallorn_acorn.json"
    acorn = json.loads(path.read_text(encoding="utf-8-sig"))
    acorn["minecraft:item"]["components"]["minecraft:fuel"] = {"duration": 5}
    write(path, acorn)
    for name in ("mallorn_sapling", "great_mallorn_sprout"):
        path = BP / "blocks" / (name + ".json")
        block = json.loads(path.read_text(encoding="utf-8-sig"))
        soils = block["minecraft:block"]["components"]["minecraft:placement_filter"]["conditions"][0]["block_filter"]
        if "minecraft:mycelium" not in soils:
            soils.append("minecraft:mycelium")
        write(path, block)
    # Keep event-driven support eligibility aligned without regenerating unrelated blocks.
    policy_path = BP / "scripts" / "support_policies.js"
    text = policy_path.read_text(encoding="utf-8")
    prefix, body = text.split("export const SUPPORT_POLICIES = ", 1)
    policies = json.loads(body.strip().removesuffix(";"))
    for name in ("mallorn_sapling", "great_mallorn_sprout"):
        allowed = policies["lothlorien:" + name]["allowed"]
        if "minecraft:mycelium" not in allowed:
            allowed.append("minecraft:mycelium")
    updated = prefix + "export const SUPPORT_POLICIES = " + json.dumps(policies, indent=2) + ";\n"
    if updated != text:
        newline = "\r\n" if b"\r\n" in policy_path.read_bytes() else "\n"
        policy_path.write_bytes(updated.replace("\n", newline).encode("utf-8"))


if __name__ == "__main__":
    configure()
