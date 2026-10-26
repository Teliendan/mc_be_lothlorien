// Ground-level woodland shrine. Pure block composition, with the Great Mallorn worldgen anchor.
import { buildFletMallorn, B, ROOT_DEPTH } from "./flet_mallorn.mjs";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { SILVER_WATCH } from "./watch_camp_rules.mjs";
import { anchorMallorn } from "./mallorn_anchor.mjs";

// The main banner, with white replacing light gray only for the shrine.
export const SHRINE_BANNER = {
  ...SILVER_WATCH,
  patterns: SILVER_WATCH.patterns.map((p) => p.color === "silver"
    ? { ...p, color: "white", colorId: 15 } : { ...p }),
};

export const SHRINE = Object.freeze({
  id: "lothlorien:root_shrine_01", seed: 3,
  size: [40, 54, 40], offset: [18, ROOT_DEPTH, 18],
  loot: "loot_tables/chests/root_shrine.json",
  chest: [-2, 0, -2], entrance: [1, 0, -6], offering: [1, 0, -1], cacheStand: [-1, 0, -2],
});
const key = (x, y, z) => `${x},${y},${z}`;
const plain = (name, states = {}) => ({ name, states });

export function buildRootShrine() {
  const tree = buildFletMallorn(makeRandom(SHRINE.seed), { woven: true, lush: true, round: true, flet: false });
  const { blocks } = tree;
  const put = (x, y, z, name, states = {}, extra = {}) => blocks.set(key(x, y, z), { ...plain(name, states), ...extra });
  const air = (x, y, z) => put(x, y, z, "minecraft:air");
  const root = (x, z, h) => {
    for (let y = -ROOT_DEPTH; y <= h; y++) put(x, y, z, y < 0 ? B.log : B.wood,
      y < 0 ? { "minecraft:block_face": "up" } : {});
  };

  // A pair of unequal buttresses curves forward from the existing round foot.
  // They belong to the tree; there is no perimeter wall or excavated basement.
  for (const [x, z, h] of [
    [-2, 0, 5], [-3, -1, 3], [-3, -2, 2], [-3, -3, 1], [-2, -4, 1], [-2, -5, 0], [-1, -6, 0],
    [4, 0, 6], [5, -1, 4], [5, -2, 2], [5, -3, 1], [4, -4, 1], [4, -5, 0], [3, -6, 0], [4, -7, 0],
    [-2, -1, 4], [-2, -3, 2], [4, -1, 5], [4, -2, 3], [4, -3, 2],
  ]) root(x, z, h);
  // Unequal, narrowing root shoulders over the shallow recess, joined to the trunk.
  // No rectangular roof plate: the forward overhang tapers down to a single root tip.
  for (const [z, x0, x1, y] of [[0, -2, 4, 4], [-1, -1, 3, 4], [-2, 0, 2, 3], [-3, 1, 1, 3]]) {
    for (let x = x0; x <= x1; x++) put(x, y, z, B.wood);
  }
  put(3, 3, -2, B.wood); // the projecting root joins the east buttress at the same height
  put(3, 3, -1, B.wood);
  for (const [x, y, z] of [[-1, 5, 0], [0, 5, -1], [1, 5, -1], [3, 5, 0], [4, 5, 0]]) put(x, y, z, B.wood);
  for (const [x, y, z] of [[-3, 4, -1], [-2, 3, -3], [4, 2, -4], [5, 3, -2]]) put(x, y, z, "minecraft:moss_carpet");

  // Only the room and its short approach are air: all unused template cells remain void.
  for (let x = -1; x <= 3; x++) for (let z = -4; z <= -1; z++) for (let y = 0; y <= 2; y++) air(x, y, z);
  for (let z = -7; z <= -5; z++) for (let x = 0; x <= 2; x++) for (let y = 0; y <= 2; y++) air(x, y, z);
  for (let x = 0; x <= 2; x++) for (let y = 0; y <= 2; y++) air(x, y, 0);
  // Small moss floor repairs immediate shrine terrain without flattening the surrounding forest.
  for (let z = -7; z <= 0; z++) for (let x = -2; x <= 4; x++) {
    if (z < -4 && (x < 0 || x > 2)) continue;
    if (blocks.get(key(x, -1, z))?.name === B.log && !(x >= -1 && x <= 3 && z <= -1)) continue;
    put(x, -1, z, "minecraft:moss_block");
  }

  // Two bark supports and three silver slabs; the centre golden inset carries an ordinary vanilla pot.
  for (const x of [0, 2]) put(x, 0, 0, B.log, { "minecraft:block_face": "up" });
  for (let x = 0; x <= 2; x++) put(x, 1, 0,
    x === 1 ? "lothlorien:mallorn_heartwood_slab" : "lothlorien:mallorn_slab", { "minecraft:vertical_half": "top" });
  // The original trunk touched the pot's top and hid its neck. Open a full air cell
  // above the whole display; the root shoulder at y=4 still shelters the niche.
  for (let x = 0; x <= 2; x++) air(x, 3, 0);
  put(1, 2, 0, "minecraft:decorated_pot", { direction: 0 }, {
    potItem: { name: "lothlorien:morning_dew", count: 1 },
  });
  for (const [x, count] of [[0, 3], [2, 2]]) put(x, 2, 0, "minecraft:white_candle", { candles: count - 1, lit: true });
  // Main banner hangs on the inside face of the east root, facing the prayer mat.
  // Its cloth sits against the wall, clear of the shelf and the standing aisle.
  put(3, 2, -2, "minecraft:wall_banner", { facing_direction: 4 }, { banner: SHRINE_BANNER });
  air(3, 1, -2);
  // A small prayer mat gives the open moss floor an intentional place to pause.
  for (let x = 0; x <= 2; x++) put(x, 0, -2, "minecraft:white_carpet");
  put(1, 0, -3, "minecraft:green_carpet");
  put(3, 0, -2, "minecraft:white_candle", { candles: 2, lit: true });
  // Flowers are planted in full supported soil blocks, never on a slab or a root.
  const flowers = [[-1, -1], [3, -1], [-1, -4], [3, -4]];
  for (const [x, z] of flowers) {
    put(x, -1, z, "minecraft:grass_block");
    put(x, 0, z, "lothlorien:niphredil", { "lothlorien:on_grass": false });
  }
  for (const x of [-1, 3]) {
    put(x, -1, -3, "minecraft:grass_block");
    put(x, 0, -3, "lothlorien:elanor", { "lothlorien:on_grass": false });
    flowers.push([x, -3]);
  }

  // The return of the west root conceals this side pocket from the central approach.
  // It is open sideways, with an air block above the chest lid and a standing cell beside it.
  put(...SHRINE.chest, "minecraft:chest", { "minecraft:cardinal_direction": "east" }, { loot: SHRINE.loot });
  for (let y = 1; y <= 2; y++) air(-2, y, -2);
  for (let y = 0; y <= 2; y++) air(-1, y, -2);
  // Leaves persist even if a player trims a root or branch while inspecting the shrine.
  for (const b of blocks.values()) if (b.name === B.leaves) b.states["lothlorien:persistent"] = true;
  anchorMallorn(blocks);
  // Invisible sound source under the root shoulder above the mat (docs/SOUNDSCAPE_PLAN.md): its native ambient timer rings the shrine tone.
  const entities = [{ id: "lothlorien:shrine_sound", x: 1.5, y: 2.6, z: -2.5 }];
  return { ...tree, blocks, flowers, entities };
}

export function rootShrineLoot() {
  const item = (name, min, max) => ({ type: "item", name, weight: 1,
    functions: [{ function: "set_count", count: min === max ? min : { min, max } }] });
  const mending = item("minecraft:book", 1, 1);
  mending.functions.push({ function: "specific_enchants", enchants: [{ id: "mending", level: 1 }] });
  return { pools: [
    { rolls: 1, entries: [item("lothlorien:lembas_wrapped", 1, 2), item("lothlorien:miruvor", 1, 1)] },
    { rolls: 2, entries: [item("lothlorien:athelas_salve", 1, 1), item("lothlorien:athelas", 2, 4)] },
    { rolls: 1, entries: [mending] },
  ] };
}
