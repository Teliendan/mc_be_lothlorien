#!/bin/sh
PY=/e/AI/audio/venvs/moss/Scripts/python.exe
OUT='C:\mcmods\temp\soundscape\music'
gen() { name=$1; shift; python /e/AI/scripts/comfy_audio.py "$@" --duration 150 --count 3 --output "$OUT\$name.flac"; }
gen harp_solo --seed 401 --bpm 66 --keyscale "D major" --timesignature 3 \
  --tags "solo celtic harp, gentle, peaceful, slow, ethereal elven fantasy, calm ambient, sparse, soft, lots of space, instrumental, no drums, no vocals"
gen harp_flute --seed 411 --bpm 70 --keyscale "G major" \
  --tags "concert harp with soft wooden flute and warm string pad, tranquil elven forest, slow, dreamy, fantasy film soundtrack, instrumental, no percussion, no vocals"
gen harp_wistful --seed 421 --bpm 60 --keyscale "E minor" \
  --tags "fingerpicked harp, wistful, gently melancholic, minimal, calm game soundtrack, airy reverb, slow, quiet, instrumental, no drums, no vocals"
