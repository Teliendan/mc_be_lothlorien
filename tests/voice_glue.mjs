// Sindarin voice glue against the shared scheduler/API mock: the warden's click greeting and combat shout, and speak() playback.
// Whether the engine dispatches these events for the custom warden needs the game (docs/SINDARIN_VOICE_EVENTS.md).
import assert from "node:assert/strict";
import { register } from "node:module";
register(new URL("./fixtures/voice_loader.mjs", import.meta.url));
const { __mock: mock } = await import("@minecraft/server");
const { WARDEN_ID, ANGRY_EVENT } = await import("../lothlorien_bp/scripts/elven_warden_rules.js");
const { FOE_TAG } = await import("../lothlorien_bp/scripts/elf_rules.js");
const { startElvenWardens } = await import("../lothlorien_bp/scripts/elven_warden.js");
const { ELF_GAP_TICKS, soundIdOf, VOICE_HEIGHT, VOLUME } = await import("../lothlorien_bp/scripts/voice_rules.js");

let sounds;
async function scenario(name, body) {
  mock.reset(); sounds = [];
  mock.dimension().playSound = (id, location, options) => sounds.push({ id, location, options });
  startElvenWardens(() => ({ level: 2 }), (p) => p.band);
  await body();
  assert.deepEqual(mock.errors, []);
  console.log(`ok   voice glue: ${name}`);
}
const warden = (x = 0) => mock.addEntity(WARDEN_ID, { x, y: 70, z: 0 });
const player = (band) => { const p = mock.addEntity("minecraft:player", { x: 1, y: 70, z: 0 }); p.band = band; return p; };
const click = async (p, w, item = "minecraft:air") => {
  const event = { player: p, target: w, itemStack: { typeId: item } };
  mock.fire("playerInteractWithEntity", event, "before");
  await mock.advance(1);
  return event;
};

await scenario("a click greets by Harmony band, next tick, at mouth height, without cancelling", async () => {
  const w = warden(), friend = player("friend");
  const event = { player: friend, target: w, itemStack: { typeId: "minecraft:air" } };
  mock.fire("playerInteractWithEntity", event, "before");
  assert.notEqual(event.cancel, true, "the click is left alone");
  assert.equal(sounds.length, 0, "sound needs privilege: deferred");
  await mock.advance(1);
  assert.equal(sounds.length, 1);
  assert.equal(sounds[0].id, soundIdOf("opening_warm"));
  assert.deepEqual(sounds[0].location, { x: 0, y: 70 + VOICE_HEIGHT, z: 0 });
  assert.deepEqual(sounds[0].options, { volume: VOLUME.opening_warm });
  await click(friend, w);
  assert.equal(sounds.length, 1, "a repeat within 30 s is silent");
  await mock.advance(ELF_GAP_TICKS); // one elf speaks at most every 4 s, whoever clicks
  const guest = await click(player("guest"), w);
  assert.equal(sounds[1].id, soundIdOf("opening_neutral"));
  assert.notEqual(guest.cancel, true);
  await mock.advance(ELF_GAP_TICKS);
  await click(player("shunned"), w);
  assert.equal(sounds[2].id, soundIdOf("refuse_speak"));
});

await scenario("Hated, a lead, a name tag, other mobs and a fought player stay silent", async () => {
  const w = warden(), friend = player("friend");
  await click(player("hated"), w);
  await click(friend, w, "minecraft:lead");
  await click(friend, w, "minecraft:name_tag");
  await click(friend, mock.addEntity("lothlorien:deer", { x: 0, y: 70, z: 0 }));
  const foe = player("friend"); foe.addTag(FOE_TAG);
  await click(foe, w);
  const hitter = player("friend");
  mock.fire("entityHurt", { hurtEntity: w, damageSource: { damagingEntity: hitter } });
  await click(hitter, w);
  assert.equal(sounds.length, 0);
  await click(friend, w);
  assert.equal(sounds.length, 1, "an ordinary click still greets");
});

await scenario("acquiring a target shouts once per fight; other events do not", async () => {
  const a = warden(), b = warden(4), far = warden(40);
  mock.fire("dataDrivenEntityTrigger", { entity: a, eventId: ANGRY_EVENT });
  mock.fire("dataDrivenEntityTrigger", { entity: b, eventId: ANGRY_EVENT });
  mock.fire("dataDrivenEntityTrigger", { entity: far, eventId: "lothlorien:on_calm" });
  assert.equal(sounds.length, 1, "neighbour stays quiet, calming is not a shout");
  assert.equal(sounds[0].id, soundIdOf("combat_start"));
  assert.deepEqual(sounds[0].options, { volume: 1.0 });
  mock.fire("dataDrivenEntityTrigger", { entity: far, eventId: ANGRY_EVENT });
  assert.equal(sounds.length, 2, "a separate fight");
});

await scenario("a failing or missing playSound cannot break the caller", async () => {
  mock.dimension().playSound = () => { throw Error("chunk unloaded"); };
  const w = warden(), p = player("guest");
  await click(p, w);
  const gone = warden(2); gone.isValid = false;
  mock.fire("dataDrivenEntityTrigger", { entity: gone, eventId: ANGRY_EVENT });
  assert.equal(sounds.length, 0);
});
