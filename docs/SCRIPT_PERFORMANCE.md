# Script performance

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
tests/run.mjs. [Workspace handover](../../../docs/script-performance-progress.md)
records current validation/deployment status and remaining acceptance.

Implementation commit: `Reduce idle support and wildlife script work`.
