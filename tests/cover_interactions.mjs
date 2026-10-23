// Execute production handlers in bounded fake worlds, without worldgen simulation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as dewRules from '../lothlorien_bp/scripts/dew_rules.js';
import { MALLORN_LEAVES } from '../lothlorien_bp/scripts/nectar_rules.js';
import { SUPPORT_POLICIES } from '../lothlorien_bp/scripts/support_policies.js';
const LITTER = 'lothlorien:mallorn_leaf_carpet', BLOSSOM = 'lothlorien:mallorn_blossom';
const DEW = 'lothlorien:dew_bottle', GLASS = 'minecraft:glass_bottle', FULL = 'lothlorien:morning_dew';
const AMOUNT = 'lothlorien:amount', WET = 'lothlorien:dew';
let serial = 0, tests = 0, players = 0;
const read = path => JSON.parse(readFileSync(new URL('../lothlorien_bp/' + path, import.meta.url)));
const perm = (id, states = {}) => ({ type: { id }, getState: key => states[key], getAllStates: () => ({ ...states }),
  matches: (other, values) => other === id && Object.keys(states).length === Object.keys(values).length &&
    Object.keys(states).every(key => states[key] === values[key]),
  withState: (key, value) => perm(id, { ...states, [key]: value }) });
function stack(typeId, amount = 1, values = {}) {
  const data = structuredClone(values);
  const s = { typeId, amount, nameTag: data.name, keepOnDeath: data.keep ?? false, lockMode: data.lock ?? 'none',
    isStackable: typeId !== DEW, data,
    getRawLore: () => data.lore ?? [], getCanPlaceOn: () => data.place ?? [], getCanDestroy: () => data.destroy ?? [],
    getDynamicPropertyIds: () => Object.keys(data.dynamic ?? {}), getDynamicProperty: id => data.dynamic[id],
    getComponent(id) {
      if (id.endsWith('durability') && this.typeId === DEW) return data.durability ??= { damage: 7, maxDurability: 8, unbreakable: false };
      if (id.endsWith('enchantable')) return { getEnchantments: () => data.enchantments ?? [] };
    },
    clone() { return stack(this.typeId, this.amount, { ...data, name: this.nameTag, keep: this.keepOnDeath, lock: this.lockMode }); },
    isStackableWith(other) { return this.isStackable && this.typeId === other.typeId && this.nameTag === other.nameTag; } };
  return s;
}
async function load(file, context) {
  globalThis.__cover = context;
  const source = readFileSync(new URL('../lothlorien_bp/scripts/' + file, import.meta.url), 'utf8')
    .replace(/^import \{([\s\S]*?)\} from "[^"]+";/gm, 'const {$1} = globalThis.__cover;');
  try { return await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${serial++}`); }
  finally { delete globalThis.__cover; }
}
async function scenario(name, test) {
  const cells = new Map(), queue = [], before = [], after = [], components = new Map(), drops = [], deeds = [], sounds = [];
  let failRead = () => false, badSound = false, badDeed = false;
  const key = p => `${p.x},${p.y},${p.z}`;
  const dim = { id: 'overworld', getBlock(p) { if (failRead(p)) throw Error('unloaded'); return cells.get(key(p)) ?? block('minecraft:air', {}, p); },
    playSound(...args) { if (badSound) throw Error('sound'); sounds.push(args); }, spawnItem(item, at) { drops.push({ item, at }); } };
  function block(id, states = {}, location = { x: 0, y: 64, z: 0 }) {
    const b = { typeId: id, permutation: perm(id, states), location, ...location, dimension: dim, isWaterlogged: false,
      setPermutation(p) { this.permutation = p; this.typeId = p.type.id; this.writes = (this.writes ?? 0) + 1; },
      setType(id) { this.setPermutation(perm(id)); }, center() { return this.location; }, below() { return dim.getBlock({ ...location, y: location.y - 1 }); } };
    cells.set(key(location), b); return b;
  }
  const context = { ...dewRules, MALLORN_LEAVES, SUPPORT_POLICIES,
    world: { getTimeOfDay: () => 23000, beforeEvents: { playerInteractWithBlock: { subscribe: fn => before.push(fn) } },
      afterEvents: { playerPlaceBlock: { subscribe: fn => after.push(fn) } } },
    system: { run: fn => queue.push(fn), beforeEvents: { startup: { subscribe: fn => fn({ blockComponentRegistry: {
      registerCustomComponent: (id, c) => components.set(id, c) } }) } } },
    EquipmentSlot: { Mainhand: 'main' }, GameMode: { Creative: 'creative' }, ItemStack: function(id, amount) { return stack(id, amount); },
    repeatedUse: () => false, noteDeed(p, id) { if (badDeed) throw Error('deed'); deeds.push(id); } };
  Object.assign(context, await load('deferred_use.js', context));
  Object.assign(context, await load('bottles.js', context));
  await load('ground_cover.js', context); await load('dew.js', context);
  function player(id = LITTER, amount = 3, values = {}) {
    const p = { id: `p${players++}`, held: stack(id, amount, values), selectedSlotIndex: 0, mode: 'survival', dimension: dim,
      location: { x: 0, y: 64, z: 0 }, inventory: [], full: false, getGameMode() { return this.mode; }, getComponent(id) {
        if (id === 'inventory') return { container: { addItem(item) { if (p.full) return item; p.inventory.push(item); } } };
        return { getEquipmentSlot: () => ({ getItem: () => p.held?.clone(), hasItem: () => !!p.held,
          get amount() { return p.held.amount; }, set amount(n) { p.held.amount = n; }, setItem(item) { p.held = item; } }) };
      } };
    return p;
  }
  const cover = (id = LITTER, amount = 1, wet = false) => {
    block('minecraft:stone', {}, { x: 0, y: 63, z: 0 });
    return block(id, { [AMOUNT]: amount, [WET]: wet, 'lothlorien:on_grass': false, 'minecraft:cardinal_direction': 'east' });
  };
  const click = (b, p, blockFace = 'North') => { const e = { block: b, player: p, itemStack: p.held.clone(), blockFace, isFirstEvent: true };
    before.forEach(fn => fn(e)); return e; };
  const placeUpper = (b, p, alter = () => {}) => {
    const upper = block(b.typeId, { ...b.permutation.getAllStates(), [AMOUNT]: 1, [WET]: false }, { ...b.location, y: b.y + 1 });
    if (p.mode !== 'creative') { if (p.held.amount > 1) p.held.amount--; else p.held = undefined; } // native placement consumed it
    alter(upper); after.forEach(fn => fn({ block: upper, player: p }));
    return upper;
  };
  const originalRandom = Math.random; Math.random = () => 0;
  try { await test({ block, cover, player, click, placeUpper, components, context, dim, drops, deeds, sounds,
    flush() { while (queue.length) queue.shift()(); }, unload(fn) { failRead = fn; }, badSound() { badSound = true; }, badDeed() { badDeed = true; } }); }
  finally { Math.random = originalRandom; }
  tests++; console.log('ok   cover interactions: ' + name);
}

await scenario('side and adjacent merges preserve all states, exact consumption and Creative', e => {
  for (const id of [LITTER, BLOSSOM]) for (const creative of [false, true]) {
    const b = e.cover(id, 2, true), p = e.player(id, 3); if (creative) p.mode = 'creative';
    const states = b.permutation.getAllStates(); e.click(b, p); e.flush();
    assert.deepEqual(b.permutation.getAllStates(), { ...states, [AMOUNT]: 3 }); assert.equal(p.held.amount, creative ? 3 : 2);
  }
  const b = e.cover(), p = e.player(), neighbor = e.block('minecraft:stone', {}, { x: 0, y: 64, z: -1 });
  e.click(neighbor, p, 'South'); e.flush(); assert.equal(b.permutation.getState(AMOUNT), 2);
});
await scenario('side merge rejects a changed held item type, target, water and unload', e => {
  const mutations = [p => p.held.typeId = 'minecraft:diamond', () => e.block('minecraft:diamond_block')];
  for (const mutate of mutations) {
    const b = e.cover(), p = e.player(); e.click(b, p); mutate(p); const amount = p.held.amount; e.flush();
    assert.equal(b.writes, undefined); assert.equal(p.held.amount, amount);
  }
  let b = e.cover(), p = e.player(); e.click(b, p); b.isWaterlogged = true; e.flush(); assert.equal(b.writes, undefined);
  b = e.cover(); p = e.player(); e.click(b, p); e.unload(() => true); e.flush(); assert.equal(b.writes, undefined);
});
await scenario('concurrent side merges consume once; full top is refused and full side remains native', e => {
  const b = e.cover(), p = e.player(), other = e.player(); e.click(b, p); e.click(b, other); e.flush();
  assert.equal(b.permutation.getState(AMOUNT), 2); assert.equal(p.held.amount, 2); assert.equal(other.held.amount, 3);
  const full = e.cover(LITTER, 4); assert.equal(e.click(full, p, 'Up').cancel, true);
  assert.equal(e.click(full, p, 'North').cancel, undefined);
});
await scenario('native top placement folds into the cover below without a second consumption, last item and Creative included', e => {
  for (const id of [LITTER, BLOSSOM]) for (const count of [1,3]) for (const creative of [false,true]) {
    const b = e.cover(id, 2, true), p = e.player(id, count); if (creative) p.mode = 'creative';
    assert.equal(e.click(b, p, 'Up').cancel, undefined);
    const upper = e.placeUpper(b, p); assert.equal(upper.typeId, 'minecraft:air');
    assert.equal(b.permutation.getState(AMOUNT), 3); assert.equal(b.permutation.getState(WET), true);
    assert.equal(p.held?.amount ?? 0, creative ? count : count - 1); e.flush(); assert.equal(e.drops.length, 0);
  }
});
await scenario('a waterlogged upper cover still folds in; a lower cover at 4 stays a separate cell', e => {
  let b = e.cover(), p = e.player(); e.click(b, p, 'Up');
  assert.equal(e.placeUpper(b, p, upper => { upper.isWaterlogged = true; }).typeId, 'minecraft:air'); assert.equal(b.permutation.getState(AMOUNT), 2);
  b = e.cover(LITTER, 4); p = e.player(); assert.equal(e.click(b, p, 'Up').cancel, true);
  assert.equal(e.placeUpper(b, p).typeId, LITTER); assert.equal(b.writes, undefined);
});
await scenario('dew collects once at any time without foliage, using single/stacked/full inventory/Creative glass', e => {
  for (const [count, creative, full] of [[1,false,false], [3,false,true], [3,true,false]]) {
    const b = e.cover(LITTER, 2, true), p = e.player(GLASS, count), other = e.player(GLASS, 1);
    p.mode = creative ? 'creative' : 'survival'; p.full = full; e.context.world.getTimeOfDay = () => 12000;
    e.click(b, p); e.click(b, other); e.flush();
    assert.equal(b.permutation.getState(WET), false); assert.equal(other.held.typeId, GLASS);
    const result = count === 1 && !creative ? p.held : full ? e.drops.at(-1).item : p.inventory.at(-1);
    assert.equal(result.typeId, DEW); assert.equal(result.getComponent('durability').damage, 7);
    if (count > 1) assert.equal(p.held.amount, creative ? count : count - 1);
  }
});
await scenario('partial nonstackable bottles progress exactly once; seventh drop has no deed, eighth has one', e => {
  let p = e.player(DEW, 1, { durability: { damage: 2, maxDurability: 8, unbreakable: false } }), b = e.cover(LITTER, 1, true);
  assert.equal(p.held.isStackableWith(p.held), false); e.click(b, p); e.flush();
  assert.equal(p.held.getComponent('durability').damage, 1); assert.equal(e.deeds.length, 0);
  b = e.cover(BLOSSOM, 4, true); e.click(b, p); e.flush(); assert.equal(p.held.typeId, FULL); assert.deepEqual(e.deeds, ['dew']);
  p = e.player(DEW, 1, { durability: { damage: 1, maxDurability: 8 } }); b = e.cover(LITTER, 1, true);
  e.click(b, p); e.flush(); assert.equal(p.held.typeId, FULL); assert.equal(b.permutation.getState(WET), false);
});
await scenario('dew rejects a changed held item type, target and unload', e => {
  for (const change of [p => p.held.typeId = 'minecraft:diamond', () => e.cover(BLOSSOM, 1, true)]) {
    const b = e.cover(LITTER, 1, true), p = e.player(DEW); e.click(b, p); change(p); e.flush(); assert.equal(b.writes, undefined);
  }
  const b = e.cover(LITTER, 1, true), p = e.player(DEW); e.click(b, p); e.unload(() => true); e.flush(); assert.equal(b.writes, undefined);
});
await scenario('formation postpones unreadable canopy cells and leaves approved timing/drying rules intact', e => {
  const b = e.cover(); e.unload(p => p.y > 64);
  const tick = e.components.get('lothlorien:dew_cover').onRandomTick;
  assert.doesNotThrow(() => tick({ block: b, dimension: e.dim })); assert.equal(b.permutation.getState(WET), false);
  b.setPermutation(b.permutation.withState(WET, true)); e.context.world.getTimeOfDay = () => 12000;
  tick({ block: b, dimension: e.dim }); assert.equal(b.permutation.getState(WET), false);
});

const normalized = id => SUPPORT_POLICIES[id].allowed.filter(support => support !== id);
assert.deepEqual(normalized(LITTER), normalized(BLOSSOM), 'both fallen covers have the same surface policy');
for (const id of [LITTER,BLOSSOM]) {
  const name = id.split(':')[1], body = read(`blocks/${name}.json`)['minecraft:block'], item = read(`items/${name}.json`)['minecraft:item'];
  assert.equal(item.components['minecraft:compostable'].composting_chance, 30);
  assert.equal(item.components['minecraft:fuel']?.duration, id === LITTER ? 5 : undefined);
  assert.equal(body.components['minecraft:sound'].sound, id === LITTER ? 'leaf_litter' : 'pink_petals');
  assert.equal(body.components['lothlorien:segmented_cover'], undefined); assert.equal(body.components['minecraft:replaceable'], undefined);
  assert.deepEqual(body.components['minecraft:placement_filter'].conditions.flatMap(c => c.block_filter), SUPPORT_POLICIES[id].allowed);
  for (const support of ['minecraft:glass', 'minecraft:white_wool', 'minecraft:slime', 'minecraft:honey_block',
    'minecraft:oak_planks', 'minecraft:stonebrick', 'lothlorien:mallorn_double_slab', 'lothlorien:mallorn_heartwood_planks'])
    assert.ok(SUPPORT_POLICIES[id].allowed.includes(support), support);
  for (const support of ['minecraft:furnace', 'minecraft:lit_furnace', 'minecraft:redstone_ore', 'minecraft:lit_redstone_ore',
    'minecraft:redstone_lamp', 'minecraft:lit_redstone_lamp']) assert.ok(SUPPORT_POLICIES[id].allowed.includes(support), support);
  for (const count of [1,2,3,4]) {
    const loot = read(`loot_tables/blocks/${name}${count === 1 ? '' : '_' + count}.json`);
    assert.deepEqual(loot.pools[0].entries[0], { type: 'item', name: id, functions: [{ function: 'set_count', count }] });
  }
}
assert.deepEqual(read('recipes/yellow_dye_from_mallorn_blossom.json')['minecraft:recipe_shaped'].result,
  { item: 'minecraft:yellow_dye', count: 1 });
console.log(`ok   cover interactions: ${tests} production scenarios, support families, item data, counts and recipe`);
