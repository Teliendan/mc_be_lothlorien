// Production callbacks; native callback ordering, cancellation and UI need Minecraft.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../lothlorien_bp/' + name, import.meta.url), 'utf8');
const c = JSON.parse(read('items/miruvor.json'))['minecraft:item'].components;
const category = c['minecraft:cooldown'].category;
assert.equal(c['minecraft:cooldown'].duration, 0);
assert.equal(c['minecraft:use_modifiers'].use_duration, 2);
const callbacks = new Map();
const context = { EquipmentSlot: { Mainhand: 'main' }, GameMode: { Creative: 'Creative' },
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
function skin(damage = 0, typeId = 'lothlorien:miruvor') {
  const d = { damage, maxDurability: 4, unbreakable: false };
  return { typeId, getComponent: () => d };
}
function player(damage = 0) {
  const p = { held: skin(damage), effects: [], calls: [], existing: new Map(), cooldowns: new Map(), mode: 'Survival',
    getGameMode() { return this.mode; },
    getComponent(id) { assert.equal(id, 'equippable'); return { getEquipmentSlot: () => ({
      getItem: () => p.held, setItem(item) { p.held = item; p.calls.push('sip'); },
    }) }; },
    getEffect(id) { return p.existing.get(id); },
    addEffect(...args) { p.effects.push(args); p.calls.push('effect'); },
    removeEffect(id) { assert.equal(id, 'poison'); p.calls.push('cure'); },
    playSound(id) { assert.equal(id, 'random.break'); },
    startItemCooldown(id, ticks) { p.cooldowns.set(id, ticks); p.calls.push('cooldown'); },
  }; return p;
}
const miruvor = callbacks.get('lothlorien:miruvor');
const damage = p => p.held?.getComponent().damage;
let cases = 0;
function check(name, fn) { fn(); cases++; console.log('ok   miruvor: ' + name); }
check('completion: original balance, poison cure, sip, then cooldown', () => {
  const p = player(); miruvor.onCompleteUse({ source: p });
  assert.deepEqual(p.effects, [['instant_health', 1, { amplifier: 0, showParticles: true }],
    ['regeneration', 160, { amplifier: 1, showParticles: true }], ['speed', 600, { amplifier: 0, showParticles: true }]]);
  assert.equal(damage(p), 1); assert.equal(p.cooldowns.get(category), 600);
  assert.deepEqual(p.calls, ['effect', 'effect', 'effect', 'cure', 'sip', 'cooldown']);
});
check('four sips use the skin up', () => {
  const p = player();
  for (let sip = 0; sip < 4; sip++) {
    miruvor.onCompleteUse({ source: p });
    assert.equal(damage(p), sip < 3 ? sip + 1 : undefined); assert.equal(p.cooldowns.get(category), 600);
  }
});
check('Creative keeps the skin and still cools down', () => {
  const p = player(3); p.mode = 'Creative'; miruvor.onCompleteUse({ source: p });
  assert.equal(damage(p), 3); assert.equal(p.effects.length, 3); assert.equal(p.cooldowns.get(category), 600);
});
check('another item in hand gives nothing', () => {
  const p = player(); p.held = skin(0, 'minecraft:stick'); miruvor.onCompleteUse({ source: p });
  assert.equal(p.effects.length, 0); assert.equal(p.cooldowns.size, 0);
});
check('stronger or longer effects are not downgraded', () => {
  for (const effect of [{ amplifier: 2, duration: 20 }, { amplifier: 0, duration: 1000 }, { amplifier: 1, duration: 160 }]) {
    const p = player(); p.existing.set('regeneration', effect); p.existing.set('speed', { amplifier: 1, duration: 20 });
    miruvor.onCompleteUse({ source: p }); assert.deepEqual(p.effects.map(e => e[0]), ['instant_health']); assert.equal(damage(p), 1);
  }
  const p = player(); p.existing.set('regeneration', { amplifier: 0, duration: 100 });
  miruvor.onCompleteUse({ source: p }); assert.equal(p.effects.length, 3);
});
check('salve: effect and poison cure only, no Miruvor cooldown', () => {
  const p = player(); p.existing.set('regeneration', { amplifier: 0, duration: 1000 });
  callbacks.get('lothlorien:salve').onConsume({ source: p });
  assert.equal(p.effects.length, 0); assert.deepEqual(p.calls, ['cure']); assert.equal(p.cooldowns.size, 0);
});
console.log(`ok   ${cases} medicine production scenarios`);
