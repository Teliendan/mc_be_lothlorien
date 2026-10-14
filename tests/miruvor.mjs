// Production item callbacks; native animation/blocking/display still need Minecraft.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const components = JSON.parse(readFileSync(new URL("../lothlorien_bp/items/miruvor.json", import.meta.url), "utf8"))["minecraft:item"].components;
const cooldown = components["minecraft:cooldown"];
assert.equal(cooldown.duration, 0, "starting or cancelling a drink must not start the native cooldown");
assert.equal(components["minecraft:use_modifiers"].use_duration, 2);

const callbacks = new Map();
globalThis.__miruvor = {
  EquipmentSlot: { Mainhand: "Mainhand" },
  system: { beforeEvents: { startup: { subscribe(fn) {
    fn({ itemComponentRegistry: { registerCustomComponent: (id, handlers) => callbacks.set(id, handlers) } });
  } } } },
};
const source = readFileSync(new URL("../lothlorien_bp/scripts/athelas.js", import.meta.url), "utf8")
  .replace(/^import \{([^}]+)\} from "@minecraft\/server";/m, "const {$1} = globalThis.__miruvor;");
await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
delete globalThis.__miruvor;

function player(damage = 0) {
  const durability = { damage, maxDurability: 4 }, effects = [], calls = [];
  let held = { typeId: "lothlorien:miruvor", getComponent: () => durability };
  const p = {
    effects, calls, durability, cooldowns: new Map(),
    get held() { return held; },
    getComponent(id) {
      assert.equal(id, "equippable");
      return { getEquipmentSlot(slot) {
        assert.equal(slot, "Mainhand");
        return { getItem: () => held, setItem(item) { held = item; calls.push("sip"); } };
      } };
    },
    addEffect(...args) { effects.push(args); calls.push("effect"); },
    removeEffect(id) { assert.equal(id, "poison"); calls.push("cure"); },
    playSound(id) { assert.equal(id, "random.break"); },
    startItemCooldown(category, ticks) { p.cooldowns.set(category, ticks); calls.push("cooldown"); },
  };
  return p;
}
const miruvor = callbacks.get("lothlorien:miruvor");
const event = p => ({ source: p, itemStack: p.held });
const p = player();
// Attempts that never complete must leave effects, sips and cooldown untouched.
for (let i = 0; i < 3; i++) {
  miruvor.onUse?.(event(p));
  assert.equal(p.cooldowns.size, 0);
  assert.equal(p.effects.length, 0);
  assert.equal(p.durability.damage, 0);
}
miruvor.onCompleteUse(event(p));
assert.deepEqual(p.effects, [
  ["instant_health", 1, { amplifier: 0, showParticles: true }],
  ["regeneration", 160, { amplifier: 1, showParticles: true }],
  ["speed", 600, { amplifier: 0, showParticles: true }],
]);
assert.equal(p.durability.damage, 1);
assert.equal(p.cooldowns.get(cooldown.category), 600, "a full 30 seconds begins at completion");
assert.deepEqual(p.calls, ["effect", "effect", "effect", "cure", "sip", "cooldown"]);
const other = player();
assert.equal(other.cooldowns.size, 0, "another player is unaffected");
const final = player(3);
miruvor.onCompleteUse(event(final));
assert.equal(final.held, undefined, "last sip removes the skin");
assert.equal(final.effects.length, 3);
assert.equal(final.cooldowns.get(cooldown.category), 600, "last sip also locks the category for replacement skins");
const failed = player();
failed.addEffect = () => { throw Error("entity gone"); };
miruvor.onCompleteUse(event(failed));
assert.equal(failed.cooldowns.size, 0, "an unsuccessful effect application must not start cooldown");
assert.equal(failed.durability.damage, 0);
callbacks.get("lothlorien:salve").onConsume(event(other));
assert.equal(other.effects.length, 1);
assert.equal(other.cooldowns.size, 0, "salve has no Miruvor cooldown");
console.log("ok   miruvor: cancelled attempts, completed effects/sip/cooldown, last sip, failure and salve");
