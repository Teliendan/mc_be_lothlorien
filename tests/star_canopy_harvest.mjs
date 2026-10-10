// Real gate service with a fake scheduler; no simulation of native engine loot.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStarCanopyHarvestHandler, STAR_CANOPY } from "../lothlorien_bp/scripts/star_canopy_harvest_service.js";

function scenario({ type = STAR_CANOPY, pickaxe = false, mode = "Survival", cancelled = false,
  emptyHand = false, state = {}, wearThrows = false } = {}) {
  let writable = false, current, queued = [], removals = [], wear = [], cleanup = [], warnings = [];
  const location = { x: 10, y: 80, z: 20 };
  const dimension = { getBlock(position) { assert.deepEqual(position, location); return current; } };
  function block(blockType = type, states = state) {
    return { typeId: blockType, dimension, location: { ...location },
      permutation: { getAllStates: () => ({ ...states }) },
      setType(value) { assert.ok(writable, "no world writes in before event"); removals.push(value); this.typeId = value; } };
  }
  current = block();
  const tool = emptyHand ? undefined : { hasTag: (tag) => pickaxe && tag === "minecraft:is_pickaxe", clone: () => ({ captured: true }) };
  const player = { getGameMode: () => mode, selectedSlotIndex: 4 };
  const event = { block: current, player, itemStack: tool, cancel: cancelled };
  const handler = createStarCanopyHarvestHandler({ schedule: (fn) => queued.push(fn),
    damageRejectedTool(...args) { assert.ok(writable); wear.push(args); if (wearThrows) throw Error("stale tool"); },
    onRemoved(...args) { cleanup.push(args); }, warn: (message) => warnings.push(message) });
  handler(event);
  assert.deepEqual(removals, [], "before callback only cancels/schedules");
  return { event, handler, player, queued, removals, wear, cleanup, warnings, dimension,
    setCurrent(value) { current = value; }, block,
    settle() { writable = true; for (const fn of queued.splice(0)) fn(); writable = false; } };
}

for (const options of [{ pickaxe: true }, { mode: "Creative" }, { mode: "Spectator" },
  { type: "minecraft:deepslate_tiles" }, { type: "lothlorien:mallorn_planks" }, { cancelled: true }]) {
  const s = scenario(options);
  assert.equal(s.event.cancel, options.cancelled ?? false, "allowed/native/unrelated route untouched");
  assert.equal(s.queued.length, 0);
  s.settle(); assert.equal(s.wear.length, 0); assert.equal(s.cleanup.length, 0);
}
for (const options of [{}, { emptyHand: true }, { mode: "Adventure" }, { state: { test: true } }]) {
  const s = scenario(options);
  assert.equal(s.event.cancel, true);
  assert.equal(s.queued.length, 1);
  s.settle();
  assert.deepEqual(s.removals, ["minecraft:air"]);
  assert.deepEqual(s.wear, [[s.player, 4, options.emptyHand ? undefined : { captured: true }]]);
  assert.deepEqual(s.cleanup, [[s.dimension, { x: 10, y: 80, z: 20 }]]);
  assert.deepEqual(s.warnings, []);
}
for (const replacement of ["unloaded", "different-type", "different-state"]) {
  const s = scenario();
  s.setCurrent(replacement === "unloaded" ? undefined : s.block(
    replacement === "different-type" ? "minecraft:stone" : STAR_CANOPY,
    replacement === "different-state" ? { altered: true } : {}));
  s.settle();
  assert.deepEqual(s.removals, []); assert.deepEqual(s.wear, []); assert.deepEqual(s.cleanup, []);
}
{
  const s = scenario();
  s.handler({ ...s.event, cancel: false }); // Two completed attempts before the next tick.
  assert.equal(s.queued.length, 1, "same-cell attempts share one deferred job");
  s.settle();
  assert.deepEqual(s.removals, ["minecraft:air"]);
  assert.equal(s.wear.length, 1, "second deferred attempt sees air and cannot charge another tool");
}
for (const change of ["logout", "creative", "spectator", "invalid-block", "replacement", "explosion"]) {
  const s = scenario();
  if (change === "logout") s.player.isValid = false;
  if (change === "creative") s.player.getGameMode = () => "Creative";
  if (change === "spectator") s.player.getGameMode = () => "Spectator";
  if (change === "invalid-block") s.event.block.isValid = false;
  if (change === "replacement" || change === "explosion") s.handler.invalidate({ block: s.event.block });
  s.settle();
  assert.deepEqual(s.removals, [], `${change}: stale job cannot remove a cell`);
  assert.deepEqual(s.wear, []);
  // A canceled job must retire its token, permitting a subsequent real attempt.
  s.player.isValid = true; s.player.getGameMode = () => "Survival";
  s.event.block.isValid = true;
  s.handler({ ...s.event, cancel: false });
  s.settle(); assert.deepEqual(s.removals, ["minecraft:air"]);
}
{
  const s = scenario({ wearThrows: true });
  s.settle();
  assert.equal(s.cleanup.length, 1, "support cleanup survives an expired inventory stack");
  assert.match(s.warnings[0], /deferred break: Error: stale tool/);
}

const table = JSON.parse(readFileSync(new URL("../lothlorien_bp/loot_tables/blocks/star_canopy.json", import.meta.url)));
assert.deepEqual(table, { pools: [{ rolls: 1, entries: [{ type: "item", name: STAR_CANOPY, functions: [
  { function: "set_count", count: 1 }, { function: "explosion_decay" },
] }] }] }, "ungated native table retains tool-less environmental and explosion contexts");
const body = JSON.parse(readFileSync(new URL("../lothlorien_bp/blocks/star_canopy.json", import.meta.url)))["minecraft:block"];
assert.equal(body.components["minecraft:loot"], "loot_tables/blocks/star_canopy.json");
const wrapper = readFileSync(new URL("../lothlorien_bp/scripts/star_canopy_harvest.js", import.meta.url), "utf8");
assert.match(wrapper, /world\.beforeEvents\.playerBreakBlock\.subscribe\(handler\)/);
assert.match(wrapper, /world\.afterEvents\.playerPlaceBlock\.subscribe\(handler\.invalidate\)/);
assert.match(wrapper, /world\.afterEvents\.blockExplode\.subscribe\(handler\.invalidate\)/);
assert.match(wrapper, /supportMotion\.invalidate/); assert.match(wrapper, /supportMotion\.resetAround/);
assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/blocks.js", import.meta.url), "utf8").includes('import "./star_canopy_harvest.js";'));
for (const file of ["configure_support.py", "make_star_canopy.py"])
  assert.ok(readFileSync(new URL(`../tools/${file}`, import.meta.url), "utf8").includes('"loot_tables/blocks/star_canopy.json"'), `${file}: preserve loot route`);
console.log("ok   star canopy harvest: native/allowed routes, guarded deferred wrong-tool removal, captured tool, duplicate attempts and support cleanup");
