# Swans and squirrels: counterpart interaction review

Group13, researched2026-10-20; target Bedrock1.26.52 / stable server2.8.0.
**Owner decisions implemented/deployed2026-10-20. No new in-game tests.**
Shared research/handoff record: workspace commit `b44d4ec`.
Owner1/5 decisions recorded in workspace commit `d2ec744`.
Read this alongside species sheets, `mobs/BRINGING_HOME.md`, shared animal-care
reference, Group12 deer ledger and the workspace grouped review tracker.

**Evidence correction2026-10-20:** owner correctly challenged the hand-switch
premise. Squirrel acceptance/path search is synchronous; tests injecting changes
inside pickAway do not prove a player race. Owner-approved simplification removes
its repeated same-callback snapshot checks in the
[guard review](../../../docs/synchronous-validation-review.md). Real multi-tick
errand eligibility and the independent gift/biome/native fixes remain distinct.
The cleanup is deployed; current runner has42 scenarios covering ordinary initial
inputs and accepted named stacks, real multi-tick changes and native-error cases.
Historical46-case counts below describe the earlier deployment and do not prove
injected synchronous mutations were possible player races.
[Current cleanup/swimming record](SYNCHRONOUS_VALIDATION.md).

## Final owner decisions and implementation

| # | Finding / evidence | Final disposition |
| --- | --- | --- |
| 1 | Swans use a separate25-point near-biome check (centre,8 headings on rings16/32/48). Missing-only samples remove a natural swan. | **INTENTIONAL; optimistic retention REJECTED.** Owner: swans may spawn only if some Lothlorien is nearby. Keep the positive-readable Lothlorien requirement,25 probes/48-block extent, once-only flag and existing egg/summon/born exemptions. Missing-only observations do not authorize natural swans. `swan.js`, `swan_rules.js` and spawn settings are unchanged. |
| 2 | Original evidence mixed an artificial same-callback hand race with the actual unknown0 policy gap. | **IMPLEMENTED/CORRECTED:** one ordinary current food/actor/mode/dimension/reach decision before synchronous acceptance; no full original-hand snapshot or repeated path/helper-spawn checks. Unknown0 permits neither outside food nor an errand; positive partial is known inside. Survival/Adventure charge the accepted stack once; Creative Friend does not charge. |
| 3 | Dead/Spectator/Guest sessions continued; optional deed/read errors could lose tracking/state cleanup. | **IMPLEMENTED:** live health/mode/trust/guiding/lead/alarm/original-dimension/known-inside eligibility before reward. Both actors moving dimensions still ends the original session. Unknown0 and thrown reads pause without reward, retaining tracking only within the existing2-minute cap; timeout removes helpers/session. Optional deed failures do not undo accepted gameplay. Preserve10-tick session-only service, existing lead/alarm/distance/time interruption and nonrefundable acorn. |
| 4 | `/loot` failure incorrectly spent cooldown/claimed success; horizontal return accepted stacked floors. | **IMPLEMENTED:** pinned LootTableManager looks up/rolls the unchanged table; exactly one known stack is passed unchanged to spawnItem after actual3D2.5-block proximity and readable dry passable drop-space checks. Cooldown/success only follow known spawn return. Empty/missing/throwing rolls or failed spawn end without cooldown/gift-success feedback; no fallback spawn. Known delivery is guarded in memory if persistence cannot be confirmed, with confirmed writes clearing that guard. Particles are isolated. Separate native writes/reload remain nontransactional. |
| 5 | Inside wild healing/errand acceptance does not add fed persistence. | **INTENTIONAL; blanket persistence REJECTED.** Owner: only domesticated squirrels stay. Preserve established outside/leashed feeding as the scripted domestication paths. Inside wild healing and errands do not add kept/persistent merely from acorn feeding. Previously kept animals retain their existing group; no new tame/owner system or persistence removal. |
| 6 | Powder-snow walking component absent. | **IMPLEMENTED:** squirrel `minecraft:can_stand_on_powder_snow:{}`. No freezing immunity; native surface/hazard acceptance pending. |
| 7 | Squirrel lacked a native lead-anchor declaration. | **IMPLEMENTED:** always-adult squirrel `minecraft:leashable_to:{}` alongside existing leashable. Own lead still interrupts errands; no custom lead script. Native anchor/transport acceptance pending. |
| 8 | Chicken-style fall immunity absent; swan already breathes air and water. | **IMPLEMENTED:** native damage_sensor fall/deals_damage:no. Explicit air+water breathing retained intentionally. No flight/gliding, surface-navigation, feather-timer or animation change. Native hazard outcomes remain game checks. |

## Counterpart sweep and dispositions

Chicken is the swan analogue for care, shedding machinery and walking/float
navigation, not a request to turn the swan into a chicken. Rabbit is the squirrel
analogue for a small shy ground animal; fox is consulted for reciprocal predators
and item collection, not as an ownership/pet model.

| Interaction surface | Current disposition / acceptance |
| --- | --- |
| Natural spawning | Existing biome/pool/herd/weight/caps/distance/light and10% natural cygnets retained. Positive-readable nearby Lothlorien is intentional, including removal on missing-only samples. No probability/population tuning. Existing born/egg/summon exemptions remain. |
| Lifetime | Standard distance despawn, naming and explicit fed/kept/born persistence retained. Inside wild healing/errands intentionally do not domesticate squirrels; outside/leashed feeding retains the established kept path. Real lead/reload/dimension outcomes remain OPEN. |
| Body, movement, state | Existing swan10HP/body/walk/float and squirrel4HP/body/ground movement/coats retained; no art pass. Swan occasional dipping is owner-accepted. Squirrel's sheet says no climbing; preserve ground-species design without asserting every animal climbing path is technically impossible. |
| Water/lava/fire/falls/suffocation/freezing | Native breathable/physics/lava damage declarations retained; swan fall sensor and squirrel powder-snow walking added through data. Ordinary damage/potions/hazards remain engine checks. No undead/arthropod/freezing-immunity classification or blanket immunity. |
| Reciprocal targets | Own species+mob families intentionally retained; no rabbit/chicken prey family added. This avoids opting into those exact native prey filters, not immunity from retaliation, owner-directed pets or every native attacker. Existing wolf/monster avoidance and Group12 shared wariness fix retained. |
| Care | Swans lure/breed/grow with wheat or Western Corn grain, not seeds. Breeders intentionally do not heal. Squirrels take Mallorn acorns and heal2HP when accepted; offers/refusals remain Friend-dependent inside. No new corn uses. Creative consumption, duplicates, slot/metadata changes and deaths need production tests after approval. |
| Breeding/babies | Swan native breedable/offspring/ageable/follow-parent,20-minute growth, food acceleration, golden-dandelion pause/reset and persistent born cygnets already present. Exact native cooldown/growth/scale collision/gamerule outcomes remain game checks. Squirrel no babies/breeding/taming/riding is existing accepted care design; do not silently add rabbit biology. |
| Other usable items | Native naming/leads retained; swan adult and squirrel lead anchors declared. No saddle/armor/chest/shear/milk/bucket route: neither species is designed as a mount, wool/milk producer, container or bucket animal. These exclusions follow their accepted archetypes, not missing implementations of those species-specific jobs. |
| Ambient item production | Owner accepted adult-only native feather shedding1-5min and shake. Cygnets have no timer. Migration guard avoids resetting on each load. No chicken egg/hatching route: feathers are the selected custom resource and native breeding already supplies cygnets. Timer unload/save/resume, water drops/hoppers, doMobLoot and multiplayer synchronization remain OPEN at their existing evidence scope. |
| Death drops/XP | Accepted adult exactly-one-meat even with Looting, feather pool1-2 with Looting, burning smelt and XP1-3 retained; cygnets no loot/XP. Squirrel no death loot/XP1-2 retained. Player/pet/projectile kill attribution, doMobLoot, fire/nonplayer/Creative contexts need engine comparison. Meat cooking incl soul campfires already fixed in Group10. |
| Gifts vs crop raiding/item pickup | Squirrel gift table is scripted renewable output, not actual terrain digging or pickup; no terrain cleared, rabbit crop raiding or fox mouth/equipment/food behavior. Thus gift does not claim native mobGriefing-driven garden/pickup semantics. Existing non-destructive design, table and cooldown retained; native rolling/delivery bookkeeping fixed. |
| Gift table truth | Four unchanged entries: litter28x2-4, blossom28x2-4, corn seeds14x1-3, athelas8x1-2. Species sheet corrected to these entries; no removed flowers/acorns restored and no balance change. |
| Errand details | Existing10-14 block away spot,3-5s dig,2.5-block distance threshold,40-block horizontal abort and2min cap retained; return delivery now requires actual3D proximity. Ray-based navigation, wet/obstructed space, beacon cross-follow and reload/unload remain native acceptance. Helper category receives its later full sweep; no claim navigation is fully tested offline. |
| Signals/sounds/commands | Ordinary entity movements/interactions, pressure plates, sculk/vibrations, command removal and collisions remain native acceptance. Squirrel placeholder rabbit calls and swan selected ambient/hurt/death/step are existing scope; no audio/art changes proposed. No biological special-name variants or Java Killer Bunny imported. |

## Evidence and reproduction

Source and read-only production callback audit2026-10-20; no in-game observation.
Earlier scratch `temp/interaction-group13/audit.mjs` reused the deer production fixture
with missing world-time and deed bindings supplied. Production scripts are read
unchanged, imports mocked, private functions exposed only in memory. Ten cases
confirmed: changed live hand free start; unknown0 start; inside heal without fed;
dead/Spectator/Guest sessions continue; thrown/zero-success loot spends cooldown;
deed failure leaves guiding; all-unknown swan samples remove/clear natural flag.
These demonstrate script behavior under injected failures/context; they do not
prove those native errors occur at a measured frequency. Scratch was superseded
by permanent production regressions and removed at completion.

No verifier changes or pack mutations were needed for the earlier research.
Permanent `tests/swan_squirrel_interactions.mjs` now provides46 production
scenarios covering native policies/table balance, positive-readable swan
filter/once-only/exemptions,15 offer context changes, original-hand/unknown-centre
rejection, last/stacked/Creative charge rules, exact domestication distinction,
deed isolation,8 return-ineligibility changes, unknown/read-failure pause and
bounded timeout, per-session isolation, stacked floors,4 drop obstructions,
6 roll/spawn failure paths, all4 native gift stack identities/counts, optional
particles and persistence-failure cooldown guard. No duplicate fallback or
early cooldown is used. A thrown item spawn may have committed; reload can lose
an unpersisted runtime guard. No exactly-once transaction is claimed.

Shared `tests/fixtures/wildlife_runtime.mjs` contains reusable API fixtures and
production import bindings, with no tests/world generation on import. Group12's
deer runner retains all33 production scenarios. Existing animal-home and
performance fixtures use the real shared hand helper; the multiple-errand
lifecycle scenario explicitly uses Creative rather than a no-op food consumer.

Selected verification2026-10-20: swan-squirrel-interactions, swan-squirrel
(including shedding), animal-home, deer-interactions, white-deer, performance,
suite-layout:8 runners passed. Production BP/RP0 errors/0 warnings/15 documented
exceptions; unchanged optional probe0 errors/1 warning. Final native-policy
assertion explicitly checks that powder-snow walking does not add
minecraft:freezing_immune. Root repeated these8 runners during deployment;
4 BP files copied (squirrel.js, comments in squirrel_rules.js, squirrel/swan entity
data), RP/probe unchanged. Subsequent status confirmed all three packs in sync.
Shared depth, natural swan logic/settings, gift table, art, sounds, native care,
migration and feather timing/animation are unchanged. No worldgen change.

Subsequent owner-approved synchronous cleanup2026-10-20 retained every substantive
Group13 game rule and error policy while removing redundant same-callback offer
and gift revalidation. Real sessions retain their live eligibility and bounded
unknown-read behavior. Root deployed the combined cleanup/swimming batch using
14 runners, confirmed all3 packs in sync, and recorded production0 errors/
0 warnings/15 exceptions with unchanged probe1 warning. Current tests42 scenarios;
no new native observations. Details: [SYNCHRONOUS_VALIDATION.md](SYNCHRONOUS_VALIDATION.md).

Root independently checked unchanged hashes for depth.js, swan.js/swan_rules.js,
swan spawn rules and gift table; reviewed handlers, shared fixture and production
regressions. Leave/re-enter the world to load the fixes; no new world required.
Shared implementation/deployment/handoff record: workspace commit `1dee06c`.

## Sources and limits

Known shared skills/references and mod sheets/scripts/tests read first. Newest
installed `vanilla_1.26.50/entities/{chicken,rabbit,fox}.json` inspected, including
native care, fall sensor, powder-snow component, adult lead anchors and fox prey
filters. Target changelogs checked before proposing a workaround;26.50's ambient
sound and powder-snow changes are relevant, its movement/reload fixes do not
establish fixes for these custom scripts.26.52 adds no relevant errand fix.

Direct Wiki Chicken/Rabbit/Fox reads failed. These are **November2025 archived
Minecraft Wiki pages**, retrieved2026-10-20, not current revisions:

- [Chicken](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Chicken): spawn/jockeys, drops, walking/float/falls, predators, breeding/growth, eggs and edition history.
- [Rabbit](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Rabbit): spawn/coat/drops, lure/flee/hop, Bedrock carrot raiding, predators, care and species-only variants.
- [Fox](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Fox): prey, pickup/eating/equipment and mobGriefing; not a required squirrel pet feature.
- [Lead](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Lead), [Breeding](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Breeding), [Powder Snow](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Powder_Snow): transport/lifetime, shared reproduction and lightweight surface behavior. Older archive details do not override current native components.
- [Official26.50 changelog](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog), [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog).
- [CommandResult](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/commandresult?view=minecraft-bedrock-stable), [LootTableManager](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/loottablemanager?view=minecraft-bedrock-stable), [damage_sensor](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_damage_sensor?view=minecraft-bedrock-stable); pinned `reference/server-2.8.0.d.ts` confirms loot-table lookup/generation and command success count. Documentation does not grant atomic delivery/persistence or establish custom native outcome tests.
