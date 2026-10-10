# Lothlorien banner (mallorn emblem)

2026-10-10, target 1.26.52. Offline preview only; **in-game check pending**.

Emblem: a mallorn with a golden crown, silver trunk and roots, and two elanor stars. Based on
`design/banner_inspiration.jpeg`, using the mod's palette (golden leaves, silver bark, elanor).

Bedrock cannot add banner patterns, so the RP repaints two rarely used vanilla patterns
(see `.claude/skills/bedrock-art/references/banner-patterns.md`):

| Vanilla pattern | Becomes | Recipe (crafting table) |
|---|---|---|
| Globe (`globe`) | Mallorn Crown: crown and both stars | Elanor above Paper |
| Snout (`piglin`) | Mallorn Trunk: trunk, branches, roots | Mallorn Log above Paper |

Recommended banner (loom): **cyan base + Mallorn Trunk in white, then Mallorn Crown in lime**
(living green-silver mallorn on the pack icon's teal), or a yellow crown for the golden variant.
Apply the trunk first so the crown sits on top and the silver branches show through its gaps.
Green, light grey and blue bases also read well. Stars take the crown's dye (preview: `tools/preview_mallorn_banner.py`).
Shields, banner copying and the loom are vanilla mechanics. While the pack is active, Globe
and Snout look and are named like this in every world.

Files: `tools/make_mallorn_banner.py` (pixel grids → `RP/textures/entity/banner/banner_{globe,piglin}.png`,
`shield_patterns/{globe,piglin}.png`), `BP/recipes/mallorn_{crown,trunk}_banner_pattern.json`, and
36 lang keys per locale in `localization/catalog.json`. Those keys were committed with `M2: Renown and
the Loremaster dialog` by a concurrent session.

To check in game: banner on a wall and standing, shield in hand (first and third person), loom preview,
copying recipe, tooltips in en/cs. Check that Globe's override shows (vanilla ships `banner_globe.tga`;
ours is `.png`) and that Vibrant Visuals renders it. Not done yet: banners in village structures.
