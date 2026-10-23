# Vanilla parity: blocks, items and gifts (groups 1-11)

Bedrock 1.26.52, Script API 2.8.0. Replaces the eleven per-group ledgers (archery, wearables, boats, controls,
wood, leaves/trees, flora/crops, ground cover/dew, lights/ropes, food/remedies, Phial); history: git before the
"parity cleanup" commit. Rules: AGENTS.md "Vanilla parity" (reachability first, native route first, one-tick
re-check = target block + held item type). Everything here is documented/offline-tested unless marked "game".
Creature groups: [CREATURES.md](CREATURES.md).

## Archery (bow, Galadhrim arrows)
- Native only: `repairable` (same bow, remaining-durability donor), `fuel` 10 s, arrow `allow_off_hand`, dispenser
  launch via item `minecraft:projectile`, enchantable slot `bow`. Shooter, damage, bounce, fluids, ground pickup are the
  vanilla arrow runtime (custom entity keeps `runtime_identifier` arrow). Recovery script only returns destroyed-hit arrows.
- Owner (2026-10-18): same-bow repair yes; fuel yes; no dispenser recipe from this bow; no tipped Galadhrim arrows;
  mob-held bow deferred (no data-only route); 384 durability kept.
- Mallorn buttons are pressed by arrows/tridents (see Controls).

## Wearables (cloak, belt)
- Data only: cloak repairable (self + string), `armor_torso` enchantable, protection 3; belt offhand `wearable`
  + `allow_off_hand`, no durability. Owner: no dye/trim; freezing immunity pending (no item-side route exists).
- Trap: `wearable.dispensable` is rejected by the 1.26.52 item parser (owner log 2026-10-21); the verifier rejects it.
- Cloak invisibility and belt regeneration run from one polling service that sleeps with no players.

## Boats
- Four entities are copies of vanilla boat/chest_boat with documented adaptations (enforced by tests/boats.mjs
  when the vanilla reference exists). Fuel 60 s, own loot, chest seat x 0.35, no raft seats.
- Owner verified 2026-10-18: placing, riding, leads, leaving, self-drop, chest inventory.
- Game check: dispenser may put a boat on dry land (`entity_placer` has no `dispense_on`); add
  `"dispense_on": ["minecraft:water", "minecraft:flowing_water"]` if so.

## Controls (doors, trapdoors, gates, buttons, plates)
- Doors/trapdoors/gates toggle by script (`blocks.js`); synchronized double doors are an owner convenience (2026-10-18).
- Wind charge (vanilla: explosion power 1.2, toggles only): `projectileHitBlock`/`projectileHitEntity` toggle Mallorn
  doors/trapdoors/gates and press buttons within 1.2 blocks of the impact. Projectile events take no filter; the
  handlers return on other projectile ids.
- Arrow/trident: the hit lands on the backing block; the button on that face is pressed when the hit is in its middle.
  The powered-only looping 30-tick native tick releases it once no arrow/trident is within 1 block.
- Plates: 4-tick poll, powered 20-tick poll, 20-tick minimum hold, AABB vs bottom quarter, Spectators excluded in the query.
- Wooden sounds: `random.wood_click` (0.6 / 0.5), `click_on/off.wooden_pressure_plate`.
- Gate in a vanilla wall: lowered model, kept current by place/break events and the gate's random tick (no explosion/piston hooks).
- Game checks: button release fires from the native tick; wind charge events deliver a valid projectile (`isValid`);
  walls actually draw an arm to the gate.

## Wood (logs, planks, slabs, stairs)
- Logs/bark wood: `block_face` trait with three axes; axe stripping and slab merging are `playerInteractWithBlock`
  handlers (a block component would swallow normal placement). One-tick defer: block unchanged + main-hand item type.
  Held-button repeats are ignored with `isFirstEvent`. Adventure players are left to the engine (CanPlaceOn/CanDestroy).
- Axes: `minecraft:is_axe` tag plus vanilla ids; Unbreaking-aware wear (clamped 0-3); Creative/unbreakable skipped.
- Slab merge sound is vanilla wood placement (`dig.wood`, pitch 0.8). Fuel 15 s for logs/planks/stairs/slabs.
- Known limit: planks as anvil repair for vanilla wooden tools (needs overriding vanilla items).

## Leaves and trees
- Both leaf blocks have same-id items (30 % compost), furnace -> leaf litter (priority 240), `chest_obstruction: never`.
- Sapling: random-tick growth needs light 9 above; soils include mycelium; native flower pot. Bone meal (45 % to advance a stage,
  particle) delegates to `advance()`/`growTree()`, which check soil and reservation. 2x2 groups grow the Great Mallorn;
  the job rechecks saplings/soil/trunk at start and places the trunk before the canopy.
- Great Mallorn sprout may be potted like a sapling (owner 2026-10-23). Great nut stays non-fuel, non-compost.
- Leaf decay: reach 10, 4000 nodes, 1200-tick path cache; accepts vanilla and mixed-species logs/leaves.
- Game check: vanilla oak leaves touching only a Mallorn log (reverse recognition).

## Flora and Western Corn
- Flowers/herbs/fern: pots, compost 65, dyes (Elanor yellow, Niphredil white), suspicious-stew recipes, extra soils
  (mycelium, pale moss, muddy mangrove roots). Bone meal spreads them; fallen covers ignore bone meal (owner).
- Corn: seeds place only on farmland (`block_placer` + `!wild` permutation filter); random tick rolls first against
  `MAX_GROW_CHANCE` (0.4), then reads soil/crowding; wild corn (worldgen) never grows.
- Bees, villager farmers: not supported (hardcoded vanilla lists).

## Ground cover and dew
- Litter/blossom stack to 4 per cell. Top click: native placement, folded into the lower cover in `playerPlaceBlock`
  (a full lower cover refuses). Side or neighbour click: cancelled, merged next tick.
- Dew forms by random tick under Mallorn leaves in the morning window (40-block leaf scan, roofs ignored by owner decision),
  stays collectible; glass bottle -> Dew bottle (8 drops) -> Bottle of morning dew. Supports: owner-chosen full-top
  surfaces (the 340-id list lives in the block JSON and `support_policies.js`).
- Known limit: the cover support list is a full-cube list, not a geometry test.

## Lights, decor, ropes
- Lanterns/chandelier: chandelier = 4 lanterns (tag `lothlorien:elven_lantern`, either metal) + antler, stack 64.
- Rope: unrolls down then up, one piece per item, one stack subtraction; breaking or losing the wall drops the whole
  column (respects `doTileDrops`). Fuel 15 s. Crafting returns the dew bottle.
- Climbing is a script workaround (no climbable custom block): Jump/forward = levitation, idle = slow falling, crouch holds.
  Owner-tuned 4-tick grants re-applied every tick; our effect is told from a potion's by duration (<= 4 ticks is ours).
  Player-only (owner).
- Game check: climbing feel after the 1855fa8 revert; rope with a Slow Falling potion running.

## Food and remedies
- Salve converts to a glass bottle; Miruvor is a 4-sip durability skin (30 s cooldown after a completed sip, started
  only after the effects); Lembas compost 85; venison/swan meat cook in all four stations.
- Crafting returns glass bottles (vanilla `honey_block` result-array pattern): Miruvor 4, rope 1, star canopy 3 (2026-10-23).
  Game check: bottles on shift-click and with a full inventory.
- Limits: vanilla wolves/villagers use explicit item lists (custom foods ignored); furnace XP has no schema field.

## Phial
- Offhand Phial places one hidden light block at the holder (ledger written before placing; air only; bounded
  cleanup), and pushes spiders/cave spiders within 8 blocks away from the nearest holder (5-tick pass, 24 per holder,
  type order alternates). Spectators and dead holders are skipped.

## Owner decisions
- 2026-10-23: gate hinge choice by solid neighbours and the exact wall-connection filter are closed as cosmetic limits.
- 2026-10-23: litter replacement (replacing vanilla leaf litter) is not being done.
- 2026-10-23: Great Mallorn sprout is pottable (done).
- Adventure players: no scripted strip/merge (2026-10-23).

## Real limits (accepted)
- No dispenser hooks for bone meal, rope or fireflies (no Script API event).
- Villagers do not farm custom crops; wolves/villagers ignore custom food; planks do not repair vanilla wooden tools.
- Mobs do not recognise custom doors (open/break); no sculk vibration from custom blocks (no API).
- Cover support is a list, not a solidity test; the Great-tree scan can race a player building inside it.
