// Production boat_drop.js and boat_wobble.js against the API mock. The oak item the engine drops for a Mallorn boat becomes the
// Mallorn item. Whether an axe break really drops oak (owner report 2026-11-08) and where it lands needs the game.
import assert from "node:assert/strict";
import { register } from "node:module";
register(new URL("../../../.claude/skills/bedrock-scripting/scripts/mock_loader.mjs", import.meta.url));
const { __mock: mock, ItemStack } = await import("@minecraft/server");
const R = await import("../lothlorien_bp/scripts/boat_drop_rules.js");
let run = 0;
const dim = () => mock.dimension();
const at = (x, y = 63, z = 0) => ({ x, y, z });

function item(typeId, location, velocity = { x: 0, y: 0, z: 0 }) {
  const e = mock.addEntity(R.ITEM_ENTITY, location, { components: { "minecraft:item": { itemStack: new ItemStack(typeId) } } });
  e.velocity = { ...velocity };
  e.getVelocity = () => ({ ...e.velocity });
  e.applyImpulse = (v) => { e.velocity = { x: e.velocity.x + v.x, y: e.velocity.y + v.y, z: e.velocity.z + v.z }; };
  return e;
}
function boat(typeId, location, stored = []) {
  const components = {};
  if (stored.length) components["minecraft:inventory"] = { container: { size: 27, getItem: (slot) => (stored[slot] ? new ItemStack(stored[slot]) : undefined) } };
  return mock.addEntity(typeId, location, { components });
}
const items = () => dim().getEntities({ type: R.ITEM_ENTITY }).map((e) => e.getComponent("minecraft:item").itemStack.typeId).sort();
async function start() {
  dim().spawnItem = (stack, location) => item(stack.typeId, location);
  await import(`../lothlorien_bp/scripts/boat_drop.js?test=${++run}`);
  assert.equal(mock.subscribers("before", "entityRemove"), 0, "subscribes only after worldLoad");
  mock.fire("worldLoad", {});
}
// The engine order: the boat drops its item, then the boat is removed.
function breakBoat(b, dropTypeId, offset = { x: 0.3, y: 0.2, z: -0.1 }) {
  const l = b.location;
  const drop = dropTypeId && item(dropTypeId, { x: l.x + offset.x, y: l.y + offset.y, z: l.z + offset.z }, { x: 0.05, y: 0.2, z: 0 });
  mock.fire("entityRemove", { removedEntity: b }, "before");
  b.remove();
  return drop;
}
async function scenario(name, body) {
  mock.reset(); await start(); await body(); assert.deepEqual(mock.errors, []); console.log(`ok   boat scripts: ${name}`);
}

await scenario("every boat entity maps to its own item and the vanilla item of its runtime class", async () => {
  assert.deepEqual(Object.keys(R.BOAT_DROPS).sort(), ["lothlorien:mallorn_boat", "lothlorien:mallorn_chest_boat", "lothlorien:mallorn_heartwood_boat", "lothlorien:mallorn_heartwood_chest_boat"]);
  for (const [entity, { vanilla, own }] of Object.entries(R.BOAT_DROPS)) {
    assert.equal(own, entity, "the item shares the entity id (entity_placer)");
    assert.equal(vanilla, entity.includes("chest") ? "minecraft:oak_chest_boat" : "minecraft:oak_boat");
  }
});

await scenario("an oak drop from each Mallorn boat becomes that boat's item and keeps its motion", async () => {
  for (const [i, typeId] of Object.keys(R.BOAT_DROPS).entries()) {
    const oak = breakBoat(boat(typeId, at(i * 20)), R.BOAT_DROPS[typeId].vanilla);
    await mock.advance(1);
    assert.equal(oak.isValid, false, `${typeId}: oak item removed`);
    const own = dim().getEntities({ type: R.ITEM_ENTITY, location: at(i * 20), maxDistance: R.SEARCH_RADIUS });
    assert.equal(own.length, 1);
    assert.equal(own[0].getComponent("minecraft:item").itemStack.typeId, typeId);
    assert.deepEqual(own[0].location, oak.location);
    assert.deepEqual(own[0].velocity, { x: 0.05, y: 0.2, z: 0 });
  }
});

await scenario("a break that already dropped the Mallorn item, a vanilla boat and an oak item further away stay untouched", async () => {
  breakBoat(boat("lothlorien:mallorn_boat", at(0)), "lothlorien:mallorn_boat");
  const far = item("minecraft:oak_boat", at(0 + R.SEARCH_RADIUS + 1));
  breakBoat(boat("minecraft:boat", at(40)), "minecraft:oak_boat");
  await mock.advance(1);
  assert.equal(far.isValid, true);
  assert.deepEqual(items(), ["lothlorien:mallorn_boat", "minecraft:oak_boat", "minecraft:oak_boat"]);
});

await scenario("oak chest boats stored in a Mallorn chest boat spill unchanged; only the engine's own drop converts", async () => {
  const stored = ["minecraft:oak_chest_boat", "minecraft:apple", "minecraft:oak_chest_boat"];
  const a = boat("lothlorien:mallorn_chest_boat", at(0), stored);
  for (const s of stored) item(s, at(0.2));
  breakBoat(a, "minecraft:oak_chest_boat");
  await mock.advance(1);
  assert.deepEqual(items(), ["lothlorien:mallorn_chest_boat", "minecraft:apple", "minecraft:oak_chest_boat", "minecraft:oak_chest_boat"]);

  const b = boat("lothlorien:mallorn_heartwood_chest_boat", at(40), stored);
  for (const s of stored) item(s, at(40.2));
  breakBoat(b, "lothlorien:mallorn_heartwood_chest_boat"); // loot-table path: no engine oak drop
  await mock.advance(1);
  assert.equal(dim().getEntities({ type: R.ITEM_ENTITY, location: at(40), maxDistance: R.SEARCH_RADIUS })
    .filter((e) => e.getComponent("minecraft:item").itemStack.typeId === "minecraft:oak_chest_boat").length, 2, "stored boats are not converted");
});

await scenario("a boat removed without a drop (chunk unload, creative break) changes nothing", async () => {
  const keep = item("minecraft:oak_boat", at(30));
  breakBoat(boat("lothlorien:mallorn_boat", at(0)), undefined);
  await mock.advance(1);
  assert.equal(keep.isValid, true);
  assert.deepEqual(items(), ["minecraft:oak_boat"]);
});

// Hit wobble: boat_wobble.js bumps the synced hit counter the client wobble animation watches.
const W = await import("../lothlorien_bp/scripts/boat_wobble.js");
const wobbleBoat = (typeId, valid = true) => {
  const e = mock.addEntity(typeId, at(0)); e.props.set(W.HIT_PROPERTY, 0);
  e.getProperty = (k) => e.props.get(k); e.setProperty = (k, v) => e.props.set(k, v); e.isValid = valid; return e;
};
await scenario("each player hit on a Mallorn boat changes the synced hit count, wrapping inside the property range", async () => {
  await import(`../lothlorien_bp/scripts/boat_wobble.js?test=${++run}`);
  mock.fire("worldLoad", {});
  assert.equal(mock.subscribers("after", "entityHitEntity"), 1);
  const player = mock.addEntity("minecraft:player", at(2));
  for (const typeId of Object.keys(R.BOAT_DROPS)) {
    const b = wobbleBoat(typeId);
    const seen = [];
    for (let i = 0; i < W.HIT_COUNT + 1; i++) { mock.fire("entityHitEntity", { damagingEntity: player, hitEntity: b }); seen.push(b.getProperty(W.HIT_PROPERTY)); }
    assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 0, 1], `${typeId}: every hit is a change; 0..7 as declared`);
  }
  const vanilla = wobbleBoat("minecraft:boat");
  mock.fire("entityHitEntity", { damagingEntity: player, hitEntity: vanilla });
  assert.equal(vanilla.getProperty(W.HIT_PROPERTY), 0, "vanilla boats keep their own renderer");
  const broken = wobbleBoat("lothlorien:mallorn_boat", false);
  mock.fire("entityHitEntity", { damagingEntity: player, hitEntity: broken });
  assert.equal(broken.getProperty(W.HIT_PROPERTY), 0, "the breaking hit has nothing left to rock");
});

await scenario("the hit property, its range and the client wobble wiring match on all four boats", async () => {
  const { readFileSync } = await import("node:fs");
  const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
  for (const typeId of Object.keys(R.BOAT_DROPS)) {
    const short = typeId.split(":")[1];
    const prop = json(`lothlorien_bp/entities/${short}.json`)["minecraft:entity"].description.properties[W.HIT_PROPERTY];
    assert.deepEqual(prop, { type: "int", range: [0, W.HIT_COUNT - 1], default: 0, client_sync: true });
    const client = json(`lothlorien_rp/entity/${short}.entity.json`)["minecraft:client_entity"].description;
    assert.ok(client.scripts.animate.includes("wobble"));
    assert.equal(client.animations.wobble, "animation.lothlorien.mallorn_boat.wobble");
    assert.ok(client.scripts.pre_animation.some((l) => l.includes(`query.property('${W.HIT_PROPERTY}')`)));
  }
  const anim = json("lothlorien_rp/animations/mallorn_boat.animation.json").animations["animation.lothlorien.mallorn_boat.wobble"];
  assert.equal(anim.bones.hull.rotation[1], 0, "the roll leaves the yaw to the turn animation");
});
