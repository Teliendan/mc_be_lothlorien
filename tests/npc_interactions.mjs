// Check the authored NPC event graph and native-use handoff, not native AI/physics.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nativeElfUse } from "../lothlorien_bp/scripts/elf_native_use.js";

const entity = name => JSON.parse(readFileSync(new URL(`../lothlorien_bp/entities/${name}.json`, import.meta.url)))["minecraft:entity"];
const warden = entity("elven_warden"), elf = entity("elf");
let count = 0;
function test(name, body) { body(); count++; console.log(`ok   NPC interactions: ${name}`); }

// Resolve only the declared group/sequence/home responses used by this lifecycle.
// Saving groups below tests authored retained state; it is not an engine reload test.
function actor(initial = []) {
  const groups = new Set(initial), state = { homeAt: null, at: "original" };
  function response(r) {
    if (r.sequence) { for (const step of r.sequence) response(step); return; }
    for (const group of r.remove?.component_groups ?? []) groups.delete(group);
    for (const group of r.add?.component_groups ?? []) groups.add(group);
    if (r.set_home_position) state.homeAt = state.at;
  }
  return { groups, state, event: name => response(warden.events[name]), components() {
    return Object.assign({}, warden.components, ...[...groups].map(group => warden.component_groups[group]));
  } };
}

test("native callbacks retain wild and village guards freely while led, then give each its new home", () => {
  const leash = warden.components["minecraft:leashable"];
  assert.equal(leash.can_be_cut, true); assert.equal(leash.can_be_stolen, false);
  assert.deepEqual(warden.components["minecraft:leashable_to"], {});
  assert.equal(leash.on_leash.target, "self"); assert.equal(leash.on_unleash.target, "self");
  for (const initial of [[], ["lothlorien:village_warden"]]) {
    const a = actor(initial);
    assert.equal(Boolean(a.components()["minecraft:persistent"]), initial.length > 0);
    for (const destination of ["new clearing", "another clearing"]) {
      a.event(leash.on_leash.event);
      let c = a.components();
      assert.ok(c["minecraft:persistent"], "permanent as soon as deliberately led");
      assert.equal(c["minecraft:home"].restriction_radius, undefined);
      assert.equal(c["minecraft:behavior.move_towards_home_restriction"], undefined);
      assert.equal(c["minecraft:behavior.ranged_attack"], warden.components["minecraft:behavior.ranged_attack"]);
      const saved = actor([...a.groups]);
      assert.ok(saved.components()["minecraft:persistent"], "the authored held state is persistent too");
      a.state.at = destination; a.event(leash.on_unleash.event); c = a.components();
      assert.ok(c["minecraft:persistent"]);
      assert.equal(c["minecraft:home"].restriction_radius, 20);
      assert.ok(c["minecraft:behavior.move_towards_home_restriction"]);
      assert.equal(a.state.homeAt, destination);
      assert.deepEqual([...a.groups], ["lothlorien:village_warden"]);
    }
  }
});

test("elf native-use gate leaves unattached shears available for normal dialog", () => {
  for (const led of [false, true]) {
    const target = { getComponent: id => id === "minecraft:leashable" ? { isLeashed: led } : undefined };
    for (const id of ["minecraft:lead", "minecraft:name_tag"]) assert.equal(nativeElfUse(target, { typeId: id }), true);
    assert.equal(nativeElfUse(target, { typeId: "minecraft:shears" }), led);
    assert.equal(nativeElfUse(target, { typeId: "minecraft:emerald" }), false);
    assert.equal(nativeElfUse(target, undefined), false);
  }
});

test("all profession prompt filters agree with native leash-cut eligibility", () => {
  for (const profession of ["gardener", "healer", "woodwright", "lamplighter", "loremaster"]) {
    const filters = elf.component_groups[`lothlorien:${profession}`]["minecraft:interact"].interactions[0].on_interact.filters.all_of;
    const cut = filters.find(f => f.none_of).none_of.find(f => f.all_of);
    assert.deepEqual(cut, { all_of: [
      { test: "has_equipment", domain: "hand", subject: "other", value: "minecraft:shears" },
      { test: "is_leashed", subject: "self", value: true },
    ] }, profession);
  }
});

test("civilian target classification keeps custom identity and excludes golem hostility", () => {
  assert.deepEqual(elf.components["minecraft:type_family"].family, ["lothlorien_elf", "wandering_trader", "mob"]);
  assert.deepEqual(warden.components["minecraft:type_family"].family, ["lothlorien_warden", "irongolem", "mob"]);
  for (const key of ["minecraft:dweller", "minecraft:transformation", "minecraft:breedable", "minecraft:inventory"]) {
    assert.equal(elf.components[key], undefined);
    assert.ok(Object.values(elf.component_groups).every(group => !group[key]));
  }
});

console.log(`all ${count} NPC interaction scenarios passed (offline only)`);
