"""Approved 2026-10-19 flora/crop data; art-independent, byte-idempotent post-pass."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP = ROOT / "lothlorien_bp"
SOILS = ["minecraft:mycelium", "minecraft:pale_moss_block", "minecraft:muddy_mangrove_roots"]
ORIGIN = "lothlorien:wild"


def write(path, data):
    previous = path.read_bytes() if path.exists() else b""
    if previous and json.loads(previous) == data:
        return
    newline = "\r\n" if b"\r\n" in previous else "\n"
    path.write_bytes((json.dumps(data, indent=2) + "\n").replace("\n", newline).encode("utf8"))


def configure():
    for name in ("elanor", "niphredil", "athelas", "golden_fern"):
        path = BP / f"blocks/{name}.json"
        data = json.loads(path.read_bytes())
        soils = data["minecraft:block"]["components"]["minecraft:placement_filter"]["conditions"][0]["block_filter"]
        for soil in SOILS:
            if soil not in soils:
                soils.append(soil)
        write(path, data)
    path = BP / "items/nectar_bloom.json"
    data = json.loads(path.read_bytes())
    data["minecraft:item"]["components"]["minecraft:compostable"] = {"composting_chance": 65}
    write(path, data)
    path = BP / "blocks/western_corn.json"
    data = json.loads(path.read_bytes())
    body = data["minecraft:block"]
    body["description"]["states"][ORIGIN] = [False, True]
    permutations = body["permutations"]
    permutations[:] = [p for p in permutations if ORIGIN not in p["condition"]]
    permutations.append({"condition": f"!q.block_state('{ORIGIN}')", "components": {
        "minecraft:placement_filter": {"conditions": [{"allowed_faces": ["up"], "block_filter": ["minecraft:farmland"]}]}}})
    write(path, data)
    path = BP / "features/western_corn_feature.json"
    data = json.loads(path.read_bytes())
    data["minecraft:single_block_feature"]["places_block"]["states"][ORIGIN] = True
    write(path, data)
    for flower, dye in (("elanor", "yellow_dye"), ("niphredil", "white_dye")):
        name = f"{dye}_from_{flower}"
        recipe = {"format_version": "1.26.50", "minecraft:recipe_shaped": {
            "description": {"identifier": f"lothlorien:{name}"}, "tags": ["crafting_table"],
            "pattern": ["F"], "key": {"F": {"item": f"lothlorien:{flower}"}},
            "unlock": [{"item": f"lothlorien:{flower}"}], "result": {"item": f"minecraft:{dye}", "count": 1}}}
        write(BP / f"recipes/{name}.json", recipe)
    for flower, effect in (("elanor", 5), ("niphredil", 0), ("athelas", 8)):
        name = f"suspicious_stew_from_{flower}"
        recipe = {"format_version": "1.26.50", "minecraft:recipe_shaped": {
            "description": {"identifier": f"lothlorien:{name}"}, "tags": ["crafting_table"],
            "pattern": ["MM", "BF"], "key": {"M": {"tag": "minecraft:mushrooms_for_stew"},
                "B": {"item": "minecraft:bowl"}, "F": {"item": f"lothlorien:{flower}"}},
            "unlock": [{"item": f"lothlorien:{flower}"}], "result": {"item": "minecraft:suspicious_stew", "data": effect}}}
        write(BP / f"recipes/{name}.json", recipe)


if __name__ == "__main__":
    configure()
