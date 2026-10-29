# Lothlorien docs

Final design, owner decisions and real limits. Phase history, iteration logs and dated test narratives live in git only.
Start with `TODO.md` for what is left before release.

## Project

| File | Content |
|---|---|
| `TODO.md` | what is left before testers and release, known issues, owner decisions, open retests |
| `OWNER_CHECKS.md` | accepted in-game results, engine limits, open owner retests |
| `NOT_IMPLEMENTED.md` | features left out and why |
| `parity/` | vanilla-parity decisions: `BLOCKS_ITEMS.md`, `CREATURES.md` |
| `TESTER_BRIEF.md` | private tester brief for 0.8.0 |
| `TESTING.md`, `VERIFIER_WARNINGS.md`, `WIKI_EXPORT.md`, `LOCALIZATION.md` | test layout, documented verifier exceptions, wiki export status, translation notes |
| `media/`, `design/banner.png` | logo, promo banners, the silver banner |

## World generation

| File | Content |
|---|---|
| `WORLDGEN.md` | the natural tree grid (village, platform and plain Great Mallorn, root shrine), water and terrain decisions, the overlap limit |
| `ROOT_SHRINE.md`, `FLOWER_GARDEN.md`, `MEMORIAL.md` | the three woodland places and how gardens and memorials are placed |
| `VILLAGES.md` | finished elven villages, performance |
| `design/lothlorien_jigsaw_settlement.md`, `village_style.md`, `village_central.md`, `village_crowns.md`, `home_furnishing.md` | village layout, style guide, central tree, crowns, home furnishing |
| `FLORA_DENSITY.md`, `ATMOSPHERE.md` | flora density against vanilla biomes, biome sky and fog |

## Gameplay

| File | Content |
|---|---|
| `design/elven_inhabitants.md` | elves, Renown, Loremaster, trades, gifts (the design authority) |
| `design/harmony_rework_plan.md` | the Harmony model |
| `ELF_SERVICES.md` | shops, healer, watch camps |
| `GIFTS.md`, `ARCHERY.md` | Galadriel's gifts, the phial, the Galadhrim bow and arrows |
| `mobs/` | one sheet per creature: deer, white deer, swan, squirrel, songbird, butterfly, firefly, unicorn, elf, warden, boat; `BRINGING_HOME.md` for capture and leads |
| `design/drops.md` | drops and ingredients per creature |

## Blocks and items

| File | Content |
|---|---|
| `TECHNICAL_NOTES.md` | how the mod is built, by topic |
| `BLOCK_MATERIALS.md`, `TAGS.md`, `WATER.md`, `SNOW.md`, `PISTON_SUPPORT.md` | block material profiles, tag audit, water and snow policies, support blocks moved by pistons |
| `LEAF_HARVEST.md`, `ORDINARY_HARVEST.md`, `GOLDEN_FERN_HARVEST.md`, `WESTERN_CORN_HARVEST.md`, `STAR_CANOPY_HARVEST.md` | harvest and loot rules |
| `MALLORN_WOOD_LESSONS.md`, `GRAPHICS_TASKS.md` | wood-set art lessons, art status and the leaf flicker issue |
| `SCRIPT_PERFORMANCE.md` | script cost measures |

## Audio and voice

`SOUNDSCAPE_PLAN.md` (music, shrine, memorial and forest sounds; the name is kept because scripts point to it),
`AMBIENT_SOUNDS.md`, `BIRDSONG.md`, `SOUND_RESEARCH.md`, `SINDARIN_VOICE.md`, `SINDARIN_VOICE_EVENTS.md`,
`SINDARIN_VOICE_PHRASES.md`.

Shared Bedrock knowledge is in the workspace skills (`.claude/skills/`); this folder only holds what is specific to this mod.
