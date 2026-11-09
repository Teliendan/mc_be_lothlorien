# Script performance

## Engine-load audit, 2026-11-10 (static analysis of commit `46ba960`; nothing changed, nothing measured in game)

Tester: 0.8.3 DIAG loads and reports no freeze, but freezes continue (short and longer, every few minutes, also
standing still, a bit more inside the forest, with other add-ons too, not in vanilla). So what is left is below the
monitor's 700 ms server-tick threshold or on the client (rendering), which no script timer can see. Script CPU is not
the problem: about 20 light timer callbacks per second per player, every one bounded. Candidates are what the pack
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

Checked and fine: music is streamed; all block and item textures are 16 px (atlas not enlarged); block models have
1-5 cubes for flora; worldgen rules are biome-gated; leaves have no tick; entities have
`conditional_bandwidth_optimization`; no dynamic-property write on a timer.

Owner decisions (2026-11-10): no thinning of the ambient creatures; dew waits for numbers (a plain radius would leave
ground ahead of a walking player without dew, because dew builds up over minutes; the candidate fix is a fixed daily
pattern revealed near players); try the leaf render method (`TECHNICAL_NOTES.md` "Mallorn leaf flicker", deployed,
owner's look pending). Action bar left as it is: vanilla `hud_screen.json` fades it with a 3 s `in_expo` alpha
animation and no separate hold time, so a 2 s resend could show a dip; only an in-game measurement would justify it.

0.8.4 DIAG (2026-11-10, rebuilt from commit `c38aa3e`: leaf flicker fix included; the skin pack is added by `git archive <commit> lothlorien_skins` into `out/` before `package.py`): tick gaps counted from 150 / 300 / 700 ms,
an immediate chat line per gap (at most 5 a minute) and **a chat summary every minute** (longest gap, gap counts,
script ms, dew flips, spawned / removed, entities within 64 blocks, time of day). A freeze the tester sees in a minute
whose summary shows no long gap was client-side. Build as before with `0.8.4`; tester steps `NAVOD.txt`. Control
add-on for a new vanilla world (`temp/lothlorien-diag/control/`, `control-addon-DIAG.mcpack`, steps
`NAVOD-control.txt`): the same monitor and nothing else, to show the tablet's cost of any script add-on. Offline load
tests pass; neither is game-tested. The release version must now exceed 0.8.4.

Tester freezes (tablet), 2026-11-07/08. Diagnostic builds (every pack callback timed per file, leaf decay off;
build scripts in `temp/lothlorien-diag/`, not in git). 0.8.1 DIAG: one **3.5 s freeze with 0 ms of Lothlorien
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
chat line: `node temp/lothlorien-diag/make_diag.mjs 0.8.3 <commit>`, then `python -B temp/lothlorien-diag/package.py 0.8.3`
(workspace root; Czech tester steps in `temp/lothlorien-diag/NAVOD.txt`).

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

Wariness tracks the five loaded wildlife types via spawn/load/remove/death events,
with one initial reconciliation across three dimensions. The two-second timer
exists only while relevant wildlife is tracked. It reads loaded entity/player
positions instead of issuing five native entity queries per player every cycle.
The original 40-block 3D watch range, horizontal severity rule, alarm and guide
handling remain. Wariness deliberately works outside Lothlorien for transported
or tamed mobs too. Movement/pathfinding stays native JSON.

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
wasm; absolute times in game differ). Not done: native filtered scans for
full-area layers, smaller discovery areas, fence repair limited to changed cells
(owner: the mender must also repair jigsaw seams).
