// Production healing against the shared scheduler/API mock. Native healing rate and rendering need the game.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
register(new URL("../../../.claude/skills/bedrock-scripting/scripts/mock_loader.mjs", import.meta.url));
const { __mock: mock } = await import("@minecraft/server");
const { ELF_ID } = await import("../lothlorien_bp/scripts/elf_rules.js");
const { WARDEN_ID } = await import("../lothlorien_bp/scripts/elven_warden_rules.js");
const R = await import("../lothlorien_bp/scripts/healer_rules.js");
let run = 0, calls, queries, rays, bands;

function dimension(id = "overworld") {
  const d = mock.dimension(id);
  if (d.healerMock) return d;
  d.healerMock = true;
  const query = d.getEntities.bind(d);
  d.getEntities = (q) => { queries.push(q); return query(q); };
  d.spawnParticle = (...args) => calls.push({ particle: args });
  d.getBlockFromRay = (from, direction, options) => {
    rays.push({ from, direction, options });
    if (d.unreadable) throw Error("unloaded sight line");
    return d.wall ? { block: {} } : undefined;
  };
  return d;
}
function entity(type, x = 0, y = 70, variant, dim = "overworld") {
  dimension(dim);
  const health = { currentValue: 10, effectiveMax: 20 };
  const e = mock.addEntity(type, { x, y, z: 0 }, { components: {
    "minecraft:health": health,
    ...(variant !== undefined ? { "minecraft:variant": { value: variant } } : {}),
  } }, dim);
  e.health = health; e.applications = []; e.poses = [];
  e.getHeadLocation = () => ({ ...e.location, y: e.location.y + 1.6 });
  e.getEffect = (name) => {
    assert.equal(name, R.EFFECT);
    return e.effect && (e.effect.until === -1 || e.effect.until > mock.tick)
      ? { amplifier: e.effect.amplifier, duration: e.effect.until === -1 ? -1 : e.effect.until - mock.tick } : undefined;
  };
  e.addEffect = (name, ticks, options) => {
    e.applications.push({ name, ticks, options, at: mock.tick });
    e.effect = { amplifier: options.amplifier, until: mock.tick + ticks };
  };
  e.playAnimation = (...args) => e.poses.push(args);
  if (type === "minecraft:player") { e.band = "friend"; mock.players.push(e); }
  return e;
}
const healer = (x, y, dim) => entity(ELF_ID, x, y, R.HEALER_VARIANT, dim);
const player = (x, y, dim) => entity("minecraft:player", x, y, undefined, dim);
const latest = (e) => e.applications.at(-1);
async function start() {
  const { startHealers } = await import(`../lothlorien_bp/scripts/healer.js?run=${++run}`);
  startHealers({ bandOf: (p) => { bands++; return p.band; } });
}
async function scenario(name, body) {
  mock.reset(); calls = []; queries = []; rays = []; bands = 0;
  for (const id of ["overworld", "nether", "the_end"]) dimension(id);
  await body();
  assert.deepEqual(mock.errors, []);
  console.log(`ok   healer: ${name}`);
}

await scenario("self, civilians, both warden kinds and Friends get the planned potency", async () => {
  const h = healer(), elf = entity(ELF_ID, 8, 70, 4), warden = entity(WARDEN_ID, -8);
  const natural = entity(WARDEN_ID, 2), friend = player(6);
  const animal = entity("lothlorien:deer", 1), stranger = player(2); stranger.band = "guest";
  await start(); await mock.advance(R.CHECK_TICKS);
  for (const e of [h, elf, warden, natural]) {
    assert.equal(latest(e).options.amplifier, 1);
    assert.equal(latest(e).ticks, R.EFFECT_TICKS);
  }
  assert.equal(latest(friend).options.amplifier, 0);
  assert.equal(animal.applications.length, 0); assert.equal(stranger.applications.length, 0);
  assert.equal(h.poses.length, 1, "one blessing pose for all patients");
  assert.equal(calls.length, 5, "one particle per blessed patient, self is not doubled");
  assert.ok(rays.every(r => Math.abs(Math.hypot(...Object.values(r.direction)) - 1) < 1e-9));
  assert.ok(rays.every(r => !r.options.includeLiquidBlocks && !r.options.includePassableBlocks));
});

await scenario("injury, Harmony, radius, height and dimension gates are independent", async () => {
  const h = healer(); h.health.currentValue = 20;
  const outside = entity(ELF_ID, 8.01, 70, 0), above = entity(WARDEN_ID, 0, 78.01);
  const far = player(6.01), overhead = player(0, 76.01), other = player(0, 70, "nether");
  const full = player(1); full.health.currentValue = 20;
  const dead = entity(ELF_ID, 1, 70, 2); dead.health.currentValue = 0;
  const refused = ["guest", "uneasy", "shunned", "hated"].map(b => { const p = player(1); p.band = b; return p; });
  await start(); await mock.advance(R.CHECK_TICKS);
  for (const e of [h, outside, above, far, overhead, other, full, dead, ...refused]) assert.equal(e.applications.length, 0);
  assert.equal(h.poses.length, 0); assert.equal(calls.length, 0); assert.equal(rays.length, 0);
  assert.equal(bands, refused.length, "no Harmony read for healthy/out-of-range players");
});

await scenario("walls and unreadable chunks block sight, while self-care needs no ray", async () => {
  const h = healer(), p = player(2), elf = entity(ELF_ID, 3, 70, 0);
  dimension().wall = true;
  await start(); await mock.advance(R.CHECK_TICKS);
  assert.equal(h.applications.length, 1); assert.equal(p.applications.length, 0); assert.equal(elf.applications.length, 0);
  dimension().wall = false; dimension().unreadable = true;
  await mock.advance(R.CHECK_TICKS);
  assert.equal(p.applications.length, 0); assert.equal(elf.applications.length, 0);
  dimension().unreadable = false; await mock.advance(R.CHECK_TICKS);
  assert.equal(p.applications.length, 1); assert.equal(elf.applications.length, 1);
});

await scenario("effects finish before renewal; stronger/longer/infinite potions survive", async () => {
  const h = healer(), p = player(2), strong = player(3), long = player(4), infinite = player(5);
  strong.effect = { amplifier: 2, until: 1000 };
  long.effect = { amplifier: 0, until: 1000 };
  infinite.effect = { amplifier: 0, until: -1 };
  h.effect = { amplifier: 0, until: 1000 }; // elf Regeneration II replaces weaker I
  await start(); await mock.advance(R.CHECK_TICKS);
  assert.equal(latest(h).options.amplifier, 1); assert.equal(p.applications.length, 1);
  await mock.advance(R.EFFECT_TICKS - R.CHECK_TICKS);
  assert.equal(p.applications.length, 1, "no early refresh of an active effect");
  await mock.advance(R.CHECK_TICKS);
  assert.equal(p.applications.length, 2, "no cooldown once the effect expires");
  for (const e of [strong, long, infinite]) assert.equal(e.applications.length, 0);
  p.band = "guest"; await mock.advance(R.EFFECT_TICKS);
  assert.equal(p.applications.length, 2, "losing Friend stops renewal");
  p.band = "friend"; p.location.x = 7; await mock.advance(R.EFFECT_TICKS);
  assert.equal(p.applications.length, 2, "leaving range stops renewal");
  p.location.x = 2; await mock.advance(R.CHECK_TICKS);
  assert.equal(p.applications.length, 3, "returning needs no cooldown");
  p.health.currentValue = 20; await mock.advance(R.EFFECT_TICKS);
  assert.equal(p.applications.length, 3, "full health stops renewal");
});

await scenario("overlapping healers deduplicate even if native effect reads lag a tick", async () => {
  const a = healer(), b = healer(1), p = player(2);
  p.getEffect = () => undefined;
  await start(); await mock.advance(R.CHECK_TICKS);
  for (const e of [a, b, p]) assert.equal(e.applications.length, 1);
  assert.equal(bands, 1, "one band read across both healers");
  assert.equal(queries.length, 7, "three bootstrap + two bounded queries per healer");
  for (const q of queries.slice(3)) { assert.equal(q.maxDistance, R.ELF_CARE.radius); assert.ok(R.PATIENT_TYPES.includes(q.type)); }
});

await scenario("empty world sleeps; delayed profession, duplicate load and reload wake one timer", async () => {
  await start(); await mock.advance(100);
  assert.equal(queries.length, 3, "only the one-time bootstrap without healers");
  const h = entity(ELF_ID, 0, 70, 0), p = player(2);
  mock.fire("entitySpawn", { entity: h });
  h.components["minecraft:variant"].value = R.HEALER_VARIANT;
  mock.fire("entityLoad", { entity: h });
  await mock.advance(R.CHECK_TICKS + 1);
  assert.equal(p.applications.length, 1); assert.equal(queries.length, 5, "duplicate registration gives one timer");
  h.isValid = false; mock.fire("entityRemove", { removedEntityId: h.id });
  await mock.advance(100); assert.equal(queries.length, 5, "unload sleeps");
  h.isValid = true; mock.fire("entityLoad", { entity: h });
  await mock.advance(R.CHECK_TICKS + 1); assert.equal(p.applications.length, 2, "reload resumes");
  h.isValid = false; await mock.advance(R.CHECK_TICKS);
  const before = queries.length; await mock.advance(100);
  assert.equal(queries.length, before, "invalid-handle fallback also sleeps");
});

await scenario("death before deferred discovery cannot register a still-valid corpse", async () => {
  await start();
  const h = healer(), p = player(2);
  mock.fire("entitySpawn", { entity: h });
  h.health.currentValue = 0;
  mock.fire("entityDie", { deadEntity: h });
  await mock.advance(100);
  assert.equal(queries.length, 3); assert.equal(p.applications.length, 0);
});

await scenario("profession changes, death and cosmetic failures cannot leave stray healing", async () => {
  const h = entity(ELF_ID, 0, 70, 0), p = player(2);
  await start();
  h.components["minecraft:variant"].value = R.HEALER_VARIANT;
  mock.fire("dataDrivenEntityTrigger", { entity: h, eventId: "lothlorien:as_healer" });
  dimension().spawnParticle = () => { throw Error("cosmetic"); };
  h.playAnimation = () => { throw Error("cosmetic"); };
  await mock.advance(R.CHECK_TICKS + 1); assert.equal(p.applications.length, 1);
  h.components["minecraft:variant"].value = 0;
  mock.fire("dataDrivenEntityTrigger", { entity: h, eventId: "lothlorien:as_gardener" });
  await mock.advance(100); assert.equal(p.applications.length, 1);
  h.components["minecraft:variant"].value = R.HEALER_VARIANT;
  mock.fire("dataDrivenEntityTrigger", { entity: h, eventId: "lothlorien:as_healer" });
  await mock.advance(R.CHECK_TICKS + 1); assert.equal(p.applications.length, 2);
  mock.fire("entityDie", { deadEntity: h });
  const before = queries.length; await mock.advance(100); assert.equal(queries.length, before);
});

const animation = JSON.parse(readFileSync(new URL("../lothlorien_rp/animations/elf.animation.json", import.meta.url))).animations[R.BLESSING.animation];
assert.equal(animation.loop, false);
assert.equal(animation.animation_length, R.BLESSING.seconds);
assert.deepEqual(Object.keys(animation.bones).sort(), ["leftArm", "rightArm"]);
const main = readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8");
assert.match(main, /startHealers\(\{ bandOf: \(player\) => bandOf\(harmonyOf\(player\)\.harmony\) \}\)/);
console.log("ok   healer: finite generated arm pose and production Harmony binding");
