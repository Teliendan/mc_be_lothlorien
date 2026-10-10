"""Golden fern harvest recipe; stdlib only, no artwork or block rewrites.

python -B tools/golden_fern_loot.py --print-loot
python -B tools/golden_fern_loot.py --write
Source and outstanding Bedrock enchantment acceptance: docs/GOLDEN_FERN_HARVEST.md.
"""
import argparse
import json
from pathlib import Path


LOOT_PATH = Path(__file__).resolve().parent.parent / "lothlorien_bp/loot_tables/blocks/golden_fern.json"


def fern_loot():
    """Return a fresh table; shears and ordinary-removal pools are exclusive."""
    def entry(name, count=1):
        return {"type": "item", "name": name, "functions": [
            {"function": "set_count", "count": count},
            {"function": "explosion_decay"},
        ]}
    return {"pools": [
        {"rolls": 1, "entries": [entry("lothlorien:golden_fern")], "conditions": [
            {"condition": "match_tool", "item": "minecraft:shears"},
        ]},
        *seed_pools(entry),
    ]}


def seed_pools(entry):
    """Wiki fern recipe: 1/8 event, then 1..(2*Fortune+1) seeds at I-III."""
    pools = []
    for level in range(4):
        bounds = {"range_min": level or 1}
        if level in (1, 2):
            bounds["range_max"] = level
        gate = {"condition": "match_tool", "enchantments": [
            {"enchantment": "fortune", "levels": bounds}]}
        if level == 0:
            gate["operator"] = "not"
        count = 1 if level == 0 else {"min": 1, "max": 2 * level + 1}
        pools.append({"rolls": 1, "entries": [entry("minecraft:wheat_seeds", count)], "conditions": [
            {"condition": "match_tool", "item": "minecraft:shears", "operator": "not"},
            gate, {"condition": "random_chance", "chance": 0.125},
        ]})
    return pools


def write_loot(path=LOOT_PATH):
    """Regenerate only the reviewed harvest table; safe for support postpass."""
    Path(path).write_text(json.dumps(fern_loot(), indent=2) + "\n", encoding="utf8", newline="\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--print-loot", action="store_true")
    mode.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if args.print_loot:
        print(json.dumps(fern_loot(), indent=2))
    else:
        write_loot()


if __name__ == "__main__":
    main()
