// scripts/entity_util.js against the shared @minecraft/server mock (plus the enums in fixtures/voice_server_shim.mjs).
import assert from "node:assert/strict";
import { register } from "node:module";
register(new URL("./fixtures/voice_loader.mjs", import.meta.url));
const { __mock: mock, world } = await import("@minecraft/server");
const U = await import("../lothlorien_bp/scripts/entity_util.js");
const { PLAYER_ID } = await import("../lothlorien_bp/scripts/ids.js");
let cases = 0;
async function test(name, body) { mock.reset(); await body(); assert.deepEqual(mock.errors, []); cases++; console.log(`ok   entity util: ${name}`); }

await test("say sends a chat line and ignores a player who left", () => {
  const sent = [], here = { sendMessage: (t) => sent.push(t) }, gone = { sendMessage() { throw new Error("player left"); } };
  U.say(here, "hello"); U.say(gone, "hello");
  assert.deepEqual(sent, ["hello"]);
});

await test("playerById finds a player by id and nothing else", () => {
  const player = mock.addEntity(PLAYER_ID, { x: 0, y: 70, z: 0 }), deer = mock.addEntity("lothlorien:deer", { x: 1, y: 70, z: 1 });
  const entities = new Map([[player.id, player], [deer.id, deer]]);
  world.getEntity = (id) => entities.get(id);
  assert.equal(U.playerById(player.id), player);
  assert.equal(U.playerById(deer.id), undefined, "a mob with that id is not a player");
  assert.equal(U.playerById("nobody"), undefined, "an id the world does not know");
  assert.equal(U.playerById(undefined), undefined, "no id (a wild unicorn has no owner): no lookup");
});

await test("familiesOf reads the type families and survives an unreadable entity", () => {
  const fam = { getComponent: () => ({ getTypeFamilies: () => ["zombie", "monster"] }) };
  assert.deepEqual(U.familiesOf(fam), ["zombie", "monster"]);
  assert.deepEqual(U.familiesOf({ getComponent: () => undefined }), []);
  assert.deepEqual(U.familiesOf({ getComponent: () => { throw new Error("gone"); } }), []);
});

await test("judgeNatural judges a natural spawn once, and never summoned or invalid ones", () => {
  const entity = (natural, isValid = true) => { const props = new Map([["lothlorien:natural", natural]]);
    return { isValid, getProperty: (k) => props.get(k), setProperty: (k, v) => props.set(k, v), props }; };
  let judged = 0;
  const natural = entity(true);
  U.judgeNatural(natural, () => { judged++; assert.equal(natural.props.get("lothlorien:natural"), false, "the flag is cleared before the judge runs"); });
  U.judgeNatural(natural, () => judged++); assert.equal(judged, 1, "a second pass (chunk reload) does not judge again");
  U.judgeNatural(entity(false), () => judged++); U.judgeNatural(entity(true, false), () => judged++); assert.equal(judged, 1);
  U.judgeNatural(entity(true), () => { throw new Error("chunk unloaded"); }); // swallowed
});

await test("beacon helpers remove by id and move by teleport", () => {
  const beacon = mock.addEntity("lothlorien:guide_beacon", { x: 0, y: 70, z: 0 }); let removed = 0, to;
  beacon.remove = () => removed++; beacon.teleport = (p) => { to = p; };
  world.getEntity = (id) => (id === beacon.id ? beacon : undefined);
  U.removeBeacon(beacon.id); U.removeBeacon("other"); U.removeBeacon(undefined); assert.equal(removed, 1);
  U.moveBeacon(beacon, { x: 1, y: 2, z: 3, extra: 9 }); assert.deepEqual(to, { x: 1, y: 2, z: 3 });
});

await test("consumeHeld takes one held item (none in Creative) and reports whether the hand held it", async () => {
  const { consumeHeld } = await import("../lothlorien_bp/scripts/deferred_use.js");
  const player = (typeId, amount, mode = "Survival") => { const slot = { typeId, amount, hasItem: () => !!typeId, setItem() { slot.typeId = undefined; } };
    return { slot, getGameMode: () => mode, getComponent: () => ({ getEquipmentSlot: (s) => (s === "Mainhand" ? slot : undefined) }) }; };
  const p = player("lothlorien:mallorn_acorn", 2);
  assert.equal(consumeHeld(p, "lothlorien:mallorn_acorn"), true); assert.equal(p.slot.amount, 1);
  assert.equal(consumeHeld(p, "lothlorien:mallorn_acorn"), true); assert.equal(p.slot.typeId, undefined, "the last one empties the slot");
  assert.equal(consumeHeld(p, "lothlorien:mallorn_acorn"), false, "empty hand");
  const other = player("minecraft:stick", 3); assert.equal(consumeHeld(other, "lothlorien:elanor"), false); assert.equal(other.slot.amount, 3, "another item is never consumed");
  const creative = player("lothlorien:elanor", 3, "Creative"); assert.equal(consumeHeld(creative, "lothlorien:elanor"), true); assert.equal(creative.slot.amount, 3);
});

console.log(`Passed ${cases} entity util scenarios.`);
