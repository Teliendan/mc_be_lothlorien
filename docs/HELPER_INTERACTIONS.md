# Implementation helper interaction audit

Group17, inspected2026-10-21; target Bedrock1.26.52 / Script API2.8.0.
**Source/documentation inspection and owner follow-up2026-10-21.** Owner
approved proposal2 (timeout cleanup). Proposals1/3 were questioned; further
source inspection did not establish a practical retry trigger or native helper
attacks. Owner subsequently accepted withdrawing1 and leaving3 unchanged
pending reproduction: “Good. What is next?” Group17 owner review/approved source
work is complete. This does not establish native parity or an intentional
omission of a demonstrated interaction. No new in-game observations. Proposal2
implementation/validation is recorded below.

## Scope and counterparts

| Helper | Purpose and current lifecycle | Closest native comparison |
| --- | --- | --- |
| `lothlorien:guide_beacon` | Shared white-deer/squirrel waypoint target. Session ends remove it; missing active beacons are recreated. Startup and entity-load/spawn cleanup remove unowned beacons, preserving active registered sessions and explicit debug name/tag exemptions. Native330-second expiry is the final backstop, including debug helpers. | Area-effect cloud for an invisible, noncolliding utility actor only. Its hardcoded native behavior is not a complete data recipe. |
| `lothlorien:elf_post` | Persistent one-shot population location. Loremaster/reserve/home groups classify placement; an unclassified base post defaults to home. Successful and unused posts are removed; failed-spawn posts remain. | NPC as a partial invulnerable actor comparison, not a villager or renewable resident. |
| `lothlorien:loop_marker` | Persistent village discovery/construction trigger. Serial planner loads temporary areas, builds links, populates elves, removes markers and records DONE. Failed village rectangles are suppressed for the rest of the world session. World re-entry or explicit manual planning can retry remaining markers. | Functional structure-work trigger; no matching general-purpose Bedrock marker identified. |
| `lothlorien:rail_mender` | Persistent local fence repair trigger. Serial bounded jobs wait for every scan-box chunk; successful repair removes the marker. Unavailable terrain leaves it for a later entity load. Local edit events repair later changes. | Functional structure-work trigger; no biological counterpart. |
| `lothlorien:phial_light` | Invisible level14 block with persistent, bounded, write-before-placement ownership ledger. Unneeded owned cells are cleaned without replacing foreign blocks or loading chunks. | Native Light block by lighting aspect; established differences and acceptance cases remain in [Group11](PHIAL_INTERACTIONS.md). |

Native cushions used as village furniture are outside this helper inventory.
Java Interaction/Marker actors are not a Bedrock replacement. The accessible
November2025 Interaction Wiki archive explicitly labels that entity Java-only;
Marker and area-cloud Wiki fetches failed and supply no current-engine evidence.

## Common interaction sweep

All four actor definitions have0.1×0.1 collision boxes, no gravity or physics
collision, full knockback resistance, all-cause damage suppression and fire
immunity. The three construction/population actors are persistent. They have
no loot/XP definition, inventory, attacks, breeding, food, taming, riding,
leashable or nameable component. Biological/player-resource interactions are
inapplicable to their implementation role; this is not a missing animal feature.
No custom capture/trade/item-on-helper route was found.

Client definitions use alpha-test material and the shared16×16 texture whose
alpha range is0–0 (file inspection). Each helper model has one zero-size cube;
elf posts reuse the loop-marker geometry. This establishes authored visual
invisibility, not native hit-test or spawn behavior. All are summonable for
tools/script; `is_spawnable:false` disables the authored spawn egg. No authored
natural spawn rules exist. None has a `mob` family; elf-post role families and
the intentional unclassified base are retained from the previous tag audit.
Those declarations alone do not prove exclusion from all engine population
counts, entity obstruction, pressure plates, tripwire, projectile collisions,
fishing, sculk/vibrations, vehicle pickup or portal/transport behavior.

| Interaction | Finding / disposition |
| --- | --- |
| Damage versus attacks | Damage prevention is explicit, but no actor has `minecraft:cannot_be_attacked`. That supported component does not prove an existing attack problem. Default zombie/skeleton/pillager/vindicator filters do not match helper families. Broad targeting exceptions need native evidence; hold3 below. |
| Cursor, melee and projectiles | OPEN native tests. Invisible rendering and `physics.has_collision:false` do not document projectile pass-through or the absence of player hit selection. `custom_hit_test` documents hitbox lists but not an empty-list disabling recipe; do not invent one. |
| Physical obstruction / native triggers | OPEN native player/mob movement, building/spawning through the actor, plates/tripwire, vehicles, projectiles and vibrations. Verify these separately from damage immunity. No broad script cancellation workaround proposed. |
| Despawn / save / reload | Keep temporary beacon expiry and ownership cleanup; keep persistent unfinished village work. Verify save/reload, chunk unload/reload and stale helpers in game. Blanket expiry of work markers would discard unfinished construction/population. |
| Natural spawning / counts | No authored natural spawn route; cap and obstruction effects remain engine checks. `inanimate` is classification, not a universal engine exemption. |
| Death / drops / consumption | No authored biological death loot/XP, drops, equipment or item consumption. Native command removal is useful for development; no global kill protection proposed. |
| Phial light | Group11 already approves its air-only placement, replaceability, water break, popped piston policy and empty loot. Ownership cleanup is bounded and respects foreign replacements/unloaded cells. Keep those choices; native support/fluid/ecology/observer checks remain OPEN. |

## Reviewed proposals and current disposition

### 1. Failed elf placement retry — recommendation withdrawn pending a real trigger

**Confirmed source gap, conditional trigger:** `elf_village.js` retains a post
when `spawnEntity` throws and comments that a later run will retry. However,
`loop_marker.js` ignores the returned failed count, removes the loop markers and
records DONE after construction. No elf-post load handler or separate population
retry consumes the surviving post. Re-entering the world does not provide that
missing population route. The existing script-glue failure fixture verifies the
retained post; it does not establish a real engine failure or successful retry.

Owner asked what would differ on a later attempt. `spawnEntity` can throw for
unloaded chunks, invalid arguments/entity and out-of-bounds locations, plus
generic EntitySpawnError. Reloading can change an unloaded-chunk condition in
general; however, this planner already holds discovered village chunks loaded
while populating. Bad ids/locations are not fixed by waiting. No specific
transient spawn failure under these planner conditions was established, and
the existing injected error fixture is not engine evidence. The retained-post
comment is optimistic; that alone does not justify a new retry service.

Withdraw the proposed automatic population retry until a real recoverable
failure is identified. Existing failure reporting/posts and nonrenewable elves
remain unchanged. This does not prove spawning can never fail.

### 2. Planner timeout cleanup — owner approved and implemented

**Source gap with undocumented native outcome:** the600-tick `Promise.race`
timeout can stop awaiting `createTickingArea`; it does not cancel that Promise.
Before the fix, the planner removed tracked ids in `finally`, then forgot them
even if removal threw. No completion handler cleaned an area whose creation
finished after that cleanup. API2.8.0 exposes no cancellation argument and does not
document whether removing a pending area cancels creation internally. Therefore
an actual native ticking-area leak is **not established**.

Implemented in `loop_marker.js`: unique id per planner attempt, pending-area
ownership records, normal `finally` removal and a completion handler that
cleans an area if its attempt already ended. A completed removal only drops the
record once creation settles; missing areas are tolerated. Removal failures
are logged, and a later pending completion attempts cleanup again. Persistent
removal failure is reported rather than claimed recovered. A late completion
cannot remove a newer attempt's distinct area. No manager-wide removal,
polling or permanent chunk forcing. Serial planning, quota rules and session
backoff remain; retry wording now specifies world re-entry/manual override.

### 3. Native attack restriction — unproven need, no change recommended yet

The initial proposal was `minecraft:cannot_be_attacked:{}` on all four actor
types, covering every elf-post role and its base. The official component
blocks entity attacks except attackers with `ignore_cannot_be_attacked` and is
supported from format1.21.50; helpers use1.26.50. Installed vanilla ghast uses
it. No installed vanilla `ignore_cannot_be_attacked` consumer was found.

Owner asked whether monsters actually attack helpers. No such observation or
native reproduction exists. The newest installed default zombie, skeleton,
pillager and vindicator target filters require families the helpers do not
have. Their retaliation goals do not establish a route from passive helpers.
Zoglin and Johnny-vindicator filters are broader and do not explicitly exclude
all helpers, but a matching filter does not establish that native attackability
accepts these healthless actors. No actual attack or distraction is proven.

Hold this proposal until an engine test demonstrates a problem; availability
of a protective component alone does not make its absence a defect. Keep
current families, damage suppression, physics and rendering. Native attack/
projectile acceptance remains OPEN rather than declared fixed or irrelevant.

### Retain existing policies

Beacon ownership/load cleanup and native expiry already address temporary
orphans. Rail markers already retain unavailable work and serialize repair.
Do not impose blanket TTLs, add global sweeps, turn helpers into mobs or replace
the approved Phial ownership service. Native26.50 saved-world connection
upgrade fixes do not establish that custom structure fence-connection repair
or its accepted connection rules are redundant. The loop planner's deliberate
same-session backoff is not a new failure merely because it delays retries.

## Evidence, sources and validation

Read shared modding/mob/scripting/block/lookup guidance, research order, tag and
performance audits, helper definitions/models, runtime callers, village
assignment/planner/rail rules and existing feature tests before external research.
Installed newest available vanilla utility actors, NPC, ghast and custom-hit-test
consumers were compared across the versioned reference; legacy utility JSON
versions are not claimed to prove current hardcoded behavior.

Sources retrieved2026-10-21, after installed reference review:

- [26.50 official changelog](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound) and [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog): checked before calling anything an engine bug. Neither establishes the conditional script recovery paths above as fixed native defects.
- [Official cannot_be_attacked](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_cannot_be_attacked?view=minecraft-bedrock-stable): supported attack restriction, exception and minimum format.
- [Official physics](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_physics?view=minecraft-bedrock-stable) and [custom_hit_test](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_custom_hit_test?view=minecraft-bedrock-stable): separate physical/hit-test declarations; no universal invisible-helper recipe.
- [Official TickingAreaManager](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/tickingareamanager?view=minecraft-bedrock-stable) and pinned `reference/server-2.8.0.d.ts`: temporary pack-owned areas, asynchronous creation and specific-id removal; pending-create cancellation semantics unspecified.
- [Official Dimension.spawnEntity](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable#spawnentity) and pinned2.8.0 declaration: documented errors; no specific recoverable failure in the loaded village established.
- [Official nearest_attackable_target](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitygoals/minecraftbehavior_nearest_attackable_target?view=minecraft-bedrock-stable): filtered target selection. Installed newest zombie/skeleton/pillager/vindicator/zoglin/wither definitions supply the concrete filters; broad filter matching is not a native healthless-target reproduction.
- [Interaction, November2025 Wiki archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Interaction): Java-only comparator; not a Bedrock implementation option.
- [Light (block), same archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Light_%28block%29): conceptual invisible-light comparison. Archive age and edition mixing prevent current Bedrock guarantees; Group11 already records movable/waterloggable native differences.

Baseline2026-10-21: `mods verify lothlorien` selecting `script-glue`,
`rail-mender`, `village-residents`, `performance`, `white-deer`, `swan-squirrel`
and `phial` passed **all8 runners**; localization passed. Production packs:
**0 errors /0 warnings /15 documented exceptions**. Optional probe:
**0 errors /1 unchanged warning**. No new synthetic runtime probe was needed;
existing failure fixtures are conditional code-path evidence only. Documentation
changes required no deployment at inspection. Subsequent approved proposal2
changes only the planner runtime; no worldgen changes.

Four added script-glue scenarios cover already-registered pending creation,
registration after timeout overlapping a manual retry, late rejection, and
reported removal failure followed by completion cleanup. They model possible
asynchronous API orderings, not observed native cancellation behavior. Existing
successful automatic/manual planning and quota/backoff scenarios still apply.

Final follow-up validation2026-10-21: `script-glue`, `village-planner` and
`performance` **3 runners passed**, localization passed; production **0 errors /
0 warnings /15 documented exceptions**, optional probe **0 errors /1 unchanged
warning**. An old exact-source-text cleanup assertion failed after the Map
change; removed that brittle assertion in favor of the runtime cleanup tests.
No pure planner logic changed. Deploy repeated `script-glue`/`performance`
(**2 runners passed**) and copied **1 BP file,0 removed**. RP/probe unchanged;
subsequent status confirmed all3 packs **in sync**. Leave/re-enter to reload;
no new world required. No new engine observations or mod commit.
Shared follow-up knowledge/deployment record: workspace commit `9d3cdb7`
(`Record helper review clarification and approved timeout cleanup`).
