# Butterfly (`lothlorien:butterfly`) - design sheet

2026-10-11 care update (source/offline evidence; Bedrock 1.26.52; owner accepted as done; no new game test results supplied): Lead support added. Vanilla flowers and Lothlorien Elanor, Niphredil, Mallorn blossom and nectar bloom lure vertically and feed/heal by 2 HP. Feeding keeps it persistent; no breeding.
See [Bringing wildlife home](BRINGING_HOME.md) for current policy and acceptance checks.

Archetype: tiny hovering day flyer (firefly's `random_hover`, see `firefly.md`). Built in `e4087a7`; owner accepted the care update as done (see above). Colour variety, wing flap and density have no separate in-game verdict in the docs.
Files: BP `entities/butterfly.json`, `spawn_rules/butterfly.json`. RP `entity/butterfly.entity.json`, `models/entity/butterfly.geo.json`,
`animations/butterfly.animation.json`, `render_controllers/butterfly.render_controllers.json`, `textures/entity/butterfly/butterfly_<colour>.png`, `.lang`.
Art: `tools/make_butterfly.py` (generated; add a colour by adding it to `COLOURS`, the BP property range/randomize and the RP texture list).

| Area | Decision |
| --- | --- |
| Colours | 8 bright, saturated wing colours (current palette retained): red, orange, yellow, lime, turquoise, blue, violet, pink. Dark rim + pale spots in each. Equal chance |
| Variant | int property `lothlorien:wing` 0-7 (`client_sync`), set at `minecraft:entity_spawned` by `randomize`; render controller picks `Array.wings[property]`. Order = `COLOURS` order |
| Body | collision 0.3 x 0.3, 2 hp, speed 0.06, no attack, no baby/breed/tame/ride, silent, no drops, no XP, no capture by owner-approved design |
| Spawn | surface on grass/dirt, biome tag `lothlorien`, light 8-15 (not a strict clock gate), distance 10-40, herd 3-5, weight 10, `density_limit.surface 10`, pool `animal`; standard `despawn_from_distance` |
| Behaviour | float, panic, `random_hover` (xz 8, y 2, height 1-2 above ground (integers only: fractions fail to load)), look around. No flower targeting or pollination by design; bee integration remains owner-deferred after unsuccessful tests, not a universal engine-impossibility claim |
| Model | 1x1x4 body, 2x2x2 head, two flat 6x6 wings (`mirror` on the right one), 32x32 texture; wings flap +-45 deg about the body (z), body bobs |

## Not separately confirmed in game

1. Is the variety right in a herd of 3-5 (all 8 colours seen)? Are the colours bright enough in Vibrant Visuals?
2. Do the wings flap up/down (not twist), is the wing outline right side up on top and underneath, is the size good at 0.3?
3. Daytime density and height versus songbirds; should they stay lower / rarer?

## Vanilla parity

Leads have native `leashable_to` anchors; movement tracking emits flap game events while audio stays silent. No bee
hives, honey, stinging, colony/breeding/pollination/growth or poisonous-flower rules; no butterfly bottle, extra food or
variant. Accepted food: the explicit 27 vanilla and 4 custom plant items. Check in game: lead anchors/cutting/towing,
flap events at sculk without sound, native food/healing/persistence. Decisions: [parity/CREATURES.md](../parity/CREATURES.md).
