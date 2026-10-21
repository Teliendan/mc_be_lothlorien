// Shops (M3/M5): generator and runtime share the stock; gift balance lives in gift_rules.js.
import { ARROW_ID, ARROW, FINAL_GIFTS } from "./gift_rules.js";
export const TRADERS = ["gardener", "healer", "woodwright", "lamplighter"]; // minecraft:variant order
export const CURRENCY = "minecraft:emerald";
export const TABLE_KEYS = ["uneasy", "guest_0", "guest_1", "guest_2", "guest_3", "friend_0", "friend_1", "friend_2", "friend_3"];
export const NO_TABLE = "none";
export const PROPERTY_VALUES = [NO_TABLE, ...TABLE_KEYS];
export const TABLE_PROPERTY = "lothlorien:trade";
export const SWAP_RADIUS = 6;
export const SWAP_INTERVAL_TICKS = 10;
export const TRADE_PASS_TICKS = 200;
export const PASS_REPEAT_TICKS = 10;
export const PIN_TICKS = 600;
export const PASS_TAG = "lothlorien_trade_pass";
export { SKIP_ITEMS } from "./elf_native_use.js";
export const MAX_USES = 9999999;
export const FINAL_KEY = "friend_3";
export const TABLE_DIR = "trading/lothlorien";
export const tableFileOf = (profession, key) => `${TABLE_DIR}/${profession}_${key}.json`;
export const groupOf = (profession, key) => `lothlorien:trade_${profession}_${key}`;
export const swapEventOf = (key) => `lothlorien:trade_${key}`;
export const displayNameOf = (profession) => `lothlorien.elf.profession.${profession}`;

export function tableKey(band, rank) {
  if (band === "uneasy") return "uneasy";
  if (band !== "guest" && band !== "friend") return null;
  const level = Number.isFinite(rank) ? Math.max(0, Math.min(3, Math.floor(rank))) : 0;
  return `${band}_${level}`;
}

// Sell [emeralds, items]; buy [items, emeralds]. Stock at rank 0 has an Uneasy price as well.
export const SELLS = {
  gardener: [
    { id: "lothlorien:mallorn_acorn", rank: 0, price: { uneasy: [1, 1], guest: [1, 2], friend: [2, 5] } },
    { id: "lothlorien:elanor", rank: 0, price: { uneasy: [1, 2], guest: [1, 3], friend: [1, 4] } },
    { id: "lothlorien:niphredil", rank: 0, price: { uneasy: [1, 2], guest: [1, 3], friend: [1, 4] } },
    { id: "lothlorien:golden_fern", rank: 0, price: { uneasy: [1, 3], guest: [1, 4], friend: [1, 5] } },
    { id: "lothlorien:athelas", rank: 0, price: { uneasy: [3, 1], guest: [2, 1], friend: [3, 2] } },
    { id: "lothlorien:mallorn_blossom", rank: 1, price: { guest: [1, 4], friend: [1, 5] } },
    { id: "lothlorien:western_corn_seeds", rank: 1, price: { guest: [1, 3], friend: [1, 4] } },
    { id: "lothlorien:nectar_bloom", rank: 2, price: { guest: [4, 1], friend: [3, 1] } },
  ],
  healer: [
    { id: "minecraft:potion", potion: "healing", rank: 0, price: { uneasy: [5, 1], guest: [3, 1], friend: [2, 1] } },
    { id: "minecraft:potion", potion: "regeneration", rank: 1, price: { guest: [5, 1], friend: [4, 1] } },
    { id: "minecraft:potion", potion: "slow_falling", rank: 2, price: { guest: [4, 1], friend: [3, 1] } },
    { id: "lothlorien:miruvor", rank: 3, price: { guest: [10, 1], friend: [8, 1] } },
  ],
  woodwright: [
    { id: "lothlorien:mallorn_log", rank: 0, price: { uneasy: [1, 4], guest: [1, 6], friend: [1, 8] } },
    { id: "lothlorien:elven_rope", rank: 1, price: { guest: [6, 1], friend: [5, 1] } },
    { id: ARROW_ID, rank: ARROW.rank, price: { guest: ARROW.guestPrice, friend: ARROW.friendPrice } },
  ],
  lamplighter: [
    { id: "lothlorien:elven_lantern", rank: 0, price: { uneasy: [4, 1], guest: [3, 1], friend: [2, 1] } },
    { id: "lothlorien:elven_lantern_heartwood", rank: 0, price: { uneasy: [4, 1], guest: [3, 1], friend: [2, 1] } },
    { id: "lothlorien:morning_dew", rank: 1, price: { guest: [2, 1], friend: [3, 2] } },
    { id: "lothlorien:deer_antler", rank: 2, price: { guest: [6, 1], friend: [5, 1] } },
    // No loose bottled fireflies: the lamplighter asks for them himself.
  ],
};
const buyPrices = (uneasy, guest, friend) => ({ uneasy: [uneasy, 1], guest: [guest, 1], friend: [friend, 1] });
export const BUYS = {
  gardener: [
    { id: "minecraft:bone_meal", price: buyPrices(48, 32, 24) },
    { id: "minecraft:wheat_seeds", price: buyPrices(48, 32, 24) },
    { id: "minecraft:lily_of_the_valley", price: buyPrices(12, 8, 6) },
    { id: "minecraft:cornflower", price: buyPrices(12, 8, 6) },
    { id: "minecraft:oxeye_daisy", price: buyPrices(12, 8, 6) },
  ],
  healer: [
    { id: "lothlorien:athelas", price: buyPrices(4, 3, 2) },
    { id: "lothlorien:elanor", price: buyPrices(12, 8, 6) },
    { id: "lothlorien:niphredil", price: buyPrices(12, 8, 6) },
    { id: "lothlorien:mallorn_nectar", price: { uneasy: [2, 1], guest: [1, 1], friend: [2, 3] } },
    { id: "minecraft:glistering_melon_slice", price: buyPrices(4, 3, 2) },
  ],
  woodwright: [
    { id: "minecraft:oak_log", price: buyPrices(24, 16, 12) },
    { id: "minecraft:spruce_log", price: buyPrices(24, 16, 12) },
    { id: "minecraft:dark_oak_log", price: buyPrices(24, 16, 12) },
    { id: "minecraft:string", price: buyPrices(24, 16, 12) },
    { id: "minecraft:feather", price: buyPrices(24, 16, 12) },
    { id: "minecraft:iron_ingot", price: buyPrices(6, 4, 3) },
  ],
  lamplighter: [
    { id: "minecraft:glass", price: buyPrices(24, 16, 12) },
    { id: "minecraft:amethyst_shard", price: buyPrices(12, 8, 6) },
    { id: "minecraft:glowstone_dust", price: buyPrices(16, 12, 8) },
  ],
};
// Final gifts appear exclusively for Elf-friend + Friend, and remain renewable.
export const FINAL_TRADES = Object.fromEntries(TRADERS.map((p) => [p, [{
  wants: [{ id: CURRENCY, count: FINAL_GIFTS[p].emeralds }],
  gives: [{ id: FINAL_GIFTS[p].item, count: 1 }],
}]]));
export const perItemCost = (sell, band) => sell.price[band][0] / sell.price[band][1];
export const perItemValue = (buy, band) => buy.price[band][1] / buy.price[band][0];

export function offersFor(profession, key) {
  if (!TRADERS.includes(profession) || !TABLE_KEYS.includes(key)) return [];
  const band = key === "uneasy" ? key : key.split("_")[0];
  const rank = key === "uneasy" ? 0 : Number(key.slice(-1));
  const offers = SELLS[profession].filter((s) => s.rank <= rank).sort((a, b) => a.rank - b.rank).map((s) => ({
    wants: [{ id: CURRENCY, count: s.price[band][0] }],
    gives: [{ id: s.id, count: s.price[band][1], ...(s.potion ? { potion: s.potion } : {}) }],
  }));
  if (key === FINAL_KEY) offers.push(...FINAL_TRADES[profession]);
  for (const b of BUYS[profession]) offers.push({ wants: [{ id: b.id, count: b.price[band][0] }], gives: [{ id: CURRENCY, count: b.price[band][1] }] });
  return offers;
}

export function clickDecision({ profession, band, rank, requestProfession, passValid, currentKey }) {
  const key = tableKey(band, rank);
  if (key === null) return { action: "refuse", line: `trade.refused.${band}` };
  if (requestProfession === profession && !passValid) return { action: "form" };
  if (currentKey !== key) return { action: "swap", key };
  return { action: "trade", key };
}

export function chooseKey(candidates, pin, now) {
  const pinned = pin && now < pin.until && candidates.find((c) => c.playerId === pin.playerId);
  const nearest = pinned || candidates.reduce((best, c) => (!best || c.dist < best.dist || (c.dist === best.dist && c.playerId < best.playerId) ? c : best), undefined);
  return nearest?.key ?? NO_TABLE;
}
