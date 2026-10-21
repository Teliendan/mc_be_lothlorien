# Lothlorien soundscape plan

Agreed direction: 2026-10-16. Status: planned; production has not started.
Target researched: Bedrock 1.26.52 / Script API 2.8.0.

The owner wants to return to this later. Do not generate audio or implement
playback until the owner requests that work. This session changed notes only;
no new audio, pack changes or in-game playback tests.

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

Next action: resume at step 1 when the owner requests production. Nothing is
waiting to run automatically.
