"""Generator manifest check (LT-06): tools/generators.json names every generator of the mod and what it writes.

Fails when a tools/make_*.py, tools/build_*.mjs or tools/key_art/make_key_art.py has no row, a command's script is missing,
an `outputs` pattern matches no tracked file, an `after` names no row, or names repeat. About 0.1 s; the byte-for-byte
rerun of the `regen` rows is the workspace command `.mods regen lothlorien` (not part of verify: about 30 s).
"""
import fnmatch
import json
import subprocess
import sys
from pathlib import Path

MOD = Path(__file__).resolve().parent.parent
WORKSPACE = MOD.parents[1]
CHECKS = {"regen", "mode", "manual"}
NEEDS = {"vanilla-reference", "workspace-localization", "skills", "pillow", "audio-libs", "music-masters", "blockbench", "chatterbox"}

manifest = json.loads((MOD / "tools/generators.json").read_text(encoding="utf-8"))
rows = manifest["generators"]
errors = []
if manifest.get("version") != 1:
    errors.append("generators.json: version must be 1")

names = [r.get("name") for r in rows]
for name in {n for n in names if names.count(n) > 1}:
    errors.append(f"duplicate row name: {name}")

scripts = set()
for r in rows:
    name = r.get("name", "?")
    cwd = {"mod": MOD, "workspace": WORKSPACE}.get(r.get("cwd"))
    if cwd is None:
        errors.append(f"{name}: cwd must be mod or workspace")
        continue
    if r.get("check") not in CHECKS:
        errors.append(f"{name}: check must be one of {sorted(CHECKS)}")
    if r.get("check") == "manual" and not r.get("reason"):
        errors.append(f"{name}: a manual row needs a reason")
    for need in r.get("needs", []):
        if need not in NEEDS:
            errors.append(f"{name}: unknown need {need}")
    script = cwd / r["command"][0]
    if not script.exists():
        errors.append(f"{name}: {r['command'][0]} does not exist")
    else:
        scripts.add(script.resolve())
    for after in r.get("after", []):
        if after not in names:
            errors.append(f"{name}: after names no row: {after}")

tracked = subprocess.run(["git", "-C", str(MOD), "ls-files", "-z"], capture_output=True, text=True).stdout.split("\0")
tracked = [t for t in tracked if t]
if tracked:  # an exported copy without git skips the output check
    for r in rows:
        for pattern in r.get("outputs", []):
            if not any(fnmatch.fnmatchcase(t, pattern) for t in tracked):
                errors.append(f"{r.get('name')}: output matches no tracked file: {pattern}")

expected = sorted((MOD / "tools").glob("make_*.py")) + sorted((MOD / "tools").glob("build_*.mjs")) + [MOD / "tools/key_art/make_key_art.py"]
for path in expected:
    if path.resolve() not in scripts:
        errors.append(f"no manifest row for {path.relative_to(MOD).as_posix()}")

for e in errors:
    print("FAIL", e)
if not errors:
    print(f"ok   {len(rows)} generator rows ({sum(r['check'] == 'regen' for r in rows)} regen, {sum(r['check'] == 'mode' for r in rows)} mode, {sum(r['check'] == 'manual' for r in rows)} manual)")
sys.exit(1 if errors else 0)
