# Swan (`lothlorien:swan`) - design sheet

2026-10-11 care update (source/offline evidence; Bedrock 1.26.52; owner accepted as done; no new game test results supplied): Wheat and Western Corn grain lure in calm/Friend states and breed adults; there is no food healing because swans breed. Cygnets follow parents, grow in 20 minutes and grow faster with grain. Born cygnets stay persistent. Natural spawns include 10% cygnets and use the existing near-Lothlorien river check. Old loaded adults acquire breeding groups; babies retain their age. Cygnets use the adult model scaled to 45%.
See [Bringing wildlife home](BRINGING_HOME.md) for current policy and acceptance checks.

Archetype: calm water bird on the rivers and pools. Analogue: chicken (floats on water, walks ashore) for movement,
the deer for Harmony wariness. Phase 15, built 2026-10-02, **tried in game 2026-10-02: floats on the surface (chicken setup), still dips up to half a neck deep now and then; owner decided to leave it** (Movement row has the failed attempts). Owner brief: a white swan (no gold or silver on the animals), keeps its distance from players
by Harmony band like the deer, "makes the forest more alive and ambient".
Files: BP `entities/swan.json`, `spawn_rules/swan.json`, `loot_tables/entities/swan.json`, `scripts/swan.js` + `swan_rules.js`
(spawn judging), wariness in `scripts/deer.js`. RP `entity/swan.entity.json`, `models/entity/swan.geo.json`,
`animations/swan.animation.json`, `render_controllers/swan.render_controllers.json`, `textures/entity/swan/swan.png`,
`sounds.json`, `.lang`. Art: `tools/make_swan_squirrel.py` (generated box model, rotation-free: the curved neck is stepped boxes).

| Area | Decision |
| --- | --- |
| Identity | "Swan", egg white `#f2f4f8` / orange `#e0702a`; families `lothlorien_swan`, `mob`; `spawn_category` `water_creature` |
| Body | collision 0.8 x 1.2, 10 hp, no attack. Breedable adults and 45%-scale cygnets (2026-10-11 care update above); no taming or riding. Leashable, nameable |
| Plumage | one white texture (cool violet shadows), orange beak with a dark knob, black lore and legs. Models also have separate wings and a tail |
| Spawn | **rivers are their own biome**, so the filter is `any_of` the `lothlorien` tag or the `river` tag; `spawns_on_surface` + `spawns_underwater` (like the salmon), pool `water_animal`, weight 10, herd 1-2, `density_limit.surface 3`, distance 12-40 |
| River judging | rivers all over the world pass that filter, so each natural spawn (herd event `lothlorien:spawn_natural` sets `lothlorien:natural`) is judged once in `swan.js`: it stays only if the Lothlorien biome is within 48 blocks (the spot plus 3 rings x 8 headings, `nearBiome` in `swan_rules.js`), else it is removed one tick later. `/summon` and eggs always stay |
| Despawn | standard `despawn_from_distance`; a name tag keeps it |
| Movement | chicken setup: `movement.basic`, `navigation.walk` with `can_path_over_water`, `behavior.float` (priority 0) keeps it on the surface. **First try (turtle's amphibious `navigation.generic` + `random_swim`, `can_sink false`) made the swans dive and swim like fish (owner, 2026-10-02): never use `random_swim` or amphibious navigation for a surface bird.** **Second try 2026-10-02 failed**: float goal alone floats but dips up to half a neck deep now and then (owner); adding `minecraft:buoyant` (as the boat has it, plus `base_buoyancy`, `simulate_waves`) logged "simulate_waves not valid here" and the swans sank straight to the bottom. Removed again; back to the float goal. Open: the occasional dip (options: raise the model in `swim`, tune `float`, or `buoyant` with `liquid_blocks` only, untried). `breathes_air` and `breathes_water`; lava 4/tick |
| Behaviour | 1 panic (x1.4), 4 avoid (Harmony wariness states, below), 0 float, 6 `random_stroll` (on land and across the water surface), 7 look at player, 8 look around |
| Harmony | the deer's states and flight distances by band (Guest = calm 10 / 5 sneaking, Uneasy = l1 13, Shunned = l2 20, Hated = l3 30, Friend 3, alarmed 36 for 20 s), set by `deer.js` (`WARY_TYPES`); hurting or killing any deer, swan or squirrel alarms every one of them within 20 blocks; wolves and monsters scare it too. A player kill costs 3 Harmony (an animal), counted when the player or the swan is inside the forest |
| Drops | Death: feather 1-2 (looting +0-1) and exactly one swan meat (owner quantity, 2026-10-14; no Looting meat bonus), XP 1-3 on player kill. Living adults: one ordinary feather every random 60-300 seconds using native `minecraft:spawn_entity`; no script polling. Cygnets do not shed |
| Animations | procedural Molang: `idle` (neck and tail sway), `walk` (waddle, on land), `swim` (sinks 1.5 units into the water, legs paddle), vanilla `look_at_target`; Blockbench-authored 1.35-second one-shot feather shake (body/neck/tail ruffle and slight wing lift) |
| Sounds | **placeholder**: vanilla chicken sounds at pitch 0.7-0.9; real honks are Phase 18 |

## To test in game (1.26.52, new world or new chunks)

1. Do swans appear on a river that crosses or touches the biome, and on shallow water inside it? Not on a river far away
   (judging; a few may flicker in and vanish)?
2. **Open question**: with the chicken setup, do they float on the surface and drift across the water (not sink, not bob wildly),
   and does `random_stroll` take them over water at all, or do they sit still and only waddle on shore?
3. Do they swim away at the distances above; a lower band (Uneasy, Shunned, Hated) widens it; Friend lets you come within 3 blocks.
4. Count stays bounded (`density_limit` 3, pool `water_animal` shared with fish and dolphins); kill one: feather.
5. Is the model right (neck, beak, wings), and does the colour fit the forest next to the white deer?

## Feather shedding and meat (2026-10-14)

Implementation commit: `Finish swan drops and visible feather shedding`.
Target Bedrock 1.26.52 / Script API 2.8.0. Owner confirmed the shake looks right,
found a naturally shed feather and confirmed the five-second native test works.
The original 10-20 minute interval was too rare for players to discover the
mechanic. Owner selected **1-5 minutes**, compared with vanilla chicken eggs at
5-10 minutes (installed current chicken definition). The new interval is checked
offline; its pacing still needs owner review. Native timer save/resume details,
unloaded time and multiplayer synchronization have not been individually tested.

Living adults drop one ordinary feather using `minecraft:spawn_entity`, with no
added script polling/scans/callbacks. Its item-spawn event toggles the synced
`lothlorien:shed_phase` property; an RP controller plays the 1.35-second shake
once on either edge, then returns to idle. The controller initializes without
replaying old shakes. The feather appears as shaking starts. Empty spawn sound
avoids the egg plop. Existing walk/swim animations continue beneath the shake.
`lothlorien:adult_ready` makes old-adult migration run once, avoiding repeated
re-addition of its native timer. Growing up sets it; cygnets clear it.

Adult death drops **exactly one meat** (owner quantity; no Looting meat bonus),
beside existing feather drops/Looting. Cygnets shed nothing and drop no death
loot. Raw swan meat cooks in a furnace, smoker or campfire; burning deaths use
native `furnace_smelt`. Raw food: nutrition 2 / saturation modifier 0.3; cooked:
6 / 0.6. No raw-food debuff. Food/meat tags match venison. Item names/context
cover all nine locales plus compatibility aliases, with AI-draft translations.
Meat rendering, cooking, eating and burning-drop behavior still need game review.

Art source: `tools/make_swan_shedding.py` authors/exports through Blockbench;
`tools/make_swan_meat.py` generates deterministic 16x16 icons. Geometry/texture
of the bird are unchanged. Accepted shake iteration scratch was removed. Final
meat icon review remains in `temp/swan-meat/review.png` until art acceptance.

For a fast native drop check near an **adult**:
`/event entity @e[type=lothlorien:swan,c=1] lothlorien:test_shedding`.
Wait five seconds nearby; the one-use native test spawner drops a feather,
triggers the normal shake and restores the adult group and normal 1-5 minute
timer. The test briefly pauses breeding but preserves death loot/XP; babies are
excluded and a cygnet transition removes the test group. The older
`lothlorien:shed_feather` event previews only the animation.

Lure with wheat or Western Corn **grain**, not seeds, in calm/Friend states.
Alarm or higher wariness takes precedence. Day-clock commands and crop random
tick speed do not advance the countdown. Reload the world after deployment;
this feature requires no new world. Shared verifier/regressions cover adult-only
configuration, both shake edges, initialization, timer migration, test routing,
exactly-one-meat loot and its cooking path; game acceptance is stated above.
