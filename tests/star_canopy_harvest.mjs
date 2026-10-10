// Owner policy: tool efficiency changes mining time; canopy collection is ungated.
// Check actual native loot configuration; this does not emulate the game engine.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const body = read("../lothlorien_bp/blocks/star_canopy.json")["minecraft:block"];
const table = read("../lothlorien_bp/loot_tables/blocks/star_canopy.json");
const id = "lothlorien:star_canopy", route = "loot_tables/blocks/star_canopy.json";

function assertCollection(block, loot) {
  assert.equal(block.components["minecraft:loot"], route);
  assert.ok(block.components["minecraft:tags"].includes("minecraft:is_pickaxe_item_destructible"),
    "pickaxe remains the efficient mining tool");
  assert.deepEqual(block.components["minecraft:destructible_by_mining"], { seconds_to_destroy: 3.5 });
  assert.deepEqual(block.components["minecraft:destructible_by_explosion"], { explosion_resistance: 6 });
  for (const permutation of block.permutations ?? [])
    assert.ok(permutation.components["minecraft:loot"] === undefined
      || permutation.components["minecraft:loot"] === route, "no state introduces a restricted collection route");
  assert.deepEqual(loot, { pools: [{ rolls: 1, entries: [{ type: "item", name: id,
    functions: [{ function: "set_count", count: 1 }, { function: "explosion_decay" }],
  }] }] }, "one native self-drop for hand/any tool and tool-less removal; decay uses native explosion context");
}

assertCollection(body, table);
const policy = read("../lothlorien_bp/block_materials.json").blocks[id];
assert.equal(policy.profile, "stone_tiles");
assert.match(policy.harvest, /any tool or hand/);
for (const file of ["star_canopy_harvest.js", "star_canopy_harvest_service.js", "harvestWear.js"])
  assert.equal(existsSync(new URL(`../lothlorien_bp/scripts/${file}`, import.meta.url)), false,
    `${file}: obsolete canopy gate/tool-wear script must stay removed`);
const scripts = new URL("../lothlorien_bp/scripts/", import.meta.url);
for (const file of readdirSync(scripts).filter((name) => name.endsWith(".js")))
  assert.doesNotMatch(readFileSync(new URL(file, scripts), "utf8"), /["']\.\/star_canopy_harvest(?:_service)?\.js["']|["']\.\/harvestWear\.js["']/,
    `${file}: no obsolete gate import`);
for (const file of ["configure_support.py", "make_star_canopy.py"])
  assert.ok(readFileSync(new URL(`../tools/${file}`, import.meta.url), "utf8").includes(`"${route}"`),
    `${file}: generator retains native collection route`);

let broken = structuredClone(table);
broken.pools[0].conditions = [{ condition: "match_tool", "minecraft:match_tool_filter_all": ["minecraft:is_pickaxe"] }];
assert.throws(() => assertCollection(body, broken), "efficient tool must not become a collection gate");
broken = structuredClone(table);
broken.pools[0].entries[0].conditions = [{ condition: "match_tool", item: "minecraft:shears" }];
assert.throws(() => assertCollection(body, broken), "entry predicates also restrict collection");
broken = structuredClone(table);
broken.pools[0].entries[0].functions.pop();
assert.throws(() => assertCollection(body, broken), "environmental native decay is retained");
const brokenBlock = structuredClone(body);
brokenBlock.components["minecraft:tags"] = [];
assert.throws(() => assertCollection(brokenBlock, table), "any-tool collection preserves pickaxe mining efficiency");
console.log("ok   star canopy harvest: any-tool native collection, pickaxe efficiency, blast decay, obsolete gate removal and generator routes");
