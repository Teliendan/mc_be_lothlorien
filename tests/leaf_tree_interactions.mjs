// Execute production growth/decay/use handlers with bounded fake worlds; no village/worldgen simulation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as rules from '../lothlorien_bp/scripts/tree_interaction_rules.js';
import * as greatRules from '../lothlorien_bp/scripts/great_mallorn_rules.js';
import { SUPPORT_POLICIES } from '../lothlorien_bp/scripts/support_policies.js';
const read = p => JSON.parse(readFileSync(new URL('../lothlorien_bp/' + p, import.meta.url), 'utf8'));
const SOURCE = readFileSync(new URL('../lothlorien_bp/scripts/trees.js', import.meta.url), 'utf8')
  .replace(/^import \{([^}]+)\} from "[^"]+";/gm, 'const {$1} = globalThis.__tree;');
const SAPLING = 'lothlorien:mallorn_sapling', LEAF = 'lothlorien:mallorn_leaves', PERSISTENT = 'lothlorien:persistent', STAGE = 'lothlorien:stage';
let count = 0;
const perm = (id, states = {}) => ({ type: { id }, getState: k => states[k], getAllStates: () => ({ ...states }),
  matches: (other, values) => other === id && JSON.stringify(values) === JSON.stringify(states),
  withState: (k, v) => perm(id, { ...states, [k]: v }) });
const meal = (amount = 3, name = '') => ({ typeId: 'minecraft:bone_meal', amount, name,
  clone() { const copy = meal(this.amount, this.name); copy.typeId = this.typeId; return copy; },
  isStackableWith(o) { return o.typeId === this.typeId && o.name === this.name; } });
async function scenario(name, body, file = 'trees.js') {
  const blocks = new Map(), components = new Map(), handlers = [], queue = [], jobs = [], commands = [], particles = [];
  let reads = 0, unloaded, thrown, rejectJob = false;
  const placements = [];
  const key = p => `${p.x},${p.y},${p.z}`;
  const dim = { id: 'overworld', getBlock(p) {
    reads++; if (thrown?.(p)) throw Error('unloaded'); if (unloaded?.(p)) return undefined;
    return blocks.get(key(p)) ?? block('minecraft:air', {}, p);
  }, runCommand(c) { commands.push(c); }, spawnParticle(...a) { particles.push(a); } };
  function block(id, states = {}, location = { x: 0, y: 64, z: 0 }, light = 15) {
    const b = { typeId: id, permutation: perm(id, states), location, ...location, dimension: dim, isAir: id === 'minecraft:air',
      getLightLevel: () => light, setPermutation(p) { this.permutation = p; this.typeId = p.type.id;
        this.isAir = this.typeId === 'minecraft:air'; this.writes = (this.writes ?? 0) + 1; } };
    blocks.set(key(location), b); return b;
  }
  const system = { currentTick: 0, beforeEvents: { startup: { subscribe(fn) { fn({ blockComponentRegistry: {
    registerCustomComponent(id, c) { components.set(id, c); } } }); } } }, run: fn => queue.push(fn),
    runJob(gen) { if (rejectJob) throw Error('job rejected'); jobs.push(gen); } };
  const tree = { logs: Array.from({ length: 7 }, (_, y) => ({ x: 0, y, z: 0, face: 'up' })),
    leaves: Array.from({ length: 230 }, (_, x) => ({ x: x + 1, y: 6, z: 0 })) };
  globalThis.__tree = { ...rules, ...greatRules, message: () => 'localized', system, world: {
    beforeEvents: { playerInteractWithBlock: { subscribe: fn => handlers.push(fn) } },
    afterEvents: { playerPlaceBlock: { subscribe() {} } }, structureManager: {
      get: () => ({ getBlockPermutation: p => perm(p.x < 11 && p.y === 0 ? 'lothlorien:mallorn_log' : 'minecraft:structure_void') }),
      place: (...args) => placements.push(args),
    } },
    BlockPermutation: { resolve: perm }, EquipmentSlot: { Mainhand: 'main' }, GameMode: { Creative: 'creative' },
    makeRandom() {}, buildSmallMallorn: () => tree, buildBigMallorn: () => tree, repeatedUse: () => false,
    hangBloom: () => false, treeBloomCount: () => 0 };
  const source = file === 'trees.js' ? SOURCE : readFileSync(new URL('../lothlorien_bp/scripts/' + file, import.meta.url), 'utf8')
    .replace(/^import \{([\s\S]*?)\} from "[^"]+";/gm, 'const {$1} = globalThis.__tree;');
  const runtime = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${count}`);
  delete globalThis.__tree;
  const plant = (stage = 0) => { block('minecraft:grass_block', {}, { x: 0, y: 63, z: 0 }); return block(SAPLING, { [STAGE]: stage }); };
  const player = () => {
    const p = { held: meal(), selectedSlotIndex: 0, mode: 'survival', getGameMode() { return this.mode; },
      getComponent() { return { getEquipmentSlot: () => ({ getItem: () => p.held?.clone(),
        get amount() { return p.held.amount; }, set amount(n) { p.held.amount = n; }, setItem(i) { p.held = i; } }) }; } };
    return p;
  };
  const click = (b, p) => { const e = { block: b, player: p, itemStack: p.held.clone() }; handlers[0](e); return e; };
  const random = Math.random; Math.random = () => 0;
  try { await body({ block, plant, player, click, dim, system, runtime, commands, particles, jobs, tree, placements,
    tick: b => components.get('lothlorien:sapling').onRandomTick({ block: b }),
    greatTick: b => components.get('lothlorien:great_sprout').onRandomTick({ block: b }),
    decay: b => components.get('lothlorien:leaves').onRandomTick({ block: b, dimension: dim }),
    place: p => components.get('lothlorien:leaves').beforeOnPlayerPlace(p),
    flush: () => { while (queue.length) queue.shift()(); }, finish: () => { for (const job of jobs) while (!job.next().done) {} },
    unload: fn => { unloaded = fn; }, throwRead: fn => { thrown = fn; }, rejectJob: value => { rejectJob = value; }, reads: () => reads,
  }); } finally { Math.random = random; }
  count++; console.log('ok   leaf/tree interactions: ' + name);
}

await scenario('random growth checks light above and valid soil; unreadable light postpones growth', e => {
  const b = e.plant(); e.block('minecraft:air', {}, { x: 0, y: 65, z: 0 }, 8);
  e.tick(b); assert.equal(b.permutation.getState(STAGE), 0);
  e.block('minecraft:air', {}, { x: 0, y: 65, z: 0 }, 9); e.tick(b); assert.equal(b.permutation.getState(STAGE), 1);
  e.block('minecraft:stone', {}, { x: 0, y: 63, z: 0 }); e.tick(b); assert.equal(e.jobs.length, 0);
  e.block('minecraft:mycelium', {}, { x: 0, y: 63, z: 0 });
  e.throwRead(p => p.y === 65); e.tick(b); assert.equal(e.jobs.length, 0);
});
await scenario('bone meal works in darkness and consumes once after a guarded completion', e => {
  const b = e.plant(), p = e.player(); e.block('minecraft:air', {}, { x: 0, y: 65, z: 0 }, 0);
  assert.equal(e.click(b, p).cancel, true); e.click(b, p); e.flush();
  assert.equal(p.held.amount, 2); assert.equal(b.permutation.getState(STAGE), 1); assert.equal(e.particles.length, 1);
});
await scenario('stale held items, slots, metadata, modes, targets and soils cannot consume or grow', e => {
  for (const mutate of [p => { p.held.typeId = 'minecraft:diamond'; }, p => { p.selectedSlotIndex++; },
    p => { p.held.name = 'different'; }, p => { p.mode = 'creative'; }, p => { p.getGameMode = () => { throw Error('player left'); }; },
    () => { e.block('minecraft:stone'); }, () => { e.block('minecraft:stone', {}, { x: 0, y: 63, z: 0 }); }]) {
    const b = e.plant(), p = e.player(); e.click(b, p); mutate(p); e.flush();
    assert.equal(p.held.amount, 3); assert.equal(e.particles.length, 0);
  }
});
await scenario('job scheduling failure releases ordinary growth reservations', e => {
  const b = e.plant(1); e.rejectJob(true); assert.equal(e.runtime.growTree(b, 1), false);
  e.rejectJob(false); assert.equal(e.runtime.growTree(b, 2), true); e.finish();
});
await scenario('creative meal is retained and two players cannot advance the same snapshot twice', e => {
  const b = e.plant(), p = e.player(); p.mode = 'creative'; e.click(b, p); e.click(b, e.player()); e.flush();
  assert.equal(p.held.amount, 3); assert.equal(e.particles.length, 1); assert.equal(b.permutation.getState(STAGE), 1);
});
await scenario('tree growth reserves saplings, rechecks job start and refuses obstructed trunks', e => {
  let b = e.plant(1); assert.equal(e.runtime.growTree(b, 1), true); assert.equal(e.runtime.growTree(b, 2), false);
  e.block('minecraft:stone'); e.finish(); assert.equal(b.writes, undefined);
  b = e.plant(1); e.block('minecraft:glass', {}, { x: 0, y: 67, z: 0 });
  assert.equal(e.runtime.growTree(b, 1), false); assert.equal(b.typeId, SAPLING);
});
await scenario('2x2 overlap and invalid member soil abort safely and release every reservation', e => {
  const b = e.plant(1), members = [b];
  for (const [x, z] of [[1, 0], [0, 1], [1, 1]]) {
    e.block('minecraft:dirt', {}, { x, y: 63, z }); members.push(e.block(SAPLING, { [STAGE]: 1 }, { x, y: 64, z }));
  }
  assert.equal(e.runtime.growTree(b, 1, true), true);
  for (const member of members) assert.equal(e.runtime.growTree(member, 2), false);
  e.block('minecraft:stone', {}, { x: 1, y: 63, z: 1 }); e.finish();
  for (const member of members) assert.equal(member.writes, undefined);
  const p = e.player(); e.click(b, p); e.flush(); assert.equal(p.held.amount, 3);
  e.block('minecraft:dirt', {}, { x: 1, y: 63, z: 1 });
  for (const member of members) assert.equal(e.runtime.growTree(member, 3), true, 'all reservations were released');
});
await scenario('growth accepts other species leaves, converts grass, protects later canopy construction', e => {
  const b = e.plant(1); e.block('minecraft:oak_leaves', {}, { x: 0, y: 67, z: 0 });
  assert.equal(e.runtime.growTree(b, 1), true); assert.equal(e.jobs[0].next().done, false);
  assert.equal(b.typeId, 'lothlorien:mallorn_log'); assert.equal(e.dim.getBlock({ x: 0, y: 63, z: 0 }).typeId, 'minecraft:dirt');
  const house = e.block('minecraft:glass', {}, { x: 220, y: 70, z: 0 }); e.finish(); assert.equal(house.writes, undefined);
});
await scenario('mixed species bridge and stripped vanilla wood support ordinary leaves', e => {
  const b = e.block(LEAF, { [PERSISTENT]: false });
  e.block('minecraft:oak_leaves', {}, { x: 1, y: 64, z: 0 });
  e.block('lothlorien:mallorn_golden_leaves', {}, { x: 2, y: 64, z: 0 });
  e.block('minecraft:stripped_birch_wood', {}, { x: 3, y: 64, z: 0 });
  e.decay(b); assert.deepEqual(e.commands, []);
  const before = e.reads(); e.decay(b); assert.equal(e.reads(), before, 'positive path cache avoids another search');
});
await scenario('persistent leaves skip decay, no-support decays, unreadable neighbors preserve', e => {
  const b = e.block(LEAF, { [PERSISTENT]: false }); const placement = { permutationToPlace: b.permutation };
  e.place(placement); assert.equal(placement.permutationToPlace.getState(PERSISTENT), true);
  b.permutation = placement.permutationToPlace; e.decay(b); assert.equal(e.reads(), 0);
  b.permutation = perm(LEAF, { [PERSISTENT]: false }); e.decay(b); assert.equal(e.commands.length, 1);
  e.commands.length = 0; e.throwRead(p => p.x === 1); e.decay(b); assert.equal(e.commands.length, 0);
});
await scenario('Great sprout checks above-light and soil and preserves its no-bone-meal rule', e => {
  e.plant(); const b = e.block(greatRules.SPROUT_ID, { [STAGE]: 0 });
  e.block('minecraft:air', {}, { x: 0, y: 65, z: 0 }, 8); e.greatTick(b); assert.equal(b.writes, undefined);
  e.block('minecraft:air', {}, { x: 0, y: 65, z: 0 }, 9); e.greatTick(b); assert.equal(b.permutation.getState(STAGE), 1);
  e.block('minecraft:stone', {}, { x: 0, y: 63, z: 0 }); e.greatTick(b); assert.equal(e.jobs.length, 0);
  const p = e.player(); p.sendMessage = () => {}; assert.equal(e.click(b, p).cancel, true); e.flush(); assert.equal(p.held.amount, 3);
}, 'great_mallorn.js');
await scenario('Great placement rechecks soil, light and target after yielded structure reads', e => {
  for (const mutate of [() => e.block('minecraft:stone', {}, { x: 0, y: 63, z: 0 }),
    () => e.block('minecraft:air', {}, { x: 0, y: 65, z: 0 }, 0), () => e.block('minecraft:stone')]) {
    e.plant(); const b = e.block(greatRules.SPROUT_ID, { [STAGE]: 1 });
    e.block('minecraft:air', {}, { x: 0, y: 65, z: 0 }, 15); e.greatTick(b);
    const job = e.jobs.at(-1); assert.equal(job.next().done, false); mutate(); while (!job.next().done) {}
    assert.equal(e.placements.length, 0);
  }
}, 'great_mallorn.js');

for (const name of ['mallorn_leaves', 'mallorn_golden_leaves']) {
  const id = 'lothlorien:' + name, item = read('items/' + name + '.json')['minecraft:item'], block = read('blocks/' + name + '.json')['minecraft:block'];
  assert.equal(item.description.identifier, id); assert.equal(item.components['minecraft:block_placer'].replace_block_item, true);
  assert.equal(item.components['minecraft:block_placer'].block, id); assert.equal(item.components['minecraft:icon'], undefined, 'retain cube rendering');
  assert.equal(item.components['minecraft:display_name'].value, 'tile.' + id + '.name');
  assert.equal(item.components['minecraft:compostable'].composting_chance, 30);
  assert.deepEqual(item.description.menu_category, block.description.menu_category);
  assert.equal(block.components['minecraft:chest_obstruction'].obstruction_rule, 'never');
  const recipe = read('recipes/furnace_' + name + '.json')['minecraft:recipe_furnace'];
  assert.equal(recipe.input, id); assert.equal(recipe.output, 'lothlorien:mallorn_leaf_carpet'); assert.deepEqual(recipe.tags, ['furnace']);
  for (const locale of ['en_US', 'cs_CZ', 'es_ES', 'es_MX', 'pt_PT', 'pt_BR', 'de_DE', 'fr_FR', 'pl_PL']) {
    assert.ok(readFileSync(new URL('../lothlorien_rp/texts/' + locale + '.lang', import.meta.url), 'utf8').includes('tile.' + id + '.name='));
  }
}
assert.equal(read('items/mallorn_acorn.json')['minecraft:item'].components['minecraft:fuel'].duration, 5);
const nut = read('items/great_mallorn_nut.json')['minecraft:item'].components;
assert.equal(nut['minecraft:fuel'], undefined); assert.equal(nut['minecraft:compostable'], undefined);
for (const name of ['mallorn_sapling', 'great_mallorn_sprout']) {
  const soils = read('blocks/' + name + '.json')['minecraft:block'].components['minecraft:placement_filter'].conditions[0].block_filter;
  assert.deepEqual(new Set(soils), rules.SAPLING_SOILS); assert.deepEqual(SUPPORT_POLICIES['lothlorien:' + name].allowed, soils);
}
assert.ok(read('blocks/mallorn_sapling.json')['minecraft:block'].components['minecraft:flower_pottable']);
assert.equal(read('blocks/mallorn_golden_leaves.json')['minecraft:block'].components['lothlorien:leaves'], undefined);
console.log(`ok   leaf/tree interactions: native item/data/render/localization contracts (${++count} groups)`);
