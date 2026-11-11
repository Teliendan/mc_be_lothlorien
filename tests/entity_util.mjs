// scripts/entity_util.js against the shared @minecraft/server mock (plus the enums in fixtures/voice_server_shim.mjs).
import assert from "node:assert/strict";
import { register } from "node:module";
register(new URL("./fixtures/voice_loader.mjs", import.meta.url));
const { __mock: mock, world } = await import("@minecraft/server");
const U = await import("../lothlorien_bp/scripts/entity_util.js");
const { PLAYER_ID } = await import("../lothlorien_bp/scripts/ids.js");
const EL = await import("../lothlorien_bp/scripts/elf_rules.js"), R = await import("../lothlorien_bp/scripts/renown_rules.js"), T = await import("../lothlorien_bp/scripts/trade_rules.js");
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

await test("traderProfession names the four trading professions by variant and nothing else", () => {
  const { PROFESSIONS, TRADERS } = EL;
  assert.deepEqual(TRADERS, PROFESSIONS.slice(0, 4), "variants 0..3 trade; the Loremaster is the last variant");
  const elf = (variant, typeId = "lothlorien:elf") => ({ typeId, getComponent: () => ({ value: variant }) });
  TRADERS.forEach((p, v) => assert.equal(U.traderProfession(elf(v)), p));
  assert.equal(U.traderProfession(elf(PROFESSIONS.indexOf("loremaster"))), undefined, "the Loremaster is not a trader");
  assert.equal(U.traderProfession(elf(0, "lothlorien:deer")), undefined);
  assert.equal(U.traderProfession({ typeId: "lothlorien:elf", getComponent() { throw new Error("gone"); } }), undefined);
  const rules = [R.PROFESSIONS, T.TRADERS];
  for (const list of rules) assert.deepEqual(list, TRADERS, "trade_rules.js and renown_rules.js read the one list in elf_rules.js");
});

await test("ids.js ids are the entity identifiers, and the rule modules re-export the same strings", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const ids = await import("../lothlorien_bp/scripts/ids.js");
  for (const [name, id] of Object.entries(ids)) {
    if (id.startsWith("minecraft:")) continue;
    const file = new URL(`../lothlorien_bp/entities/${id.split(":")[1]}.json`, import.meta.url);
    assert.ok(existsSync(file), `${name}: entities/${id.split(":")[1]}.json`);
    assert.equal(JSON.parse(readFileSync(file, "utf8"))["minecraft:entity"].description.identifier, id, name);
  }
  const rules = { deer_rules: ["WHITE_DEER_ID", "UNICORN_ID", "SWAN_ID", "SQUIRREL_ID"], unicorn_rules: ["UNICORN_ID"], white_deer_rules: ["WHITE_DEER_ID"], swan_rules: ["SWAN_ID"],
    squirrel_rules: ["SQUIRREL_ID"], elf_rules: ["ELF_ID"], elven_warden_rules: ["WARDEN_ID", "PLAYER_ID"] };
  for (const [file, names] of Object.entries(rules)) {
    const mod = await import(`../lothlorien_bp/scripts/${file}.js`);
    for (const n of names) assert.equal(mod[n], ids[n], `${file}.${n}`);
  }
});

console.log(`Passed ${cases} entity util scenarios.`);
