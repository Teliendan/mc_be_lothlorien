"""Post-processing for Chatterbox Sindarin voice takes.

Chatterbox often ends a short line with 0.3-0.7 s of silence and then a separate
burst of noise or babble, sometimes louder than the word. Edge-silence trimming
keeps that burst, so `cut_utterance` ends the clip at the first long pause after
speech starts instead. Owner-accepted 2026-10-24/25; limits in docs/SINDARIN_VOICE.md.
No model needed: numpy and soundfile only.
"""
import numpy as np


FRAME = 0.01


def frames_db(audio, rate):
    """RMS level of each 10 ms frame, in dBFS."""
    f = int(FRAME * rate)
    n = len(audio) // f
    rms = np.sqrt(np.mean(audio[:n * f].reshape(n, f) ** 2, axis=1))
    return 20 * np.log10(rms + 1e-9)


def fade_out(clip, rate, seconds):
    clip = clip.copy()
    n = min(int(seconds * rate), len(clip))
    clip[len(clip) - n:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, n)))
    return clip


def cut_utterance(audio, rate, floor_db=40, gap=0.22, mumble_db=20,
                  lead=0.04, tail=0.08, fade_in=0.01, fade=0.05):
    """Return (clip, info) holding only the spoken line.

    Speech is any frame within floor_db of the loudest frame. The line ends at
    the first non-speech run of at least `gap` seconds. Trailing segments after
    an 80 ms pause that never come within mumble_db of the peak are breath or
    mumble and are dropped too.
    """
    db = frames_db(audio, rate)
    speech = db > db.max() - floor_db
    first = np.flatnonzero(speech)[0]
    need = int(round(gap / FRAME))
    last = first
    quiet = 0
    for i in range(first, len(db)):
        if speech[i]:
            last = i
            quiet = 0
        else:
            quiet += 1
            if quiet >= need:
                break
    short = int(round(0.08 / FRAME))
    while True:
        run = 0
        split = None
        for i in range(last, first, -1):
            if speech[i]:
                if run >= short:
                    split = i
                    break
                run = 0
            else:
                run += 1
        if split is None or db[split + run + 1:last + 1].max() >= db.max() - mumble_db:
            break
        last = split
    f = int(FRAME * rate)
    start = max(0, first * f - int(lead * rate))
    end = min(len(audio), (last + 1) * f + int(tail * rate))
    clip = audio[start:end].copy()
    a = int(fade_in * rate)
    clip[:a] *= np.linspace(0, 1, a)
    clip = fade_out(clip, rate, fade)
    rest = audio[end:]
    info = dict(start=round(start / rate, 3), end=round(end / rate, 3),
                dropped_seconds=round(len(rest) / rate, 2),
                dropped_peak_db=round(float(20 * np.log10(np.max(np.abs(rest)) + 1e-9)), 1)
                if len(rest) else None)
    return clip, info


def tighten_pauses(audio, rate, max_pause=0.06, floor_db=30, xfade=0.01):
    """Shorten each internal pause to max_pause with a crossfade; return (clip, seconds removed).
    Tried on two takes in 2026-10; the owner preferred a retake both times."""
    db = frames_db(audio, rate)
    speech = db > db.max() - floor_db
    f = int(FRAME * rate)
    keep = int(max_pause * rate)
    x = int(xfade * rate)
    idx = np.flatnonzero(speech)
    runs = []
    i = idx[0]
    while i < idx[-1]:
        if not speech[i]:
            j = i
            while not speech[j]:
                j += 1
            if (j - i) * f > keep + 2 * x:
                runs.append((i * f, j * f))
            i = j
        else:
            i += 1
    parts = []
    pos = 0
    removed = 0
    for a, b in runs:
        cut_a, cut_b = a + keep // 2, b - keep // 2
        parts.append(audio[pos:cut_a + x].copy())
        pos = cut_b - x
        removed += cut_b - cut_a
    parts.append(audio[pos:].copy())
    ramp = np.linspace(0, 1, x)
    for k in range(1, len(parts)):
        joint = parts[k - 1][-x:] * (1 - ramp) + parts[k][:x] * ramp
        parts[k - 1] = parts[k - 1][:-x]
        parts[k] = np.concatenate([joint, parts[k][x:]])
    return np.concatenate(parts), round(removed / rate, 3)


def release_onset(audio, rate, dip_from, dip_to, rise_db=8):
    """Time (s) a stop consonant is released: the first frame after the deepest dip
    in [dip_from, dip_to] s that is rise_db above it. Read the dip window from the
    envelope by eye; automatic dip finding picked the wrong dip on most takes.
    The final Suilad ends 20 ms after the D release of a "Súilade." take."""
    db = frames_db(audio, rate)
    a, b = int(dip_from / FRAME), int(dip_to / FRAME)
    low = a + int(np.argmin(db[a:b]))
    k = low + 1
    while db[k] - db[low] < rise_db:
        k += 1
    return k * FRAME


def splice(head, tail, rate, xfade=0.01):
    """Join two clips of the same voice with a short linear crossfade."""
    x = int(xfade * rate)
    ramp = np.linspace(0, 1, x)
    return np.concatenate([head[:-x], head[-x:] * (1 - ramp) + tail[:x] * ramp, tail[x:]])


def level(audio, rms_db=-26, peak_db=-3):
    """Level to rms_db RMS without exceeding peak_db (the setting of every approved line)."""
    return audio * min(10 ** (rms_db / 20) / np.sqrt(np.mean(audio ** 2)),
                       10 ** (peak_db / 20) / np.max(np.abs(audio)))


def print_envelope(audio, rate, start=0.0, end=None):
    """Print 10 ms levels, for reading dips, pauses and tail bursts by eye."""
    db = frames_db(audio, rate)
    lo, hi = int(start / FRAME), len(db) if end is None else int(end / FRAME)
    print(" ".join(f"{i * FRAME:.2f}:{int(db[i])}" for i in range(lo, min(hi, len(db)))))
