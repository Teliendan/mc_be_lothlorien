# Features left out, and why

Things a vanilla wood type has (or we considered) that the mod does not have. Read this before
starting any of them, so nobody re-researches a dead end. Facts were checked against the installed
game data (1.26.52), the Microsoft creator docs and the Bedrock Wiki, in 2026-09.

2026-10-18 source/Wiki audit: [current interaction ledger](VANILLA_INTERACTIONS.md)
separates documented omissions from open decisions and pending game checks.
The corrected entries below supersede their older phase descriptions; this
source audit itself adds no engine verification or new owner-approved exceptions;
later dated owner reports are marked explicitly below.

| Feature | Status | Reason / what a retry needs |
|---|---|---|
| **Signs, hanging signs** | Impossible | Text editing is a hard-coded feature of the vanilla sign block entity. No `minecraft:sign` component exists for custom blocks; `block_entity` only stores dynamic properties (and, experimental, a container). A non-editable "plaque" block is the only substitute. |
| **Shelf** | Left out | The vanilla shelf's point is holding items. A custom block can only do that with `minecraft:block_entity` `container`, which is **experimental** ("Upcoming Creator Features") in 1.26.50. A shelf without storage is just decoration, so it was removed. Retry when `container` is released; the wiki page for `minecraft:block_entity` describes it. |
| **Boats, chest boats** | Implemented; core behavior owner-confirmed 2026-10-18 | Four silver/heartwood variants use native runtime identifiers. Owner confirms leads, boarding, steering, leaving and ordinary self-drop; earlier basic chest inventory result retained. Four items now have 60-second fuel. Exact dispenser/environment/hopper/content-drop/piglin cases remain native game checks, not omitted features; see [boat interaction audit](BOAT_INTERACTIONS.md). |
| **Sapling** | Done (Phase 4) | Acorn item places `mallorn_sapling`; see `TECHNICAL_NOTES.md`. |
| **Fence gate "in wall" lowering** | Implemented offline 2026-10-18; engine checks pending | Native-wall neighbors lower the existing model three pixels through event-local reconciliation plus sparse fallback. Closed collision stays 1.5 blocks high. Exact wall/nether-brick connection filtering remains open; visual lowering does not solve that separate gap. See [CONTROL_INTERACTIONS.md](CONTROL_INTERACTIONS.md). |
| **Door hinge selection** | Pairing improved; full solid-face rule remains open | Same-facing bottom neighbors must present their handles toward the new door; perpendicular/upper/wrong-hinge neighbors do not pair. Stable 2.8.0 has no established full-solid-face predicate; current `Block.isSolid` is pre-release. Java-only aim tie-break is inapplicable. This is pending supported-path work, not an intentional omission or permanent impossibility. |
| **Waterlogging and snowlogging** | Water policies implemented, engine checks pending; snow decision open | See `WATER.md` for exact per-block decisions and flow/rendering checks. Snowlogging is not implemented; applicability needs the selected counterpart, not a blanket approved omission. |
| **Leaf decay, acorn drops** | Implemented; exact engine cases remain pending | `scripts/trees.js` uses random-tick decay and persistent player-placed leaves. Connectivity reach is **10**, not the old plan's 6; `TECHNICAL_NOTES.md` records the deliberate large-crown difference from Bedrock's 4. Search has a 4000-node bound, unloaded-neighbor preservation and a 1200-tick path cache. Current tool/auxiliary-drop rules are in `LEAF_HARVEST.md`; do not restore the obsolete shears-only/5%-stick description. |
| **Chest/boat, hopper, dispenser interactions** | Review per object; not blanket n/a | Boat source audit retains native dispenser path and siphonable 27-slot chest inventory; exact runtime parity is pending in [BOAT_INTERACTIONS.md](BOAT_INTERACTIONS.md). Direct comparator applicability must be established on vanilla first. Ordinary item transport still applies to wood items even when a custom chest block is outside the set. |
| **Shed antlers as a world feature / placeable block** | Done (Phase 11), untested in game | See `TECHNICAL_NOTES.md` (Deer antler). The chandelier use belongs to Phase 17. |
| **Deer grazing** | Left out | Vanilla `eat_block` turns grass blocks into dirt, which would bare the golden forest floor. A grazing animation without the block change needs script. |
| **White deer guidance to structures** | Replaced 2026-09-30 by the gift, done and tested in game (owner, 1.26.52) | Leading to hidden markers in flet giants was dropped and the markers removed (script only sees loaded chunks; placed structures cannot be located). The white deer now leads once to a spot it picks and lays a Great Mallorn nut (`docs/mobs/white_deer.md`, `TECHNICAL_NOTES.md` White deer guidance). Not done: sounds, the in-game goal experiment (`tools/dev_scripts/guide_goal/`). |
| **Harmony: plundering and care** | Left out (owner, 2026-10-07) | Chopping wood and picking flowers cost no Harmony in v1, and planting acorns earns none. `recordDeed(state, kind)` in `scripts/harmony.js` is the single entry point, so either is one `DEED_COSTS` entry plus a hook later. |
| **Harmony: trades and the Loremaster** | Later (needs the elf traders) | Per-band trade tables pre-swapped by script, Shunned and Hated refused; design in `docs/design/elven_inhabitants.md` (2026-10-10; architecture in `harmony_rework_plan.md` section 5). A script cannot open a trade screen (no trade API in 2.8.0). |
| **Harmony: action bar icons** | Built, **not verified in game** | The five band icons are glyphs of the resource pack font page `font/glyph_E5.png` (U+E500...U+E504). If an add-on glyph page does not render in the action bar, fall back to colour codes (green Friend ... dark red Hated) in front of the band name. |
| **Lothlorien banner (mallorn emblem on banners and shields)** | Postponed by owner 2026-10-10 (later phase) | Owner wants it not craftable, only found (elf villages, the chest in the great mallorn trunk on the platform), then copied and put on shields, and **no vanilla pattern sacrificed**. A vanilla banner/shield is drawn only from base colour + pattern textures, so it cannot be repainted alone; the route is a custom banner item/block (standing + wall; swaying needs a render entity), a copy recipe (Lothlorien banner + blank banner -> 2), and a custom Lothlorien Shield whose blocking is emulated with `world.beforeEvents.entityHurt` (cancel). A first try repainted vanilla Globe/Snout instead: rejected; art and generator are in commit `76dbbe5` (removed afterwards), inspiration in `design/banner_inspiration.jpeg`. Knowledge: `.claude/skills/bedrock-art/references/banner-patterns.md`. |

## Redstone

Custom blocks **can** open by redstone, contrary to the first assessment. The wiki warns that
`onRedstoneUpdate` also fires on placement and chunk load, so a naive toggle misbehaves. The mod
avoids that by storing the last power state it acted on (`lothlorien:powered`) and only reacting
when power really changes; `open` then follows power. Current `scripts/blocks.js` reads native
`getParts()` for the door (either half powered counts); the old scripted two-block ownership
description is superseded. **Exact redstone scenarios remain untested in this note** — if doors flip on world load or on placement, look at
`lothlorien:redstone_toggle` in `scripts/blocks.js`. Note `minecraft:redstone_consumer` stops a block
conducting redstone; that is fine for these thin blocks.
