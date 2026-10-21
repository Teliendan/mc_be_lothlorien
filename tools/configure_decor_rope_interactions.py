"""Art-independent accepted lamp/rope policy (owner 2026-10-19).

Run alone or via configure_support. Preserve all existing item classifications.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / "lothlorien_bp"
TAG = "lothlorien:elven_lantern"


def write(path, value):
    previous = path.read_bytes() if path.exists() else b""
    if previous and json.loads(previous) == value:
        return
    newline = "\r\n" if b"\r\n" in previous else "\n"
    path.write_bytes((json.dumps(value, indent=2) + "\n").replace("\n", newline).encode("utf8"))


def configure():
    for name in ("elven_lantern", "elven_lantern_heartwood", "elven_chandelier", "elven_rope"):
        path = BP / f"items/{name}.json"
        value = json.loads(path.read_bytes())
        components = value["minecraft:item"]["components"]
        if name in {"elven_lantern", "elven_lantern_heartwood"}:
            tags = components.setdefault("minecraft:tags", {"tags": []})["tags"]
            if TAG not in tags:
                tags.append(TAG)
        elif name == "elven_chandelier":
            components["minecraft:max_stack_size"] = 64
        else:
            components["minecraft:fuel"] = {"duration": 15}
        write(path, value)
    write(BP / "recipes/elven_chandelier.json", {
        "format_version": "1.20.30", "minecraft:recipe_shaped": {
            "description": {"identifier": "lothlorien:elven_chandelier"}, "tags": ["crafting_table"],
            "pattern": ["L L", " A ", "L L"],
            "key": {"A": {"item": "lothlorien:deer_antler"}, "L": {"tag": TAG}},
            "unlock": [{"item": "lothlorien:deer_antler"}],
            "result": {"item": "lothlorien:elven_chandelier", "count": 1}}})


if __name__ == "__main__":
    configure()
