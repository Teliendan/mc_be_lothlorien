# Selected Sindarin voice

**Owner approved 2026-10-16: F, "Gentle, a little more inflection". Use this
voice and delivery for the elf interaction phrases.** One shared actor;
Spanish Chatterbox. The earlier A and later rejected casts are superseded by F.

The owner noted that the pause between the two audition sentences is too long,
but considers it acceptable for the short interaction phrases. Generate each
interaction line as a complete utterance, preserving connected speech. Do not
combine unrelated interaction lines into a paragraph. Review pauses in any
future multi-sentence line. The voice/delivery selection does not certify every
phrase's pronunciation or Sindarin wording.

## Preserved source of truth

Keep these files in `tools/audio/sindarin_voice/`, outside iteration scratch:

- `actor_reference.wav`: exact gentle English reference used to generate F.
- `accepted_audition.wav`: exact level-adjusted F recording heard in the player.
- `voice_setup.json`: selected model, settings, seed, text and SHA-256 hashes.
- `reference_provenance.json`: English-reference prompt and generation details.
- `original_actor_reference.wav` and `original_actor_provenance.json`: original
  synthetic actor used to guide the gentler English reference.

Use the saved `actor_reference.wav` for future lines. Regenerating a reference
from its description is not guaranteed to reproduce the approved voice.

## Generation settings

Installed **Chatterbox multilingual, `t3_mtl23ls_v2`**, snapshot
`5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`, in the existing Chatterbox venv.
Run locally with existing cached weights and no paid service. Supply
`language_id="es"` and the preserved reference as `audio_prompt_path`.

| Setting | Selected value |
| --- | --- |
| Seed | `19102026` (Python, NumPy and PyTorch) |
| `exaggeration` | `0.4` |
| `cfg_weight` | `0.3` |
| `temperature` | `0.65` |
| `repetition_penalty` | `2.0` |
| `min_p` | `0.05` |
| `top_p` | `1.0` |

Retain the default PerTh watermark. Chatterbox accepts a voice reference,
not a descriptive acting prompt; the performance direction was applied when
creating the English reference. Keep the spoken text free of instructions.

Accepted audition: **Mae govannen, mellon. Lasto beth lammen.** Generator input:
**Mai govánnen mélon. Lasto beth lámmen.** Duration: 6.32 seconds, 24 kHz mono.
This respelling is pronunciation guidance for the model, not alternate Sindarin.
Prepare and audition the other phrases individually; do not assume that the
Spanish hint handles every consonant or stress pattern correctly.

The English-reference direction was:

> Use the reference speaker's voice. Speak gently, warmly and melodiously, with
> a soft lilting cadence and flowing, connected phrases. Let the pitch rise and
> fall in small graceful arcs, with tender warmth on the greeting and a peaceful
> falling ending. Keep a relaxed conversational pace, softly voiced clear vowels
> and clean consonants. A quietly welcoming elf speaking to one guest. Natural
> spoken dialogue.

[Interaction pools](SINDARIN_VOICE_EVENTS.md),
[phrase provenance](SINDARIN_VOICE_PHRASES.md),
[research and audition history](SINDARIN_VOICE_RESEARCH.md).
No pack audio bindings or game deployment are implemented by this selection.
