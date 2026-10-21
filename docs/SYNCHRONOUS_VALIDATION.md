# Synchronous interaction cleanup and unicorn swimming

Owner-approved2026-10-20; Bedrock1.26.52 / stable Script API2.8.0. Implemented
and verified/deployed; all3 packs confirmed in sync. No new native
gameplay observations. [Workspace review](../../../docs/synchronous-validation-review.md)
records the corrected evidence and actual execution boundaries.

Squirrel acceptance, rope placement and Miruvor completion execute synchronously.
Tests that changed a hand/slot/mode inside pickAway, clone or a world setter did
not demonstrate an intervening player action. The implementation no longer
performs deep immediate snapshots or repeated same-callback eligibility checks
to satisfy those artificial mutations. Ordinary input/game rules and actual
engine failures remain handled.

| Path | Final implementation |
| --- | --- |
| Squirrel acceptance | Check current food/actor/mode/dimension/reach once, then apply existing known-biome/Friend/session/lead/cooldown/healing rules and consume the accepted stack synchronously. Preserve metadata when reducing a stack, last-acorn removal and Creative nonconsumption. Outside/leashed domestication remains; inside wild healing/errands do not add persistence. |
| Squirrel gift | One ongoing-session eligibility decision, actual3D return distance and readable dry drop-space decision precede synchronous native table roll/spawn. No repeated context checks after the roll. Preserve one stack/unchanged table, post-known-delivery cooldown, optional particles/deeds, persistence-failure guard and no speculative fallback. |
| Rope placement | Read the actual inventory slot/stack once, then charge each piece before its world write. A known unchanged air cell after failure permits refund to that slot. Committed/unknown world-write failures do not refund speculatively. Preserve Creative count, stack metadata, both IDs/facings, bounds/support and all separate climbing/effect policies. |
| Miruvor | Native onCompleteUse remains authority. Validate event skin/current cooldown, read the live skin/slot needed for the charge, then effects/sip/cooldown. No immediate full metadata/slot/mode snapshot comparison. Preserve4 sips, Creative progress, completion-only600-tick cooldown, cancellation behavior, effect coexistence and partial-error isolation. |
| White deer | Real yielded gift-spot search still requires original-context validation on return. Stored-spot guidance also validates once at entry. Remove duplicate validOffer calls around the synchronous waypoint query/mutations. Actual job-boundary and ongoing-session checks remain. |

Before-event/system.run interactions, yielded growth jobs, native cover placement
stages and multi-tick animal/effect/climbing services retain their distinct
timing-boundary checks. This batch does not change their accepted-action policy.

Only unicorn swimming from the unfinished Group14 review is implemented:
entities/unicorn.json and the unexecuted make_unicorn.py behavior data now match
newest installed vanilla1.26.50 horse float/buoyancy values. Added float chance0,
underwater passenger dismount2s and bobbing buoyancy1 with gravity disabled,
auto-step from liquid and water/flowing-water/lava/flowing-lava support. This
does not grant water breathing, fire/lava immunity, new stats or art. Existing
air supply and lava damage remain. The art generator was not run; RP unchanged.

The original cleanup/swimming batch left unicorn.js unchanged. A separately
approved follow-up now replaces its hand-dependent owner healing queue with
bonded-only native healable Elanor2HP, retaining owner access and injured-only
use. No late player-context conditions revoke accepted healing. Native mount/
heal acceptance remains open; [NATIVE_ANIMAL_HEALING.md](NATIVE_ANIMAL_HEALING.md)
records current implementation. Remaining Group14 findings are still unfinished.

Verification2026-10-20: selected suites swan-squirrel-interactions, swan-squirrel,
animal-home, deer-interactions, white-deer, performance, decor-rope, rope,
food-remedy, unicorn and suite-layout:14 runners passed. Current dedicated
counts:42 swan/squirrel production scenarios,33 deer,10 medicinal completion,
15 decor/rope plus16 chandelier ingredient combinations. Rewritten tests cover
ordinary initial inputs and named-stack preservation; retained tests cover real
delayed actions, session transitions, partial committed/unknown world writes,
cooldowns/errors and native component data. Production BP/RP0 errors/0 warnings/
15 documented exceptions; optional probe unchanged0 errors/1 warning.

An AST-only check compared the generator's literal components with the pack
and installed native horse; float/buoyant values match without executing art
generation. Native swimming needs unmounted and owner-ridden surface crossings,
bank exit/one-block step, sustained-submersion passenger dismount, and preserved
drowning/lava damage checks. Data equality and passing mocks do not establish
those native outcomes. Existing nontransactional engine-write limits remain.

Root deployment2026-10-20 used the exact11 suite names/14 runners above and
passed with the recorded verifier results. Five BP files copied,0 removed;
RP/probe unchanged. Subsequent mods status confirmed all3 packs in sync at
main@be368ff,240 uncommitted. No worldgen change. Leave/re-enter the world to
load the update. Root reviewed exact production/test/generator scope and
confirmed depth.js, swan.js, swan_rules.js and squirrel gift table hashes
unchanged. Shared evidence correction/current workspace handoff committed
separately as `1de73e8`; no mod commit made.
