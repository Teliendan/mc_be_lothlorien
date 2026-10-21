# Lights, mounted decorations, ropes and linked firefly bottles

2026-10-19; Bedrock1.26.52 / stable server API2.8.0. **Group9 approved and
implemented; source/offline verification only.** The owner accepted the grouped
fixes and requested one antler plus four silver/gold lanterns for the chandelier.
Keep new engine acceptance separate from earlier model, climbing-speed and
support-performance acceptance. Root deployed2026-10-19; all three packs are in sync.

Evidence correction2026-10-20: rope placement is synchronous. Mid-write hand
changes injected by mocks do not establish player races; repeated same-callback
hand snapshots are removed by the owner-approved cleanup in the
[guard review](../../../docs/synchronous-validation-review.md). Keep genuine
partial-write accounting and the separate deferred firefly/cover interactions.
Current source/test result: [SYNCHRONOUS_VALIDATION.md](SYNCHRONOUS_VALIDATION.md);
deployed2026-10-20, all3 packs in sync after14 selected runners passed. No native
ordering/race observation is claimed.

## Exact scope

Blocks: `lothlorien:elven_lantern`, `elven_lantern_heartwood`, `elven_chandelier`,
`firefly_jar`, `deer_antler`, `elven_rope`, `elven_rope_hanging`, `star_canopy`.
Same-ID explicit items except structure-only hanging rope; linked
`bottle_of_fireflies`, native glass bottles and firefly capture/release.
Both rope IDs/four facings; antler floor/wall/ceiling/cardinal variants;
standing/hanging lanterns, ceiling-only chandelier and floor-only jar.
Firefly mob ecology remains in the later animal review.

## Decisions, implementation and remaining checks

| Interaction | Disposition, implementation evidence and verification limit |
| --- | --- |
| Firefly release container | Implemented: bottles.js accepts an explicit expectedSource (default glass); release explicitly supplies bottle_of_fireflies and checks exchange success. Survival uses one filled bottle and returns glass; Creative keeps source and receives the output, preserving the existing policy. Best-effort failed-exchange cleanup removes a newly spawned firefly. All other glass callers remain tested. Native inventory/entity writes are not atomic. |
| Firefly catch/release guards | Implemented: interaction_use.js shares exposed item-data comparison with cover/dew, checking original slot/mode/count/metadata/dimension and player validity. Catch rechecks entity validity/ID/type/dimension and live six-block eye distance; release rechecks clicked permutation/water, same dimension/reach and readable air. Both preflight the output route before world mutation. Stacked/full inventory output drops at feet; concurrent same-player snapshots cannot repeat a Survival exchange, and competing catches remove one target once. Separate players may release their own bottles into the same air cell. Sound/deed failures are optional. Mock verified; permission/history/transaction guarantees remain OPEN. |
| Rope effect coexistence | Implemented: no removeEffect calls and no saved potion replay. One-tick grants expire naturally; any already-live Levitation/Slow Falling takes priority, including during sneak grip. If a grant remains present at the next script callback, controller modelling pauses and resumes from real velocity after expiry. The API has no source token, so matching effects are never presumed owned. Offline normal/late-expiry cases pass. Exact native expiry timing and speed continuity are OPEN and require remeasurement; prior accepted speed is not proof of the new timing. |
| Rope held stack / placement | Implemented: event/live item must be rope; read its actual slot/stack once in the synchronous callback. Each intended cell/support is checked and each Survival piece charged before its write. Refund a failed write only when the cell is readable/air; committed/unreadable outcomes are not speculatively refunded. Metadata survives reduced stacks; Creative keeps the stack. Owner-approved2026-10-20 cleanup removes same-callback hand snapshots and synthetic mid-setPermutation hand-change tests. Item loss at ambiguous engine failures remains an explicit limitation. |
| Dimension height / unknown cells | Implemented: placement, extension and teardown pass actual finite dimension.heightRange bounds into pure rules, safe-reading each candidate. Unknown bounds/cells refuse placement; unreadable supports retain existing ropes. Official NumberRange docs do not specify inclusive/exclusive maximum: bounded top-edge reads handle either, with no assumption/subtract-one. Offline inclusive/exclusive tests pass; Nether/End/top/bottom engine acceptance is OPEN. |
| Whole-rope removal | Established design: breaking/losing one mounted piece tears down its connected same-facing column; canonical item for both IDs. Retain this custom convenience. Existing native initiating-piece loot + scripted remainder tests already cover ordinary/Creative/explosion paths; preserve exactly-once ownership. |
| doTileDrops | Implemented in the single dropWholeRope path used by player/explosion callbacks and support/piston adapters: remove connected pieces but spawn no scripted remainder when false (or Creative). Native initiating-piece loot remains separate. Both IDs/four facings, event remainders and idempotent calls are mock verified; native gamerule/explosion/piston contexts are OPEN. |
| Rope fuel | Implemented native minecraft:fuel duration15 in the explicit rope item. Art-independent configure_decor_rope_interactions.py is called by configure_support.py. No new item/recipe. Existing fiber-rope fire60/100 and grass sounds remain intentional. Furnace acceptance is OPEN. |
| Waterlogged climbing | Implemented: a rope at feet decides contact first; wet feet cannot borrow a dry rope above. Dry feet remain climbable with a wet block above. Previous head-only contact remains when feet are readable non-rope and head rope is dry. Both IDs/four facings and mixed wet/dry contacts are mock verified. Native flow/contact/ladder comparison is OPEN. |
| Mob climbing | Intentional difference, owner2026-10-19: player-only rope climbing; avoid broad mob movement/effect simulation. Existing elf avoidance remains. Native incidental ladder mob climbing is not claimed for rope. |
| Fall arrest / sneak / contact / mining | Implemented additional exclusion for dead (health<=0), invalid, gliding/flying, riding and spectator players. Existing4-tick entry and1-tick active service remain; no fast block/global entity scan. Fall arrest/fall-distance reset, edge/top/head-only contact, collision contact and native airborne mining remain OPEN. No unverified blanket fall-damage immunity was added. Sneak holds first crouched height only without an external effect. Dimension change naturally invalidates contact; effect grants expire rather than being removed. |
| Climbing implementation | Existing physics/icons accepted by owner2026-10-02/03, timer scheduling corrected2026-10-11. Pinned block components/API and26.50/26.52 notes reveal no established new native custom climbability route. Keep workaround; absence is not proof of a permanent limitation. |
| Chandelier stack | Implemented64, owner approved2026-10-19; item data, lamp generator and art-independent post-pass agree. Native inventory/dropper/hopper behavior remains an engine check. |
| Mounting and support | Existing broad non-air/non-liquid decorative eligibility, six antler faces, lantern up/down, jar up, chandelier down. Preserve accepted uses; audit face binding, partial/changed supports, trapdoor toggles, piston departures and unload. Finite/tag guesses are not a full solid-face detector; no automatic narrowing. |
| Native survival/performance | Preserve event-local support service plus sparse random recovery, native popped movement and canonical loot. Owner verified performance improvement2026-10-11. Exact production/context timing remains engine acceptance; do not restore looping forest support checks. |
| Water/fire/lava/explosions | Existing explicit waterlogging for all thin decorations/ropes; solid canopy blocks water. Lamps/antler/canopy nonflammable; rope fire exception remains. All-state flow/containment/lava/TNT/creeper and gamerule comparisons still need engine checks. No guessed loot-decay addition. |
| Light | Retain approved lantern14/chandelier15/jar11/canopy6. Check loaded/unloaded lighting, opacity, snow/ice response and spawn/navigation behavior separately; do not change brightness to15 merely because lantern function was used as a counterpart. |
| Harvest | Retain any-tool self-collection, instant antler, efficient-tool/material policies, canopy native explosion decay and reusable jar. No new pickaxe/Silk Touch gate or Fortune bonus. Native Creative/support/environment drop counts remain engine checks. |
| Art / sounds / collision | Preserve approved models, fixed palettes, icons and one-model standing/hanging lantern design. Wood-framed lamp sounds and fiber grass sounds are owner-approved2026-10-10. Audit real boxes, selection/attachments, particles, snow, falling blocks and spawning; no geometry redesign under parity. |
| Signals | Implemented/native documented defaults: omitted redstone_conductivity on seven thin block definitions means redstone_conductor defaults false, not missing opt-out; star_canopy explicitlytrue preserves stone-like conduction. No inventory/state readout makes container comparators inapplicable; no custom signal producer. Exact observer/sculk activation, wire step-down, note-block instrument and provided attachment support remain OPEN. Omitted support is not proof of shape none; supported custom shapes do not supply a verified no-support option. |
| Recipes / resources | Owner2026-10-19: chandelier now shaped four corner lanterns + one central deer_antler, output1, no rope. L slots use custom item tag lothlorien:elven_lantern declared ONLY on silver and heartwood/gold lantern items; each of four slots accepts either color, including mixed combinations. One concrete antler unlock covers every valid recipe. All16 combinations/tag membership are checked offline; crafting/unlock native acceptance OPEN. Other lamp/rope/canopy recipes, jar reuse and bottle housing retained. Antler is decoration, not nine-bone-meal storage; frame aspect does not grant storage/rotation/comparator functionality. Canopy remains stone-backed, not a glowstone conversion or extra shape family. |
| Automation / item lifecycle | Existing dropper/hopper/inventory/frames/death item paths need ordinary native acceptance. Rope placement and firefly catch/release are player handlers; dispenser equivalents remain OPEN unless a native supported route preserves container return/released state. No dispenser polling or mob replacement. |

## Evidence and limits

Read shared modding/block/scripting skills and relevant refs, mod material,
ordinary harvest, support-motion, Phase17/17b, workarounds and current tests first.
Inspected installed vanilla across versioned packs: latest ladder/lantern/glass
bottle recipes1.20.10, copper lantern additions1.21.110 and RP sound mappings.
Most old native block behavior remains hardcoded, absent from JSON.

Checked official [26.50 release](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
and [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
before suggesting workaround changes; no relevant new native climbable route
established. Pinned2.8.0 exposes dimension.heightRange and gameRules.doTileDrops;
entity can_climb is not a custom-block climbability component.

Wiki obtained2026-10-19; sweep included infobox, breaking/obtaining, usage,
placement/climbing, fuel, crafting, states, sounds and edition/history:

- [Ladder, November2025 archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Ladder): fuel, fall/sneak/contact, mobs, Bedrock waterlogged exception and Java-only trapdoor extension. Direct Ladder blocked.
- [Lantern](https://minecraft.wiki/w/Lantern): readable stale crawl, oldid2734837,1.9-year age; archive fetch failed. Mounting/support changes, waterlogging, light, stack and sounds; later native/tool history remains uncertain. Existing owner harvest policy supersedes old pickaxe-only text.
- [Glass Bottle](https://minecraft.wiki/w/Glass_Bottle): readable1.9-year crawl after inconsistent fetches; sources, filling/container returns and dispenser contexts, with edition notes. Firefly capture is a custom mechanic, not a native bottle guarantee.
- [Item Frame](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Item_Frame), [Bone Block](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Bone_Block), [Deepslate Tiles](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Deepslate_Tiles), [Glowstone](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Glowstone): aspect-specific mounting/material/recipe/light/signals, not wholesale inherited identities.

## Verification and next native checks

Approved implementation is offline verified; no new agent-run game tests.
`tests/decor_rope_interactions.mjs` executes real production bottle, firefly,
nectar/dew and rope handlers in15 independent scenarios, plus all16 recipe
color choices. Existing rope lifecycle, lamp, cover, flora/dew, support and
performance runners pass. The performance fake expires effects each tick and
continues to assert4-tick entry,1-tick active-only work and immediate timer stop.

`mods verify lothlorien --suite decor-rope --suite rope --suite lamps --suite covers
--suite nectar-dew --suite flora-crop --suite support --suite performance --suite suite-layout`:
10 runners pass; production packs0 errors/0 warnings/15 documented exceptions;
unchanged optional feature probe0 errors/1 warning.

Root deployed the same scope2026-10-19:10 runners passed;11 BP files copied,
RP unchanged and all three packs confirmed in sync. A read-only execution of
the art-independent data post-pass matches all five final data writes. Leave
and re-enter the world to load the changes.

First native checks: new chandelier recipe allsilver/allgold/mixed and antler
unlock; one-tick movement continuity, sneak and falling entry; external effects
on entry/leave; wet feet/dry head; Nether/End/top/bottom extension and teardown;
Survival/Creative/full inventory catching/release. Existing broad mounting,
falling-block landing, snow/ice/light/spawns, support changes, fluids/lava,
explosion/piston loot and signals remain acceptance checks, not silently
completed parity. No new world or generated terrain is required by this group.

Shared findings/workflow: workspace commit `76f6904`; mod notes remain uncommitted.
Approved implementation, deployment and reusable findings: workspace commit
`fddae18`. No mod commit was made alongside the earlier uncommitted work.
