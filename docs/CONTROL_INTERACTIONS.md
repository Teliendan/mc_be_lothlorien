# Mallorn controls and barriers

2026-10-18; Bedrock 1.26.52, stable server API 2.8.0. Owner accepted this entire
group on this date, including synchronized double doors as a custom convenience.
Both silver and heartwood doors, trapdoors, fences, gates, buttons and pressure
plates inherit every applicable row below. This is source/documentation evidence
and offline tests; no new engine observations were supplied for this group.

## Changes and evidence

`scripts/blocks.js` and `control_rules.js` now compare pressure-plate occupancy
using entity collision AABBs against the bottom quarter-block, excluding spectator
players and removed entities. The existing four-tick idle poll remains necessary
for collisionless plates. Powered plates recheck every twenty ticks; a finite
twenty-tick deadline prevents an already queued idle callback from immediately
releasing a new press. Bookkeeping expires even if the plate is removed/unloaded.
Exact Bedrock horizontal edge insets, volume-query inclusion of huge entities
whose origins are outside the cell, activation latency, and reload timing remain
engine checks. This fixes the known broad foot-position check without claiming
all-entity native parity from mocked query results.

Buttons retain a thirty-tick player pulse. Release is a powered-only custom
component beside a powered-only native, nonlooping thirty-tick `minecraft:tick`.
Idle buttons have neither a timer nor a tick-listening component. This removes
the transient JavaScript callback that could dereference unloaded blocks or be
lost on script reload. Adding the tick through a permutation, rescheduling on
repeated presses, and its save/reload behavior need native verification; the
offline clock does not prove the engine scheduler.

Gates now choose the opposite cardinal direction when necessary to swing away
from the interacting player, and have distinct rotations for all four cardinals.
The world rotation mapping is north0, south180, east270, west90, matching the
existing in-game-verified stair generator; tests rotate the north-pointing model
vector through each authored yaw. Redstone and closing preserve the stored direction. Vanilla-wall neighbors along
the gate line lower derived copies of the accepted models by three pixels. Lowering geometry
only keeps valid authored collision bounds at 0..24 pixels; lowered selection
is 0..13. Transforming an authored Y3/height24 box would exceed the schema limit
of 24, so no whole-block translation is used. Open gates stay collisionless. Gate placement,
nearby player placement/breaks/explosions and two finite piston reconciliation
samples update only local gates. Random ticks repair other edits eventually;
unloaded borders preserve the previous state. Commands, reload, randomTickSpeed 0,
and moved-gate cases still need the tests below. Native walls are recognized by
their `minecraft:` namespace and `_wall` IDs; arbitrary other add-ons' walls have
no established classification contract.

Door pairing now rejects perpendicular neighbors and considers left/right
same-facing neighbors. Full solid-neighbor hinge selection remains open: the
pinned stable API exposes no full-solid-face predicate, and its `isSolid` successor
is still marked pre-release. No non-air/opaque guess or Java-only aim tie-break
was introduced. Placement face/player hooks alone are not such a predicate.

`tools/configure_controls.py` maintains these six block definitions without
regenerating accepted textures/models. The ordinary heartwood generator still
clones authoritative silver definitions. `tests/controls.mjs` independently
exercises production handlers, finite work, pairing and every effective gate pose.

## Interaction ledger

| Interaction | Disposition / implementation | Remaining proof or boundary |
| --- | --- | --- |
| Player button press, repeat click, power and attachment strong power | Implemented: existing 30-tick pulse, native producer per six attachment faces; native release scheduling replaces JS timeout | Native component activation/reload/chunk timing; no new engine confirmation |
| Arrow and trident button activation and holding | **Open supported-path investigation** | Buttons are collisionless. A generic projectile-hit event on the backing support is not proof of exact button contact; stuck-projectile pickup/despawn/reload holding also needs a correct trigger. No world projectile scan or approximate support-hit mapping added |
| Wind-charge button/door/trapdoor/gate activation | **Open supported-path investigation** | Vanilla charge uses `explode.toggles_blocks`; no public custom-state contract established. Burst radius is not equivalent to direct projectile contact. `onEntity` receives explicit entity-sent events, not generic wind contact |
| Plate player/mob/item/projectile activation | Implemented AABB check and spectator exclusion; existing native producer 15/down strong power retained | Exact Bedrock trigger exclusions, sleeping entities, huge-AABB query inclusion and horizontal edge boundaries |
| Plate release and sustained occupancy | Implemented 20-tick active polling with finite minimum-hold guard | Engine requeue order, reload and activation latency; four-tick idle polling is explicit implementation timing, not a verified vanilla deadline |
| Door/trapdoor/gate redstone, manual operation while powered | Existing edge-detected native consumer and stored power state retained; door uses both native parts | All pulse lengths, placement/load updates, either-half door power and manual override compare against vanilla |
| Synchronized double doors | **Intentional custom convenience, owner 2026-10-18** | Both same-kind, same-facing, opposite-hinge neighbors open together; vanilla-independent hand operation is intentionally changed |
| Door hinges and pairing | Improved same-facing left/right pairing | Full adjacent-solid-face selection is **open**, not an approved omission; Java aim tie-break is not Bedrock parity |
| Two-part door placement, ownership, break and support loss | Existing native multiblock plus support-motion rules retained | Upper/lower targeting, obstruction during placement, support replacement and exactly one drop |
| Gate opening direction | Implemented player-side facing selection; four distinct geometry transformations | Check both player sides in all cardinals against accepted models; redstone retains previous facing |
| Gate wall lowering | Implemented local wall-state reconciliation and lowered geometry and valid independent boxes | Neighbor edits, piston movement, reload, commands and unloaded borders; fallback has no fixed deadline and cannot run at randomTickSpeed 0 |
| Gate wall/nether-brick-fence connections | **Open exact native filter** | `connection_rule` exposes all/none/only_fences. `only_fences` excludes NetherBrick and walls; `all` would also admit unwanted panes/bars. Existing narrow filter retained, with no claim that visual lowering fixes wall connection gaps |
| Fence connections / rails / partial-neighbor shapes | Existing native connection trait, per-direction rail models and collision retained; both wood sets connect | Vanilla wooden fences, solid faces, partial shapes, NetherBrick separation, neighboring updates and world-version behavior |
| Fence/gate entity barriers, vehicles, jumps and small mobs | Existing native custom collision; gates retain closed 1.5-block barrier after lowering | Native movement/pathfinding comparison, including opened models and unusual actors; not proven by rendered geometry |
| Native mob door opening, breaking and navigation | **Open native recognition** | Entity goals/navigation flags do not establish custom-block recognition. No vanilla mob replacement, invented door tags or periodic mob scan added |
| Observer updates | Native permutation writes retained; no ticking cooldown block states added | Observe each transition, both door halves, no duplicate idle pulses and powered timer permutations |
| Sculk block activation/deactivation vibrations | **Open native recognition/emission** | Playing an opening/click sound is not evidence of a gameplay vibration. Pinned public API has no established vibration emitter; no helper entity workaround |
| Leads tied to fences | Existing native block `minecraft:leashable` retained at reviewed offset `[0,12,0]` | Tying, knot height, several leads, breaking, movement and reload; no assumed pixel/block conversion |
| Attachments and support | Existing native support/placement filters plus event-local support-motion recovery retained | Torches/buttons/plates on each relevant face/state, fences as support, native partial-face validity and piston departure/replacement |
| Water, liquids, snow and precipitation | Existing explicit Bedrock policies in `WATER.md` retained for every state | Bucket containment, flow clipping/outgoing faces, piston/liquid drops and snowlogging applicability remain that audit's open tests; no Java door air pockets added |
| Piston own movement and sticky behavior | Existing native movement policy retained; finite wall-update work added | Door/controls pop, gate/fence/trapdoor movement, support loss, moved powered buttons/plates and exactly one item drop |
| Mining, preferred tools, explosions, fire/lava | Existing reviewed `BLOCK_MATERIALS.md` policies retained | Runtime drop/gamerule cases remain pending; approved art/material differences are not silently changed |
| Linked items, inventory/hoppers, recipes, furnace fuel | Existing block placers and recipes retained. Fuel seconds: door 10, trapdoor/fence/gate/plate 15, button 5, both sets | Ordinary item transport applies; native fuel/container and placement contexts require game checks. No new recipes/trade overrides |
| Note blocks and action sounds | All twelve blocks already declare bass instrument `note.bassattack`; existing action sounds retained | Native note-block use over each state, volume/occlusion and action sounds; no missing-component claim |
| Light, rain, spawn surfaces, fall/crawl and trapdoor attachments | Existing per-state dampening, precipitation, support and boxes retained | Counterpart-specific engine checks; ladder continuation described as Java-only is inapplicable to this Bedrock target |
| Harvest/game contexts and multiplayer | No new artificial restriction | Creative/survival/adventure, doTileDrops, chunk borders, several players, saves and dimension unload must be compared; permissions do not follow from source assertions |

These open rows are neither intentional omissions nor claims that the engine can
never support them. The accepted group authorizes fixes when a correct supported
path is established. No speculative globally polled substitutes were added.

## Native comparison checklist

Place vanilla oak beside both Mallorn sets. Press each button on all six mounts;
measure thirty ticks and verify dust/repeaters, powered attachment, spam-click,
break/replacement, unload/re-entry and save/restart while pressed. Fire vanilla
and custom arrows, tridents, and wind-charge bursts at/near each control; record
the unresolved recognition cases rather than assuming they work.

For plates, test a standing player, spectator, item, arrow, small/large mob,
minecart diagonal, feet outside the cell but body intersecting it, flight over the
bottom quarter, short contact and continuous contact. Measure activation/release
ticks and reload while active. Compare observer pulses and nearby sculk sensor
responses for each actual activation/deactivation and door half.

For gates, test both player sides in all four cardinals, manual/powered opening,
wall on either end, wall along the wrong axis, wall placement/removal/explosion,
pistons, moved gates, command edits, reload and unloaded borders. Confirm lowered
art without reducing the 1.5-block barrier or introducing underground collision.
Test wall/nether-brick/pane connection gaps separately from visual lowering.

Check doors beside solid full faces/partial shapes and alongside both same and
perpendicular doors; open both native parts. Test villagers/piglins/zombies and
raid actors using their normal difficulty/navigation behavior without replacing
their definitions. Check fences, gate barriers, attachments, leads, liquids,
support/piston drops, inventory transport, fuel and note blocks with each state.

## Sources and limits

Research order followed existing skills/support/water notes, installed vanilla
reference across versioned packs, target changelogs, then creator docs and Wiki.
Older native block definitions are not exposed as matching JSON in the installed
reference. Installed 1.26.50 wind charge uses `minecraft:explode.toggles_blocks`;
this is native actor evidence, not proof of custom block-state control.

- Minecraft Wiki November 2025 archive, retrieved 2026-10-18: [Wooden Button](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Wooden_Button), [Pressure Plate](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Pressure_Plate), [Door](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Door), [Fence Gate](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Fence_Gate), [Trapdoor](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Trapdoor), [Fence](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Fence), [Wall](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Wall). Canonical Button/Pressure Plate and separate Wooden Pressure Plate requests were unavailable; archive age and edition notes limit exact parity claims.
- Creator [connection rule](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_connection_rule?view=minecraft-bedrock-stable), [tick](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_tick?view=minecraft-bedrock-stable), [Block](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/block?view=minecraft-bedrock-stable), [explode](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_explode?view=minecraft-bedrock-stable); pinned `reference/server-2.8.0.d.ts` confirms `getAABB` center/extent and lacks solid-face/neighbor-change/vibration APIs.
- Official [26.50](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog) and [26.52](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog) checked. The thin-fence/tripwire neighbor-update change for new worlds is not proof that every custom gate/wall interaction was fixed.

Root validation/deployment, 2026-10-18: `mods deploy lothlorien --force --suite
controls --suite wood --suite support --suite suite-layout` passed five independent
runners, localization and shared pack checks. Production: **0 errors, 0 warnings,
15 documented exceptions**; existing optional probe: **0 errors, 1 warning**.
`mods status lothlorien` confirmed all three packs **in sync**. The forced copy
followed a full read-only comparison proving deployment drift came from source
changes during the prior copy, with only six newline-only differences remaining;
the official tool backed up the game BP before reconciling it. See the workspace
[review record](../../../docs/vanilla-interactions-review.md) for evidence/scope.
Reload the world to load these changes; no new world is required. Passing source
tests and deployment do not establish the pending engine behavior above.
