# Sindarin voice lines

## Status

Final, owner-accepted 2026-10-25 by listening (audition rounds 2026-10-16 and
2026-10-23..25; warden thanks 2026-10-28). 31 files cover all 22 texts. They are bound in the
pack by `tools/install_sindarin_voice.py` (`--check` verifies it) and wired in
script (2026-10-25), **not yet heard in game**; the owner's game test is pending:
[`SINDARIN_VOICE_EVENTS.md`](SINDARIN_VOICE_EVENTS.md). Language provenance:
[`SINDARIN_VOICE_PHRASES.md`](SINDARIN_VOICE_PHRASES.md).

Files are in `tools/audio/sindarin_voice/final/`. The WAV is the exact audio the
owner approved (24 kHz mono PCM16). The OGG is its Vorbis encode for the pack.
`final/lines.json` records each file's generator text, language, guide, seed,
parameters, source take, edit, duration and SHA-256. Texts with 2-3 files are
random variants of one sound event.

## Final set

| Sindarin | English | Pool(s) | Files | Delivery |
| --- | --- | --- | --- | --- |
| Mae govannen. | Well met. | opening_neutral | mae_govannen | gentle |
| Suilad. | Greetings. | opening_neutral | suilad (splice) | gentle |
| Tolo. | Come. | opening_neutral | tolo | gentle |
| Mae govannen, mellon. | Well met, friend. | opening_warm | mae_govannen_mellon | gentle |
| Suilad, mellon. | Greetings, friend. | opening_warm | suilad_mellon_1, _2 | gentle |
| Tolo, mellon. | Come, friend. | opening_warm | tolo_mellon | gentle |
| Ma! | Good! | trade_positive, completion | ma_1, ma_2 | gentle |
| Mae. | Excellent. | trade_positive, completion | mae_1, mae_2 | gentle |
| Lasto. | Listen. | explain | lasto_1, lasto_2 | gentle |
| Lasto beth lammen. | Listen to the word of my tongue. | explain | lasto_beth_lammen | gentle |
| Tolo a lasto. | Come and listen. | explain | tolo_a_lasto | gentle |
| Caro mae. | Do well. | task_taken | caro_mae (hand cut) | gentle |
| Dandolo. | Come back. | task_taken | dandolo_1, _2 | gentle |
| Mae garnen. | Well done. | completion | mae_garnen | gentle |
| Avon. | I will not. | refuse_speak | avon_1, avon_2 | firm |
| Avam. | We will not. | refuse_speak | avam | firm |
| Daro! | Halt! | combat_start | daro | shout |
| Baw! | Don't! | combat_start | baw | shout |
| Avo garo! | Don't do it! | combat_start | avo_garo | shout |
| Cuio mae. | Live well. | healing | cuio_mae_1, _2, _3 | gentle |
| Annon allen. | I thank you. | thanks | annon_allen_1, _2 | gentle |
| Annon allen, mellon. | I thank you, friend. | thanks_warm | annon_allen_mellon | gentle |

## Voice and settings

One actor for every line: gentle reference **F**, `actor_reference.wav`
(owner-selected 2026-10-16). Engine: Chatterbox multilingual `t3_mtl23ls_v2`,
snapshot `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`, local, default PerTh
watermark kept. `language_id="es"`; the input is a Spanish respelling of the
Sindarin, not alternate Sindarin. Chatterbox takes a voice reference, not a
style prompt; delivery comes from the reference and the parameters.

Base settings: exaggeration 0.4, cfg_weight 0.3, temperature 0.65,
repetition_penalty 2.0, min_p 0.05, top_p 1.0.

## Deliveries

| Delivery | Guide | Changed settings | Used for |
| --- | --- | --- | --- |
| gentle | `actor_reference.wav` | none | all calm lines |
| firm | `actor_reference.wav` | exaggeration 0.7 | avon_1, avam |
| firm | `guides/command_ref_2.wav` | none | avon_2 |
| shout | `guides/shout_vg_1.wav` | exaggeration 1.0, cfg 0.5 | daro, baw |
| shout | `guides/shout_vg_2.wav` | exaggeration 1.0, cfg 0.5 | avo_garo |

- `command_ref_2.wav`: MOSS-TTS clone of the original actor with a firm-command
  direction (owner-accepted for refusals 2026-10-24).
- Warden combat lines must be **shouts** (owner). The gentle reference,
  MOSS-cloned "commanding"/"shouting" guides and exaggeration up to 0.8 all stayed
  too calm. A clone told to shout measured 152 Hz median pitch, the gentle guide
  98 Hz. The accepted shout guides are MOSS-VoiceGenerator voices written from the
  actor's description plus "shouting": 318-338 Hz, and the Sindarin takes carried
  it (320-360 Hz, measured). They are not clones of the actor; the owner accepted
  the result 2026-10-25.

## Post-processing

Owner-accepted 2026-10-24/25; code in `tools/sindarin_voice_post.py`.

Chatterbox often ends a line with 0.3-0.7 s of silence and then a separate
noise or babble burst, up to -0.5 dBFS. Edge-silence trimming keeps it.

1. Speech = any 10 ms frame within 40 dB of the loudest frame.
2. Cut at the first pause of at least 0.22 s after speech starts.
3. Drop trailing segments (after an 80 ms pause) that never come within 20 dB
   of the peak: quiet mumble.
4. 10 ms fade-in, 50 ms fade-out.
5. Level to -26 dBFS RMS, capped at -3 dBFS peak.

Limits:
- In multi-word lines the model sometimes pauses ~0.4 s before the last word.
  The cut then drops that word; by level it looks like a tail burst. Choose
  another seed.
- Quiet breath only ~17 dB below the words survives the cut. Caro mae needed a
  hand cut.
- Shortening internal pauses (`tighten_pauses`) was tried twice; the owner
  preferred a retake both times.

## Spanish respelling rules that held up

Owner-heard 2026-10-16..25 unless noted.

- Stress: Spanish stresses the penult when a word ends in a vowel, -n or -s,
  otherwise the last syllable. Mark the rest: `Ávam`, `Súilad`, `Dándolo`.
  Extra accents are harmless (`Tólo`, `Dáro`, `mélon`).
- Write single `l` (`mélon`); Spanish `ll` is a Y sound. Keep doubled `nn`/`mm`
  (`govánnen`, `lámmen`).
- No Spanish /v/: v comes out as b. Accepted.
- Keep `beth`: the input `bez` was heard as "bez" (2026-10-16).
- AE: `Mai` works inside `Mai govánnen` and `Mai gárnen`. Standalone and after a
  verb write `Máe` (`Máe.`, `Caro máe.`, `Cúyo máe.`); `mai` there was heard as
  "mai". `Cúyo mae.` also worked.
- UI: `Cúyo` (a real Spanish word) for Cuio. `Súilad` and `Súylad` sounded the
  same inside "Suilad, mellon". AU: `¡Bau!`.
- No comma in `Mai govánnen mélon.`: the comma gave a long pause.
- Exclamation marks for short calls and shouts: `¡Ma!`, `¡Dáro!`, `¡Ávo gáro!`.
- Final D is weak in Spanish. Standalone Suilad failed in every form tried
  (`Súilad.`, `Súylad.`, `¡Súilad!`, `Súilat.`, Italian `Sùilad.`, cfg 0.5 /
  temperature 0.5, `Súilade.` + trim): the I and/or D dropped. The final file is
  a splice: "Suila" from the suilad_mellon_1 take plus the D release of a
  `Súilade.` take, cut 20 ms after the release (`release_onset`, `splice`;
  details in lines.json).
- Avon sometimes ends in M: seed choice.

## Model behaviour (measured)

- About 5-10% of takes run away into 4-11 s of babble. Always check durations.
- Short single words are the riskiest.
- Some seeds drop sounds or add words. Judge every take by ear.
- Whisper or other transcription is not an acceptance test; owner listening is.

## Generating more lines

1. Write `temp/<feature>/JOBS.json`. One entry per line: id, sindarin, english,
   pool, text (Spanish respelling, rules above), language (`es`), guide
   (`gentle`, `command2`, `shout_vg_1`, `shout_vg_2`), preset (`gentle`, `firm`,
   `shout`) or explicit params, seeds, and a listen hint for the owner. Exact
   schema and an example: the docstring of `tools/sindarin_voice.py`. Seeds: 6
   for single words, 4 for phrases.
2. Run from the workspace root:
   `E:/AI/audio/venvs/chatterbox/Scripts/python.exe -B mods/lothlorien/tools/sindarin_voice.py temp/<feature>/JOBS.json temp/<feature>/`
   It writes raw and cut takes, `results.json` and `listen.html`. Check the GPU
   is free first (`nvidia-smi`): a running game or local LLM server starves it,
   and even a one-take job then stalls for minutes. Normally the model loads in
   ~20 s and each take takes ~3 s. Generation itself was used for every batch;
   the consolidated script's page build was tested, its first full run was not.
3. Check `results.json` durations. Drop runaways; flag takes where the cut
   dropped a lot of audio (a lost last word).
4. Publish `listen.html` (made from `tools/audio/sindarin_voice/audition_template.html`)
   as an artifact with the db capability. The owner marks each take keep /
   maybe / reject with a note.
5. Read the `verdicts` collection of that artifact with ArtifactData.
6. Export each keeper: the levelled cut WAV (byte-identical to the audio on the
   page) to `final/<file>.wav` plus a Vorbis `final/<file>.ogg`. All 26 plain-cut
   finals were verified to rebuild exactly from their raw takes with
   `sindarin_voice_post`, so no raw takes are kept. Add a `lines.json` entry with the same fields as the
   existing ones (file, sindarin, english, pools, generator_text, language,
   guide, seed, params, source, edit, seconds, sha256).
7. Add the text to `SINDARIN_VOICE_PHRASES.md` with its T/E/N label, and the
   file to its pool in `SINDARIN_VOICE_EVENTS.md`. Delete the scratch when the
   owner accepts.

## Preserved source files

In `tools/audio/sindarin_voice/`:
- `actor_reference.wav`: the gentle F reference. Use the file; regenerating it
  from its description does not reproduce the voice.
- `accepted_audition.wav`, `voice_setup.json`: the 2026-10-16 approved audition
  ("Mae govannen, mellon. Lasto beth lammen.") and its settings and hashes.
- `reference_provenance.json`: how F was made (MOSS-TTS clone of the original
  actor with a gentle, melodic direction).
- `original_actor_reference.wav`, `original_actor_provenance.json`: the original
  MOSS-VoiceGenerator actor.
- `guides/command_ref_2`, `guides/shout_vg_1`, `guides/shout_vg_2` (`.wav` +
  `.json` with prompt, seed and parameters).
- `final/`: the 28 approved lines and `lines.json`.

## Owner decisions

- 2026-10-16: one shared actor for all elves; voice F, Spanish Chatterbox.
  Italian/IPA MOSS input rejected (unwanted words, wrong govannen).
- 2026-10-16: generate each interaction line as one complete utterance; do not
  combine unrelated lines into a paragraph. (Research rule from the same day:
  do not build lines from separately generated words. The Suilad splice is the
  one exception, owner-accepted 2026-10-25.)
- 2026-10-24: the speech-end cut and the mumble rule accepted.
- 2026-10-24: firm refusals via exaggeration 0.7 or the command_ref_2 guide.
- 2026-10-25: warden combat lines are shouts with the VoiceGenerator guides,
  though they are not clones of the actor.
- 2026-10-25: the 28-file set is final, with variants where listed above.
- 2026-10-28: warden thanks added (`Ánnon álen.`, `Ánnon álen mélon.`, gentle, 6 seeds each; owner kept
  annon_allen_1, _2 and annon_allen_mellon_3, exported as annon_allen_mellon). OGG via soundfile Vorbis.
