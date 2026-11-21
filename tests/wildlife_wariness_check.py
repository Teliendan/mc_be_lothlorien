"""Wildlife wariness table checks (LM-01): tools/wildlife_wariness.py against the Harmony band tags and the entity files.

A small evaluator for the flat entity filters the entries use (is_family, is_sneaking, has_equipment, has_tag, == and !=)
runs every band x sneaking x held item case through the generated entries: exactly one player entry matches, except a Friend
or Guest holding the animal's lure (the unicorn: Friend only), who matches none. Distances are read the way the engine
works (owner R4/R5, 1.26.63, 2026-11-21; MCPE-182041): the goal's max_dist / max_flee apply to every entry and the entry's own are
ignored, so each player entry carries a `distance_to_nearest_player` (subject self) <= gate, and a band flees at its gate distance
(inside the goal radius). The gate is not yet verified in game. Run from anywhere: python -B tests/wildlife_wariness_check.py
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
    if test == "distance_to_nearest_player":
        assert filters.get("subject") == "self" and op == "<=", filters
        return player["nearest"] <= value
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


# Documented engine defaults (MS Learn avoid_mob_type): the goal's own search radius, an entry's radius, the flight's end.
GOAL_MAX_DIST, ENTRY_MAX_DIST, MAX_FLEE = 3, 16, 10


def gate(entry):
    """The entry's distance gate (the only distance the engine honours per entry)."""
    leaves = entry["filters"]["all_of"]
    values = [leaf["value"] for leaf in leaves if leaf["test"] == "distance_to_nearest_player"]
    assert len(values) == 1, entry
    return values[0]


def start_dist(goal, entry):
    """Distance at which the entry starts a flight: the goal radius bounds the gate."""
    return min(goal.get("max_dist", GOAL_MAX_DIST), gate(entry))


def stop_dist(goal, entry):
    return goal.get("max_flee", MAX_FLEE)  # the entry's max_flee is ignored by the engine


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
                    player = {"families": {"player"}, "sneaking": sneaking, "hand": hand, "tags": tags, "nearest": 1}
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
                            check((start_dist(goal, hit[0]), hit[0]["walk_speed_multiplier"], hit[0]["sprint_speed_multiplier"]) ==
                                  (sneak if sneaking else walking, walk, sprint), f"{label}: fled at {start_dist(goal, hit[0])} blocks, wrong distance or speed")
                            check(stop_dist(goal, hit[0]) > start_dist(goal, hit[0]), f"{label}: the flight would end where it starts")
                            # the gate: matches at the band's distance, not a little beyond it; the goal radius covers it
                            expected = sneak if sneaking else walking
                            near, far = dict(player, nearest=expected), dict(player, nearest=expected + 0.5)
                            check([e for e in entries if matches(e["filters"], near)] == hit, f"{label}: not fled at {expected} blocks")
                            check(not [e for e in entries if matches(e["filters"], far)], f"{label}: fled beyond {expected} blocks")
                            check(goal["max_dist"] >= expected, f"{label}: the goal radius {goal['max_dist']} is below the gate {expected}")
    # alarmed: every player, no exemption, no tag
    alarmed = PLAYER_ENTRIES(W.alarmed_avoid()["entity_types"])
    for sneaking in (False, True):
        for hand in [None, *spec["lures"]]:
            player = {"families": {"player"}, "sneaking": sneaking, "hand": hand, "tags": {W.BAND_TAGS["friend"]}, "nearest": 1}
            hit = [e for e in alarmed if matches(e["filters"], player)]
            goal = W.alarmed_avoid()
            check(len(hit) == 1 and start_dist(goal, hit[0]) == (18 if sneaking else 36) and stop_dist(goal, hit[0]) > start_dist(goal, hit[0]),
                  f"{species} alarmed sneaking={sneaking} hand={hand}")
    # the danger entries are the same everywhere and a player matches neither
    for goal in (W.wild_avoid(species), W.alarmed_avoid()):
        danger = goal["entity_types"][-1:]
        check(danger == W.DANGER and len(W.DANGER) == 1, f"{species}: danger entries differ (the wolf only, no monster)")
        check("monster" not in json.dumps(goal), f"{species}: a monster entry is back")
        check("max_dist" not in danger[0] and "max_flee" not in danger[0], f"{species}: the wolf entry carries a distance the engine ignores")
    check(goal["priority"] == 3 and W.tempt(species)["priority"] == 4, f"{species}: avoid must outrank tempt")
    check(W.tempt(species)["within_radius"] == 10 and W.tempt(species)["can_get_scared"] is False, f"{species}: tempt radius / scare")
    check(W.tempt(species)["items"] == spec["lures"], f"{species}: tempt items")

# 3. the table itself: distances grow with the band
check([W.FLIGHT[b][0] for b in ("guest", "uneasy", "shunned", "hated")] == [10, 13, 20, 30], "walking distances changed")
check(W.wild_avoid("deer")["max_dist"] == 30 and W.wild_avoid("deer")["max_flee"] == 34, "wild goal radius is 30/34")
check(W.alarmed_avoid()["max_dist"] == 36 and W.alarmed_avoid()["max_flee"] == 40, "alarmed goal radius is 36/40")
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
