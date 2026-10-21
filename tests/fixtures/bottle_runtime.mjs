// Shared bottle/rope API fixture; no test bodies run on import.
import { readFileSync } from 'node:fs';
import * as ropeRules from '../../lothlorien_bp/scripts/elven_rope_rules.js';
import * as dewRules from '../../lothlorien_bp/scripts/dew_rules.js';
import * as nectarRules from '../../lothlorien_bp/scripts/nectar_rules.js';
import { SUPPORT_POLICIES } from '../../lothlorien_bp/scripts/support_policies.js';
import { message } from '../../lothlorien_bp/scripts/messages.js';
const GLASS = 'minecraft:glass_bottle', BOTTLE = 'lothlorien:bottle_of_fireflies', FLY = 'lothlorien:firefly';
const ROPE = 'lothlorien:elven_rope', HANGING = 'lothlorien:elven_rope_hanging', DEW = 'lothlorien:dew_bottle';
let serial = 0;
const read = path => JSON.parse(readFileSync(new URL('../../lothlorien_bp/' + path, import.meta.url)));
const permutation = (id, states = {}) => ({ type: { id }, getState: k => states[k], getAllStates: () => ({ ...states }),
  matches: (other, values) => other === id && JSON.stringify(values) === JSON.stringify(states),
  withState: (k, v) => permutation(id, { ...states, [k]: v }) });
function stack(typeId, amount = 1, data = {}) {
  data = structuredClone(data);
  const item = { typeId, amount, nameTag: data.name, keepOnDeath: data.keep ?? false, lockMode: data.lock ?? 'none',
    isStackable: typeId !== DEW, data,
    getRawLore: () => data.lore ?? [], getCanPlaceOn: () => data.place ?? [], getCanDestroy: () => data.destroy ?? [],
    setLore(lines) { data.lore = structuredClone(lines); },
    setDynamicProperty() { throw Error('API2.8 dynamic properties are not supported on this stackable item'); },
    getDynamicPropertyIds: () => Object.keys(data.dynamic ?? {}), getDynamicProperty: key => data.dynamic[key],
    getComponent(id) {
      if (id.endsWith('durability') && this.typeId === DEW) return data.durability ??= { damage: 7, maxDurability: 8, unbreakable: false };
      if (id.endsWith('enchantable')) return { getEnchantments: () => data.enchantments ?? [] };
    },
    clone() { return stack(this.typeId, this.amount, { ...data, name: this.nameTag, keep: this.keepOnDeath, lock: this.lockMode }); },
    isStackableWith(other) { return this.isStackable && this.typeId === other.typeId && this.nameTag === other.nameTag; } };
  return item;
}
async function load(name, context) {
  globalThis.__decor = context;
  const text = readFileSync(new URL('../../lothlorien_bp/scripts/' + name, import.meta.url), 'utf8')
    .replace(/^import \{([\s\S]*?)\} from "[^"]+";/gm, 'const {$1} = globalThis.__decor;');
  try { return await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}#${serial++}`); }
  finally { delete globalThis.__decor; }
}
async function createWorld() {
  const cells = new Map(), queue = [], components = new Map(), intervals = new Map(), spawned = [], drops = [], deeds = [];
  const subscribers = { entity: [], block: [], breaks: [], explosions: [], leaves: [] };
  let unreadable = () => false, failWrite = () => false, afterWrite = () => {}, writeCount = 0, soundFails = false, deedFails = false;
  const key = p => `${p.x},${p.y},${p.z}`;
  const dimension = { id: 'overworld', heightRange: { min: -64, max: 320 },
    getBlock(p) {
      if (unreadable(p) || p.y < this.heightRange.min ||
          (this.maxInclusive ? p.y > this.heightRange.max : p.y >= this.heightRange.max)) throw Error('unloaded/boundary');
      return cells.get(key(p)) ?? block('minecraft:air', {}, p);
    },
    spawnItem(item, at) { drops.push({ item: item.clone(), at }); },
    playSound() { if (soundFails) throw Error('sound'); },
    spawnEntity(id, location, options) { const entity = fly(location, id); entity.options = options; spawned.push(entity); return entity; } };
  function block(typeId, states = {}, p = { x: 0, y: 64, z: 0 }) {
    const b = { typeId, ...p, location: { ...p }, dimension, permutation: permutation(typeId, states), isWaterlogged: false,
      get isAir() { return this.typeId === 'minecraft:air'; }, get isLiquid() { return /^(minecraft:water|minecraft:lava)$/.test(this.typeId); },
      center: () => ({ x: p.x + .5, y: p.y + .5, z: p.z + .5 }),
      setPermutation(value) { if (failWrite(this)) throw Error('write'); this.typeId = value.type.id; this.permutation = value; writeCount++; afterWrite(this); },
      setType(id) { this.setPermutation(permutation(id)); },
      above() { return dimension.getBlock({ ...p, y: p.y + 1 }); }, below() { return dimension.getBlock({ ...p, y: p.y - 1 }); } };
    cells.set(key(p), b); return b;
  }
  function fly(p = { x: 0, y: 64, z: 0 }, typeId = FLY) {
    const health={currentValue:2,effectiveMax:2,setCurrentValue(n){this.currentValue=n;return true;}};
    return { id: `f${serial++}`, typeId, dimension, location: { ...p }, isValid: true,
      nameTag:'',health,getComponent:key=>key==='minecraft:health'?health:undefined,
      remove() { if (!this.isValid) throw Error('gone'); this.isValid = false; } };
  }
  const players = [];
  function player(id = GLASS, amount = 1, data = {}) {
    const p = { id: `p${serial++}`, isValid: true, dimension, selectedSlotIndex: 0, mode: 'survival', location: { x: 0, y: 64, z: 0 },
      held: stack(id, amount, data), inventory: [], full: false, noInventory: false, effects: new Map(), grants: [], removals: [], teleports: [],
      isSneaking: false, velocity: { x: 0, y: 0, z: 0 }, jump: false, forward: 0,
      getGameMode() { if (!this.isValid) throw Error('left'); return this.mode; },
      getHeadLocation() { return { ...this.location, y: this.location.y + 1.6 }; },
      getVelocity() { return this.velocity; },
      getEffect(id) { return this.effects.get(id); },
      addEffect(id, duration, options) { this.effects.set(id, { duration, ...options }); this.grants.push({ id, duration, ...options }); },
      removeEffect(id) { this.removals.push(id); this.effects.delete(id); },
      teleport(at) { this.teleports.push(at); this.location = at; },
      inputInfo: { getButtonState: () => p.jump ? 'Pressed' : 'Released', getMovementVector: () => ({ x: 0, y: p.forward }) },
      getComponent(id) {
        if (id === 'riding') return this.vehicle ? { entityRidingOn: this.vehicle } : undefined;
        if (id === 'health') return { currentValue: this.health ?? 20 };
        if (id === 'equippable') return { getEquipmentSlot: () => ({ getItem: () => p.held?.clone(), hasItem: () => !!p.held,
          get amount() { return p.held.amount; }, set amount(n) { p.held.amount = n; }, setItem(item) { p.held = item?.clone(); } }) };
        if (id === 'inventory' && !this.noInventory) return { container: { addItem(item) {
          if (p.full) return item; p.inventory.push(item.clone()); } } };
      } };
    players.push(p); return p;
  }
  const context = { ...ropeRules, ...dewRules, ...nectarRules, SUPPORT_POLICIES, message,
    EquipmentSlot: { Mainhand: 'main' }, GameMode: { Creative: 'creative', Spectator: 'spectator' }, ItemStack: function(id, n) { return stack(id, n); },
    BlockPermutation: { resolve: permutation }, repeatedUse: () => false,
    noteDeed(p, id) { if (deedFails) throw Error('deed'); deeds.push(id); },
    system: { currentTick: 0, run: fn => queue.push(fn), runInterval(fn, ticks) { const id = serial++; intervals.set(id, { fn, ticks }); return id; },
      clearRun: id => intervals.delete(id), beforeEvents: { startup: { subscribe(fn) { fn({
        itemComponentRegistry: { registerCustomComponent: (id, value) => components.set(id, value) },
        blockComponentRegistry: { registerCustomComponent: (id, value) => components.set(id, value) } }); } } } },
    world: { getPlayers: () => players, getTimeOfDay: () => 12000, gameRules: { doTileDrops: true },
      beforeEvents: { playerInteractWithEntity: { subscribe: fn => subscribers.entity.push(fn) }, playerInteractWithBlock: { subscribe: fn => subscribers.block.push(fn) } },
      afterEvents: { playerBreakBlock: { subscribe: fn => subscribers.breaks.push(fn) }, blockExplode: { subscribe: fn => subscribers.explosions.push(fn) },
        playerLeave: { subscribe: fn => subscribers.leaves.push(fn) } } } };
  for (const file of ['deferred_use.js', 'cover_use.js', 'interaction_use.js', 'bottles.js', 'firefly_bottle.js']) Object.assign(context, await load(file, context));
  const rope = await load('elven_rope.js', context);
  await load('fireflies.js', context); await load('nectar.js', context); await load('dew.js', context);
  const e = { block, fly, player, dimension, context, components, rope, spawned, drops, deeds, subscribers, intervals,
    click(p, target, face = 'Up') { const event = { player: p, itemStack: p.held.clone(), block: target, blockFace: face };
      subscribers.block.forEach(fn => fn(event)); return event; },
    catch(p, target) { const event = { player: p, itemStack: p.held.clone(), target }; subscribers.entity.forEach(fn => fn(event)); return event; },
    useRope(p, target, face = 'North', item = p.held.clone()) { components.get('lothlorien:rope').onUseOn({ source: p, block: target, blockFace: face, itemStack: item }); },
    flush() { while (queue.length) queue.shift()(); },
    unreadable(fn) { unreadable = fn; }, failWrite(fn) { failWrite = fn; }, badSound() { soundFails = true; }, badDeed() { deedFails = true; },
    afterWrite(fn) { afterWrite = fn; },
    get writes() { return writeCount; },
    tick(period = 1, expire = true) {
      context.system.currentTick++;
      if (expire) for (const p of players) for (const [id, effect] of p.effects) { if (--effect.duration <= 0) p.effects.delete(id); }
      for (const item of [...intervals.values()]) if (item.ticks === period) item.fn();
    } };
  return e;
}


export { createWorld, stack };
