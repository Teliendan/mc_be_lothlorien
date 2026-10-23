# Ground squirrel (`lothlorien:squirrel`) - design sheet

Parity decisions and limits (offers, sessions, gifts, powder-snow walking, lead anchor): [parity/CREATURES.md](../parity/CREATURES.md).
Only domesticated squirrels stay: existing outside/leashed feeding adds kept
persistence, while inside wild healing and errands do not. No new pet ownership.
Earlier dated observations below retain their exact historical scope.

2026-10-11 care update (source/offline evidence; Bedrock 1.26.52; owner accepted as done; no new game test results supplied): Lead support added; a lead interrupts an errand. Outside Lothlorien, acorns are ordinary food, restore 2 HP and keep the squirrel persistent, without starting a gift or changing its cooldown. Inside, existing Friend/gift rules remain; injured Friends can feed it for healing before an errand.
See [Bringing wildlife home](BRINGING_HOME.md) for current policy and acceptance checks.

Archetype: small shy ground animal with a gift errand. Analogue: rabbit/chicken for the body, the white deer for the errand
(guide beacon, `follow_target_leader`). Phase 15, built 2026-10-02, **tried in game by the owner the same day: works very well** (spawn, wariness, Friend errand and gifts); sounds are placeholders. Owner brief: brown (no gold or silver); give it a nut and, **as a Friend of Lothlorien
only**, it runs off and brings back a small gift; the gifts make leaf litter and ground petals renewable, and sometimes
athelas or corn seeds.
Files: BP `entities/squirrel.json`, `spawn_rules/squirrel.json`, `loot_tables/gifts/squirrel.json`, `scripts/squirrel.js` +
`squirrel_rules.js`, wariness in `scripts/deer.js`. RP `entity/squirrel.entity.json`, `models/entity/squirrel.geo.json`,
`animations/squirrel.animation.json`, `render_controllers/squirrel.render_controllers.json`,
`textures/entity/squirrel/squirrel_{brown,russet,dark}.png`, `sounds.json`, `.lang`. Art: `tools/make_swan_squirrel.py`.

| Area | Decision |
| --- | --- |
| Identity | "Ground Squirrel", egg brown `#7c5232` / cream `#ecdcb4`; families `lothlorien_squirrel`, `mob`. Ground-species design with no added climbing behavior; this is a design choice, not a claim that all Bedrock animal climbing is technically impossible |
| Body | collision 0.4 x 0.5, 4 hp, speed 0.28, no attack. No baby, breeding, taming or riding. Nameable/leashable; also native leashable_to anchor and can_stand_on_powder_snow. A lead interrupts an errand. Powder-snow walking adds no freezing immunity |
| Coat | property `lothlorien:coat`: brown 55 % / russet 25 % / dark brown 20 % (random on spawn, client synced). Pale and dark flank stripes, cream belly, banded plume tail |
| Spawn | surface on grass or dirt, biome tag `lothlorien`, light 7-15, herd 1-2, weight 12, `density_limit.surface 6`, distance 12-40, pool `animal` |
| Despawn | standard `despawn_from_distance`; name tag or existing outside/leashed feeding keeps it. Inside wild healing/errands intentionally do not add persistence (owner2026-10-20); existing kept animals retain their group |
| Behaviour | 0 float, 1 panic (x1.5), 3 tempt (Mallorn acorn, calm and Friend states only), 4 avoid (Harmony wariness states), 6 stroll, 7 look at player, 8 look around |
| Harmony | the deer's states and distances by band (see `swan.md`), via `deer.js`; a player holding a Mallorn acorn does not scare it in calm and Friend states. A player kill costs 3 Harmony (an animal) |
| The offer | right-click holding a Mallorn acorn (`minecraft:interact` entry, "Offer Acorn"). Refused, acorn kept: Harmony below 0, not Friend, cooldown or no standable spot 10-14 blocks away. Outside Lothlorien (depth 0) the acorn is ordinary food. Creative Friend incurs no food charge |
| The errand | Friend only. The acorn is eaten when the errand starts. `state_guiding` follows a moved guide_beacon: away10-14 blocks (20s at most), dig3-5s, return. Within 2.5 blocks horizontally (and 2 vertically) of the player, every stack rolled from the table is spawned at its feet, then cooldown, optional hearts and chat. No terrain clearing or teleport |
| Endings | player40+ horizontal blocks away,2min, lost Friend/dead/invalid/Spectator player, dead/invalid squirrel, original-dimension departure, lead or alarm end it without a gift; acorn is gone. An errand that cannot finish (for example the player stands on an unreachable platform) ends at the 2 min cap with the abort message. Optional deed errors do not interrupt accepted errands |
| Cooldown | 10 minutes of world time after known delivery (`lothlorien:gift_ready_at`). Set when the gift is spawned |
| Gift table | `loot_tables/gifts/squirrel.json`, one roll; unchanged four entries: leaf litter28 x2-4, Mallorn blossom28 x2-4, Western Corn seeds14 x1-3, athelas8 x1-2. Earlier extra flowers/acorn list was stale; none restored. Balance source is the loot table |
| Drops | none (XP 1-2 on player kill) |
| Animations | procedural Molang: `idle` (tail and head sway), `walk` (diagonal legs, body bob, tail), vanilla `look_at_target` |
| Sounds | **placeholder**: vanilla rabbit sounds at pitch 1.5-1.9, a faint chicken step |

## To test in game (1.26.52)

1. Do squirrels appear by day on the forest floor, singly or in pairs, in three browns?
2. They keep their distance; holding an acorn, a calm squirrel comes up to you.
3. Not a Friend (`/scriptevent lothlorien:harmony 0` sets Guest): "does not trust you yet", acorn kept.
4. Friend (10 minutes at 0 points inside the biome): offer an acorn. Does it run off, dig, come back to you (even if you walk
   away a little), and drop the native rolled stack at its feet? Group13 replaces the previously tested command
   with pinned LootTableManager/spawnItem; this native path needs a fresh game check. Second acorn after delivery: "busy with its stash".
5. **Open question**: does the follow goal reach a beacon that is moved around, and does the squirrel keep up when you move?
   Hurt it during the errand: it drops the errand.
