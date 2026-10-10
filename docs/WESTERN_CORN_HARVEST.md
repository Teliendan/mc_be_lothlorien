# Western corn harvest

Updated 2026-10-10 for Bedrock 1.26.52 / stable API 2.8.0. Documented
counterpart recipe and regression-tested configuration; not yet verified in game.

The owner's current standard is to match the nearest vanilla block unless an
exception was approved. Corn uses wheat as its harvest counterpart, retaining
the custom seed/grain items used by the Lembas recipe and deer. Its intentionally
faster growth and lower-light tolerance are unchanged.

The earlier implementation yielded a uniform 1–2 grain and 1–3 seeds with no
Fortune behavior. Phase 7's technical notes recorded those implementation values,
but explicitly left young/mature harvesting unobserved in the owner's test.
No separate approved yield exception was found in the design or test record.

| Crop | Grain | Seeds |
| --- | --- | --- |
| Young, growth 0–6 | 0 | Exactly 1 |
| Mature, no Fortune | Exactly 1 | Binomial(3, 8/15), range 0–3, mean 1.6 |
| Mature, Fortune I | Exactly 1 | Binomial(4, 8/15), range 0–4, mean 2.1333… |
| Mature, Fortune II | Exactly 1 | Binomial(5, 8/15), range 0–5, mean 2.6666… |
| Mature, Fortune III | Exactly 1 | Binomial(6, 8/15), range 0–6, mean 3.2 |

Hand, ordinary tools, Silk Touch and tool-less environmental removal use the
baseline distribution; Fortune only adds seed trials. There is no crop item
self-drop. Nonstandard command enchantment levels above III retain the III
recipe; unlimited-level parity is not claimed.

`tools/western_corn_loot.py --write` regenerates both loot tables using only
supported Bedrock `random_chance`, `match_tool` enchantment ranges, `set_count`
and `explosion_decay`. Each Bernoulli trial has its own one-roll pool. A single
random gate around a multiple-roll pool would correlate the trials and give a
different distribution. Native decay follows each item's final count and keeps
the engine's actual explosion context/gamerules; no scripted blast simulation.
`configure_support.py` restores both recipes after block regeneration.

Evidence, read 2026-10-10:

- Installed vanilla 1.26.52 has wheat seed placement and wheat/deepslate recipes,
  but no readable native wheat harvest table; absence does not mean zero drops.
- [Fortune, revision 3821973](https://minecraft.wiki/w/Fortune?oldid=3821973),
  **Wheat and beetroot / Bedrock Edition**, specifies three trials at 8/15,
  no extra guaranteed seed, plus one trial per Fortune level. Its Java section
  instead uses 4/7 and adds a seed; those values must not be copied into Bedrock.
- [Wheat, revision 3800757](https://minecraft.wiki/w/Wheat?oldid=3800757),
  harvesting: mature wheat gives one wheat, Fortune affects seeds only, young
  crop returns one seed. The generic 1–4 seed sentence is superseded here by
  the explicit Bedrock table in Fortune. Saved page text is under workspace
  `temp/acorn-fortune/`.
- [Official 26.50 changelog](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound)
  documents the modern loot condition changes; no wheat/Fortune harvest change
  found. This is not proof of native crop implementation internals.
- [Official loot conditions](https://learn.microsoft.com/en-us/minecraft/creator/documents/loottableconditions?view=minecraft-bedrock-stable)
  documents probability gates and tool enchantment ranges. The numeric vanilla
  harvest recipe comes from the edition-specific Wiki table, not creator docs.

`node tests/western_corn_harvest.mjs` checks full probability distributions,
young/mature routing, grain independence, Fortune trial addition, decay order,
generator parity and deliberately broken alternatives. It does not run native
loot evaluation. Game acceptance still needs harvesting growth 0/6/7 with hand,
ordinary tool, Fortune I–III and Silk Touch, then separate water/support/piston
and explosion tests alongside wheat. A small random sample cannot establish the
exact probabilities; test large repeated samples and compare distributions.
