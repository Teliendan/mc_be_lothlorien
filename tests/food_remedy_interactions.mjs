// Production Lembas callback plus approved food/cooking/container contracts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(new URL('../lothlorien_bp/' + path, import.meta.url), 'utf8'));
const components = name => read(`items/${name}.json`)['minecraft:item'].components;
const salve = components('athelas_salve');
assert.equal(salve['minecraft:food'].using_converts_to, 'minecraft:glass_bottle');
assert.equal(salve['minecraft:food'].can_always_eat, true);
assert.equal(salve['minecraft:max_stack_size'], 16);
for (const [item, chance] of [['lembas_cake', 85], ['lembas_wrapped', 85], ['lembas_dough', 85], ['western_corn_grain', 65]]) {
  assert.equal(components(item)['minecraft:compostable'].composting_chance, chance);
}
for (const [name, nutrition, saturation] of [['venison_raw', 3, .3], ['venison_cooked', 8, .8],
  ['swan_meat_raw', 2, .3], ['swan_meat_cooked', 6, .6], ['lembas_cake', 6, .8], ['lembas_wrapped', 8, 1.2]]) {
  const c = components(name);
  assert.deepEqual(c['minecraft:food'], { nutrition, saturation_modifier: saturation });
  assert.ok(c['minecraft:tags'].tags.includes('minecraft:is_food'));
}
for (const meat of ['venison', 'swan_meat']) {
  const r = read(`recipes/furnace_${meat}.json`)['minecraft:recipe_furnace'];
  assert.deepEqual(r.tags, ['furnace', 'smoker', 'campfire', 'soul_campfire']);
  assert.equal(r.input, `lothlorien:${meat}_raw`); assert.equal(r.output, `lothlorien:${meat}_cooked`);
}
for (const ingredient of ['mallorn_nectar', 'morning_dew', 'dew_bottle']) {
  assert.equal(components(ingredient)['minecraft:food'], undefined, 'owner ingredient-only policy');
}
// Crafting returns the glass bottles used as ingredients (vanilla honey_block result-array pattern).
for (const [name, bottles] of [['miruvor', 4], ['elven_rope', 1], ['star_canopy', 3]]) {
  const r = read(`recipes/${name}.json`)['minecraft:recipe_shaped'];
  assert.deepEqual(r.result[1], { item: 'minecraft:glass_bottle', count: bottles });
}
const miruvorRecipe = read('recipes/miruvor.json')['minecraft:recipe_shaped'];
assert.deepEqual(miruvorRecipe.pattern, ['ESE', 'SHS', 'NLN']);
assert.equal(miruvorRecipe.key.S.item, 'lothlorien:athelas_salve');
console.log('ok   food/remedy native data, stations, balance and intentional policies');

let handler, deeds = 0;
globalThis.__food = { noteDeed() { deeds++; },
  system: { beforeEvents: { startup: { subscribe(fn) { fn({ itemComponentRegistry: {
    registerCustomComponent(id, handlers) { assert.equal(id, 'lothlorien:lembas'); handler = handlers; },
  } }); } } } } };
const source = readFileSync(new URL('../lothlorien_bp/scripts/lembas.js', import.meta.url), 'utf8')
  .replace(/^import \{([\s\S]*?)\} from "[^"]+";/gm, 'const {$1} = globalThis.__food;');
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
delete globalThis.__food;
let cures = 0;
const player = { typeId: 'minecraft:player', removeEffect(id) { assert.equal(id, 'minecraft:hunger'); cures++; } };
handler.onConsume({ source: player });
assert.equal(cures, 1); assert.equal(deeds, 1);
handler.onConsume({ source: { ...player, typeId: 'minecraft:fox' } });
assert.equal(cures, 2); assert.equal(deeds, 1, 'only players get deeds; no manual food charge');
console.log('ok   wrapped Lembas cure and player-only deed; native consumption');
