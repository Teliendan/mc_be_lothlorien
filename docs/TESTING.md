# Lothlorien feature tests

2026-10-18; target Bedrock 1.26.52 / Script API 2.8.0. Test-only reorganization;
no pack behavior changes. The former combined runner's 239 test bodies now live
in 24 feature files, alongside the pre-existing standalone suites. Assertions
are preserved; the full runner delegates to 56 independent child processes.
The layout guard checks registration and rejects imports of other test suites.
Validation: all 56 runners passed independently, and a source comparison proved
all 239 extracted test expressions survived verbatim, exactly once. Named
selection through `mods verify` also passed for equipment, crops and suite layout;
the shared tool's 22 selection/isolation/deployment-routing tests passed.
Shared tooling and authoring guidance are committed in workspace commit
`a652673` (`Add named feature suites and shared test-authoring workflow`).

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
| Deer, white deer, swan, squirrel: wariness, gift spot, errands, gift delivery, depth | `deer-interactions`, `swan-squirrel-interactions`, `deer`, `white-deer`, `swan-squirrel`, `animal-home`, `biome`, `wardens`, `performance`. |
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
| Animals and transport | `deer`, `antlers`, `white-deer`, `swan-squirrel`, `unicorn`, `animal-home`, `small-flyers` |
| Mallorn boats and chest boats | `boats` (native source contracts and item/recipe/drop bindings; runtime cases in [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md)) |
| Nectar / dew / rope / lamps | `nectar-dew`, `rope`, `lamps` |
| Support and performance / diagnostics | `support`, `performance`, `diagnostics` |
| Warden / civilian elf behavior | `wardens`, `elves`; add `village-residents` for baked resident placement |
| Village geometry / planning / repairs | `village-structures`, `village-planner`, `village-repair`, `rail-mender`, `forest-floor` |
| Village engine-glue models / furnishings / polish | `script-glue`, `village-checks`, `village-furnishing`, `village-polish` |
| Assembled-village integration / all village work | `village-simulation` / aggregate `village` |
| Woodland structures and placement probes | `watch-camp`, `root-shrine`, `flower-garden`, `memorial`, `landscape-probe`, `constrained-feature-probe`, `worldgen-spacing`, `tree-grid-test` |
| Test organization | `suite-layout` |

`village-simulation` alone creates the batch of 30 assembled villages; ordinary
item/animal suites do not load it. Geometry and planner suites are separate and
can also take appreciable time; use them when those features change. Some
integration tests exercise plants/residents against generated villages on purpose;
they belong in the simulation suite rather than the narrow plant/mob suite.

`mods verify lothlorien` / `node mods/lothlorien/tests/run.mjs` still run everything.
Use full coverage for broad refactors and releases; commit hooks retain that
default. Test-only changes need no deployment; pack changes must be deployed and
confirmed `in sync` before engine testing. Offline success does not establish
native enchantment, rendering or worldgen acceptance.

When adding tests here or to another mod, follow the shared
[feature-suite authoring rules](../../../docs/scoped-verification.md) and templates.
Do not grow another combined test file or import tests for their helpers.
