# Free Sindarin voice routes and audition 2

**Final voice selection, owner confirmed 2026-10-16:** F, "Gentle, a little
more inflection", is best and will be used. The long pause between the two
audition sentences is acknowledged and acceptable for the planned short
interaction phrases. The selected Spanish Chatterbox reference, exact heard
audition, settings and provenance are preserved outside scratch; follow
[`SINDARIN_VOICE_SETUP.md`](SINDARIN_VOICE_SETUP.md). Earlier pending-listening
statuses below describe trial history. Other phrases still need pronunciation
review. This selection does not implement sound bindings or generate the bank.

2026-10-16. Owner rejected audition 1: frequent unwanted words resembling
"kurzu", incorrect *govannen*, and only approximately acceptable *lasto beth*.
Owner requested Spanish, a nobler elven voice, free-of-payment alternatives,
and sentence cadence as well as individual sounds. No pack changes.

## What the failed take establishes

The Italian-hinted IPA recipe did not produce acceptable Sindarin. Documented
IPA input support is not proof of reliable phoneme obedience. The failed clip
must not become the permanent actor reference. It does not isolate whether
Italian, full IPA, model behaviour or sampling caused each error.

The local MOSS v1.5 code has no exposed option that guarantees unfamiliar
words will remain literal. Its `text_temperature` affects audio continue/end
tokens in this model, not an editable transcript. Lowering it is not a fix for
invented spoken words. Learned drift toward familiar patterns is a plausible
explanation, not a diagnosis proved from audio analysis.

## Audition 2: Spanish plus a designed original actor

- Same target: **Mae govannen, mellon. Lasto beth lammen.**
- Ordinary Spanish-style generator text: **Mai govánnen, mélon. Lasto bez lámmen.**
- No full IPA input in this trial. `Mai` uses Tolkien's tolerated AI approximation
  for AE. The accent in *govánnen* requests the correct stressed syllable.
- *Mélon* avoids Spanish LL being read as a consonantal Y. This loses guaranteed
  doubled-L length; spelling by itself cannot force it. Doubled M/N remain
  uncertain too. These are generator experiments, not alternate Sindarin.
- *Bez* requests the TH sound through Castilian Spanish Z. A generic Spanish
  language hint does not guarantee the Spain dialect. Spanish V/B are not
  distinguished; a true /v/ in *govannen* remains a known weakness of this route.
  [RAE: V](https://www.rae.es/dpd/v),
  [RAE: regional S/Z distinctions](https://www.rae.es/buen-uso-espa%C3%B1ol/el-seseo-y-el-ceceo).
- One new original reference was cast with MOSS-VoiceGenerator: refined light
  baritone, warm smooth resonance, clear diction, courtly dignity, serene,
  quietly authoritative. English reference text:
  "Welcome, traveller. Rest beneath the trees, and let the evening bring you peace."
  It is a synthetic actor, not a real-person imitation. Reference itself is
  provisional and must be heard before long-term adoption.
- MOSS local v1.5 uses that reference, Spanish language hint, exact-reading /
  dignified-delivery instruction, audio temperature 1.2 rather than the earlier
  1.7. Lower sampling is an experiment, not a fidelity guarantee.
- A second comparison uses installed Chatterbox multilingual, same reference
  and same respelling. This separates model choice from changing the intended
  actor, although cloning does not guarantee identical voice identity.

Scratch and exact provenance: `temp/lothlorien-voices/spanish/`, with generation
scripts/logs in its parent. MOSS reference seed 17102026, reference duration
4.88 s, generation 6.47 s. Spanish MOSS seed 18102026, output 6.40 s, synthesis /
decode 27.66 s. Raw stereo output retained; audition mono with -6 dBFS headroom.
No listening approval or precise pronunciation claim. Chatterbox's default
PerTh watermark is retained.

## Cadence is part of acceptance

**Owner audition-2 feedback, 2026-10-16:** Spanish is much better, but *Mae
govannen* is too quick, the pause before *mellon* is too long, and *beth* sounds
like "bez". The original is retained for comparison. A revision removes the
comma before *mellon*, asks for a connected unhurried first phrase and uses a
targeted `/bɛθ/` override in otherwise Spanish-spelled text. This is another
test, not a claim of correction before listening. The same actor reference and
seed are retained. Files named `moss_spanish_revision.*` hit the full 192-frame
generation budget (15.36 s, 104.57 s synthesis) with the targeted IPA override;
set aside as a runaway/capped candidate before asking the owner to evaluate it.
The next timing trial uses ordinary `Mai govánnen mélon. Lasto beth lámmen.`,
with a compact style instruction and files named `moss_spanish_connected.*`.
That ordinary-spelling revision also hit 192 frames / 15.36 s (76.74 s synthesis).
Neither correction take has a confirmed clean end; retain them as rejected
budget-limited candidates rather than claiming the timing or TH was fixed.
The accepted direction remains audition 2's Spanish respelling, with the
owner's three unresolved criticisms recorded above. No whole-bank rollout.

**Chatterbox comparison generated, 2026-10-16:** the installed multilingual
`t3_mtl23ls_v2` model successfully generated the same line with the same original
actor reference, using `Mai govánnen mélon. Lasto beth lámmen.` (no comma before
*mellon*). Output: `temp/lothlorien-voices/spanish/chatterbox_spanish.wav` and
`.ogg`, 3.48 seconds at 24 kHz mono; seed 19102026, exaggeration 0.3,
cfg_weight 0.3, temperature 0.65. Load plus synthesis took 29.9 seconds.
Default PerTh watermark retained. This is a generated comparison, not an
accepted correction: the owner has not evaluated its words, cadence or voice.
The local listening page contains both engines and the actor reference.

The owner also offered to perform the dubbing if synthesis cannot reach the
target. This makes guide-performance voice conversion a practical option:
record whole connected phrases in a dry room, perform the intended rhythm and
emotion naturally, then convert toward the original synthetic actor's timbre.
No need to imitate a deep fantasy voice in the guide. Keep multiple clean takes
and preserve the unprocessed recording. Evaluate conversion against the source
for consonants, vowel lengths, timing and intonation; never assume preservation.

The owner explicitly requires sentence rhythm, stress, connected speech,
pauses and intonation. This audition is not a string of separately pronounced
syllables. The proposed performance has two coherent phrases:

1. A fluent warm greeting, with lexical stress in **go-VAN-nen**, addressed to
   **MEL-lon**, then a small natural pause.
2. A connected invitation to listen: **LAS-to beth LAM-men**, with *beth lammen*
   flowing together, and a settled ending.

Those are performance directions, not a claim that this precise intonation is
uniquely Tolkien-attested. Noble means composed and assured, with clear diction
and expressive sentence shape. It does not mean stretching every syllable,
constant whispering, solemn chanting or a trailer-narrator growl.

Evaluate whole phrases before tiny consonant refinements. Do not concatenate
isolated word generations into a final line: that discards coarticulation,
relative timing and phrase intonation. Audio editing can clean edges and pauses;
it cannot establish the right delivery on its own.

## Free options, ranked by what they solve

All routes below can run locally without an inference subscription. None is
claimed to be a proven Sindarin engine. New engines were researched, not
installed or downloaded in this task.

| Route | Pronunciation control | Cadence / actor | Assessment |
| --- | --- | --- | --- |
| Existing MOSS, Spanish respelling | Learned reading of unfamiliar text; approximate and subject to invention | Designed actor reference, sentence punctuation and style instruction | Cheapest next trial; audition 2, not a final recommendation |
| Existing Chatterbox multilingual, Spanish respelling | Different model but still text-conditioned | Same synthetic actor reference; expressive parameters | Useful direct comparison, with the same language/orthography weaknesses |
| **Kokoro raw phoneme input** | `generate_from_tokens` accepts a phoneme string and bypasses ordinary spelling/G2P | Neural phrase prosody plus voice selection; no guarantee of Sindarin cadence | Best next fully synthetic candidate; validate every phoneme against its vocabulary |
| **Correct guide recording -> voice conversion** | Supply an already correctly pronounced spoken performance; conversion takes audio rather than a written sentence | Guide controls rhythm, stress, pauses and intonation; target reference controls timbre | Strongest route for both pronunciation and cadence if a guide recording is available |
| Piper with direct phonemes, potentially a Welsh voice | Explicit phoneme IDs; a Welsh voice is available | Compact CPU-friendly synthesis; artistic delivery still needs audition | Secondary controlled baseline; selected Welsh voice's usage terms need checking |
| Fine-tune a phoneme-based voice on reviewed recordings | Can learn project-specific sound combinations | Can learn desired performance if training data supplies it | Larger data/curation job; reserve for a recurring content pipeline |

**Kokoro**: 82M parameters, Apache-2.0 model weights. Its source exposes raw
phoneme synthesis. Unsupported symbols are silently filtered out by the model
implementation, so fail explicitly on unknown symbols before generating. Direct
phonemes improve control over the input path; they do not prove the output's
sounds or cadence. Its voice/punctuation/duration behaviour still needs listening.
[Model card](https://huggingface.co/hexgrad/Kokoro-82M),
[raw-phoneme pipeline](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py),
[model vocabulary handling](https://github.com/hexgrad/kokoro/blob/main/kokoro/model.py).

**Voice conversion**: installed Chatterbox contains `ChatterboxVC.generate(audio,
target_voice_path=...)`. Its installed source takes no text and uses speech
tokens plus the target voice embedding. It can therefore operate on a person's
own carefully performed Sindarin, or a reviewed phoneme-synthesised guide.
Conversion can still distort consonants, pitch or timing; verify against the
guide. It will not repair incorrect pronunciation or poor cadence in that guide.
Chatterbox's repository is MIT; its generated watermark stays.
[VC source](https://github.com/resemble-ai/chatterbox/blob/master/src/chatterbox/vc.py),
[licence](https://github.com/resemble-ai/chatterbox/blob/master/LICENSE).
Seed-VC is another open-source speech-to-speech option, with GPL-3.0 code and
zero-shot conversion documented; it is not installed or evaluated here.
[Seed-VC](https://github.com/Plachtaa/seed-vc).

**Piper**: its current engine is GPL-3.0 and supports explicit phoneme-to-audio
calls. The `cy_GB/gwryw_gogleddol` Welsh voice exists, but its individual model
card refers out for dataset licence terms; the aggregate repository's MIT badge
does not settle that voice's permissions. Keep it a research lead until those
terms are checked. [Engine](https://github.com/OHF-Voice/piper1-gpl),
[phoneme API](https://github.com/OHF-Voice/piper1-gpl/blob/main/src/piper/voice.py),
[Welsh model card](https://huggingface.co/rhasspy/piper-voices/blob/main/cy/cy_GB/gwryw_gogleddol/medium/MODEL_CARD).

## Decision path

**Owner feedback after elven-actor audition, 2026-10-16:** A (the original
Spanish Chatterbox take) remains best. The new actor and higher-exaggeration
variants have not improved on it. Next request: a little more *zpěvný* (lilting,
melodic) and gentle. Keep A as the baseline.

For this iteration, use A's original English actor reference with MOSS local
v1.5 English synthesis, requesting a softer melodic performance of the same
English sentence. This aims to retain the preferred voice while changing its
delivery; it is not a guarantee of identical timbre. Feed that performance
reference to Spanish Chatterbox with the unchanged Sindarin respelling, seed
19102026 and prior parameters, at exaggeration 0.30 and 0.40. Do not infer
softness or musicality solely from the numeric expression setting.

Guide direction: "Use the reference speaker's voice. Speak gently, warmly and
melodiously, with a soft lilting cadence and flowing, connected phrases. Let the
pitch rise and fall in small graceful arcs, with tender warmth on the greeting
and a peaceful falling ending. Keep a relaxed conversational pace, softly
voiced clear vowels and clean consonants. A quietly welcoming elf speaking to
one guest. Natural spoken dialogue."

Guide seed 22102026; scratch `temp/lothlorien-voices/gentle-actor/`. Exact
English cloning prompt/parameters in `gentle_reference.json`, Spanish takes in
`auditions.json`. Keep originals and prior A unchanged; owner listening decides.

The English clone saved a 15.76 s WAV, but its process stopped during Vorbis
export before writing metadata. Re-encoding that same guide as Vorbis in the
Chatterbox environment also stopped the process; WAV reading/writing succeeds.
Use WAV only for this guide and the new player. The incomplete Ogg was removed.
Exact inference time was not captured. This unusually long reference is an
audition, not an accepted clean performance; listening must establish its words,
pace and identity. No package/model changes were made to address the encoder.

Spanish outputs completed: **E** `gentle_melodic.wav`, 3.80 s, 21.31 s synthesis;
**F** `gentle_melodic_lift.wav`, 6.32 s, 9.32 s synthesis. Both 24 kHz mono,
with valid WAV/Vorbis decoding and finite samples. Signal probe: E peak -8.5 /
RMS -28.8 dBFS; F peak -6.0 / RMS -29.8 dBFS. The alignment analyser forced EOS
for token repetition in E and a long tail in F; retain these observations for
listening rather than assuming complete or correct speech. The WAV-only
`gentle-actor/listen.html` comparison includes unchanged preferred A, E, F and
the new English guide; comparison copies are adjusted toward -26 dBFS RMS with
-3 dBFS peak headroom. All player links resolve. Owner listening pending.

**Owner selection after dubbing comparison, 2026-10-16:** Spanish Chatterbox is
the best approach so far. The owner requests a more elvish actor, informed by
research into elven voices and translated into the generation prompt. Keep the
current preferred take as the baseline; no whole-bank generation or game assets.

Tolkien describes Glorfindel's voice as musical in *Many Meetings*; the
Lothlórien encounter combines clear elven speech with soft laughter. These are
literary performance cues rather than a specification for pitch, register or
one universal elven accent. Musical phrase intonation, clean effortless sound,
warmth and contained emotion are the working interpretation. A silvery light
baritone and a trace of wistfulness are artistic choices for this project.
[Glorfindel passage, cited to the novel](https://tolkiengateway.net/wiki/Glorfindel),
[Lothlórien passage and commentary](https://gwydionmadawc.com/57-about-tolkien/000-lord-of-the-rings-chapter-by-chapter/206-lothlorien/).

Installed Chatterbox has no descriptive style-prompt argument. Apply the
following instruction in **MOSS-VoiceGenerator**, then supply its resulting
English reference to **Spanish Chatterbox**. Keep the Sindarin text separate
from directions so the model does not speak them.

> A male High Elf of Lothlorien, mature yet ageless, with a clear, silvery light
> baritone, warm body and effortless ringing resonance. Elegant, fluid speech
> with supple, gently rising and falling melodic intonation. Audible warmth,
> quiet delight and affectionate curiosity in greeting a welcome guest;
> dignified confidence with a trace of ancient wistfulness. Shape each sentence
> as a connected thought, softly lift welcome and traveller, then settle the
> final phrase. Distinct vowels, clean consonants, graceful legato phrasing and
> relaxed breath support at a natural conversational pace. Cultivated British
> English. Intimate dry spoken dialogue.

New original actor reference generated in 8.23 s, duration 6.00 s. Casting
seed 17102026, same English sentence and decoding parameters as the previous
actor, to compare the changed direction. Scratch: `temp/lothlorien-voices/elven-actor/`.
Three Spanish comparisons use exactly the preferred generator text and seed
19102026: existing actor at exaggeration 0.55; new actor at 0.30; new actor at
0.55. Other parameters remain cfg_weight 0.30, temperature 0.65,
repetition_penalty 2, min_p 0.05, top_p 1. These are auditions, not established
improvements to timbre, emotion or Sindarin pronunciation. Default watermark stays.

Generated Spanish results: existing actor expressive 4.32 s (16.94 s synthesis),
new actor controlled 4.64 s (5.99 s synthesis), new actor expressive 5.04 s
(6.91 s synthesis), all 24 kHz mono. WAV and Vorbis decode with finite audio;
all audio links in `elven-actor/listen.html` resolve. The comparison page uses
copies adjusted toward -26 dBFS RMS with -3 dBFS peak headroom, preserving raw
and original audition files. The alignment analyser forced EOS for long tails
in all three takes; this is recorded for listening review, not treated as proof
of clean endings or missing speech. Final human evaluation is pending.

**Owner dubbing trial, 2026-10-16:** owner considers the synthetic actor usable
but wants more intonation/emotion, and supplied three M4A takes in
`temp/lothlorien-voices/dubbing/`. Originals untouched. Each has a baseline
audition (outer quiet margins trimmed, level adjusted), a gently processed own
voice (70 Hz high-pass, subtle clarity EQ, gentle compression, no pitch/time
change), and ChatterboxVC conversion toward the same original synthetic actor.
No text or carrier language is supplied to voice conversion.

Cached multilingual S3Gen loaded directly from `s3gen.pt`; no text model needed,
no installs/downloads. Default PerTh watermark retained. Prepared guides:
3.613 / 3.810 / 3.670 s; converted outputs 3.640 / 3.840 / 3.680 s at 24 kHz mono.
Per-take inference 1.31 / 0.99 / 0.96 s. Similar total timing does not prove
preserved pitch, consonants or emotion. All conversions remain pending owner
listening. Audition files are conservative RMS-adjusted with -3 dBFS peak
ceiling; differences in crest factor prevent perfectly matched loudness.

Comparison player: `temp/lothlorien-voices/dubbing/comparison/listen.html`.
Exact windows, signal checks and provenance: `conversion.json` beside it;
scripts/logs in the scratch parent. Includes both earlier Spanish engine takes
and the English actor reference for comparison.

Hear the two Spanish samples for intelligibility, unwanted words, actor and
cadence. If they still corrupt the sentence, prefer a Kokoro phoneme prototype
over repeated carrier-language guesses. If phonemes are acceptable but cadence
is unsatisfying, a carefully performed guide plus voice conversion gives the
most direct control over both. A guide recorded by the owner need not match
the final actor's gender or timbre; its articulation and performance matter.
No whole phrase bank is generated until one approach works on this hard line.
