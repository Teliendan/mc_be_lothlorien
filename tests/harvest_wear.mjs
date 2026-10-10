import assert from 'node:assert/strict';
import test from 'node:test';
import { damageRejectedTool, wearForRejectedMining } from '../lothlorien_bp/scripts/harvestWear.js';

function tool(typeId = 'minecraft:wooden_axe', options = {}) {
    const durability = { damage: 4, maxDurability: 20, unbreakable: false, ...options.durability };
    const enchantments = options.enchantments ?? [];
    const properties = options.properties ?? { marker: 'original', position: { x: 1, y: 2, z: 3 } };
    return {
        typeId, amount: 1, nameTag: 'Keep my name', keepOnDeath: true, lockMode: 'none',
        extraData: { untouched: true }, durability, enchantments, properties,
        getComponent(id) {
            if (id === 'minecraft:durability') return durability;
            if (id === 'minecraft:enchantable') return { getEnchantments: () => enchantments };
            return undefined;
        },
        getLore: () => options.lore ?? ['Keep my lore'],
        getRawLore: () => [{ text: 'Keep my lore' }],
        getDynamicPropertyIds: () => Object.keys(properties),
        getDynamicProperty: id => properties[id],
        getCanDestroy: () => ['minecraft:stone'], getCanPlaceOn: () => [], getTags: () => ['test:tag'],
        isStackableWith() { throw new Error('Nonstackable comparison must never be used'); },
    };
}

function fixture(typeId, options = {}) {
    const captured = tool(typeId, structuredClone(options));
    const live = tool(typeId, structuredClone(options));
    const writes = [], sounds = [];
    const container = {
        isValid: true, item: live,
        getItem() { return this.item; },
        setItem(slot, item) { writes.push({ slot, item }); this.item = item; },
    };
    const player = {
        isValid: true, selectedSlotIndex: 2, location: { x: 3, y: 20, z: 5 },
        getGameMode: () => 'Survival',
        getComponent: id => id === 'minecraft:inventory' ? { container } : undefined,
        dimension: { playSound: (id, location) => sounds.push({ id, location }) },
    };
    return { captured, live, writes, sounds, container, player, damage: random => damageRejectedTool(player, 2, captured, random) };
}

test('explicit current vanilla whitelist and known zero-use items', () => {
    for (const material of ['wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite']) {
        for (const kind of ['axe', 'pickaxe', 'shovel', 'hoe']) assert.equal(wearForRejectedMining(`minecraft:${material}_${kind}`), 1);
        assert.equal(wearForRejectedMining(`minecraft:${material}_sword`), 2);
    }
    assert.equal(wearForRejectedMining('minecraft:shears'), 1);
    for (const id of ['mace', 'trident', 'flint_and_steel', 'shield']) assert.equal(wearForRejectedMining(`minecraft:${id}`), 2);
    for (const id of ['fishing_rod', 'brush', 'bow', 'crossbow', 'carrot_on_a_stick', 'warped_fungus_on_a_stick']) assert.equal(wearForRejectedMining(`minecraft:${id}`), 0);
    for (const id of ['custom:diamond_axe', 'minecraft:wooden_spear', 'minecraft:diamond_helmet', 'minecraft:unknown_axe', undefined, null, 1]) assert.equal(wearForRejectedMining(id), undefined);
});

test('one-point mining preserves live stack identity, captured data and all metadata', () => {
    const f = fixture();
    const extra = f.live.extraData;
    assert.equal(f.damage(), 1);
    assert.equal(f.captured.durability.damage, 4);
    assert.equal(f.live.durability.damage, 5);
    assert.equal(f.writes[0].item, f.live);
    assert.equal(f.writes[0].slot, 2);
    assert.equal(f.live.extraData, extra);
    assert.equal(f.live.nameTag, 'Keep my name');
    assert.deepEqual(f.live.properties, f.captured.properties);
    assert.deepEqual(f.sounds, []);
});

test('documented two-point weapons and Bedrock utility tools charge two points', () => {
    for (const id of ['diamond_sword', 'mace', 'trident', 'flint_and_steel', 'shield']) {
        const f = fixture(`minecraft:${id}`);
        assert.equal(f.damage(), 2, id);
        assert.equal(f.live.durability.damage, 6, id);
    }
    const shears = fixture('minecraft:shears');
    assert.equal(shears.damage(), 1);
});

test('unknown/custom items and known zero wear never touch inventory or RNG', () => {
    for (const id of ['custom:iron_axe', 'minecraft:wooden_spear', 'minecraft:bow', 'minecraft:brush']) {
        const f = fixture(id);
        assert.equal(f.damage(() => { throw new Error('No roll needed'); }), 0);
        assert.equal(f.writes.length, 0);
    }
});

test('Unbreaking rolls independently per point at 1/(level+1), with strict boundary', () => {
    const options = { enchantments: [{ type: { id: 'unbreaking' }, level: 3 }] };
    const f = fixture('minecraft:iron_sword', options);
    const rolls = [0.249, 0.25];
    assert.equal(f.damage(() => rolls.shift()), 1);
    assert.equal(rolls.length, 0);
    assert.equal(f.live.durability.damage, 5);
    const protectedTool = fixture('minecraft:iron_sword', options);
    assert.equal(protectedTool.damage(() => 0.9), 0);
    assert.equal(protectedTool.writes.length, 0);
    const namespaced = fixture('minecraft:iron_axe', { enchantments: [{ type: { id: 'minecraft:unbreaking' }, level: 4 }] });
    assert.equal(namespaced.damage(() => 0.2), 0);
});

test('unenchanted and unbreakable tools do not need RNG', () => {
    const f = fixture();
    assert.equal(f.damage(() => { throw new Error('No enchantment roll'); }), 1);
    const unbreakable = fixture(undefined, { durability: { unbreakable: true } });
    assert.equal(unbreakable.damage(() => { throw new Error('Unbreakable'); }), 0);
    assert.equal(unbreakable.writes.length, 0);
});

test('last use removes the item and plays the installed native break sound once', () => {
    for (const [typeId, damage] of [['minecraft:wooden_axe', 19], ['minecraft:wooden_sword', 19]]) {
        const f = fixture(typeId, { durability: { damage } });
        assert.equal(f.damage(), typeId.endsWith('sword') ? 2 : 1);
        assert.equal(f.container.item, undefined);
        assert.equal(f.live.durability.damage, 19, 'Never write damage above max');
        assert.deepEqual(f.sounds, [{ id: 'random.break', location: f.player.location }]);
        assert.equal(f.damage(), 0, 'Repeated callback cannot charge or sound again');
        assert.equal(f.sounds.length, 1);
    }
});

test('sound failure does not undo a completed break', () => {
    const f = fixture(undefined, { durability: { damage: 19 } });
    f.player.dimension.playSound = () => { throw new Error('Dimension gone'); };
    assert.equal(f.damage(), 1);
    assert.equal(f.container.item, undefined);
});

test('offline players, other game modes, changed selection and stale inventories skip', () => {
    for (const change of [
        f => { f.player.isValid = false; },
        f => { f.player.isValid = 'true'; },
        f => { f.player.getGameMode = () => 'Creative'; },
        f => { f.player.getGameMode = () => 'Spectator'; },
        f => { f.player.selectedSlotIndex = 3; },
        f => { f.container.isValid = false; },
        f => { f.container.item = undefined; },
        f => { f.player.getComponent = () => { throw new Error('Disconnected'); }; },
    ]) {
        const f = fixture(); change(f);
        assert.equal(f.damage(), 0);
        assert.equal(f.writes.length, 0);
    }
    const f = fixture();
    for (const index of [-1, 9, 1.5, NaN]) assert.equal(damageRejectedTool(f.player, index, f.captured), 0);
});

test('every captured distinguishing field blocks charging a changed stack', () => {
    for (const change of [
        f => { f.live.typeId = 'minecraft:iron_axe'; },
        f => { f.live.amount = 2; },
        f => { f.live.nameTag = 'Replacement'; },
        f => { f.live.getLore = () => ['Changed']; },
        f => { f.live.getRawLore = () => [{ translate: 'different' }]; },
        f => { f.live.enchantments.push({ type: { id: 'efficiency' }, level: 1 }); },
        f => { f.live.properties.marker = 'different'; },
        f => { f.live.properties.position.x++; },
        f => { f.live.durability.damage++; },
        f => { f.live.durability.maxDurability++; },
        f => { f.live.durability.unbreakable = true; },
        f => { f.live.keepOnDeath = false; },
        f => { f.live.lockMode = 'slot'; },
        f => { f.live.getCanDestroy = () => ['minecraft:dirt']; },
        f => { f.live.getCanPlaceOn = () => ['minecraft:dirt']; },
        f => { f.live.getTags = () => ['different']; },
    ]) {
        const f = fixture(); change(f);
        assert.equal(f.damage(), 0);
        assert.equal(f.writes.length, 0);
    }
});

test('ordering of enchantments and dynamic property keys is not a replacement', () => {
    const f = fixture(undefined, { enchantments: [{ type: { id: 'efficiency' }, level: 2 }, { type: { id: 'unbreaking' }, level: 1 }] });
    f.live.enchantments.reverse();
    f.live.getDynamicPropertyIds = () => ['position', 'marker'];
    f.live.properties.position = { z: 3, x: 1, y: 2 };
    assert.equal(f.damage(() => 0), 1);
});

test('malformed durability, enchantments, metadata and RNG safely skip without partial charge', () => {
    for (const change of [
        f => { f.live.durability.damage = NaN; },
        f => { f.live.durability.damage = -1; },
        f => { f.live.durability.damage = 1.5; },
        f => { f.live.durability.maxDurability = 0; },
        f => { f.live.durability.unbreakable = undefined; },
        f => { f.live.enchantments.push({ type: { id: 'unbreaking' }, level: NaN }); },
        f => { f.live.getLore = () => [3]; },
        f => { f.live.getDynamicPropertyIds = () => ['missing']; },
        f => { f.live.properties.marker = { invalid: true }; },
        f => { f.live.properties.position.x = Infinity; },
        f => { f.live.amount = 256; },
        f => { f.live.keepOnDeath = 1; },
        f => { f.live.getComponent = () => { throw new Error('Invalid stack'); }; },
    ]) {
        const f = fixture(); change(f);
        assert.equal(f.damage(), 0);
        assert.equal(f.writes.length, 0);
    }
    for (const invalid of [NaN, Infinity, -0.1, 1, '0.1']) {
        const f = fixture('minecraft:iron_sword', { enchantments: [{ type: { id: 'unbreaking' }, level: 1 }] });
        const rolls = [0, invalid];
        assert.equal(f.damage(() => rolls.shift()), 0);
        assert.equal(f.live.durability.damage, 4);
        assert.equal(f.writes.length, 0);
    }
});

test('selection or inventory changes during rolls are rechecked before writing', () => {
    for (const change of [
        f => { f.player.selectedSlotIndex = 4; },
        f => { f.container.item = tool('minecraft:iron_sword', { lore: ['Replacement'] }); },
        f => { f.player.isValid = false; },
    ]) {
        const f = fixture('minecraft:iron_sword', { enchantments: [{ type: { id: 'unbreaking' }, level: 1 }] });
        assert.equal(f.damage(() => { change(f); return 0; }), 0);
        assert.equal(f.writes.length, 0);
    }
});

test('captured stack alias and API failures never mutate the capture', () => {
    const alias = fixture(); alias.container.item = alias.captured;
    assert.equal(alias.damage(), 0);
    assert.equal(alias.captured.durability.damage, 4);
    const componentAlias = fixture();
    const originalGet = componentAlias.live.getComponent;
    componentAlias.live.getComponent = id => id === 'minecraft:durability'
        ? componentAlias.captured.durability : originalGet(id);
    assert.equal(componentAlias.damage(), 0);
    assert.equal(componentAlias.captured.durability.damage, 4);
    const failed = fixture();
    failed.container.setItem = () => { throw new Error('Inventory expired'); };
    assert.equal(failed.damage(), 0);
    assert.equal(failed.captured.durability.damage, 4);
});

test('fresh native inventory copies are compared and the final live copy is written', () => {
    const f = fixture();
    const firstRead = tool(), secondRead = tool();
    secondRead.extraData = { unseenNativeData: 'preserve this final copy' };
    const reads = [firstRead, secondRead];
    f.container.getItem = () => reads.shift();
    assert.equal(f.damage(), 1);
    assert.equal(f.writes[0].item, secondRead);
    assert.equal(firstRead.durability.damage, 4);
    assert.equal(secondRead.durability.damage, 5);
    assert.deepEqual(f.writes[0].item.extraData, { unseenNativeData: 'preserve this final copy' });
    assert.equal(f.captured.durability.damage, 4);
});
