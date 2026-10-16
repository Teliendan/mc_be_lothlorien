"""Encode the four approved ambient masters, or check the shipped audio.

Run with the existing moss_sfx environment; no model or scratch files needed.
DOUBLE WAV masters preserve the exact samples used for the approved audition.
See docs/AMBIENT_SOUNDS.md for prompts, seeds, crops and listening acceptance.
"""
from pathlib import Path
import argparse
import io

import numpy as np
import soundfile as sf


MOD = Path(__file__).absolute().parents[1]
TAKES = (("deer", "ambient1"), ("deer", "ambient2"),
         ("swan", "ambient1"), ("swan", "ambient2"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare decoded assets to the approved masters' encoding")
    parser.add_argument("--output", type=Path,
                        default=MOD / "lothlorien_rp/sounds/mob/lothlorien")
    args = parser.parse_args()
    encoded = []
    for animal, name in TAKES:
        source = MOD / "tools/audio/ambient" / f"{animal}_{name}.wav"
        data, rate = sf.read(source, always_2d=True)
        if (rate != 48000 or data.shape[1] != 1 or not len(data)
                or not np.isfinite(data).all() or np.max(np.abs(data)) >= 0.999):
            raise ValueError(f"{source.name}: invalid master")
        stream = io.BytesIO()
        sf.write(stream, data, rate, format="OGG", subtype="VORBIS")
        payload = stream.getvalue()
        decoded, decoded_rate = sf.read(io.BytesIO(payload), always_2d=True)
        if (decoded_rate != rate or decoded.shape != data.shape
                or not np.isfinite(decoded).all() or np.max(np.abs(decoded)) >= 0.999):
            raise ValueError(f"{animal}/{name}: invalid Vorbis output")
        destination = args.output / animal / f"{name}.ogg"
        if args.check:
            current, current_rate = sf.read(destination, always_2d=True)
            if current_rate != rate or not np.array_equal(current, decoded):
                raise ValueError(f"{animal}/{name}: shipped audio differs from approved master encoding")
        peak = 20 * np.log10(np.max(np.abs(decoded)))
        print(f"{animal}/{name}: {len(decoded)/rate:.2f}s, mono 48 kHz, peak {peak:.1f} dBFS")
        encoded.append((destination, payload))
    if not args.check:
        for destination, payload in encoded:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(payload)


if __name__ == "__main__":
    main()
