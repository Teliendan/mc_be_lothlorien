// Production bottle/rope handlers; native behavior remains in-game acceptance.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as ropeRules from '../lothlorien_bp/scripts/elven_rope_rules.js';
import { createWorld, stack } from './fixtures/bottle_runtime.mjs';
const GLASS='minecraft:glass_bottle', BOTTLE='lothlorien:bottle_of_fireflies', FLY='lothlorien:firefly';
const ROPE='lothlorien:elven_rope', HANGING='lothlorien:elven_rope_hanging', DEW='lothlorien:dew_bottle';
const read=path=>JSON.parse(readFileSync(new URL('../lothlorien_bp/'+path,import.meta.url)));
let cases=0;
async function scenario(name,fn) { await fn(await createWorld()); cases++; console.log('ok   decor/rope interactions: '+name); }
await scenario('paired source validation, single/stack/full inventory/Creative bottle exchanges', e => {
  for (const source of [GLASS, BOTTLE]) for (const amount of [1,3]) for (const creative of [false,true]) for (const full of [false,true]) {
    const p = e.player(source, amount), output = source === GLASS ? BOTTLE : GLASS;
    p.mode = creative ? 'creative' : 'survival'; p.full = full;
    assert.equal(e.context.swapHeldBottle(p, stack(output), source), true);
    const result = !creative && amount === 1 ? p.held : full ? e.drops.at(-1).item : p.inventory.at(-1);
    assert.equal(result.typeId, output); if (creative || amount > 1) assert.equal(p.held.amount, creative ? amount : amount - 1);
  }
  const p = e.player(BOTTLE); assert.equal(e.context.swapHeldBottle(p, stack(GLASS)), false); assert.equal(p.held.typeId, BOTTLE);
});
await scenario('capture one entity once, container route before removal and cosmetic failures after completion', e => {
  const f = e.fly(), p = e.player(GLASS, 3), other = e.player(GLASS);
  e.catch(p, f); e.catch(other, f); e.badSound(); e.badDeed(); e.flush();
  assert.equal(f.isValid, false); assert.equal(p.held.amount, 2); assert.equal(p.inventory[0].typeId, BOTTLE); assert.equal(other.held.typeId, GLASS);
  const missing = e.player(GLASS, 3), alive = e.fly(); missing.noInventory = true; e.catch(missing, alive); e.flush(); assert.equal(alive.isValid, true);
});
await scenario('capture rejects stale hand, player/target dimension, identity/type, reach and disconnect', e => {
  const mutations = [(p,f) => p.held = stack('minecraft:diamond'), p => p.held.amount--, p => p.held.nameTag = 'changed',
    p => p.held.data.lore = ['new'], p => p.held.data.dynamic = { changed: 1 }, p => p.selectedSlotIndex++, p => p.mode = 'creative',
    p => p.dimension = { id: 'nether' }, p => p.isValid = false, (p,f) => f.dimension = { id: 'nether' },
    (p,f) => f.id += 'changed', (p,f) => f.typeId = 'minecraft:bee', (p,f) => f.location.x = 100];
  for (const change of mutations) {
    const p = e.player(GLASS, 3), f = e.fly(); e.catch(p,f); change(p,f); e.flush();
    assert.equal(f.isValid, true); assert.equal(p.inventory.length, 0);
  }
});
await scenario('release consumes filled source once per hand snapshot, returns glass and Creative keeps source', e => {
  const b = e.block('minecraft:stone'), p = e.player(BOTTLE, 2), other = e.player(BOTTLE);
  // Entity spawning does not occupy the air block: separate players may release
  // their own bottles there. Same-player queued duplicate uses must consume once.
  e.click(p,b); e.click(p,b); e.flush(); assert.equal(e.spawned.length, 1); assert.equal(p.held.amount, 1); assert.equal(p.inventory[0].typeId, GLASS);
  e.click(other,b); e.flush(); assert.equal(e.spawned.length, 2); assert.equal(other.held.typeId, GLASS);
  const creative = e.player(BOTTLE), c = e.block('minecraft:stone', {}, { x: 1,y: 64,z: 0 }); creative.mode = 'creative'; creative.full = true;
  e.click(creative,c); e.flush(); assert.equal(creative.held.typeId, BOTTLE); assert.equal(e.drops.at(-1).item.typeId, GLASS);
  assert.equal(e.spawned[0].options.spawnEvent, 'lothlorien:released');
});
await scenario('release rejects stale snapshot, changed clicked block, blocked air and unload', e => {
  for (const change of [p => p.held.nameTag = 'changed', p => p.held.amount--, p => p.selectedSlotIndex++, p => p.mode = 'creative',
    p => p.dimension = { id: 'nether' }, p => p.location.x = 100, p => p.isValid = false,
    (p,b) => b.setType('minecraft:dirt'), () => e.block('minecraft:stone', {}, { x: 0,y: 65,z: 0 })]) {
    const b = e.block('minecraft:stone'), p = e.player(BOTTLE, 3), count = e.spawned.length; e.click(p,b); change(p,b); e.flush(); assert.equal(e.spawned.length, count);
  }
  const b = e.block('minecraft:stone'), p = e.player(BOTTLE); e.click(p,b); e.unreadable(() => true); e.flush(); assert.equal(p.held.typeId, BOTTLE);
});
await scenario('nectar/dew callers still accept glass, reject filled firefly source and progress guarded partial dew', e => {
  e.block('lothlorien:mallorn_leaves', {}, { x: 0,y: 65,z: 0 });
  const bloom = e.block('lothlorien:nectar_bloom', { 'lothlorien:nectar': 3 }), p = e.player(GLASS);
  e.click(p,bloom); e.badDeed(); e.flush(); assert.equal(p.held.typeId, 'lothlorien:mallorn_nectar'); assert.equal(bloom.permutation.getState('lothlorien:nectar'),0);
  e.block('minecraft:stone', {}, { x: 1,y: 63,z: 0 });
  const cover = e.block('lothlorien:mallorn_leaf_carpet', { 'lothlorien:dew': true, 'lothlorien:amount': 1 }, { x: 1,y: 64,z: 0 });
  const dew = e.player(GLASS); e.click(dew,cover); e.flush(); assert.equal(dew.held.typeId, DEW); assert.equal(dew.held.getComponent('durability').damage,7);
  cover.setPermutation(cover.permutation.withState('lothlorien:dew', true)); e.click(dew,cover); e.flush(); assert.equal(dew.held.getComponent('durability').damage,6);
  bloom.setPermutation(bloom.permutation.withState('lothlorien:nectar',3)); const filled = e.player(BOTTLE); e.click(filled,bloom); e.flush();
  assert.equal(bloom.permutation.getState('lothlorien:nectar'),3);
});
await scenario('rope unroll/extension uses dimension bounds, charges per committed piece and refunds failed write', e => {
  e.dimension.heightRange = { min: 62, max: 66 }; const wall = e.block('minecraft:stone');
  for (const y of [62,63,65]) e.block('minecraft:stone', {}, { x: 0,y,z: 0 });
  const p = e.player(ROPE, 8); e.useRope(p,wall); assert.equal(p.held.amount,4);
  for (const y of [62,63,64,65]) assert.equal(e.dimension.getBlock({x:0,y,z:-1}).typeId,ROPE);
  e.useRope(p,e.dimension.getBlock({x:0,y:64,z:-1})); assert.equal(p.held.amount,4,'bounded full column has no extension');
  const c = e.block('minecraft:stone', {}, {x:2,y:64,z:0}); for (const y of [62,63,65]) e.block('minecraft:stone', {}, {x:2,y,z:0});
  const q = e.player(ROPE,3); e.failWrite(b => b.x === 2 && b.y === 63 && b.z === -1); e.useRope(q,c); assert.equal(q.held.amount,2);
  assert.equal(e.dimension.getBlock({x:2,y:64,z:-1}).typeId,ROPE); assert.equal(e.dimension.getBlock({x:2,y:63,z:-1}).typeId,'minecraft:air');
});
await scenario('rope rejects wrong hand/event, remote/dimension context, unknown bounds/cells and keeps Creative count', e => {
  const b = e.block('minecraft:stone'), wrong = e.player('minecraft:diamond',3); e.useRope(wrong,b,'North',stack(ROPE,3)); assert.equal(e.writes,0);
  const p = e.player(ROPE,3);
  p.location.x = 100; e.useRope(p,b); assert.equal(e.writes,0); p.location.x = 0;
  p.dimension = {id:'nether'}; e.useRope(p,b); assert.equal(e.writes,0); p.dimension=e.dimension;
  const bounds = e.dimension.heightRange; e.dimension.heightRange=undefined; e.useRope(p,b); assert.equal(e.writes,0); e.dimension.heightRange=bounds;
  e.unreadable(at => at.z === -1); e.useRope(p,b); assert.equal(e.writes,0); e.unreadable(() => false);
  p.mode='creative'; e.useRope(p,b); assert.equal(p.held.amount,3); assert.equal(e.dimension.getBlock({x:0,y:64,z:-1}).typeId,ROPE);
});
await scenario('rope write rollback never refunds a committed or unknown world write', e => {
  let p=e.player(ROPE,2), b=e.block('minecraft:stone',{}, {x:2,y:64,z:0});
  e.afterWrite(cell=>{ if(cell.z===-1) throw Error('write reported failure after commit'); }); e.useRope(p,b);
  assert.equal(p.held.amount,1); assert.equal(e.dimension.getBlock({x:2,y:64,z:-1}).typeId,ROPE);
  e.afterWrite(()=>{}); p=e.player(ROPE,2); b=e.block('minecraft:stone',{}, {x:3,y:64,z:0});
  e.failWrite(cell=>{ if(cell.z===-1) { e.unreadable(at=>at.x===3&&at.z===-1); return true; } return false; }); e.useRope(p,b);
  assert.equal(p.held.amount,1,'unknown outcome is not refunded speculatively');
});
await scenario('inclusive top bound remains usable, last-item rollback and hanging-rope extensions preserve identity', e => {
  e.dimension.heightRange={min:63,max:64};
  e.dimension.maxInclusive=true;
  const b=e.block('minecraft:stone'), p=e.player(ROPE,1); e.useRope(p,b); assert.equal(p.held,undefined);
  assert.equal(e.dimension.getBlock({x:0,y:64,z:-1}).typeId,ROPE);
  const b2=e.block('minecraft:stone',{}, {x:2,y:64,z:0}), q=e.player(ROPE,1);
  e.failWrite(cell=>cell.x===2&&cell.z===-1); e.useRope(q,b2); assert.equal(q.held.typeId,ROPE); assert.equal(q.held.amount,1);
  e.failWrite(()=>false);
  for(const face of ropeRules.FACES) {
    const offset=ropeRules.wallOffset(face), origin={x:4,y:64,z:4};
    const hanging=e.block(HANGING,{'minecraft:cardinal_direction':face},origin);
    e.block('minecraft:stone',{}, {x:origin.x+offset.x,y:63,z:origin.z+offset.z});
    e.block('minecraft:air',{}, {...origin,y:63}); const r=e.player(ROPE,2); r.location={...origin}; e.useRope(r,hanging);
    assert.equal(hanging.typeId,HANGING); const extra=e.dimension.getBlock({...origin,y:63}); assert.equal(extra.typeId,ROPE);
    assert.equal(extra.permutation.getState('lothlorien:face'),face); assert.equal(r.held.amount,1);
  }
});
await scenario('all column teardown adapters respect doTileDrops, canonical IDs, bounded reads and exactly-once loot', e => {
  for (const id of [ROPE,HANGING]) for (const face of ropeRules.FACES) for (const drops of [true,false]) {
    const state = id === ROPE ? 'lothlorien:face' : 'minecraft:cardinal_direction';
    for (const y of [63,64,65]) e.block(id, {[state]:face}, {x:0,y,z:0});
    e.context.world.gameRules.doTileDrops=drops; const count=e.drops.length;
    e.rope.dropWholeRope(e.dimension,{x:0,y:64,z:0},face); e.rope.dropWholeRope(e.dimension,{x:0,y:64,z:0},face);
    assert.equal(e.drops.length-count,drops?1:0); if(drops) { assert.equal(e.drops.at(-1).item.typeId,ROPE); assert.equal(e.drops.at(-1).item.amount,3); }
    for (const y of [63,64,65]) assert.equal(e.dimension.getBlock({x:0,y,z:0}).isAir,true);
  }
  for (const list of [e.subscribers.breaks,e.subscribers.explosions]) {
    const center=e.block(ROPE,{'lothlorien:face':'north'}), before=center.permutation;
    e.block(ROPE,{'lothlorien:face':'north'},{x:0,y:63,z:0}); center.setType('minecraft:air');
    const n=e.drops.length; for(const fn of list) fn({block:center,dimension:e.dimension,brokenBlockPermutation:before,explodedBlockPermutation:before,player:e.player()});
    assert.equal(e.drops.length,n,'gamerule suppresses scripted event remainder');
  }
});
await scenario('readable rope with unreadable supporting wall survives neighboring break/explosion', e => {
  for(const list of [e.subscribers.breaks,e.subscribers.explosions]) {
    const wall=e.block('minecraft:air',{}, {x:0,y:64,z:1});
    const piece=e.block(ROPE,{'lothlorien:face':'north'});
    e.unreadable(p=>p.x===0&&p.y===64&&p.z===1);
    for(const fn of list) fn({block:wall,dimension:e.dimension,brokenBlockPermutation:wall.permutation,player:e.player()});
    assert.equal(piece.typeId,ROPE); assert.equal(e.drops.length,0); e.unreadable(()=>false);
  }
});
await scenario('both rope IDs/all facings stop climbing when waterlogged and reject gliding/flying/vehicle/spectator', e => {
  const p=e.player(); for(const id of [ROPE,HANGING]) for(const face of ropeRules.FACES) {
    const b=e.block(id,{[id===ROPE?'lothlorien:face':'minecraft:cardinal_direction']:face});
    assert.equal(e.rope.inRope(p),true); b.isWaterlogged=true; assert.equal(e.rope.inRope(p),false);
  }
  e.block(ROPE,{'lothlorien:face':'north'});
  for(const field of ['isGliding','isFlying','vehicle']) { p[field]=true; assert.equal(e.rope.inRope(p),false); p[field]=false; }
  p.mode='spectator'; assert.equal(e.rope.inRope(p),false);
  p.mode='survival'; p.health=0; assert.equal(e.rope.inRope(p),false); p.health=20;
  for(const id of [ROPE,HANGING]) {
    const feet=e.block(id,{[id===ROPE?'lothlorien:face':'minecraft:cardinal_direction']:'north'});
    const head=e.block(id,{[id===ROPE?'lothlorien:face':'minecraft:cardinal_direction']:'north'}, {x:0,y:65,z:0});
    feet.isWaterlogged=true; assert.equal(e.rope.inRope(p),false,'wet feet cannot borrow dry rope above');
    feet.isWaterlogged=false; head.isWaterlogged=true; assert.equal(e.rope.inRope(p),true,'dry feet rope is actual lower contact');
    feet.setType('minecraft:air'); assert.equal(e.rope.inRope(p),false); head.isWaterlogged=false; assert.equal(e.rope.inRope(p),true,'prior head-only entry is preserved');
  }
});
await scenario('external effects survive entry, sneak, leaving and expiration without replay/removal/refresh', e => {
  const p=e.player(); e.block(ROPE,{'lothlorien:face':'north'}); e.rope.startRopeClimbing();
  for(const id of ['levitation','slow_falling']) {
    p.effects.clear(); const potion={amplifier:3,duration:200}; p.effects.set(id,potion); p.isSneaking=true; e.tick(4,false); e.tick(1,false);
    assert.equal(p.effects.get(id),potion); assert.equal(potion.duration,200); assert.equal(p.grants.length,0); assert.equal(p.removals.length,0); assert.equal(p.teleports.length,0);
    p.location.x=10; e.tick(1,false); assert.equal(p.effects.get(id),potion); p.location.x=0;
  }
  p.effects.clear(); p.isSneaking=false; p.jump=true; e.tick(4,false); assert.equal(p.grants.at(-1).duration,1);
  const external={amplifier:0,duration:2}; p.effects.set('levitation',external); const n=p.grants.length; e.tick(1); assert.equal(external.duration,1); assert.equal(p.grants.length,n);
  e.tick(1); assert.equal(p.effects.get('levitation').duration,1,'expired external grant is replaced only with new one-tick rope grant');
  assert.equal(p.removals.length,0);
});
await scenario('own grants naturally expire, late effect expiry pauses model and resumes from real velocity; timer stays bounded', e => {
  const p=e.player(); e.block(ROPE,{'lothlorien:face':'north'}); p.jump=true; e.rope.startRopeClimbing(); e.tick(4,false);
  assert.equal([...e.intervals.values()].filter(i=>i.ticks===4).length,1); assert.equal([...e.intervals.values()].filter(i=>i.ticks===1).length,1);
  const n=p.grants.length; e.tick(1,false); assert.equal(p.grants.length,n,'still-live effect is preserved');
  p.velocity.y=-.2; e.tick(1); assert.equal(p.grants.length,n+1); assert.equal(p.grants.at(-1).amplifier,ropeRules.levitationStep(-.2,4/20).amplifier);
  for(let i=0;i<10;i++) e.tick(1); assert.equal(p.grants.length,n+11,'normal one-tick expiry has no alternating stall');
  p.location.x=10; e.tick(1); assert.equal([...e.intervals.values()].filter(i=>i.ticks===1).length,0); assert.equal(p.effects.size,0);
});

// Recipe descriptor tests exercise every choice of the four independently
// tagged ingredient slots. Actual crafting/unlock is still native acceptance.
const recipe=read('recipes/elven_chandelier.json')['minecraft:recipe_shaped'];
assert.deepEqual(recipe.pattern,['L L',' A ','L L']); assert.deepEqual(recipe.unlock,[{item:'lothlorien:deer_antler'}]);
assert.deepEqual(recipe.result,{item:'lothlorien:elven_chandelier',count:1});
const members=readdirSync(new URL('../lothlorien_bp/items',import.meta.url)).filter(f=>f.endsWith('.json'))
  .map(f=>read('items/'+f)['minecraft:item']).filter(i=>i.components['minecraft:tags']?.tags.includes('lothlorien:elven_lantern'));
assert.deepEqual(members.map(i=>i.description.identifier).sort(),['lothlorien:elven_lantern','lothlorien:elven_lantern_heartwood']);
const accepts=(entry,id)=>entry.item===id || (entry.tag && members.some(i=>i.description.identifier===id && i.components['minecraft:tags'].tags.includes(entry.tag)));
for(let bits=0;bits<16;bits++) {
  const grid=['L L',' A ','L L'].map(row=>[...row]); let slot=0;
  for(const row of grid) for(let i=0;i<row.length;i++) if(row[i]==='L') row[i]=members[(bits>>slot++)&1].description.identifier;
  let count=0; for(let y=0;y<3;y++) for(let x=0;x<3;x++) { const symbol=recipe.pattern[y][x]; if(symbol!==' ') { count++; assert.ok(accepts(recipe.key[symbol],symbol==='A'?'lothlorien:deer_antler':grid[y][x])); } }
  assert.equal(count,5);
}
assert.equal(accepts(recipe.key.L,'minecraft:lantern'),false); assert.equal(accepts(recipe.key.L,'lothlorien:firefly_jar'),false);
assert.equal(read('items/elven_chandelier.json')['minecraft:item'].components['minecraft:max_stack_size'],64);
assert.deepEqual(read('items/elven_rope.json')['minecraft:item'].components['minecraft:fuel'],{duration:15});
console.log(`ok   decor/rope production scenarios: ${cases}; all 16 silver/gold recipe combinations, exact tag membership, stack and fuel`);
