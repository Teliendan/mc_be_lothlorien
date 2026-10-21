// Production capture/release and declared native policies; no native stacking/AI simulation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, stack } from './fixtures/bottle_runtime.mjs';
const GLASS='minecraft:glass_bottle', BOTTLE='lothlorien:bottle_of_fireflies';
const read=path=>JSON.parse(readFileSync(new URL('../lothlorien_bp/'+path,import.meta.url),'utf8'));
let cases=0;
async function test(name,fn){await fn(await createWorld());cases++;console.log('ok   small flyers: '+name);}
const captured=(e,p)=>p.held.typeId===BOTTLE?p.held:p.inventory.at(-1)??e.drops.at(-1).item;
function release(e,item){const p=e.player(BOTTLE);p.held=item.clone();const b=e.block('minecraft:stone');e.click(p,b);e.flush();return {player:p,animal:e.spawned.at(-1)};}

await test('independent songbirds, native lead anchors and insect flap events preserve species scope',()=>{
  const bird=read('entities/songbird.json')['minecraft:entity'].components;
  assert.equal(bird['minecraft:behavior.follow_mob'],undefined);assert.equal(bird['minecraft:behavior.flock'],undefined);
  assert.equal(bird['minecraft:behavior.random_fly'].can_land_on_trees,false);assert.equal(bird['minecraft:movement'].value,.4);
  for(const id of ['songbird','butterfly'])assert.deepEqual(read(`entities/${id}.json`)['minecraft:entity'].components['minecraft:leashable_to'],{});
  for(const id of ['butterfly','firefly'])assert.deepEqual(read(`entities/${id}.json`)['minecraft:entity'].components['minecraft:game_event_movement_tracking'],{emit_flap:true});
  const firefly=read('entities/firefly.json')['minecraft:entity'].components;
  assert.equal(firefly['minecraft:leashable'],undefined);assert.equal(firefly['minecraft:leashable_to'],undefined);
  assert.equal(read('items/bottle_of_fireflies.json')['minecraft:item'].components['minecraft:max_stack_size'],16);
});
await test('healthy unnamed capture stays plain; named empty glass cannot name the animal',e=>{
  const p=e.player(GLASS,1,{name:'Not an animal name',lore:['Unrelated glass lore']}),f=e.fly();e.catch(p,f);e.flush();
  assert.equal(f.isValid,false);assert.equal(p.held.typeId,BOTTLE);assert.equal(p.held.nameTag,undefined);assert.deepEqual(p.held.getRawLore(),[]);
  assert.throws(()=>p.held.setDynamicProperty('test',1));
  const out=release(e,p.held);assert.equal(out.animal.nameTag,'');assert.equal(out.animal.health.currentValue,2);
  assert.deepEqual(out.player.held.getRawLore(),[]);assert.equal(out.player.held.typeId,GLASS);
});
await test('captured names and exact injured health survive real callback and item-clone paths',e=>{
  for(const [name,health] of [['Glow',2],['',1],['Dusk',.75]]){
    const p=e.player(GLASS),f=e.fly();f.nameTag=name;f.health.currentValue=health;e.catch(p,f);e.flush();
    const item=p.held.clone();assert.deepEqual(item.getRawLore(),p.held.getRawLore());
    const out=release(e,item);assert.equal(out.animal.nameTag,name);assert.equal(out.animal.health.currentValue,health);
    assert.equal(out.player.held.typeId,GLASS);assert.deepEqual(out.player.held.getRawLore(),[]);assert.equal(out.player.held.nameTag,undefined);
  }
});
await test('capture reads actual entity name/health at the real deferred completion',e=>{
  const p=e.player(GLASS),f=e.fly();f.nameTag='Before';e.catch(p,f);f.nameTag='After';f.health.currentValue=1.25;e.flush();
  const out=release(e,p.held);assert.equal(out.animal.nameTag,'After');assert.equal(out.animal.health.currentValue,1.25);
});
await test('long Unicode names use bounded localized parts and restore without anvil renaming',e=>{
  const name='\u2728'.repeat(205)+'\ud83c\udf1f'.repeat(25);assert.equal(name.length,255);
  const p=e.player(GLASS),f=e.fly();f.nameTag=name;f.health.currentValue=.5;e.catch(p,f);e.flush();
  const lore=p.held.getRawLore();assert.ok(lore.length<=20);p.held.nameTag='Bottle title only';
  const catalog=JSON.parse(readFileSync(new URL('../localization/catalog.json',import.meta.url),'utf8'));
  for(const line of lore){const arg=line.with.rawtext[0].text;assert.ok(arg.length<=24);
    const entry=catalog.packs.lothlorien_rp.entries[line.translate];assert.ok(entry);
    for(const locale of catalog.locales){const text=locale==='en_US'?entry.source:entry.translations[locale].text;
      assert.ok(text.replace('%s',arg).length<=50,locale);assert.ok(!text.includes('?'),locale);}
  }
  const out=release(e,p.held);assert.equal(out.animal.nameTag,name);assert.equal(out.animal.health.currentValue,.5);
});
await test('structured lore with documented string-array arguments also restores capture state',e=>{
  const p=e.player(GLASS),f=e.fly();f.nameTag='Array';f.health.currentValue=1;e.catch(p,f);e.flush();
  p.held.setLore(p.held.getRawLore().map(line=>({...line,with:[line.with.rawtext[0].text]})));
  const out=release(e,p.held);assert.equal(out.animal.nameTag,'Array');assert.equal(out.animal.health.currentValue,1);
});
await test('anvil-renamed plain bottles and unrelated lore never supply animal identity',e=>{
  const item=stack(BOTTLE,1,{name:'Anvil title',lore:[{text:'Decorative note'}]});
  const out=release(e,item);assert.equal(out.animal.nameTag,'');assert.equal(out.animal.health.currentValue,2);
});
await test('stacked/full-inventory and Creative capture/release preserve metadata and existing container policy',e=>{
  for(const [amount,creative,full] of [[3,false,false],[3,false,true],[1,true,false],[3,true,true]]){
    const p=e.player(GLASS,amount),f=e.fly();p.mode=creative?'creative':'survival';p.full=full;f.nameTag='Carried';f.health.currentValue=1;
    e.catch(p,f);e.flush();const item=captured(e,p);assert.equal(item.typeId,BOTTLE);
    if(creative||amount>1)assert.equal(p.held.amount,creative?amount:amount-1);
    const q=e.player(BOTTLE);q.held=item.clone();q.held.amount=3;q.mode=p.mode;q.full=full;
    e.click(q,e.block('minecraft:stone'));e.flush();const animal=e.spawned.at(-1);
    assert.equal(animal.nameTag,'Carried');assert.equal(animal.health.currentValue,1);assert.equal(q.held.amount,creative?3:2);
    const empty=full?e.drops.at(-1).item:q.inventory.at(-1);assert.equal(empty.typeId,GLASS);assert.deepEqual(empty.getRawLore(),[]);
  }
});
await test('different capture data stays distinct while identical data matches structurally',e=>{
  const bottles=[];
  for(const [name,health] of [['A',1],['B',1],['A',.5],['A',1]]){const p=e.player(GLASS),f=e.fly();f.nameTag=name;f.health.currentValue=health;e.catch(p,f);e.flush();bottles.push(p.held);}
  assert.notDeepEqual(bottles[0].getRawLore(),bottles[1].getRawLore());assert.notDeepEqual(bottles[0].getRawLore(),bottles[2].getRawLore());
  assert.deepEqual(bottles[0].getRawLore(),bottles[3].getRawLore()); // actual native merge behavior is not simulated
});
await test('unreadable/dead capture state leaves the original animal and glass untouched',e=>{
  for(const bad of [f=>f.health.currentValue=0,f=>f.getComponent=()=>{throw Error('unavailable health');}]){
    const p=e.player(GLASS),f=e.fly();bad(f);e.catch(p,f);e.flush();assert.equal(f.isValid,true);assert.equal(p.held.typeId,GLASS);
  }
});
await test('failed name or health restoration removes the new actor and preserves the bottle',e=>{
  for(const kind of ['name','health']){
    const item=stack(BOTTLE);e.context.bottleFirefly(item,{nameTag:'Restore',getComponent:()=>({currentValue:1})});
    const spawn=e.dimension.spawnEntity.bind(e.dimension);e.dimension.spawnEntity=(...args)=>{const f=spawn(...args);
      if(kind==='name')Object.defineProperty(f,'nameTag',{set(){throw Error('name write');}});else f.health.setCurrentValue=()=>false;return f;};
    const out=release(e,item);assert.equal(out.animal.isValid,false);assert.equal(out.player.held.typeId,BOTTLE);
    e.dimension.spawnEntity=spawn;
  }
});
await test('deferred changed bottle data rejects release before creating an actor',e=>{
  const item=stack(BOTTLE);e.context.bottleFirefly(item,{nameTag:'Original',getComponent:()=>({currentValue:1})});
  const p=e.player(BOTTLE);p.held=item;const before=e.spawned.length;e.click(p,e.block('minecraft:stone'));
  p.held.setLore([]);e.flush();assert.equal(e.spawned.length,before);assert.equal(p.held.typeId,BOTTLE);
});
console.log(`Passed ${cases} production small-flyer/data scenarios; native lore persistence/stacking remains acceptance.`);
