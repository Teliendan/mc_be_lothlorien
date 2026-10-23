# Script performance

Village finishing follow-up, 2026-10-16: [measured offline workload and engine
profiling steps](VILLAGE_POLISH_2026-10-16.md). Decorative village foliage now
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
