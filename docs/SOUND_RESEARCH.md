# Final animal-call research and decisions

2026-10-16; target Bedrock 1.26.52 / API 2.8.0. Owner accepted **seeds 122 and
123 for deer and swan** and authorised using either/both. Both are retained
as random variants. Final design, prompts, crop windows, masters and encoding
recipe: [`AMBIENT_SOUNDS.md`](AMBIENT_SOUNDS.md).
Feature commit: `Use approved deer and swan ambient calls`.

The first batch's Deer 2 was only provisionally promising. The researched
second batch supplied the accepted sounds. Earlier samples and unselected
seed 121 are retired. Quantitative screening informed the generation brief;
owner listening decided acceptance, including the narrower Deer 122 take.
No species accuracy or in-game acceptance is implied by that decision.

## Reference rationale

For calm deer ambience, use contact-call structure with natural harmonics;
reserve a distinct stag rutting roar for a deliberate later feature. The
swan's orange bill/black knob makes mute swan the visual analogue: use short
social greetings, keeping threat rattles and cygnet whistles contextual.

- [Volodin et al. 2018](https://link.springer.com/article/10.1186/s13104-018-3833-4),
  Table 1, Figure 1 and Additional file 2: measured hind?calf calls and actual
  reference audio. The study's population means are reference points, not
  universal limits. The CC BY 4.0 recording was used for research only.
- [Cornell Lab mute-swan recordings](https://www.allaboutbirds.org/guide/Mute_Swan/sounds):
  social, threat and juvenile contexts; no Cornell audio is shipped.
- [Johnsgard 1971](https://tidsskrift.dk/Wildfowl/article/view/155417), journal
  pages 51?52 / Figure 2b: the quantitative example is explicitly male threat,
  not a calm-contact target; its sonagram was visually inspected.

Detailed reusable facts, evidence limits and pitch/harmonic/pulse distinctions:
[shared animal-call research](../../../.claude/skills/bedrock-mobs/references/animal-call-design.md).
Research downloads and exploratory measurement/preview scripts were iteration
scratch and are removed on acceptance; original sources remain linked above.

## Atmosphere follow-up

1. Songbirds completed 2026-10-16: owner accepted versions 2/3, removed weak
   version 1 and declared the sound task finished. Final sources and decisions:
   [`BIRDSONG.md`](BIRDSONG.md).
2. Soft Mallorn leaf rustle/canopy breeze, used sparingly with attention to
   overlap and performance. Sound-design suggestion; no engine implementation
   or trigger is claimed here.
3. Sparse squirrel contact chatter; current rabbit placeholders remain.
4. Dedicated fawn/cygnet voices if finer animal polish is wanted later.

The unicorn's current horse sounds remain a low priority. Sindarin planning
already exists separately in `SINDARIN_VOICE_PHRASES.md`; generation and
pronunciation review are still a separate step.
