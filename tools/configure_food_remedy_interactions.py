"""Approved 2026-10-19 food/remedy data; no art generation or recipe guesses."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "lothlorien_bp"


def write(path, data):
    previous = path.read_bytes()
    if json.loads(previous) == data:
        return
    newline = "\r\n" if b"\r\n" in previous else "\n"
    path.write_bytes((json.dumps(data, indent=2) + "\n").replace("\n", newline).encode("utf8"))


def configure():
    path = BP / "items/athelas_salve.json"
    data = json.loads(path.read_bytes())
    data["minecraft:item"]["components"]["minecraft:food"]["using_converts_to"] = "minecraft:glass_bottle"
    write(path, data)
    path = BP / "items/lembas_cake.json"
    data = json.loads(path.read_bytes())
    data["minecraft:item"]["components"]["minecraft:compostable"]["composting_chance"] = 85
    write(path, data)
    for name in ("venison", "swan_meat"):
        path = BP / f"recipes/furnace_{name}.json"
        data = json.loads(path.read_bytes())
        tags = data["minecraft:recipe_furnace"]["tags"]
        if "soul_campfire" not in tags:
            tags.append("soul_campfire")
        write(path, data)


if __name__ == "__main__":
    configure()
