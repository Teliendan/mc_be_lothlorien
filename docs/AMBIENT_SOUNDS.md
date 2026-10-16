# Deer and swan ambient sounds

Owner accepted seeds **122 and 123 for both deer and swan**, 2026-10-16.
Target Bedrock 1.26.52 / Script API 2.8.0. Listening acceptance is complete;
native mixing, pitch precedence, distance fade and herd repetition still need
an in-game check. Feature commit: `Use approved deer and swan ambient calls`.

## Final design

Two equally weighted random ambient calls serve adult deer and white harts;
two serve swans. Native entity timers handle playback, with no added script
polling. Calls use the neutral category, mono 48 kHz Vorbis and these settings:

| Animal | Configured minimum + random range | Event gain | Event pitch |
| --- | --- | --- | --- |
| Deer | 35 + 0?45 seconds | 0.6 | 0.95?1.05 |
| White deer | 45 + 0?55 seconds | 0.6 | 0.95?1.05 |
| Swan | 25 + 0?35 seconds | 0.5 | 0.95?1.05 |

Base entity gains remain deer 1.0 / swan 0.9. Horse/chicken hurt, death and
movement bindings remain. Fawn breathing remains its existing baby override
and shares the longer deer timer; cygnets currently share the swan calls.
These are declared timer values, not measured wall-clock intervals.

| RP asset under `sounds/mob/lothlorien/` | Seed | Raw window | Duration | Decoded peak |
| --- | --- | --- | --- | --- |
| `deer/ambient1.ogg` | 122 | 1.42?2.54 s | 1.12 s | -6.0 dBFS |
| `deer/ambient2.ogg` | 123 | 2.88?4.10 s | 1.22 s | -6.1 dBFS |
| `swan/ambient1.ogg` | 122 | 3.96?4.66 s | 0.70 s | -6.1 dBFS |
| `swan/ambient2.ogg` | 123 | 0?0.52 s | 0.52 s | -6.7 dBFS |

The shipped files are byte-for-byte the approved audition Ogg files. Calls
retain real quiet margins with no tail fades, pitch shifting or denoising.
Selection follows the owner's ears; narrow spectral concentration alone is
not a reason to reject an approved take.

## Sources and reproduction

Machine-wide guide: `~/.claude/audiogen-stack.md`; shared pointer:
[`local-audio.md`](../../../docs/local-audio.md). Model MOSS-SoundEffect v2.0,
snapshot `e35df4d82fbe87fcd5d14e5d100e349c0c3c076d`, bfloat16, CPU offloading,
5-second output crop, trained 30-second latent, 50 steps, CFG 4, sigma shift 5.
Only the two approved seeds are part of the final design.

- Deer prompt: `Field recording of an adult female European red deer, Cervus elaphus, giving one quiet closed-mouth nasal contact bleat to her calf. A low warm animal voice lasting about eight tenths of a second, gently rising then falling in pitch. Several audible vocal harmonics with natural nasal resonances and slight breathiness. Calm animal. Isolated foreground call with quiet margins.`
- Swan prompt: `Close field recording of an adult mute swan, Cygnus olor, giving one short snoring greeting grunt to its mate. A brief dry throaty krrut, roughly a quarter second, with a soft irregular rattled texture and a natural breathy ending. Quiet social contact. Isolated foreground call with quiet margins.`

Final lossless masters: `tools/audio/ambient/{deer,swan}_ambient{1,2}.wav`.
They use DOUBLE PCM so the pre-encoder samples match the approved audition
exactly. These source files stay outside the packs. No reference recordings
are shipped. Encoding/checking requires only the installed SFX environment:

```powershell
& E:\AI\audio\venvs\moss_sfx\Scripts\python.exe -B mods/lothlorien/tools/prepare_ambient_sounds.py --check
```

Without `--check` the tool rebuilds just the four final Ogg assets. The check
compares decoded audio, since Ogg serial numbers can change without changing
sound. All masters/assets are finite, mono and unclipped; the check passed.
Raw candidates, rejected variants, audition pages and research scratch are
removed after acceptance. Research rationale remains in `SOUND_RESEARCH.md`
and the shared animal-call skill reference.

Validation on 2026-10-16: `mods verify lothlorien` passed localization and the
full regression suite, 0 errors, 0 warnings and 15 documented exceptions.
All four shipped files matched the approved audition bytes before cleanup;
the permanent master/encoder check passed. Cleanup removed 125 scratch files
and 10 empty directories without a recursive delete. Shared workflow knowledge
was committed separately in workspace commit `44410dd`.

## Game check

After deployment, leave the world and re-enter; no new world is required for
these sound changes. Listen near ordinary deer, white harts and swans, then
walk away to check distance fade. Check a herd for repetition and loudness,
plus unchanged baby/hurt/death/movement sounds. Offline checks do not establish
native playback correctness. Sindarin remains the next, separate voice task.
