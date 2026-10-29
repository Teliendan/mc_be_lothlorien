# Songbird (`lothlorien:songbird`) - design sheet

2026-10-11 care update (source/offline evidence; Bedrock 1.26.52; owner accepted as done; no new game test results supplied): Wheat and Western Corn grain lure vertically and feed/heal the bird by 2 HP. Feeding keeps it persistent. Existing lead support remains; no breeding.
See [Bringing wildlife home](BRINGING_HOME.md) for current policy and acceptance checks.

Archetype: independent woodland flyer. Analogue: parrot flight and native care;
pool `animal`. Ground landing is allowed; tree landing and following are off. Sound playback was accepted in game on 2026-10-16; other checks below remain pending.
Files: BP `entities/songbird.json`, `spawn_rules/songbird.json`, `loot_tables/entities/songbird.json`. RP
`entity/songbird.entity.json`, `models/entity/songbird.geo.json`, `animations/songbird.animation.json`,
`render_controllers/songbird.render_controllers.json`, `textures/entity/songbird/`, `sounds.json`, `.lang`.
Art: `tools/make_songbird.py` (art-only generated box model, three plumages; same method as the deer).

| Area | Decision |
| --- | --- |
| Identity | "Songbird", egg grey-blue `#8e9bb0` / amber `#d29c3e`; families `lothlorien_songbird`, `mob` (distinct family, not a guarantee that every vanilla mob ignores it) |
| Body | collision 0.4 x 0.5, 4 hp, speed 0.4, no attack. No baby, no breeding, no taming, no riding (owner: "do not over-engineer") |
| Plumage | property `lothlorien:plumage` blue 40 % / yellow 30 % / pink 30 % (random on spawn, client synced) picks the texture |
| Spawn | surface, on grass or dirt (the leaf-block filter was dropped 2026-10-02: no natural spawns met in game), biome tag `lothlorien`, light 8-15 (light gate, not a strict clock restriction), herd 2-4, weight 40, `density_limit.surface 10`, distance 10-40, pool `animal` like the parrot, deer, cows (switched from `ambient` 2026-10-02: no natural spawns met in game, and vanilla only uses `ambient` for the underground bat; unverified that this was the cause) |
| Despawn | standard `despawn_from_distance`; a name tag keeps it |
| Movement | flies (`navigation.fly`, `movement.fly`), no fall damage, floats on water, lava 4/tick |
| Behaviour | 1 float, 1 panic (x1.25), 2 grain tempt (vertical, radius 12), 3 `random_fly` (xz 16, y 2, **no tree landing**), 5 look at player, 6 look around. Speed 0.4 (parrot) |
| Tree landing | **Off** (2026-10-02, owner: flight looked like diving). With `can_land_on_trees: true` the birds climbed high and dropped back down while moving only a block or two forward: in the Mallorn forest a trunk or canopy block is always within reach, and tree targets sit close sideways but far up or down. Without it they fly level and land on the ground; no canopy perching. Not yet re-tested in game |
| Following / transport | Independent flight by owner choice 2026-10-20; no follow_mob or same-species flock goal. Existing lead plus native leashable_to anchor. No parrot taming/sit/shoulder/teleport/mimic/dance/cookie-poison behavior. |
| Player / Harmony | none: it does not flee from players beyond panic and ignores the Harmony band (the deer carry that); a player kill costs 3 Harmony (an animal) |
| Drops | feather 0-1 (looting +0-1), XP 1-2 on player kill |
| Animations | procedural Molang: `idle` (tail and head tilt), `hop` (on ground), `fly` (wing flap, legs tucked, only while not on ground), vanilla `look_at_target` on bone `head` |
| Sounds | Owner accepted woodland-song versions 2/3 on 2026-10-16; version 1 removed as weak. Two random ambient phrases, neutral category, event gain 0.45, pitch 0.96-1.04, native configured interval 14-36 s. Existing parrot hurt/death/step/fly retained. Owner confirmed deployed sounds work and are liked in game on 2026-10-16; see `../BIRDSONG.md` |

## Vanilla parity

Owner chose no flocking (2026-10-20): `follow_mob` removed, songbirds fly independently. Songbirds have a native
`leashable_to` anchor. Three plumages, spawn balance, care, art and sounds unchanged. Decisions: [parity/CREATURES.md](../parity/CREATURES.md)

1. Observe blue/yellow/pink birds on existing suitable terrain; no worldgen change.
2. Check independent flight without following other species, ground landing and
   no canopy landing. Existing flap/wing signs and density remain native checks.
3. Check lead anchors, cutting/towing, lure/heal/full-health persistence and reload.
4. Check feather/XP drops and ordinary naming. No new pet/trick features expected.
