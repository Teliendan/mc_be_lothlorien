# Woodland songbird ambience - final

Owner accepted **versions 2 and 3** on 2026-10-16 and rejected version 1 as weak.
The sound task is finished. Target Bedrock 1.26.52 / Script API 2.8.0.
Feature commit: `4045155` (`Finish approved woodland birdsong`).
Owner confirmed the deployed sounds work and are liked in game on 2026-10-16.
This records overall playback acceptance, not separate timing or fade measurements.

## Final design

The songbird ambient event chooses equally between the two accepted woodland
phrases. Original version numbers remain in asset/master names to preserve
which recordings the owner approved. Version 1, its master and its generator
entry are removed; the shipped Ogg bytes of versions 2/3 match their auditions.

| RP asset under `sounds/mob/lothlorien/songbird/` | Source | Raw crop | Duration | Decoded peak |
| --- | --- | --- | --- | --- |
| `ambient2.ogg` | robin-style seed 233 | 4.22-5.66 s | 1.44 s | -6.1 dBFS |
| `ambient3.ogg` | blackbird-style seed 231 | 1.82-2.80 s | 0.98 s | -6.4 dBFS |

Native interval `value: 14`, `range: 22` (configured 14-36 seconds); ambient
event gain 0.45, base entity gain 0.8, ambient pitch 0.96-1.04. Neutral category,
mono 48 kHz Vorbis. All plumages share the two random variants. Existing parrot
hurt/death/step/fly bindings remain. No biome loop, new animal, script callback,
world scan or script timer was added. Songs follow actual nearby songbirds.
Native playback is owner-accepted; exact timing and distance fade were not measured.

## Sources and reproduction

[RSPB song descriptions and recordings](https://www.rspb.org.uk/birds-and-wildlife/identifying-birds/bird-song-identifier),
accessed 2026-10-16, informed the varied robin-style phrase and mellower
blackbird-style phrase. These are fictional Lothlorien bird voices, not claims
of exact species identification. No reference recording is shipped.

Existing local MOSS-SoundEffect v2.0, cached snapshot
`e35df4d82fbe87fcd5d14e5d100e349c0c3c076d`, bfloat16, CPU offloading,
trained 30-second latent, 6-second output, 50 steps, CFG 4, sigma shift 5.
Only the selected sources above belong to the final design.

- Robin prompt: `A close field recording of one European robin singing a single short melodic verse in a quiet woodland. Clear high bird whistles flow into a quick gushing warble of varied rising and falling notes, lasting about two seconds, followed by a natural pause. One small songbird, isolated foreground song, quiet background.`
- Blackbird prompt: `A close field recording of one Eurasian blackbird singing a single short woodland song phrase. A few mellow fluting bird notes, unhurried and varied in pitch, followed by a delicate short twitter and a natural pause. The whole phrase lasts about two seconds. One songbird, isolated foreground song, quiet background.`

Final DOUBLE WAV masters are `tools/audio/ambient/songbird_ambient2.wav` and
`songbird_ambient3.wav`. They preserve the pre-encoder samples; no pitch shifts,
synthetic fades or denoising. Both decoded assets are finite, mono and unclipped.
The shared encoder checks/rebuilds only the final pair with `--animal songbird`:

```powershell
& E:\AI\audio\venvs\moss_sfx\Scripts\python.exe -B mods/lothlorien/tools/prepare_ambient_sounds.py --check --animal songbird
```

Trial candidates, listening pages, logs and preparation scratch are removed
on acceptance. Shared phrasing research is in workspace commit `bf8592e` and
`.claude/skills/bedrock-mobs/references/animal-call-design.md`. Final notes retain
only the chosen recordings and owner's decisions.

Final validation on 2026-10-16: full `mods verify lothlorien` passed localization
and project regressions with 0 errors, 0 warnings, 15 documented exceptions.
Master/encoder checks passed for all six ambient assets (four deer/swan, two
songbird). Both retained Ogg files matched the approved preview bytes before
cleanup. Cleanup removed 23 scratch files and 2 empty directories without a
recursive delete. The normal feature-commit hook deploys the final packs.

Final packs are deployed; no new world is needed for these sound changes.
Owner's in-game acceptance completes this task.
