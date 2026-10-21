// Exercise production deferred handlers; Minecraft owns placement physics and native consumers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as controlRules from '../lothlorien_bp/scripts/control_rules.js';
const source = readFileSync(new URL('../lothlorien_bp/scripts/blocks.js', import.meta.url), 'utf8')
  .replace(/^import \{([^}]+)\} from "[^"]+";/gm, 'const {$1} = globalThis.__wood;');
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
let serial = 0, count = 0;
const perm = (id, states = {}) => ({ type: { id }, getState: k => states[k], getAllStates: () => ({ ...states }),
  matches: (other, values) => id === other && Object.entries(values).every(([k, v]) => states[k] === v),
  withState: (k, v) => perm(id, { ...states, [k]: v }) });
function item(id, options = {}) {
  const data = { amount: 1, tags: [], lore: [], dynamic: {}, enchantments: [], canPlace: [], canDestroy: [],
    name: undefined, keep: false, lock: 'none', ...structuredClone(options) };
  const value = { typeId: id, ...data, nameTag: data.name, keepOnDeath: data.keep, lockMode: data.lock,
    hasTag(tag) { return this.tags.includes(tag); }, getRawLore() { return this.lore; },
    getCanPlaceOn() { return this.canPlace; }, getCanDestroy() { return this.canDestroy; },
    getDynamicPropertyIds() { return Object.keys(this.dynamic); }, getDynamicProperty(k) { return this.dynamic[k]; },
    getComponent(name) { return name === 'durability' ? this.durability : name === 'enchantable' ? {
      getEnchantments: () => this.enchantments, getEnchantment: key => this.enchantments.find(e => e.type.id === key),
    } : undefined; },
    clone() { return item(id, { ...this, clone: undefined, hasTag: undefined, getComponent: undefined,
      getRawLore: undefined, getCanPlaceOn: undefined, getCanDestroy: undefined, getDynamicPropertyIds: undefined,
      getDynamicProperty: undefined, isStackableWith: undefined, durability: this.durability && {
        damage: this.durability.damage, maxDurability: this.durability.maxDurability, unbreakable: this.durability.unbreakable,
        chance: this.durability.chance, throwChance: this.durability.throwChance,
      }, name: this.nameTag, keep: this.keepOnDeath, lock: this.lockMode }); },
    isStackableWith(other) { return !this.durability && this.typeId === other.typeId &&
      JSON.stringify([this.nameTag, this.lore, this.dynamic]) === JSON.stringify([other.nameTag, other.lore, other.dynamic]); },
  };
  if (data.durability) value.durability = { damage: 0, maxDurability: 59, unbreakable: false, ...data.durability,
    getDamageChance(level) { if (this.throwChance) throw Error('invalid'); assert.ok(level >= 0 && level <= 3);
      this.lastLevel = level; return this.chance ?? 100 / (level + 1); } };
  return value;
}
async function scenario(name, body) {
  const handlers = new Map(), blocks = new Map(), queue = [], sounds = [];
  const key = p => `${p.x},${p.y},${p.z}`;
  const dimension = { id: 'overworld', getBlock: p => blocks.get(key(p)), playSound: (...a) => sounds.push(a) };
  const signal = phase => new Proxy({}, { get: (_, name) => ({ subscribe(fn) {
    const k = `${phase}:${name}`; if (!handlers.has(k)) handlers.set(k, []); handlers.get(k).push(fn);
  } }) });
  const system = { beforeEvents: signal('system'), run: fn => queue.push(fn), runTimeout() {} };
  globalThis.__wood = { ...controlRules, system, world: { beforeEvents: signal('before'), afterEvents: signal('after') },
    BlockPermutation: { resolve: perm }, EquipmentSlot: { Mainhand: 'main' }, GameMode: { Creative: 'creative' } };
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${++serial}`);
  delete globalThis.__wood;
  const block = (id, states = {}, location = { x: 0, y: 64, z: 0 }, water = false) => {
    const b = { typeId: id, permutation: perm(id, states), location, dimension, isWaterlogged: water,
      center: () => ({ x: location.x + .5, y: location.y + .5, z: location.z + .5 }),
      setPermutation(p) { this.permutation = p; this.typeId = p.type.id; this.writes = (this.writes ?? 0) + 1; } };
    blocks.set(key(location), b); return b;
  };
  const player = (held, mode = 'survival') => {
    const p = { selectedSlotIndex: 0, mode, held, getGameMode() { return this.mode; }, playSound: a => sounds.push(a),
      getComponent() { return { getEquipmentSlot: () => ({ hasItem: () => !!p.held, getItem: () => p.held?.clone(),
        get amount() { return p.held.amount; }, set amount(n) { p.held.amount = n; }, setItem(i) { p.held = i; } }) }; } };
    return p;
  };
  const click = (b, p, face = 'Up', y = .75) => {
    const event = { block: b, player: p, itemStack: p.held.clone(), blockFace: face, faceLocation: { x: .5, y, z: .5 } };
    for (const fn of handlers.get('before:playerInteractWithBlock') ?? []) fn(event);
    return event;
  };
  const flush = () => { while (queue.length) queue.shift()(); };
  await body({ block, player, click, flush, queue, blocks, sounds }); count++;
  console.log(`ok   wood interactions: ${name}`);
}

await scenario('both wood sets merge top/bottom and neighboring complementary halves exactly once', e => {
  for (const wood of ['mallorn', 'mallorn_heartwood']) for (const half of ['top', 'bottom']) {
    const id = `lothlorien:${wood}_slab`, p = e.player(item(id, { amount: 3 }));
    const b = e.block(id, { 'minecraft:vertical_half': half });
    assert.equal(e.click(b, p, half === 'bottom' ? 'Up' : 'Down').cancel, true);
    e.click(b, p, half === 'bottom' ? 'Up' : 'Down'); e.flush();
    assert.equal(b.typeId, `lothlorien:${wood}_double_slab`); assert.equal(b.writes, 1); assert.equal(p.held.amount, 2);
    const neighbor = e.block('minecraft:stone', {}, { x: -1, y: 64, z: 0 });
    e.block(id, { 'minecraft:vertical_half': half });
    assert.equal(e.click(neighbor, p, 'East', half === 'bottom' ? .75 : .25).cancel, true);
    e.flush(); assert.equal(p.held.amount, 1);
  }
});
await scenario('side/face matching, mismatched species and ordinary placement remain native', e => {
  const id = 'lothlorien:mallorn_slab', p = e.player(item(id, { amount: 4 }));
  const b = e.block(id, { 'minecraft:vertical_half': 'bottom' });
  assert.equal(e.click(b, p, 'Down').cancel, undefined); assert.equal(e.click(b, p, 'East', .25).cancel, undefined);
  assert.equal(e.click(b, p, 'East', .75).cancel, true); e.flush();
  assert.equal(p.held.amount, 3);
  const other = e.block('lothlorien:mallorn_heartwood_slab', { 'minecraft:vertical_half': 'bottom' });
  assert.equal(e.click(other, p).cancel, undefined); assert.equal(e.queue.length, 0);
});
await scenario('stale targets, water/state changes, unloads and two-player races cannot merge twice', e => {
  const id = 'lothlorien:mallorn_slab';
  for (const mutate of [b => { b.typeId = 'minecraft:diamond_block'; }, b => { b.permutation = perm(id, { 'minecraft:vertical_half': 'top' }); },
    b => { b.isWaterlogged = true; }, b => { e.blocks.clear(); }]) {
    const b = e.block(id, { 'minecraft:vertical_half': 'bottom' }), p = e.player(item(id, { amount: 4 }));
    e.click(b, p); mutate(b); e.flush(); assert.equal(p.held.amount, 4); assert.equal(b.writes, undefined);
  }
  const b = e.block(id, { 'minecraft:vertical_half': 'bottom' }, undefined, true);
  const a = e.player(item(id, { amount: 2 })), c = e.player(item(id, { amount: 2 }));
  e.click(b, a); e.click(b, c); e.flush(); assert.equal(b.writes, 1); assert.equal(a.held.amount + c.held.amount, 3);
});
await scenario('queued merges reject changed hand, selected slot, amount, metadata and game mode', e => {
  const id = 'lothlorien:mallorn_slab';
  for (const mutate of [p => { p.held = item('minecraft:diamond', { amount: 4 }); }, p => { p.selectedSlotIndex++; },
    p => { p.held.amount++; }, p => { p.held.nameTag = 'renamed'; }, p => { p.held.lore = [{ text: 'changed' }]; },
    p => { p.held.dynamic.owner = 'other'; }, p => { p.mode = 'creative'; }, p => { p.held = undefined; }]) {
    const b = e.block(id, { 'minecraft:vertical_half': 'bottom' }), p = e.player(item(id, { amount: 4 }));
    e.click(b, p); mutate(p); e.flush(); assert.equal(b.writes, undefined);
  }
});
await scenario('last survival slab empties its slot; Creative merges spend nothing', e => {
  for (const mode of ['survival', 'creative']) {
    const id = 'lothlorien:mallorn_slab', b = e.block(id, { 'minecraft:vertical_half': 'bottom' });
    const p = e.player(item(id), mode); e.click(b, p); e.flush(); assert.equal(b.writes, 1);
    assert.equal(p.held?.amount, mode === 'creative' ? 1 : undefined);
  }
});
const axe = (id = 'minecraft:iron_axe', extra = {}) => item(id, { durability: { damage: 0, maxDurability: 250 }, ...extra });
await scenario('native and tagged axes strip logs/wood, preserve axis, debounce and reject fake suffixes', e => {
  for (const id of ['minecraft:copper_axe', 'custom:carving_tool']) for (const family of ['log', 'wood'])
    for (const face of ['up', 'down', 'north', 'south', 'east', 'west']) {
    const b = e.block(`lothlorien:mallorn_${family}`, { 'minecraft:block_face': face });
    const p = e.player(axe(id, { tags: id.startsWith('custom:') ? ['minecraft:is_axe'] : [] }));
    assert.equal(e.click(b, p).cancel, true); e.click(b, p); e.flush();
    assert.equal(b.typeId, `lothlorien:mallorn_stripped_${family}`); assert.equal(b.writes, 1);
    assert.equal(b.permutation.getState('minecraft:block_face'), face);
    assert.equal(p.held.durability.damage, 1);
  }
  const b = e.block('lothlorien:mallorn_log'), p = e.player(axe('custom:fake_axe'));
  assert.equal(e.click(b, p).cancel, undefined); assert.equal(e.queue.length, 0);
});
await scenario('strip wear respects native Unbreaking chance, Creative, unbreakable and the final Bedrock use', e => {
  const original = Math.random;
  try {
    for (const [level, roll, expected] of [[0, .99, 1], [1, .49, 1], [1, .5, 0], [3, .24, 1], [3, .25, 0], [99, .25, 0]]) {
      Math.random = () => roll;
      const p = e.player(axe(undefined, { enchantments: [{ type: { id: 'unbreaking' }, level }] }));
      const b = e.block('lothlorien:mallorn_log'); e.click(b, p); e.flush();
      assert.equal(p.held.durability.damage, expected); assert.equal(b.writes, 1);
    }
    Math.random = () => 0;
    for (const [mode, unbreakable] of [['creative', false], ['survival', true]]) {
      const p = e.player(axe(undefined, { durability: { unbreakable } }), mode);
      const b = e.block('lothlorien:mallorn_log'); e.click(b, p); e.flush(); assert.equal(p.held.durability.damage, 0);
    }
    const p = e.player(axe(undefined, { durability: { maxDurability: 1, damage: 0 } }));
    e.click(e.block('lothlorien:mallorn_log'), p); e.flush(); assert.equal(p.held.durability.damage, 1);
    e.click(e.block('lothlorien:mallorn_log'), p); e.flush(); assert.equal(p.held, undefined);
    assert.equal(e.sounds.filter(s => s === 'random.break').length, 1);
  } finally { Math.random = original; }
});
await scenario('stale axes, enchant/durability swaps, changed targets and invalid wear data abort safely', e => {
  for (const mutate of [p => { p.selectedSlotIndex++; }, p => { p.held.durability.damage++; },
    p => { p.held.enchantments.push({ type: { id: 'unbreaking' }, level: 1 }); }, p => { p.held.nameTag = 'other axe'; },
    p => { p.held.dynamic.owner = 'other'; }, p => { p.held = item('minecraft:diamond'); }]) {
    const b = e.block('lothlorien:mallorn_log'), p = e.player(axe()); e.click(b, p); mutate(p); e.flush();
    assert.equal(b.writes, undefined);
  }
  const p = e.player(axe(undefined, { durability: { throwChance: true } })), b = e.block('lothlorien:mallorn_log');
  e.click(b, p); e.flush(); assert.equal(b.writes, undefined); assert.equal(p.held.durability.damage, 0);
  p.held = axe(); e.click(b, p); b.typeId = 'minecraft:diamond_block'; e.flush(); assert.equal(b.writes, undefined);
});

for (const wood of ['mallorn', 'mallorn_heartwood']) {
  const slab = read(`../lothlorien_bp/blocks/${wood}_slab.json`)['minecraft:block'];
  for (const half of ['bottom', 'top']) {
    const c = { ...slab.components, ...(half === 'top' ? slab.permutations[0].components : {}) };
    assert.deepEqual(c['minecraft:collision_box'], { origin: [-8, half === 'top' ? 8 : 0, -8], size: [16, 8, 16] });
    assert.deepEqual(c['minecraft:selection_box'], c['minecraft:collision_box']);
    assert.equal(c['minecraft:light_dampening'], 0); assert.equal(c['minecraft:redstone_conductivity'].redstone_conductor, false);
    assert.equal(c['minecraft:liquid_detection'].detection_rules[0].can_contain_liquid, true);
  }
  const double = read(`../lothlorien_bp/blocks/${wood}_double_slab.json`)['minecraft:block'].components;
  assert.equal(double['minecraft:geometry'], 'minecraft:geometry.full_block');
  assert.equal(double['minecraft:redstone_conductivity'].redstone_conductor, true);
  assert.equal(double['minecraft:liquid_detection'].detection_rules[0].can_contain_liquid, false);
  const entry = read(`../lothlorien_bp/loot_tables/blocks/${wood}_double_slab.json`).pools[0].entries[0];
  assert.equal(entry.name, `lothlorien:${wood}_slab`);
  assert.deepEqual(entry.functions, [{ function: 'set_count', count: 2 }, { function: 'explosion_decay' }]);
  for (const [part, duration, tags] of [['planks', 15, ['minecraft:planks']], ['slab', 15, ['minecraft:wooden_slabs']], ['stairs', 15, []]]) {
    const c = read(`../lothlorien_bp/items/${wood}_${part}.json`)['minecraft:item'].components;
    assert.equal(c['minecraft:fuel'].duration, duration);
    for (const tag of tags) assert.ok(c['minecraft:tags'].tags.includes(tag));
  }
}
for (const name of ['mallorn_log', 'mallorn_stripped_log', 'mallorn_wood', 'mallorn_stripped_wood']) {
  const b = read(`../lothlorien_bp/blocks/${name}.json`)['minecraft:block'];
  assert.deepEqual(b.description.traits['minecraft:placement_position'].enabled_states, ['minecraft:block_face']);
  for (const [face, rotation] of [['east', [0, 0, 90]], ['west', [0, 0, 90]], ['up', [0, 0, 0]],
    ['down', [0, 0, 0]], ['north', [90, 0, 0]], ['south', [90, 0, 0]]]) {
    const matches = b.permutations.filter(p => Function(`return ${p.condition.replace(
      /q\.block_state\('minecraft:block_face'\)/g, JSON.stringify(face))}`)());
    assert.equal(matches.length, 1); assert.deepEqual(matches[0].components['minecraft:transformation'].rotation, rotation);
  }
  const c = read(`../lothlorien_bp/items/${name}.json`)['minecraft:item'].components;
  assert.equal(c['minecraft:fuel'].duration, 15);
  assert.ok(c['minecraft:tags'].tags.includes('minecraft:logs')); assert.ok(c['minecraft:tags'].tags.includes('minecraft:logs_that_burn'));
}
console.log(`wood interactions: ${count} production-handler scenarios plus both-set shape/fuel/loot contracts passed`);
