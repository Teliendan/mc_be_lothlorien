// scripts/entity_util.js against the shared @minecraft/server mock (plus the enums in fixtures/voice_server_shim.mjs).
import assert from "node:assert/strict";
import { register } from "node:module";
register(new URL("./fixtures/voice_loader.mjs", import.meta.url));
const { __mock: mock, world } = await import("@minecraft/server");
const U = await import("../lothlorien_bp/scripts/entity_util.js");
const { PLAYER_ID } = await import("../lothlorien_bp/scripts/ids.js");
let cases = 0;
function test(name, body) { mock.reset(); body(); assert.deepEqual(mock.errors, []); cases++; console.log(`ok   entity util: ${name}`); }

test("say sends a chat line and ignores a player who left", () => {
  const sent = [], here = { sendMessage: (t) => sent.push(t) }, gone = { sendMessage() { throw new Error("player left"); } };
  U.say(here, "hello"); U.say(gone, "hello");
  assert.deepEqual(sent, ["hello"]);
});

test("playerById finds a player by id and nothing else", () => {
  const player = mock.addEntity(PLAYER_ID, { x: 0, y: 70, z: 0 }), deer = mock.addEntity("lothlorien:deer", { x: 1, y: 70, z: 1 });
  const entities = new Map([[player.id, player], [deer.id, deer]]);
  world.getEntity = (id) => entities.get(id);
  assert.equal(U.playerById(player.id), player);
  assert.equal(U.playerById(deer.id), undefined, "a mob with that id is not a player");
  assert.equal(U.playerById("nobody"), undefined, "an id the world does not know");
  assert.equal(U.playerById(undefined), undefined, "no id (a wild unicorn has no owner): no lookup");
});

console.log(`Passed ${cases} entity util scenarios.`);
