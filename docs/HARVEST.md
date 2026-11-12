# Harvest and loot rules

Target Bedrock 1.26.52 (leaf loot needs engine 1.26.50 for `not` conditions), Script API 2.8.0. Everything here is native
loot JSON plus offline regression tests; **none of it is accepted in game yet** (offline tests establish our JSON semantics,
not the engine's execution of loot predicates). Merged 2026-11-12 from `LEAF_HARVEST.md`, `ORDINARY_HARVEST.md`,
`STAR_CANOPY_HARVEST.md`, `GOLDEN_FERN_HARVEST.md` and `WESTERN_CORN_HARVEST.md`; the old files are at `git show 28b810a:docs/<name>`.

Standing rule (owner 2026-10-10): an inefficient tool makes mining slower; it never silently prevents collection. A collection
restriction needs an explicitly approved rule. Every item entry ends with `set_count` (where it applies) then native
`explosion_decay` (no probability argument), so explosions keep the engine's own context and gamerules; no scripted blast.

## Table

| Block | Tool, collection | Drop | Fortune / Silk Touch | Owner decision | Test |
|---|---|---|---|---|---|
| Ordinary Mallorn leaves | shears or Silk Touch (also enchanted shears) | exactly 1 leaf block, both auxiliary pools suppressed | Silk Touch = leaf; Fortune raises auxiliaries (below) | 2026-10-10 | `leaf_harvest.mjs` |
| Ordinary leaves, any other tool, hand, command decay | cannot collect the block | independent 2% (1-2 sticks), 2% (1 Mallorn acorn); both can drop together | Fortune table below | 2026-10-10 (acorn rarity, Fortune) | `leaf_harvest.mjs` |
| Golden Mallorn leaves | any tool, unconditional self-drop, no decay | itself; sticks at the ordinary rate except with shears or Silk Touch; no acorns | same stick pools and gates | 2026-11-02 (sticks) | `leaf_harvest.mjs` |
| Nectar bloom (all 4 stages) | shears or Silk Touch | itself (two exclusive self-item pools: shears; Silk Touch and not shears) | none | 2026-10-11 (supersedes the any-tool change) | `ordinary_harvest.mjs` |
| Star canopy | any tool or hand; the pickaxe is the efficient tool (`minecraft:is_pickaxe_item_destructible`, mining 3.5, blast resistance 6, the deepslate-tile counterpart) | one tile, unconditional self-item | none | 2026-10-10 | `star_canopy_harvest.mjs` |
| Golden fern | hand, shears, any tool; instant mining (0) | exactly one golden fern; no wheat seeds | no Fortune bonus | 2026-10-13 | `golden_fern_harvest.mjs` |
| Western corn, young (growth 0-6) | any | 0 grain, exactly 1 seed | none | 2026-10-10 (wheat counterpart) | `western_corn_harvest.mjs` |
| Western corn, mature | any | exactly 1 grain; seeds Binomial(3 + Fortune, 8/15) | Fortune adds seed trials; Silk Touch no effect | 2026-10-10 | `western_corn_harvest.mjs` |
| All other ordinary blocks (40 audited) | none: native default or explicit self-drops | self | none | 2026-10-10 | `ordinary_harvest.mjs` |

Audit 2026-10-11: all 40 ordinary blocks' base and permutation loot routes and block-break script hooks were checked. `match_tool`
remains only in nectar bloom, ordinary leaf, golden leaf (sticks), golden fern and mature corn. Scripted support, rope and
linked-shape lifecycle ownership is unchanged. `ordinary_harvest.mjs` follows every ordinary loot route (permutations, nested
tables) and rejects tool or player-only conditions; it excludes the four reviewed rules above. `star_canopy_harvest.mjs` also
guards pickaxe efficiency and the removal of the obsolete scripted canopy gate (the before-break gate, deferred no-loot removal and
tool-wear helper were removed; no canopy script intercepts the break). Nectar bloom keeps its hanging flower identity, mining,
material and particle settings, nectar filling and bottle interaction; `make_nectar_bloom.py` reproduces its loot without
changing art.

## Leaves

Ordinary leaves use oak leaves as the counterpart. No apple or vanilla sapling is added: the acorn belongs to the mod's
planting, food and white-deer loop. Positive Silk Touch uses `match_tool` with `range_min: 1`; negative gates negate it with
`operator: "not"` (an absent enchantment is not tested as level zero). The self-drop pools are mutually exclusive, so enchanted
shears never duplicate. Player persistence, the 10-step leaf reach, tree generation and decay scheduling are unchanged (decay is
event-driven since 2026-11-08: `TECHNICAL_NOTES.md`). 2026-10-19: both leaf variants have same-ID block items (30% composting),
furnace-to-litter recipes and chest access; ordinary decay bridges vanilla/golden leaves to supported wood while keeping reach 10
and player persistence ([parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md)).

Generator: `tools/make_mallorn_leaves.py --loot-only` rewrites only the ordinary and golden leaf tables; `--print-loot` and
`--print-golden-loot` print without writing; normal texture generation never touches loot. `tests/leaf_harvest.mjs` compares
generated and committed JSON, tool and decay contexts, independent auxiliary expectations and decay placement, and deliberately
breaks rules to prove the assertions bite.

### Rarity and Fortune (owner 2026-10-10: keep the custom acorn rarity and add Fortune)

Values come from the Minecraft Wiki ([Fortune, rev 3821973](https://minecraft.wiki/w/Fortune?oldid=3821973#Tabulated_probabilities),
[Leaves, rev 3810011](https://minecraft.wiki/w/Leaves?oldid=3810011#Breaking), read in full 2026-10-10; no separate Bedrock leaf
rows). They are wiki-documented, not engine measurements, and replace PocketMine's conflicting Fortune formula. The base stick event
(1 in 50, count 1-2) is corroborated by [PocketMine](https://github.com/pmmp/PocketMine-MP/blob/stable/src/block/Leaves.php) (a
source for PocketMine, not proof of Mojang's engine); the owner authorised this limited correction from our earlier 5%.

| Event | No Fortune | I | II | III |
| --- | ---: | ---: | ---: | ---: |
| Oak sapling reference | 5% | 6.25% | 8.333...% | 10% |
| One custom acorn | 2% | 2.5% | 3.333...% | 4% |
| 1-2 sticks | 2% | 2.222...% | 2.5% | 3.333...% |

Acorns use 2/5 of each oak-sapling chance (same relative boost, 60% rarer per leaf): the mod's balance recipe, not a native acorn
table. Fortune raises the event probability, never the acorn count. Fortune IV+ sticks follow the Wiki's command-only 10% column;
acorns plateau at 4% from III. Disjoint enchantment ranges prevent stacking pools; no tool or missing/zero Fortune uses the base
through a negated positive test. The wiki pages were not kept; re-check by fetching them and comparing SHA256 of the raw HTML
(Fortune `2612e8183ab4468035f6101104d69b6ef933399b6d79c4920f519d620d4d38af`, Leaves
`3778567483d958f3b56b7c53b54e46d290d08a67ae42b5f28f51a4e055e14d3f`).

Other sources: [Mojang leaf collection](https://www.minecraft.net/en-us/article/block-week-leaves) and the
[Bedrock 1.19.10 notes](https://feedback.minecraft.net/hc/en-us/articles/7463497138829-Minecraft-1-19-10-Bedrock) (shears or Silk
Touch collection); [loot conditions](https://learn.microsoft.com/en-us/minecraft/creator/documents/loottableconditions?view=minecraft-bedrock-stable)
(item/enchantment predicates, `range_min`/`range_max`); the 26.50 changelog (negation with `not`/`!=`);
[loot functions](https://learn.microsoft.com/en-us/minecraft/creator/documents/lootandtradetablefunctions?view=minecraft-bedrock-stable)
(`set_count`, `explosion_decay`; vanilla `black_concrete_double_slab.json` shows count then decay). The installed vanilla
reference has no exposed ordinary leaf loot table, so nothing is copyable.

In game, to do: compare hand, ordinary hoe, shears, Silk Touch hoe, Fortune hoes and natural decay with oak leaves; confirm exactly
one leaf and no auxiliaries on collection; TNT/explosion drops; Content Log. Random chances need large samples. Deploy first.

## Western corn

Counterpart: wheat, keeping the custom seed and grain items (Lembas, deer) and the deliberately faster growth and lower-light
tolerance. The earlier yield (uniform 1-2 grain, 1-3 seeds, no Fortune) was unobserved in the owner's test and had no approved
exception, so it was replaced.

| Crop | Grain | Seeds |
| --- | --- | --- |
| Young, growth 0-6 | 0 | exactly 1 |
| Mature, no Fortune | exactly 1 | Binomial(3, 8/15), 0-3, mean 1.6 |
| Mature, Fortune I | exactly 1 | Binomial(4, 8/15), 0-4, mean 2.1333 |
| Mature, Fortune II | exactly 1 | Binomial(5, 8/15), 0-5, mean 2.6667 |
| Mature, Fortune III | exactly 1 | Binomial(6, 8/15), 0-6, mean 3.2 |

Hand, ordinary tools, Silk Touch and tool-less removal use the baseline; command levels above III keep the III recipe (no
unlimited-level claim). No crop item self-drop. `tools/western_corn_loot.py --write` regenerates both tables from `random_chance`,
`match_tool` enchantment ranges, `set_count` and `explosion_decay`; each Bernoulli trial is its own one-roll pool (one gate around a
multi-roll pool would correlate the trials). `configure_support.py` restores both recipes after block regeneration.

Evidence (read 2026-10-10): installed vanilla 1.26.52 has wheat seed placement but no readable wheat harvest table (absence is
not zero drops); [Fortune rev 3821973](https://minecraft.wiki/w/Fortune?oldid=3821973) "Wheat and beetroot / Bedrock Edition":
three trials at 8/15, no guaranteed extra seed, one trial per Fortune level (its Java section uses 4/7 plus a seed: do not copy);
[Wheat rev 3800757](https://minecraft.wiki/w/Wheat?oldid=3800757): mature gives one wheat, Fortune affects seeds only, young gives
one seed (page not kept; its generic 1-4 seed sentence is superseded by the Fortune table); the
[26.50 changelog](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound)
shows no wheat/Fortune change. `western_corn_harvest.mjs` checks the full distributions, routing, grain independence, decay order
and generator parity. In game, to do: growth 0/6/7 with hand, ordinary tool, Fortune I-III and Silk Touch, large samples, then
water/support/piston/explosion removal next to wheat.

## Golden fern

Owner 2026-10-13: a flower-like collectible; supersedes the earlier vanilla-fern shears/wheat-seed recipe (history in git). No
Fortune, no seeds, explosions may destroy the drop, tool-less support/water/piston removals have no excluding predicate. Placement,
potting, composting, support and fire policy are unchanged; the shears speed tag is a material label, not a gate. Block and item
carry `lothlorien:flower` with Elanor, Niphredil, Athelas, nectar bloom and Mallorn blossom (a custom-filter group, no vanilla
pollination). `python -B tools/golden_fern_loot.py --write` regenerates the table; the support postpass uses the same recipe.
Commit: `Classify flowers and make fern and antlers easy to collect`. Leave and re-enter the world after deploy.

## Nectar bloom and star canopy checks still open

Shears or Silk Touch collect nectar stages 0-3 and hand or other unenchanted tools yield no bloom; test support, water, piston and
native explosion removal separately. Star canopy: collect with hand, non-pickaxe tools and every pickaxe tier, compare mining
times, then explosion decay with the relevant gamerules. The deepslate-tile research ([Wiki rev 2731188](https://minecraft.wiki/w/Deepslate_Tiles?oldid=2731188),
a 2024 snapshot, not an engine extraction) was the reason for the removed gate and stays evidence about vanilla only.
