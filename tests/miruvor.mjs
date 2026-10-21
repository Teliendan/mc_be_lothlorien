// Production callbacks; native callback ordering, cancellation and UI need Minecraft.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../lothlorien_bp/' + name, import.meta.url), 'utf8');
const c = JSON.parse(read('items/miruvor.json'))['minecraft:item'].components;
const category = c['minecraft:cooldown'].category;
assert.equal(c['minecraft:cooldown'].duration, 0);
assert.equal(c['minecraft:use_modifiers'].use_duration, 2);
const callbacks = new Map();
const context = { EquipmentSlot: { Mainhand: 'main' }, GameMode: { Creative: 'Creative' }, SUPPORT_POLICIES: {},
  system: { beforeEvents: { startup: { subscribe(fn) {
    fn({ itemComponentRegistry: { registerCustomComponent: (id, handlers) => callbacks.set(id, handlers) } });
  } } } } };
async function load(name) {
  globalThis.__medicine = context;
  const source = read('scripts/' + name).replace(/^import \{([\s\S]*?)\} from "[^"]+";/gm, 'const {$1} = globalThis.__medicine;');
  try { return await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`); }
  finally { delete globalThis.__medicine; }
}
await load('athelas.js');
function skin(damage = 0, name = undefined) {
  const d = { damage, maxDurability: 4, unbreakable: false };
  return { typeId: 'lothlorien:miruvor', amount: 1, nameTag: name, isStackable: false,
    getRawLore: () => [], getCanPlaceOn: () => [], getCanDestroy: () => [], getDynamicPropertyIds: () => [],
    getComponent: id => id.endsWith('durability') ? d : undefined,
    isStackableWith: () => false, clone() { const result = skin(d.damage, this.nameTag);
      result.typeId = this.typeId; result.amount = this.amount; return result; } };
}
function player(damage = 0) {
  const p = { id: 'player', typeId: 'minecraft:player', isValid: true, selectedSlotIndex: 0,
    dimension: { id: 'overworld' }, mode: 'Survival', held: skin(damage), effects: [], calls: [],
    existing: new Map(), cooldowns: new Map(),
    getGameMode() { return this.mode; },
    getComponent(id) { assert.equal(id, 'equippable'); return { getEquipmentSlot: () => ({
      getItem: () => p.held?.clone(), setItem(item) { p.held = item?.clone(); p.calls.push('sip'); },
    }) }; },
    getEffect(id) { return p.existing.get(id); },
    addEffect(...args) { p.effects.push(args); p.calls.push('effect'); },
    removeEffect(id) { assert.equal(id, 'poison'); p.calls.push('cure'); return false; },
    playSound(id) { assert.equal(id, 'random.break'); },
    getItemCooldown(id) { return p.cooldowns.get(id) ?? 0; },
    startItemCooldown(id, ticks) { p.cooldowns.set(id, ticks); p.calls.push('cooldown'); },
  }; return p;
}
const miruvor = callbacks.get('lothlorien:miruvor');
const event = p => ({ source: p, itemStack: p.held?.clone() });
const damage = p => p.held?.getComponent('durability').damage;
let cases = 0;
function check(name, fn) { fn(); cases++; console.log('ok   miruvor: ' + name); }
check('attempts without native completion give nothing', () => {
  const p = player(); for (let i = 0; i < 3; i++) miruvor.onUse?.(event(p));
  assert.equal(p.effects.length, 0); assert.equal(damage(p), 0); assert.equal(p.cooldowns.size, 0);
});
check('normal completion, original balance and player isolation', () => {
  const p = player(); miruvor.onCompleteUse(event(p));
  assert.deepEqual(p.effects, [['instant_health', 1, { amplifier: 0, showParticles: true }],
    ['regeneration', 160, { amplifier: 1, showParticles: true }], ['speed', 600, { amplifier: 0, showParticles: true }]]);
  assert.equal(damage(p), 1); assert.equal(p.cooldowns.get(category), 600);
  assert.deepEqual(p.calls, ['effect', 'effect', 'effect', 'cure', 'sip', 'cooldown']);
  assert.equal(player().cooldowns.size, 0);
});
check('four sips, final sound failure and replacement-skin cooldown', () => {
  const p = player(); p.playSound = () => { throw Error('sound unavailable'); };
  for (let sip = 0; sip < 4; sip++) {
    p.cooldowns.clear(); miruvor.onCompleteUse(event(p));
    assert.equal(damage(p), sip < 3 ? sip + 1 : undefined); assert.equal(p.cooldowns.get(category), 600);
  }
  p.held = skin(); const count = p.effects.length; miruvor.onCompleteUse(event(p));
  assert.equal(p.effects.length, count); assert.equal(damage(p), 0);
});
check('Creative retains progress, duplicate completion blocked', () => {
  const p = player(3); p.mode = 'Creative'; const e = event(p); miruvor.onCompleteUse(e); miruvor.onCompleteUse(e);
  assert.equal(damage(p), 3); assert.equal(p.effects.length, 3); assert.equal(p.cooldowns.get(category), 600);
});
check('invalid completed skins and unavailable live slot give nothing', () => {
  const wrong = player(); wrong.held.typeId = 'minecraft:stick'; miruvor.onCompleteUse(event(wrong));
  assert.equal(wrong.effects.length, 0); assert.equal(wrong.cooldowns.size, 0);
  const empty = player(), completed = event(empty); empty.held = undefined;
  miruvor.onCompleteUse(completed); assert.equal(empty.effects.length, 0);
  const unavailable = player(); unavailable.getComponent = () => { throw Error('entity unavailable'); };
  miruvor.onCompleteUse(event(unavailable)); assert.equal(unavailable.effects.length, 0);
  for (const value of [-1, 4, .5, NaN]) {
    const p = player(value); miruvor.onCompleteUse(event(p)); assert.equal(p.effects.length, 0);
  }
  const p = player(), e = event(p); e.itemStack.amount = 2; miruvor.onCompleteUse(e); assert.equal(p.effects.length, 0);
});
check('native completion charges current progress and preserves the skin name', () => {
  const p = player(2); p.held.nameTag = 'Traveller'; miruvor.onCompleteUse(event(p));
  assert.equal(damage(p), 3); assert.equal(p.held.nameTag, 'Traveller'); assert.equal(p.cooldowns.get(category), 600);
});
check('stronger, longer/equal and defensive infinite effects preserved', () => {
  for (const effect of [{ amplifier: 2, duration: 20 }, { amplifier: 0, duration: 1000 },
    { amplifier: 1, duration: 160 }, { amplifier: 0, duration: -1 }, { amplifier: 0, duration: Infinity }]) {
    const p = player(); p.existing.set('regeneration', effect); p.existing.set('speed', { amplifier: 1, duration: 20 });
    miruvor.onCompleteUse(event(p)); assert.deepEqual(p.effects.map(e => e[0]), ['instant_health']); assert.equal(damage(p), 1);
  }
  const p = player(); p.existing.set('regeneration', { amplifier: 0, duration: 100 });
  miruvor.onCompleteUse(event(p)); assert.equal(p.effects.length, 3);
});
check('total failure spends nothing; partial success still spends and cools', () => {
  const failed = player(); failed.getEffect = () => { throw Error('gone'); };
  failed.addEffect = () => { throw Error('gone'); }; failed.removeEffect = () => { throw Error('gone'); };
  miruvor.onCompleteUse(event(failed)); assert.equal(damage(failed), 0); assert.equal(failed.cooldowns.size, 0);
  const p = player(); p.getEffect = () => { throw Error('persistent effect unavailable'); };
  miruvor.onCompleteUse(event(p)); assert.equal(p.effects.length, 1); assert.equal(damage(p), 1);
  assert.equal(p.cooldowns.get(category), 600);
  miruvor.onCompleteUse(event(p)); assert.equal(p.effects.length, 1);
});
check('poison-cure failure cannot bypass cooldown; write failure still cools', () => {
  const p = player(); p.removeEffect = () => { throw Error('cure unavailable'); };
  miruvor.onCompleteUse(event(p)); assert.equal(damage(p), 1); assert.equal(p.cooldowns.get(category), 600);
  const broken = player(); broken.getComponent = () => ({ getEquipmentSlot: () => ({ getItem: () => broken.held.clone(),
    setItem() { throw Error('write failed'); } }) });
  miruvor.onCompleteUse(event(broken)); assert.equal(broken.effects.length, 3); assert.equal(broken.cooldowns.get(category), 600);
});
check('salve native consumption not duplicated, no Miruvor cooldown', () => {
  const p = player(); p.existing.set('regeneration', { amplifier: 0, duration: 1000 });
  callbacks.get('lothlorien:salve').onConsume({ source: p });
  assert.equal(p.effects.length, 0); assert.deepEqual(p.calls, ['cure']); assert.equal(damage(p), 0);
  assert.equal(p.cooldowns.size, 0);
});
console.log(`ok   ${cases} medicine production scenarios`);
