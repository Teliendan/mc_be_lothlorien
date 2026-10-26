#!/bin/sh
OUT='C:\mcmods\temp\soundscape\music2'
gen() { name=$1; shift; python /e/AI/scripts/comfy_audio.py "$@" --duration 100 --output "$OUT\$name.flac"; }
FLUTE="concert harp with soft wooden flute and warm string pad, tranquil elven forest, unhurried, dreamy, fantasy film soundtrack, steady dynamics, full sound throughout, no breakdown, no fade out, instrumental, no percussion, no vocals"
SOLO="solo celtic harp, gentle, peaceful, unhurried, ethereal elven fantasy, warm and full, steady dynamics, flowing arpeggios throughout, no breakdown, instrumental, no drums, no vocals"
gen harp_flute --seed 431 --count 6 --bpm 70 --keyscale "G major" --tags "$FLUTE"
gen harp_flute_d --seed 441 --count 3 --bpm 66 --keyscale "D major" --tags "$FLUTE"
gen harp_solo --seed 451 --count 4 --bpm 66 --keyscale "D major" --timesignature 3 --tags "$SOLO"
