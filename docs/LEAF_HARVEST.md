# Mallorn leaf harvest

2026-10-10, target Bedrock 1.26.52, minimum engine 1.26.50. Source-based native
loot configuration and semantic regression tests; **not yet checked in game**.

Ordinary Mallorn leaves use oak leaves as the harvest counterpart. Shears or any
Silk Touch tool collect exactly one ordinary leaf block and suppress both
auxiliary pools. Shears enchanted with Silk Touch still produce one leaf. A hand,
ordinary tool, or the existing command-driven decay path cannot collect leaf
blocks; without Fortune these contexts independently have a 2% chance of 1–2
sticks and the custom 2% chance of one Mallorn acorn. Both auxiliaries can drop together.
No apple or vanilla sapling is added: the acorn is part of this mod's planting,
food and white-deer loop.

The implementation uses direct Bedrock `match_tool` predicates. Positive Silk
Touch requires `range_min: 1`. Negative gates negate that positive test using
`operator: "not"`; an absent enchantment is not tested as level zero. The two
self-drop pools are mutually exclusive. Each ordinary-leaf item entry delegates
explosion processing to native `explosion_decay`; for sticks it follows
`set_count`. Its numerical runtime behavior is not simulated by our tests.

Golden decorative leaves retain the owner's unconditional self-drop and no
decay. Owner clarification 2026-10-11: nectar bloom is shears-only, with native
blast decay. Silk Touch alone does not collect the bloom. Player
persistence, the custom 10-step leaf reach,
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

## Approved rarity and Fortune

Owner 2026-10-10: keep custom acorn rarity and add Fortune; use Minecraft Wiki
as a research source. The [Fortune table, revision 3821973](https://minecraft.wiki/w/Fortune?oldid=3821973#Tabulated_probabilities)
and [Leaves table, revision 3810011](https://minecraft.wiki/w/Leaves?oldid=3810011#Breaking)
were retrieved and read in full on 2026-10-10. Their leaf rows have no separate
Bedrock alternative. These are wiki-documented values, not new engine measurements.
They replace the conflicting PocketMine Fortune formula as the selected gameplay
reference; engine predicate/probability acceptance remains pending.

| Event | No Fortune | I | II | III |
| --- | ---: | ---: | ---: | ---: |
| Oak sapling reference | 5% | 6.25% | 8.333...% | 10% |
| One custom acorn | 2% | 2.5% | 3.333...% | 4% |
| 1–2 sticks | 2% | 2.222...% | 2.5% | 3.333...% |

Acorns use 2/5 of each oak-sapling chance: the same relative Fortune boosts,
remaining 60% rarer per leaf at each standard level. This is the mod's explicit
balance recipe, not a native acorn drop table. It keeps the planting/food/deer
loop intact. Fortune increases event probability, not the acorn count.
Fortune IV+ sticks follow the Wiki's command-only 10% column; acorns plateau at
4% from III upward. Disjoint enchantment ranges prevent stacking pools.
No-tool and missing/zero Fortune use the base through a negated positive test.
Shears/Silk Touch still suppress all auxiliaries, including enchanted shears.

Raw retrieved HTML stays in `temp/acorn-fortune/`; SHA256:
Fortune `2612e8183ab4468035f6101104d69b6ef933399b6d79c4920f519d620d4d38af`,
Leaves `3778567483d958f3b56b7c53b54e46d290d08a67ae42b5f28f51a4e055e14d3f`.

In game: compare hand, ordinary hoe, shears, Silk Touch hoe, Fortune hoes and
natural decay against oak leaves; confirm exactly one leaf and zero auxiliaries
on collection; then check TNT/explosion drops and Content Log. Large samples are
needed to evaluate random chances. These files must be deployed before testing.
