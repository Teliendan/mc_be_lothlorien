# Phial and temporary light interaction audit

2026-10-19; Bedrock1.26.52 / API2.8.0. **Group11 approved and implemented;
source/offline verified, deployed and in sync. No new in-game observations.**
The owner accepted all six proposed fixes. Three pre-fix offline reproductions
execute the production phial runtime with the shared API mock.

## Scope and existing accepted design

Item `lothlorien:phial_of_galadriel`, hidden block `lothlorien:phial_light`,
`scripts/phial.js`, tuning in `gift_rules.js`, helper loot/material/generator
and the existing `tests/phial.mjs`. Native analogues are Light (block), block
lighting and Spectator world interaction, not Potion consumption. Spider/cave
spider repulsion is custom magic; their biological audit belongs to no new mob.

Owner2026-10-11 reported phial gameplay working perfectly; selected faceted moon
crystal artwork is established. Preserve offhand-only activation, stack1/glint,
level14 real block light, air-only head/feet/overhead fallback, five-tick cadence,
eight-block spherical radius, horizontal0.8 impulse, no damage/upward force,
24 spider candidates per holder/pass,64 cleanup reads and256 pending records.
No new charge, drink, durability, enchant/repair, fuel, recipe or gift acquisition.

## Final dispositions

| Interaction | Evidence and disposition |
| --- | --- |
| Spectator | IMPLEMENTED exclude Spectator from both effects; clean unused old lights through the bounded ledger while retaining eligible shared holders. Preserve Survival/Creative/Adventure magic. Offline regressions pass; native acceptance remains pending. |
| Crowded spider types | IMPLEMENTED pulse-wide alternating query order, preserving24 returned candidates per holder/pass and existing radius/strength. Four crowded offline pulses give48 normal/48 cave impulses instead of96/0. No broad scan or increased budget. |
| One invalid target | IMPLEMENTED per-query/per-target failure isolation and live validity/type/health/finite-position/dimension/range checks. One impulse from the nearest currently eligible queried holder, with fallback and recomputed direction; no teleport, damage, targeting or force change. |
| Connections to helper | IMPLEMENTED explicit connection_rule acceptance none, avoiding default all. Actual native fence/wall/pane geometry remains an acceptance case; no observed visual defect claimed. |
| Chest opening | IMPLEMENTED explicit chest_obstruction never rather than relying on AABB interpretation. Native lid acceptance pending; no prior observed failure claimed. |
| Rain/snow | IMPLEMENTED explicit precipitation_behavior none; no snowlogging. Native acceptance pending; do not infer an observed obstruction bug from inconsistent default prose. |
| Support supplied | Missing support documents unit-cube support. Current stable shapes are only fence/stair, with no none shape. OPEN: exact no-face support/native attachment behavior. Do not claim connection_rule none also removes support or add guessed shape none. |
| Collision/selection/replacement | Retain false boxes, transparent texture, zero light dampening and replaceable helper. OPEN native player/mob/falling-block/navigation/suffocation/spawn-obstruction and building-through behavior; rendering transparency is not proof of every physical property. |
| Real illumination | Preserve existing level14 block-light architecture, not a new cosmetic-only design. Native lighting can affect ecology/plant checks; exact spawn/growth/ice/snow effects and Vibrant Visuals remain game comparisons. No scripted lighting/ecology simulation. |
| Fluid contact | Existing noncontainable/broken water rule plus air-only placement is established; underwater/fully obstructed holders may have no light. Preserve no overwriting plants/water/lava/native light blocks. OPEN incoming lava separately and native water/flow/cleanup behavior. Do not generalize the water rule to lava. |
| Pistons/destruction | Existing popped helper and empty loot prevent moving an owned light away from its ledger or farming drops. Preserve this deliberate helper difference from movable/waterloggable vanilla Light, plus zero mining/explosion resistance and nonflammability. Native piston/slime/honey/explosion/liquid events remain acceptance cases. |
| Observer/redstone/sculk | Nonconducting helper retained. Wiki says native light blocks are observer-detectable; block creation/removal is not promised silent. OPEN custom helper observer/sculk/vibration and note-block effects. No claim that nonconducting disables observers or that scripts suppress engine notifications. |
| Cleanup/ownership | Existing write-before-place ledger, round-robin unloaded retry, idempotent startup, shared desired cells and foreign replacement protection have offline regressions. Preserve death/departure/unequip/dimension/reload cleanup. No chunk forcing/world scans; cap saturation pauses new lights. Corrupt/manual/uninstalled-addon leftovers remain documented limitations, not proof all blocks can be recovered. |
| Repulsion boundaries | Existing impulse works on both native types without hostility/line-of-sight filter; preserve accepted behavior through walls subject to native collision, climbing/elevation and multiple holders. Contact attacks remain possible. OPEN native riders/jockeys, status effects, knockback response and difficulty contexts. No new hostility, damage or AI rewrite. |
| Item lifecycle | Native offhand permission, selected icon and gift acquisition retained; mainhand/storage/drop do not activate magic. OPEN frames/stands/equipment displays, native death/keepInventory/drop/despawn/fire/lava/automation outcomes. No durability means no Mending/repair use case; glint alone is not enchanting. This is a magic item, not a drink or placeable vanilla light item. |

## Reproductions and evidence

Read shared modding/items/scripting/blocks skills and support/remaining-property
references, current gift notes/tests before research. Installed newest26.50
spider/cave-spider definitions have different families (`spider` versus
`cavespider`), so a single family spider query would omit cave spiders. No
data-driven native light-block definition was found in versioned installed
block files; do not infer its hardcoded properties from that absence.

Production runtime, no artifacts/pack edits: Spectator => light helper +1 push;
crowd across four pulses =>96 normal/0 cave pushes; one unreadable returned
target =>0 healthy-following pushes. Mock errors were empty because the current
outer try swallows the target failure. These are source/offline proofs of the
conditions, not measurements of native scheduling, collision or lighting.

Reviewed target26.50 changelog and26.52 hotfix before proposing fixes.26.52 fixes
Spectator projectile hits; it does not gate custom script world mutations.
No target fix established for these custom loop/default-policy findings.

Sources retrieved2026-10-19:

- [Light (block), November2025 Wiki archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Light_%28block%29): invisible replacement/selection, waterlogging, Bedrock piston behavior and observers. Initial Light_Block archive URL failed; followed Light article's actual link. General prose mixes editions, so native fluid claims require separate Bedrock checks.
- [Light, same archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Light): real block light versus rendered brightness, propagation and ecology. No cosmetic-light equivalence inferred.
- [Spectator, same archive](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Spectator): noninteraction and Bedrock release history. Java-only entity viewing/highlighting is not imported.
- [26.50 release](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog), [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog).
- [Connection rule](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_connection_rule?view=minecraft-bedrock-stable), [chest obstruction](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_chest_obstruction?view=minecraft-bedrock-stable), [precipitation](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_precipitation_interactions?view=minecraft-bedrock-stable), [support](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_support?view=minecraft-bedrock-stable): current forms/defaults, not proof of actual helper neighbor behavior.

## Final approved implementation

The six proposals above are implemented, not pending design choices:

- Holder eligibility excludes Spectator before either light selection or spider
  queries, preserving Survival/Creative/Adventure. The shared desired-cell set
  keeps another eligible holder's light when one switches to Spectator; unused
  lights use the existing bounded cleanup path.
- Spider-type query priority alternates once per pulse for every holder. Total
  returned candidates inspected per holder/pass remains24; invalid candidates
  spend that budget, and a failed query leaves its unused budget for the other
  native type. No family/all-mob scan is introduced.
- Each target failure is isolated. Validity, native type, living health when
  available, finite positions, matching dimension and spherical range are checked
  when collecting candidates and again before impulse. Each spider receives at
  most one impulse from the nearest currently eligible queried holder; another
  queried holder remains available if the previously nearest becomes ineligible.
  Current positions determine direction. No extra holder/world scans are used.
- The helper explicitly declares `connection_rule.accepts_connections_from:none`,
  `chest_obstruction.obstruction_rule:never`, and
  `precipitation_interactions.precipitation_behavior:none`. Production tests
  protect all three; material property checks also protect connection/weather
  policies (their supported checker set omits chest obstruction). They do not claim support-face parity or newly
  observed native connection/lid/weather behavior.
- `tools/make_phial.py` uses an art-independent `configure_helper` function to
  retain these policies and the production light level. No artwork was changed
  or regenerated during this interaction fix.

`tests/phial.mjs` runs28 production runtime scenarios plus the helper declaration
contract. New cases cover the three active modes/Spectator, shared light cleanup,
four fully crowded pulses with48 impulses per spider type, query/target failures,
eleven changes between query and impulse, current direction and multi-holder
fallback. Existing air-only writes, ledger persistence, bounded cleanup and
foreign replacement tests remain. These are offline proofs, not engine physics,
lighting, weather, observer or native actor acceptance.

Exact support faces, incoming lava/water, helper replacement/physics, native light
ecology, observers/sculk and item lifecycle remain **OPEN** as detailed in the
table. No guessed support shape, vanilla override, new item or simulation was
added. Broader biology/helper-actor audits remain separate later groups.

Validation2026-10-19: `mods verify lothlorien --suite phial --suite suite-layout`
passed both runners; production BP/RP0 errors,0 warnings,15 documented exceptions.
The optional feature-probe pack retains its pre-existing0 errors/1 warning.
Read-only generator checks reproduce the approved helper fields from an empty
component set and leave the configured source JSON semantically unchanged.
No textures were regenerated.
Shared research recorded in workspace commit `9b677b8`; mod audit notes remain
uncommitted with the ongoing review.

Root deployment2026-10-19: `mods deploy lothlorien --suite phial --suite suite-layout`
passed both runners and the shared checks above. Three BP files copied; RP and
optional probe unchanged. Subsequent mods status confirmed all three packs in
sync. Root independently compared configure_helper output with the current
definition without writing packs/textures. No worldgen changes; leave/re-enter
the world to load changes. The listed native acceptance checks remain OPEN.
Shared implementation knowledge/deployment record: workspace commit `3011aa2`.
