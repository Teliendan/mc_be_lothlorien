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
| Small-flyer native policy and captured firefly identity/health | `small-flyers`, `animal-home`, `decor-rope`, `performance`, `suite-layout`:5 runners passed verify and deploy2026-10-20.12 new production/data scenarios; native raw-lore persistence/actual stack merge, anchors and flap output remain acceptance: [SMALL_FLYER_INTERACTIONS.md](SMALL_FLYER_INTERACTIONS.md). |
| Unicorn per-player Friend luring/Harmony-tag lifecycle and matching no-flight predicate | `unicorn-luring`, `unicorn`, `harmony`, `animal-home`, `performance`, `suite-layout`:6 runners.8 production-tag/filter scenarios; native selection is not simulated: [UNICORN_INTERACTIONS.md](UNICORN_INTERACTIONS.md). |
| Bonded unicorn native healing and owner interaction handoff | `unicorn`, `animal-home`, `performance`, `suite-layout`:4 runners. No native-healing simulation; bonded data/owner gate/no queued charge and original trust integration: [NATIVE_ANIMAL_HEALING.md](NATIVE_ANIMAL_HEALING.md). |
| Synchronous interaction cleanup and unicorn swimming | `swan-squirrel-interactions`, `swan-squirrel`, `animal-home`, `deer-interactions`, `white-deer`, `performance`, `decor-rope`, `rope`, `food-remedy`, `unicorn`, `suite-layout`:14 runners. Actual timing/error cases and native water acceptance: [SYNCHRONOUS_VALIDATION.md](SYNCHRONOUS_VALIDATION.md). |
| Swan/squirrel interaction policies, errands and native gift delivery | `swan-squirrel-interactions`; add `swan-squirrel` (including shedding), `animal-home`, `deer-interactions`, `white-deer`, `performance`, `suite-layout`.42 current production scenarios after synchronous evidence correction; exact owner1/5 choices and native acceptance: [SWAN_SQUIRREL_INTERACTIONS.md](SWAN_SQUIRREL_INTERACTIONS.md). |
| Deer/shared wariness, deferred white-deer offers, lifetime gifts and gift-ground space | `deer-interactions`; add `deer`, `white-deer`, `animal-home`, `swan-squirrel`, `unicorn`, `performance`, `suite-layout` for integration.33 production scenarios; native acceptance: [DEER_INTERACTIONS.md](DEER_INTERACTIONS.md). |
| Optimistic partial depth / natural rarity consumer interaction | `biome`, `deer-interactions`, `white-deer`, `wardens`, `animal-home`, `swan-squirrel`, `performance`, `suite-layout`.17 sampler tests; owner2026-10-20 prefers extra hearts to missing frontier encounters while keeping incomplete metadata. |
| Phial holder eligibility, spider fairness/revalidation and helper neighbor policies | `phial`, `suite-layout`; source/offline coverage and native acceptance: [PHIAL_INTERACTIONS.md](PHIAL_INTERACTIONS.md). |
| Food/remedy completion, coexistence, Creative, bottle/compost/cooking data | `food-remedy`; add `crops`, `flora-crop`, `deer`, `swan-squirrel`, `nectar-dew`, `suite-layout` as applicable. Native acceptance and pending consumers/remainders: [FOOD_REMEDY_INTERACTIONS.md](FOOD_REMEDY_INTERACTIONS.md). |
| Firefly containers, rope context/effects/bounds/drops, chandelier recipe | `decor-rope`; add `rope`, `lamps`, `covers`, `nectar-dew`, `flora-crop`, `support`, `performance`, `suite-layout` for integration. See [DECOR_ROPE_INTERACTIONS.md](DECOR_ROPE_INTERACTIONS.md). |
| Cover merging/dew/bottle progress, litter/blossom data and support families | `covers`; add `flora-crop`, `flora`, `nectar-dew`, `support`, `suite-layout` for integration. See [COVER_INTERACTIONS.md](COVER_INTERACTIONS.md). |
| Flower/herb/bloom use; corn state/layout | `flora-crop`; add `crops`, `nectar-dew`, `flora`, `support` for integration. See [FLORA_CROP_INTERACTIONS.md](FLORA_CROP_INTERACTIONS.md); new terrain/testing world for wild corn state. |
| Mallorn controls/barriers | `controls`; add `wood` and `support` for family/support integration |
| Wood use, slab merging/fuel, wood axes, stair chest access | `wood-interactions`; add `wood`, `controls`, `support` for shared-handler/family changes; see [WOOD_INTERACTIONS.md](WOOD_INTERACTIONS.md) |
| Cloak/belt; bow/arrows; phial; Miruvor | `worn-gifts`, `archery`, `phial`, `miruvor`; aggregate `equipment` or `gifts` |
| Biome depth / plants / crops / wood | `biome`, `flora`, `crops`, `wood` |
| Giant tree generation and nut growth | `giant-trees` |
| Harmony, Renown, shops, healing | `harmony`, `renown`, `trade`, `healer` |
| Animals and transport | `deer`, `antlers`, `white-deer`, `swan-squirrel`, `unicorn`, `animal-home`, `small-flyers` |
| Mallorn boats and chest boats | `boats` (native source contracts and item/recipe/drop bindings; runtime cases in [BOAT_INTERACTIONS.md](BOAT_INTERACTIONS.md)) |
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
