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
    def entry(name):
        return {"type": "item", "name": name, "functions": [
            {"function": "set_count", "count": 1},
            {"function": "explosion_decay"},
        ]}
    return {"pools": [
        {"rolls": 1, "entries": [entry("lothlorien:golden_fern")], "conditions": [
            {"condition": "match_tool", "item": "minecraft:shears"},
        ]},
        {"rolls": 1, "entries": [entry("minecraft:wheat_seeds")], "conditions": [
            {"condition": "match_tool", "item": "minecraft:shears", "operator": "not"},
            {"condition": "random_chance", "chance": 0.125},
        ]},
    ]}


def write_loot(path=LOOT_PATH):
    """Regenerate only the reviewed harvest table; safe for support postpass."""
    Path(path).write_text(json.dumps(fern_loot(), indent=2) + "\n", encoding="utf8")


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
