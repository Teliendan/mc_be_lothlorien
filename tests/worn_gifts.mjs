// Exercise production subscriptions/equipment/effect timing against the shared scheduler.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
register(new URL("../../../.claude/skills/bedrock-scripting/scripts/mock_loader.mjs", import.meta.url));
const { __mock: mock } = await import("@minecraft/server");
const { WORN_CHECK_TICKS: STEP, CLOAK, BELT } = await import("../lothlorien_bp/scripts/gift_rules.js");
let run = 0, playerQueries;

function player() {
  const health = { currentValue: 9, effectiveMax: 20 }, slots = {};
  const p = mock.addEntity("minecraft:player", { x: 0, y: 70, z: 0 }, { components: {
    "minecraft:health": health,
    "minecraft:equippable": { getEquipment: (slot) => slots[slot] && { typeId: slots[slot] } },
  } });
  p.health = health; p.slots = slots; p.isSneaking = false;
  p.velocity = { x: 0, y: 0, z: 0 }; p.getVelocity = () => p.velocity;
  p.effects = new Map(); p.grants = []; p.removals = [];
  p.getEffect = (name) => {
    const effect = p.effects.get(name);
    return effect && (effect.until === -1 || effect.until > mock.tick)
      ? { amplifier: effect.amplifier, duration: effect.until === -1 ? -1 : effect.until - mock.tick } : undefined;
  };
  p.addEffect = (name, ticks, options) => {
    p.grants.push({ name, ticks, options, at: mock.tick });
    p.effects.set(name, { amplifier: options.amplifier, until: mock.tick + ticks });
  };
  p.removeEffect = (name) => { p.removals.push(name); p.effects.delete(name); };
  mock.players.push(p);
  return p;
}
const grants = (p, name) => p.grants.filter(g => g.name === name);
const crouch = (p) => { p.slots.Chest = CLOAK.item; p.isSneaking = true; };
const belt = (p) => { p.slots.Offhand = BELT.item; };
async function start() {
  const { startWornGifts } = await import(`../lothlorien_bp/scripts/worn_gifts.js?test=${++run}`);
  startWornGifts();
  return startWornGifts;
}
async function scenario(name, body) {
  mock.reset(); playerQueries = 0;
  const { world } = await import("@minecraft/server");
  world.getPlayers = () => { playerQueries++; return mock.players; };
  await body();
  assert.deepEqual(mock.errors, []);
  console.log(`ok   worn gifts: ${name}`);
}

await scenario("cloak needs a full still crouch, and correct equipment slots", async () => {
  const p = player(), held = player(), standing = player();
  crouch(p); held.slots.Mainhand = CLOAK.item; held.isSneaking = true;
  standing.slots.Chest = CLOAK.item;
  await start();
  await mock.advance(CLOAK.stillTicks - STEP);
  assert.equal(p.grants.length, 0);
  await mock.advance(STEP);
  assert.equal(grants(p, CLOAK.effect).length, 1);
  assert.deepEqual(grants(p, CLOAK.effect)[0], {
    name: CLOAK.effect, ticks: CLOAK.effectTicks,
    options: { amplifier: CLOAK.amplifier, showParticles: false }, at: CLOAK.stillTicks,
  });
  assert.equal(held.grants.length, 0); assert.equal(standing.grants.length, 0);
  await mock.advance(CLOAK.effectTicks * 2);
  assert.equal(grants(p, CLOAK.effect).length, 5, "continuous crouch renews before expiry");
});

await scenario("continuous invisibility has no native expiry boundary for a full minute", async () => {
  const p = player(); crouch(p);
  const gaps = [], { system } = await import("@minecraft/server");
  // Run BEFORE the service at every tick. A check after the poll would hide the
  // old expiry-then-reapply bug because both happen inside the same script tick.
  system.runInterval(() => {
    if (mock.tick > CLOAK.stillTicks && !p.getEffect(CLOAK.effect)) gaps.push(mock.tick);
  }, 1);
  await start(); await mock.advance(CLOAK.stillTicks + 1200);
  assert.deepEqual(gaps, [], "native AI/render phases must never reach an expired effect");
  const applied = grants(p, CLOAK.effect);
  for (let i = 1; i < applied.length; i++) {
    assert.ok(applied[i].at < applied[i - 1].at + CLOAK.effectTicks, "renew while previous grant is active");
  }
  p.isSneaking = false;
  const lastGrant = applied.at(-1).at;
  await mock.advance(CLOAK.effectTicks + STEP);
  assert.equal(grants(p, CLOAK.effect).length, applied.length);
  assert.equal(p.getEffect(CLOAK.effect), undefined);
  assert.ok(lastGrant + CLOAK.effectTicks <= mock.tick, "short exit tail is unchanged");
  assert.deepEqual(p.removals, []);
});

await scenario("a potion hands over before expiry; replacing a cloak grant never shortens a potion", async () => {
  const p = player(); crouch(p);
  const until = CLOAK.stillTicks + 103;
  p.effects.set(CLOAK.effect, { amplifier: CLOAK.amplifier, until });
  await start(); await mock.advance(until - STEP - 1);
  assert.equal(p.grants.length, 0, "leave a longer potion untouched");
  assert.equal(p.getEffect(CLOAK.effect).duration, until - mock.tick);
  const gaps = [], { system } = await import("@minecraft/server");
  system.runInterval(() => { if (!p.getEffect(CLOAK.effect)) gaps.push(mock.tick); }, 1);
  await mock.advance(STEP * 6);
  assert.ok(p.grants[0].at < until, "same-strength potion hands over before its final native tick");
  assert.deepEqual(gaps, []);
  const before = p.grants.length, externalEnd = mock.tick + 1000;
  p.effects.set(CLOAK.effect, { amplifier: CLOAK.amplifier, until: externalEnd });
  await mock.advance(STEP * 10);
  assert.equal(p.grants.length, before);
  assert.equal(p.getEffect(CLOAK.effect).duration, externalEnd - mock.tick);
  delete p.slots.Chest; await mock.advance(STEP * 2);
  assert.equal(p.getEffect(CLOAK.effect).duration, externalEnd - mock.tick);
  assert.deepEqual(p.removals, []);
});

await scenario("movement, slow drift, velocity, dimensions and standing restart the wait", async () => {
  const p = player(); crouch(p);
  await start(); await mock.advance(CLOAK.stillTicks - STEP);
  p.location.x += CLOAK.moveTolerance * 2;
  await mock.advance(STEP);
  assert.equal(p.grants.length, 0, "moving at the grant boundary cancels it");
  await mock.advance(CLOAK.stillTicks - STEP); assert.equal(p.grants.length, 0);
  await mock.advance(STEP); assert.equal(p.grants.length, 1);
  p.isSneaking = false; await mock.advance(STEP);
  p.isSneaking = true;
  const before = p.grants.length;
  for (let i = 0; i < 10; i++) {
    p.location.x += CLOAK.moveTolerance * 0.6;
    await mock.advance(STEP);
  }
  assert.equal(p.grants.length, before, "anchor detects accumulated tiny steps");
  p.velocity.x = CLOAK.moveTolerance;
  await mock.advance(CLOAK.stillTicks * 2);
  assert.equal(p.grants.length, before, "velocity catches motion between samples");
  p.velocity.x = 0; await mock.advance(CLOAK.stillTicks - STEP);
  p.dimension = mock.dimension("nether"); await mock.advance(STEP);
  assert.equal(p.grants.length, before, "same coordinates in another dimension restart stillness");
  await mock.advance(CLOAK.stillTicks); assert.equal(p.grants.length, before + 1);
});

await scenario("unequip/death end cloak grants without erasing external invisibility", async () => {
  const p = player(); crouch(p); await start(); await mock.advance(CLOAK.stillTicks);
  delete p.slots.Chest; await mock.advance(CLOAK.effectTicks + STEP);
  assert.equal(p.grants.length, 1); assert.equal(p.getEffect(CLOAK.effect), undefined);
  p.effects.set(CLOAK.effect, { amplifier: 0, until: 1000 });
  crouch(p); await mock.advance(CLOAK.stillTicks + STEP);
  assert.equal(p.grants.length, 1, "existing external invisibility is not shortened");
  p.isSneaking = false; await mock.advance(STEP);
  assert.equal(p.getEffect(CLOAK.effect).duration, 1000 - mock.tick);
  p.isSneaking = true; p.health.currentValue = 0;
  mock.fire("entityDie", { deadEntity: p }); await mock.advance(CLOAK.stillTicks * 2);
  assert.equal(p.grants.length, 1); assert.deepEqual(p.removals, []);
  p.health.currentValue = 9;
  p.effects.delete(CLOAK.effect); mock.fire("playerSpawn", { player: p });
  await mock.advance(CLOAK.stillTicks); assert.equal(p.grants.length, 1, "respawn loses old still period");
  await mock.advance(STEP); assert.equal(p.grants.length, 2);
});

await scenario("infinite and stronger invisibility are left untouched", async () => {
  const a = player(), b = player(); crouch(a); crouch(b);
  a.effects.set(CLOAK.effect, { amplifier: 0, until: -1 });
  b.effects.set(CLOAK.effect, { amplifier: 2, until: 1000 });
  await start(); await mock.advance(CLOAK.stillTicks * 4);
  assert.equal(a.grants.length, 0); assert.equal(b.grants.length, 0);
  assert.equal(a.getEffect(CLOAK.effect).duration, -1);
});

await scenario("belt uses strictly less than half effective max and offhand only", async () => {
  const low = player(), boundary = player(), boosted = player(), main = player(), dead = player();
  for (const p of [low, boundary, boosted, dead]) belt(p);
  boundary.health.currentValue = 10; boosted.health.effectiveMax = 40; boosted.health.currentValue = 19;
  main.slots.Mainhand = BELT.item; dead.health.currentValue = 0;
  await start();
  for (const p of [low, boosted]) assert.deepEqual(grants(p, BELT.effect)[0], {
    name: BELT.effect, ticks: BELT.effectTicks, options: { amplifier: BELT.amplifier, showParticles: false }, at: 0,
  });
  for (const p of [boundary, main, dead]) assert.equal(p.grants.length, 0);
  boundary.health.currentValue = 9.99; await mock.advance(STEP);
  assert.equal(boundary.grants.length, 1);
});

await scenario("regeneration completes its healing cadence; potions survive and renewal stops", async () => {
  const p = player(), same = player(), strong = player(), infinite = player();
  for (const e of [p, same, strong, infinite]) belt(e);
  same.effects.set(BELT.effect, { amplifier: BELT.amplifier, until: 1000 });
  strong.effects.set(BELT.effect, { amplifier: BELT.amplifier + 1, until: 1000 });
  infinite.effects.set(BELT.effect, { amplifier: BELT.amplifier, until: -1 });
  await start(); await mock.advance(BELT.effectTicks - STEP);
  assert.equal(p.grants.length, 1, "do not reset the native regen clock each equipment poll");
  await mock.advance(STEP); assert.equal(p.grants.length, 2);
  for (const e of [same, strong, infinite]) assert.equal(e.grants.length, 0);
  p.health.currentValue = p.health.effectiveMax * BELT.healthFraction;
  await mock.advance(BELT.effectTicks); assert.equal(p.grants.length, 2);
  p.health.currentValue -= 1; await mock.advance(STEP); assert.equal(p.grants.length, 3);
  delete p.slots.Offhand; await mock.advance(BELT.effectTicks * 2); assert.equal(p.grants.length, 3);
  assert.deepEqual(p.removals, []);
});

await scenario("both gifts work independently and stale player handles are isolated", async () => {
  const bad = player(), p = player();
  bad.getComponent = () => { throw Error("player left during pulse"); };
  crouch(p); belt(p);
  await start(); await mock.advance(CLOAK.stillTicks);
  assert.equal(grants(p, CLOAK.effect).length, 1); assert.equal(grants(p, BELT.effect).length, 1);
});

await scenario("empty server sleeps, joining wakes, duplicate starts do not double poll", async () => {
  const again = await start();
  const before = playerQueries; await mock.advance(100); assert.equal(playerQueries, before);
  const p = player(); belt(p); mock.fire("playerSpawn", { player: p });
  again(); await mock.advance(STEP);
  assert.equal(p.grants.length, 1); assert.equal(playerQueries, before + 1);
  mock.players.length = 0; mock.fire("playerLeave", { playerId: p.id });
  await mock.advance(STEP); const asleep = playerQueries;
  await mock.advance(100); assert.equal(playerQueries, asleep);
});

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const cloakItem = json("../lothlorien_bp/items/elven_cloak.json")["minecraft:item"].components;
assert.deepEqual(cloakItem["minecraft:wearable"], { slot: "slot.armor.chest", protection: CLOAK.armor });
assert.equal(cloakItem["minecraft:durability"].max_durability, CLOAK.durability);
const beltItem = json("../lothlorien_bp/items/silver_belt.json")["minecraft:item"].components;
assert.equal(beltItem["minecraft:allow_off_hand"], true);
assert.equal(beltItem["minecraft:wearable"].slot, "slot.weapon.offhand");
const wornBoneNames = new Set();
for (const name of ["elven_cloak", "silver_belt"]) {
  const geometry = json(`../lothlorien_rp/models/entity/${name}.geo.json`)["minecraft:geometry"][0];
  const [anchor, mesh] = geometry.bones;
  assert.equal(anchor.binding, "'body'"); assert.equal(anchor.cubes, undefined);
  assert.equal(mesh.parent, anchor.name); assert.ok(mesh.cubes.length);
  for (const bone of geometry.bones) {
    assert.ok(!wornBoneNames.has(bone.name), "worn attachables never share animated bone names");
    wornBoneNames.add(bone.name);
  }
  const attachable = json(`../lothlorien_rp/attachables/${name}.json`)["minecraft:attachable"].description;
  assert.equal(attachable.identifier, `lothlorien:${name}`);
  assert.equal(attachable.geometry.default, geometry.description.identifier);
  const animations = json(`../lothlorien_rp/animations/${name}.animation.json`).animations;
  const hide = animations[attachable.animations.hide_first_person];
  assert.deepEqual(Object.keys(hide.bones), [mesh.name], "visibility animates only the local mesh child");
  assert.equal(hide.bones[mesh.name].scale, 0);
  if (name === "elven_cloak") assert.match(attachable.scripts.animate[0].hide_first_person, /query\.is_invisible/);
  else {
    assert.equal(attachable.scripts.animate[0].hide_first_person, "c.is_first_person");
    assert.equal(mesh.cubes[0].origin[1], 13.5, "band raised two model units above the accepted M5 baseline");
    assert.equal(mesh.cubes[1].origin[1], 12.7, "buckle follows the band");
  }
}
console.log("ok   worn gifts: native item protection/durability and body-bound asset bindings");
