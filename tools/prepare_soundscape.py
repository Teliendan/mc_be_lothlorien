"""Encode the soundscape masters (docs/AUDIO.md), or check the shipped audio.

Run with the moss_sfx/moss audio venv (numpy + soundfile); no model needed.
Masters: tools/audio/soundscape/*.flac (raw generator takes, mono, committed) and
tools/audio/soundscape/music/*.flac (raw 48 kHz stereo pieces, git-ignored for size; seeds and prompts are in
docs/AUDIO.md). Edits are fixed in TAKES, so a re-run reproduces the shipped files.

  sfx:   shorten inner quiet runs, trim both edges to the audible part (optional cut), short fade-in, fade-out,
         even loudness.
  music: shorten inner quiet runs (> 1.5 s under -45 dBFS -> 0.8 s), optional cut + fade, -21 LUFS.
--check compares the shipped Ogg files with a fresh encoding and the tick lengths in village_music_rules.js.
"""
from pathlib import Path
import argparse
import hashlib
import io
import json
import math
import re
import time

import numpy as np
import soundfile as sf
from scipy.signal import lfilter


MOD = Path(__file__).absolute().parents[1]
SRC = MOD / "tools/audio/soundscape"
RP = MOD / "lothlorien_rp/sounds"
RULES = MOD / "lothlorien_bp/scripts/village_music_rules.js"
RATE = 48000

# output (relative to RP), master, kind, options. Owner picks 2026-10-26 (audition 2); 8 s fade-outs on music 2, 4-6
# (owner 2026-11-22: tester heard abrupt ends; a plain fade beat a cut at a quiet gap, no reverb tail).
TAKES = (
    ("ambient/lothlorien/shrine_tone_1", "shrine_tone_s321", "sfx", {}),
    # owner: the ends sound silent (a low drone a small speaker drops); cut seconds into the trimmed take
    ("ambient/lothlorien/shrine_tone_2", "shrine_tone_s322", "sfx", {"cut": 8.0, "fade_out": 2.0}),
    ("ambient/lothlorien/shrine_tone_3", "shrine_tone_s323", "sfx", {"cut": 10.0}),
    ("ambient/lothlorien/shrine_tone_4", "shrine_tone_long_s322", "sfx", {"cut": 17.5}),
    ("ambient/lothlorien/shrine_bell", "shrine_bell_s322", "sfx", {}),
    ("ambient/lothlorien/memorial_tones_1", "memorial_tones_s321", "sfx", {}),
    ("ambient/lothlorien/memorial_tones_2", "memorial_tones_s322", "sfx", {}),
    ("ambient/lothlorien/memorial_harp_1", "memorial_harp_s321", "sfx", {}),
    ("ambient/lothlorien/memorial_harp_2", "memorial_harp_s322", "sfx", {}),
    ("music/lothlorien/village_1", "music/harp_flute_s411", "music", {"cut": 86.0}),  # weak after the drop at 86 s
    ("music/lothlorien/village_2", "music/harp_solo_s402", "music", {"fade_out": 8.0}),
    ("music/lothlorien/village_3", "music/harp_flute_s431", "music", {"fade_out": 8.0}),  # abrupt ending
    ("music/lothlorien/village_4", "music/harp_flute_s432", "music", {"fade_out": 8.0}),
    ("music/lothlorien/village_5", "music/harp_flute_s433", "music", {"fade_out": 8.0}),
    ("music/lothlorien/village_6", "music/harp_solo_s451", "music", {"fade_out": 8.0}),
)
REST = "music/lothlorien/village_rest"  # 10 s of silence, looped between pieces


def db(v):
    return 20 * np.log10(np.maximum(v, 1e-9))


def levels(x, win):
    n = int(RATE * win)
    k = len(x) // n
    return db(np.sqrt((x[: k * n].mean(axis=1).reshape(k, n) ** 2).mean(axis=1))), n


def squeeze(x, thresh_db, longest, keep, win=0.05):
    """Shorten inner quiet runs longer than `longest` s to `keep` s."""
    level, n = levels(x, win)
    quiet = level < thresh_db
    k, pieces, i = len(level), [], 0
    while i < k:
        j = i
        while j < k and quiet[j] == quiet[i]:
            j += 1
        seg = x[i * n: j * n]
        if quiet[i] and 0 < i and j < k and (j - i) * win > longest:
            half = int(keep * RATE / 2)
            seg = np.concatenate([seg[:half], seg[-half:]])
        pieces.append(seg)
        i = j
    return np.concatenate(pieces + [x[k * n:]])


def fades(x, fade_in, fade_out):
    x = x.copy()
    a, b = int(fade_in * RATE), int(fade_out * RATE)
    if a:
        x[:a] *= np.linspace(0, 1, a)[:, None] ** 2
    if b:
        x[-b:] *= np.linspace(1, 0, b)[:, None] ** 2
    return x


def loudness(x, target_db, peak_db):
    """Scale the loudest second-scale passages to target_db RMS, with the peak capped."""
    level, _ = levels(x, 0.25)
    loud = np.percentile(level, 90)
    gain = min(10 ** ((target_db - loud) / 20), 10 ** (peak_db / 20) / np.abs(x).max())
    return x * gain


def lufs(x):
    """Integrated loudness (ITU-R BS.1770 K-weighting at 48 kHz, absolute and relative gates)."""
    y = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, axis=0)
    y = lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], y, axis=0)
    n, hop = int(0.4 * RATE), int(0.1 * RATE)
    ms = np.array([(y[i:i + n] ** 2).mean(axis=0).sum() for i in range(0, len(y) - n, hop)])
    level = -0.691 + 10 * np.log10(ms + 1e-12)
    gated = ms[level > -70]
    rel = -0.691 + 10 * np.log10(gated.mean()) - 10
    return -0.691 + 10 * np.log10(ms[(level > -70) & (level > rel)].mean())


def sfx(x, edge_db=30, fade_in=0.02, fade_out=1.5, cut=None):
    level, n = levels(x, 0.05)
    loud = level.max()
    x = squeeze(x, loud - 40, 0.6, 0.3)
    level, n = levels(x, 0.05)
    audible = np.flatnonzero(level >= loud - edge_db)
    x = x[audible[0] * n: (audible[-1] + 1) * n][: int(cut * RATE) if cut else None]
    return loudness(fades(x, fade_in, fade_out), -16, -1)


def music(x, cut=None, fade_out=0.0):
    x = squeeze(x, -45, 1.5, 0.8)
    level, n = levels(x, 0.05)
    audible = np.flatnonzero(level >= -45)
    x = x[audible[0] * n: (audible[-1] + 1) * n]
    if cut:  # seconds into the trimmed piece
        x, fade_out = x[: int(cut * RATE)], max(fade_out, 4.0)
    x = fades(x, 0.0, fade_out)
    # equal perceived loudness (owner 2026-10-27: peak-capped RMS left pieces up to 3.5 dB apart); -21 fits every peak
    x = x * 10 ** ((-21 - lufs(x)) / 20)
    if np.abs(x).max() > 10 ** (-1 / 20):
        raise ValueError("music peak above -1 dBFS at -21 LUFS; lower the target")
    return x


def encode(data):
    stream = io.BytesIO()
    with sf.SoundFile(stream, "w", RATE, data.shape[1], format="OGG", subtype="VORBIS") as f:
        for i in range(0, len(data), RATE):  # one long Vorbis write kills the process (docs/local-audio.md)
            f.write(data[i:i + RATE])
    return stream.getvalue()


def build(skipped=None):
    """Encode every take. With `skipped` (a list), a missing git-ignored master is recorded there instead of raising."""
    out = {}
    for dest, master, kind, opts in TAKES:
        source = SRC / f"{master}.flac"
        if skipped is not None and not source.exists():
            skipped.append(master)
            out[dest] = None
            continue
        x, rate = sf.read(source, always_2d=True)
        if rate != RATE:
            raise ValueError(f"{master}: {rate} Hz")
        out[dest] = (sfx if kind == "sfx" else music)(x, **opts)
    out[REST] = np.zeros((10 * RATE, 2))
    return out


CACHE = MOD.parents[1] / "temp/audio-check/soundscape.json"  # workspace scratch; losing it costs one slow run


def check_key():
    """sha256 over every input of --check: this script, the tick rules, each master present, each shipped take, library versions."""
    h = hashlib.sha256()

    def add(label, data):
        h.update(f"{label}|{len(data)}|".encode() + data)

    add("script", Path(__file__).read_bytes())
    add("rules", RULES.read_bytes())
    for _, master, _, _ in TAKES:
        source = SRC / f"{master}.flac"
        add(f"master {master}", source.read_bytes() if source.exists() else b"<absent>")
    for dest in [t[0] for t in TAKES] + [REST]:
        path = RP / f"{dest}.ogg"
        add(f"ogg {dest}", path.read_bytes() if path.exists() else b"<absent>")
    import scipy
    add("libs", f"{np.__version__} {scipy.__version__} {sf.__version__} {sf.__libsndfile_version__}".encode())
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare shipped files and piece lengths with a fresh encoding")
    parser.add_argument("--no-cache", action="store_true", help="with --check: ignore the digest of the last passing check")
    args = parser.parse_args()
    key = None
    if args.check and not args.no_cache:
        key = check_key()
        try:
            last = json.loads(CACHE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            last = {}
        if last.get("key") == key:
            print(f"ok (inputs unchanged since {last.get('time', '?')})")
            return
    _run(args)
    if key:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps({"key": key, "time": time.strftime("%Y-%m-%d %H:%M:%S")}) + "\n", encoding="utf-8", newline="\n")


def _run(args):
    pieces, skipped = {}, []
    for dest, data in build(skipped if args.check else None).items():
        path = RP / f"{dest}.ogg"
        if data is None:  # --check on a clone without the git-ignored music masters: the shipped file stands in for the length check
            decoded, _ = sf.read(path, always_2d=True)
        else:
            payload = encode(data)
            decoded, _ = sf.read(io.BytesIO(payload), always_2d=True)
        if args.check and data is not None:
            current, _ = sf.read(path, always_2d=True)
            if current.shape != decoded.shape or not np.array_equal(current, decoded):
                raise ValueError(f"{dest}: shipped audio differs from the master encoding")
        elif not args.check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
        seconds = len(decoded) / RATE
        peak = db(np.abs(decoded).max()) if decoded.any() else -math.inf
        print(f"{dest}: {seconds:.2f}s, {decoded.shape[1]} ch, peak {peak:.1f} dBFS")
        name = Path(dest).name
        if name.startswith("village_") and name != "village_rest":
            pieces[f"music.lothlorien.{name.replace('_', '.')}"] = math.ceil(seconds * 20)
    if skipped:
        print(f"skipped (master not in this clone, tick lengths taken from the shipped files): {', '.join(skipped)}")
    shipped = dict(re.findall(r'id: "([^"]+)", ticks: (\d+)', RULES.read_text(encoding="utf-8")))
    if {k: int(v) for k, v in shipped.items()} != pieces:
        print("PIECES in village_music_rules.js should be:")
        for k, v in pieces.items():
            print(f'  {{ id: "{k}", ticks: {v} }},')
        if args.check:
            raise ValueError("village_music_rules.js PIECES do not match the encoded lengths")


if __name__ == "__main__":
    main()
