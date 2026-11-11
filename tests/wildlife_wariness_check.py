"""Wildlife wariness table checks (LM-01): tools/wildlife_wariness.py against the Harmony band tags and the entity files.

A small evaluator for the flat entity filters the entries use (is_family, is_sneaking, has_equipment, has_tag, == and !=)
runs every band x sneaking x held item case through the generated entries: exactly one player entry matches, except a Friend
or Guest holding the animal's lure (the unicorn: Friend only), who matches none. Run from anywhere: python -B tests/wildlife_wariness_check.py
"""
import json
import re
import sys
from pathlib import Path

MOD = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(MOD / "tools"))
import wildlife_wariness as W  # noqa: E402

failures = []


def check(ok, message):
    if not ok:
        failures.append(message)


def matches(filters, player):
    """Evaluate a filter (flat tests, all_of/any_of/none_of) against a player {families, sneaking, hand, tags}; subject is always `other`."""
    if isinstance(filters, list):
        return all(matches(f, player) for f in filters)
    for combiner, fold in (("all_of", all), ("any_of", any)):
        if combiner in filters:
            return fold(matches(f, player) for f in filters[combiner])
    if "none_of" in filters:
        return not any(matches(f, player) for f in filters["none_of"])
    test, value, op = filters["test"], filters["value"], filters.get("operator", "==")
    assert filters.get("subject") == "other", filters
    if test == "is_family":
        result = value in player["families"]
    elif test == "is_sneaking":
        result = player["sneaking"] == value
        op = "=="
    elif test == "has_equipment":
        assert filters.get("domain") == "hand", filters
        result = player["hand"] == value
    elif test == "has_tag":
        result = value in player["tags"]
    else:
        raise AssertionError(f"unsupported test {test}")
    return result if op == "==" else not result


def flat(filters):
    """Every nested combiner is a single all_of of leaf tests (flat tests only)."""
    leaves = filters["all_of"] if "all_of" in filters else [filters]
    return all("test" in leaf for leaf in leaves)


# 1. tag strings equal harmony.js BAND_TAGS
harmony = (MOD / "lothlorien_bp" / "scripts" / "harmony.js").read_text(encoding="utf-8")
block = re.search(r"export const BAND_TAGS = \{([^}]*)\}", harmony)
js_tags = dict(re.findall(r'(\w+): "([a-z_]+)"', block.group(1))) if block else {}
check(js_tags == W.BAND_TAGS, f"BAND_TAGS differ: harmony.js {js_tags} vs table {W.BAND_TAGS}")
check(len(set(W.BAND_TAGS.values())) == 4, "band tags are not distinct")

# 2. every case matches exactly one entry (or none for an exempt lure holder)
PLAYER_ENTRIES = lambda entries: [e for e in entries if "is_family" in json.dumps(e["filters"]) and '"player"' in json.dumps(e["filters"])]
cases = 0
for species, spec in W.SPECIES.items():
    groups = {"state_wild": W.wild_avoid(species)}
    if spec["tame"]:
        groups["state_tame"] = W.tame_avoid(species)
    for group, goal in groups.items():
        entries = PLAYER_ENTRIES(goal["entity_types"])
        for e in entries:
            check(flat(e["filters"]), f"{species} {group}: a non-flat filter")
        bands = W.BANDS if group == "state_wild" else ["uneasy", "shunned", "hated"]
        for band in W.BANDS:
            tags = {W.BAND_TAGS[band]} if band in W.BAND_TAGS else set()
            for sneaking in (False, True):
                for hand in [None, "minecraft:stick", *spec["lures"]]:
                    player = {"families": {"player"}, "sneaking": sneaking, "hand": hand, "tags": tags}
                    hit = [e for e in entries if matches(e["filters"], player)]
                    cases += 1
                    label = f"{species} {group} {band} sneaking={sneaking} hand={hand}"
                    if band not in bands:
                        check(not hit, f"{label}: matched {len(hit)} entries, expected none (tame animals ignore this band)")
                    elif band in W.exempt_bands(species) and hand in spec["lures"]:
                        check(not hit, f"{label}: a lure holder must match no entry")
                    else:
                        check(len(hit) == 1, f"{label}: matched {len(hit)} entries, expected exactly one")
                        if len(hit) == 1:
                            walking, sneak, walk, sprint = W.flight(species, band)
                            check((hit[0]["max_dist"], hit[0]["walk_speed_multiplier"], hit[0]["sprint_speed_multiplier"]) ==
                                  (sneak if sneaking else walking, walk, sprint), f"{label}: wrong distance or speed")
    # alarmed: every player, no exemption, no tag
    alarmed = PLAYER_ENTRIES(W.alarmed_avoid()["entity_types"])
    for sneaking in (False, True):
        for hand in [None, *spec["lures"]]:
            player = {"families": {"player"}, "sneaking": sneaking, "hand": hand, "tags": {W.BAND_TAGS["friend"]}}
            hit = [e for e in alarmed if matches(e["filters"], player)]
            check(len(hit) == 1 and hit[0]["max_dist"] == (18 if sneaking else 36), f"{species} alarmed sneaking={sneaking} hand={hand}")
    # the danger entries are the same everywhere and a player matches neither
    for goal in (W.wild_avoid(species), W.alarmed_avoid()):
        danger = goal["entity_types"][-2:]
        check(danger == W.DANGER, f"{species}: danger entries differ")
    check(goal["priority"] == 3 and W.tempt(species)["priority"] == 4, f"{species}: avoid must outrank tempt")
    check(W.tempt(species)["within_radius"] == 10 and W.tempt(species)["can_get_scared"] is False, f"{species}: tempt radius / scare")
    check(W.tempt(species)["items"] == spec["lures"], f"{species}: tempt items")

# 3. the table itself: distances grow with the band
check([W.FLIGHT[b][0] for b in ("guest", "uneasy", "shunned", "hated")] == [10, 13, 20, 30], "walking distances changed")
check([W.FLIGHT[b][1] for b in ("guest", "uneasy", "shunned", "hated")] == [5, 6, 10, 15], "sneaking distances changed")

# 4. entity files that carry state_wild agree with the table
for species in W.SPECIES:
    problems = W.check_species(species)
    for problem in problems or []:
        check(False, problem)

if failures:
    print("\n".join(f"FAIL {f}" for f in failures[:30]) + (f"\n... {len(failures) - 30} more" if len(failures) > 30 else ""))
    sys.exit(1)
print(f"ok   wildlife wariness: {cases} band x sneaking x held cases, tags, priorities, entity files")
