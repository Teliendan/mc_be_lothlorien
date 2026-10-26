"""Encode the soundscape masters (docs/SOUNDSCAPE_PLAN.md), or check the shipped audio.

Run with the moss_sfx/moss audio venv (numpy + soundfile); no model needed.
Masters: tools/audio/soundscape/*.flac (raw generator takes, mono, committed) and
tools/audio/soundscape/music/*.flac (raw 48 kHz stereo pieces, git-ignored for size; seeds and prompts are in
docs/SOUNDSCAPE_PLAN.md). Edits are fixed in TAKES, so a re-run reproduces the shipped files.

  sfx:   shorten inner quiet runs, trim both edges to the audible part (optional cut), short fade-in, fade-out,
         even loudness.
  music: shorten inner quiet runs (> 1.5 s under -45 dBFS -> 0.8 s), optional cut + fade, even loudness.
--check compares the shipped Ogg files with a fresh encoding and the tick lengths in village_music_rules.js.
"""
from pathlib import Path
import argparse
import io
import math
import re

import numpy as np
import soundfile as sf


MOD = Path(__file__).absolute().parents[1]
SRC = MOD / "tools/audio/soundscape"
RP = MOD / "lothlorien_rp/sounds"
RULES = MOD / "lothlorien_bp/scripts/village_music_rules.js"
RATE = 48000

# output (relative to RP), master, kind, options. Owner picks 2026-10-26 (audition 2).
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
    # gusts swell from a quiet bed: tighter edge threshold, longer fades
    ("ambient/lothlorien/forest_gust_1", "forest_gust_s311", "sfx", {"edge_db": 24, "fade_in": 1.0, "fade_out": 2.0}),
    ("ambient/lothlorien/forest_gust_2", "forest_gust_s312", "sfx", {"edge_db": 24, "fade_in": 1.0, "fade_out": 2.0}),
    ("music/lothlorien/village_1", "music/harp_flute_s411", "music", {"cut": 86.0}),  # weak after the drop at 86 s
    ("music/lothlorien/village_2", "music/harp_solo_s402", "music", {}),
    ("music/lothlorien/village_3", "music/harp_flute_s431", "music", {"fade_out": 8.0}),  # abrupt ending
    ("music/lothlorien/village_4", "music/harp_flute_s432", "music", {}),
    ("music/lothlorien/village_5", "music/harp_flute_s433", "music", {}),
    ("music/lothlorien/village_6", "music/harp_solo_s451", "music", {}),
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
    return loudness(fades(x, 0.0, fade_out), -16, -1)


def encode(data):
    stream = io.BytesIO()
    with sf.SoundFile(stream, "w", RATE, data.shape[1], format="OGG", subtype="VORBIS") as f:
        for i in range(0, len(data), RATE):  # one long Vorbis write kills the process (docs/local-audio.md)
            f.write(data[i:i + RATE])
    return stream.getvalue()


def build():
    out = {}
    for dest, master, kind, opts in TAKES:
        x, rate = sf.read(SRC / f"{master}.flac", always_2d=True)
        if rate != RATE:
            raise ValueError(f"{master}: {rate} Hz")
        out[dest] = (sfx if kind == "sfx" else music)(x, **opts)
    out[REST] = np.zeros((10 * RATE, 2))
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare shipped files and piece lengths with a fresh encoding")
    args = parser.parse_args()
    pieces = {}
    for dest, data in build().items():
        payload = encode(data)
        decoded, _ = sf.read(io.BytesIO(payload), always_2d=True)
        path = RP / f"{dest}.ogg"
        if args.check:
            current, _ = sf.read(path, always_2d=True)
            if current.shape != decoded.shape or not np.array_equal(current, decoded):
                raise ValueError(f"{dest}: shipped audio differs from the master encoding")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
        seconds = len(decoded) / RATE
        peak = db(np.abs(decoded).max()) if decoded.any() else -math.inf
        print(f"{dest}: {seconds:.2f}s, {decoded.shape[1]} ch, peak {peak:.1f} dBFS")
        name = Path(dest).name
        if name.startswith("village_") and name != "village_rest":
            pieces[f"music.lothlorien.{name.replace('_', '.')}"] = math.ceil(seconds * 20)
    shipped = dict(re.findall(r'id: "([^"]+)", ticks: (\d+)', RULES.read_text(encoding="utf-8")))
    if {k: int(v) for k, v in shipped.items()} != pieces:
        print("PIECES in village_music_rules.js should be:")
        for k, v in pieces.items():
            print(f'  {{ id: "{k}", ticks: {v} }},')
        if args.check:
            raise ValueError("village_music_rules.js PIECES do not match the encoded lengths")


if __name__ == "__main__":
    main()
