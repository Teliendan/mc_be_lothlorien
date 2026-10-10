# Ordinary block collection

Owner correction 2026-10-10, target Bedrock 1.26.52: efficient mining tools
generally affect time; collection restrictions need an explicitly approved rule.
Star canopy and nectar bloom collect with any tool or hand. Starstone ore,
golden fern, ordinary-leaf shears/Silk self-collection and auxiliary drops retain
their separately approved rules; corn keeps its wheat-derived yield/Fortune.

Nectar bloom's old shears-only condition is removed. Every nectar stage uses
one unconditional native self-item entry with `set_count:1`, then
`explosion_decay`. Its hanging spore-blossom-like flower identity, mining,
material/particle settings, nectar filling and bottle interaction are unchanged.
`make_nectar_bloom.py` reproduces this loot without changing art. The earlier
vine-style collection choice is superseded by the owner's instruction.

Audit 2026-10-10: checked all 41 ordinary Lothlorien blocks' base/permutation loot
route and block-break script hooks. After these repairs, `match_tool` remains
only in the deliberately separate ordinary leaf, golden fern and mature corn
tables. No other ordinary-block collection gate was found. Native default
self-drops and existing scripted support/rope/linked-shape lifecycle ownership
are preserved. This does not establish unobserved engine behavior.

`tests/ordinary_harvest.mjs` follows all ordinary block loot routes, including
permutations and nested tables, and rejects tool or player-only collection
conditions. It excludes the three reviewed leaf/fern/crop rules, which have
dedicated regression suites. Nectar's exact one-item native decay recipe and
all four stage routes are checked against its actual generator; broken pool
and entry gates are rejected. `tests/star_canopy_harvest.mjs` additionally guards
pickaxe efficiency and removal of the obsolete scripted canopy gate.

Pending game acceptance: collect nectar stages 0–3 with hand, ordinary tools,
shears and Silk Touch; separately test support/water/piston removal and native
explosion decay. Star canopy's manual checks are in `STAR_CANOPY_HARVEST.md`.
No additional uncertain collection exception was found or invented.

Validation 2026-10-10: full `mods verify lothlorien` passes, localization OK,
0 errors / 10 existing warnings. Updated canopy/ordinary/leaf regression tests
pass; this is static/offline evidence, not an in-game harvest test.
