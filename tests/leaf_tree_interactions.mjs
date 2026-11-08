// Execute production growth/decay/use handlers with bounded fake worlds; no village/worldgen simulation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as rules from '../lothlorien_bp/scripts/tree_interaction_rules.js';
import * as greatRules from '../lothlorien_bp/scripts/great_mallorn_rules.js';
import * as decayRules from '../lothlorien_bp/scripts/leaf_decay.js';
import { SUPPORT_POLICIES } from '../lothlorien_bp/scripts/support_policies.js';
const read = p => JSON.parse(readFileSync(new URL('../lothlorien_bp/' + p, import.meta.url), 'utf8'));
const SOURCE = readFileSync(new URL('../lothlorien_bp/scripts/trees.js', import.meta.url), 'utf8')
  .replace(/^import \{([^}]+)\} from "[^"]+";/gm, 'const {$1} = globalThis.__tree;');
const DEFERRED = readFileSync(new URL('../lothlorien_bp/scripts/deferred_use.js', import.meta.url), 'utf8')
  .replace(/^import \{([^}]+)\} from "[^"]+";/gm, 'const {$1} = globalThis.__tree;');
const SAPLING = 'lothlorien:mallorn_sapling', LEAF = 'lothlorien:mallorn_leaves', PERSISTENT = 'lothlorien:persistent', STAGE = 'lothlorien:stage';
const DECAY = 'lothlorien:decay';
let count = 0;
const perm = (id, states = {}) => ({ type: { id }, getState: k => states[k], getAllStates: () => ({ ...states }),
  matches: (other, values) => other === id && JSON.stringify(values) === JSON.stringify(states),
  withState: (k, v) => perm(id, { ...states, [k]: v }) });
const meal = (amount = 3, name = '') => ({ typeId: 'minecraft:bone_meal', amount, name,
  clone() { const copy = meal(this.amount, this.name); copy.typeId = this.typeId; return copy; },
  isStackableWith(o) { return o.typeId === this.typeId && o.name === this.name; } });
async function scenario(name, body, file = 'trees.js') {
  const blocks = new Map(), components = new Map(), handlers = [], queue = [], jobs = [], commands = [], particles = [];
  const intervals = new Map(), events = {};
  let nextRun = 1;
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
    runJob(gen) { if (rejectJob) throw Error('job rejected'); jobs.push(gen); },
    runInterval(fn) { intervals.set(nextRun, fn); return nextRun++; }, clearRun(id) { intervals.delete(id); } };
  const tree = { logs: Array.from({ length: 7 }, (_, y) => ({ x: 0, y, z: 0, face: 'up' })),
    leaves: Array.from({ length: 230 }, (_, x) => ({ x: x + 1, y: 6, z: 0 })) };
  globalThis.__tree = { EquipmentSlot: { Mainhand: 'main' } };
  const deferred = await import(`data:text/javascript;base64,${Buffer.from(DEFERRED).toString('base64')}#d${count}`);
  globalThis.__tree = { ...rules, ...greatRules, ...decayRules, ...deferred, swingArm: p => { p.swings = (p.swings ?? 0) + 1; }, message: () => 'localized', system, world: {
    beforeEvents: { playerInteractWithBlock: { subscribe: fn => handlers.push(fn) } },
    afterEvents: { playerPlaceBlock: { subscribe(fn, options) { events.playerPlace = { fn, options }; } },
      playerBreakBlock: { subscribe(fn, options) { events.playerBreak = { fn, options }; } },
      blockExplode: { subscribe(fn) { events.explode = fn; } } }, structureManager: {
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
  const click = (b, p, first = true) => { const e = { block: b, player: p, itemStack: p.held.clone(), isFirstEvent: first }; handlers[0](e); return e; };
  const random = Math.random; Math.random = () => 0;
  try { await body({ block, plant, player, click, dim, system, runtime, commands, particles, jobs, tree, placements,
    tick: b => components.get('lothlorien:sapling').onRandomTick({ block: b }),
    greatTick: b => components.get('lothlorien:great_sprout').onRandomTick({ block: b }),
    place: p => components.get('lothlorien:leaves').beforeOnPlayerPlace(p),
    // the engine destroyed a block: Mallorn leaves / Mallorn wood report through onBreak, vanilla parts through events
    leafBroken: (location, decay = 0) => components.get('lothlorien:leaves').onBreak({ block: { location }, dimension: dim,
      brokenBlockPermutation: perm(LEAF, { [PERSISTENT]: false, [DECAY]: decay }) }),
    placed: location => events.playerPlace.fn({ block: { location }, dimension: dim }),
    // the native random tick of a marked leaf (lothlorien:leaf_decaying lives only in DECAY 1/2 permutations)
    decayTick: b => components.get('lothlorien:leaf_decaying').onRandomTick({ block: b, dimension: dim }),
    decayOf: location => dim.getBlock(location).permutation.getState(DECAY) ?? 0,
    woodBroken: location => components.get('lothlorien:tree_part').onBreak({ block: { location }, dimension: dim }),
    vanillaBroken: location => events.playerBreak.fn({ block: { location }, dimension: dim }),
    exploded: (location, id) => events.explode({ block: { location }, dimension: dim, explodedBlockPermutation: perm(id) }),
    events, intervals, components,
    advance: n => { for (let i = 0; i < n; i++) { system.currentTick++; for (const fn of [...intervals.values()]) fn(); } },
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
  assert.equal(e.click(b, p).cancel, true); e.click(b, p, false); e.flush();
  assert.equal(p.held.amount, 2); assert.equal(b.permutation.getState(STAGE), 1); assert.equal(e.particles.length, 1);
});
await scenario('a changed held item type or target cannot consume or grow', e => {
  for (const mutate of [p => { p.held.typeId = 'minecraft:diamond'; },
    () => { e.block('minecraft:stone'); }]) {
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
  const p = e.player(); e.click(b, p); e.flush(); assert.equal(p.held.amount, 2, 'bone meal is spent like on any sapling');
  for (const member of members) assert.equal(member.writes, undefined);
  e.block('minecraft:dirt', {}, { x: 1, y: 63, z: 1 });
  for (const member of members) assert.equal(e.runtime.growTree(member, 3), true, 'all reservations were released');
});
await scenario('growth accepts other species leaves, converts grass, protects later canopy construction', e => {
  const b = e.plant(1); e.block('minecraft:oak_leaves', {}, { x: 0, y: 67, z: 0 });
  assert.equal(e.runtime.growTree(b, 1), true); assert.equal(e.jobs[0].next().done, false);
  assert.equal(b.typeId, 'lothlorien:mallorn_log'); assert.equal(e.dim.getBlock({ x: 0, y: 63, z: 0 }).typeId, 'minecraft:dirt');
  const house = e.block('minecraft:glass', {}, { x: 220, y: 70, z: 0 }); e.finish(); assert.equal(house.writes, undefined);
});
const at = x => ({ x, y: 64, z: 0 });
await scenario('mixed species bridge and stripped vanilla wood keep a leaf; breaking that wood marks it', e => {
  e.block(LEAF, { [PERSISTENT]: false });
  e.block('minecraft:oak_leaves', {}, at(1)); e.block('lothlorien:mallorn_golden_leaves', {}, at(2));
  e.block('minecraft:stripped_birch_wood', {}, at(3));
  e.leafBroken(at(-1)); e.finish(); assert.equal(e.decayOf(at(0)), 0);
  assert.ok(e.events.playerBreak.options.blockTypes.includes('minecraft:stripped_birch_wood'), 'vanilla wood is filtered in');
  assert.ok(!e.events.playerBreak.options.blockTypes.some(id => id.startsWith('lothlorien:')), 'Mallorn parts use onBreak');
  e.block('minecraft:air', {}, at(3)); e.vanillaBroken(at(3)); e.finish();
  assert.equal(e.decayOf(at(0)), 1, 'marked only: the native random tick breaks it later');
  assert.deepEqual(e.commands, []); assert.equal(e.intervals.size, 0, 'no script timer');
  e.decayTick(e.dim.getBlock(at(0))); assert.deepEqual(e.commands, ['setblock 0 64 0 air destroy']);
});
await scenario('persistent leaves are never marked, a lone natural one is, an unreadable neighbour keeps it', e => {
  const b = e.block(LEAF, { [PERSISTENT]: false }); const placement = { permutationToPlace: b.permutation };
  e.place(placement); assert.equal(placement.permutationToPlace.getState(PERSISTENT), true);
  b.permutation = placement.permutationToPlace; e.woodBroken(at(1)); e.finish(); assert.equal(e.decayOf(at(0)), 0);
  b.permutation = perm(LEAF, { [PERSISTENT]: false }); e.throwRead(p => p.x === -1); e.woodBroken(at(1)); e.finish();
  assert.equal(e.decayOf(at(0)), 0);
  e.throwRead(undefined); e.woodBroken(at(1)); e.finish(); assert.equal(e.decayOf(at(0)), 1);
});
await scenario('explosions of vanilla wood count, other blocks start nothing', e => {
  e.block(LEAF, { [PERSISTENT]: false });
  e.exploded(at(1), 'minecraft:stone'); e.finish(); assert.equal(e.jobs.length, 0, 'other blocks start no search');
  e.exploded(at(1), 'minecraft:oak_log'); e.finish(); assert.equal(e.jobs.length, 1); assert.equal(e.decayOf(at(0)), 1);
});
await scenario('a decided leaf breaking starts no new search; a frontier leaf continues a long cut-off branch', e => {
  for (let x = 1; x <= 25; x++) e.block(LEAF, { [PERSISTENT]: false }, at(x));
  e.woodBroken(at(0)); e.finish();
  const marked = x => e.decayOf(at(x));
  assert.deepEqual(Array.from({ length: 25 }, (_, i) => marked(i + 1)),
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const jobs = e.jobs.length;
  for (let x = 1; x < 10; x++) { e.block('minecraft:air', {}, at(x)); e.leafBroken(at(x), 1); }
  assert.equal(e.jobs.length, jobs, 'decided leaves do not search again');
  e.block('minecraft:air', {}, at(10)); e.leafBroken(at(10), 2); e.finish();
  assert.equal(e.jobs.length, jobs + 1, 'the frontier leaf continues');
  assert.deepEqual(Array.from({ length: 15 }, (_, i) => marked(i + 11)), [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0]);
});
await scenario('a placed log clears the marks over the whole reach; a placed leaf bridges; placement is filtered', e => {
  for (let x = 1; x <= 14; x++) e.block(LEAF, { [PERSISTENT]: false }, at(x));
  e.woodBroken(at(0)); e.finish();
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(x => e.decayOf(at(x)) > 0));
  e.block('lothlorien:mallorn_log', {}, at(15)); e.placed(at(15)); e.finish();
  assert.deepEqual(Array.from({ length: 14 }, (_, i) => e.decayOf(at(i + 1))), [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'leaves 5..14 are within 10 steps of the new log: all unmarked, through still-marked leaves');
  // a placed persistent leaf next to wood carries the connection one step shorter
  e.block('minecraft:oak_log', {}, at(-2)); e.block(LEAF, { [PERSISTENT]: true }, at(-1)); e.block(LEAF, { [PERSISTENT]: false, [DECAY]: 1 }, at(0));
  e.placed(at(-1)); e.finish();
  assert.deepEqual([0, 1, 2, 3, 4].map(x => e.decayOf(at(x))), [0, 0, 0, 0, 0]);
  const types = e.events.playerPlace.options.blockTypes;
  assert.ok(types.includes('lothlorien:mallorn_log') && types.includes('minecraft:oak_leaves') && !types.includes('minecraft:stone'));
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
// Event-driven decay: leaves have no random tick; every Mallorn wood form and golden leaves report destruction.
for (const name of ['mallorn_log', 'mallorn_wood', 'mallorn_stripped_log', 'mallorn_stripped_wood', 'mallorn_golden_leaves']) {
  assert.deepEqual(read('blocks/' + name + '.json')['minecraft:block'].components['lothlorien:tree_part'], {}, name);
}
assert.deepEqual(read('blocks/mallorn_leaves.json')['minecraft:block'].components['lothlorien:leaves'], {});
{
  const leaves = read('blocks/mallorn_leaves.json')['minecraft:block'];
  assert.deepEqual(leaves.description.states[DECAY], [0, 1, 2]);
  assert.equal(leaves.components['lothlorien:leaf_decaying'], undefined, 'ordinary leaves have no random tick');
  assert.deepEqual(leaves.permutations, [{ condition: "q.block_state('lothlorien:decay') > 0", components: { 'lothlorien:leaf_decaying': {} } }]);
}
assert.equal(read('blocks/mallorn_leaves.json')['minecraft:block'].components['lothlorien:tree_part'], undefined);
console.log(`ok   leaf/tree interactions: native item/data/render/localization contracts (${++count} groups)`);
