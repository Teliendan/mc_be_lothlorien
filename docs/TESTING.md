# Lothlorien feature tests


The source of truth is [tests/suites.json](../tests/suites.json). List names with
`mods suites lothlorien`. Choose the smallest applicable name; repeat `--suite`
when the changed behavior spans features:

```powershell
.\mods verify lothlorien --suite worn-gifts
.\mods deploy lothlorien --suite worn-gifts
.\mods verify lothlorien --suite harmony --suite deer
node mods/lothlorien/tests/run.mjs --suite crops
```

Run these workspace commands from the workspace root. `deploy` already verifies;
there is no need to run both verify and deploy without an intervening reason.

| Change | Relevant suite names |
| --- | --- |
| Small flyers: firefly capture/release, native policy data | `small-flyers`, `animal-home`, `decor-rope`; native lore persistence, bottle merge, anchors and flap output are in-game checks: [parity/CREATURES.md](parity/CREATURES.md). |
| Unicorn: Friend lure, Harmony tags, owner gate, death message | `unicorn-luring`, `unicorn`, `harmony`, `animal-home`. Native heal/mount, swimming and lure retarget are in-game checks. |
| Deer, white deer, swan, squirrel: gift spot, errands, gift delivery, depth, alarm | `deer-interactions`, `swan-squirrel-interactions`, `deer`, `white-deer`, `swan-squirrel`, `animal-home`, `biome`, `wardens`, `performance`. |
| Wildlife wariness table (band tags, distances, lure exemptions, entity files) | `wildlife-wariness` (`tests/wildlife_wariness_check.py`), `harmony`, `unicorn`, `unicorn-luring`; `python -B tools/wildlife_wariness.py --check`. |
| Phial holder eligibility, spider fairness/revalidation and helper neighbor policies | `phial`, `suite-layout`; source/offline coverage and native acceptance: [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md). |
| Food/remedy completion, coexistence, Creative, bottle/compost/cooking data | `food-remedy`; add `crops`, `flora-crop`, `deer`, `swan-squirrel`, `nectar-dew`, `suite-layout` as applicable. Native acceptance and pending consumers/remainders: [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md). |
| Firefly containers, rope context/effects/bounds/drops, chandelier recipe | `decor-rope`; add `rope`, `lamps`, `covers`, `nectar-dew`, `flora-crop`, `support`, `performance`, `suite-layout` for integration. See [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md). |
| Cover merging/dew/bottle progress, litter/blossom data and support families | `covers`; add `flora-crop`, `flora`, `nectar-dew`, `support`, `suite-layout` for integration. See [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md). |
| Flower/herb/bloom use; corn state/layout | `flora-crop`; add `crops`, `nectar-dew`, `flora`, `support` for integration. See [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md); new terrain/testing world for wild corn state. |
| Mallorn controls/barriers | `controls`; add `wood` and `support` for family/support integration |
| Wood use, slab merging/fuel, wood axes, stair chest access | `wood-interactions`; add `wood`, `controls`, `support` for shared-handler/family changes; see [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md) |
| Cloak/belt; bow/arrows; phial; Miruvor | `worn-gifts`, `archery`, `phial`, `miruvor`; aggregate `equipment` or `gifts` |
| Biome depth / plants / crops / wood | `biome`, `flora`, `crops`, `wood` |
| Giant tree generation and nut growth | `giant-trees` |
| Harmony, Renown, shops, healing | `harmony`, `renown`, `trade`, `healer` |
| Village recognition during loading / Harmony outside the biome | `village-area`, `script-glue`, `harmony`, `renown` |
| Animals and transport | `deer`, `antlers`, `white-deer`, `swan-squirrel`, `unicorn`, `animal-home`, `small-flyers` |
| Mallorn boats and chest boats | `boats` (native source contracts and item/recipe/drop bindings; runtime cases in [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md)) |
| Nectar / dew / rope / lamps | `nectar-dew`, `rope`, `lamps` |
| Support and performance / diagnostics | `support`, `performance`, `diagnostics` |
| A generator added, renamed or given other output files | `generators` (`tests/generator_manifest.py`: `tools/generators.json` must name every generator and its outputs) |
| Warden / civilian elf behavior | `wardens`, `elves`; add `village-residents` for baked resident placement |
| Village geometry / planning / repairs | `village-structures`, `village-planner`, `village-repair`, `rail-mender`, `forest-floor` |
| Village engine-glue models / furnishings / polish | `script-glue`, `village-checks`, `village-furnishing`, `village-polish` |
| Assembled-village integration / all village work | `village-simulation` / aggregate `village` |
| Woodland structures and placement probes | `watch-camp`, `root-shrine`, `flower-garden`, `memorial`, `landscape-probe`, `constrained-feature-probe`, `worldgen-spacing`, `tree-grid-test` |
| Audio tools (`--check` of ambient, voice and soundscape encodings; skips without numpy/soundfile, skips absent git-ignored music masters) | `audio`; `soundscape` for the music rules |
| Test organization | `suite-layout` |

`village-simulation` alone creates the batch of 30 assembled villages (two runners that run in parallel:
`village_simulation.mjs` with the pack checks on the villages, and `village_loop_sim.mjs` with the three loop-planner tests,
which build their own 30 seeds without `check()`); ordinary
item/animal suites do not load it. Geometry and planner suites are separate and
can also take appreciable time; use them when those features change. Some
integration tests exercise plants/residents against generated villages on purpose;
they belong in the simulation suite rather than the narrow plant/mob suite.

`mods verify lothlorien` / `node mods/lothlorien/tests/run.mjs` still run everything.
Use full coverage for broad refactors and releases; commit hooks retain that
default. Test-only changes need no deployment; pack changes must be deployed and
confirmed `in sync` before engine testing. Offline success does not establish
native enchantment, rendering or worldgen acceptance.

Generators: `tools/generators.json` lists every `make_*.py`, `build_*.mjs` and the key-art script with the files it writes, what it needs
(Pillow, localization, vanilla reference, ...) and how it is checked (`regen`, `mode`, `manual` with a reason). `.\mods regen lothlorien`
reruns the `regen` rows in a scratch copy and fails on any byte difference (about 30 s, deliberately outside `verify`).

When adding tests here or to another mod, follow the shared
[feature-suite authoring rules](../../../docs/scoped-verification.md) and templates.
Do not grow another combined test file or import tests for their helpers.

## Debug commands in the pack

`/scriptevent lothlorien:debug` toggles an action-bar readout (biome id, depth level, hostile mobs within 64 blocks) and switches on every diagnostic

DIAG (timing) build for the tester's tablet: `.\mods diag lothlorien <version> [--commit REV] [--deploy]`; see `SCRIPT_PERFORMANCE.md`. Since 0.8.10 it also times native engine calls (`slowest native ...` in gap lines and the summary).
content-log line through `village_debug.js` (planner, elf village summary, rail mender, warden replace); only failures log unconditionally. The switch follows the debug tag: it is re-derived from it at world load and when a tagged player joins, so one command toggles tag and log lines together after a reload. `depth`
prints the depth estimate and its cost; `harmony [value]` shows or sets Harmony; `renown ...` is described in `design/elven_inhabitants.md` section 3 ("As built"). Everything else (showcase, grow,
growbig, treestats, treecount, critters, deer, survey, speed, tps, village, elf, trade and the landscape probe) was removed from the pack (cleanups
2026-09-30 and 2026-10-29); copies of the useful ones are in `tools/dev_scripts/` (see its README), the last commit with them in the pack for the first
cleanup is `dc1182e`.

## Village planner debug lines

With village debug on (`/scriptevent lothlorien:debug`), `loop_marker.js` logs one `planner: (debug)` line per stage: `discovery`, `settle`,
`plan+build` (wall ms, ticks, inner steps and ms inside them, distinct reads, cells written and changed, then the step fields below), `populate` (`populate <ms> ms wall, <n> ticks, <steps> inner steps, <ms> ms inside them`, then the step fields: it is a job of its own steps now, village_populate.js),, then
`clear` (the final shield step: `clear <ms> ms wall, <n> ticks, y <y0>..<y1>, <s> slices (<f> failed), <steps> inner steps, <ms> ms inside them, <c> light_block_0 cells cleared, <step fields>`; the slowest step/slice is one call the job cannot split, so it is the hitch a player feels),
and the village summary. The step fields (`stepSummary` in loop_marker.js) read `slowest step <ms> ms (<from>><to>), most native reads in one step <n> (<from>><to>), steps over 3 ms: <n> (<label> <n>, ...)`.
An inner step is the code between two labelled yields (`yield "realize"`); `<from>><to>` names the two yields around the step (for example `findMerges>scoreGen`).
The budget is 3 ms and 128 native reads per step (docs/SCRIPT_PERFORMANCE.md). The DIAG build appends the label of a slice's slowest step to the runJob entry (`loop_marker.js runJob[from>to]`). `clear` is `Dimension.fillBlocks(..., { blockFilter: { includeTypes: ["minecraft:light_block_0"] }, ignoreChunkBoundErrors: true })`
once per 16 x 16 chunk column and Y slice of the village rect (`village_clear.js`), over the marker deck Y range minus 4 / plus 16 clamped to the
dimension; `<c>` is the sum of the `ListBlockVolume` capacities the calls return. A failing slice logs `planner: shield clear <volume>: <error>` unconditionally and the
next slice still runs. Expected in the simulator (20 seeds): about 7,900 cells and 108 to 210 slices per village; in game the numbers are not yet measured.

## Worldgen list features: in-game check (2026-11-12)

The covers and antlers place from one weighted `places_block` list each (LC-10). Check in a creative world on flat grass (existing world: new chunks are not needed for `/place`):
`/place feature lothlorien:mallorn_leaf_carpet_scatter_feature ~ ~ ~`, the same with `lothlorien:mallorn_blossom_scatter_feature`, and `/place feature lothlorien:deer_antler_feature ~ ~ ~` about ten times; the Content Log must show no error naming the three features.
Result, verified in game (owner, 1.26.63, 2026-11-17): LC-10 accepted (no errors, patches of 1-4 segments, mostly single petals, antlers with mixed facings, forest floor unchanged). Carpet and blossom showed one rotation everywhere (check 58); fixed in `6d2247e` with `may_attach_to.auto_rotate` false, not re-tested. The `randomize_rotation` probe (check 61) was deleted on the owner's decision.

