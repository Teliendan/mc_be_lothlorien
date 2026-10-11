// Deterministic elf shops from scripts/trade_rules.js. Run from any directory; --check writes nothing.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRADERS, TABLE_KEYS, PROPERTY_VALUES, NO_TABLE, TABLE_PROPERTY, MAX_USES, TABLE_DIR,
  offersFor, tableFileOf, groupOf, swapEventOf, displayNameOf,
} from "../lothlorien_bp/scripts/trade_rules.js";

const bp = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp");
const encode = (value, newline = "\n") => (JSON.stringify(value, null, 2) + "\n").replaceAll("\n", newline);
const tradeItem = ({ id, count, potion }) => ({
  item: id, quantity: count, price_multiplier: 0,
  ...(potion ? { functions: [{ function: "set_potion", id: potion }] } : {}),
});
export function buildTables() {
  const tables = {};
  for (const profession of TRADERS) for (const key of TABLE_KEYS) {
    tables[tableFileOf(profession, key)] = { tiers: [{ total_exp_required: 0, groups: offersFor(profession, key).map((offer) => ({
      num_to_select: 1,
      trades: [{ wants: offer.wants.map(tradeItem), gives: offer.gives.map(tradeItem), trader_exp: 0, max_uses: MAX_USES, reward_exp: false }],
    })) }] };
  }
  return tables;
}

// Clone before patching: callers can compare existing data and the generated result safely.
// Only the property and trade_* groups/events are generated; profession interactions remain hand-maintained.
export function patchElf(source) {
  const result = structuredClone(source);
  const entity = result["minecraft:entity"];
  entity.description.properties ??= {};
  entity.description.properties[TABLE_PROPERTY] = { type: "enum", values: [...PROPERTY_VALUES], default: NO_TABLE, client_sync: false };
  for (const section of [entity.component_groups, entity.events]) {
    for (const key of Object.keys(section)) if (key.startsWith("lothlorien:trade_")) delete section[key];
  }
  for (const profession of TRADERS) for (const key of TABLE_KEYS) {
    entity.component_groups[groupOf(profession, key)] = { "minecraft:economy_trade_table": {
      display_name: displayNameOf(profession), table: tableFileOf(profession, key), new_screen: true, persist_trades: false,
    } };
  }
  const allGroups = TRADERS.flatMap((profession) => TABLE_KEYS.map((key) => groupOf(profession, key)));
  for (const key of TABLE_KEYS) entity.events[swapEventOf(key)] = { sequence: [
    { set_property: { [TABLE_PROPERTY]: key }, remove: { component_groups: allGroups.filter((group) => !TRADERS.some((profession) => group === groupOf(profession, key))) } },
    ...TRADERS.map((profession, variant) => ({
      filters: { test: "is_variant", subject: "self", operator: "==", value: variant },
      add: { component_groups: [groupOf(profession, key)] },
    })),
  ] };
  entity.events[swapEventOf(NO_TABLE)] = { set_property: { [TABLE_PROPERTY]: NO_TABLE }, remove: { component_groups: allGroups } };
  return result;
}

export function main(check = false) {
  const tables = buildTables(), out = join(bp, TABLE_DIR);
  const expectedNames = new Set(Object.keys(tables).map((path) => path.slice(TABLE_DIR.length + 1)));
  const stale = existsSync(out) ? readdirSync(out).filter((name) => name.endsWith(".json") && !expectedNames.has(name)) : [];
  const changed = [];
  for (const [path, table] of Object.entries(tables)) {
    const file = join(bp, path), content = encode(table);
    if (!existsSync(file) || readFileSync(file, "utf8") !== content) changed.push(path);
    if (!check) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content); }
  }
  const elfFile = join(bp, "entities", "elf.json"), existing = readFileSync(elfFile, "utf8");
  const elfText = encode(patchElf(JSON.parse(existing)), existing.includes("\r\n") ? "\r\n" : "\n");
  if (existing !== elfText) changed.push("entities/elf.json");
  if (check) {
    if (stale.length || changed.length) {
      console.error(`Elf shops need rebuilding: ${[...changed, ...stale.map((name) => `${TABLE_DIR}/${name} (stale)`)].join(", ")}`);
      return 1;
    }
    console.log(`Elf shops current: ${Object.keys(tables).length} tables.`);
  } else {
    for (const name of stale) unlinkSync(join(out, name));
    writeFileSync(elfFile, elfText);
    console.log(`Built ${Object.keys(tables).length} elf trade tables and patched entities/elf.json.`);
  }
  return 0;
}
// Node resolves the workspace junction in import.meta.url, so normalize both paths.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.includes("--check"));
