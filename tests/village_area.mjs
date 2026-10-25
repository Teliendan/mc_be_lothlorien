// Exercise first approach, failed planning and reload through the actual event/Harmony wiring.
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";
register(new URL("../../../.claude/skills/bedrock-scripting/scripts/mock_loader.mjs", import.meta.url));
const { __mock: mock, world } = await import("@minecraft/server");
const { inVillageArea, rememberVillageArea, VILLAGE_AREAS } = await import("../lothlorien_bp/scripts/village_area.js");
const { VILLAGE_PLANS, parseDone } = await import("../lothlorien_bp/scripts/village_planner.js");
const src = new URL("../lothlorien_bp/scripts/", import.meta.url);
const reset = () => { mock.reset(); mock.dimension().heightRange = { min: -64, max: 320 }; };
const area = (x, z) => inVillageArea(mock.dimension(), { x, y: 65, z });
const warn = console.warn;
const logs = [];
console.warn = (...args) => logs.push(args.join(" "));
try {
  // Only the outermost piece has loaded; the rest is still waiting for a ticking area.
  reset(); mock.tickingAreaDelay = 700;
  mock.setBlocks((x, y, z) => y === 79 && x >= -107 && x <= -97 && z >= 45 && z <= 55 ? "lothlorien:mallorn_planks" : "minecraft:air");
  await import(new URL("loop_marker.js?approach", src));
  const marker = mock.addEntity("lothlorien:loop_marker", { x: -100.5, y: 80, z: 50.5 });
  const player = mock.addEntity("minecraft:player", { x: -105, y: 65, z: 50 });
  const bars = [];
  player.onScreenDisplay = { setActionBar: (text) => bars.push(text) };
  player.sendMessage = () => {};
  player.setDynamicProperty("lothlorien:harmony", '{"harmony":10,"timer":0}');
  mock.players.push(player);
  const inside = inVillageArea;
  const harmony = await import(new URL("harmony_game.js?approach", src));
  harmony.startHarmony(inside, "debug");
  assert.equal(inside(player.dimension, player.location), false);
  mock.fire("entityLoad", { entity: marker });
  assert.equal(inside(player.dimension, player.location), true, "first marker establishes village territory before queued planning starts");
  assert.equal(world.getDynamicProperty(VILLAGE_PLANS), undefined, "recognition does not mark repairs complete");
  await mock.advance(20);
  assert.equal(bars.at(-1).rawtext[1].translate, "lothlorien.message.status.friend", "existing Friend badge appears on its normal refresh outside the forest biome");
  assert.equal(inside(mock.dimension("minecraft:nether"), player.location), false);
  assert.equal(area(-200, 50), false, "unrelated outside terrain stays outside");
  assert.equal(area(-125, 50), false, "loading padding without village blocks stays outside");
  const writes = mock.propWrites.length;
  mock.fire("entityLoad", { entity: marker });
  assert.equal(mock.propWrites.length, writes, "duplicate loads do not rewrite territory");
  await mock.advance(600);
  assert.ok(logs.some((line) => line.includes("gave up:") && line.includes("timed out")));
  assert.equal(world.getDynamicProperty(VILLAGE_PLANS), undefined);
  assert.equal(inside(player.dimension, player.location), true, "a planner timeout cannot remove territory");
  assert.equal(bars.at(-1).rawtext[1].translate, "lothlorien.message.status.friend");
  const saved = world.getDynamicProperty(VILLAGE_AREAS);
  reset(); world.setDynamicProperty(VILLAGE_AREAS, saved);
  mock.setBlocks((x, y, z) => x === -105 && y === 79 && z === 50 ? "lothlorien:mallorn_planks" : "minecraft:air");
  const reloaded = await import(new URL("village_area.js?reload", src));
  assert.equal(reloaded.inVillageArea(mock.dimension(), { x: -105, y: 65, z: 50 }), true, "territory survives reload even without a successful plan");
  console.log("ok   village area: partial outside approach, Friend refresh, planning timeout and reload");

  reset();
  mock.setBlocks((x, y, z) => x === 5 && y === 79 && z === 5 ? "lothlorien:mallorn_slab" : "minecraft:air");
  await import(new URL("loop_marker.js?spawn", src));
  mock.fire("entitySpawn", { entity: mock.addEntity("lothlorien:loop_marker", { x: 5, y: 80, z: 5 }) });
  assert.equal(area(5, 5), true, "fresh worldgen recognizes the village too");
  const full = { x0: -100, x1: 100, z0: -100, z1: 100 };
  rememberVillageArea(full);
  assert.deepEqual(parseDone(world.getDynamicProperty(VILLAGE_AREAS)), [full], "full discovery replaces marker-local records");
  assert.equal(world.getDynamicProperty(VILLAGE_PLANS), undefined);
  reset();
  world.setDynamicProperty(VILLAGE_PLANS, JSON.stringify([full]));
  mock.setBlocks((x, y, z) => x === -90 && y === 79 && z === 90 ? "lothlorien:mallorn_heartwood_planks" : "minecraft:air");
  assert.equal(area(-90, 90), true, "existing completed villages remain recognized without migration");
  assert.equal(area(-88, 90), true, "two-block fringe beside the village deck counts");
  assert.equal(area(-87, 90), false, "beyond the fringe stays outside despite the old loading rectangle");
  assert.equal(area(90, -90), false, "empty corners of an existing village box stay outside");
  mock.setBlocks((x, y, z) => x === 0 && y === 79 && z === 0 ? "lothlorien:mallorn_log" : "minecraft:air");
  assert.equal(area(0, 0), false, "a natural Mallorn tree alone does not extend village territory");
  for (const id of ["mallorn_planks", "mallorn_heartwood_planks", "mallorn_slab", "mallorn_heartwood_slab", "mallorn_double_slab", "mallorn_heartwood_double_slab", "mallorn_stairs", "mallorn_heartwood_stairs"]) {
    mock.setBlocks((x, y, z) => x === 0 && y === 79 && z === 0 ? `lothlorien:${id}` : "minecraft:air");
    assert.equal(area(0, 0), true, `${id} counts above the ground-level player`);
  }
  let queries = 0;
  const dimension = mock.dimension(), getBlocks = dimension.getBlocks.bind(dimension);
  dimension.getBlocks = (volume, filter, allowUnloadedChunks) => {
    queries++;
    assert.equal(volume.to.x - volume.from.x, 4);
    assert.equal(volume.to.z - volume.from.z, 4);
    assert.equal(allowUnloadedChunks, true, "first approach tolerates unloaded neighbouring chunks");
    return getBlocks(volume, filter, allowUnloadedChunks);
  };
  assert.equal(area(0, 0), true);
  assert.equal(queries, 1, "one bounded native filtered query inside a village search box");
  assert.equal(area(500, 500), false);
  assert.equal(queries, 1, "outside search boxes requires no block query");
  mock.propWrites.length = 0;
  rememberVillageArea({ x0: 0, x1: 10, z0: 0, z1: 10 });
  assert.equal(mock.propWrites.length, 0, "legacy completed records need no duplicate writes");
  assert.deepEqual(mock.errors, []);
  const main = readFileSync(new URL("main.js", src), "utf8");
  assert.match(main, /import \{ inVillageArea \} from "\.\/village_area.js"/);
  assert.ok(main.includes("startHarmony(inBiome, DEBUG_TAG)") && main.includes("startRenown(inBiome)"));
  console.log("ok   village area: worldgen, discovery consolidation, tight footprints and existing-world compatibility");
} finally {
  console.warn = warn;
}
