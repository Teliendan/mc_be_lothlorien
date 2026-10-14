// Exercise the actual swan controller across first visibility and repeated drops.
// This is an offline state-machine regression, not a Bedrock runtime emulator.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const entity = read("../lothlorien_bp/entities/swan.json")["minecraft:entity"];
const client = read("../lothlorien_rp/entity/swan.entity.json")["minecraft:client_entity"].description;
const controller = read("../lothlorien_rp/animation_controllers/swan.animation_controllers.json")
  .animation_controllers[client.animations.shedding];
const animation = read("../lothlorien_rp/animations/swan.animation.json").animations[client.animations.shake];
const spawn = entity.component_groups["lothlorien:adult"]["minecraft:spawn_entity"].entities;
assert.equal(spawn.spawn_item, "minecraft:feather");
assert.equal(spawn.num_to_spawn, 1);
assert.equal(spawn.single_use, false);
assert.deepEqual([spawn.min_wait_time, spawn.max_wait_time], [60, 300]);
assert.equal(entity.component_groups["lothlorien:baby"]["minecraft:spawn_entity"], undefined);
assert.equal(entity.components["minecraft:spawn_entity"], undefined);
assert.ok(client.scripts.animate.includes("shedding"));
assert.equal(entity.description.properties["lothlorien:shed_phase"].client_sync, true);
assert.equal(spawn.spawn_item_event.target, "self");
const dropEvent = entity.events[spawn.spawn_item_event.event];
assert.ok(dropEvent, "the native item spawn must fire the animation signal");
// Development diagnostics must not ship in the production entity.
assert.ok(!Object.keys(entity.component_groups).some(name => /test|debug/.test(name)));
assert.ok(!Object.keys(entity.events).some(name => /test|debug/.test(name)));
assert.deepEqual(entity.events["lothlorien:spawn_cygnet"].remove.component_groups, ["lothlorien:adult"]);
// Death drops and the cooking path must agree; keep the existing feather pool.
const loot = read("../lothlorien_bp/loot_tables/entities/swan.json").pools;
assert.equal(loot[0].entries[0].name, "minecraft:feather");
const meat = loot.flatMap(pool => pool.entries).find(entry => entry.name === "lothlorien:swan_meat_raw");
assert.ok(meat, "adult swans must actually drop their new meat");
assert.equal(meat.functions.find(f => f.function === "set_count").count, 1);
assert.ok(!meat.functions.some(f => f.function === "looting_enchant"), "owner requested exactly one meat");
assert.deepEqual(meat.functions.find(f => f.function === "furnace_smelt").conditions,
  [{ condition: "entity_properties", entity: "this", properties: { on_fire: true } }]);
const recipe = read("../lothlorien_bp/recipes/furnace_swan_meat.json")["minecraft:recipe_furnace"];
assert.equal(recipe.input, meat.name);
assert.equal(recipe.output, "lothlorien:swan_meat_cooked");
assert.deepEqual(recipe.tags, ["furnace", "smoker", "campfire"]);
for (const kind of ["raw", "cooked"]) {
  const item = read(`../lothlorien_bp/items/swan_meat_${kind}.json`)["minecraft:item"];
  assert.equal(item.description.identifier, kind === "raw" ? recipe.input : recipe.output);
  assert.ok(item.components["minecraft:food"].nutrition > 0);
}
assert.equal(animation.loop || false, false);
assert.ok(animation.animation_length > 0 && animation.animation_length < 2);
const geometry = read("../lothlorien_rp/models/entity/swan.geo.json")["minecraft:geometry"][0];
for (const [bone, channels] of Object.entries(animation.bones)) {
  assert.ok(geometry.bones.some(b => b.name === bone));
  for (const keys of Object.values(channels)) {
    const ordered = Object.entries(keys).sort((a, b) => Number(a[0]) - Number(b[0]));
    const vector = value => value.post || value;
    assert.deepEqual(vector(ordered[0][1]), [0, 0, 0], `${bone} starts at rest`);
    assert.deepEqual(vector(ordered.at(-1)[1]), [0, 0, 0], `${bone} settles back to rest`);
  }
}

for (const initial of [false, true]) {
  const properties = new Map([["lothlorien:shed_phase", initial]]);
  const query = { property: key => properties.get(key), all_animations_finished: false };
  const evaluate = expression => Function("query", `return (${expression});`)(query);
  let state = controller.initial_state, shakes = 0;
  function update() {
    const transition = (controller.states[state].transitions || [])
      .find(t => evaluate(Object.values(t)[0]));
    if (transition) {
      state = Object.keys(transition)[0];
      if (controller.states[state].animations?.includes("shake")) shakes++;
    }
  }
  update(); update();
  assert.equal(shakes, 0, "loading either saved phase must not replay a historical feather drop");
  for (let n = 1; n <= 6; n++) {
    query.all_animations_finished = false;
    for (const [key, expression] of Object.entries(dropEvent.set_property))
      properties.set(key, evaluate(expression));
    update();
    assert.equal(shakes, n, "both edges of the drop signal must start exactly one shake");
    update();
    assert.equal(shakes, n, "the animation stays active until it finishes");
    query.all_animations_finished = true;
    update(); update();
    assert.equal(shakes, n, "a completed shake must not loop or trigger another drop");
    assert.ok(!controller.states[state].animations?.includes("shake"));
  }
}
console.log("ok   swan shedding: native adult drops, no runtime diagnostics, meat/cooking, repeated one-shot shakes, neutral endpoints");
