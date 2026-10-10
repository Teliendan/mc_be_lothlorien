"""Western corn's wheat-counterpart harvest tables; stdlib only.

python -B tools/western_corn_loot.py --print-loot
python -B tools/western_corn_loot.py --write
See docs/WESTERN_CORN_HARVEST.md for sources and engine acceptance limits.
"""
import argparse
import json
from pathlib import Path

LOOT_DIR = Path(__file__).resolve().parent.parent / "lothlorien_bp/loot_tables/blocks"


def item_pool(name, conditions=()):
    return {"rolls": 1, "entries": [{"type": "item", "name": name, "functions": [
        {"function": "set_count", "count": 1},
        {"function": "explosion_decay"},
    ]}], **({"conditions": list(conditions)} if conditions else {})}


def corn_loot(mature=False):
    """Bedrock wheat: one grain, Binomial(3 + standard Fortune, 8/15) seeds.

    Each trial needs its own one-roll pool: a random condition on a three-roll
    pool would award zero or three seeds instead of three independent trials.
    Nonstandard command Fortune levels above III retain the III recipe.
    """
    seed = "lothlorien:western_corn_seeds"
    if not mature:
        return {"pools": [item_pool(seed)]}
    chance = {"condition": "random_chance", "chance": 8 / 15}
    pools = [item_pool("lothlorien:western_corn_grain")]
    pools.extend(item_pool(seed, [dict(chance)]) for _ in range(3))
    for level in range(1, 4):
        gate = {"condition": "match_tool", "enchantments": [
            {"enchantment": "fortune", "levels": {"range_min": level}},
        ]}
        pools.append(item_pool(seed, [gate, dict(chance)]))
    return {"pools": pools}


def write_loot():
    for mature, name in [(False, "western_corn"), (True, "western_corn_mature")]:
        (LOOT_DIR / f"{name}.json").write_text(
            json.dumps(corn_loot(mature), indent=2) + "\n", encoding="utf8", newline="\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--print-loot", action="store_true")
    mode.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if args.print_loot:
        print(json.dumps({"young": corn_loot(), "mature": corn_loot(True)}, indent=2))
    else:
        write_loot()


if __name__ == "__main__":
    main()
