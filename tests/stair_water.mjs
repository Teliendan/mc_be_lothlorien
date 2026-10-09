import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Independent geometry oracle: each stair consists of eight half-block voxels.
// A face stops outgoing water only when all four boundary voxels are occupied.
function solidFaces(components) {
  const boxes = components['minecraft:collision_box'];
  const angle = (components['minecraft:transformation']?.rotation?.[1] ?? 0) * Math.PI / 180;
  const cos = Math.round(Math.cos(angle)), sin = Math.round(Math.sin(angle));
  const cells = [];
  for (const x of [-4, 4]) for (const y of [4, 12]) for (const z of [-4, 4]) {
    // Inverse world-to-collider rotation, from the established Bedrock Y rotation.
    const point = [x * cos - z * sin, y, x * sin + z * cos];
    const solid = boxes.some(({ origin, size }) => point.every((v, a) => v > origin[a] && v < origin[a] + size[a]));
    cells.push({ x, y, z, solid });
  }
  const faces = { down: ['y', 4], up: ['y', 12], north: ['z', -4], south: ['z', 4], west: ['x', -4], east: ['x', 4] };
  return Object.entries(faces).filter(([, [axis, value]]) => cells.filter(c => c[axis] === value).every(c => c.solid))
    .map(([face]) => face).sort();
}

const evaluate = (condition, states) => Function(`return (${condition.replace(
  /(?:q|query)\.block_state\('([^']+)'\)/g, (_, state) => JSON.stringify(states[state]))});`)();

function checkStairs(body) {
  let checked = 0;
  for (const half of ['bottom', 'top']) for (const facing of ['north', 'east', 'south', 'west']) {
    for (const corner of ['none', 'outer_left', 'outer_right', 'inner_left', 'inner_right']) {
      const states = { 'minecraft:vertical_half': half, 'minecraft:cardinal_direction': facing, 'minecraft:corner': corner };
      const matches = body.permutations.filter(p => evaluate(p.condition, states));
      const context = `${body.description.identifier} ${half} ${facing} ${corner}`;
      assert.equal(matches.length, 1, `${context}: exactly one shape policy`);
      const components = { ...body.components, ...matches[0].components };
      const rule = components['minecraft:liquid_detection'].detection_rules.find(r => r.liquid_type === 'water');
      assert.equal(rule.can_contain_liquid, true, `${context}: bucket waterlogging`);
      assert.equal(rule.on_liquid_touches, 'blocking', `${context}: incoming flow stays blocked`);
      assert.deepEqual([...rule.stops_liquid_flowing_from_direction].sort(), solidFaces(components),
        `${context}: outgoing water must match the rotated solid faces`);
      checked++;
    }
  }
  return checked;
}

let checked = 0;
for (const name of ['mallorn_stairs', 'mallorn_heartwood_stairs']) {
  const body = JSON.parse(readFileSync(new URL(`../lothlorien_bp/blocks/${name}.json`, import.meta.url), 'utf8'))['minecraft:block'];
  checked += checkStairs(body);
  // Demonstrate that this oracle catches a leak and a rotation mistake.
  const broken = structuredClone(body);
  broken.permutations[0].components['minecraft:liquid_detection'].detection_rules[0].stops_liquid_flowing_from_direction = [];
  assert.throws(() => checkStairs(broken), /rotated solid faces/);
  const rotated = structuredClone(body);
  rotated.permutations[1].components['minecraft:liquid_detection'].detection_rules[0].stops_liquid_flowing_from_direction = ['down', 'north'];
  assert.throws(() => checkStairs(rotated), /rotated solid faces/);
}
console.log(`stair water: ${checked} shape/half/facing cases match collision geometry; broken leak/rotation fixtures rejected`);
