# Root shrine

Accepted by the owner on 2026-10-16: "Good, this is done." Target Bedrock 1.26.52.
Implementation commit pending; shared files also contain unrelated changes.
This records overall acceptance;
individual observations of pot retrieval and Mending were not supplied separately.

## Final design and owner decisions

A complete plain round Great Mallorn shelters an uninhabited, ground-level nook
among unequal spreading roots. The roughly 5 x 4 interior has standing headroom,
a moss floor, four niphredil, two elanor and modest moss accents. Existing assets
only; no stone, new items/models, residents or recurring scripts.

Two log feet carry a three-slab silver offering shelf with a heartwood centre.
The decorated pot contains one full `lothlorien:morning_dew` bottle (eight drops).
A full air cell above the pot exposes its neck. Two shelf groups of three/two lit
white candles and a three-candle floor group surround a white/green kneeling mat.
The main green/lime banner hangs inside on the east root, facing the mat. Its six
layers retain their order; only the light-gray border changes to white here.

A concealed chest in the west root has open lid clearance and standing access.
It guarantees one Mending I book, plus provisions and herbs/salve. No emeralds,
Great Mallorn nuts or final elf gifts. The guaranteed book was an implementation
choice explicitly left to the implementer by the owner.

Leaves are persistent. Unused template cells are structure void; explicit air
only carves the small recess, approach and display/hanging clearance.

## Generation and placement

**Natural generation: 25% of Great Mallorn placements in Lothlorien**, requested by
the owner on 2026-10-16. The existing `lothlorien:giant_mallorn` pool chooses the
shrine with weight 16 and the six existing tree variants with weights 6, 6, 9, 9,
9, 9 (total 64). The existing variants retain their relative proportions. This is
a random choice per placement, not a guarantee of exactly one shrine in every four.

The structure set, salt, spacing 6/separation 2, biome filter and height projection
are unchanged. No additional spawn attempts or separate structure set: the total
Great Mallorn density stays the same. A shared trunk anchor sits five blocks below
ground at template [19, 0, 19], with final state Mallorn log, so the shrine uses the
same rotation and ground alignment as the other giants. Unused cells remain void.
Worldgen registration and serialized anchors are checked offline; natural terrain
placement has not yet been reviewed in game (target 1.26.52, 2026-10-16).
Worldgen changes need a new world.

ID: `lothlorien:root_shrine_01`. Size: 40 x 54 x 40; offset: [18, 5, 18].
Leave/re-enter after deployment, then place a fresh copy on level ground:

```mcfunction
/structure load lothlorien:root_shrine_01 ~-19 ~-5 ~-8
```

The entrance is about four blocks south (+Z). The full tree is included. Previously
placed copies retain their saved blocks and pot contents. Manual structure loads
retain the invisible buried jigsaw anchor; natural jigsaw placement replaces it
with a Mallorn log.

## Build and evidence

From `C:\mcmods\mods\lothlorien`, run `node tools/build_root_shrine.mjs` to rebuild
this structure, its chest loot table and the shared weighted placement pool.
`node tools/build_structures.mjs` rebuilds all six selected giants plus the shrine
and preserves the same pool weights. `--preview` on the shrine builder uses the shared
block-texture renderer and writes disposable images into `temp/root-shrine/`.
Accepted-iteration scratch has been removed; no unused build variants remain.

`tests/root_shrine.mjs` runs through the standard regression suite. It checks
walkability, root connections, display/flower/banner supports, chest clearance,
persistent crown, no clipped cells, deterministic output, native fixed pot contents,
banner NBT, guaranteed Mending, no emeralds, the serialized placement anchor, exact
25% pool share and unchanged placement density. Full verification and deployment
including the worldgen extension passed on 2026-10-16: 0 errors, 0 warnings and
15 documented exceptions; BP and RP confirmed in sync. Natural terrain placement
still needs in-game review in a new world.

Native pot fields were checked against engine-saved world data. Reusable evidence:
workspace `.claude/skills/bedrock-modding/references/16-native-pot-contents.md`
(knowledge commit `a26fde2`). Preview shapes approximate native pots/candles;
owner acceptance comes from the game review.
