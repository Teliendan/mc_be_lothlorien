# One-voice Sindarin pronunciation plan

2026-10-16. Owner requests: one actor, Harmony-dependent openings, distinct
refusal to speak, pronunciation-based generator input, then one harder audition.
See [`event mapping`](SINDARIN_VOICE_EVENTS.md) and
[`phrase provenance`](SINDARIN_VOICE_PHRASES.md). This is an editorial IPA draft,
not specialist certification or evidence of exact model pronunciation.

## Setup

**Current selection, owner confirmed 2026-10-16:** Spanish Chatterbox, F
("Gentle, a little more inflection"). Exact approved reference and settings:
[`SINDARIN_VOICE_SETUP.md`](SINDARIN_VOICE_SETUP.md). The Italian/IPA setup below
is rejected trial history. The IPA table remains a pronunciation draft; it is
not the chosen generator input format. Prepare Spanish respellings per phrase.

**Owner rejected audition 1 on 2026-10-16.** Frequent unwanted words and incorrect
*govannen* made the Italian/IPA result unusable; *lasto beth* was only OK-ish.
The earlier setup below is retained as trial history, not the current chosen
pipeline. Do not use that output as an actor reference. Spanish respelling with
the selected gentle actor is the chosen route. Free alternatives and
sentence-cadence requirements are in
[`SINDARIN_VOICE_RESEARCH.md`](SINDARIN_VOICE_RESEARCH.md).

Recommended first candidate: **Italian language hint with explicit IPA input**.
Italian's clear vowels, apical R and doubled consonants make a useful starting
point; this is a phonetic judgement, not a measured language ranking. Welsh is
not in the installed model's supported list. Italian, Finnish, Spanish and Czech
are listed. No carrier language's spelling handles every Sindarin sound.

Use existing MOSS-TTS-Local-Transformer-v1.5, cached snapshot
`be7766a6735b98bd793f7c79fb720b4d0f5d13b8`. Its cached README lists Italian/IPA;
the installed processor accepts `text`, `language`, `reference`, and singular
`instruction`. The installed upstream model card documents IPA inside `/.../`.
IPA is model-conditioning text, not a deterministic phoneme synthesizer.

```python
processor.build_user_message(
    text="/mɑɛ̯ ɡɔˈvɑnːɛn/",
    language="Italian",
    reference=[approved_actor_reference],
    instruction="Calm, clear conversational delivery. No music or background sound.",
)
```

Audition 1 uses direct synthesis without a reference, to hear the proposed actor
and IPA behaviour. If accepted with clean pronunciation, retain one approved
reference for all future lines. Do not make a permanent reference from a take
containing errors. VoiceGenerator casting and the local guide's continuation /
carrier technique remain fallback options, not requirements for the first test.

Keep original Sindarin separately from generator input. Change warmth and
firmness by performance, using the same identity; no profession pitch shifting.
Italian is provisional until listening. If its language hint overrides a
specified consonant, test the same IPA without that hint before accepting a
wrong sound. No new model or phonemizer download is needed.

## All 20 selected texts

T = attested wording/form; E = attested excerpt; N = Neo-Sindarin composition or
modern use. IPA transcriptions are drafts under the general late-Sindarin model
referenced below. Pool names and English meanings are not spoken input.

| Pool(s) | Sindarin | English | Label | Generator text (IPA draft) |
| --- | --- | --- | --- | --- |
| opening_neutral | Mae govannen. | Well met. | T | `/mɑɛ̯ ɡɔˈvɑnːɛn/` |
| opening_neutral | Suilad. | Greetings. | N | `/ˈsui̯lɑd/` |
| opening_neutral | Tolo. | Come. | T | `/ˈtɔlɔ/` |
| opening_warm | Mae govannen, mellon. | Well met, friend. | N | `/mɑɛ̯ ɡɔˈvɑnːɛn ˈmɛlːɔn/` |
| opening_warm | Suilad, mellon. | Greetings, friend. | N | `/ˈsui̯lɑd ˈmɛlːɔn/` |
| opening_warm | Tolo, mellon. | Come, friend. | N | `/ˈtɔlɔ ˈmɛlːɔn/` |
| trade_positive, completion | Ma! | Good! / That's right! | T | `/mɑ/` |
| trade_positive, completion | Mae. | Excellent. | T | `/mɑɛ̯/` |
| explain | Lasto. | Listen. | T | `/ˈlɑstɔ/` |
| explain | Lasto beth lammen. | Listen to the word of my tongue. | E | `/ˈlɑstɔ bɛθ ˈlɑmːɛn/` |
| explain | Tolo a lasto. | Come and listen. | N | `/ˈtɔlɔ ɑ ˈlɑstɔ/` |
| task_taken | Caro mae. | Do well. | N | `/ˈkɑrɔ mɑɛ̯/` |
| task_taken | Dandolo. | Come back. | N | `/ˈdɑndɔlɔ/` |
| completion | Mae garnen. | Well done. | N | `/mɑɛ̯ ˈɡɑrnɛn/` |
| refuse_speak | Avon. | I will not. | T | `/ˈɑvɔn/` |
| refuse_speak | Avam. | We will not. | T | `/ˈɑvɑm/` |
| combat_start | Daro! | Halt! | T | `/ˈdɑrɔ/` |
| combat_start | Baw! | Don't! | T | `/bɑu̯/` |
| combat_start | Avo garo! | Don't do it! | T | `/ˈɑvɔ ˈɡɑrɔ/` |
| healing | Cuio mae. | Live well. | N | `/ˈkui̯.ɔ mɑɛ̯/` |

The warm additions are N: new utterances assembled from existing vocabulary.
Both opening pools have three slots, shared equally by all trading professions.

## Respelling fallback and listening targets

If IPA is poor, these are Italian-style **experiments**, not exact equivalents:

| Sindarin | Italian-style experiment | Limit |
| --- | --- | --- |
| Mae govannen | `Mai govànnen.` | AI is Tolkien's permitted approximation for AE, not exact /ɑɛ̯/ |
| Mae govannen, mellon | `Mai govànnen, mèllon.` | Preserve doubled N/L; same AE approximation |
| Baw | `Bau!` | One syllable, falling AU |
| Caro mae | `Càro mai.` | Hard K; first-syllable stress; same AE approximation |
| Avon | `Àvon.` | First-syllable stress; V must stay /v/ |
| Lasto beth lammen | `Làsto /bɛθ/ làmmen.` | Mixed IPA: Italian has no faithful TH spelling |

Do not replace *beth* with *bet*, *bez* or *bec*: those change the consonant.
Sindarin C = /k/, TH = /θ/, DH = /ð/, CH = /x/. Keep full vowels, falling AE/UI/AU,
stress **go-VAN-nen**, and hold doubled consonants in *govannen*, *mellon* and
*lammen*. *Cuio* has a falling UI followed by a separate O syllable. Future long
vowels must preserve length independently of stress. Italian accents in the
fallback column mark stress, not Sindarin vowel length.

## Requested first audition

**Mae govannen, mellon. Lasto beth lammen.**

Meaning: "Well met, friend. Listen to the word of my tongue."
This deliberately combines a warm greeting (N) and an attested excerpt (E)
solely for the requested difficult audition; production still plays one pool
line per interaction. It tests AE, noninitial stress, doubled N/L/M and final TH.

Input: `/mɑɛ̯ ɡɔˈvɑnːɛn ˈmɛlːɔn/ [pause 0.5s] /ˈlɑstɔ bɛθ ˈlɑmːɛn/`.
Scratch script, raw output, audition WAV/Ogg, log and exact metadata live under
`temp/lothlorien-voices/`. No audio goes into the pack before owner evaluation.
Ordinary-language Whisper transcription is not a Sindarin acceptance test.

First take generated 2026-10-16, seed 16102026, direct Italian-hinted IPA
synthesis without a reference. Model load 20.28 s, generation/decode 98.1 s,
peak CUDA allocation 12.038 GiB. Raw output 48 kHz stereo, retained unchanged;
audition downmixed to mono and attenuated to -6 dBFS peak. Audition duration
9.20 s, RMS -26.7 dBFS, probe silence fraction 0.38. WAV and Ogg decode.
These are signal/file checks only, not listening approval or a pronunciation
verdict. The final metadata console print hit Windows cp1252 after all assets
and JSON were written; stdout was subsequently fixed to UTF-8 in the scratch
script. No second synthesis was needed for that reporting-only failure.

## Sources

Inspected 2026-10-16: local cached README/processor and installed upstream model
card. Language recommendation and transcriptions remain provisional.

- [MOSS local model/language list](https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Local-Transformer-v1.5).
- [MOSS slash-wrapped IPA syntax](https://github.com/OpenMOSS/MOSS-TTS/blob/main/docs/moss_tts_model_card.md#ipa-input).
- [Eldamo pronunciation](https://eldamo.org/content/words/word-4127298049.html), citing LotR Appendix E.
- [Eldamo stress](https://eldamo.org/content/words/word-2360883551.html).
- [RealElvish human pronunciation examples](https://realelvish.net/pronunciation/sindarin/),
  for comparison only, not voice-cloning references.
- [Local audio workflow](../../../docs/local-audio.md).
