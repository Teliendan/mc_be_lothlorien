"""Install the final Sindarin voice lines into the resource pack, or check them (--check).

Source of truth: tools/audio/sindarin_voice/final/lines.json (owner-approved set, docs/SINDARIN_VOICE.md).
- Copies final/<file>.ogg byte for byte to lothlorien_rp/sounds/voice/lothlorien/.
- Writes one sound event per pool, lothlorien.voice.<pool>, into lothlorien_rp/sounds/sound_definitions.json.
  Files of one text share its weight, so every text of a pool is equally likely.
Standard library only. Run from the workspace root: python -B mods/lothlorien/tools/install_sindarin_voice.py [--check]
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import sys

MOD = Path(__file__).absolute().parents[1]
FINAL = MOD / "tools/audio/sindarin_voice/final"
RP = MOD / "lothlorien_rp"
TARGET = "sounds/voice/lothlorien"
DEFS = RP / "sounds/sound_definitions.json"
PREFIX = "lothlorien.voice."
POOLS = ("opening_neutral", "opening_warm", "trade_positive", "explain", "task_taken",
         "completion", "refuse_speak", "combat_start", "healing")


def load_lines():
    lines = json.loads((FINAL / "lines.json").read_text(encoding="utf-8"))["lines"]
    for line in lines:
        wav = (FINAL / f"{line['file']}.wav").read_bytes()
        if hashlib.sha256(wav).hexdigest() != line["sha256"]:
            raise ValueError(f"{line['file']}.wav: differs from lines.json sha256")
        if not (FINAL / f"{line['file']}.ogg").read_bytes().startswith(b"OggS"):
            raise ValueError(f"{line['file']}.ogg: not an Ogg file")
        unknown = set(line["pools"]) - set(POOLS)
        if unknown:
            raise ValueError(f"{line['file']}: unknown pools {sorted(unknown)}")
    return lines


def pool_events(lines):
    events = {}
    for pool in POOLS:
        members = [line for line in lines if pool in line["pools"]]
        if not members:
            raise ValueError(f"{pool}: no files")
        per_text = {}
        for line in members:
            per_text[line["sindarin"]] = per_text.get(line["sindarin"], 0) + 1
        common = math.lcm(*per_text.values())
        events[PREFIX + pool] = {"category": "neutral", "sounds": [
            {"name": f"{TARGET}/{line['file']}", "weight": common // per_text[line["sindarin"]]}
            for line in members]}
    return events


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="compare the pack to lines.json; write nothing")
    args = parser.parse_args()
    lines = load_lines()
    data = json.loads(DEFS.read_text(encoding="utf-8"))
    kept = {k: v for k, v in data["sound_definitions"].items() if not k.startswith(PREFIX)}
    data["sound_definitions"] = {**kept, **pool_events(lines)}
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    out = RP / TARGET
    wanted = {f"{line['file']}.ogg": (FINAL / f"{line['file']}.ogg").read_bytes() for line in lines}
    present = {p.name for p in out.glob("*.ogg")} if out.is_dir() else set()
    if args.check:
        problems = [f"{TARGET}/{n}: not in lines.json" for n in sorted(present - set(wanted))]
        problems += [f"{TARGET}/{n}: missing or differs" for n, b in wanted.items()
                     if not (out / n).is_file() or (out / n).read_bytes() != b]
        if DEFS.read_bytes() != text.encode("utf-8"):
            problems.append("sounds/sound_definitions.json: voice events differ")
        for p in problems:
            print(p)
        if problems:
            sys.exit("voice assets out of date: run without --check")
        print(f"ok: {len(wanted)} voice files, {len(POOLS)} pools")
        return
    out.mkdir(parents=True, exist_ok=True)
    for name in present - set(wanted):
        (out / name).unlink()
    for name, payload in wanted.items():
        (out / name).write_bytes(payload)
    DEFS.write_text(text, encoding="utf-8", newline="\n")
    print(f"installed {len(wanted)} voice files, {len(POOLS)} pools")


if __name__ == "__main__":
    main()
