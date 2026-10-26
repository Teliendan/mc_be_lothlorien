#!/bin/sh
# Same seed, longer crop of the same 30 s canvas: the original take plus its full tail.
export TORCHDYNAMO_DISABLE=1 HF_HOME='E:\AI\hf_cache' HF_HUB_DISABLE_PROGRESS_BARS=1 TQDM_DISABLE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
PY=/e/AI/audio/venvs/moss_sfx/Scripts/python.exe
OUT='C:\mcmods\temp\soundscape\sfx2'
GUST="A single soft gust of wind rising and passing through high tree leaves, a gentle swelling rustle of the canopy that fades back to quiet. No birds, no voices."
RUSTLE="A brief gentle rustle of dry golden leaves stirring in the tree tops, a few leaves shivering in a light breeze, then quiet. Soft and distant, no birds."
TONE="One clear sustained resonant tone of a crystal singing bowl struck softly in a quiet root cave, a pure glassy ringing that shimmers and slowly fades away. Sacred and calm. No voices."
for s in 311 312; do
  $PY /e/AI/scripts/moss_sfx.py --seconds 16 --steps 50 --seed $s --outdir "$OUT" --job "forest_gust_s$s=$GUST" --job "forest_rustle_s$s=$RUSTLE"
done
$PY /e/AI/scripts/moss_sfx.py --seconds 22 --steps 50 --seed 322 --outdir "$OUT" --job "shrine_tone_s322=$TONE"
