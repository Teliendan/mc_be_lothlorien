# Lothlorien soundscape

Final design, accepted by the owner (music and soundscape ticked in `TODO.md`, 2026-10-29). Bedrock 1.26.52 / Script API 2.8.0.
(The file keeps its old name because scripts and tools point to it.) Listening rounds of 2026-10-26 and 2026-10-27 shaped it:
music levels are now even (normalized to -21 LUFS, game volume 0.5); generated wind gusts evoked cold autumn wind and were
dropped; the shrine's two gong-like tones are liked, the long pulsing tone is usable; pauses were shortened everywhere (shrine
10-25 s, memorial 12-30 s, village rest 10-30 s). Vanilla forest music stays in Lothlorien outside villages; inside a village
the village music replaces it, never two scores at once, and it does not duck near the shrine or memorial.

## Wiring and shipped takes

Owner picks from audition 2 (phone listening page, 2026-10-26). Masters in
`tools/audio/soundscape/` (music masters git-ignored for size; generator
commands with prompts and seeds in `provenance/`), edits and encoding in
`tools/prepare_soundscape.py` (`--check` compares shipped files and piece lengths).

| Layer | Wiring | Shipped takes |
| --- | --- | --- |
| Forest | client biome `ambient_sounds.addition` = `ambient.lothlorien.forest.additions`, non-3D, volume 1.0; a weight-168 silent entry (about 3 in 4 picks) thins them out | vanilla Dappled Forest poplar leaf rustles (`sounds/block/poplar_leaves/ambient1-24`, vanilla weights, its wind1-3 left out); no shipped files. Generated loop, rustles and gusts dropped |
| Root shrine | invisible `lothlorien:shrine_sound` under the root ceiling, `ambient` every 10-25 s, distance 3-24 | tones s321, s322 (cut to 8 s), s323 (cut to 10 s), 22 s s322 (cut to 17.5 s), bell s322 |
| Leaf memorial | invisible `lothlorien:memorial_sound` on the pillar cap, every 12-30 s, distance 3-24 | tones s321, s322; harp s321, s322 |
| Village | `scripts/village_music.js`: `playMusic` piece, then a looped silent rest, 10-30 s; leaving fades after 10 s outside | 1 = harp_flute s411 (cut at 86 s, "good, positive"), 2 = harp_solo s402 ("calm"), 3 = harp_flute s431 (8 s fade-out added), 4 = s432 ("playful"), 5 = s433 ("melancholic"), 6 = harp_solo s451 ("playful, optimistic") |

Maybes not shipped: harp_solo s401 (first half perfect, then a change),
harp_flute s436 (a bit sharp). Loudness: structure sounds with loud passages at
-16 dBFS RMS, peak -1 dBFS; music at -21 LUFS integrated. Game volume in
`sound_definitions.json` (music 0.5, structure sounds 0.5 in `sounds.json`). Only newly generated
shrines and memorials carry the sound entities (new world).

Owner decision 2026-10-28: keep the village music area and timing as they are (it stops about 10 s after leaving plus a 5 s
fade; outlying benches may start it). A shorter tail and a deck-density start check were offered and declined. The existing
birdsong, deer and swan calls stay separate (`BIRDSONG.md`, `AMBIENT_SOUNDS.md`).

## Engine basis and limits

- Vanilla biome music is the listening model: a pool of pieces with pauses and silence. Pale Garden moss and heart sounds are
  the model for local structure ambience. Do not add polling per Mallorn leaf block.
- The pinned API (2.8.0) supports per-player music and positional sound playback; do not assume newer SoundInstance APIs.
- Structure sounds come from invisible sound entities, so only newly generated shrines and memorials carry them (new world). The
  memorial feature carries its sound through a look-alike seed log (`MEMORIAL.md`).
- Reusable findings and sources: workspace `.claude/skills/bedrock-modding/references/19-ambient-audio.md`; local audio workflow
  `docs/local-audio.md` and `docs/ambient-music-tools.md` (workspace). Provenance and prompts: `tools/audio/soundscape/provenance/`.

## Open listening checks

Poplar rustle volume and frequency; shrine and memorial reach and repetition; the invisible entities' ambient sounds play at all;
the village piece replaces vanilla forest music, the rest track keeps it out between pieces, and vanilla music returns after
leaving; no restart when briefly crossing the village edge; reload and multiplayer. Deferred: forest edge/interior/heart
variation, day/night sets, extra chimes and garden sounds, adaptive music.
