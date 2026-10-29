# Lothlorien: what is left

The main plan for this mod from 2026-10-24 on. It replaces the phase list in
`design/lothlorien_implementation_plan.md`. Tick items off here and delete this file when
the mod is released.

Target: tester build on the weekend of 2026-10-24/25.

## 1. Before testers

- [x] **Remove the worldgen test pack.** `lothlorien_feature_probe_bp`, its test and its build
  script were removed on 2026-10-24, because `mods package` would have shipped it. It is still in git history.
- [x] **Debug log cleanup.** All diagnostics (village planner start/summary/per-merge/link/repair/rejected
  lines, elf village summary, rail mender count, warden replace) now log only through the debug switch
  (`village_debug.js`, set by `/scriptevent lothlorien:debug`); only failures (`gave up`, write failures,
  `could not spawn`, caught exceptions) log unconditionally. Done 2026-10-29.
- [x] **Debug leftovers cleanup.** Done 2026-10-29. Kept `harmony`, `renown`, `depth`, `debug`; removed
  `speed`, `tps`, `village`, `elf` and the trade debug command with their helpers (`speed_probe.js`,
  `speed_stats.js`, `tick_rate*.js`, `planNearest`, `elfDebug`, `handleTradeEvent`, 22 catalog keys, `diagnostics.mjs`).
  Also removed the landscape probe (two structures, six pools, `structures/lothlorien/landscape_probe/`,
  `build_landscape_probe.mjs`, its test). `verification_exceptions.json` stays in the repo; `mods package`
  does not exclude it yet (needs `verification_exceptions.json` added to `SKIP_NAMES` in workspace `tools/mods.py`).
- [ ] **Feedback retests only.** Owner completed the broad checks on 2026-10-25.
  Accepted results and fixes: `TEST_FEEDBACK_2026-10-25.md`; remaining focused
  checks: workspace `docs/game-checks.md`. L8 is untested and L9 inconclusive.
- [x] **Snow on blocks.** Native snowlogging enabled for Elanor, Niphredil, Athelas and Golden Fern
  (2026-10-25); counterpart scope and remaining game checks: `SNOW.md`.
- [x] **Mob hurt and death sounds.** Owner checked them in game on 2026-10-28 and kept all of them:
  elves and Elven Wardens use the player sounds; the deer, fawn, swan, songbird, unicorn and squirrel
  borrow vanilla sounds (`lothlorien_rp/sounds.json`).
- [ ] **Package and smoke-test.** Run `.\mods package lothlorien`, install the `.mcaddon` on a clean
  device, create a new world and check that it loads.
- [ ] **Tester brief.** Cover install steps, "new world, or back up before adding to an existing
  world", known issues (section 4), what to test (section 2), and how to report.

## 2. For testers (no work for us; goes into the tester brief)

- Loremaster: the full 12-request Elf-friend path, dialogue at low Harmony, two players on one firefly.
- Survival balance: a fresh survival world played normally, not judged from Creative.
- Translations: native speakers for the eight AI-drafted languages.
- Biome region size, caves under the biome, and how shrines, gardens and memorials sit in natural terrain.
- Performance on weaker devices: a tablet tester.
- Elves killed by zombies and illagers are not replaced. This is intended; collect reports.

## 3. Before release

- [x] **Sindarin voice.** Generated and owner accepted overall on 2026-10-25
  ("Sindarin - Good"). Bindings: `SINDARIN_VOICE_EVENTS.md`.
- [x] **Music and soundscape** (`SOUNDSCAPE_PLAN.md`): village harp music, root shrine and leaf
  memorial sounds, forest leaf rustles. Outside villages the biome keeps vanilla `forest` music.
- [x] **Pack icon.** Night scene with the white hart and the lit village, accepted 2026-10-28 (`GRAPHICS_TASKS.md`).
- [x] **Promo banner** and site logo, accepted 2026-10-28 (`docs/media/`, `GRAPHICS_TASKS.md`).
- [ ] **LICENSE.** Base it on `C:\Users\karel\Documents\Teliendan\docs\licence_template.md`. Review notes:
  - Add "provided as is, without warranty or liability". Worldgen changes players' worlds.
  - Add a third-party section:
    - not affiliated with Mojang/Microsoft or the Tolkien Estate
    - the licence grants no rights to Tolkien names
    - anything derived from vanilla Minecraft files stays Mojang's
  - Say whether adapted code snippets may be used in paid projects. Section 1 allows adapting
    code, and section 3 forbids selling "this project".
  - Add a contact (website or GitHub issues).
  - Asset reuse rules for AI-generated art and audio may be hard to enforce. As a polite request it is fine.
- [ ] **README rewrite** for the public repo, replacing the stale "Phase 1" status:
  - features
  - install
  - requirements (Bedrock 1.26.50+, no experiments)
  - the new-chunks and backup warning
  - known issues
  - credits, including AI-generated art and audio
  - disclaimer: an unofficial Tolkien fan work, not affiliated with Mojang or Microsoft

  Also set the GitHub repo description and topics.
- [ ] **Big docs cleanup** (owner rule). Condense `docs/` to the final design, decisions and
  limits; phase history stays in git.
  - Fix contradictions and stale "open" items:
    - `NOT_IMPLEMENTED.md`: the hinge/wall filter and white deer sounds are done
    - `ROOT_SHRINE.md:4`: "commit pending"
    - the Phase 14 firefly items
  - Fix broken dashes shown as `?` and missing spaces.
  - Fold in section 5 below.
  - Remove the probe docs: `CONSTRAINED_FEATURE_PROBE.md` and the mentions in
    `LANDSCAPE_WORLDGEN_PLAN.md`, workspace `docs/worldgen-test-packs.md` and skill reference
    `bedrock-modding/references/21-jigsaw-worldgen-policy.md`.
  - Drop unused tools: `tools/make_leaf_cube_geo.py`, `tools/make_dialog_review.py`.
  - Rename or retire the "temporary" `tree_grid` naming (`build_tree_grid_test.mjs`, `TREE_GRID_TEST.md`).
  - Check where `design/banner_inspiration.jpeg` came from, since the repo is public.
  - Clear workspace `temp/localization/` once the translations are final.
- [ ] **Tester feedback** worked in.
- [ ] **Release package:** version bump, `.\mods package lothlorien --release`, and a first
  release note written by hand.
- The website (wiki, documents, download) is a separate project.

## 4. Known issues (go into the tester brief and README)

- Mallorn and golden leaves flicker. This is z-fighting between leaf faces; the known fixes look
  worse (`GRAPHICS_TASKS.md:219`).
- Where independent worldgen starts overlap, a build can be cut. The engine allows no better.
- Accepted engine limits: `parity/BLOCKS_ITEMS.md:97-106`, `NOT_IMPLEMENTED.md`.

## 5. Owner decisions 2026-10-24

- **Worldgen:** the 2026-10-20/21 fixes were tested in a new world and accepted: "as good as we
  can make it". The current tree-grid layout is the release design, overlaps included.
- **Checked OK in game:** the Harmony action-bar icons, the elven bow, and the unicorn art.
- **Elves:** zombies and illagers hunting elves, with no replacement, stays.
- **Leaf flicker:** accepted as a known issue.
- **Closed ideas:**
  - full Renown's reward is the unlocked trades
  - elves keep their normal behaviour at night
  - no dew lantern (lanterns exist)
- **Not to-dos (testers will report):** biome size, natural placement, performance, Loremaster
  edge cases, survival balance, translations.

## Owner feedback backlog - 2026-10-25

Completed source fixes and accepted checks: `TEST_FEEDBACK_2026-10-25.md`.

- [ ] **Retest bounded fixes:** Miruvor empty skin/refill/last sip; Star Canopy
  survival unlock; Friend unicorn lure; wind-charge controls; rope with an
  existing Slow Falling potion; full-inventory named/injured firefly capture;
  water-only boat dispensing; rising-bridge exit closure.
- [ ] **Spawn egg graphics (deferred):** replace generic eggs with the current
  creature-recognizable vanilla visual language, using the shared Bedrock art
  guide and reproducible asset generators. No artwork overhaul in this pass.
- [ ] **Stripping swing (deferred API limit):** keep correct stripping/wear;
  revisit a supported native use-animation route when the stable API permits it.
- [ ] **Wall/gate visual connection (deferred engine limit):** gate lowers,
  cobblestone wall arm stays absent. Avoid changing unrelated connections just
  to make this cosmetic junction connect.
- [ ] **Boat hull lift (deferred):** redesign long hull/native dispenser spawn fit;
  the water-only filter does not correct vertical lift above the dispenser.
- [ ] **Railing follow-up:** verify newly processed upward half-step bridge joins
  remain open. Inspect the photographed location (1040,141,-1338) and manually
  remove an old false closure if needed; existing saved fences are retained.
- [ ] **L8 / L9:** complete targeted deer and squirrel checks with explicit setups
  in the workspace checklist; no failure is inferred from an untested case.
