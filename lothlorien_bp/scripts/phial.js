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

// A holder keeps the Phial in the offhand, is alive and is not a Spectator (who keeps its items but is not there).
function holdsPhial(player) {
    return player.getGameMode() !== "Spectator" && player.getComponent("minecraft:health").currentValue > 0
        && player.getComponent("minecraft:equippable")?.getEquipment("Offhand")?.typeId === PHIAL_ID;
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
            if (!holdsPhial(player)) continue;
            const p = player.location, dimension = player.dimension, d = dimension.id;
            for (const offset of PHIAL_LIGHT_OFFSETS) {
                const loc = { d, x: Math.floor(p.x) + offset.x, y: Math.floor(p.y) + offset.y, z: Math.floor(p.z) + offset.z };
                const block = blockAt(loc);
                if (block && (block.isAir || block.typeId === PHIAL_LIGHT_BLOCK)) { desired.set(keyOf(loc), loc); break; }
            }
            let remaining = PHIAL_MAX_SPIDERS;
            for (let i = 0; i < PHIAL_SPIDER_TYPES.length && remaining; i++) {
                const type = PHIAL_SPIDER_TYPES[(firstType + i) % PHIAL_SPIDER_TYPES.length];
                const nearby = dimension.getEntities({ type, location: p, maxDistance: PHIAL_SPIDER_RADIUS, closest: remaining });
                remaining -= nearby.length;
                for (const spider of nearby) {
                    const q = spider.location, dx = q.x - p.x, dz = q.z - p.z;
                    const distance = dx * dx + dz * dz + (q.y - p.y) ** 2;
                    // pushed away from the nearest holder
                    if (distance < (spiders.get(spider.id)?.distance ?? Infinity)) spiders.set(spider.id, { spider, dx, dz, distance });
                }
            }
        }

        // Round robin prevents unloaded older records starving newer cleanup.
        const old = [...lights.entries()];
        const checks = Math.min(old.length, PHIAL_CLEANUP_PER_PASS);
        for (let i = 0; i < checks; i++) {
            const [key, loc] = old[(cursor + i) % old.length];
            if (desired.has(key)) continue;
            const block = blockAt(loc);
            if (!block) continue;
            if (block.typeId === PHIAL_LIGHT_BLOCK) block.setType("minecraft:air");
            lights.delete(key); dirty = true;
        }
        cursor = old.length ? (cursor + checks) % old.length : 0;
        if (dirty) persist();

        for (const [key, loc] of desired) {
            const block = blockAt(loc);
            if (!block || (!block.isAir && block.typeId !== PHIAL_LIGHT_BLOCK)) continue;
            if (!lights.has(key)) {
                if (lights.size >= PHIAL_MAX_PENDING_LIGHTS) continue;
                lights.set(key, loc);
                persist(); // the ledger survives a process/world stop between these operations
            }
            if (block.isAir) block.setType(PHIAL_LIGHT_BLOCK);
        }
        for (const { spider, dx, dz } of spiders.values()) {
            const length = Math.hypot(dx, dz);
            spider.applyKnockback({
                x: length ? dx / length * PHIAL_SPIDER_FORCE : PHIAL_SPIDER_FORCE,
                z: length ? dz / length * PHIAL_SPIDER_FORCE : 0,
            }, 0); // Native collision handles walls; never teleport through terrain.
        }
    }
    system.run(update);
    system.runInterval(update, PHIAL_POLL_TICKS);
}
