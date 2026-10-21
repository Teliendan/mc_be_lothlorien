"""Maintain control-state data without regenerating the owner's accepted artwork.

Silver definitions are authoritative; make_heartwood_set.py clones these changes.
The gate model generator writes geometry only and does not replace this policy.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "lothlorien_bp"


def write(path, data):
    # These authoritative pack definitions use LF; never let Windows add CRLF.
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8", newline="\n")


def main():
    gate_path = BP / "blocks/mallorn_fence_gate.json"
    data = json.loads(gate_path.read_text(encoding="utf-8"))
    block = data["minecraft:block"]
    block["description"]["states"]["lothlorien:in_wall"] = [False, True]
    block["components"]["lothlorien:gate_wall"] = {}
    # Open model points north. Opposite cardinals need opposite swings.
    for permutation in block["permutations"]:
        condition = permutation["condition"]
        for facing, yaw in (("north", 0), ("south", 180), ("east", 270), ("west", 90)):
            if f"== '{facing}'" in condition:
                permutation["components"]["minecraft:transformation"] = {"rotation": [0, yaw, 0]}
    # Lowered geometry has its own model: translated 24-high collision would exceed
    # the documented authored box limit (origin Y3 + height24 =27).
    block["permutations"] = [p for p in block["permutations"] if "in_wall" not in p["condition"]]
    for facing, yaw in (("north", 0), ("south", 180), ("east", 270), ("west", 90)):
        for opened in (False, True):
            open_condition = "q.block_state('lothlorien:open')" if opened else "!q.block_state('lothlorien:open')"
            block["permutations"].append({
                "condition": f"q.block_state('lothlorien:in_wall') && q.block_state('minecraft:cardinal_direction') == '{facing}' && {open_condition}",
                "components": {
                    "minecraft:transformation": {"rotation": [0, yaw, 0]},
                    "minecraft:geometry": "geometry.lothlorien.mallorn_fence_gate_" + ("open" if opened else "closed") + "_in_wall",
                    "minecraft:collision_box": False if opened else {"origin": [-8, 0, -2], "size": [16, 24, 4]},
                    "minecraft:selection_box": {"origin": [-8, 0, -8 if opened else -2], "size": [16, 13, 8 if opened else 4]},
                },
            })
    write(gate_path, data)

    path = BP / "blocks/mallorn_pressure_plate.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    for p in data["minecraft:block"]["permutations"]:
        if p["condition"] == "q.block_state('lothlorien:powered')":
            p["components"]["minecraft:tick"] = {"interval_range": [20, 20], "looping": True}
    write(path, data)

    path = BP / "blocks/mallorn_button.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    block = data["minecraft:block"]
    block["permutations"] = [p for p in block["permutations"] if p["condition"] != "q.block_state('lothlorien:powered')"]
    block["permutations"].append({"condition": "q.block_state('lothlorien:powered')", "components": {
        "minecraft:tick": {"interval_range": [30, 30], "looping": False}, "lothlorien:button_release": {}}})
    write(path, data)

    # Reuse the existing clone rule, without the broad generator's support/atlas rewrite.
    from make_heartwood_set import clone
    for part in ("fence_gate", "pressure_plate", "button"):
        source = BP / f"blocks/mallorn_{part}.json"
        target = BP / f"blocks/mallorn_heartwood_{part}.json"
        silver_color = json.loads(source.read_text(encoding="utf-8"))["minecraft:block"]["components"]["minecraft:map_color"]
        gold_color = json.loads(target.read_text(encoding="utf-8"))["minecraft:block"]["components"]["minecraft:map_color"]
        target.write_text(clone(source.read_text(encoding="utf-8"), silver_color, gold_color), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
