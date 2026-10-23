// Production handlers in small fake worlds: no worldgen or village simulation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as rules from '../lothlorien_bp/scripts/crop_rules.js';
import * as flora from '../lothlorien_bp/scripts/flora_table.js';
import * as nectar from '../lothlorien_bp/scripts/nectar_rules.js';
import { SUPPORT_POLICIES } from '../lothlorien_bp/scripts/support_policies.js';
import { createSupportMotionService } from '../lothlorien_bp/scripts/support_motion_service.js';
import { supportOffset } from '../lothlorien_bp/scripts/antler_rules.js';
let serial = 0, tests = 0;
const read = path => JSON.parse(readFileSync(new URL('../lothlorien_bp/' + path, import.meta.url), 'utf8'));
const perm = (id, states = {}) => ({ type: { id }, getState: key => states[key], getAllStates: () => ({ ...states }),
  matches: (other, values) => other === id && JSON.stringify(values) === JSON.stringify(states),
  withState: (key, value) => perm(id, { ...states, [key]: value }) });
function stack(typeId, amount = 3, name = '') {
  return { typeId, amount, name, clone() { return stack(this.typeId, this.amount, this.name); },
    isStackableWith(other) { return this.typeId === other.typeId && this.name === other.name; } };
}
async function load(file, context) {
  globalThis.__flora = context;
  const source = readFileSync(new URL('../lothlorien_bp/scripts/' + file, import.meta.url), 'utf8')
    .replace(/^import \{([\s\S]*?)\} from "[^"]+";/gm, 'const {$1} = globalThis.__flora;');
  try { return await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`); }
  finally { delete globalThis.__flora; }
}
async function scenario(name, test) {
  const cells = new Map(), queue = [], handlers = [], components = new Map(), drops = [], deeds = [], sounds = [];
  const key = p => `${p.x},${p.y},${p.z}`;
  let unloaded = () => false, badCosmetic = false;
  const dim = { id: 'overworld', getBlock(p) { if (unloaded(p)) throw Error('unloaded');
    return cells.get(key(p)) ?? block('minecraft:air', {}, p); },
    getBiome: () => ({ id: 'lothlorien:lothlorien' }), playSound(...args) { if (badCosmetic) throw Error('sound'); sounds.push(args); },
    spawnParticle() { if (badCosmetic) throw Error('particle'); }, spawnItem(item) { drops.push(item); },
    runCommand(command) { drops.push(command); } };
  function block(id, states = {}, location = { x: 0, y: 64, z: 0 }) {
    const b = { typeId: id, permutation: perm(id, states), location, ...location, dimension: dim,
      isAir: id === 'minecraft:air', isLiquid: false, light: 15, getLightLevel() { return this.light; },
      setPermutation(p) { this.permutation = p; this.typeId = p.type.id; this.writes = (this.writes ?? 0) + 1; },
      setType(id) { this.setPermutation(perm(id)); }, center() { return this.location; },
      above() { return dim.getBlock({ ...location, y: location.y + 1 }); } };
    cells.set(key(location), b); return b;
  }
  const system = { currentTick: 0, run: fn => queue.push(fn), runTimeout: fn => queue.push(fn), beforeEvents: { startup: {
    subscribe: fn => fn({ blockComponentRegistry: { registerCustomComponent: (id, c) => components.set(id, c) } }) } } };
  const context = { ...rules, ...flora, ...nectar, SUPPORT_POLICIES, supportOffset, createSupportMotionService,
    dropWholeRope() {}, world: { beforeEvents: { playerInteractWithBlock: { subscribe: fn => handlers.push(fn) } },
      afterEvents: new Proxy({}, { get: () => ({ subscribe() {} }) }) }, system,
    EquipmentSlot: { Mainhand: 'main' }, GameMode: { Creative: 'creative' }, ItemStack: function(id, amount) { return stack(id, amount); },
    repeatedUse: () => false, markOnGrass() {}, noteDeed: (p, id) => deeds.push(id) };
  Object.assign(context, await load('deferred_use.js', context));
  Object.assign(context, await load('bottles.js', context));
  Object.assign(context, await load('crop.js', context));
  const support = await load('support_motion.js', context);
  await load('bonemeal.js', context); await load('nectar.js', context);
  function player(id = 'minecraft:bone_meal') {
    const p = { held: stack(id), selectedSlotIndex: 0, dimension: dim, location: { x: 0, y: 64, z: 0 }, mode: 'survival',
      inventory: [], full: false, getGameMode() { return this.mode; }, getComponent(name) {
        if (name === 'inventory') return { container: { addItem(item) { if (p.full) return item; p.inventory.push(item); } } };
        return { getEquipmentSlot: () => ({ getItem: () => p.held?.clone(), hasItem: () => !!p.held,
          get amount() { return p.held.amount; }, set amount(n) { p.held.amount = n; }, setItem(item) { p.held = item; } }) };
      } };
    return p;
  }
  const click = (b, p) => { const event = { block: b, player: p, itemStack: p.held.clone(), isFirstEvent: true }; handlers.forEach(fn => fn(event)); return event; };
  const plant = (id = 'lothlorien:elanor', states = {}) => { block('minecraft:grass_block', {}, { x: 0, y: 63, z: 0 }); return block(id, states); };
  const bloom = () => { block('lothlorien:mallorn_leaves', {}, { x: 0, y: 65, z: 0 }); return block('lothlorien:nectar_bloom', { 'lothlorien:nectar': 3 }); };
  const random = Math.random; Math.random = () => 0;
  try { await test({ block, plant, bloom, player, click, support, context, dim, drops, deeds, components,
    flush: () => { while (queue.length) queue.shift()(); }, unload: fn => { unloaded = fn; }, badCosmetic: () => { badCosmetic = true; } }); }
  finally { Math.random = random; }
  tests++; console.log('ok   flora/crop interactions: ' + name);
}

await scenario('bone meal preserves plant spreading and ignores both fallen covers at every count', e => {
  let b = e.plant(), p = e.player(); e.click(b, p); e.flush(); assert.equal(p.held.amount, 2);
  for (const id of ['lothlorien:mallorn_leaf_carpet', 'lothlorien:mallorn_blossom']) for (const amount of [1,2,3,4]) {
    b = e.plant(id, { 'lothlorien:amount': amount }); p = e.player();
    const before = e.drops.length, event = e.click(b, p); e.flush();
    assert.equal(event.cancel, undefined); assert.equal(b.writes, undefined);
    assert.equal(p.held.amount, 3); assert.equal(e.drops.length, before);
  }
});
await scenario('deferred bone meal rejects a changed held item type, target and soil', e => {
  for (const mutate of [(p) => { p.held.typeId = 'minecraft:diamond'; },
    () => e.block('minecraft:stone'), () => e.block('minecraft:stone', {}, { x: 0, y: 63, z: 0 })]) {
    const b = e.plant(), p = e.player(); e.click(b, p); mutate(p); const amount = p.held.amount; e.flush();
    assert.equal(p.held.amount, amount); assert.equal(b.writes, undefined);
  }
  const b = e.plant(), p = e.player(); e.click(b, p); e.unload(() => true); e.flush(); assert.equal(p.held.amount, 3);
});
await scenario('concurrent corn uses cannot commit the same changed snapshot twice', e => {
  for (const [id, states] of [['lothlorien:western_corn', { 'lothlorien:growth': 0, 'lothlorien:wild': false }]]) {
    const b = e.plant(id, states); e.block('minecraft:farmland', {}, { x: 0, y: 63, z: 0 });
    const p = e.player(), second = e.player(); e.click(b, p); e.click(b, second); e.flush();
    assert.equal(p.held.amount, 2); assert.equal(second.held.amount, 3); assert.equal(b.writes, 1);
  }
});
await scenario('nectar delivers once, including single bottle, stacked/full inventory and Creative', e => {
  let b = e.bloom(), p = e.player('minecraft:glass_bottle'), second = e.player('minecraft:glass_bottle');
  p.held.amount = 1; e.click(b, p); e.click(b, second); e.flush();
  assert.equal(p.held.typeId, 'lothlorien:mallorn_nectar'); assert.equal(second.held.amount, 3); assert.deepEqual(e.deeds, ['nectar']);
  b = e.bloom(); p = e.player('minecraft:glass_bottle'); p.full = true; e.click(b, p); e.flush();
  assert.equal(p.held.amount, 2); assert.equal(e.drops.at(-1).typeId, 'lothlorien:mallorn_nectar');
  b = e.bloom(); p = e.player('minecraft:glass_bottle'); p.mode = 'creative'; e.click(b, p); e.flush();
  assert.equal(p.held.amount, 3); assert.equal(p.inventory[0].typeId, 'lothlorien:mallorn_nectar');
  b = e.bloom(); e.block('lothlorien:mallorn_planks', {}, { x: 0, y: 65, z: 0 });
  p = e.player('minecraft:glass_bottle'); e.click(b, p); e.flush();
  assert.equal(p.held.amount, 2); assert.equal(b.permutation.getState('lothlorien:nectar'), 0);
});
await scenario('nectar rechecks bottle type and target before stage, item or deed changes', e => {
  for (const mutate of [p => { p.held.typeId = 'minecraft:diamond'; }, () => e.block('minecraft:stone')]) {
    const b = e.bloom(), p = e.player('minecraft:glass_bottle'); e.click(b, p); mutate(p); const amount = p.held.amount; e.flush();
    assert.equal(p.held.amount, amount); assert.equal(b.writes, undefined); assert.equal(e.deeds.length, 0);
  }
  const b = e.bloom(), p = e.player('minecraft:glass_bottle'); e.click(b, p); e.unload(() => true); e.flush();
  assert.equal(b.writes, undefined); assert.equal(e.deeds.length, 0);
});
await scenario('every growth stage uses state-aware support and bone meal', e => {
  for (let growth = 0; growth <= 7; growth++) for (const wild of [false, true]) {
    const b = e.plant('lothlorien:western_corn', { 'lothlorien:growth': growth, 'lothlorien:wild': wild });
    const info = e.support.describeSupport(b), soil = e.dim.getBlock({ x: 0, y: 63, z: 0 });
    assert.equal(info.supports[0].valid(soil), wild); assert.ok(info.identity.endsWith(`wild=${wild}`));
    const p = e.player(); e.click(b, p); e.flush(); assert.equal(p.held.amount, wild && growth < 7 ? 2 : 3);
  }
});
await scenario('crop random ticks use plant light and reject dirt for farmed plants', e => {
  const b = e.plant('lothlorien:western_corn', { 'lothlorien:growth': 0, 'lothlorien:wild': false });
  e.block('minecraft:farmland', { moisturized_amount: 7 }, { x: 0, y: 63, z: 0 });
  const tick = () => e.components.get('lothlorien:crop').onRandomTick({ block: b });
  b.light = 3; tick(); assert.equal(b.writes, undefined);
  b.getLightLevel = () => 4; tick(); assert.equal(b.permutation.getState('lothlorien:growth'), 1);
  e.block('minecraft:dirt', {}, { x: 0, y: 63, z: 0 }); tick(); assert.equal(b.writes, 1);
});
await scenario('support service removes farmed corn after farmland reverts and preserves wild corn on dirt', e => {
  const component = e.components.get('lothlorien:motion_support');
  for (const wild of [false, true]) {
    const b = e.plant('lothlorien:western_corn', { 'lothlorien:growth': 7, 'lothlorien:wild': wild });
    e.block('minecraft:farmland', {}, { x: 0, y: 63, z: 0 }); component.onPlace({ block: b });
    e.block('minecraft:dirt', {}, { x: 0, y: 63, z: 0 }); component.onRandomTick({ block: b }); e.flush();
    assert.equal(e.drops.length, 1, wild ? 'wild support remains valid' : 'farmed crop removed once');
  }
});

const soil = wet => ({ typeId: 'minecraft:farmland', permutation: { getState: () => wet ? 7 : 0 } });
const air = { typeId: 'minecraft:air' }, corn = { typeId: 'lothlorien:western_corn' };
assert.equal(rules.cropLayout(() => soil(true), () => air), 10);
assert.equal(rules.cropLayout(() => soil(false), () => air), 4);
assert.equal(rules.cropLayout((x,z) => x || z ? air : soil(true), () => air), 4);
assert.equal(rules.cropLayout(() => soil(true), (x,z) => x && z ? corn : air), 5);
assert.equal(rules.cropLayout(() => soil(true), (x,z) => !x || !z ? corn : air), 5);
assert.equal(rules.cropLayout(() => soil(true), (x,z) => !z ? corn : air), 10);
assert.equal(rules.cropLayout(() => undefined, () => air), 0);
for (const flower of ['elanor', 'niphredil', 'athelas', 'golden_fern']) {
  const body = read('blocks/' + flower + '.json')['minecraft:block'];
  for (const id of ['mycelium', 'pale_moss_block', 'muddy_mangrove_roots']) {
    assert.ok(body.components['minecraft:placement_filter'].conditions[0].block_filter.includes('minecraft:' + id));
    assert.ok(SUPPORT_POLICIES['lothlorien:' + flower].allowed.includes('minecraft:' + id));
  }
}
const cornBlock = read('blocks/western_corn.json')['minecraft:block'];
assert.deepEqual(cornBlock.description.states['lothlorien:wild'], [false, true]);
assert.equal(read('features/western_corn_feature.json')['minecraft:single_block_feature'].places_block.states['lothlorien:wild'], true);
assert.deepEqual(cornBlock.permutations.find(p => p.condition.includes('lothlorien:wild')).components['minecraft:placement_filter'].conditions[0].block_filter, ['minecraft:farmland']);
assert.equal(read('items/nectar_bloom.json')['minecraft:item'].components['minecraft:compostable'].composting_chance, 65);
for (const [flower, data] of [['elanor',5], ['niphredil',0], ['athelas',8]]) {
  const recipe = read(`recipes/suspicious_stew_from_${flower}.json`)['minecraft:recipe_shaped'];
  assert.deepEqual(recipe.result, { item: 'minecraft:suspicious_stew', data });
  assert.equal(recipe.key.M.tag, 'minecraft:mushrooms_for_stew'); assert.equal(recipe.key.F.item, 'lothlorien:' + flower);
}
for (const [flower,dye] of [['elanor','yellow_dye'],['niphredil','white_dye']]) {
  assert.equal(read(`recipes/${dye}_from_${flower}.json`)['minecraft:recipe_shaped'].result.item, 'minecraft:' + dye);
}
console.log(`ok   flora/crop interactions: ${tests} production scenarios, soil/crowding matrix and native data routes`);
