# Lothlorien audio: soundscape, animal calls, songbirds

Final design, accepted by the owner (music and soundscape ticked in `TODO.md`, 2026-10-29). Bedrock 1.26.52 / Script API 2.8.0.
Merged 2026-11-12 from `SOUNDSCAPE_PLAN.md`, `AMBIENT_SOUNDS.md` (with the decisions of the former `SOUND_RESEARCH.md`) and
`BIRDSONG.md`; the old files are at `git show 28b810a:docs/<name>`. Sindarin elf voices: `SINDARIN_VOICE.md` (owner-accepted
2026-10-25, wired in `96a5386`).

Shared knowledge: workspace `.claude/skills/bedrock-modding/references/19-ambient-audio.md`, `.claude/skills/bedrock-mobs/references/animal-call-design.md`,
`docs/local-audio.md`, `docs/ambient-music-tools.md`, machine guide `~/.claude/audiogen-stack.md`.

## Soundscape: music, shrine, memorial, forest

Listening rounds of 2026-10-26 and 2026-10-27 shaped it: music levels are even (normalized to -21 LUFS, game volume 0.5);
generated wind gusts evoked cold autumn wind and were dropped; the shrine's two gong-like tones are liked, the long pulsing tone
is usable; pauses were shortened everywhere (shrine 10-25 s, memorial 12-30 s, village rest 10-30 s). Vanilla forest music stays
in Lothlorien outside villages; inside a village the village music replaces it, never two scores at once, and it does not duck
near the shrine or memorial.

Owner picks from audition 2 (phone listening page, 2026-10-26). Masters in `tools/audio/soundscape/` (music masters git-ignored
for size; generator commands with prompts and seeds in `provenance/`); edits and encoding in `tools/prepare_soundscape.py`
(`--check` compares shipped files and piece lengths; masters missing from a clone are skipped with one line and their lengths come
from the shipped Ogg; suite `audio` runs it). `--check` skips the 12 s re-encode while a digest of every input (script, tick rules,
masters, shipped takes, numpy/scipy/soundfile versions) equals the last passing run, kept in the workspace `temp/audio-check/soundscape.json`;
`--no-cache` forces the full check.

| Layer | Wiring | Shipped takes |
| --- | --- | --- |
| Forest | client biome `ambient_sounds.addition` = `ambient.lothlorien.forest.additions`, non-3D, volume 1.0; a weight-168 silent entry (about 3 in 4 picks) thins them out | vanilla Dappled Forest poplar leaf rustles (`sounds/block/poplar_leaves/ambient1-24`, vanilla weights, its wind1-3 left out); no shipped files. Generated loop, rustles and gusts dropped |
| Root shrine | invisible `lothlorien:shrine_sound` under the root ceiling, `ambient` every 10-25 s, distance 3-24 | tones s321, s322 (cut to 8 s), s323 (cut to 10 s), 22 s s322 (cut to 17.5 s), bell s322 |
| Leaf memorial | invisible `lothlorien:memorial_sound` on the pillar cap, every 12-30 s, distance 3-24 | tones s321, s322; harp s321, s322 |
| Village | `scripts/village_music.js`: `playMusic` piece, then a looped silent rest, 10-30 s; leaving fades after 10 s outside | 1 = harp_flute s411 (cut at 86 s, "good, positive"), 2 = harp_solo s402 ("calm"), 3 = harp_flute s431, 4 = s432 ("playful"), 5 = s433 ("melancholic"), 6 = harp_solo s451 ("playful, optimistic"); 2-6 end with an 8 s fade-out |

Endings (owner 2026-11-22, a tester heard pieces end abruptly): the generator stops mid-phrase, so 2, 4, 5 and 6 got the 8 s
fade 3 already had. Auditioned against a cut at a quiet gap plus 6 s fade (owner preferred the plain fade); a reverb tail
was declined. Lengths are unchanged. A full run of `prepare_soundscape.py` rewrites every Ogg (new serial numbers); restore
the takes you did not change with `git checkout` and confirm with `--check --no-cache`.

Maybes not shipped: harp_solo s401 (first half perfect, then a change), harp_flute s436 (a bit sharp). Loudness: structure sounds
with loud passages at -16 dBFS RMS, peak -1 dBFS; music at -21 LUFS integrated. Game volume in `sound_definitions.json` (music 0.5,
structure sounds 0.5 in `sounds.json`). Only newly generated shrines and memorials carry the sound entities (new world); the
memorial carries its sound through a look-alike seed log (`MEMORIAL.md`).

Owner decision 2026-10-28: keep the village music area and timing as they are (it stops about 10 s after leaving plus a 5 s fade;
outlying benches may start it). A shorter tail and a deck-density start check were offered and declined.

Engine basis: vanilla biome music is the listening model (a pool of pieces with pauses and silence); Pale Garden moss and heart
sounds are the model for local structure ambience. Do not add polling per Mallorn leaf block. The pinned API (2.8.0) supports
per-player music and positional sound; do not assume newer SoundInstance APIs (26.60 review: `TODO.md`).

Open listening checks: poplar rustle volume and frequency; shrine and memorial reach and repetition; the invisible entities'
ambient sounds play at all; the village piece replaces vanilla forest music, the rest track keeps it out between pieces and vanilla
music returns after leaving; no restart when briefly crossing the village edge; reload and multiplayer. Deferred: forest
edge/interior/heart variation, day/night sets, extra chimes and garden sounds, adaptive music.

## Deer and swan calls

Owner accepted seeds **122 and 123 for both deer and swan** on 2026-10-16 and authorised using either or both: they are kept as
**random variants**. Feature commit: `Use approved deer and swan ambient calls`. Listening acceptance is complete; native mixing,
pitch precedence, distance fade and herd repetition still need an in-game check. The first batch's Deer 2 was only provisional;
earlier samples and unselected seed 121 are retired. Quantitative screening informed the generation brief; owner listening decided
acceptance (including the narrower Deer 122 take). No species accuracy is implied.

Two equally weighted random ambient calls serve adult deer and white harts; two serve swans. Native entity timers handle playback
(no script polling). Neutral category, mono 48 kHz Vorbis. Declared timer values, not measured wall-clock intervals:

| Animal | Configured minimum + random range | Event gain | Event pitch |
| --- | --- | --- | --- |
| Deer | 35 + 0-45 seconds | 0.6 | 0.95-1.05 |
| White deer | 45 + 0-55 seconds | 0.6 | 0.95-1.05 |
| Swan | 25 + 0-35 seconds | 0.5 | 0.95-1.05 |

Base entity gains stay deer 1.0 / swan 0.9; horse/chicken hurt, death and movement bindings stay. Fawn breathing remains its baby
override and shares the longer deer timer; cygnets share the swan calls.

| RP asset under `sounds/mob/lothlorien/` | Seed | Raw window | Duration | Decoded peak |
| --- | --- | --- | --- | --- |
| `deer/ambient1.ogg` | 122 | 1.42-2.54 s | 1.12 s | -6.0 dBFS |
| `deer/ambient2.ogg` | 123 | 2.88-4.10 s | 1.22 s | -6.1 dBFS |
| `swan/ambient1.ogg` | 122 | 3.96-4.66 s | 0.70 s | -6.1 dBFS |
| `swan/ambient2.ogg` | 123 | 0-0.52 s | 0.52 s | -6.7 dBFS |

The shipped files are byte-for-byte the approved audition Ogg files; calls keep real quiet margins with no tail fades, pitch
shifting or denoising. Selection follows the owner's ears; narrow spectral concentration alone is no reason to reject a take.

Reproduction: model MOSS-SoundEffect v2.0, snapshot `e35df4d82fbe87fcd5d14e5d100e349c0c3c076d`, bfloat16, CPU offloading,
5-second output crop, trained 30-second latent, 50 steps, CFG 4, sigma shift 5. Only the two approved seeds are part of the design.

- Deer prompt: `Field recording of an adult female European red deer, Cervus elaphus, giving one quiet closed-mouth nasal contact bleat to her calf. A low warm animal voice lasting about eight tenths of a second, gently rising then falling in pitch. Several audible vocal harmonics with natural nasal resonances and slight breathiness. Calm animal. Isolated foreground call with quiet margins.`
- Swan prompt: `Close field recording of an adult mute swan, Cygnus olor, giving one short snoring greeting grunt to its mate. A brief dry throaty krrut, roughly a quarter second, with a soft irregular rattled texture and a natural breathy ending. Quiet social contact. Isolated foreground call with quiet margins.`

Lossless DOUBLE PCM masters (they match the approved auditions exactly; outside the packs): `tools/audio/ambient/{deer,swan}_ambient{1,2}.wav`.
No reference recordings are shipped. Check or rebuild (without `--check` it rebuilds; `--animal deer|swan|songbird` limits it; the
check compares decoded audio because Ogg serial numbers can change):

```powershell
& E:\AI\audio\venvs\moss_sfx\Scripts\python.exe -B mods/lothlorien/tools/prepare_ambient_sounds.py --check
```

Validation 2026-10-16: `mods verify lothlorien` passed (0 errors, 0 warnings, 15 documented exceptions); all four shipped files matched
the audition bytes before cleanup; shared workflow knowledge is in workspace commit `44410dd`. Game check after deploy (leave and
re-enter; no new world): listen near deer, white harts and swans, walk away for distance fade, check a herd for repetition and
loudness, and that baby/hurt/death/movement sounds are unchanged.

Reference rationale: calm deer ambience uses contact-call structure with natural harmonics (a stag rutting roar is reserved for a
later feature); the swan's orange bill and black knob make the mute swan the visual analogue, with short social greetings and
threat rattles and cygnet whistles kept contextual. Sources: [Volodin et al. 2018](https://link.springer.com/article/10.1186/s13104-018-3833-4)
(hind-calf calls; CC BY 4.0 recording used for research only; population means are reference points, not limits);
[Cornell Lab mute-swan recordings](https://www.allaboutbirds.org/guide/Mute_Swan/sounds) (no Cornell audio shipped);
[Johnsgard 1971](https://tidsskrift.dk/Wildfowl/article/view/155417) (pages 51-52, Figure 2b: male threat, not a calm-contact target).

Later sound ideas (suggestions only, nothing implemented): soft Mallorn leaf rustle or canopy breeze used sparingly (overlap and
performance); sparse squirrel chatter (rabbit placeholders remain); dedicated fawn and cygnet voices. The unicorn's horse sounds
stay low priority.

## Woodland songbirds

Owner accepted **versions 2 and 3** on 2026-10-16 and rejected version 1 as weak; the sound task is finished. Feature commit
`4045155` (`Finish approved woodland birdsong`). The owner confirmed in game (2026-10-16) that the deployed sounds work and are
liked; that is overall playback acceptance, not a timing or fade measurement.

The songbird ambient event chooses equally between the two phrases. Original version numbers stay in asset and master names to
preserve which recordings were approved; version 1, its master and its generator entry are removed.

| RP asset under `sounds/mob/lothlorien/songbird/` | Source | Raw crop | Duration | Decoded peak |
| --- | --- | --- | --- | --- |
| `ambient2.ogg` | robin-style seed 233 | 4.22-5.66 s | 1.44 s | -6.1 dBFS |
| `ambient3.ogg` | blackbird-style seed 231 | 1.82-2.80 s | 0.98 s | -6.4 dBFS |

Native interval `value: 14`, `range: 22` (14-36 s); ambient event gain 0.45, base entity gain 0.8, ambient pitch 0.96-1.04. Neutral
category, mono 48 kHz Vorbis; all plumages share the two variants; the parrot hurt/death/step/fly bindings stay. No biome loop, new
animal, script callback, world scan or script timer: songs follow actual nearby songbirds. Exact timing and distance fade were not measured.

Sources: [RSPB song descriptions](https://www.rspb.org.uk/birds-and-wildlife/identifying-birds/bird-song-identifier) (accessed
2026-10-16) informed the varied robin-style phrase and mellower blackbird-style phrase; they are fictional Lothlorien voices, not
species claims; no reference recording is shipped. Same MOSS model and snapshot as above, 6-second output.

- Robin prompt: `A close field recording of one European robin singing a single short melodic verse in a quiet woodland. Clear high bird whistles flow into a quick gushing warble of varied rising and falling notes, lasting about two seconds, followed by a natural pause. One small songbird, isolated foreground song, quiet background.`
- Blackbird prompt: `A close field recording of one Eurasian blackbird singing a single short woodland song phrase. A few mellow fluting bird notes, unhurried and varied in pitch, followed by a delicate short twitter and a natural pause. The whole phrase lasts about two seconds. One songbird, isolated foreground song, quiet background.`

DOUBLE WAV masters `tools/audio/ambient/songbird_ambient2.wav` and `songbird_ambient3.wav` (no pitch shifts, synthetic fades or
denoising); check with `prepare_ambient_sounds.py --check --animal songbird`. Validation 2026-10-16: full verify passed; master and
encoder checks passed for all six ambient assets; both Ogg files matched the preview bytes before cleanup. Shared phrasing research:
workspace commit `bf8592e` and `animal-call-design.md`. No new world is needed for these sound changes.
