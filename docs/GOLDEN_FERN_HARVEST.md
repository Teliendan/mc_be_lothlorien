# Golden fern collection

Owner decision 2026-10-13, target Bedrock 1.26.52: golden fern is a flower-like
collectible. This supersedes the earlier vanilla fern shears/wheat-seed recipe.

Hand, shears, ordinary and enchanted tools collect exactly one golden fern.
Mining is instant (parameter 0). There are no wheat-seed drops or Fortune bonuses.
Native explosion_decay follows set_count1, so explosions may destroy the drop.
Tool-less support/water/piston removals have no loot predicate excluding them.
Nonreplaceable placement, potting, composting, support and fire policy remain.
The shears speed tag is a material label, not a harvest gate.

Both block and explicit inventory item carry lothlorien:flower, alongside Elanor,
Niphredil, Athelas, nectar bloom and Mallorn blossom. This groups collectibles for
custom filters; it does not grant vanilla pollination or alter other flowers'
separately approved harvest restrictions.

Regenerate the table with `python -B tools/golden_fern_loot.py --write`.
The support postpass calls the same recipe. Existing golden_fern_harvest.mjs and
ordinary_harvest.mjs now check the any-tool policy, deterministic count, no extra
seed route, native decay ordering, generator parity and deliberately broken loot.
Offline regressions pass; no new in-game collection/explosion acceptance yet.
The old vanilla-fern/Fortune research is historical in git; current design
deliberately differs from vanilla fern by the owner's explicit instruction.
Implementation commit: `Classify flowers and make fern and antlers easy to collect`.
Deployed through the workspace tool; leave/re-enter the world to reload.
