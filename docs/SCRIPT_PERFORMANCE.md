# Script performance

## Engine-load audit, 2026-11-10 (static analysis of commit `46ba960`; nothing changed, nothing measured in game)

Tester: 0.8.3 DIAG loads and reports no freeze, but freezes continue (short and longer, every few minutes, also
standing still, a bit more inside the forest, with other add-ons too, not in vanilla). So what is left is below the
monitor's 700 ms server-tick threshold or on the client (rendering), which no script timer can see. Script CPU is not
the problem: about 20 light timer callbacks per second per player (timers only; random-tick callbacks are counted below), every one bounded. Candidates are what the pack
makes the **engine** do. Ranked by expected effect; all open until tried on the tablet:

1. **Morning dew = mass block updates.** `lothlorien:dew_cover` random ticks flip the `dew` state on leaf litter and
   blossoms in every ticking forest chunk (90 litter tries per tree, 5 trees per chunk). Each flip is a block update:
   the client rebuilds that sub-chunk mesh and the chunk is saved again. Estimate: a few updates per second around the
   player for the 200 s dawn window, then a long drying tail; every forest chunk in simulation range becomes dirty
   once a day. Vanilla forests have almost no idle block updates. Fix without visible loss: form dew only on covers
   near a player (it cannot be seen or collected from far away).
2. **Leaves draw every inner face, double-sided.** `alpha_test_to_opaque` has no backface culling and custom blocks
   do not cull leaf-to-leaf faces: in the six big tree structures 75,272 leaf faces are meshed for 20,630 exposed
   ones (3.6x), each visible from both sides. This is also the cause of the known flicker (coplanar faces of touching
   leaves). Untried: `alpha_test_single_sided_to_opaque` (backface culling: the two coplanar faces can no longer
   fight, and the GPU fills half as much). Owner must judge the look.
3. **Ambient creature budget.** Density limits allow 10 butterflies + 10 songbirds + 6 fireflies + 8 deer +
   6 squirrels + 4 wardens + 3 swans near one player, on top of vanilla animals; 26 of them are flying pathfinders
   (per entity the same settings as vanilla bee/parrot, but vanilla rarely has that many). All despawn by distance,
   so herds are replaced continually. Trade-off route: lower the three flier limits.
4. Small: the Harmony action bar is re-sent every second although it rarely changes; pressure plates poll at 4 ticks.

Entity events (2026-11-11, finding LV-09; structure, not measured). `entityLoad` and `entitySpawn` take no native filter,
so each subscriber used to run on every entity and test its type. All 15 subscriptions now go through one router
(`entity_events.js`, rules in `entity_events_rules.js`): one subscription per event, one `typeId` read per event, then a
lookup by type. The CPU saving is unmeasured and probably small; the owner chose it for structure (a new type-specific
handler is one more route, not one more subscription). Handlers are isolated, so one that throws does not stop the next.

Random-tick component callbacks (added 2026-11-11, finding LW-06; counts are estimates from the formula, not measured).
The script is also called on every random tick of: a cover (`lothlorien:dew_cover`, `dew.js`), corn (`lothlorien:crop`,
`crop.js`), a sapling (`trees.js`), a Great Mallorn sprout (`great_mallorn.js`), a nectar bloom (`nectar.js`), a fence
gate (`lothlorien:gate_wall`, `blocks.js`), a decaying Mallorn leaf (`lothlorien:leaf_decaying`, `trees.js`; only the
two decay permutations, short-lived) and each of the 13 definitions that still carry `lothlorien:motion_support`.
Calls per second = blocks of that kind in ticking range / mean random-tick interval of one block. LW-02 estimate: the
10 list-filtered definitions (flowers, ferns, saplings, corn, leaf carpet, blossoms, nectar bloom) on
`lothlorien:motion_support` cost about 240 callbacks per second per player before (estimate); they now use
`lothlorien:motion_support_native` with no random tick, so none after (`PISTON_SUPPORT.md`). The next DIAG build should
report callbacks per minute per component id, so these estimates can be replaced by numbers.

Checked and fine: music is streamed; all block and item textures are 16 px (atlas not enlarged); block models have
1-5 cubes for flora; worldgen rules are biome-gated; leaves have no tick; entities have
`conditional_bandwidth_optimization`; no dynamic-property write on a timer, except the Phial ledger: at most one write per
5-tick pass while its holder changes cell.

Owner decisions (2026-11-10): no thinning of the ambient creatures; dew waits for numbers (a plain radius would leave
ground ahead of a walking player without dew, because dew builds up over minutes; the candidate fix is a fixed daily
pattern revealed near players); try the leaf render method (`TECHNICAL_NOTES.md` "Mallorn leaf flicker", deployed,
owner's look pending). Action bar left as it is: vanilla `hud_screen.json` fades it with a 3 s `in_expo` alpha
animation and no separate hold time, so a 2 s resend could show a dip; only an in-game measurement would justify it.

**How to build a DIAG build** (any commit; tooling in `tools/diag/`, output in scratch `temp/lothlorien-diag/`): `.\mods diag lothlorien <version> [--commit REV] [--deploy]`. It archives the commit (default HEAD, refused when the tree is dirty), wraps every script with `diag_wrap.js`, loads the result against the mock server (must print `ASSERTS OK`), writes `temp/lothlorien-diag/lothlorien-<version>-DIAG.mcaddon` and with `--deploy` copies it into the development packs. The version must exceed the installed one (same UUIDs); the release version must exceed every DIAG version. The raw verifier on `out/` shows exception-evidence path errors: expected.

0.8.4 DIAG (2026-11-10, rebuilt from commit `c38aa3e`: leaf flicker fix included): tick gaps counted from 150 / 300 / 700 ms,
an immediate chat line per gap (at most 5 a minute) and **a chat summary every minute** (longest gap, gap counts,
script ms, dew flips, spawned / removed, entities within 64 blocks, time of day). A freeze the tester sees in a minute
whose summary shows no long gap was client-side. Czech tester steps (scratch). Control
add-on for a new vanilla world (a separate scratch pack, not in git; Czech tester steps): the same monitor and nothing else, to show the tablet's cost of any script add-on. Offline load
tests pass; neither is game-tested.

0.8.5 DIAG (2026-11-17, commit `1c9ca1a`): the same monitor over the whole 2026-11-11/12 audit work, for the owner's combined game check (also the LM-11 spawn/removal counts). Mock load test passes. The 0.8.6 build below supersedes it as the threshold.

0.8.6 DIAG (2026-11-17, commit `6d2247e`): the same monitor over the owner-fix round (re-tests R1-R15 and LM-11 counts). Mock load test passes. Superseded as the threshold by 0.8.7.

0.8.7 DIAG (2026-11-21, commit `791c323`): adds the village shield clear to the 0.8.6 round (re-test R16: `clear` debug line, stutter on PC and tablet). Mock load test passes. Deployed into the development packs (no .mcaddon import; commits keep it, a plain `.\mods deploy lothlorien` restores). **The release version must now exceed 0.8.7.**

0.8.4 DIAG results (tester's tablet, six photos sent 2026-11-10, no notes from her; analysed 2026-11-11). Both
builds load in game. She ran the Control pack **in the same world as Lothlorien**, so there is still no vanilla
baseline; the two monitors agree on every gap (540/540, 381/336, 350/350 ms), which confirms the monitor itself.
Two runs, each in a new world (day 0, time starting near 0), Lothlorien close to spawn (272, 64, 112).

| Minute | Where | Longest gap ms | Gaps >=150/300/700 | Script ms/min | Dew flips | Spawned/removed | Ents <64 |
|---|---|---|---|---|---|---|---|
| run 1, min 1 | plains by the forest | 540 (engine: 1 ms of scripts) | 4 / 2 / 0 | 1017 | 4 | 13 / 7 | 7 |
| run 1, min 2 | entering the forest | 336-381 (**scripts 332 ms**) | 1 / 1 / 0 | 1598 | 26 | 20 / 21 | 11 |
| run 1, min 3 | village deck, elves | 63-65 | 0 / 0 / 0 | 1559 | 14 | 12 / 14 | 9 |
| run 2, min 3 | forest floor, harvesting | 350 (cause not photographed) | 1 / 1 / 0 | 1725 | 1 | 41 / 42 | 10 |

- No server tick of 700 ms or more in the four minutes seen. The 540 ms in minute 1 of a new world is chunk
  generation (engine).
- The script gap: slowest single call `harmony_game runInterval(20)` 331 ms, in a tick of 5 calls. She stood inside the
  biome (the Guest status was on the action bar), so that callback did only a biome read, tag reads and an action bar
  write: nothing that costs 300 ms. Most likely a garbage-collection pause (QuickJS collects when allocation passes a
  threshold, and the callback that crosses it pays for scanning the whole live heap) or the engine pausing inside a
  native call. Not proven. GC time grows with the number of live script objects, so long-lived per-cell maps and caches
  are the lever, not this callback's own work. Next DIAG: an empty 1-tick "canary" callback; if it ever takes 100+ ms,
  the pause is GC or engine, not the callback it lands in.
- Script time: 1.0-1.7 s per minute including the DIAG wrapper, about 1.4 ms per 50 ms tick on average. Not a load.
- Dew (item 1 above): at most 26 flips a minute, but only the second half of the dew window of a new world was seen
  (time 1051-3587; the window is 23000-3000 and a new world starts at 0). A full dawn after a night is still unmeasured.
- Spawn churn (review LM-11): 41 / 42 in a minute with ten entities nearby while harvesting, but `entitySpawn` also
  counts dropped items and the chat line shows no types; the content log line lists the top spawned types.
- Harmony icons (``, Guest) render in the action bar on the tablet, before the Czech label, on a bright scene.
- Still missing from the tester: whether she felt freezes in these minutes, render and simulation distance, tablet
  model, the leaf-fall check, a dawn after a night, content log photos, and the Control pack alone in a vanilla world.

Tester freezes (tablet), 2026-11-07/08. Diagnostic builds (every pack callback timed per file, leaf decay off;
build scripts are scratch, not in git). 0.8.1 DIAG: one **3.5 s freeze with 0 ms of Lothlorien
scripts**. 0.8.2 DIAG (photos 2026-11-08): four reported freezes, two in the engine (1.5 s at night over the ocean
outside the forest, 1 ms of scripts; 0.9 s, 30 ms) and **two in our scripts** (0.8 s with 793 ms and 1.1 s with
1384 ms, both standing in Lothlorien). So "our scripts are ruled out" (written after 0.8.1) was wrong; which callback
it was is still unknown, because the chat line showed only the total (the next DIAG names the slowest call). The
village planner is ruled out (it runs once per newly found village). The tester says most short freezes leave no
chat line: the monitor sees only server ticks of 700 ms or more, and a client frame stall does not stop server ticks,
so those are probably rendering or UI hitches (a new item in the inventory, an item breaking, running and jumping;
she sees them with other add-ons too). With leaf decay off the freezes got shorter and the game "playable".

Changes for the next release (2026-11-08): leaf decay is event-driven, with no random tick and no memo on leaves
(`TECHNICAL_NOTES.md`); support random ticks keep no records (`PISTON_SUPPORT.md`). Measured in QuickJS (wasm on
a PC; relative numbers): a support record cost ~1.7 KB (about 27 MB at the 16,384 cap), a random tick 25 us against
10 us stateless, and the old leaf memo 11 MB per 100k leaves; the longest call including garbage collection was
12 ms, so neither cache explains a second-long freeze by itself. Retest with the next DIAG build.
0.8.3 DIAG (2026-11-08) is built from commit `d8797c8` with leaf decay on and the slowest single call in the
chat line: built by a scratch script that copies the pack at that commit, adds the timing wrapper and packages it
(not kept; Czech tester steps were separate).

The 0.8.1 DIAG
run showed Mallorn trees without green leaves in a new world. Cause (owner's log, 2026-11-08): the DIAG wrapper
was a Proxy over the native `world`; in the game `world.afterEvents` is read-only and non-configurable, so
returning a wrapped signal broke the Proxy invariant and threw at the first `world.afterEvents` read
(`blocks.js:213`). Loading stopped, later custom components were never registered, and those blocks
(leaves, flowers, litter, doors, items with components) became unknown. The release build is not affected.
Fixed in 0.8.2 DIAG (wrappers proxy their own empty object; the load test models read-only properties with
`STRICT_NATIVE=1`; the start message reports registered/expected components). This also means the owner's
freezes in that build (36 s at spawn 0.8 min after load, 2 s while flying) happened with almost no
Lothlorien script running.

Village finishing follow-up, 2026-10-16: [measured offline workload and engine
profiling steps](VILLAGES.md). Decorative village foliage now
skips decay BFS, debug-only depth caching skips non-debug players, hidden lighting
counts real emitters, and fence repair remains finite/event-local. TPS diagnostics
also log p95/p99 tick gaps and counts above 100 ms. No lower-end FPS claim yet.
Owner's two 30-second in-game runs (2026-10-16): both 20.0 TPS / 100%, longest
gaps 80/64 ms, p95 63/63 ms, p99 65/64 ms, no gaps above 100 ms. Owner accepts
this cadence check and keeps the diagnostic for future suspected lag. Full
measurements and their scope are in the linked finishing report.

2026-10-11, Bedrock 1.26.52 / server 2.8.0. Source and offline regression evidence;
the new scheduling is not yet verified or profiled in game.

Wariness (superseded by LM-01, 2026-11-12): the two-second timer, the tracked set and the entityRemove subscription are gone.
Each animal judges every player natively by the player's Harmony band tag (`state_wild`, `tools/wildlife_wariness.py`), so
there is no recurring script work for wildlife and nothing that scales with the animal count. `deer.js` keeps one startup
scan over the two guiding types (six queries), an `entityLoad` handler for them (releases an orphaned guide), and one
`getEntities` query around a hurt or killed animal for the alarm. The cost moved to the native avoid goal: twelve filtered
entries per animal, evaluated by the engine; not yet measured in game. Wariness still works outside Lothlorien.
Movement/pathfinding stays native JSON.

White-deer guidance (5 ticks) and squirrel errands (10 ticks) run only during
active sessions. Beacon cleanup uses one startup reconciliation plus spawn/load
events deferred one tick for ownership registration. Squirrel helpers and tagged
or named development helpers are preserved; late-loaded orphans are removed.
Swans and unicorn taming already use events and finite deferred callbacks.

Rope keeps its verified levitation/crouch/brake model, applied every tick only to
active climbers. A small player entry probe runs every four ticks: at most 10 block
reads/player/second away from rope, previously 40. Entry can take up to 0.2 s;
brief contact between probes can be missed. Exit/unload/disconnect stops fast work
and cleans effects when the player remains accessible. Test falling/jumping into
rope and multiple climbers in game.

Pressure plates retain their four-tick local occupancy query. They have no
collider and stable API has no reliable pass-through enter/leave event. A sleeping
plate cannot detect the first arriving entity without a wakeup source. Adding
colliders or helper entities, or scanning all entities globally, is not justified
by a measured gain. Items, mobs, multiple occupants and chunk reload must work.

Regression: tests/script_performance.mjs exercises production lifecycle code,
including duplicate load, invalid handles, multiple players/sessions, beacon
ownership races, unload/reload and rope cleanup. Shared verification runs it via
tests/run.mjs. [Workspace handover](../../../.claude/skills/bedrock-scripting/references/performance.md)
records current validation/deployment status and remaining acceptance.

Implementation commit: `Reduce idle support and wildlife script work`.

M3 shops (`Implement M3 elven shops and request trade flow`, 2026-10-11): one
native elf query within six blocks per player every ten ticks, including away
from villages. Band/rank reads are lazy when no trader is found. Nearby elves
are deduplicated across players; each has one property read and no swap event
unless its chosen key changes. Pins/passes are bounded and cleaned on expiry or
leave. Mock tests assert query cadence and no repeat events for unchanged tables;
this is callback/work-count evidence, not an in-game CPU measurement.

M4 healers (`Implement M4 healer blessings for elves and Friends`, 2026-10-11):
spawn/load/profession events maintain a healer index with one startup reconciliation
(one civilian-elf query in each dimension). A single 20-tick timer runs only while
healers are loaded, with two radius-eight native patient queries per healer per
check. Players are read once per pulse; Harmony is lazy and cached only within
that pulse, so a band change takes effect at the next check. Only injured,
in-range patients needing regeneration incur sight rays/effect writes. No
per-tick timer, recurring whole-dimension discovery, persistent helper or forced
chunk loading. Mock tests cover duplicate registration, death before deferred
discovery, unload/reload, invalid handles and empty-world sleep; engine cost
and visuals were not individually reported. Owner accepted M4 overall on
2026-10-11 (bc1da69); this is not a measured performance result.

Village planner memory (2026-10-27): the owner saw `[Watchdog] High memory usage
detected` (warning at 100 MB of script memory for all packs together; limit
250 MB shuts the world down) while a fresh village was planned. The cause was the
block-read memo in `boundedReader`, one `Map` entry per cell read: about 210k
reads on average and 370k at most per village (simulator seeds 1-20, 300-chunk
quota), estimated 30-65 MB on 64-bit QuickJS. Fixes: the memo is now a name
palette plus one `Uint16Array(256)` per 16x16 slice and height; the planner
releases the memo and the overlay after the write loop; the per-warden and
per-mender log lines show only in village debug mode. Measured offline in QuickJS
(quickjs-emscripten 0.31, the planner as shipped, seeds 1-20, harness in the
2026-10-27 scratch): reads and written cells identical (209,681 / 6,569 average),
live allocations after planning 466k -> 61k average, peak 838k -> 124k,
32-bit heap growth 16/32 MB -> none measurable. In-game check open: plan a fresh
village and confirm the warning no longer appears. Long steps (same day): timing every planner step in QuickJS showed single steps
of up to ~1.1 s, almost all in the bridge light greedy (`planLights`) and the
plaza lanterns (`plazaLanterns`): every candidate's light reach was searched
again for every light, with "x,y,z" string keys. The reach is now found once per
candidate and both use numeric grid indexes; `findMerges` yields every column.
Measured (seeds 1-20, same harness): identical writes (hash) 20/20, longest step
average 667 -> 126 ms, worst 1135 -> 273 ms, whole plan 5.2 -> 3.7 s (QuickJS in
wasm; absolute times in game differ). The four full-layer scans of the planner
(`findMerges`, rope, trunk and unused-exit scans) now ask `Dimension.getBlocks`
with an `includeTypes` filter on a one-block-high volume, in tiles of at most
64 x 64 with a job yield between tiles (`layerCells` in `village_geom.js`;
`boundedReader` takes the query as an optional third argument, and a plain
reader keeps the per-cell loop). Offline, 100 simulated villages: identical
writes (hash) with and without the query, distinct reads 218 k -> 61 k per
village (179 k with the per-cell loop); not measured in game, and
there is no fallback if the query throws (the run ends in the "gave up" path).
The three runtime light greedies (`planLights`, `plazaLanterns`, `mergeLanterns`) now
share one `lightGreedy` in `village_loop.js` (numeric reach once per candidate);
`mergeLanterns` was the last copy with string keys. Offline: identical writes (hash)
for 100 villages, 1,972 bridge spans, 204 plazas and 312 merge layouts.
Not done: smaller discovery areas, fence repair limited to changed cells
(owner: the mender must also repair jigsaw seams).

Village shield clear (2026-11-21, not measured in game). The last step of the village build replaces every `light_block_0` of the village rect with
air (`village_clear.js`, `clearShield` in `loop_marker.js`): one native `Dimension.fillBlocks` per chunk column and Y slice (at most 16 x 16 x 64 cells), a job
yield after each call (`sliced`, 2 ms steps), over the marker decks' Y range minus 4 / plus 16. Simulated villages hold about 7,900 shield cells (4,900 to 11,400)
and the rect gives 108 to 210 calls over 21 to 37 layers, so a call touches at most about 9,500 cells. The cost per call, the changed-block and light updates it
causes, and the total wall time are unknown; the village `clear` debug line (`docs/TESTING.md`) records them for the first in-game village. It runs once per village,
inside the existing ticking areas, so it adds no steady load.

Inside-the-forest yes/no checks (the squirrel errand every 10 ticks, the acorn feeding of squirrel and white deer) use `isInside` in `depth.js`
(`insideAt` in `main.js`): one biome read at the centre instead of the 83-probe estimate; only a river centre falls back to the full
estimate. Natural-spawn rolls still use `depthAt` (they need the level). Offline: `isInside` agrees with `estimateDepth(...).level > 0` on every
fixture of `tests/biome_depth.mjs`. Not timed in game.

Small trims (2026-11-11, finding LM-10, structure; not timed). The Harmony band tags are written when the band changes and checked once per
join, not twice per player per second. The Renown Harmony nudge listens to `onHarmonyChange` (`harmony_game.js`) instead of a 40-tick poll over
all players; taking the lesson and joining record its baseline. The healer pulse tests only `isValid` of a tracked healer (variant and health
are read when it is tracked). `use_guard.js` and the trade sessions forget a player who left.
