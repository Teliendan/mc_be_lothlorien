# Deer, white deer and shared wariness interactions

2026-10-20; Bedrock1.26.52 / API2.8.0. **Group12 first five findings approved
and deployed2026-10-19. Sixth owner decision implemented/deployed2026-10-20:
skip unavailable outer depth samples and prefer optimistic heart estimates.**
All three packs confirmed in sync after the sampler deployment. No new game observations. Six direct production
offline reproductions plus source/native/Wiki review. Prior owner observations
retain their exact dates/scope in the two mob sheets.

Evidence correction2026-10-20: white-deer search actually yields and needs
completion-boundary validation. Duplicate checks within the synchronous lead
completion do not protect another player timing window; see the proposed
[guard cleanup](../../../docs/synchronous-validation-review.md). Preserve the
real yielded-search boundary and separate ongoing-session rules. The approved
cleanup now performs one validation when entering lead, retaining all33 real
production scenarios. [Implementation/test record](SYNCHRONOUS_VALIDATION.md);
deployed2026-10-20, all3 packs in sync after14 selected runners passed. Shared
completion/evidence-correction record: workspace commit `1de73e8`.

## Scope and established choices

`lothlorien:deer`, `lothlorien:white_deer`, their spawn/loot/age/state definitions,
`deer.js`/`deer_rules.js`, `white_deer.js`/`white_deer_rules.js`, linked guidance
beacon and shared food helpers. `deer.js` also drives swan, squirrel and unicorn
wariness; fixes to that common service must cover all five types without changing
their separate food/gift designs. Other biological audits remain later groups.

Preserve corn-grain-only ordinary deer lure/breeding/growth, no extra corn wheat
uses; ordinary breeders do not heal from food. White deer remains a solitary
adult hart, no breeding/riding/native pet ownership, acorn lure/healing, lead
priority, Friend-only guidance inside Lothlorien and lifetime Great-nut gift.
Outside feeding keeps/heals it without spending its gift. Both retain custom
fed habituation/persistence (called tame internally), not wolf-like ownership.
Preserve health14, movement/body/art/sounds, spawn weights/densities/depth chances,
flight/alarm tuning, sex appearance, current drops/XP and gameplay acquisition.
No terrain-eating grazing, new milk/shear/saddle/armor or vanilla prey families.

## Findings and owner decisions

| Interaction | Final disposition |
| --- | --- |
| Creative/Spectator and fear | IMPLEMENTED living readable Survival/Adventure player selection for all five wary types. Creative/Spectator/dead/invalid/unreadable players do not select fear state. Creative Friend guidance remains allowed. Native acceptance pending. |
| Wariness read failures | IMPLEMENTED per-player/creature isolation; valid temporarily unreadable creatures remain tracked. Confirmed-invalid/removal handling,40-tick cadence and stop-on-empty retained. Offline recovery/lifecycle checks pass. |
| Gift delivery versus particles | IMPLEMENTED one item spawn attempt, isolated optional particles and lifetime flag/runtime guard for known delivery. Confirmed persistent completion clears the runtime guard; no pre-spent gift or speculative fallback. Ambiguous spawn/property failures and reload before persistence remain nontransactional limitations. |
| Deferred white-deer offer | IMPLEMENTED original hand/context plus live animal/player/slot/mode/dimension/reach/trust/leash/alarm/gift/session/stored-spot validation before mutations. Positive partial depth certifies inside and permits guidance; zero incomplete waits, confirmed outside retains ordinary feeding. Dead/Spectator/untrusted/dimension-changed sessions stop. No deer teleport; sixth decision changes only the shared estimate, not this offer policy. |
| Gift-ground position | IMPLEMENTED solid-ground classification preserving grass_block, dry passable feet/head cells including waterlogged rejection, live clear/inside gift-spot recheck. Blocked/unknown/foreign spots do not deliver or spend the lifetime gift. No terrain clearing. |
| Natural white-deer depth | **OWNER DECISION IMPLEMENTED/DEPLOYED2026-10-20; native acceptance OPEN.** Skip unavailable outer samples, scan remaining readable points/rings and use the first observed foreign ring; if no border is observed through40 and Lothlorien is seen, classify heart. Retain complete:false when any sampled point is missing and retain unreadable-centre0/incomplete. The owner prefers occasional extra hearts to rare animals occurring mainly in explored terrain/behind the player. No postponement/retry service; natural judgment and chance table unchanged. |

## Implemented approved scope

The first five rows above were accepted2026-10-19. `deer.js` now considers
living, valid readable Survival/Adventure players independently; a bad player
does not stop other players. Creature read failures preserve tracking unless
the actor is confirmed invalid/removed. The40-tick event-tracked lifecycle,
empty-service shutdown, all radii and wariness priorities remain unchanged.

White-deer offers capture original held stack metadata/count, selected slot,
mode, dimension, deer identity and stored gift state. After a yielded search,
all eligibility is rechecked before spot/persistence/session/acorn mutations:
living actors, original hand/dimension, interaction reach6, Friend trust,
no lead/alarm/gift/other session, known-inside biome state and dry clear gift
space. Creative Friend guidance remains allowed and does not consume acorns.
Positive partial depth confirms inside the biome and remains eligible, while
its exact depth class can be optimistic under the2026-10-20 policy. Incomplete zero is unknown and permits neither gifts nor outside
feeding. Complete outside zero retains the accepted ordinary healing policy.
Active sessions end for dead/invalid players or deer, Spectators, lost Friend
status or departure from the original dimension, including when already at the
target. Lead and hurt priority remain intact.

Grass blocks are solid ground. Air/non-solid dry plants and tree crowns can be
looked through to find the forest floor, but both actual feet/head cells must
be passable and non-liquid/non-waterlogged. The gift spot's ground, body cells
and biome are rechecked at delivery. A changed/obstructed spot ends guidance
without spending the gift or announcing successful delivery; no terrain clears.

Gift delivery makes one item-spawn attempt and records known success before
optional particles. Persistent GIFTED prevents later gifts. A small runtime
guard retains only known successful deliveries whose persistent write could
not be confirmed; confirmed flag writes clear that guard. There is no fallback
spawn and no permanent claim before a successful spawn. **OPEN:** item spawning
and property writes are separate engine operations. A thrown spawn may have
committed, and an unsuccessful completion write followed by reload loses the
runtime guard; these ambiguous outcomes are not claimed exactly-once. No new
deliberate lost-gift policy was introduced.

Offline coverage: `tests/deer_interactions.mjs` now runs33 independent production
scenarios covering all five wary species, read-error recovery, gift cosmetics
and write failures, body/water/biome checks,17 deferred context changes,
Survival/Creative acceptance, positive partial-depth acceptance, invalid
active sessions and actual natural white-deer/warden consumers of optimistic
partial-heart estimates with unchanged chance tables. Existing animal-home and performance fixtures now supply
current health/item/hand/block snapshot APIs and use the real shared helpers;
their prior lifecycle, no-query, food and container assertions are retained.
Native pathfinding, body shape/passability, event snapshots, chunk boundaries
and delivery remain in-game acceptance cases.

## Remaining mechanics and deliberate differences

| Area | Current disposition / remaining acceptance |
| --- | --- |
| Breeding and babies | Native require_tame:false, breed/offspring, entity_born baby event, random buck/doe,20-minute ageable, corn acceleration, follow-parent and adult loot/XP groups already present. Golden-dandelion pause/reset fields already present, corroborated by newest native cow/rabbit; old Wiki archive predates that mechanic. Native love/feeding/cooldown/Creative/interrupted interactions, paused growth and reload remain acceptance cases. No sex-gated breeding feature proposed. |
| Food versus habituation | After-event handler currently marks an ordinary deer fed from corn identity. API documents before/after stacks after successful interaction, not a universal feeding-result token. OPEN exact success/Creative/cooldown semantics and native item consumption; do not announce a proven free-feed bug or add a second food consumer without evidence. Shared animal_food behavior for other species remains separate. |
| Persistent states | Existing kept group for tame-or-leashed, untame-on-hurt and unleash conditional removal retained. Native naming, successful feeding/newborn persistence and restoring distance despawn after group removal need engine checks. No blanket permanent persistence or native pet owner/follow/teleport. |
| Lead/transport | Native leashable on both, adult ordinary deer leashable_to; preserve lead wins over guidance. OPEN shears/cut/steal/attach/recovery, fence/mob knots, happy-ghast transport, boat/minecart fit/disembarking and portal/unload behavior. Use Bedrock mechanics; archive's Java-only claims are not imported. |
| Spawn/ecology | Existing biome/surface/grass-or-dirt/light7-15, weights/herds/densities, animal pool and depth table retained. Brightness7 does not by itself prove moonlit/night spawning. OPEN actual counts, natural baby share, name/fed/lead persistence, spawn eggs/spawners/summons, difficulty/gamerules/reload. No population rebalance or terrain editing. |
| Body/hazards | Existing native walk/jump/float/breathable/panic, pushable components and lava damage retained. OPEN fire/fall/drowning/freezing/powder snow/suffocation/cactus/berry/magma/lightning/portals, knockback/potions, path hazards/rails/doors/slabs/stairs/fences and adult/fawn collision. No horse/rabbit transformation or undead/arthropod classification. |
| Reciprocal mobs | Own deer families deliberately avoid vanilla rabbit/sheep prey targeting. Retain avoidance of wolves/monsters. Other generic hostile attacks, goat ramming, warden detection, custom animal threat filters, invisibility and multiplayer reactions remain native checks; own family does not prove immunity from every other mob. |
| Rewards | Adult-only ordinary leather/venison, burning smelt, Looting and player-only chance antler retained; fawns no loot/XP. White deer sure antler on any death is existing sacred-loner choice, plus normal leather/venison and player-kill XP. OPEN pet/projectile/fire/environment credit and doMobLoot/Creative behavior; lifetime gift is separate from death loot. Group10 already added soul-campfire meat cooking; Group9 chandelier uses1 antler +4 lanterns. |
| Cow/rabbit-specific products | Milk/mushroom shear/saddle/rabbit-foot/Toast/Killer-Bunny behaviors do not follow merely from using cow/rabbit care/flight analogues. No new products/forms/skins. No grass-consuming grazing preserves owner forest floor; a visual-only grazing animation remains optional separate work, not blocked by eat_block semantics. |
| Guidance helper | Existing guide_beacon inanimate family, no gravity/collision, immunity,330s expiry, active session tracking and stray cleanup retained. Cross-following nearby guide beacons is owner-accepted. OPEN native target/collision/spawn cap/interception/portal/orphan/reload behavior and chunk-boundary gift recovery; no persistent world scan or direct deer teleport. |
| Harmony/alarm | Preserve player-hurt alarm radius20/20s and band selection/radii. Player/pet/projectile kill credit, death/event order, no-nearby-player state and alarm/guidance transitions remain exact tests; no new reputation cost or wildlife targeting. Shared service fixes must preserve swan/squirrel/unicorn accepted behavior. |

## Evidence, sources and limits

Read mob/shared interaction skills, lifecycle/spawning, animal-care reference,
current deer/white-deer/care sheets, production runtime/data and existing
deer/white-deer/animal-home tests first. Newest installed cow1.26.10 and
rabbit1.26.50 confirm native offspring/breed/age/golden-dandelion patterns.
Reviewed official26.50 release/26.52 hotfix before proposing fixes; no fix
established for these custom-script failures. Movement reload fixes there are
not authority to build a new workaround into these animals.

Direct production-handler offline results, no artifacts or pack mutation:
particle error =>2 nuts/GIFTED=true; incomplete depth =>removed/flag cleared;
Creative Hated + Survival Friend =>set_l3; unreadable player =>update throws;
transient deer read =>no later event after recovery; grass_block64/dirt63
=>gift feet64, expected65. Internal functions were exported only in in-memory
module copies; production bodies ran unchanged. Deferred-offer gap is source
review, not a newly reproduced native interaction.

Sources retrieved2026-10-19:

- [Cow, November2025 Wiki archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Cow): body, spawning, food/breeding/baby growth, milking/drops and navigation. Analogue by aspect, not permission to add milk.
- [Rabbit, same archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Rabbit): flight/lure, reciprocal predators, Bedrock crop eating, breeding/growth/follow-parent and species-only variants. Do not import Java Killer Bunny.
- [Breeding](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Breeding), [Lead](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Lead): care/reproduction/transport surface. Exact native cooldown timing remains an engine comparison; do not guess a number from inconsistent Creator defaults versus gameplay/native omitted defaults.
- [26.50 release](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog), [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog).
- [Interaction after-event](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerinteractwithentityafterevent?view=minecraft-bedrock-stable), [Dimension](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable), pinned reference/server-2.8.0.d.ts: native snapshots/spawn APIs, no transactional guarantee. Current rolling API docs do not grant APIs absent from the pinned version.

Broad native acceptance and
unsupported paths stay OPEN rather than marked intentionally omitted.
Shared research recorded in workspace commit `b5c8e0d`; mod findings remain
uncommitted with the ongoing owner review.

## Root deployment2026-10-19

Root reviewed handlers, production regressions and fixture changes. A review
correction made captured mock BlockPermutation immutable and added a real
firefly-release changed-clicked-block regression; animal-home passed afterward.
Deployed deer-interactions, deer, white-deer, animal-home, swan-squirrel, unicorn,
performance and suite-layout:9 runners passed, including31 new production
scenarios. Production BP/RP0 errors/0 warnings/15 documented exceptions; unchanged
optional probe0 errors/1 warning. Two BP script files copied, RP/probe unchanged;
subsequent mods status confirmed all three packs in sync. No worldgen change.
Root independently compared judgeNaturalSpawn against HEAD and depth.js diff:
both unchanged. Leave/re-enter the world to load the approved five fixes.

Shared implementation knowledge/deployment record: workspace commit `470f2e6`.

## Owner depth policy2026-10-20

Owner: "Skip the unavailable parts. Better more hearts by chance then less."
This supersedes the earlier pending discussion and the original proposal to
postpone destructive judgments. The sampler retains centre plus surface
rings8/16/24/32/40, all existing offsets and thresholds. Missing outer points
are skipped; the rest of that ring and subsequent rings still run. A readable
foreign point determines the first observed border ring. No observed border
through40 plus seen Lothlorien permits heart, even if every outer sample was
missing. complete:false explicitly records partial observations; distance and
beyond describe observed probes, not a guaranteed bound on an unreadable
border. Sampling remains bounded below120 points, with no force-loading,
terrain edits, retry timers or world scans.

An unreadable centre remains0/incomplete without probing outer rings. A known
foreign centre remains confirmed outside. Transparent rivers still require
Lothlorien evidence before the first observed foreign ring; river-only samples
do not invent inside. River-only data with missing samples stays0/incomplete
rather than confirming outside. Fully readable inputs keep their prior results.

Consumer review: main.js surface sampling already maps unavailable native reads
to undefined; its debug UI already marks complete:false as uncertain. White
deer guidance accepts known inside and rejects unknown0 as before. Natural
white-deer and warden filters deliberately use the same optimistic level and
their original chance tables; e.g. a frontier heart keeps all white deer but
ground wardens retain their existing inner/heart30% instead of edge100% chance.
Eggs, summons, natural flags, spawn weights and one-shot scheduling are unchanged.
Unknown-centre natural judgments still use their existing level0 behavior;
this decision does not add postponement for those exceptional cases. Squirrel
unknown0 offer handling is a pre-existing next-group finding, not changed here.
Harmony uses its direct biome-membership sampler rather than depth class, so
reputation eligibility does not acquire optimistic outer-ring semantics.

Offline sampler coverage now includes17 tests: missing points on every ring,
wholly missing outer rings, foreign data after gaps/in a partial ring,
unreadable centre, river-only ambiguity, river-to-Lothlorien discovery after gaps,
and retained all-readable border/river/tongue cases. No new game observations.

Root reviewed and deployed2026-10-20 using biome, deer-interactions, white-deer,
animal-home, wardens, swan-squirrel, performance and suite-layout:9 runners passed,
including17 sampler tests and33 production scenarios. Production0 errors/0
warnings/15 documented exceptions; unchanged optional probe0 errors/1 warning.
Deployment copied1 BP script; RP/probe unchanged. Subsequent status confirmed
all three packs in sync. Leave/re-enter the world to load it; no new world needed.

Shared depth-policy knowledge/deployment record: workspace commit `1be282d`.
