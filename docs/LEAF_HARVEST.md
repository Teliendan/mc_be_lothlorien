# Mallorn leaf harvest

2026-10-10, target Bedrock 1.26.52, minimum engine 1.26.50. Source-based native
loot configuration and semantic regression tests; **not yet checked in game**.

Ordinary Mallorn leaves use oak leaves as the harvest counterpart. Shears or any
Silk Touch tool collect exactly one ordinary leaf block and suppress both
auxiliary pools. Shears enchanted with Silk Touch still produce one leaf. A hand,
ordinary tool, or the existing command-driven decay path cannot collect leaf
blocks; these contexts independently have a 2% chance of 1–2 sticks and the
existing custom 2% chance of one Mallorn acorn. Both auxiliaries can drop together.
No apple or vanilla sapling is added: the acorn is part of this mod's planting,
food and white-deer loop.

The implementation uses direct Bedrock `match_tool` predicates. Positive Silk
Touch requires `range_min: 1`. Negative gates negate that positive test using
`operator: "not"`; an absent enchantment is not tested as level zero. The two
self-drop pools are mutually exclusive. Each ordinary-leaf item entry delegates
explosion processing to native `explosion_decay`; for sticks it follows
`set_count`. Its numerical runtime behavior is not simulated by our tests.

Golden decorative leaves retain the owner's unconditional self-drop and no
decay. Nectar bloom retains the owner's shears-only collection gate, including
no Silk Touch substitution. Player persistence, the custom 10-step leaf reach,
tree generation and decay scheduling are unchanged.

`tools/make_mallorn_leaves.py` keeps art generation separate from harvesting:

```powershell
python -B tools/make_mallorn_leaves.py --loot-only
python -B tools/make_mallorn_leaves.py --print-loot
```

The first command regenerates only the ordinary leaf loot table; the second
prints it without writes. Normal texture generation does not rewrite loot.
`tests/leaf_harvest.mjs`, imported by the mod suite, compares generated and
committed JSON, tests tool/decay contexts and independent auxiliary expectations,
checks decay function placement, and deliberately breaks important rules to
prove the assertions catch regressions. These tests establish our JSON semantics,
not the game's execution of loot predicates.

## Sources and limits

- [Mojang's leaf collection explanation](https://www.minecraft.net/en-us/article/block-week-leaves)
  establishes shears or Silk Touch collection. The
  [Bedrock 1.19.10 release notes](https://feedback.minecraft.net/hc/en-us/articles/7463497138829-Minecraft-1-19-10-Bedrock)
  also specifically discuss shears and Silk Touch leaf collection.
- [Official loot condition documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/loottableconditions?view=minecraft-bedrock-stable)
  documents direct item/enchantment predicates and `range_min`/`range_max`.
  [26.50 release notes, Loot Tables](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
  introduce condition negation with `not`/`!=`. Our minimum engine supports it.
- [Official item function documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/lootandtradetablefunctions?view=minecraft-bedrock-stable)
  documents `set_count` and `explosion_decay`. Installed vanilla 1.26.50
  `loot_tables/blocks/black_concrete_double_slab.json` demonstrates count followed
  by decay. No probability is supplied to the native decay function.
- The installed vanilla reference has 441 loot tables but no exposed ordinary
  leaf loot table; these vanilla drops are not available for direct copying.
  [PocketMine's leaf implementation](https://github.com/pmmp/PocketMine-MP/blob/stable/src/block/Leaves.php)
  corroborates the 1-in-50 base stick event and 1–2 count. It is a primary source
  for PocketMine, not proof of Mojang's current engine. The owner authorized
  this limited, corroborated base correction from our previous 5% rate.

## Remaining owner questions and acceptance

Fortune is still unresolved. Current leaf drops intentionally retain base
chances at every Fortune level until a defensible Bedrock table is selected.
PocketMine's current formula gives Fortune III sticks 1/35; the commonly cited
vanilla table gives 1/30. Agreement at levels I/II does not justify mixing sources
into a partially implemented Fortune policy. This remains unfinished parity,
not an approved permanent exception.

Should Mallorn acorns keep their custom 2% chance, or adopt vanilla sapling
rates and Fortune behavior because they plant Mallorn saplings? This changes
the existing food/growth loop and needs the owner's choice; no apple analogy is
assumed. Exact vanilla Fortune rates also require Bedrock evidence/acceptance.

In game: compare hand, ordinary hoe, shears, Silk Touch hoe, Fortune hoes and
natural decay against oak leaves; confirm exactly one leaf and zero auxiliaries
on collection; then check TNT/explosion drops and Content Log. Large samples are
needed to evaluate random chances. These files must be deployed before testing.
