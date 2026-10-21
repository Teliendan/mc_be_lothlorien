// lamps regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync, readdirSync } from "node:fs";

const LAMPS = { elven_lantern: ["up", "down"], elven_lantern_heartwood: ["up", "down"],
  firefly_jar: ["up"], elven_chandelier: ["down"] };

test("elven lamps: faces they may be placed on, light, and script support for each", () => {
  const antlerJs = readFileSync(new URL("../lothlorien_bp/scripts/antler.js", import.meta.url), "utf8");
  for (const [id, faces] of Object.entries(LAMPS)) {
    const b = readJson(`../lothlorien_bp/blocks/${id}.json`)["minecraft:block"];
    assert.deepEqual(b.components["minecraft:placement_filter"].conditions[0].allowed_faces, faces, id);
    assert.ok(b.components["minecraft:light_emission"] >= 11, `${id} gives light`);
    assert.equal(b.components["minecraft:light_dampening"], 0, `${id} lets light through`);
    assert.ok("lothlorien:lamp_support" in b.components, `${id} pops off when its support goes`);
    assert.ok(antlerJs.includes(`"lothlorien:${id}"`), `${id} is in the support script's id list`);
  }
});

test("elven lantern: one model stands or hangs by its spire; the jar is all blend (one render_method per block)", () => {
  const b = readJson("../lothlorien_bp/blocks/elven_lantern.json")["minecraft:block"];
  assert.equal(b.components["minecraft:geometry"], "geometry.lothlorien.elven_lantern");
  assert.deepEqual(b.components["minecraft:placement_filter"].conditions[0].allowed_faces, ["up", "down"]);
  assert.equal(b.components["minecraft:material_instances"].wood.render_method, "opaque"); // the carving is real cubes
  const gold = readJson("../lothlorien_bp/blocks/elven_lantern_heartwood.json")["minecraft:block"].components;
  assert.equal(gold["minecraft:geometry"], b.components["minecraft:geometry"]);
  assert.equal(gold["minecraft:material_instances"].wood.texture, "lothlorien:elven_lantern_wood_heartwood");
  const jar = readJson("../lothlorien_bp/blocks/firefly_jar.json")["minecraft:block"].components;
  assert.equal(jar["minecraft:material_instances"].glass.render_method, "blend");
  for (const [k, m] of Object.entries(jar["minecraft:material_instances"])) assert.equal(m.render_method, "blend", `jar ${k}: one render_method per block`);
  for (const g of ["elven_lantern", "firefly_jar", "elven_chandelier"]) {
    assert.ok(existsSync(new URL(`../lothlorien_rp/models/blocks/${g}.geo.json`, import.meta.url)), g);
  }
});

test("elven lantern: one core paints every outward side", () => {
  const geo = readJson("../lothlorien_rp/models/blocks/elven_lantern.geo.json")["minecraft:geometry"][0];
  const sides = ["north", "east", "south", "west"];
  const cores = geo.bones.flatMap((bone) => bone.cubes).filter((cube) =>
    sides.every((side) => cube.uv?.[side]?.material_instance === "glow"));
  assert.equal(cores.length, 1, "one four-sided glow core");
  assert.ok(cores[0].origin[0] < 0 && cores[0].origin[2] < 0, "core is centred behind the windows");
});

test("elven lamps: items place their block; recipes use existing items and chain lantern -> chandelier", () => {
  const ids = new Set(readdirSync(new URL("../lothlorien_bp/items", import.meta.url)).map((f) => `lothlorien:${f.replace(".json", "")}`));
  for (const id of Object.keys(LAMPS)) {
    const definition = readJson(`../lothlorien_bp/items/${id}.json`)["minecraft:item"];
    const item = definition.components;
    assert.equal(item["minecraft:block_placer"].block, `lothlorien:${id}`);
    assert.deepEqual(definition.description.menu_category,
      { category: "items", group: "minecraft:itemGroup.name.lanterns" }, `${id}: creative group`);
    const r = readJson(`../lothlorien_bp/recipes/${id}.json`)["minecraft:recipe_shaped"];
    for (const k of Object.values(r.key)) assert.ok(k.tag === "lothlorien:elven_lantern" ||
      k.item?.startsWith("minecraft:") || ids.has(k.item), `${id}: ${JSON.stringify(k)}`);
    assert.equal(r.result.item, `lothlorien:${id}`);
  }
  const lantern = readJson("../lothlorien_bp/recipes/elven_lantern.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(lantern.key).some((k) => k.item === "lothlorien:bottle_of_fireflies"));
  const heartwood = readJson("../lothlorien_bp/recipes/elven_lantern_heartwood.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(heartwood.key).some((k) => k.item === "lothlorien:mallorn_heartwood_trapdoor"));
  const chandelier = readJson("../lothlorien_bp/recipes/elven_chandelier.json")["minecraft:recipe_shaped"];
  assert.ok(Object.values(chandelier.key).some((k) => k.tag === "lothlorien:elven_lantern"));
  assert.ok(Object.values(chandelier.key).some((k) => k.item === "lothlorien:deer_antler"));
});

test("elven lamps: flipbook entries exist for every animated tile, names are in the lang file", () => {
  const flips = readJson("../lothlorien_rp/textures/flipbook_textures.json").map((f) => f.atlas_tile);
  for (const t of ["elven_lantern_glow", "elven_jar_inner"]) assert.ok(flips.includes(`lothlorien:${t}`), t);
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  for (const id of Object.keys(LAMPS)) {
    assert.ok(lang.includes(`tile.lothlorien:${id}.name=`) && lang.includes(`item.lothlorien:${id}=`), id);
  }
});

finish();
