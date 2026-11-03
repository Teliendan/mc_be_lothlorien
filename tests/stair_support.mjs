import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Owner decision 2026-11-04: "stair trick" (minecraft:support shape stair on a block with no stair
// states) gives no support; verified in game 1.26.60.5 on the supportprobe pack.
const dir = new URL('../lothlorien_bp/blocks/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'))['minecraft:block'];
const STAIR_TRICK = ['athelas', 'elanor', 'niphredil', 'golden_fern', 'mallorn_sapling', 'great_mallorn_sprout',
  'western_corn', 'deer_antler', 'elven_lantern', 'elven_lantern_heartwood', 'elven_chandelier', 'firefly_jar',
  'phial_light', 'mallorn_button', 'mallorn_heartwood_button', 'mallorn_pressure_plate',
  'mallorn_heartwood_pressure_plate', 'mallorn_door', 'mallorn_heartwood_door', 'mallorn_fence_gate',
  'mallorn_heartwood_fence_gate', 'mallorn_leaf_carpet', 'mallorn_blossom'];
const STAIR_STATES = new Set(['minecraft:vertical_half']);
const names = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
let checks = 0;

for (const name of STAIR_TRICK) {
  const block = read(name);
  assert.deepEqual(block.components['minecraft:support'], { shape: 'stair' }, `${name}: stair-trick support`);
  for (const [i, p] of (block.permutations ?? []).entries())
    assert.equal(p.components?.['minecraft:support'], undefined, `${name} permutation ${i} must not override the base support`);
  const traits = block.description.traits ?? {};
  for (const t of Object.values(traits))
    for (const s of t.enabled_states ?? []) assert.ok(!STAIR_STATES.has(s), `${name}: vertical_half would make it a real stair`);
  checks++;
}

// Everything else keeps its own support: only real stairs may declare stair support, ropes stay vanilla (none),
// and fences stay fence.
for (const name of names.filter(n => !STAIR_TRICK.includes(n))) {
  const support = read(name).components['minecraft:support'];
  if (/fence$/.test(name)) assert.deepEqual(support, { shape: 'fence' }, name);
  else if (/stairs$/.test(name)) assert.deepEqual(support, { shape: 'stair' }, name);
  else assert.equal(support, undefined, `${name}: not part of the stair-trick set`);
  checks++;
}
console.log(`ok   stair-trick support: ${STAIR_TRICK.length} no-support blocks, ${checks - STAIR_TRICK.length} others unchanged`);
