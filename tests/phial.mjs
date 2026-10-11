// Production phial runtime against scheduler/block/entity API mock. Lighting and native collision need the game.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
register(new URL("../../../.claude/skills/bedrock-scripting/scripts/mock_loader.mjs", import.meta.url));
const { __mock: mock, world } = await import("@minecraft/server");
const R = await import("../lothlorien_bp/scripts/gift_rules.js");
let run = 0, queries, impulses;
const at = (x, y = 71, z = 0) => ({ x, y, z });
const dim = (id = "minecraft:overworld") => mock.dimension(id);
const typeAt = (x, y = 71, id) => dim(id).typeAt(x, y, 0);
const ledger = () => JSON.parse(world.getDynamicProperty(R.PHIAL_OWNERSHIP_PROPERTY) ?? "[]");
function player(x = 0, id) {
    const p = mock.addEntity("minecraft:player", at(x, 70), {}, id);
    p.offhand = R.PHIAL_ID; p.health = { currentValue: 20 };
    p.components["minecraft:equippable"] = { getEquipment: slot => { assert.equal(slot, "Offhand"); return p.offhand ? { typeId: p.offhand } : undefined; } };
    p.components["minecraft:health"] = p.health;
    mock.players.push(p); return p;
}
function spider(x, type = "minecraft:spider", y = 70, id) {
    const e = mock.addEntity(type, at(x, y), {}, id);
    e.applyKnockback = (force, vertical) => impulses.push({ e, force, vertical });
    return e;
}
function instrument(id) {
    const d = dim(id), get = d.getEntities.bind(d);
    d.getEntities = q => { queries.push(q); return get(q); };
}
async function start() {
    const { startPhial } = await import(`../lothlorien_bp/scripts/phial.js?test=${++run}`);
    startPhial(); startPhial(); // lifecycle wiring must be idempotent
}
async function scenario(name, body) {
    mock.reset(); queries = []; impulses = []; instrument(); instrument("minecraft:nether");
    await body(); assert.deepEqual(mock.errors, []); console.log(`ok   phial: ${name}`);
}

await scenario("offhand creates one light, movement migrates it, unequip removes it", async () => {
    const p = player(); await start(); await mock.advance(1);
    assert.equal(typeAt(0), R.PHIAL_LIGHT_BLOCK); assert.equal(ledger().length, 1);
    const writes = mock.propWrites.length;
    await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(mock.propWrites.length, writes, "stationary holders cause no persistence churn");
    p.location.x = 3; await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(0), "minecraft:air"); assert.equal(typeAt(3), R.PHIAL_LIGHT_BLOCK);
    p.offhand = "minecraft:torch"; await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(3), "minecraft:air"); assert.deepEqual(ledger(), []);
    assert.equal(queries.length, 6, "exactly two bounded spider queries per equipped pass");
});

await scenario("shared cells survive a holder leaving, and dimensions, death, departure clean up", async () => {
    const a = player(), b = player(); await start(); await mock.advance(1);
    assert.equal(ledger().length, 1);
    a.offhand = undefined; await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(0), R.PHIAL_LIGHT_BLOCK);
    b.dimension = dim("minecraft:nether"); await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(0), "minecraft:air"); assert.equal(typeAt(0, 71, "minecraft:nether"), R.PHIAL_LIGHT_BLOCK);
    b.health.currentValue = 0; await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(ledger().length, 0);
    b.health.currentValue = 20; await mock.advance(R.PHIAL_POLL_TICKS);
    mock.players = [a]; await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(0, 71, "minecraft:nether"), "minecraft:air");
});

await scenario("air-only placement and ownership never destroy solids, fluids or genuine light blocks", async () => {
    const p = player();
    const foreign = ["minecraft:stone", "minecraft:water", "minecraft:lava", "minecraft:light_block"];
    for (const id of foreign) {
        for (const offset of R.PHIAL_LIGHT_OFFSETS) dim().getBlock(at(offset.x, 70 + offset.y, offset.z)).setType(id);
        if (id === foreign[0]) await start();
        await mock.advance(R.PHIAL_POLL_TICKS);
        for (const offset of R.PHIAL_LIGHT_OFFSETS) assert.equal(dim().typeAt(offset.x, 70 + offset.y, offset.z), id);
        assert.equal(ledger().length, 0);
    }
    for (const offset of R.PHIAL_LIGHT_OFFSETS) dim().getBlock(at(offset.x, 70 + offset.y, offset.z)).setType("minecraft:air");
    await mock.advance(R.PHIAL_POLL_TICKS);
    dim().getBlock(at(0)).setType("minecraft:light_block");
    p.offhand = undefined; await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(0), "minecraft:light_block"); assert.equal(ledger().length, 0);
});

await scenario("persisted orphans clean up after reload and unloaded chunks retry", async () => {
    world.setDynamicProperty(R.PHIAL_OWNERSHIP_PROPERTY, JSON.stringify([
        ["minecraft:overworld", 0, 71, 0], ["minecraft:overworld", 32, 71, 0],
        ["minecraft:overworld", 48, 71, 0], ["minecraft:overworld", 64, 71, 0],
    ]));
    dim().getBlock(at(0)).setType(R.PHIAL_LIGHT_BLOCK);
    dim().getBlock(at(32)).setType(R.PHIAL_LIGHT_BLOCK);
    dim().getBlock(at(48)).setType("minecraft:stone");
    dim().getBlock(at(64)).setType("minecraft:light_block");
    mock.strictLoading = true; dim().alwaysLoaded.add("0,0");
    await start(); await mock.advance(1);
    assert.equal(typeAt(0), "minecraft:air"); assert.equal(ledger().length, 3);
    for (const chunk of [2, 3, 4]) dim().alwaysLoaded.add(`${chunk},0`);
    await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(32), "minecraft:air"); assert.equal(typeAt(48), "minecraft:stone");
    assert.equal(typeAt(64), "minecraft:light_block"); assert.equal(ledger().length, 0);
});

await scenario("loaded orphan work stays bounded and rotates past unloaded records", async () => {
    const rows = Array.from({ length: R.PHIAL_CLEANUP_PER_PASS + 2 }, (_, i) => ["minecraft:overworld", i * 16, 71, 0]);
    world.setDynamicProperty(R.PHIAL_OWNERSHIP_PROPERTY, JSON.stringify(rows));
    const last = rows.at(-1); dim().getBlock(at(last[1])).setType(R.PHIAL_LIGHT_BLOCK);
    mock.strictLoading = true; dim().alwaysLoaded.add(`${last[1] >> 4},0`);
    await start(); await mock.advance(1);
    assert.equal(typeAt(last[1]), R.PHIAL_LIGHT_BLOCK);
    await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(last[1]), "minecraft:air", "loaded work is not starved by unloaded records");
});

await scenario("ledger capacity prevents unowned new blocks", async () => {
    const rows = Array.from({ length: R.PHIAL_MAX_PENDING_LIGHTS }, (_, i) => ["minecraft:overworld", 1000 + i * 16, 71, 0]);
    world.setDynamicProperty(R.PHIAL_OWNERSHIP_PROPERTY, JSON.stringify(rows));
    player(); mock.strictLoading = true; dim().alwaysLoaded.add("0,0");
    await start(); await mock.advance(1);
    assert.equal(typeAt(0), "minecraft:air"); assert.equal(ledger().length, R.PHIAL_MAX_PENDING_LIGHTS);
});

await scenario("failed persistence cannot create an unowned light; successful writes precede placement", async () => {
    player();
    const save = world.setDynamicProperty;
    world.setDynamicProperty = () => { throw Error("persistence unavailable"); };
    try { await start(); await mock.advance(1); }
    finally { world.setDynamicProperty = save; }
    assert.equal(typeAt(0), "minecraft:air"); assert.equal(ledger().length, 0);
    const d = dim(), get = d.getBlock.bind(d);
    d.getBlock = location => {
        const b = get(location); if (!b) return b;
        const set = b.setType.bind(b);
        b.setType = id => {
            if (id === R.PHIAL_LIGHT_BLOCK) assert.ok(ledger().some(row => row[0] === d.id && row[1] === b.x && row[2] === b.y && row[3] === b.z));
            set(id);
        };
        return b;
    };
    await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(typeAt(0), R.PHIAL_LIGHT_BLOCK); assert.equal(ledger().length, 1);
});

await scenario("spiders and cave spiders repel locally, deduplicate holders and obey query cap", async () => {
    player(); player(1);
    const ordinary = spider(3), cave = spider(-2, "minecraft:cave_spider"), sameCell = spider(0);
    const far = spider(9.01), high = spider(0, "minecraft:spider", 78.01), other = spider(1, "minecraft:spider", 70, "minecraft:nether");
    spider(1, "minecraft:zombie");
    await start(); await mock.advance(1);
    assert.equal(impulses.filter(i => i.e === ordinary).length, 1);
    assert.equal(impulses.find(i => i.e === ordinary).force.x, R.PHIAL_SPIDER_FORCE);
    assert.equal(impulses.find(i => i.e === cave).force.x, -R.PHIAL_SPIDER_FORCE);
    assert.equal(impulses.find(i => i.e === sameCell).force.x, R.PHIAL_SPIDER_FORCE);
    for (const e of [far, high, other]) assert.equal(impulses.filter(i => i.e === e).length, 0);
    assert.ok(impulses.every(i => i.vertical === 0 && Number.isFinite(i.force.x) && Math.abs(Math.hypot(i.force.x, i.force.z) - R.PHIAL_SPIDER_FORCE) < 1e-9));
    assert.ok(queries.every(q => q.maxDistance === R.PHIAL_SPIDER_RADIUS && q.closest <= R.PHIAL_MAX_SPIDERS && R.PHIAL_SPIDER_TYPES.includes(q.type)));
    impulses = [];
    for (let i = 0; i < 100; i++) spider(2 + i / 100);
    await mock.advance(R.PHIAL_POLL_TICKS);
    assert.ok(impulses.length <= 2 * R.PHIAL_MAX_SPIDERS);
});

await scenario("cleanup persistence failure keeps a retry until the empty ledger is durable", async () => {
    const p = player(); await start(); await mock.advance(1);
    p.offhand = undefined;
    const save = world.setDynamicProperty;
    world.setDynamicProperty = () => { throw Error("persistence unavailable during cleanup"); };
    try {
        await mock.advance(R.PHIAL_POLL_TICKS);
        assert.equal(typeAt(0), "minecraft:air");
        assert.equal(ledger().length, 1, "durable record remains until write succeeds");
        await mock.advance(R.PHIAL_POLL_TICKS);
        assert.equal(ledger().length, 1);
    } finally { world.setDynamicProperty = save; }
    await mock.advance(R.PHIAL_POLL_TICKS);
    assert.equal(ledger().length, 0, "retry succeeds even though no in-memory lights remain");
});

const block = JSON.parse(readFileSync(new URL("../lothlorien_bp/blocks/phial_light.json", import.meta.url)))["minecraft:block"];
assert.equal(block.components["minecraft:light_emission"], R.PHIAL_LIGHT_LEVEL);
assert.equal(block.components["minecraft:collision_box"], false);
assert.equal(block.components["minecraft:selection_box"], false);
assert.equal(block.components["minecraft:light_dampening"], 0);
assert.equal(block.components["minecraft:flammable"], false);
assert.deepEqual(block.components["minecraft:redstone_conductivity"], { redstone_conductor: false });
assert.deepEqual(block.components["minecraft:movable"], { movement_type: "popped" });
assert.deepEqual(block.components["minecraft:liquid_detection"].detection_rules, [{ liquid_type: "water", can_contain_liquid: false, on_liquid_touches: "broken" }]);
assert.deepEqual(JSON.parse(readFileSync(new URL("../lothlorien_bp/loot_tables/blocks/phial_light.json", import.meta.url))).pools, []);
console.log("ok   phial: hidden helper has configured light, no collision or drops, and yields to water");
