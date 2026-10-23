// Source contracts for native boat interactions; these do not simulate the engine.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test, finish, bp, readJson } from './test_helpers.mjs';

const variants = ['mallorn', 'mallorn_heartwood'].flatMap((wood) =>
  ['boat', 'chest_boat'].map((kind) => ({ wood, kind, id: `lothlorien:${wood}_${kind}`, file: `${wood}_${kind}` })));
const nativePath = (kind) => `../../../reference/vanilla/current/behavior_packs/vanilla_1.26.30/entities/${kind}.json`;
// The vanilla reference is git-ignored: without it the byte-for-byte comparison is skipped.
const haveReference = existsSync(new URL(nativePath('boat'), import.meta.url));
const native = (kind) => readJson(nativePath(kind))['minecraft:entity'];

test('all four boat items preserve water placement and provide six furnace smelts of fuel', () => {
  for (const { id, file } of variants) {
    const item = bp(`items/${file}.json`)['minecraft:item'];
    assert.equal(item.description.identifier, id);
    assert.equal(item.components['minecraft:fuel'].duration, 60, `${file}: 60 seconds, plain and chest boats alike`);
    assert.equal(item.components['minecraft:max_stack_size'], 1);
    assert.equal(item.components['minecraft:liquid_clipped'], true);
    assert.deepEqual(item.components['minecraft:entity_placer'], { entity: id }, `${file}: retain native unrestricted default placement; dispenser parity needs engine testing`);
  }
});

test('boat entities retain the installed native physics, bubble state machine, passenger and inventory behavior', () => {
  if (!haveReference) return console.log('skip vanilla reference missing (tools/refresh_vanilla_ref.ps1)');
  for (const { kind, id, file } of variants) {
    const expected = native(kind);
    const actual = bp(`entities/${file}.json`)['minecraft:entity'];
    // The complete comparison catches an omitted native interaction even when it
    // is not one of the specifically named mechanics in the current review.
    expected.description = { identifier: id, runtime_identifier: `minecraft:${kind}`, is_summonable: true, is_spawnable: false };
    expected.components['minecraft:loot'] = { table: `loot_tables/entities/${file}.json` };
    delete expected.component_groups['minecraft:can_ride_bamboo']; // Mallorn is not a raft.
    expected.events['minecraft:add_can_ride'] = { add: { component_groups: ['minecraft:can_ride_default'] } };
    expected.events['minecraft:sink'].remove.component_groups = expected.events['minecraft:sink'].remove.component_groups.filter((g) => g !== 'minecraft:can_ride_bamboo');
    if (kind === 'chest_boat') {
      // Owner-approved seat clearance: preserve the native single-passenger
      // contract both at spawn and when floating/boarding is restored.
      expected.components['minecraft:rideable'].seats[0].position[0] = 0.35;
      expected.component_groups['minecraft:can_ride_default']['minecraft:rideable'].seats[0].position[0] = 0.35;
    }
    assert.deepEqual(actual, expected, `${file}: only the documented Mallorn adaptations may differ from the native counterpart`);
  }
});

test('breaking each variant has one matching boat item in its own loot table', () => {
  for (const { id, file } of variants) {
    const pools = bp(`loot_tables/entities/${file}.json`).pools;
    assert.equal(pools.length, 1);
    assert.equal(pools[0].rolls, 1);
    assert.deepEqual(pools[0].entries, [{ type: 'item', name: id, weight: 1 }]);
  }
  // Inventory-content spilling is a separate native runtime contract; a loot
  // table assertion cannot prove it and must not duplicate stored items here.
});

test('both wood species craft their own boats and convert to their matching chest boats', () => {
  for (const { wood, kind, id, file } of variants) {
    const recipe = bp(`recipes/${file}.json`)['minecraft:recipe_shaped'];
    assert.equal(recipe.result.item, id);
    assert.deepEqual(recipe.tags, ['crafting_table']);
    if (kind === 'boat') {
      assert.deepEqual(recipe.pattern, ['# #', '###']);
      assert.deepEqual(recipe.key, { '#': { item: `lothlorien:${wood}_planks` } });
      assert.deepEqual(recipe.unlock, [{ item: `lothlorien:${wood}_planks` }]);
    } else {
      assert.deepEqual(recipe.pattern, ['C', 'B']);
      assert.deepEqual(recipe.key, { C: { item: 'minecraft:chest' }, B: { item: `lothlorien:${wood}_boat` } });
      assert.deepEqual(recipe.unlock, [{ item: `lothlorien:${wood}_boat` }]);
    }
  }
});

finish();
