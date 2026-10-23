# Firefly (`lothlorien:firefly`) - design sheet

2026-10-11 care update (source/offline evidence; Bedrock 1.26.52; owner accepted as done; no new game test results supplied): Bottle-only care: use a full Bottle of Fireflies against a block face with adjacent air to release one persistent firefly and receive an empty bottle. Wild fireflies retain normal despawn. Catch and release share a debounce and recheck the live hand. No lead, lure, feeding, healing or breeding. Catching and release are scripted; the former native transform was replaced.
See [Bringing wildlife home](BRINGING_HOME.md) for current policy and acceptance checks.

Archetype: tiny hovering night flyer (analogue: bee `navigation.hover` / `random_hover`). Phase 14, built 2026-10-02.
**In game (1.26.52, Vibrant Visuals): glow, bottle icon, night spawning and catching with a glass bottle all work (owner, 2026-10-02).**
Files: BP `entities/firefly.json`, `spawn_rules/firefly.json`, `items/bottle_of_fireflies.json`. RP `entity/firefly.entity.json`,
`models/entity/firefly.geo.json`, `animations/firefly.animation.json`, `render_controllers/firefly.render_controllers.json`,
`textures/entity/firefly.png` (+ `firefly_mers.tga`, `firefly.texture_set.json`), `textures/items/bottle_of_fireflies.png`, `.lang`, `item_texture.json`.
Art: `tools/make_firefly.py` (generated; green abdomen glows). Feature commit: `715d705`.

| Area | Decision |
| --- | --- |
| Body | collision 0.2 x 0.2, 2 hp, speed 0.08, no attack, no baby/breed/tame/ride, silent, no drops, no XP |
| Spawn | surface on grass/dirt, biome tag `lothlorien`, light 0-7 (night/shade rather than a strict clock gate), distance 10-40, herd 2-4, weight 6, `density_limit.surface 6`, pool `animal`; standard `despawn_from_distance` |
| Behaviour | float, panic, `random_hover` (xz 6, y 3, height 1-3 above ground), look around; native flap game events, silent audio |
| Glow | PBR texture set (vanilla glow squid / allay way): `firefly.texture_set.json` + `firefly_mers.tga`, emissive (G) 255 on every face of the green abdomen, 0 elsewhere; works under Vibrant Visuals. Owner: whole abdomen glows (not only the underside), no halo particle. Did not glow: `entity_emissive_alpha` alpha mask, `ignore_lighting` render controller, unlit `particles_alpha` sprite. No dynamic light |
| Catch / release | Main-hand glass bottle on firefly: script-owned before-event then privileged callback; real delayed hand/metadata/dimension/reach/container checks. Captured name/current health stored as visible localized raw lore and restored before bottle exchange. Release against a block face with adjacent air makes one persistent firefly and returns plain glass. |
| Item | Bottle of Fireflies, stack 16, items menu. Icon: vanilla empty bottle with two bright dots and a dim one, each in a lime glow (side 230, diagonal 130 alpha); the rest of the glass stays empty (owner: no green fill). Release and existing jar/lantern ingredient uses are implemented; recipes are resource use, not named-animal enclosures |

## To test in game (1.26.52)

1. Do the wings flutter in the right plane; is the model visible at size 0.2?

## Vanilla parity

Bottle max 16. Healthy unnamed captures stay plain; captured name and injured current health use visible localized
RawMessage lore (stackable items cannot hold dynamic properties). An anvil bottle title does not rename the animal;
empty-glass name/lore never transfers. Only name/current health are saved; health above the restored actor's maximum is
clamped. Check in game: named/injured/fractional-health capture and release, lore persistence across save/reload/locale
switch, bottle merging, full inventory, Creative, insect flap events at sculk (silent). Fireflies stay bottle-only: no
leads, food, breeding; no dispenser capture. Decisions: [parity/CREATURES.md](../parity/CREATURES.md)
