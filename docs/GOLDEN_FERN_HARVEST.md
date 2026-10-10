# Golden fern harvest

2026-10-10; target Bedrock 1.26.52. Source-based configuration and offline
regression checks; the changed drops are **not game verified**.

Counterpart: `minecraft:fern`. [Mojang's Taking Inventory: Fern](https://www.minecraft.net/en-us/article/fern)
(2025-09-05) describes one fern collected with shears, and otherwise a one-in-eight
wheat-seed drop with nothing seven times out of eight. Golden fern previously
omitted `minecraft:loot`, which makes a custom block drop itself with any tool.
The shears speed tag did not impose a collection requirement.

The explicit `loot_tables/blocks/golden_fern.json` now requests:

* Shears: exactly one `lothlorien:golden_fern`, no wheat seeds.
* Ordinary tool, hand or tool-less removal: 1/8 chance of one
  `minecraft:wheat_seeds`, otherwise nothing; no fern self-drop.
* Each final count is passed through native `explosion_decay`; no scripted
  manual blast drops or guessed explosion probability.

The pools are mutually exclusive through a positive/inverted shears condition.
Support loss, piston pop and water pop reach the same native tool-less table;
the motion script must continue to avoid adding duplicate items. Native loot
condition behavior and explosion gamerules still need engine acceptance.
The owner's nonreplaceable decision stays separate: break the fern before
placing another block in its cell.

Regenerate only this table with `python -B tools/golden_fern_loot.py --write`.
`fern_loot()` returns a fresh recipe and `write_loot()` supports the common
support postpass without requiring Pillow or any art regeneration. Print with
`--print-loot`. The block routing and common postpass are maintained separately.

Run `node tests/golden_fern_harvest.mjs` for semantic checks, intentional broken
fixtures and generator parity, then the normal `mods verify lothlorien` after
integration. The test evaluator computes requested baseline loot expectations;
it is not a Bedrock engine emulator.

Still unresolved: exact native **Bedrock** fern Silk Touch and Fortune semantics.
No extra Silk Touch self-drop or Fortune multiplier is invented here. Enchanted
non-shears currently follow the baseline pool. Therefore this is **not yet full
native harvest parity**. The Mojang fern article establishes the basic shears
and ordinary-drop behavior, but does not settle those enchantments. Compare
vanilla fern and golden fern using shears, hand, ordinary hoe, Silk Touch
axe/pickaxe and Fortune I–III; record deterministic collection separately from
a large sample of random seed drops. Also compare support/water/piston loss
and TNT with `tntExplosionDropDecay` false/true. Deploy before game handover.
