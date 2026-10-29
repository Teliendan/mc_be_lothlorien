# Features left out, and why

Things a vanilla wood type has (or that were considered) which the mod does not have, and engine limits that were accepted.
Read this before starting any of them, so nobody re-researches a dead end. Facts were checked against the installed game data
(1.26.x), the Microsoft creator docs and the Bedrock Wiki. Per-object parity decisions: [parity/BLOCKS_ITEMS.md](parity/BLOCKS_ITEMS.md)
and [parity/CREATURES.md](parity/CREATURES.md); the owner's open retests: [OWNER_CHECKS.md](OWNER_CHECKS.md).

| Feature | Status | Reason / what a retry needs |
|---|---|---|
| **Signs, hanging signs** | Impossible | Text editing is hard-coded in the vanilla sign block entity. No `minecraft:sign` component exists for custom blocks; `block_entity` only stores dynamic properties (and, experimental, a container). A non-editable "plaque" block is the only substitute. |
| **Shelf** | Left out | The vanilla shelf holds items. A custom block can only do that with `minecraft:block_entity` `container`, which is **experimental** ("Upcoming Creator Features") in 1.26.50; a shelf without storage is just decoration. Retry when `container` is released. |
| **Fence gate "in wall" connection** | Closed as a cosmetic limit (owner, 2026-10-23) | The gate model lowers three pixels beside a vanilla wall (kept current by place/break events and the gate's random tick; closed collision stays 1.5 blocks high), but the wall draws no arm toward the gate. Native connection modes cannot narrowly advertise a custom gate as a vanilla gate to walls; see [OWNER_CHECKS.md](OWNER_CHECKS.md). |
| **Door hinge by full solid face** | Closed as a cosmetic limit (owner, 2026-10-23) | Doors pair with same-facing neighbours whose handles face the new door; perpendicular, upper and wrong-hinge neighbours do not pair. Stable 2.8.0 has no full-solid-face predicate (`Block.isSolid` is pre-release), and Java's aim tie-break does not apply. |
| **Waterlogging and snowlogging** | Native policies per family | [WATER.md](WATER.md) for water, [SNOW.md](SNOW.md) for snow: Elanor, Niphredil, Athelas and Golden Fern use native snowlogging like small flowers and ferns; other families keep their precipitation behaviour. |
| **Leaf decay** | Scripted, deliberately different from vanilla | `scripts/trees.js` uses random-tick decay and persistent player-placed leaves. Connectivity reach is **10**, not vanilla's 4, so large crowns do not rot (`TECHNICAL_NOTES.md`); search is bounded to 4000 nodes, unloaded neighbours are preserved and paths are cached 1200 ticks. Drop rules: [LEAF_HARVEST.md](LEAF_HARVEST.md). |
| **Chest/boat, hopper, dispenser interactions** | Reviewed per object | Boats use the native dispenser path and a siphonable 27-slot chest inventory; the long hull lifts above a dispenser (see OWNER_CHECKS). Ordinary item transport still applies to wood items. |
| **Deer grazing** | Left out | Vanilla `eat_block` turns grass blocks into dirt, which would bare the golden forest floor. A grazing animation without the block change needs script. |
| **White deer guiding to hidden structures** | Replaced by the gift | Leading to hidden markers in flet giants was dropped (script only sees loaded chunks; placed structures cannot be located). The white deer leads once to a spot it picks and lays a Great Mallorn nut (`mobs/white_deer.md`). The in-game goal experiment (`tools/dev_scripts/guide_goal/`) was not pursued. |
| **Harmony: plundering and care** | Left out (owner, 2026-10-07) | Chopping wood and picking flowers cost no Harmony and planting acorns earns none. `recordDeed(state, kind)` in `scripts/harmony.js` is the single entry point, so either is one `DEED_COSTS` entry plus a hook. |
| **Trade screen opened by script** | Impossible | No trade API in 2.8.0; shops are native trade tables swapped per Harmony band by script (`ELF_SERVICES.md`). |
| **Lothlorien banner (mallorn emblem on banners and shields)** | Postponed by the owner (2026-10-10) | Wanted not craftable, only found (elf villages, the chest in the great mallorn trunk on the platform), then copied and put on shields, with **no vanilla pattern sacrificed**. A vanilla banner or shield is drawn only from base colour plus pattern textures, so it cannot be repainted alone. The route is a custom banner item and block (standing and wall; swaying needs a render entity), a copy recipe (Lothlorien banner + blank banner gives 2) and a custom shield whose blocking is emulated with `world.beforeEvents.entityHurt` (cancel). A first try that repainted vanilla Globe/Snout patterns was rejected; art and generator are in commit `76dbbe5` (removed afterwards). Knowledge: `.claude/skills/bedrock-art/references/banner-patterns.md`. |

## Closed ideas (owner, 2026-10-24)

- A Renown reward beyond the unlocked trades: none.
- Special night behaviour for elves: none, they keep their normal behaviour.
- A dew lantern: none, the existing lanterns suffice.
- Replacing elves killed by zombies or illagers: not done (`design/elven_inhabitants.md`).
- Leaf flicker: accepted as a known issue (`GRAPHICS_TASKS.md`).

## Redstone

Custom blocks **can** open by redstone. The wiki warns that `onRedstoneUpdate` also fires on placement and chunk load, so a naive
toggle misbehaves; the mod stores the last power state it acted on (`lothlorien:powered`) and only reacts when power really
changes, then `open` follows power. `scripts/blocks.js` reads native `getParts()` for the door (either half powered counts). If
doors flip on world load or on placement, look at `lothlorien:redstone_toggle` in `scripts/blocks.js`. `minecraft:redstone_consumer`
stops a block conducting redstone, which is fine for these thin blocks. Exact redstone scenarios have no recorded game test.
