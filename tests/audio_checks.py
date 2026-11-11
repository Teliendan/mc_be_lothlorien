"""Audio pipeline checks (LT-05): the three `--check` modes of the audio tools, run from the mod root.

Skips with exit 0 when numpy, scipy or soundfile are missing. prepare_soundscape.py --check skips by itself
the git-ignored music masters that are absent from a clone (it then takes their tick lengths from the shipped files).
"""
import importlib.util
import subprocess
import sys
from pathlib import Path

MOD = Path(__file__).resolve().parent.parent
CHECKS = ("prepare_ambient_sounds.py", "install_sindarin_voice.py", "prepare_soundscape.py")

missing = [name for name in ("numpy", "scipy", "soundfile") if importlib.util.find_spec(name) is None]
if missing:
    print(f"skipped audio checks: {', '.join(missing)} not installed")
    sys.exit(0)

failed = 0
for script in CHECKS:
    result = subprocess.run([sys.executable, "-B", str(MOD / "tools" / script), "--check"], cwd=MOD,
                            capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode:
        failed += 1
        print(f"FAIL {script} --check:\n{result.stdout}{result.stderr}")
    else:
        print(f"ok   {script} --check: {(result.stdout.strip().splitlines() or [''])[-1]}")
sys.exit(1 if failed else 0)
