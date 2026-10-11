// Run the runtime against the shared scheduler/API mock; this checks wiring, not native trade-screen behavior.
import assert from "node:assert/strict";
import { register } from "node:module";
register(new URL("../../../.claude/skills/bedrock-scripting/scripts/mock_loader.mjs", import.meta.url));
const { __mock: mock } = await import("@minecraft/server");
const { ELF_ID } = await import("../lothlorien_bp/scripts/elf_rules.js");
const { PASS_TAG, TABLE_PROPERTY, PIN_TICKS, TRADE_PASS_TICKS } = await import("../lothlorien_bp/scripts/trade_rules.js");

let run = 0;
let inBefore = false;
let requests;
const mutating = (fn) => (...args) => {
  assert.equal(inBefore, false, "world mutation must be deferred from before-events");
  return fn(...args);
};
function player(x = 0) {
  const p = mock.addEntity("minecraft:player", { x, y: 70, z: 0 });
  p.band = "guest"; p.rank = 0; p.request = null; p.sent = [];
  p.sendMessage = mutating((m) => p.sent.push(m));
  p.addTag = mutating(p.addTag.bind(p)); p.removeTag = mutating(p.removeTag.bind(p));
  mock.players.push(p);
  return p;
}
function elf(x = 2, variant = 0) {
  const e = mock.addEntity(ELF_ID, { x, y: 70, z: 0 }, { components: { "minecraft:variant": { value: variant } } });
  e.table = "none"; e.events = [];
  e.getProperty = (name) => { assert.equal(name, TABLE_PROPERTY); return e.table; };
  e.triggerEvent = mutating((name) => { e.events.push(name); e.table = name.replace("lothlorien:trade_", ""); });
  return e;
}
function click(p, e, typeId) {
  const event = { player: p, target: e, cancel: false, ...(typeId ? { itemStack: { typeId } } : {}) };
  inBefore = true;
  try { mock.fire("playerInteractWithEntity", event, "before"); } finally { inBefore = false; }
  return event.cancel;
}
const chatCount = (p, key) => p.sent.filter((m) => m.translate === `lothlorien.message.${key}`).length;
async function start() {
  const mod = await import(`../lothlorien_bp/scripts/trade.js?trade_glue=${++run}`);
  mod.startTrade({
    bandOf: (p) => p.band, rankOf: (p) => p.rank, requestProfession: (p) => p.request,
    openRequestForm: (p, e, profession) => new Promise((resolve) => requests.push({ p, e, profession, resolve })),
  });
  return mod;
}
async function scenario(name, body) {
  mock.reset(); requests = []; inBefore = false;
  await body();
  assert.deepEqual(mock.errors, [], "no uncaught timer error");
  console.log(`ok   trade glue: ${name}`);
}

await scenario("nearby swaps are bounded and unchanged tables cause no events", async () => {
  const p = player(), a = elf(), b = elf(30);
  const dimension = mock.dimension(), query = dimension.getEntities.bind(dimension);
  let queries = 0;
  dimension.getEntities = (q) => { queries++; return query(q); };
  await start();
  await mock.advance(110);
  assert.deepEqual(a.events, ["lothlorien:trade_guest_0"]);
  assert.deepEqual(b.events, []);
  assert.equal(queries, 11, "one bounded query per player every ten ticks");
  p.band = "friend"; p.rank = 2;
  await mock.advance(20);
  assert.deepEqual(a.events, ["lothlorien:trade_guest_0", "lothlorien:trade_friend_2"]);
});

await scenario("refusal wins over requests and repeats do not repeat feedback", async () => {
  const p = player(), e = elf(); p.request = "gardener";
  await start(); await mock.advance(10);
  p.band = "shunned"; await mock.advance(10);
  assert.equal(e.table, "none");
  assert.equal(click(p, e), true); assert.equal(chatCount(p, "trade.refused.shunned"), 0);
  await mock.advance(1);
  assert.equal(chatCount(p, "trade.refused.shunned"), 1);
  assert.equal(click(p, e), true); await mock.advance(1);
  assert.equal(chatCount(p, "trade.refused.shunned"), 1); assert.equal(requests.length, 0);
});

await scenario("a mismatching click swaps next tick and cancels its repeats", async () => {
  const p = player(), e = elf();
  await start();
  assert.equal(click(p, e), true); assert.equal(e.table, "none");
  await mock.advance(2);
  assert.equal(e.table, "guest_0"); assert.equal(chatCount(p, "trade.again"), 1);
  assert.equal(click(p, e), true); await mock.advance(8);
  assert.equal(click(p, e), false);
  assert.deepEqual(e.events, ["lothlorien:trade_guest_0"]);
});

await scenario("Trade grants one use with bounded repeats, across player wrappers", async () => {
  const p = player(), e = elf(); p.request = "gardener";
  await start();
  assert.equal(click(p, e), true); await mock.advance(1);
  assert.equal(requests.length, 1); assert.equal(requests[0].profession, "gardener");
  requests[0].resolve("trade"); await mock.advance(1);
  assert.equal(p.hasTag(PASS_TAG), true);
  // Event wrappers can differ while the engine player id stays the same.
  const wrapper = Object.create(p);
  assert.equal(click(wrapper, e), false);
  for (let i = 0; i < 4; i++) { await mock.advance(2); assert.equal(click(wrapper, e), false); }
  await mock.advance(2);
  assert.equal(p.hasTag(PASS_TAG), false, "held-click repeats did not renew usedAt");
  assert.equal(click(p, e), true); await mock.advance(1);
  assert.equal(requests.length, 2, "the next use returns to the request form");
});

await scenario("unused passes expire, and stale timers cannot remove a newer pass", async () => {
  const p = player(), a = elf(), b = elf(3, 1); p.request = "gardener";
  await start(); click(p, a); await mock.advance(1);
  requests[0].resolve("trade"); await mock.advance(1);
  assert.equal(p.hasTag(PASS_TAG), true);
  await mock.advance(100);
  p.request = "healer";
  assert.equal(click(p, b), true, "pass is bound to its elf"); await mock.advance(1);
  requests[1].resolve("trade"); await mock.advance(1);
  await mock.advance(100);
  assert.equal(p.hasTag(PASS_TAG), true, "the older pass timeout left the newer pass alone");
  await mock.advance(TRADE_PASS_TICKS - 100);
  assert.equal(p.hasTag(PASS_TAG), false);
});

await scenario("a mismatching table preserves the unused pass for the retry", async () => {
  const p = player(), e = elf(); p.request = "gardener";
  await start(); click(p, e); await mock.advance(1);
  requests[0].resolve("trade"); await mock.advance(1);
  e.table = "friend_3";
  assert.equal(click(p, e), true); await mock.advance(10);
  assert.equal(e.table, "guest_0"); assert.equal(p.hasTag(PASS_TAG), true);
  assert.equal(click(p, e), false);
});

await scenario("lead, name tag, Loremaster and wardens are untouched", async () => {
  const p = player(), e = elf(), lore = elf(2, 4), warden = mock.addEntity("lothlorien:elven_warden", { x: 2, y: 70, z: 0 });
  await start();
  for (const item of ["minecraft:lead", "minecraft:name_tag"]) assert.equal(click(p, e, item), false);
  assert.equal(click(p, lore), false); assert.equal(click(p, warden), false);
  await mock.advance(1); assert.equal(requests.length, 0); assert.equal(p.sent.length, 0);
});

await scenario("a trading player's pin survives a nearer player, ends on distance or timeout", async () => {
  const a = player(0), b = player(5), e = elf(1); b.band = "friend"; b.rank = 2;
  await start(); await mock.advance(10);
  assert.equal(e.table, "guest_0"); assert.equal(click(a, e), false);
  b.location.x = 1.5; await mock.advance(10);
  assert.equal(e.table, "guest_0");
  a.location.x = 20; await mock.advance(10);
  assert.equal(e.table, "friend_2");
  a.location.x = 0; e.table = "guest_0"; assert.equal(click(a, e), false);
  await mock.advance(PIN_TICKS);
  assert.equal(e.table, "friend_2", "pin expires even while its owner stays nearby");
});

await scenario("another player's mismatching click deliberately replaces a pin", async () => {
  const a = player(), b = player(4), e = elf(1); b.band = "friend";
  await start(); await mock.advance(10); assert.equal(click(a, e), false);
  assert.equal(click(b, e), true); await mock.advance(10);
  assert.equal(e.table, "friend_0"); assert.equal(chatCount(b, "trade.again"), 1);
});

await scenario("leave/rejoin rejects old form answers and queued clicks", async () => {
  const p = player(), e = elf(); p.request = "gardener";
  await start(); click(p, e); await mock.advance(1);
  mock.fire("playerLeave", { playerId: p.id });
  const rejoined = player(); rejoined.id = p.id; rejoined.request = "gardener";
  mock.players = [rejoined]; mock.fire("playerSpawn", { player: rejoined, initialSpawn: true });
  requests[0].resolve("trade"); await mock.advance(1);
  assert.equal(p.hasTag(PASS_TAG), false); assert.equal(rejoined.hasTag(PASS_TAG), false);
  assert.equal(click(rejoined, e), true);
  mock.fire("playerLeave", { playerId: rejoined.id }); await mock.advance(1);
  assert.equal(requests.length, 1, "callback queued before leave cannot open a form after leave");
});

await scenario("a pending form cannot grant trading after refusal, lost request or distance", async () => {
  const p = player(), e = elf(); p.request = "gardener";
  await start(); click(p, e); await mock.advance(1);
  p.band = "hated"; requests[0].resolve("trade"); await mock.advance(1);
  assert.equal(p.hasTag(PASS_TAG), false);
  p.band = "guest"; await mock.advance(10); click(p, e); await mock.advance(1);
  p.request = null; requests[1].resolve("trade"); await mock.advance(1);
  assert.equal(p.hasTag(PASS_TAG), false);
  p.request = "gardener"; await mock.advance(10); click(p, e); await mock.advance(1);
  p.location.x = 20; requests[2].resolve("trade"); await mock.advance(1);
  assert.equal(p.hasTag(PASS_TAG), false);
});

await scenario("initial spawn removes a persisted pass tag and debug wiring reports the table", async () => {
  const p = player(), e = elf(); p.addTag(PASS_TAG);
  const mod = await start();
  mock.fire("playerSpawn", { player: p, initialSpawn: true });
  assert.equal(p.hasTag(PASS_TAG), false); await mock.advance(10);
  assert.equal(mod.handleTradeEvent({ id: "other:event" }, p), false);
  assert.equal(mod.handleTradeEvent({ id: "lothlorien:trade" }, p), true);
  assert.equal(chatCount(p, "trade.debug"), 1); assert.equal(e.table, "guest_0");
});

// Keep the UI substitute local to this test. The actual Loremaster and renown code still runs.
const uiModule = `export class ActionFormData {
  constructor() { this.buttons = []; }
  title(value) { this.heading = value; return this; }
  body(value) { this.content = value; return this; }
  button(text, icon) { this.buttons.push({ text, icon }); return this; }
  show(player) { this.player = player; globalThis.__tradeUi.push(this); return new Promise((resolve) => { this.resolve = resolve; }); }
}`;
const uiUrl = `data:text/javascript,${encodeURIComponent(uiModule)}`;
register(`data:text/javascript,${encodeURIComponent(`export function resolve(specifier, context, nextResolve) {
  if (specifier === "@minecraft/server-ui") return { url: ${JSON.stringify(uiUrl)}, shortCircuit: true };
  return nextResolve(specifier, context);
}`)}`);
const { renownOf } = await import("../lothlorien_bp/scripts/renown_game.js");
const { harmonyOf } = await import("../lothlorien_bp/scripts/harmony_game.js");
async function requestFormSetup(ready = false) {
  globalThis.__tradeUi = [];
  const mod = await import(`../lothlorien_bp/scripts/loremaster.js?trade_form=${++run}`);
  const p = player(), e = elf();
  p.getTags = () => [...p.tags];
  const inventory = { item: ready ? { typeId: "minecraft:bone_meal", amount: 16 } : undefined, size: 1,
    getItem() { return this.item; }, setItem(_slot, item) { this.item = item; } };
  p.components.inventory = { container: inventory };
  const state = renownOf(p); state.task = { kind: "request", id: "g_bonemeal", spots: [] };
  harmonyOf(p).harmony = 5;
  const openForm = () => mod.openTraderForm(p, e, "gardener");
  return { p, e, mod, state, inventory, openForm };
}
const buttonKeys = (form) => form.buttons.map((b) => b.text.translate);

await scenario("the actual trader form maps Trade and Hand over to the correct buttons", async () => {
  const { openForm, inventory, state } = await requestFormSetup();
  const trade = openForm(), form = globalThis.__tradeUi.at(-1);
  assert.deepEqual(buttonKeys(form), ["lothlorien.message.lore.btn.trade", "lothlorien.message.lore.btn.farewell"]);
  assert.equal(form.buttons[0].icon, "textures/items/emerald");
  form.resolve({ canceled: false, selection: 0 }); assert.equal(await trade, "trade");
  inventory.item = { typeId: "minecraft:bone_meal", amount: 16 };
  const handOver = openForm(), ready = globalThis.__tradeUi.at(-1);
  assert.deepEqual(buttonKeys(ready), ["lothlorien.message.lore.btn.handover", "lothlorien.message.lore.btn.trade", "lothlorien.message.lore.btn.farewell"]);
  ready.resolve({ canceled: false, selection: 0 }); assert.equal(await handOver, "handed");
  assert.equal(inventory.item, undefined); assert.equal(state.task, null); assert.equal(state.points, 2);
});

await scenario("the actual form rejects a changed request and refused band when its answer arrives", async () => {
  const { openForm, state, p, inventory } = await requestFormSetup();
  const changed = openForm(); state.task = { kind: "request", id: "g_dew", spots: [] };
  globalThis.__tradeUi.at(-1).resolve({ canceled: false, selection: 0 });
  assert.equal(await changed, undefined, "a new request of the same profession does not inherit the old answer");
  state.task = { kind: "request", id: "g_bonemeal", spots: [] };
  const refused = openForm(); harmonyOf(p).harmony = -40;
  globalThis.__tradeUi.at(-1).resolve({ canceled: false, selection: 0 }); assert.equal(await refused, undefined);
  harmonyOf(p).harmony = 5; inventory.item = { typeId: "minecraft:bone_meal", amount: 16 };
  const missing = openForm(); inventory.item = undefined;
  globalThis.__tradeUi.at(-1).resolve({ canceled: false, selection: 0 }); assert.equal(await missing, undefined);
  assert.equal(state.points, 0); assert.equal(state.task.id, "g_bonemeal");
});

await scenario("an old form answer cannot unlock or replace a rejoined player's new form", async () => {
  const { openForm, mod, p } = await requestFormSetup(); mod.startLoremaster();
  const old = openForm(), oldForm = globalThis.__tradeUi.at(-1);
  mock.fire("playerLeave", { playerId: p.id });
  const current = openForm(), newForm = globalThis.__tradeUi.at(-1);
  oldForm.resolve({ canceled: false, selection: 0 }); assert.equal(await old, undefined);
  const shown = globalThis.__tradeUi.length;
  assert.equal(await openForm(), undefined); assert.equal(globalThis.__tradeUi.length, shown, "the new dialog stays guarded");
  newForm.resolve({ canceled: false, selection: 0 }); assert.equal(await current, "trade");
});
delete globalThis.__tradeUi;
