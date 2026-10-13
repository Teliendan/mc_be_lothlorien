# Section 9 / M6: accepted Great Mallorn watch camps

Owner accepted the completed feature on 2026-10-13: "Perfect, this is done."
Target: Bedrock 1.26.52 / stable Script API 2.8.0.
Final implementation: `0630cdf` (`Shelter watch-camp sleepers and correct indented banner edges`).
Final design and owner decisions: [elven_inhabitants.md section 9](design/elven_inhabitants.md).

Both lookout templates (round 5 and 7) have two persistent bow wardens, four
rim lanterns, two native straw beds with heads against the west trunk face,
a small green rug, two native cushions, and the silver banner in
`design/banner.png`. The banner's indented edges use NBT `bts` / `tts`.
The owner's loot choices are retained: arrow weight 6, stacks 4-8; rope 1-4;
shield chance 50%; no Elanor, Niphredil, morning dew or bottled fireflies.

Rebuild from this mod with `node tools/build_structures.mjs`. Furnishings and
loot choices live in `tools/watch_camp_rules.mjs`; arrow values share
`lothlorien_bp/scripts/gift_rules.js`. Rebuilding reproduces the owner's loot
exactly. Plain giants and village pieces keep their original bytes.

`mods verify lothlorien` and the commit checks passed with zero errors/warnings
and 15 existing documented exceptions. `tests/watch_camp.mjs` checks supported
bed pairs with heads against wood, cushion positions/colors, persistent guards,
six banner layers, nonzero modeled deck light, connected access from the rope,
exact generated structure bytes and owner-tuned loot.

Acceptance is overall; individual seating, drops, shield handling and rotation
observations were not supplied. Keep those as regression checks if related code
changes; overall acceptance does not separately establish every engine behavior.

The final packs were deployed and confirmed in sync before acceptance. Existing
trees retain their layout; worldgen changes need a new world. Newly grown Great
Mallorn nuts also place the furnished templates in existing worlds. Scratch
research, layout previews and logs in `temp/watch_camp/` were removed on acceptance.
Permanent banner references, production generators and regression tests remain.
