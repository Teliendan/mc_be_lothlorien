import { world, system } from "@minecraft/server";
import {
    PHIAL_ID, PHIAL_LIGHT_BLOCK, PHIAL_POLL_TICKS, PHIAL_SPIDER_RADIUS,
    PHIAL_SPIDER_FORCE, PHIAL_MAX_SPIDERS, PHIAL_CLEANUP_PER_PASS,
    PHIAL_MAX_PENDING_LIGHTS, PHIAL_OWNERSHIP_PROPERTY, PHIAL_SPIDER_TYPES,
    PHIAL_LIGHT_OFFSETS,
} from "./gift_rules.js";

// Persist coordinates BEFORE creating a light. Only our hidden helper block is
// ever removed, so player blocks (including vanilla light blocks) are protected.
// One shared desired set keeps overlapping holders from extinguishing each other.
const keyOf = ({ d, x, y, z }) => `${d}|${x}|${y}|${z}`;
let started = false;

const finitePosition = (entity) => {
    const { x, y, z } = entity.location;
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : undefined;
};
function holderState(player) {
    if (!player.isValid || player.getGameMode() === "Spectator"
        || player.getComponent("minecraft:equippable")?.getEquipment("Offhand")?.typeId !== PHIAL_ID) return undefined;
    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue <= 0) return undefined;
    const p = finitePosition(player), dimension = player.dimension;
    return p ? { p, dimension, d: dimension.id } : undefined;
}
function targetState(spider, holder) {
    if (!spider.isValid || !PHIAL_SPIDER_TYPES.includes(spider.typeId) || spider.dimension.id !== holder.d) return undefined;
    const health = spider.getComponent("minecraft:health");
    if (health && health.currentValue <= 0) return undefined;
    const q = finitePosition(spider);
    if (!q) return undefined;
    const dx = q.x - holder.p.x, dz = q.z - holder.p.z;
    const distance = dx * dx + dz * dz + (q.y - holder.p.y) ** 2;
    return distance <= PHIAL_SPIDER_RADIUS ** 2 ? { dx, dz, distance } : undefined;
}

export function startPhial() {
    if (started) return;
    started = true;
    const lights = new Map();
    try {
        const raw = world.getDynamicProperty(PHIAL_OWNERSHIP_PROPERTY);
        const entries = typeof raw === "string" ? JSON.parse(raw) : [];
        if (Array.isArray(entries)) for (const row of entries.slice(0, PHIAL_MAX_PENDING_LIGHTS)) {
            if (!Array.isArray(row) || row.length !== 4) continue;
            const [d, x, y, z] = row;
            if (typeof d !== "string" || d.length > 64 || ![x, y, z].every(Number.isSafeInteger)) continue;
            const loc = { d, x, y, z }; lights.set(keyOf(loc), loc);
        }
    } catch { /* Ignore corrupt external bookkeeping; never guess which blocks to remove. */ }
    let dirty = false;
    const persist = () => {
        world.setDynamicProperty(PHIAL_OWNERSHIP_PROPERTY,
            lights.size ? JSON.stringify([...lights.values()].map(({ d, x, y, z }) => [d, x, y, z])) : undefined);
        dirty = false;
    };
    const blockAt = (loc) => {
        try { return world.getDimension(loc.d).getBlock({ x: loc.x, y: loc.y, z: loc.z }); }
        catch { return undefined; } // Unloaded/out of bounds: preserve ownership for a later pass.
    };
    let cursor = 0, spiderTypeCursor = 0;

    function update() {
        const desired = new Map(), spiders = new Map();
        // Alternate priority per pulse so either native type gets service when crowded.
        const firstType = spiderTypeCursor;
        spiderTypeCursor = (spiderTypeCursor + 1) % PHIAL_SPIDER_TYPES.length;
        for (const player of world.getAllPlayers()) {
            try {
                const holder = holderState(player);
                if (!holder) continue;
                const { p, d, dimension } = holder;
                for (const offset of PHIAL_LIGHT_OFFSETS) {
                    const loc = { d, x: Math.floor(p.x) + offset.x, y: Math.floor(p.y) + offset.y, z: Math.floor(p.z) + offset.z };
                    const block = blockAt(loc);
                    if (block && (block.isAir || block.typeId === PHIAL_LIGHT_BLOCK)) { desired.set(keyOf(loc), loc); break; }
                }
                let remaining = PHIAL_MAX_SPIDERS;
                for (let i = 0; i < PHIAL_SPIDER_TYPES.length; i++) {
                    if (!remaining) break;
                    const type = PHIAL_SPIDER_TYPES[(firstType + i) % PHIAL_SPIDER_TYPES.length];
                    let nearby;
                    try {
                        nearby = dimension.getEntities({ type, location: p, maxDistance: PHIAL_SPIDER_RADIUS, closest: remaining }).slice(0, remaining);
                    } catch { continue; } // A failed type query must not discard the other type.
                    remaining -= nearby.length; // Invalid candidates still spend the bounded inspection budget.
                    for (const spider of nearby) {
                        try {
                            const target = targetState(spider, holder);
                            if (!target) continue;
                            const prior = spiders.get(spider.id);
                            if (prior) prior.players.push(player);
                            else spiders.set(spider.id, { spider, players: [player] });
                        } catch { /* One unreadable entity must not skip healthy following candidates. */ }
                    }
                }
            } catch { /* A player may leave or change dimension during the pass. */ }
        }

        // Round robin prevents unloaded older records starving newer cleanup.
        const old = [...lights.entries()];
        let changed = false;
        const checks = Math.min(old.length, PHIAL_CLEANUP_PER_PASS);
        for (let i = 0; i < checks; i++) {
            const [key, loc] = old[(cursor + i) % old.length];
            if (desired.has(key)) continue;
            const block = blockAt(loc);
            if (!block) continue;
            try {
                if (block.typeId === PHIAL_LIGHT_BLOCK) block.setType("minecraft:air");
                lights.delete(key); changed = true;
            } catch { /* Keep the persisted record until removal succeeds. */ }
        }
        cursor = old.length ? (cursor + checks) % old.length : 0;
        if (changed) dirty = true;
        if (dirty) {
            try { persist(); } catch { /* Retry even if the in-memory ledger is now empty. */ }
        }

        for (const [key, loc] of desired) {
            const block = blockAt(loc);
            if (!block || (!block.isAir && block.typeId !== PHIAL_LIGHT_BLOCK)) continue;
            if (!lights.has(key)) {
                if (lights.size >= PHIAL_MAX_PENDING_LIGHTS) continue;
                lights.set(key, loc);
                try { persist(); } catch { lights.delete(key); continue; }
            }
            // The ledger survives a process/world stop between these operations.
            try { if (block.isAir) block.setType(PHIAL_LIGHT_BLOCK); } catch { /* Retry next pass. */ }
        }
        for (const { spider, players } of spiders.values()) {
            try {
                // Query snapshots can become stale before cleanup/placement finishes.
                let target;
                for (const player of players) {
                    try {
                        const holder = holderState(player);
                        const candidate = holder && targetState(spider, holder);
                        if (candidate && (!target || candidate.distance < target.distance)) target = candidate;
                    } catch { /* A departing holder must not discard another eligible holder. */ }
                }
                if (!target) continue;
                const { dx, dz } = target, length = Math.hypot(dx, dz);
                spider.applyKnockback({
                    x: length ? dx / length * PHIAL_SPIDER_FORCE : PHIAL_SPIDER_FORCE,
                    z: length ? dz / length * PHIAL_SPIDER_FORCE : 0,
                }, 0); // Native collision handles walls; never teleport through terrain.
            } catch { /* Entity may unload between query and impulse. */ }
        }
    }
    system.run(update);
    system.runInterval(update, PHIAL_POLL_TICKS);
}
