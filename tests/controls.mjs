// Production control handlers with a finite clock; native physics/events still require Minecraft.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rules from "../lothlorien_bp/scripts/control_rules.js";
const read = file => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const source = readFileSync(new URL("../lothlorien_bp/scripts/blocks.js", import.meta.url), "utf8")
  .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__controls;");
const deferredSource = readFileSync(new URL("../lothlorien_bp/scripts/deferred_use.js", import.meta.url), "utf8")
  .replace(/^import \{([^}]+)\} from "[^"]+";/gm, "const {$1} = globalThis.__controls;");
let serial = 0;
const P = (id, states = {}) => ({ type: { id }, getState: k => states[k],
  withState: (k, v) => P(id, { ...states, [k]: v }) });
async function scenario(name, body) {
  const handlers = new Map(), components = new Map(), blocks = new Map(), timers = [], sounds = [];
  let tick = 0, candidates = [], query;
  const key = p => `${p.x},${p.y},${p.z}`;
  const dimension = { id: "overworld", getBlock: p => blocks.get(key(p)),
    getEntities(q) { query = q; return candidates; }, playSound: (...args) => sounds.push(args), runCommand() {} };
  function block(id, location = { x: 0, y: 64, z: 0 }, states = {}) {
    const b = { typeId: id, location, dimension, permutation: P(id, states),
      setPermutation(p) { this.permutation = p; }, center: () => ({ x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 }),
      getParts() { return this.parts || [this]; }, getRedstonePower: () => 0 };
    blocks.set(key(location), b); return b;
  }
  const signal = phase => new Proxy({}, { get: (_, name) => ({ subscribe(fn) {
    const k = `${phase}:${name}`; if (!handlers.has(k)) handlers.set(k, []); handlers.get(k).push(fn);
  } }) });
  const system = { get currentTick() { return tick; }, beforeEvents: signal("system"),
    runTimeout: (fn, ticks) => timers.push({ fn, at: tick + ticks }), run: fn => timers.push({ fn, at: tick + 1 }) };
  globalThis.__controls = { EquipmentSlot: { Mainhand: "Mainhand" } };
  const deferred = await import(`data:text/javascript;base64,${Buffer.from(deferredSource).toString("base64")}#${++serial}`);
  globalThis.__controls = { ...rules, ...deferred, system, world: { afterEvents: signal("after"), beforeEvents: signal("before") },
    BlockPermutation: { resolve: P }, EquipmentSlot: { Mainhand: "Mainhand" }, GameMode: { Creative: "Creative", Spectator: "Spectator" } };
  await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${++serial}`);
  delete globalThis.__controls;
  const fire = (name, event, phase = "after") => { for (const fn of handlers.get(`${phase}:${name}`) || []) fn(event); };
  fire("startup", { blockComponentRegistry: { registerCustomComponent: (id, c) => components.set(id, c) } }, "system");
  const advance = n => { for (let i = 0; i < n; i++) { tick++; for (const timer of [...timers]) if (timer.at <= tick) {
    timers.splice(timers.indexOf(timer), 1); timer.fn();
  } } };
  await body({ dimension, block, fire, advance, components, timers, sounds, candidates: v => { candidates = v; }, query: () => query });
  console.log(`ok   controls: ${name}`);
}

await scenario("button presses once and native release handler is powered-only, with no JS release timeout", e => {
  const press = e.components.get("lothlorien:button"), release = e.components.get("lothlorien:button_release");
  assert.equal(press.onTick, undefined);
  for (const wood of ["mallorn", "mallorn_heartwood"]) {
    const b = e.block(`lothlorien:${wood}_button`, undefined, { "lothlorien:powered": false });
    press.onPlayerInteract({ block: b, dimension: e.dimension });
    assert.equal(b.permutation.getState("lothlorien:powered"), true);
    const n = e.sounds.length;
    press.onPlayerInteract({ block: b, dimension: e.dimension });
    assert.equal(e.sounds.length, n, "repeat click neither retriggers sound nor changes the pulse");
    assert.equal(e.timers.length, 0);
    e.advance(30); release.onTick({ block: b, dimension: e.dimension });
    assert.equal(b.permutation.getState("lothlorien:powered"), false);
    const data = read(`../lothlorien_bp/blocks/${wood}_button.json`)["minecraft:block"];
    assert.equal(data.components["minecraft:tick"], undefined);
    const active = data.permutations.find(p => p.condition === "q.block_state('lothlorien:powered')").components;
    assert.deepEqual(active["minecraft:tick"], { interval_range: [30, 30], looping: true });
    assert.ok(active["lothlorien:button_release"]);
  }
});

await scenario("plate uses collision bounds, queries without spectators and holds through an early empty callback", e => {
  const tick = e.components.get("lothlorien:pressure_plate").onTick;
  const b = e.block("lothlorien:mallorn_pressure_plate", undefined, { "lothlorien:powered": false });
  const entity = (center, extent, extra = {}) => ({ typeId: "minecraft:item", getAABB: () => ({ center, extent }), ...extra });
  const side = entity({ x: 1.1, y: 64.1, z: 0.5 }, { x: 0.05, y: 0.1, z: 0.05 });
  const flying = entity({ x: 0.5, y: 64.7, z: 0.5 }, { x: 0.1, y: 0.1, z: 0.1 });
  e.candidates([side, flying]);
  tick({ block: b, dimension: e.dimension });
  assert.equal(b.permutation.getState("lothlorien:powered"), false);
  // Origin outside the plate is fine if the engine's local query returns this intersecting AABB.
  e.candidates([entity({ x: 1.1, y: 64.9, z: 0.5 }, { x: 0.3, y: 0.9, z: 0.3 })]);
  tick({ block: b, dimension: e.dimension });
  assert.equal(b.permutation.getState("lothlorien:powered"), true);
  assert.deepEqual(e.query(), { location: b.location, volume: { x: 1, y: 0.25, z: 1 }, excludeGameModes: ["Spectator"] });
  e.candidates([]); e.advance(4); tick({ block: b, dimension: e.dimension });
  assert.equal(b.permutation.getState("lothlorien:powered"), true, "queued old four-tick callback cannot cut the pulse short");
  e.advance(15); tick({ block: b, dimension: e.dimension });
  assert.equal(b.permutation.getState("lothlorien:powered"), true);
  e.advance(1); tick({ block: b, dimension: e.dimension });
  assert.equal(b.permutation.getState("lothlorien:powered"), false);
  assert.equal(e.timers.length, 0);
});

await scenario("gates open away from either side, close without turning, and redstone preserves facing", e => {
  const toggle = e.components.get("lothlorien:toggleable").onPlayerInteract;
  const params = { block_state: "lothlorien:open", enable_sound: "open", disable_sound: "close" };
  for (const wood of ["mallorn", "mallorn_heartwood"]) for (const [facing, vector] of Object.entries(rules.GATE_OPEN_VECTOR)) {
    const b = e.block(`lothlorien:${wood}_fence_gate`, undefined,
      { "lothlorien:open": false, "lothlorien:powered": false, "minecraft:cardinal_direction": facing });
    const center = b.center(), player = { location: { x: center.x + vector[0], y: 64, z: center.z + vector[1] } };
    toggle({ block: b, dimension: e.dimension, player }, { params });
    const changed = b.permutation.getState("minecraft:cardinal_direction");
    assert.notEqual(changed, facing);
    const v = rules.GATE_OPEN_VECTOR[changed];
    assert.ok((player.location.x - center.x) * v[0] + (player.location.z - center.z) * v[1] < 0);
    toggle({ block: b, dimension: e.dimension, player }, { params });
    assert.equal(b.permutation.getState("minecraft:cardinal_direction"), changed);
    e.components.get("lothlorien:redstone_toggle").onRedstoneUpdate({ block: b, dimension: e.dimension, powerLevel: 15 },
      { params: { ...params, powered_state: "lothlorien:powered", open_state: "lothlorien:open" } });
    assert.equal(b.permutation.getState("minecraft:cardinal_direction"), changed);
    assert.equal(b.permutation.getState("lothlorien:open"), true);
  }
});

await scenario("wall edits reconcile neighboring gates; unloaded borders preserve state", e => {
  const b = e.block("lothlorien:mallorn_fence_gate", undefined,
    { "minecraft:cardinal_direction": "north", "lothlorien:in_wall": false });
  const wall = e.block("minecraft:cobblestone_wall", { x: -1, y: 64, z: 0 });
  const air = e.block("minecraft:air", { x: 1, y: 64, z: 0 });
  e.fire("playerPlaceBlock", { block: wall, dimension: e.dimension });
  assert.equal(b.permutation.getState("lothlorien:in_wall"), true);
  wall.typeId = "minecraft:air";
  e.fire("playerBreakBlock", { block: wall, dimension: e.dimension });
  assert.equal(b.permutation.getState("lothlorien:in_wall"), false);
  wall.typeId = "minecraft:stone_brick_wall";
  e.components.get("lothlorien:gate_wall").onRandomTick({ block: b });
  assert.equal(b.permutation.getState("lothlorien:in_wall"), true);
  const read = e.dimension.getBlock;
  e.dimension.getBlock = p => p.x === 1 ? undefined : read(p);
  wall.typeId = "minecraft:air";
  e.components.get("lothlorien:gate_wall").onRandomTick({ block: b });
  assert.equal(b.permutation.getState("lothlorien:in_wall"), true, "absence of an unloaded neighbor is not proof of no wall");
  e.dimension.getBlock = read;
  assert.equal(e.timers.length, 0, "no piston or explosion work: the gate's random tick catches those");
});

await scenario("door pairing filters perpendicular neighbors and keeps the approved synchronized pair", e => {
  const id = "lothlorien:mallorn_door", states = { "minecraft:cardinal_direction": "north", "minecraft:multi_block_part": 0, "lothlorien:hinge_right": true, "lothlorien:open": false };
  const left = e.block(id, { x: -1, y: 64, z: 0 }, { ...states, "lothlorien:hinge_right": false });
  const b = e.block(id, undefined, states);
  const top = e.block(id, { x: 0, y: 65, z: 0 }, states); b.parts = [b, top];
  assert.equal(rules.pairedDoorHinge("north", id, left, undefined), true);
  assert.equal(rules.pairedDoorHinge("south", id, left, undefined), false);
  assert.equal(rules.pairedDoorHinge("north", id, undefined, left), false);
  assert.equal(rules.pairedDoorHinge("north", id, b, undefined), false, "left neighbor must present its handle toward the new door");
  const upper = { typeId: id, permutation: P(id, { ...states, "minecraft:multi_block_part": 1, "lothlorien:hinge_right": false }) };
  assert.equal(rules.pairedDoorHinge("north", id, upper, undefined), false, "upper half of a lower door cannot form a pair");
  assert.equal(rules.pairedDoorHinge("north", id, left, b), false, "ambiguous triple row retains the default rather than claiming a unique pair");
  e.components.get("lothlorien:door").onPlayerInteract({ block: b, dimension: e.dimension },
    { params: { block_state: "lothlorien:open", enable_sound: "open", disable_sound: "close" } });
  for (const part of [left, b, top]) assert.equal(part.permutation.getState("lothlorien:open"), true);
});

function effective(block, states) {
  let result = { ...block.components };
  for (const p of block.permutations || []) {
    const condition = p.condition.replace(/q\.block_state\('([^']+)'\)/g, (_, k) => JSON.stringify(states[k]));
    if (Function(`return (${condition})`)()) result = { ...result, ...p.components };
  }
  return result;
}
for (const wood of ["mallorn", "mallorn_heartwood"]) {
  const gate = read(`../lothlorien_bp/blocks/${wood}_fence_gate.json`)["minecraft:block"];
  for (const [facing, yaw] of [["north", 0], ["south", 180], ["east", 270], ["west", 90]]) {
    for (const open of [false, true]) for (const inWall of [false, true]) {
      const c = effective(gate, { "minecraft:cardinal_direction": facing, "lothlorien:open": open, "lothlorien:in_wall": inWall });
      assert.deepEqual(c["minecraft:transformation"].rotation, [0, yaw, 0]);
      const angle = yaw * Math.PI / 180;
      assert.deepEqual([Math.round(-Math.sin(angle)) || 0, Math.round(-Math.cos(angle)) || 0], rules.GATE_OPEN_VECTOR[facing],
        "actual transformed north-facing model must swing in the scripted facing direction");
      assert.equal(c["minecraft:transformation"].translation, undefined, "model lowering must not translate the collision box");
      const dy = (c["minecraft:transformation"].translation?.[1] || 0) * 16;
      if (open) assert.equal(c["minecraft:collision_box"], false);
      else {
        const box = c["minecraft:collision_box"];
        assert.equal(box.origin[1] + dy, 0, "lowering does not move the barrier underground");
        assert.equal(box.origin[1] + dy + box.size[1], 24, "lowered closed gate retains 1.5-block collision");
      }
      assert.equal(c["minecraft:selection_box"].origin[1] + dy, 0);
      assert.equal(c["minecraft:selection_box"].size[1], inWall ? 13 : 16);
      assert.equal(c["minecraft:connection_rule"].accepts_connections_from, "only_fences", "do not silently connect glass/panes");
    }
  }
  for (const pose of ["closed", "open"]) {
    const ordinary = read(`../lothlorien_rp/models/blocks/mallorn_fence_gate_${pose}.geo.json`)["minecraft:geometry"][0];
    const lowered = read(`../lothlorien_rp/models/blocks/mallorn_fence_gate_${pose}_in_wall.geo.json`)["minecraft:geometry"][0];
    assert.equal(lowered.description.identifier, ordinary.description.identifier + "_in_wall");
    assert.equal(lowered.item_display_transforms, undefined, "accepted ordinary icon remains authoritative");
    assert.deepEqual(lowered.bones.map(b => b.name), ordinary.bones.map(b => b.name));
    for (let i = 0; i < ordinary.bones.length; i++) {
      const a = ordinary.bones[i], b = lowered.bones[i];
      assert.deepEqual(b.pivot, [a.pivot[0], a.pivot[1] - 3, a.pivot[2]]);
      assert.equal(a.cubes.length, b.cubes.length);
      for (let j = 0; j < a.cubes.length; j++) {
        const cube = structuredClone(a.cubes[j]);
        cube.origin[1] -= 3;
        if (cube.pivot) cube.pivot[1] -= 3;
        assert.deepEqual(b.cubes[j], cube, "only geometry height/pivots change; preserve UV, rotation and detail");
      }
    }
  }
  const plate = read(`../lothlorien_bp/blocks/${wood}_pressure_plate.json`)["minecraft:block"];
  for (const pressed of [false, true]) assert.deepEqual(effective(plate, { "lothlorien:powered": pressed })["minecraft:tick"].interval_range,
    pressed ? [20, 20] : [4, 4]);
}
console.log("ok   controls: all gate poses preserve effective collision and both plate poll policies");
