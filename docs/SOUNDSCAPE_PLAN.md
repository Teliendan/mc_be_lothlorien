# Lothlorien soundscape plan

Agreed direction: 2026-10-16. Production started 2026-10-25 at the owner's
request (step 2, audition set). Target: Bedrock 1.26.52 / Script API 2.8.0.

## Implemented, 2026-10-26; revised after first in-game listening, 2026-10-27

In-game feedback 2026-10-27: two village pieces differed in level (fixed:
music now normalized to -21 LUFS, game volume 0.4 -> 0.5); the generated wind
gusts evoked cold autumn wind (dropped); shrine sounds well, especially the
two gong-like tones, the long pulsing tone is less good but usable; memorial
good; pauses shorter everywhere (shrine 10-25 s, memorial 12-30 s, village
rest 10-30 s).

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

In-game checks: music levels now even; poplar rustle volume and frequency; shrine and
memorial reach and repetition; the invisible entities' ambient sounds play at
all; village piece replaces vanilla forest music, the rest track keeps it out
between pieces, and vanilla music returns after leaving; no restart when
briefly crossing the village edge; reload and multiplayer.

## Owner decisions, 2026-10-25

These settle the open choices below; listening may still revise them.

First listening, 2026-10-26: the forest loops all sounded like white noise
(proposal: drop the loop, occasional gusts/rustles only). Shrine: tones s321/
s322/s323 and bell s322 usable. Memorial: tones s321/s322, harp s321/s322.
Village: harp solo s401/s402 good, harp+flute s411 beautiful until its volume
drops; "wistful" set rejected (extra instruments, sounds like a club, not
elven). Remove quiet parts. Rest interval shortened to 20-60 s.

- Forest: a quiet continuous loop plus a few occasional additions (soft gust,
  canopy rustle). No day/night split.
- Shrine: a clear, sustained bell/glass-like resonance. No voices.
- Memorial: sound comes from the pillar/totem; a few gently descending tones
  with a slow, lingering decay.
- Village: harp-led, unhurried. First pool 3-4 pieces of about 1.5-3 minutes,
  quiet intervals of roughly 1-3 minutes.
- Mixing: vanilla forest music stays in Lothlorien outside villages; inside a
  village the village music replaces it, never two scores at once. Village
  music does not duck near the shrine or memorial. Whether biome music and
  script-played music interfere needs an in-game check first.

## Design

Keep the first pass simple: shared forest ambience, local structure sounds,
and a village soundtrack. Leave quiet space so the world and existing animal
calls remain audible.

| Layer | Planned behavior | Character and source |
| --- | --- | --- |
| Lothlorien forest | Shared, quiet environmental ambience throughout the biome, continuing underneath other layers | Forest air and canopy/leaf movement are the starting palette to refine |
| Root shrine | Occasional local sacred sounds, with silence between phrases | Sound comes from the ceiling of the root nook |
| Leaf memorial | Occasional local gentle, melancholic sounds, with silence between phrases | Sound comes from the pillar/totem or the leaf center; choose the source later |
| Elven village | Background music heard throughout the village; a piece ends, a quiet interval follows, then another piece can play | Gentle, unhurried harp-led instrumental music is the starting candidate |

The village score accompanies the listener throughout the village. Structure
sounds have a position and fade with distance as the listener approaches or
leaves. They do not take over the player's soundtrack. Keep village transitions
stable so briefly crossing a boundary does not repeatedly restart a piece.

Owner decision 2026-10-28: keep the village music area and timing as they are
(stops ~10 s after leaving plus a 5 s fade; outlying benches may start it).
Shorter tail and a deck-density start check were offered and declined.

Existing accepted birdsong, deer and swan calls remain separate. Avoid filling
the environmental layer with duplicate animal recordings.

## Artistic details to settle when resuming

- Forest: decide whether a quiet continuous bed alone is sufficient or needs
  a few occasional details. Day/night variation is optional.
- Shrine: choose the sacred timbre. A clear sustained resonance is a candidate;
  faint wordless tones are another possibility, not a requirement.
- Memorial: choose pillar/totem versus leaf-center source, then the timbre.
  Sparse, gently descending tones with a lingering decay are a candidate.
- Village: confirm the harp palette and select pieces through listening.
  Pieces with quiet intervals are agreed; exact track lengths, interval
  ranges and the size of the initial music pool remain open.
- Mixing: choose how ordinary vanilla forest music behaves inside Lothlorien
  and how the village soundtrack replaces it while visiting. Avoid two
  background scores playing together. Whether village music lowers near a
  sacred structure remains open; avoid competing prominent melodies.
- Tune structure phrase recurrence, volume and audible reach in game. Their
  timing need not match the village music intervals.

Suggestions above are starting briefs for later listening, not accepted audio
assets or additional mandatory layers.

## Deferred scope

- Forest edge/interior/heart variation. Start with one Lothlorien ambience.
- Separate day/night asset sets unless listening establishes a need.
- Extra distant song, general magical chimes and garden-specific sounds.
- More elaborate adaptive music or synchronized musical layers.

## Vanilla precedent and engine basis

Vanilla biome music is the listening model for the village: a pool of pieces
with pauses, heard without a fixed physical source. Vanilla villages do not
have a dedicated music definition in the examined installed packs; village
selection will be our own context logic. Pale Garden moss/heart sounds provide
the model for local structure ambience. Silence is part of the intended design.

Lothlorien currently selects vanilla `forest` music and has no custom
`minecraft:ambient_sounds` component. Native biome configuration can provide
shared ambience; village bounds and structure sources need additional wiring.
An ambient sound binding alone does not establish an autonomous custom-block
trigger. Do not add polling per Mallorn leaf block.

The pinned API supports per-player music and positional sound playback.
Detailed runtime fades/control of ordinary ambient loops need a targeted
compatibility check; do not assume newer SoundInstance APIs are in 2.8.0.
Exact playback mechanisms and source markers are implementation choices for
later, not part of this design approval.

Research evidence: installed vanilla files, local API declarations and official
docs/changelogs; no new in-game verification. Reusable findings and sources:
[background ambience and music](../../../.claude/skills/bedrock-modding/references/19-ambient-audio.md).
Mojang's [composer interview](https://www.minecraft.net/es-es/article/cherry-groves-composer-interview)
also explains the role of quiet space in Minecraft's music.

## Work sequence when the owner resumes production

1. Re-read this plan and the current shrine, memorial and village notes.
   Settle the remaining artistic choices before generating candidates.
2. Make a small audition set using the installed MOSS-SoundEffect tool for
   environmental effects and ACE-Step 1.5 for instrumental music. Keep scratch
   under workspace `temp/<feature>/`. No new model installation is planned.
3. Probe, edit levels/tails and audition. Generated duration does not guarantee
   musical content or seamless looping. Keep final masters and provenance;
   encode accepted playback assets as Ogg Vorbis. Detailed local workflow:
   [audio tools](../../../docs/local-audio.md) and
   [instrumental music tool](../../../docs/ambient-music-tools.md).
4. Implement the shared biome ambience, positional structure sounds and one
   village soundtrack selection per player. Keep scheduling bounded and reuse
   existing region knowledge where possible. Handle entering/leaving villages,
   teleporting and world reloads without accumulating or restarting sounds.
5. Run `mods verify lothlorien`, deploy with `mods deploy lothlorien`, and
   confirm `mods status` reports in sync before handing over for game tests.
6. Listen while moving through the forest, shrine, memorial and whole village;
   check direction/distance, repetition, quiet intervals, transitions, vanilla
   music interaction, player volume controls and independent multiplayer
   contexts. Offline verification cannot establish the listening result.
7. After owner acceptance, clean iteration scratch and condense these notes to
   the final palette, behavior, test status and feature commit.

Next action: step 6, owner listening in game (checks listed under
"Implemented"). Then tune volumes/intervals, and step 7.
