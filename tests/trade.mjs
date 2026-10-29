// M3 rules and generated data. Assertions throw; imported by tests/run.mjs or run directly.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import * as T from "../lothlorien_bp/scripts/trade_rules.js";
import { FINAL_GIFTS, ARROW, ARROW_ID } from "../lothlorien_bp/scripts/gift_rules.js";
import { PROFESSIONS } from "../lothlorien_bp/scripts/elf_rules.js";
import { REQUESTS } from "../lothlorien_bp/scripts/renown_rules.js";
import { buildTables, patchElf } from "../tools/build_trades.mjs";

const text = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const json = (path) => JSON.parse(text(path));
const bp = "../lothlorien_bp/";
function test(name, run) { run(); console.log(`ok   trade: ${name}`); }

test("band/rank keys include refusal, Uneasy stock and clamped ranks", () => {
  for (const band of ["friend", "guest", "uneasy", "shunned", "hated"]) for (let rank = 0; rank <= 3; rank++) {
    assert.equal(T.tableKey(band, rank), band === "uneasy" ? "uneasy" : ["friend", "guest"].includes(band) ? `${band}_${rank}` : null);
  }
  assert.equal(T.tableKey("guest", -7), "guest_0");
  assert.equal(T.tableKey("friend", 12), "friend_3");
  assert.equal(T.tableKey("friend", 2.8), "friend_2");
  assert.equal(T.tableKey("friend", NaN), "friend_0");
  assert.equal(T.tableKey("unknown", 0), null);
  assert.equal(T.TABLE_KEYS.length, 9);
  assert.deepEqual(T.PROPERTY_VALUES, ["none", ...T.TABLE_KEYS]);
  assert.ok(T.PROPERTY_VALUES.length <= 16);
  assert.deepEqual(T.TRADERS, PROFESSIONS.slice(0, 4));
  assert.deepEqual([T.SWAP_RADIUS, T.SWAP_INTERVAL_TICKS, T.TRADE_PASS_TICKS, T.PASS_REPEAT_TICKS, T.PIN_TICKS], [6, 10, 200, 10, 600]);
});

test("rank stock and fractional prices include final gifts only for Friend Elf-friends", () => {
  const stockCounts = { gardener: [5, 7, 8, 8], healer: [1, 2, 3, 4], woodwright: [1, 2, 3, 3], lamplighter: [2, 3, 4, 4] };
  for (const p of T.TRADERS) {
    assert.deepEqual(T.FINAL_TRADES[p], [{ wants: [{ id: T.CURRENCY, count: 32 }], gives: [{ id: FINAL_GIFTS[p].item, count: 1 }] }]);
    for (const band of ["guest", "friend"]) for (let rank = 0; rank <= 3; rank++) {
      const offers = T.offersFor(p, `${band}_${rank}`), sells = offers.filter((o) => o.wants[0].id === T.CURRENCY);
      const final = band === "friend" && rank === 3;
      assert.equal(sells.length, stockCounts[p][rank] + Number(final), `${p} ${band} ${rank}`);
      assert.equal(offers.length, sells.length + T.BUYS[p].length);
      assert.deepEqual(sells.map((o) => o.gives[0].id), [...T.SELLS[p].filter((s) => s.rank <= rank).map((s) => s.id), ...(final ? [FINAL_GIFTS[p].item] : [])]);
    }
    assert.equal(T.offersFor(p, "uneasy").length, stockCounts[p][0] + T.BUYS[p].length);
  }
  const acorn = T.offersFor("gardener", "friend_0")[0];
  assert.deepEqual(acorn, { wants: [{ id: T.CURRENCY, count: 2 }], gives: [{ id: "lothlorien:mallorn_acorn", count: 5 }] });
  const nectar = T.offersFor("healer", "friend_0").find((o) => o.wants[0].id === "lothlorien:mallorn_nectar");
  assert.deepEqual(nectar, { wants: [{ id: "lothlorien:mallorn_nectar", count: 2 }], gives: [{ id: T.CURRENCY, count: 3 }] });
  for (const key of T.TABLE_KEYS) {
    assert.equal(T.offersFor("healer", key).some((o) => o.gives[0].id === "lothlorien:miruvor"), key.endsWith("_3"));
  }
  assert.deepEqual(T.SELLS.woodwright.find((s) => s.rank === 2), { id: ARROW_ID, rank: 2, price: { guest: [1, 8], friend: [1, 10] } });
  assert.ok(!T.SELLS.lamplighter.some((s) => s.id === "lothlorien:bottle_of_fireflies"));
  assert.deepEqual(T.offersFor("loremaster", "friend_3"), []);
  assert.deepEqual(T.offersFor("gardener", "none"), []);
});

test("prices improve monotonically with Harmony and no cross-band arbitrage is possible", () => {
  for (const p of T.TRADERS) {
    for (const sell of T.SELLS[p]) {
      assert.deepEqual(Object.keys(sell.price), sell.rank === 0 ? ["uneasy", "guest", "friend"] : ["guest", "friend"]);
      assert.ok(T.perItemCost(sell, "guest") >= T.perItemCost(sell, "friend"));
      if (sell.rank === 0) assert.ok(T.perItemCost(sell, "uneasy") >= T.perItemCost(sell, "guest"));
      assert.ok(!T.BUYS[p].some((buy) => buy.id === sell.id), `${p} buys its own ${sell.id}`);
    }
    for (const buy of T.BUYS[p]) {
      assert.ok(T.perItemValue(buy, "uneasy") <= T.perItemValue(buy, "guest"));
      assert.ok(T.perItemValue(buy, "guest") <= T.perItemValue(buy, "friend"));
    }
  }
  const overlaps = new Set();
  for (const sell of Object.values(T.SELLS).flat()) for (const buy of Object.values(T.BUYS).flat()) {
    if (sell.id !== buy.id) continue;
    overlaps.add(sell.id);
    const cheapest = Math.min(...Object.keys(sell.price).map((band) => T.perItemCost(sell, band)));
    const bestReturn = Math.max(...Object.keys(buy.price).map((band) => T.perItemValue(buy, band)));
    assert.ok(cheapest > bestReturn, `arbitrage for ${sell.id}: cost ${cheapest}, return ${bestReturn}`);
  }
  assert.deepEqual([...overlaps].sort(), ["lothlorien:athelas", "lothlorien:elanor", "lothlorien:niphredil"]);
});

test("requests never ask for the same shop's stock; trade ids exist", () => {
  for (const request of REQUESTS) for (const item of request.items ?? []) for (const id of item.ids) {
    assert.ok(!T.SELLS[request.profession].some((sell) => sell.id === id), `${request.id} asks for its own ${id}`);
  }
  const vanilla = new Set(text("../../../.claude/skills/bedrock-lookup/reference/current_catalog_ids.txt").split(/\s+/));
  for (const entry of [...Object.values(T.SELLS).flat(), ...Object.values(T.BUYS).flat(), ...Object.values(FINAL_GIFTS).map((gift) => ({ id: gift.item })), { id: T.CURRENCY }]) {
    if (entry.id.startsWith("minecraft:")) assert.ok(vanilla.has(entry.id), entry.id);
    else assert.ok(existsSync(new URL(`${bp}items/${entry.id.split(":")[1]}.json`, import.meta.url)), entry.id);
    if (entry.potion) assert.ok(["healing", "regeneration", "slow_falling"].includes(entry.potion));
  }
});

test("recoverable arrows also occur in Great Mallorn loot and have no crafting recipe", () => {
  const loot = json(`${bp}loot_tables/chests/mallorn_flet.json`);
  assert.deepEqual(loot.pools.flatMap((pool) => pool.entries).filter((entry) => entry.name === ARROW_ID), [{
    type: "item", name: ARROW_ID, weight: ARROW.lootWeight,
    functions: [{ function: "set_count", count: ARROW.lootCount }],
  }]);
  for (const file of readdirSync(new URL(`${bp}recipes/`, import.meta.url)).filter((name) => name.endsWith(".json"))) {
    const recipe = json(`${bp}recipes/${file}`);
    const result = Object.values(recipe).find((value) => value?.result)?.result;
    assert.ok((typeof result === "string" ? result : result?.item) !== ARROW_ID, file);
  }
});

test("click order is refusal, request form, stale-table repair, native trade", () => {
  const base = { profession: "gardener", band: "guest", rank: 1, requestProfession: null, passValid: false, currentKey: "guest_1" };
  assert.deepEqual(T.clickDecision(base), { action: "trade", key: "guest_1" });
  assert.deepEqual(T.clickDecision({ ...base, currentKey: "none" }), { action: "swap", key: "guest_1" });
  assert.deepEqual(T.clickDecision({ ...base, requestProfession: "gardener", currentKey: "none" }), { action: "form" });
  assert.deepEqual(T.clickDecision({ ...base, requestProfession: "gardener", passValid: true }), { action: "trade", key: "guest_1" });
  assert.deepEqual(T.clickDecision({ ...base, requestProfession: "gardener", passValid: true, currentKey: "friend_1" }), { action: "swap", key: "guest_1" });
  for (const band of ["shunned", "hated"]) assert.deepEqual(T.clickDecision({ ...base, band, requestProfession: "gardener", passValid: true }), { action: "refuse", line: `trade.refused.${band}` });
  assert.deepEqual(T.clickDecision({ ...base, requestProfession: "healer" }), { action: "trade", key: "guest_1" });
});

test("nearest player wins with stable ties, unless an unexpired nearby pin exists", () => {
  const candidates = [{ playerId: "b", dist: 2, key: "guest_1" }, { playerId: "a", dist: 4, key: "friend_3" }];
  const before = structuredClone(candidates);
  assert.equal(T.chooseKey(candidates, undefined, 0), "guest_1");
  assert.equal(T.chooseKey(candidates, { playerId: "a", until: 10 }, 9), "friend_3");
  assert.equal(T.chooseKey(candidates, { playerId: "a", until: 10 }, 10), "guest_1");
  assert.equal(T.chooseKey(candidates, { playerId: "absent", until: 10 }, 0), "guest_1");
  assert.equal(T.chooseKey([{ ...candidates[0], dist: 4 }, candidates[1]], undefined, 0), "friend_3");
  assert.equal(T.chooseKey([{ playerId: "a", dist: 1, key: null }], undefined, 0), "none");
  assert.equal(T.chooseKey([], { playerId: "a", until: 10 }, 0), "none");
  assert.deepEqual(candidates, before);
});

test("36 deterministic disk tables offer every trade with fixed prices and no XP or level progression", () => {
  const tables = buildTables();
  assert.deepEqual(buildTables(), tables);
  assert.equal(Object.keys(tables).length, 36);
  const expectedFiles = Object.keys(tables).map((path) => path.slice(T.TABLE_DIR.length + 1)).sort();
  assert.deepEqual(readdirSync(new URL(`${bp}${T.TABLE_DIR}/`, import.meta.url)).sort(), expectedFiles);
  for (const [path, table] of Object.entries(tables)) {
    assert.deepEqual(json(`${bp}${path}`), table, path);
    assert.equal(table.tiers.length, 1);
    assert.equal(table.tiers[0].total_exp_required, 0);
    for (const group of table.tiers[0].groups) {
      assert.equal(group.num_to_select, 1);
      assert.equal(group.trades.length, 1);
      const trade = group.trades[0];
      assert.equal(trade.max_uses, T.MAX_USES);
      assert.equal(trade.trader_exp, 0);
      assert.equal(trade.reward_exp, false);
      for (const item of [...trade.wants, ...trade.gives]) {
        assert.ok(Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 64, path);
        assert.equal(item.price_multiplier, 0, "omission defaults to demand-driven prices");
        if (item.item === "minecraft:potion") assert.deepEqual(item.functions, [{ function: "set_potion", id: item.functions[0].id }]);
      }
    }
  }
  const potionOutputs = tables[T.tableFileOf("healer", "friend_2")].tiers[0].groups.slice(0, 3).map((group) => group.trades[0].gives[0].functions[0].id);
  assert.deepEqual(potionOutputs, ["healing", "regeneration", "slow_falling"]);
});

test("generated elf property, groups and events are idempotent and preserve hand-maintained data", () => {
  const source = json(`${bp}entities/elf.json`), entity = source["minecraft:entity"];
  assert.deepEqual(patchElf(source), source);
  assert.deepEqual(entity.description.properties[T.TABLE_PROPERTY], { type: "enum", values: T.PROPERTY_VALUES, default: "none", client_sync: false });
  const tradeGroups = Object.keys(entity.component_groups).filter((key) => key.startsWith("lothlorien:trade_"));
  assert.equal(tradeGroups.length, 36);
  const tradeEvents = Object.keys(entity.events).filter((key) => key.startsWith("lothlorien:trade_"));
  assert.equal(tradeEvents.length, 10);
  for (const key of T.TABLE_KEYS) {
    const sequence = entity.events[T.swapEventOf(key)].sequence;
    assert.equal(sequence.length, 5);
    assert.deepEqual(sequence[0].set_property, { [T.TABLE_PROPERTY]: key });
    assert.deepEqual([...sequence[0].remove.component_groups].sort(), tradeGroups.filter((group) => !T.TRADERS.some((p) => group === T.groupOf(p, key))).sort());
    T.TRADERS.forEach((p, variant) => {
      assert.deepEqual(sequence[variant + 1], { filters: { test: "is_variant", subject: "self", operator: "==", value: variant }, add: { component_groups: [T.groupOf(p, key)] } });
      assert.deepEqual(entity.component_groups[T.groupOf(p, key)], { "minecraft:economy_trade_table": { display_name: T.displayNameOf(p), table: T.tableFileOf(p, key), new_screen: true, persist_trades: false } });
      assert.ok(existsSync(new URL(`${bp}${T.tableFileOf(p, key)}`, import.meta.url)));
    });
  }
  assert.deepEqual(entity.events[T.swapEventOf("none")], { set_property: { [T.TABLE_PROPERTY]: "none" }, remove: { component_groups: tradeGroups } });
  for (const p of T.TRADERS) {
    const filters = entity.component_groups[`lothlorien:${p}`]["minecraft:interact"].interactions[0].on_interact.filters.all_of;
    const excluded = filters.find((f) => f.none_of).none_of;
    assert.deepEqual(excluded.filter((f) => !f.all_of).map((f) => [f.test, f.value]), [["has_equipment", "minecraft:lead"], ["has_equipment", "minecraft:name_tag"], ["has_tag", T.PASS_TAG]]);
    assert.deepEqual(excluded.find((f) => f.all_of), { all_of: [
      { test: "has_equipment", domain: "hand", subject: "other", value: "minecraft:shears" },
      { test: "is_leashed", subject: "self", value: true },
    ] }, "only a native cut hides the delivery prompt; idle shears still permit dialogs");
    assert.ok(!JSON.stringify(entity.events[`lothlorien:as_${p}`]).includes("lothlorien:trade_"), "no table assigned at spawn");
  }
  assert.equal(entity.components["minecraft:behavior.trade_with_player"].priority, 2);
  assert.deepEqual(entity.components["minecraft:behavior.look_at_trading_player"], { priority: 6, look_time: { min: 1, max: 2 } });
  assert.ok(!text(`${bp}entities/elven_warden.json`).includes("economy_trade_table"));
  const custom = structuredClone(source);
  custom["minecraft:entity"].description.properties["lothlorien:unrelated"] = { type: "bool", default: false };
  custom["minecraft:entity"].events["lothlorien:unrelated"] = { add: { component_groups: ["lothlorien:gardener"] } };
  assert.deepEqual(patchElf(custom), custom);
});

test("shop text and runtime startup hooks stay bound", () => {
  const entries = json("../localization/catalog.json").packs.lothlorien_rp.entries;
  for (const suffix of ["trade.refused.shunned", "trade.refused.hated", "trade.again", "lore.btn.trade"]) {
    assert.ok(entries[`lothlorien.message.${suffix}`], suffix);
  }
  for (const profession of T.TRADERS) assert.ok(entries[T.displayNameOf(profession)], profession);
  const main = text(`${bp}scripts/main.js`);
  assert.match(main, /startTrade\(\{/);
  assert.match(main, /openRequestForm:\s*openTraderForm/);
  assert.doesNotMatch(main, /handleTradeEvent/, "the trade debug scriptevent is gone");
});
