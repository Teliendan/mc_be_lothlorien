# Root shrine

Accepted by the owner on 2026-10-16: "Good, this is done." Target Bedrock 1.26.52. Acceptance is overall; pot retrieval and
Mending were not reported separately. The hillside result of the 2026-10-24 foundation fix is not recorded as checked in game.

## Final design and owner decisions

A complete plain round Great Mallorn shelters an uninhabited, ground-level nook among unequal spreading roots. The roughly
5 x 4 interior has standing headroom, a moss floor, four niphredil, two elanor and modest moss accents. Existing assets only; no
stone, new items or models, residents or recurring scripts.

Two log feet carry a three-slab silver offering shelf with a heartwood centre. The decorated pot holds one full
`lothlorien:morning_dew` bottle (eight drops); a full air cell above it exposes the neck. Two shelf groups of three and two lit
white candles and a three-candle floor group surround a white and green kneeling mat. The main green/lime banner hangs inside on
the east root, facing the mat; its six layers keep their order and only the light-gray border changes to white.

A concealed chest in the west root has open lid clearance and standing access. It guarantees one Mending I book (an
implementation choice the owner left open), plus provisions and herbs/salve. No emeralds, Great Mallorn nuts or final elf
gifts. Leaves are persistent. Unused template cells are structure void; explicit air only carves the recess, approach and
display/hanging clearance.

Owner correction, 2026-10-24: hills can expose the roots and the thin interior floor, so dirt now fills beneath the moss and
flower floor and the short approach down to the roots' lowest layer (local y -5), preserving buried wood. The visible floor,
roots and placement height are unchanged. This gives the interior a solid foundation; it does not fit the whole tree to a slope.

## Generation

The shrine is one of four kinds on the natural tree grid: `lothlorien:tree_grid_shrine`, weight 18 of 80 (22.5 % of grid
candidates; random per candidate, not one in every four). Spacing, salt, biome filter and height projection are those of the
giants (`WORLDGEN.md`). A shared trunk anchor sits five blocks below ground at template [19, 0, 19] with the final state Mallorn
log, so the shrine uses the same rotation and ground alignment as the other giants. Worldgen changes need a new world.

ID `lothlorien:root_shrine_01`, size 40 x 54 x 40, offset [18, 5, 18]. To place a copy by hand on level ground:

```mcfunction
/structure load lothlorien:root_shrine_01 ~-19 ~-5 ~-8
```

The entrance is about four blocks south (+Z); the full tree is included. A manual load keeps the invisible buried jigsaw anchor,
which natural placement replaces with a Mallorn log. Placed copies keep their saved blocks and pot contents.

## Build and tests

`node tools/build_root_shrine.mjs` rebuilds the structure, its chest loot table and the shared weighted pool;
`node tools/build_structures.mjs` rebuilds all selected giants plus the shrine. `--preview` on the shrine builder renders
disposable images into `temp/root-shrine/` (they approximate native pots and candles). `tests/root_shrine.mjs` checks
walkability, root connections, display/flower/banner supports, chest clearance, persistent crown, no clipped cells,
determinism, the native fixed pot contents, banner NBT, guaranteed Mending, no emeralds, the serialized anchor and the
placement weights. Native pot fields were checked against engine-saved data; reusable evidence: workspace
`.claude/skills/bedrock-modding/references/16-native-pot-contents.md`.
