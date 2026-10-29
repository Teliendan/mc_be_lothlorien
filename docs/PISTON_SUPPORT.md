# Lothlorien support motion

Accepted rollout: 2026-10-09, Bedrock 1.26.52 / stable server API 2.8.0.
Implementation commit: `Implement piston support survival and retire diagnostic probes`.
Verified probe source and engine results are archived in commit `852dc3b`;
the temporary blocks, commands, translations and experiment notes are retired.

All 23 supported production definitions use native `popped`: antlers, four lamps,
both wood sets' buttons/plates/doors, six soil plants/sprouts, Western corn,
both segmented covers, nectar blooms and both rope definitions. A stationary
attachment also breaks when its original support departs, even if valid support
replaces it. Existing named support lists and generic mounting eligibility remain
unchanged; other construction blocks retain their native movement policy.

`support_motion_service.js` keeps a local reverse support index and preserves
original relationships across tick-before-event ordering. Piston jobs capture
actual departure evidence, settle after at least ten samples and a stationary
piston, and release after forty samples. Unknown/moving cells retain history;
timeout witnesses reconcile on the next stable observation. Local generations prevent
duplicate drops after native destruction or fresh same-ID placement. Ordinary
edits reset history; unrelated attachments retain their random-tick recovery.

Covers use amount-conditioned native loot for all 1-4 segments. Each rope variant
uses the canonical rope item; whole-column teardown excludes a piece already
popped by the engine. Doors use native multiblock partner destruction and loot.
Lamp, nectar and heartwood generators automatically apply `configure_support.py`.
Use `tools/generate_ground_cover.py` for covers; other named generators write art
only. The configuration pass also maintains support policies and segment loot.

Validation: full verifier and regression suite pass; focused motion tests cover
ordering, replacement, concurrency, unknowns, timeout recovery and lifecycle.
Real-script rope tests cover both variants in survival, creative, explosion and
support teardown. The underlying owner engine probe passed 18/18; production
loot/rendering, doors, rapid motion, chunk reloads and scale remain game checks.
Cache capacity is 16,384 records; piston events also discover cold attachments locally.

**Performance correction (2026-10-11, Bedrock 1.26.52 / API 2.8.0).** The owner
reported half-speed game time in the forest. Removed support's looping [2,2]
timer from 21 definitions and its `onTick` handler from all 23 support definitions;
the two pressure plates retain only their independent [4,4] occupancy timer.
Placement, player edits, explosions and local piston jobs handle ordinary support
changes. Piston discovery accepts previously untracked attachments beside moving
supports and expansion heads, deferring destruction until settlement. Ordinary
edits discover cold immediate neighbours without walking the forest. Native
`onRandomTick` supplies sparse eventual recovery for commands, reloads and timed-out
jobs. It has no fixed deadline and stops when random ticks are disabled.

Owner follow-up, 2026-10-11: the piston-support performance correction alone
removed the reported lag in game. Qualitative confirmation for the owner's
world, without numeric FPS/TPS or a profiler trace; it does not establish every
loot/motion edge case or the benefit of later creature/rope optimizations.
Reusable principle: avoid permanent fast support checks per generated block;
use native survival plus bounded event-local work and the cheapest correct
fallback. Workspace .claude/skills/bedrock-scripting/references/performance.md records the full lesson.

Offline regressions cover cold moving/identical replacements, six attachment
sides at a new head, remote attached positions, a stationary-body guard, deferred
native popping and the real cold player-break adapter. Specific engine timing
and cold native rope popping still need their own game checks.
No algorithm can reconstruct a support change completed before its first
observation when no motion evidence remains. The former
`/scriptevent lothlorien:tps` probe (game speed, fallback callbacks per second, `off` to pause the fallback) was removed on 2026-10-29.
