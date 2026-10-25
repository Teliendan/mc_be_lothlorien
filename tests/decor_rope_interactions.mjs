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
await scenario('capture one entity once, with cosmetic failures after completion', e => {
  const f = e.fly(), p = e.player(GLASS, 3), other = e.player(GLASS);
  e.catch(p, f); e.catch(other, f); e.badSound(); e.badDeed(); e.flush();
  assert.equal(f.isValid, false); assert.equal(p.held.amount, 2); assert.equal(p.inventory[0].typeId, BOTTLE); assert.equal(other.held.typeId, GLASS);
});
await scenario('capture rejects a changed hand item and a disconnected player', e => {
  const mutations = [(p,f) => p.held = stack('minecraft:diamond'), p => p.isValid = false];
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
await scenario('release rejects a changed hand item, changed clicked block, blocked air and unload', e => {
  for (const change of [p => p.held = stack('minecraft:diamond'), p => p.isValid = false,
    (p,b) => b.setType('minecraft:dirt'), () => e.block('minecraft:stone', {}, { x: 0,y: 65,z: 0 })]) {
    const b = e.block('minecraft:stone'), p = e.player(BOTTLE, 3), count = e.spawned.length; e.click(p,b); change(p,b); e.flush(); assert.equal(e.spawned.length, count);
  }
  const b = e.block('minecraft:stone'), p = e.player(BOTTLE); e.click(p,b); e.unreadable(() => true); e.flush(); assert.equal(p.held.typeId, BOTTLE);
});
await scenario('nectar/dew callers still accept glass, reject filled firefly source and progress guarded partial dew', e => {
  e.block('lothlorien:mallorn_leaves', {}, { x: 0,y: 65,z: 0 });
  const bloom = e.block('lothlorien:nectar_bloom', { 'lothlorien:nectar': 3 }), p = e.player(GLASS);
  e.click(p,bloom); e.flush(); assert.equal(p.held.typeId, 'lothlorien:mallorn_nectar'); assert.equal(bloom.permutation.getState('lothlorien:nectar'),0);
  e.block('minecraft:stone', {}, { x: 1,y: 63,z: 0 });
  const cover = e.block('lothlorien:mallorn_leaf_carpet', { 'lothlorien:dew': true, 'lothlorien:amount': 1 }, { x: 1,y: 64,z: 0 });
  const dew = e.player(GLASS); e.click(dew,cover); e.flush(); assert.equal(dew.held.typeId, DEW); assert.equal(dew.held.getComponent('durability').damage,7);
  cover.setPermutation(cover.permutation.withState('lothlorien:dew', true)); e.click(dew,cover); e.flush(); assert.equal(dew.held.getComponent('durability').damage,6);
  bloom.setPermutation(bloom.permutation.withState('lothlorien:nectar',3)); const filled = e.player(BOTTLE); e.click(filled,bloom); e.flush();
  assert.equal(bloom.permutation.getState('lothlorien:nectar'),3);
});
await scenario('rope unroll/extension uses dimension bounds and charges once for the placed pieces', e => {
  e.dimension.heightRange = { min: 62, max: 66 }; const wall = e.block('minecraft:stone');
  for (const y of [62,63,65]) e.block('minecraft:stone', {}, { x: 0,y,z: 0 });
  const p = e.player(ROPE, 8); e.useRope(p,wall); assert.equal(p.held.amount,4);
  for (const y of [62,63,64,65]) assert.equal(e.dimension.getBlock({x:0,y,z:-1}).typeId,ROPE);
  e.useRope(p,e.dimension.getBlock({x:0,y:64,z:-1})); assert.equal(p.held.amount,4,'bounded full column has no extension');
});
await scenario('rope with unreadable cells places nothing; Creative keeps the count; last item is used up', e => {
  const b = e.block('minecraft:stone'), p = e.player(ROPE,3);
  e.unreadable(at => at.z === -1); e.useRope(p,b); assert.equal(e.writes,0); e.unreadable(() => false); e.flush();
  p.mode='creative'; e.useRope(p,b); assert.equal(p.held.amount,3); assert.equal(e.dimension.getBlock({x:0,y:64,z:-1}).typeId,ROPE); e.flush();
  const last = e.player(ROPE,1), b2 = e.block('minecraft:stone',{}, {x:2,y:64,z:0}); e.useRope(last,b2); assert.equal(last.held,undefined);
});
await scenario('inclusive top bound remains usable and hanging-rope extensions preserve identity', e => {
  e.dimension.heightRange={min:63,max:64};
  e.dimension.maxInclusive=true;
  const b=e.block('minecraft:stone'), p=e.player(ROPE,1); e.useRope(p,b); assert.equal(p.held,undefined);
  assert.equal(e.dimension.getBlock({x:0,y:64,z:-1}).typeId,ROPE);
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
    for(const fn of list) fn({block:wall,dimension:e.dimension,brokenBlockPermutation:wall.permutation,explodedBlockPermutation:wall.permutation,player:e.player()});
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
  p.mode='survival';
  for(const id of [ROPE,HANGING]) {
    const feet=e.block(id,{[id===ROPE?'lothlorien:face':'minecraft:cardinal_direction']:'north'});
    const head=e.block(id,{[id===ROPE?'lothlorien:face':'minecraft:cardinal_direction']:'north'}, {x:0,y:65,z:0});
    feet.isWaterlogged=true; assert.equal(e.rope.inRope(p),false,'wet feet cannot borrow dry rope above');
    feet.isWaterlogged=false; head.isWaterlogged=true; assert.equal(e.rope.inRope(p),true,'dry feet rope is actual lower contact');
    feet.setType('minecraft:air'); assert.equal(e.rope.inRope(p),false); head.isWaterlogged=false; assert.equal(e.rope.inRope(p),true,'prior head-only entry is preserved');
  }
});
await scenario('foreign (long) effects survive entry, sneak and leaving; our own 4-tick grants are replaced and removed', e => {
  const p=e.player(); e.block(ROPE,{'lothlorien:face':'north'}); e.rope.startRopeClimbing();
  for(const id of ['levitation','slow_falling']) {
    p.effects.clear(); const potion={amplifier:3,duration:200}; p.effects.set(id,potion); p.isSneaking=true; e.tick(4,false); e.tick(1,false);
    assert.equal(p.effects.get(id),potion); assert.equal(potion.duration,200); assert.equal(p.grants.length,0); assert.equal(p.removals.length,0); assert.equal(p.teleports.length,0);
    p.location.x=10; e.tick(1,false); assert.equal(p.effects.get(id),potion); assert.equal(p.removals.length,0); p.location.x=0;
  }
  p.effects.clear(); p.isSneaking=false; p.jump=true; e.tick(4,false); assert.equal(p.grants.at(-1).duration,ropeRules.CLIMB.effectTicks);
  assert.equal(ropeRules.CLIMB.effectTicks,4);
  const grants=p.grants.length; e.tick(1,false); assert.equal(p.grants.length>grants,true,'our own live 4-tick grant is replaced, not mistaken for a foreign one');
  assert.ok(p.removals.includes('levitation'));
  p.location.x=10; p.removals.length=0; e.tick(1,false); assert.ok(p.removals.includes('levitation'),'leaving removes our grant');
});
await scenario('the climb timer stays bounded and stops when nobody climbs', e => {
  const p=e.player(); e.block(ROPE,{'lothlorien:face':'north'}); p.jump=true; e.rope.startRopeClimbing(); e.tick(4,false);
  assert.equal([...e.intervals.values()].filter(i=>i.ticks===4).length,1); assert.equal([...e.intervals.values()].filter(i=>i.ticks===1).length,1);
  p.location.x=10; e.tick(1); assert.equal([...e.intervals.values()].filter(i=>i.ticks===1).length,0);
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
