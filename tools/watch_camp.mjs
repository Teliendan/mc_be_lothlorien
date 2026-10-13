// Build-time furnishing only: no new game timer, custom block or spawn loop.
import { B } from "./flet_mallorn.mjs";
import { CAMP, SILVER_WATCH, LOOT } from "./watch_camp_rules.mjs";
import { WARDEN_ID, VILLAGE_GROUP, BOW_ID } from "../lothlorien_bp/scripts/elven_warden_rules.js";

const key = (x, y, z) => `${x},${y},${z}`;
export const CAMP_LANTERN = "lothlorien:elven_lantern";

// Returns entity positions in tree coordinates. Plain giants have no camp.
export function furnishWatchCamp(tree) {
  const { blocks, floorY } = tree;
  if (![...blocks.values()].some((b) => b.loot)) return [];
  const y = floorY + 1;
  const at = (x, yy, z) => blocks.get(key(x, yy, z));
  const open = (x, z) => [B.planks, B.log].includes(at(x, floorY, z)?.name) &&
    !at(x, y, z) && !at(x, y + 1, z);
  const place = (x, yy, z, name, states = {}, extra = {}) => {
    if (at(x, yy, z)) throw new Error(`watch camp would overwrite ${key(x, yy, z)}`);
    blocks.set(key(x, yy, z), { name, states, ...extra });
  };
  for (const [x, z] of CAMP.beds) {
    if (!open(x, z) || !open(x, z + 1)) throw new Error("watch camp bed lacks supported clear space");
    for (const head of [true, false]) place(x, y, z + (head ? 0 : 1), "minecraft:straw_bed", {
      "minecraft:cardinal_direction": "north", head_piece_bit: head, occupied_bit: false,
    });
  }
  for (const [x, z] of CAMP.carpet) {
    if (!open(x, z)) throw new Error("watch camp rug lacks supported clear space");
    place(x, y, z, "minecraft:green_carpet");
  }
  const banner = CAMP.banner;
  place(banner.x, floorY + banner.height, banner.z, "minecraft:wall_banner", { facing_direction: banner.facing }, { banner: SILVER_WATCH });
  // Select four rim posts from the actual shape; nothing protrudes beyond the existing railing.
  const rim = [...blocks].filter(([, b]) => b.name === B.fence).map(([k]) => k.split(",").map(Number));
  const targets = [[1.5, -100], [100, 1.5], [1.5, 100], [-100, 1.5]];
  for (const [tx, tz] of targets.slice(0, CAMP.lanterns)) {
    const [x, yy, z] = [...rim].sort((a, b) => Math.hypot(a[0] - tx, a[2] - tz) - Math.hypot(b[0] - tx, b[2] - tz))[0];
    place(x, yy + 1, z, CAMP_LANTERN, { "minecraft:block_face": "up" });
  }
  const entities = CAMP.cushions.map(({ x, z, variant }) => {
    if (!open(x, z)) throw new Error("watch camp cushion lacks supported clear space");
    return { id: "minecraft:cushion", x: x + 0.5, y, z: z + 0.5, variant, invulnerable: false };
  });
  for (const [x, z] of CAMP.wardens) {
    if (!open(x, z)) throw new Error("watch camp warden lacks supported clear space");
    entities.push({ id: WARDEN_ID, x: x + 0.5, y, z: z + 0.5,
      definitions: [`+${WARDEN_ID}`, `+${VILLAGE_GROUP}`], mainhand: BOW_ID, invulnerable: false });
  }
  // Reuse the village's one-shot native rail repair after placement.
  entities.push({ id: "lothlorien:rail_mender", x: 1.5, y, z: 1.5 });
  return entities;
}

export function watchCampLoot() {
  const entry = ([name, weight, min, max]) => ({ type: "item", name, weight,
    functions: [{ function: "set_count", count: min === max ? min : { min, max } }] });
  return { pools: [
    { rolls: 1, entries: LOOT.provisions.map(entry) },
    { rolls: LOOT.supplyRolls, entries: LOOT.supplies.map(entry) },
    { rolls: 1, entries: [
      { type: "item", name: "minecraft:shield", weight: LOOT.shieldWeight, functions: [{
        function: "set_banner_details", type: 0, base_color: SILVER_WATCH.base,
        patterns: SILVER_WATCH.patterns.map(({ pattern, color }) => ({ pattern, color })),
      }] },
      { type: "empty", weight: LOOT.emptyWeight },
    ] },
  ] };
}
