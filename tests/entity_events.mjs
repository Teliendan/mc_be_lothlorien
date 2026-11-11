// The pack-wide entity event router: one subscription pair, routing by type, isolation, order.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createEntityRouter } from "../lothlorien_bp/scripts/entity_events_rules.js";

function fakeWorld() {
  const subs = { entityLoad: [], entitySpawn: [] };
  const signal = name => ({ subscribe: fn => subs[name].push(fn) });
  return { subs, world: { afterEvents: { entityLoad: signal("entityLoad"), entitySpawn: signal("entitySpawn") } } };
}
const ev = typeId => ({ entity: { typeId } });
const fire = (w, name, event) => { for (const fn of w.subs[name]) fn(event); };
const quiet = [];
const router = w => createEntityRouter(w.world, m => quiet.push(m));

{ // no subscription before the first on(); exactly one per event after many
  const w = fakeWorld(), r = router(w);
  assert.equal(w.subs.entityLoad.length + w.subs.entitySpawn.length, 0);
  for (let i = 0; i < 10; i++) r.on(`t:${i}`, { load() {}, spawn() {} });
  assert.deepEqual([w.subs.entityLoad.length, w.subs.entitySpawn.length], [1, 1]);
}
{ // dispatch by type, array of types, load not called on spawn, registration order
  const w = fakeWorld(), r = router(w), seen = [];
  r.on("a", { load: () => seen.push("a-load"), spawn: () => seen.push("a-spawn") });
  r.on(["a", "b"], { load: () => seen.push("ab-load") });
  r.on("b", { spawn: () => seen.push("b-spawn") });
  fire(w, "entityLoad", ev("a")); assert.deepEqual(seen.splice(0), ["a-load", "ab-load"]);
  fire(w, "entityLoad", ev("b")); assert.deepEqual(seen.splice(0), ["ab-load"]);
  fire(w, "entitySpawn", ev("a")); assert.deepEqual(seen.splice(0), ["a-spawn"]);
  fire(w, "entitySpawn", ev("b")); assert.deepEqual(seen.splice(0), ["b-spawn"]);
  fire(w, "entityLoad", ev("other")); fire(w, "entitySpawn", ev("other")); assert.deepEqual(seen, []);
}
{ // typeId is read once per event
  const w = fakeWorld(), r = router(w); let reads = 0;
  r.on("a", { load() {} }); r.on("a", { load() {} }); r.on("b", { load() {} });
  fire(w, "entityLoad", { entity: { get typeId() { reads++; return "a"; } } });
  assert.equal(reads, 1);
}
{ // a throwing handler does not stop the next one; a throwing typeId is swallowed
  const w = fakeWorld(), r = router(w), seen = []; quiet.length = 0;
  r.on("m", { load() { throw new Error("boom"); } });
  r.on("m", { load: () => seen.push("next") });
  fire(w, "entityLoad", ev("m"));
  assert.deepEqual(seen, ["next"]); assert.equal(quiet.length, 1); assert.match(quiet[0], /boom/);
  assert.doesNotThrow(() => fire(w, "entityLoad", { entity: { get typeId() { throw new Error("removed"); } } }));
}
{ // reset drops routes and subscription state
  const w = fakeWorld(), r = router(w), seen = [];
  r.on("a", { load: () => seen.push(1) }); r.reset();
  fire(w, "entityLoad", ev("a")); assert.deepEqual(seen, []);
  r.on("a", { load: () => seen.push(2) });
  assert.equal(w.subs.entityLoad.length, 2); // a fresh world signal set would hold one; the old callback is inert
}
{ // no other pack script subscribes to these events
  const dir = new URL("../lothlorien_bp/scripts/", import.meta.url);
  for (const file of readdirSync(dir).filter(n => n.endsWith(".js") && n !== "entity_events_rules.js")) {
    assert.ok(!/afterEvents\.entity(Load|Spawn)/.test(readFileSync(new URL(file, dir), "utf8")), `${file}: route through onEntity`);
  }
}
console.log("ok   entity events: router");
