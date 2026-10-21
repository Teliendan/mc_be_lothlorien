// wood blocks regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync, readdirSync } from "node:fs";



test("two plank sets: logs -> silver planks, stripped -> heartwood planks; heartwood blocks are clones on shared geometry", () => {
  const result = (f) => readJson(`../lothlorien_bp/recipes/${f}.json`)["minecraft:recipe_shaped"].result.item;
  assert.equal(result("mallorn_planks_from_log"), "lothlorien:mallorn_planks");
  assert.equal(result("mallorn_planks_from_wood"), "lothlorien:mallorn_planks");
  assert.equal(result("mallorn_heartwood_planks_from_stripped_log"), "lothlorien:mallorn_heartwood_planks");
  assert.equal(result("mallorn_heartwood_planks_from_stripped_wood"), "lothlorien:mallorn_heartwood_planks");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  const strip = (v) => JSON.stringify(v).replaceAll("mallorn_heartwood_", "mallorn_").replace(/"minecraft:map_color":"#[0-9a-f]{6}"/g, "");
  for (const part of ["planks", "stairs", "slab", "double_slab", "fence", "fence_gate", "door", "trapdoor", "button", "pressure_plate"]) {
    const gold = readJson(`../lothlorien_bp/blocks/mallorn_heartwood_${part}.json`);
    const silver = readJson(`../lothlorien_bp/blocks/mallorn_${part}.json`);
    assert.equal(strip(gold), strip(silver), `${part}: out of step with silver (run python -B tools/make_heartwood_set.py)`);
    assert.ok(!JSON.stringify(gold).includes("geometry.lothlorien.mallorn_heartwood"), `${part}: geometry is shared`);
    assert.ok(lang.includes(`tile.lothlorien:mallorn_heartwood_${part}.name=`), `${part}: name`);
    if (part !== "double_slab") {
      assert.ok(existsSync(new URL(`../lothlorien_bp/items/mallorn_heartwood_${part}.json`, import.meta.url)), `${part}: item`);
    }
  }
  const src = readFileSync(new URL("../lothlorien_bp/scripts/blocks.js", import.meta.url), "utf8");
  assert.ok(src.includes('const WOODS = ["mallorn", "mallorn_heartwood"]'), "door pairing, slab merging, button/plate support know both sets");
});

test("icons: every non-cube plank-family block draws its icon through item_visual with an explicit vanilla pose", () => {
  // Without item_visual the icon was turned (stairs, gate) and auto-fitted (slab drawn big and high); a gui pose
  // without rotation left the fence a quarter turn off. Poses: Kaioga 1.26.50 templates (tuned against vanilla).
  const YAW = { stairs: 135, fence_gate: 135, slab: 225, fence: 225, trapdoor: 225, pressure_plate: 225, button: 225 };
  const geos = new Map();
  for (const f of readdirSync(new URL("../lothlorien_rp/models/blocks/", import.meta.url))) {
    for (const g of readJson(`../lothlorien_rp/models/blocks/${f}`)["minecraft:geometry"]) geos.set(g.description.identifier, g);
  }
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    for (const [part, yaw] of Object.entries(YAW)) {
      const comps = readJson(`../lothlorien_bp/blocks/${set}_${part}.json`)["minecraft:block"].components;
      const visual = comps["minecraft:item_visual"];
      assert.ok(visual && visual.material_instances, `${set}_${part}: item_visual with material_instances`);
      assert.deepEqual(visual.material_instances, comps["minecraft:material_instances"], `${set}_${part}: icon uses the block's textures`);
      const geo = geos.get(visual.geometry);
      assert.ok(geo, `${set}_${part}: item_visual geometry ${visual.geometry} exists`);
      const gui = geo.item_display_transforms?.gui;
      assert.ok(gui && gui.fit_to_frame === false, `${set}_${part}: fit_to_frame off (vanilla size and height)`);
      assert.deepEqual(gui.rotation, [30, yaw, 0], `${set}_${part}: gui rotation`);
    }
  }
  // the stairs icon is a straight stair whose tall half is EAST (geometry x is mirrored: x -8..0)
  const top = geos.get("geometry.lothlorien.mallorn_stairs_item").bones[0].cubes.find((c) => c.origin[1] === 8);
  assert.deepEqual([top.origin, top.size], [[-8, 8, -8], [8, 8, 16]]);
  const stair = geos.get("geometry.lothlorien.mallorn_stairs_item");
  for (const cube of stair.bones[0].cubes) {
    assert.equal(cube.uv.up.uv_rotation, 90, "stair item top grain follows the stair run");
    assert.equal(cube.uv.down.uv_rotation, 90, "stair item underside follows the stair run");
  }
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    assert.ok(readJson(`../lothlorien_bp/items/${set}_door.json`)["minecraft:item"].components["minecraft:icon"], `${set}_door: 2D icon`);
  }
});

test("fence: every material instance the fence models name is defined on the block and its icon (both sets); geometry format allows its display transforms", () => {
  for (const g of ["mallorn_fence", "mallorn_fence_carried"]) {
    const geo = JSON.stringify(readJson(`../lothlorien_rp/models/blocks/${g}.geo.json`));
    const used = new Set([...geo.matchAll(/"material_instance":"(\w+)"/g)].map((x) => x[1]));
    for (const set of ["mallorn", "mallorn_heartwood"]) {
      const c = readJson(`../lothlorien_bp/blocks/${set}_fence.json`)["minecraft:block"].components;
      const mi = g.endsWith("carried") ? c["minecraft:item_visual"].material_instances : c["minecraft:material_instances"];
      for (const name of used) assert.ok(mi[name], `${set} ${g}: ${name}`);
      assert.equal(mi["*"].texture, `lothlorien:${set}_fence_post`);
    }
    const f = readJson(`../lothlorien_rp/models/blocks/${g}.geo.json`);
    const v = f.format_version.split(".").map(Number);
    const atLeast = (w) => v[0] !== w[0] ? v[0] > w[0] : v[1] !== w[1] ? v[1] > w[1] : (v[2] ?? 0) >= w[2];
    if (f["minecraft:geometry"][0].item_display_transforms?.shelf) assert.ok(atLeast([1, 26, 40]), `${g}: "shelf" needs format 1.26.40+`);
  }
});

test("gate: carved models (tools/make_mallorn_gate.py) wear the fence post texture in both sets; bones, icon pose and open side kept", () => {
  const closed = readJson("../lothlorien_rp/models/blocks/mallorn_fence_gate_closed.geo.json");
  const open = readJson("../lothlorien_rp/models/blocks/mallorn_fence_gate_open.geo.json");
  for (const [f, bones] of [[closed, ["posts", "rails"]], [open, ["posts", "leaves"]]]) {
    assert.equal(f.format_version, "1.26.50");
    const g = f["minecraft:geometry"][0];
    assert.deepEqual(g.bones.map((b) => b.name), bones);
    assert.ok(g.bones.every((b) => b.cubes.length > 0));
    assert.ok(!JSON.stringify(g).includes("material_instance"), "every face uses the block's * material");
  }
  const gui = closed["minecraft:geometry"][0].item_display_transforms.gui;
  assert.deepEqual([gui.rotation, gui.fit_to_frame], [[30, 135, 0], false], "icon pose confirmed in game");
  // open leaves swing to -z, inside the open selection box (z -8..0)
  for (const c of open["minecraft:geometry"][0].bones[1].cubes) {
    assert.ok(c.origin[2] >= -8.5 && c.origin[2] + c.size[2] <= 1.5, `open leaf at z ${c.origin[2]}`);
  }
  const atlas = readJson("../lothlorien_rp/textures/terrain_texture.json").texture_data;
  for (const set of ["mallorn", "mallorn_heartwood"]) {
    const c = readJson(`../lothlorien_bp/blocks/${set}_fence_gate.json`)["minecraft:block"].components;
    for (const mi of [c["minecraft:material_instances"], c["minecraft:item_visual"].material_instances]) {
      assert.equal(mi["*"].texture, `lothlorien:${set}_fence_post`);
      assert.ok(atlas[mi["*"].texture], `${set}: texture key in terrain_texture.json`);
    }
    assert.equal(c["minecraft:item_visual"].geometry, "geometry.lothlorien.mallorn_fence_gate_closed");
  }
});

test("Mallorn boat items use the boat and chest-boat creative groups", () => {
  for (const wood of ["mallorn", "mallorn_heartwood"]) {
    for (const [suffix, group] of [["boat", "boat"], ["chest_boat", "chestboat"]]) {
      const item = readJson(`../lothlorien_bp/items/${wood}_${suffix}.json`)["minecraft:item"];
      assert.deepEqual(item.description.menu_category,
        { category: "items", group: `minecraft:itemGroup.name.${group}` });
    }
  }
});

finish();
