# Ordinary block collection

Owner correction 2026-10-10, target Bedrock 1.26.52: efficient mining tools
generally affect time; collection restrictions need an explicitly approved rule.
Star canopy collects with any tool or hand. Starstone ore, nectar bloom,
golden fern, ordinary-leaf shears/Silk self-collection and auxiliary drops retain
their separately approved rules; corn keeps its wheat-derived yield/Fortune.

Owner clarification 2026-10-11: nectar bloom needs shears or Silk Touch, like
ordinary leaf self-collection. Every nectar stage uses two exclusive native
self-item pools (shears; Silk Touch and not shears), with `set_count:1`, then
`explosion_decay`. Its hanging spore-blossom-like flower identity, mining,
material/particle settings, nectar filling and bottle interaction are unchanged.
`make_nectar_bloom.py` reproduces this loot without changing art. The earlier
any-tool change is superseded by the owner's explicit shears-or-Silk instruction.

Audit updated 2026-10-11: checked all 40 ordinary Lothlorien blocks' base/permutation loot
route and block-break script hooks. After these repairs, `match_tool` remains
only in the deliberately separate nectar bloom, ordinary leaf, golden fern and mature corn
tables. No other ordinary-block collection gate was found. Native default
self-drops and existing scripted support/rope/linked-shape lifecycle ownership
are preserved. This does not establish unobserved engine behavior.

`tests/ordinary_harvest.mjs` follows all ordinary block loot routes, including
permutations and nested tables, and rejects tool or player-only collection
conditions. It excludes four reviewed nectar/leaf/fern/crop rules; leaf/fern/crop have
dedicated regression suites. Nectar's exact shears/Silk one-item native decay recipe and
all four stage routes are checked against its actual generator; broken pool
and entry gates are rejected. `tests/star_canopy_harvest.mjs` additionally guards
pickaxe efficiency and removal of the obsolete scripted canopy gate.

Pending game acceptance: shears or Silk Touch collect nectar stages 0–3;
hand/other unenchanted tools yield no bloom. Separately test support/water/piston removal and native
explosion decay. Star canopy's manual checks are in `STAR_CANOPY_HARVEST.md`.
No additional uncertain collection exception was found or invented.

Validation 2026-10-11: full `mods verify lothlorien` passes, localization OK,
0 errors / 10 existing warnings. Updated canopy/ordinary/leaf regression tests
pass; this is static/offline evidence, not an in-game harvest test.
