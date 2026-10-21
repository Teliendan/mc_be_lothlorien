// nectar dew regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import * as NR from "../lothlorien_bp/scripts/nectar_rules.js";
import * as DR from "../lothlorien_bp/scripts/dew_rules.js";



test("Phase 14b: nectar bloom fills only under Mallorn leaves, 1/7 per stage", () => {
  assert.equal(NR.nectarAfterTick(0, true, 0.1), 1);
  assert.equal(NR.nectarAfterTick(0, true, 0.2), 0, "dice fail");
  assert.equal(NR.nectarAfterTick(0, false, 0), 0, "no leaves above: stays dry");
  assert.equal(NR.nectarAfterTick(NR.MAX_NECTAR, true, 0), NR.MAX_NECTAR, "full stays full");
  assert.ok(NR.MALLORN_LEAVES.has("lothlorien:mallorn_golden_leaves") && NR.MALLORN_LEAVES.has("lothlorien:mallorn_leaves"));
  assert.deepEqual([0.39, 0.4, 0.84, 0.85].map(NR.treeBloomCount), [0, 1, 1, 2]);
});

test("Phase 14b: morning dew window, chances and leaves-above scan", () => {
  for (const t of [23000, 23999, 0, 1000, 2999]) assert.ok(DR.inDewWindow(t), `dew at ${t}`);
  for (const t of [3000, 6000, 12000, 22999]) assert.ok(!DR.inDewWindow(t), `no dew at ${t}`);
  assert.ok(DR.inDewWindow(24000 + 100), "time wraps");
  const yes = () => true;
  const no = () => false;
  // t=500: share 0.375, appear 1/8 * 0.625
  assert.equal(DR.dewAfterTick(false, 500, 1 / 8, 0.07, yes), true);
  assert.equal(DR.dewAfterTick(false, 500, 1 / 8, 0.08, yes), false, "dice fail");
  assert.equal(DR.dewAfterTick(false, 500, 1, 0, no), false, "needs leaves above");
  assert.equal(DR.dewAfterTick(true, 500, 0, 0.19, no), true, "dew stays within the window");
  assert.equal(DR.dewAfterTick(true, 500, 0, 0.18, no), false, "dew dries inside the window (r < 1/2 * f)");
  assert.equal(DR.dewAfterTick(true, 8000, 1, 0.99, yes), false, "dew dries outside the window");
  assert.equal(DR.dewAfterTick(false, 8000, 1, 0, yes), false, "no new dew by day");
  assert.equal(DR.DEW_APPEAR["lothlorien:mallorn_leaf_carpet"], 1 / 8);
  assert.equal(DR.DEW_APPEAR["lothlorien:mallorn_blossom"], 1 / 4);
  assert.equal(DR.DEW_DRY_MAX, 1 / 2);
  assert.equal(DR.DEW_LENGTH, 4000);
  assert.equal(DR.dawnShare(23000), 0);
  assert.equal(DR.dawnShare(1000), 0.5);
  assert.ok(Math.abs(DR.dawnShare(2999) - 0.99975) < 1e-9);
  // 23000: full appear chance, no drying
  assert.equal(DR.dewAfterTick(false, 23000, 1 / 8, 0.124, yes), true);
  assert.equal(DR.dewAfterTick(false, 23000, 1 / 8, 0.126, yes), false);
  assert.equal(DR.dewAfterTick(true, 23000, 0, 0, no), true, "no drying at the start");
  // 1000: appear halves, dry 1/4
  assert.equal(DR.dewAfterTick(false, 1000, 1 / 8, 0.06, yes), true);
  assert.equal(DR.dewAfterTick(false, 1000, 1 / 8, 0.07, yes), false);
  assert.equal(DR.dewAfterTick(true, 1000, 0, 0.24, no), false);
  assert.equal(DR.dewAfterTick(true, 1000, 0, 0.26, no), true);
  // 2999: appear ~0, dry ~1/2
  assert.equal(DR.dewAfterTick(false, 2999, 1 / 4, 0.001, yes), false);
  assert.equal(DR.dewAfterTick(true, 2999, 0, 0.49, no), false);
  assert.equal(DR.dewAfterTick(true, 2999, 0, 0.51, no), true);
  for (const t of [3000, 6000, 22999]) {
    assert.equal(DR.dewAfterTick(true, t, 1, 0.999, yes), false, `dries at ${t}`);
    assert.equal(DR.dewAfterTick(false, t, 1, 0, yes), false, `never appears at ${t}`);
  }
  const leaf = (id) => id === "L";
  assert.ok(DR.leavesAbove((dy) => (dy === 5 ? "L" : "air"), leaf));
  assert.ok(!DR.leavesAbove(() => "air", leaf));
  assert.ok(!DR.leavesAbove((dy) => (dy > 2 ? undefined : "air"), leaf), "unloaded chunk stops the scan");
  assert.ok(!DR.leavesAbove((dy) => (dy === 41 ? "L" : "air"), leaf), "scan limit");
});

test("Phase 14b: Dew bottle fills drop by drop into a Bottle of morning dew", () => {
  assert.equal(DR.dropsIn(DR.NEW_DEW_BOTTLE_DAMAGE), 1, "a new Dew bottle holds one drop");
  let damage = DR.NEW_DEW_BOTTLE_DAMAGE;
  let uses = 1;
  for (let r = DR.addDrop(damage); !r.full; r = DR.addDrop(damage)) {
    assert.equal(DR.dropsIn(r.damage), DR.dropsIn(damage) + 1);
    damage = r.damage;
    uses++;
  }
  assert.equal(uses + 1, DR.DEW_DROPS, "8 uses in all from a glass bottle (the last one completes it)");
  assert.ok(damage > 0, "the bar never reaches a full bottle early");
});

test("Phase 14b: nectar and dew content is wired (pack JSON)", () => {
  const bloom = readJson("../lothlorien_bp/blocks/nectar_bloom.json")["minecraft:block"];
  assert.deepEqual(bloom.description.states["lothlorien:nectar"], [0, 1, 2, 3]);
  assert.deepEqual(bloom.components["minecraft:placement_filter"].conditions[0].allowed_faces, ["down"]);
  const atlas = readJson("../lothlorien_rp/textures/terrain_texture.json").texture_data;
  for (const s of [0, 1, 2, 3]) assert.ok(atlas[`lothlorien:nectar_bloom_${s}`], `bloom stage ${s} in the atlas`);
  for (const name of ["mallorn_leaf_carpet", "mallorn_blossom"]) {
    const b = readJson(`../lothlorien_bp/blocks/${name}.json`)["minecraft:block"];
    assert.deepEqual(b.description.states["lothlorien:dew"], [false, true]);
    assert.ok("lothlorien:dew_cover" in b.components);
    const dewy = b.permutations.find((p) => p.condition === "q.block_state('lothlorien:dew')");
    const tex = dewy.components["minecraft:material_instances"]["*"].texture;
    assert.equal(tex, `lothlorien:${name}_dew`);
    assert.ok(atlas[tex], "dew texture in the atlas");
  }
  const recipe = readJson("../lothlorien_bp/recipes/miruvor.json")["minecraft:recipe_shaped"];
  assert.equal(recipe.key.H.item, "lothlorien:mallorn_nectar", "Miruvor takes nectar, not honey");
  assert.equal(readJson("../lothlorien_bp/items/dew_bottle.json")["minecraft:item"].components["minecraft:durability"].max_durability, DR.DEW_DROPS);
  const agg = readJson("../lothlorien_bp/features/select_mallorn_tree_with_litter_feature.json")["minecraft:aggregate_feature"].features;
  assert.ok(agg.indexOf("lothlorien:mallorn_blossom_scatter_feature") < agg.indexOf("lothlorien:mallorn_leaf_carpet_scatter_feature"), "blossoms before litter");
  assert.ok(agg.includes("lothlorien:nectar_bloom_scatter_feature"));
});

finish();
