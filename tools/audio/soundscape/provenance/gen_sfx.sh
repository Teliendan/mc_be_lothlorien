#!/bin/sh
export TORCHDYNAMO_DISABLE=1 HF_HOME='E:\AI\hf_cache' HF_HUB_DISABLE_PROGRESS_BARS=1 TQDM_DISABLE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
PY=/e/AI/audio/venvs/moss_sfx/Scripts/python.exe
OUT='C:\mcmods\temp\soundscape\sfx'
# shrine and memorial tones
$PY /e/AI/scripts/moss_sfx.py --seconds 12 --steps 50 --seed 321 --count 3 --outdir "$OUT" \
  --job shrine_tone="One clear sustained resonant tone of a crystal singing bowl struck softly in a quiet root cave, a pure glassy ringing that shimmers and slowly fades away. Sacred and calm. No voices." \
  --job shrine_bell="A single soft high bell-like chime of glass, clear and pure, ringing with a long shimmering sustain and a slow gentle fade into silence. Reverent and still." \
  --job memorial_tones="Three or four soft gently descending bell-like notes, tender and melancholic, each note lingering with a long slow decay into silence. Slow, sparse, quiet." \
  --job memorial_harp="A few soft plucked harp notes slowly descending, gentle and sorrowful, with long ringing decay fading into silence. Sparse and quiet, no other instruments."
