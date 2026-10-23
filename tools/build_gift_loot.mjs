// Add M5 arrows to Great Mallorn chests without regenerating structures or changing other loot.
import { readFileSync, writeFileSync } from "node:fs";
import { ARROW, ARROW_ID } from "../lothlorien_bp/scripts/gift_rules.js";
const file = new URL("../lothlorien_bp/loot_tables/chests/mallorn_flet.json", import.meta.url);
const existing = readFileSync(file, "utf8");
const loot = JSON.parse(existing);
const entries = loot.pools[1].entries;
const arrow = {
  type: "item", name: ARROW_ID, weight: ARROW.lootWeight,
  functions: [{ function: "set_count", count: ARROW.lootCount }],
};
// Replace in place so the committed entry order survives a re-run; append only when missing.
const at = entries.findIndex((entry) => entry.name === ARROW_ID);
loot.pools[1].entries = at < 0 ? [...entries, arrow] : entries.map((entry, i) => (i === at ? arrow : entry));
const output = (JSON.stringify(loot, null, 2) + "\n").replaceAll("\n", existing.includes("\r\n") ? "\r\n" : "\n");
if (process.argv.includes("--check")) {
  if (output !== existing) throw Error("Great Mallorn arrow loot needs rebuilding.");
  console.log("Great Mallorn arrow loot current.");
} else {
  writeFileSync(file, output);
  console.log("Built Great Mallorn arrow loot.");
}
