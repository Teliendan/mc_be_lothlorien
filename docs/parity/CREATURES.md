# Creatures: vanilla parity (final design, decisions, limits)

Bedrock 1.26.52, Script API 2.8.0. Condensed 2026-10-23 from the per-group ledgers (deer, swan/squirrel, unicorn,
small flyers, NPC, helpers, native healing, synchronous validation); history: git `1855fa8` and earlier. Species
design sheets stay in [../mobs/](../mobs/). Rules followed: workspace `AGENTS.md` "Vanilla parity" (reachability
first, no guards for states the game cannot produce, after a one-tick defer re-check only the target and the
selected slot's item type, native JSON before script).

## Shared
- Wary types (deer, white deer, swan, squirrel, unicorn): `deer.js` picks the wariness state from the nearest living
  living non-Spectator player's Harmony band; one 40-tick interval, event-tracked set, stops when empty.
  Spectator/dead players are ignored. Creative players count since 2026-10-26 (the owner tested the unicorn lure in
  Creative and it never left the calm state; vanilla lures work in Creative); the engine still never flees them.
- Interaction handlers (white deer, squirrel, unicorn): one gate (entity type + held item from `beforeItemStack`),
  then game rules. No `repeatedUse` debounce: the `minecraft:interact` entries carry `"cooldown": 1`. No re-check of
  player/target validity, dimension, reach or hand inside the same callback.
- Depth (`depth.js`): owner policy 2026-10-20, skip unreadable outer samples and prefer an optimistic heart over
  rare animals only in explored terrain. `level` 0 (outside, river-only, or an unreadable centre) counts as outside.
- Gift particles and optional deeds never block delivery; item spawn is not fall-backed (a throw is not retried).
- Fed habituation ("tame" internally) is persistence, not wolf-like ownership.

## Deer and white deer
- Ordinary deer: corn-grain lure/breeding/growth, adult-only leather/venison, no healing from breeding food, no
  terrain-eating grazing. Owner-accepted: nearby guide beacons may cross-follow.
- White deer: solitary adult, no breeding/riding. A Friend of Lothlorien inside the forest offers a Mallorn acorn:
  once in its life it walks to a spot 36-56 blocks away (inside Lothlorien, clear ground) and lays a Great Mallorn nut.
  Never moved by script; the engine navigator follows an invisible guide beacon that the script moves in hops.
  Outside Lothlorien an acorn only feeds/heals it. Leashed/alarmed deer do not lead. Injured deer eat the acorn.
- Stored `GIFT_SPOT` (dynamic property) survives a broken-off guidance. A kept spot that is no longer clear or inside
  Lothlorien is cleared and a new spot is searched on the next acorn. On arrival, a spot that went bad is cleared
  (message "no spot"; the next acorn searches again), so the lifetime gift is never lost silently (fixed 2026-10-23).
- The gift-spot search is a job (yields); when it returns, only deer alive, same dimension, same selected slot and
  an acorn in it are re-checked.
- Beacon strays: startup sweep, entityLoad cleanup, 330 s native timer (the entitySpawn path was dropped).
- Natural spawns are thinned by depth (`SPAWN_KEEP_BY_DEPTH` 0 / .15 / .5 / 1); eggs and summons are not.

## Swans and squirrels
- Swans: natural spawn needs a readable Lothlorien sample within 48 blocks (owner 2026-10-20; missing-only samples
  remove a natural swan; eggs, summons and born cygnets exempt). Adult feather shedding, wheat/corn breeding, fall
  `damage_sensor` (= chicken). Breeders do not heal.
- Squirrels: acorn from a Friend inside Lothlorien starts an errand (10-14 blocks away, dig 3-5 s, return, gift from
  `loot_tables/gifts/squirrel.json`, 4 weighted entries; every rolled stack is spawned). Cooldown in the
  `gift_ready_at` dynamic property. Not a Friend: refusal messages; outside Lothlorien and leashed squirrels are fed
  (domesticated = persistent). Inside, feeding does not domesticate (owner 2026-10-20). Powder-snow walking,
  `leashable_to`, no freezing immunity.
- The gift drops at the squirrel's position with no drop-space test (it occupies that cell). Hand-over needs the
  player within 2.5 blocks horizontally and 2 blocks vertically; otherwise it keeps returning. Every errand that
  cannot finish ends at the 2-minute cap with the "abort" message (2026-10-23).
- Errand sessions re-check each 10 ticks: both alive, Friend, still guiding, not alarmed/leashed, same dimension,
  inside Lothlorien (level > 0).

## Unicorn
- Taming: three Elanor offers from a Friend, 10 s apart, each healing 2 HP; the third bonds it to that player (owner id in
  a dynamic property) and it becomes rideable without a saddle. Only the owner may ride, mount, feed or name a bonded
  unicorn (the before event cancels others; owner decision 2026-10-20). No equipment, inventory, leads, breeding.
- Bonded healing is the native `minecraft:healable` (Elanor, 2 HP, `force_use:false`) in the bonded group; no script
  queue. Full-health Elanor mounts normally.
- Friend-only lure: `follow_target_leader` filtered to a player with the `lothlorien_friend` tag holding Elanor;
  the Harmony service syncs the tag. The no-flight exemption uses the same predicate.
- Swimming copies the installed 1.26.50 horse float/buoyant data; no water breathing, lava damage kept.
- Death of a bonded unicorn tells its owner (`unicorn.died`, all shipped languages), like a tamed wolf or horse
  (owner decision 2026-10-23; `entityDie` filtered to the unicorn type).
- Wild unicorns do not react to Elanor while alarmed (no interact entry in that state), so there is no alarmed message.
- Known limits: fall-damage reduction and passive regeneration of horses are engine-hardcoded for `minecraft:horse`
  and cannot apply to a custom entity (installed `horse.json` has neither component); closed, not tracked.

## Songbird, butterfly, firefly
- Owner 2026-10-20: songbirds fly independently (`follow_mob` removed, no flock substitute). `leashable_to` on
  songbird and butterfly; `emit_flap` on butterfly and firefly; native grain/flower healing and persistence.
- Intentional omissions: no parrot pet/shoulder/cookie rules, no bee hive/pollination/poison, no butterfly bottle.
- Firefly bottle: the script owns catch/release (before event, next tick). A bottled firefly keeps its name and
  injured health in localized RawMessage lore (stackable items cannot hold dynamic properties in API 2.8); a healthy
  unnamed catch stays plain. Name parts are split at 24 UTF-16 units to respect the 50-character lore line.
  Release spawns the `released` variant, restores name/health, then swaps the bottle for glass. No validation of
  lore the script wrote itself, no rollback of spawn/write steps (they do not fail on live objects).
- Known limit: no dispenser capture/release (no dispenser hook for custom items).
- Identical-looking captured bottles stack only when name and health lore match; native merge not simulated.

## Elves and wardens
- Elves: five fixed professions (gardener, healer, woodwright, lamplighter, loremaster), nonrenewable village
  residents, native shops with custom prices and Renown, lead/rehome for civilians (any unleash records the new home).
  Owner decisions 2026-10-20: native shears cutting wins over dialogs/shops (`elf_native_use.js`, prompt filters
  exclude the cut case); wardens accept leads (first leash makes even a natural guard permanent, release sets home,
  radius 20) and act as lead anchors; elf families are `lothlorien_elf, wandering_trader, mob`; the simple custom NPC
  roles stay without villager POI/job/restock/breeding/raid systems.
- Owner awareness: the `wandering_trader` family makes zombies and illagers hunt elves; elves are not replaced after
  death. If elves die in playtests, look at this change first.
- Wardens: natural (Lothlorien ground/deck, depth-thinned), persistent village/watch-camp guards (bow, arrows,
  gear loot). `warden_replace.js` replaces structure wardens that loaded with default attributes; it now checks the
  entity type before scheduling its one-tick timeout.
- Failed village post: every post is removed after population (the planner never runs again for that village), the
  failure is only logged.

## Helpers (invisible actors)
`guide_beacon` (white deer / squirrel waypoint, 330 s native expiry), `elf_post` (one-shot population point),
`loop_marker` (village planner trigger), `rail_mender` (fence repair trigger), `phial_light` (block, see
[BLOCKS_ITEMS.md](BLOCKS_ITEMS.md)). 0.1 x 0.1, no gravity/collision, damage suppressed.
- Planner timeout cleanup (owner approved 2026-10-21): unique area id per attempt, ownership record, a creation that
  settles after the 600-tick timeout is removed; serial planning and quota backoff stay.
- Declined, no reachable trigger: elf-post retry service; `cannot_be_attacked` (default hostile filters do not match
  helper families). Reopen only with an observed problem.

## In-game checks still worth doing
1. White deer: acorn with a blocked/flooded kept spot searches a new one; lay the gift on arrival.
2. Squirrel errand on a platform/step: it ends with the abort message after 2 minutes; normal errand drops the gift.
3. Unicorn: bonded heal vs mount with Elanor, swimming (ridden/unridden, bank exit), Friend lure retarget with a Guest
   nearby, owner message on death.
4. Songbird independent flight; leash songbird/butterfly; named/injured firefly catch and release, bottle stacking.
5. Elves/wardens: lead, cut with shears (all professions), rehome after reload; zombie/illager vs elf, skeleton vs warden.
6. Village planner on a slow device (timeout cleanup); leave/re-enter the world after every change.
