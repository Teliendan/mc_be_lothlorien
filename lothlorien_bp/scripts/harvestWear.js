// Rejected mining of a nonzero-hardness block, documented Bedrock wear only.
// Source: archived Minecraft Wiki Durability (2025-11), reviewed 2026-10-10:
// https://wiki.ronlab.site/content/minecraftwiki_en_all_maxi_2025-11/Durability
// API surface: reference/server-2.8.0.d.ts. No getDamageChance unit assumption.
const ONE = new Set([
    'minecraft:wooden_axe', 'minecraft:wooden_pickaxe', 'minecraft:wooden_shovel', 'minecraft:wooden_hoe',
    'minecraft:stone_axe', 'minecraft:stone_pickaxe', 'minecraft:stone_shovel', 'minecraft:stone_hoe',
    'minecraft:copper_axe', 'minecraft:copper_pickaxe', 'minecraft:copper_shovel', 'minecraft:copper_hoe',
    'minecraft:iron_axe', 'minecraft:iron_pickaxe', 'minecraft:iron_shovel', 'minecraft:iron_hoe',
    'minecraft:golden_axe', 'minecraft:golden_pickaxe', 'minecraft:golden_shovel', 'minecraft:golden_hoe',
    'minecraft:diamond_axe', 'minecraft:diamond_pickaxe', 'minecraft:diamond_shovel', 'minecraft:diamond_hoe',
    'minecraft:netherite_axe', 'minecraft:netherite_pickaxe', 'minecraft:netherite_shovel', 'minecraft:netherite_hoe',
    'minecraft:shears',
]);
const TWO = new Set([
    'minecraft:wooden_sword', 'minecraft:stone_sword', 'minecraft:copper_sword',
    'minecraft:iron_sword', 'minecraft:golden_sword', 'minecraft:diamond_sword',
    'minecraft:netherite_sword', 'minecraft:mace', 'minecraft:trident',
    'minecraft:flint_and_steel', 'minecraft:shield',
]);
const ZERO = new Set([
    'minecraft:fishing_rod', 'minecraft:brush', 'minecraft:bow', 'minecraft:crossbow',
    'minecraft:carrot_on_a_stick', 'minecraft:warped_fungus_on_a_stick',
]);

// undefined means unknown: do not infer wear from a custom ID or a tool suffix.
export function wearForRejectedMining(typeId) {
    if (ONE.has(typeId)) return 1;
    if (TWO.has(typeId)) return 2;
    if (ZERO.has(typeId)) return 0;
    return undefined;
}

function canonical(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        const result = {};
        for (const key of Object.keys(value).sort()) result[key] = canonical(value[key]);
        return result;
    }
    throw new Error('Invalid metadata');
}

function strings(value, sorted = false) {
    if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) throw new Error('Invalid strings');
    return sorted ? [...value].sort() : value;
}

function dynamicValue(value) {
    if (typeof value === 'string' || typeof value === 'boolean'
        || (typeof value === 'number' && Number.isFinite(value))) return value;
    if (value && typeof value === 'object' && !Array.isArray(value)
        && ['x', 'y', 'z'].every(axis => typeof value[axis] === 'number' && Number.isFinite(value[axis]))
        && Object.keys(value).every(key => ['x', 'y', 'z'].includes(key))) {
        return { x: value.x, y: value.y, z: value.z };
    }
    throw new Error('Invalid dynamic property');
}

function snapshot(item) {
    if (!item || typeof item.typeId !== 'string' || !Number.isInteger(item.amount) || item.amount < 1 || item.amount > 255) return undefined;
    if (item.nameTag !== undefined && typeof item.nameTag !== 'string') return undefined;
    if (item.keepOnDeath !== undefined && typeof item.keepOnDeath !== 'boolean') return undefined;
    if (item.lockMode !== undefined && typeof item.lockMode !== 'string') return undefined;
    const durability = item.getComponent('minecraft:durability');
    if (!durability || !Number.isInteger(durability.damage) || durability.damage < 0
        || !Number.isInteger(durability.maxDurability) || durability.maxDurability < 1
        || durability.damage > durability.maxDurability || typeof durability.unbreakable !== 'boolean') return undefined;
    const enchantable = item.getComponent('minecraft:enchantable');
    const enchantments = enchantable ? enchantable.getEnchantments().map(enchantment => {
        if (typeof enchantment?.type?.id !== 'string' || !enchantment.type.id
            || !Number.isInteger(enchantment.level) || enchantment.level < 1) throw new Error('Invalid enchantment');
        return [enchantment.type.id, enchantment.level];
    }).sort(([a], [b]) => a.localeCompare(b)) : [];
    if (new Set(enchantments.map(([id]) => id)).size !== enchantments.length) return undefined;
    const dynamicIds = strings(item.getDynamicPropertyIds(), true);
    if (new Set(dynamicIds).size !== dynamicIds.length) return undefined;
    const metadata = {
        type: item.typeId, amount: item.amount, name: item.nameTag ?? null,
        lore: strings(item.getLore()), enchantments,
        dynamic: dynamicIds.map(id => [id, dynamicValue(item.getDynamicProperty(id))]),
        damage: durability.damage, max: durability.maxDurability, unbreakable: durability.unbreakable,
        keepOnDeath: item.keepOnDeath ?? null, lockMode: item.lockMode ?? null,
    };
    // These API-visible fields also distinguish replacements when present.
    for (const method of ['getCanDestroy', 'getCanPlaceOn', 'getTags']) {
        if (typeof item[method] === 'function') metadata[method] = strings(item[method](), true);
    }
    if (typeof item.getRawLore === 'function') metadata.rawLore = canonical(item.getRawLore());
    return {
        fingerprint: JSON.stringify(canonical(metadata)), durability,
        unbreaking: enchantments.find(([id]) => id === 'unbreaking' || id === 'minecraft:unbreaking')?.[1] ?? 0,
    };
}

/**
 * Called after the guarded deferred rejected-mining removal succeeds. Returns
 * wear points consumed (zero when skipped/protected). Never edits capturedTool.
 * API-visible fingerprints cannot distinguish an identical replacement stack.
 * A native wear charge after this deferred callback needs in-game acceptance;
 * an already-visible native charge changes the fingerprint and is skipped.
 * Bedrock's documented extra use at zero durability is not emulated here.
 */
export function damageRejectedTool(player, slotIndex, capturedTool, random = Math.random) {
    try {
        const wear = wearForRejectedMining(capturedTool?.typeId);
        if (!wear || typeof random !== 'function' || player?.isValid !== true
            || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8
            || player.selectedSlotIndex !== slotIndex) return 0;
        const mode = player.getGameMode();
        if (mode !== 'Survival' && mode !== 'Adventure') return 0;
        const container = player.getComponent('minecraft:inventory')?.container;
        if (!container || container.isValid === false) return 0;
        const captured = snapshot(capturedTool);
        let live = container.getItem(slotIndex);
        let current = snapshot(live);
        if (!captured || !current || live === capturedTool || current.durability === captured.durability
            || current.fingerprint !== captured.fingerprint || current.durability.unbreakable) return 0;
        let damage = 0;
        for (let point = 0; point < wear; point++) {
            if (!current.unbreaking) damage++;
            else {
                const roll = random();
                if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return 0;
                if (roll < 1 / (current.unbreaking + 1)) damage++;
            }
        }
        if (!damage || player.isValid !== true || player.selectedSlotIndex !== slotIndex) return 0;
        // Re-read immediately before committing: mutate the live inventory copy.
        live = container.getItem(slotIndex);
        current = snapshot(live);
        if (!current || live === capturedTool || current.durability === captured.durability
            || current.fingerprint !== captured.fingerprint) return 0;
        if (current.durability.damage + damage >= current.durability.maxDurability) {
            container.setItem(slotIndex, undefined);
            try { player.dimension.playSound('random.break', player.location); } catch { /* Item removal already succeeded. */ }
        } else {
            current.durability.damage += damage;
            container.setItem(slotIndex, live);
        }
        return damage;
    } catch {
        // Disconnected players, stale inventories and malformed stacks are safe skips.
        return 0;
    }
}
