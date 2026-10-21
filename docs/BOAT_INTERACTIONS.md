# Mallorn boat interaction audit

2026-10-18; target Bedrock 1.26.52 / Script API 2.8.0. Applies to
`mallorn_boat`, `mallorn_chest_boat`, `mallorn_heartwood_boat` and
`mallorn_heartwood_chest_boat` in namespace `lothlorien`.

Owner confirmed on this date: **leads, boarding, steering and leaving work well;
a broken boat drops itself**. The report does not enumerate all four variants,
passenger species, input devices, damage causes or chest contents. It is evidence
for the reported ordinary behavior, not a universal compatibility test. Earlier
2026-10-01 owner results cover placing, riding and the chest inventory; the last
seat/locator polish was approved from renders. Owner approved fuel parity and
the remaining dispenser, environment and chest interaction audit/fixes together.

## Dispositions

Native configuration means source parity, not a new in-game observation.
No intentional behavior omission was added by this review. Existing custom art,
chest-seat clearance, wood recipes and the workspace's shaped-recipe policy stay.

| Interaction | Current evidence and disposition | Remaining scope |
| --- | --- | --- |
| Ordinary placement by player | Owner-tested 2026-10-01; item retains `entity_placer`, `liquid_clipped:true`, stack 1 | Other placement edge cases remain native/runtime checks |
| Boarding, steering, leaving | **Owner verified 2026-10-18**; native runtime and rideable data retained | Other devices, blocked exits and every passenger combination were not separately reported |
| Leads | **Owner verified 2026-10-18**; native leashable/leashable_to retained | Every tension, tether and passenger case is not implied; older shears-cut observation remains in boat design sheet |
| Self-drop on ordinary break | **Owner verified 2026-10-18**; four own loot tables each name exactly the matching item | Report does not cover every variant, game mode, damage cause or stored contents |
| Furnace fuel | **Implemented:** `minecraft:fuel.duration:60` on all four items and generator, matching Wiki's six-smelt counterpart value | New engine acceptance pending |
| Dispenser placement | Existing `entity_placer` has a documented native dispenser path; omitted `dispense_on` defaults to all blocks | Compare facing water, air above water, dry land, obstruction and orientation. No demonstrated missing setting; no guessed restriction or script added |
| Passenger capacity and auto-boarding | Native two-seat plain / one-seat chest, `pull_in_entities:true`, width 1.375 preserved | Species/width limits, second passenger and growth/dismount cases pending; ordinary owner boarding report stays separate |
| Water flotation and currents | `buoyant` water/flowing_water data exactly matches newest installed counterpart | Currents, submerged recovery and ascending flowing-water cases pending |
| Bubble columns | Native down/up notifications, buoyancy groups, out-of-control state, three-second down timer and sink/exit events retained | Compare ejection, sinking and restored boarding after column exit/removal |
| Surface motion | Native runtime, physics and pushing retained | Compare land, ice variants, slime, honey and soul sand; no custom speed curve added |
| Collisions, pushing and airborne tethering | Native collision box, stackable/collidable, block/entity push and balloon/leash declarations match vanilla | Falling blocks, pistons, entity pushing and Happy Ghast tether cases pending |
| Fall behavior and rider damage | Native runtime/physics retained; no damage override | Compare ridden/unridden falls and rider health with a vanilla boat in this target version |
| Fire/lava, explosions, projectiles and cactus | Installed native lava condition retained; other responses are runtime behavior | Compare destruction/drop behavior by cause; basic owner break observation does not settle this row |
| Dropped-item burning | No fire-resistance component is granted; fuel and world-item burning are separate interactions | Native fire/lava item loss pending; no special fireproofing added |
| Dimensions/portals | No custom teleport or persistence script | Compare occupied/unoccupied vanilla eligibility, travel and retained identity/inventory; not assumed from steering |
| Chest GUI and storage | Earlier owner-tested basic chest inventory; `container_type:chest_boat`, 27 slots unchanged from vanilla | Sneak/open, occupied access, ridden inventory and full-stack transfers pending |
| Chest hopper automation | Native `can_be_siphoned_from:true` and container type preserved | Insertion/extraction above, below and beside, moving access and full-container behavior pending |
| Chest contents on destruction | Runtime container plus custom self-drop loot retained | Confirm exactly one boat plus stored stacks, without loss/duplication; loot assertions do not prove inventory spilling |
| Piglin reaction to opening/breaking chest boat | Wiki describes anger; installed piglin block sensor concerns blocks and does not establish custom entity recognition | **Unverified native consumer:** compare with vanilla chest boat; no invented family/tag or broad piglin script added |
| Comparator/redstone reading | No verified direct chest-boat comparator contract found in reviewed sources | Establish actual Bedrock counterpart applicability before asking for or emulating a signal. Hopper automation is not evidence of direct comparator output |
| Crafting and chest conversion | Both species have matching five-plank boats and chest-over-matching-boat recipes | Existing intentional shaped conversion is the workspace policy; no cross-species substitution |
| Fisherman trades | Latest installed trade table chooses specific oak/spruce/jungle/acacia/dark-oak item IDs by villager variant | **Inapplicable to Mallorn species as that exact consumer**, like other unlisted species; no claim that an item tag makes an exact-ID trade accept Mallorn |
| Item classification, naming, pickup and transport | Item identity, stack limit, icon and Creative group retained; entity families remain `boat`,`inanimate` | Native naming and ordinary inventory routes pending; no unverified generic boat tag added |
| Repair/enchant/armor mechanics | Boats are not durable equipment; no such components or repair material supplied | **Inapplicable** equipment mechanics, not a forgotten repair feature |
| Sounds and achievement consumers | Runtime/client declarations unchanged | Native sound and hardcoded achievement recognition of custom IDs remain unverified; source/runtime inheritance alone proves neither |

## Evidence and confidence

The newest installed entity definitions are
`reference/vanilla/current/behavior_packs/vanilla_1.26.30/entities/boat.json`
and `chest_boat.json`, inspected across versioned packs on 2026-10-18. Complete
entity comparison found only established adaptations: custom identity/runtime,
matching self-drop loot, removal of bamboo-raft seats, and chest seat x=0.35.
Buoyancy, bubble transitions, physics/collision, leash data, passenger limits and
chest siphoning/storage all match. This is **source evidence** only. Piglin
`vanilla_1.26.20` block sensors and fisherman `vanilla_1.20.40` exact-ID trades
were also inspected; no vanilla mob/trade overrides were made.

The [26.50 official changelog](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-50-changelog)
includes boat touch-button presentation, rendering and hopper/teleport fixes.
The [26.52 hotfix](https://feedback.minecraft.net/hc/en-us/articles/49175370527501-Minecraft-Bedrock-Edition-26-52-Hotfix-Changelog)
does not establish these custom-runtime interactions. No engine bug or permanent
platform limitation is asserted here.

[Entity placer documentation](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_entity_placer?view=minecraft-bedrock-stable)
documents native dispensing and the unrestricted empty-list default. It does not
prove vanilla boat water checks or the position/orientation of a custom entity.

[Minecraft Wiki: Boat with Chest](https://minecraft.wiki/w/Boat_with_Chest)
was readable on 2026-10-18, but the browser reported a 1.9-year-old crawl; direct
Boat access was denied. The readable **November 2025 Wiki archive** articles
[Boat](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Boat),
[Boat with Chest](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Boat_with_Chest)
and [Dispenser](https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Dispenser)
provided the mechanic sweep. Chest sources agree on fuel, capacity, storage,
hopper transfer, contents drops and piglin anger. The dispenser table explicitly
distinguishes water/air-above-water placement from dry-location item ejection.
Archive gameplay and Java-only statements were not promoted to current Bedrock
engine results. The ledger's uncertain rows remain open rather than being called
intentional omissions.

## Verification and game comparison

`python -B tools/make_mallorn_boat_family.py` regenerated the family: only four
item JSON files changed in the packs, each gaining fuel. Accepted RP artwork and
entity data were unchanged. `node tests/run.mjs --suite boats --suite suite-layout`
passed both independent runners; boats has four groups covering item placement/
fuel bindings, complete native entity parity with documented adaptations,
matching self-drop tables and wood/chest conversion recipes. These checks cannot
verify dispenser launch, physics, hopper operation, contents spilling or piglins.
Root deployed with `mods deploy lothlorien --suite boats` on 2026-10-18:
localization and four boat regression groups passed; production BP/RP had
0 errors, 0 warnings and 15 documented exceptions. The existing optional probe
had 0 errors and 1 warning. Exactly four boat item files were copied;
`mods status lothlorien` confirmed all three packs **in sync**. Leave and re-enter
the world to load them; no new world is needed. These offline/deployment results
add no engine observations beyond the owner's scoped report above.

Remaining engine comparison, using vanilla controls beside silver and heartwood:

1. Smelt six ordinary inputs with each boat item. Place/dispense at water, air
   above water, dry ground and blocked locations; compare orientation and item
   consumption/ejection. Keep each custom species' identity after recovery.
2. Compare plain/chest passenger capacity and auto-boarding with small and wide
   mobs; check column sinking/ejection and boarding after the column is removed.
3. Compare currents, ice/land/special surfaces, falls, collisions, lava/fire and
   destruction causes; compare portal eligibility in matching occupied states.
4. Fill a chest boat, transfer through hoppers above/below/beside, reload and
   travel where native boats permit, then break it and count all stored stacks.
5. Compare chest opening/breaking near adult piglins with a vanilla control and
   neutral starting state. Test any proposed direct comparator use on vanilla
   first; do not mistake a nearby hopper's own signal for boat output.

Ordinary leads/boarding/steering/leaving/self-drop already have the owner's
reported acceptance; the remaining list targets different unreported cases.
