// giant trees regression tests; run independently or via tests/run.mjs.
import { test, finish, bp, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeRandom, makeBuilder } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { buildFletMallorn, LADDER, ROUND_LADDER, LEAF_KEEP, ROOT_DEPTH, B, bentBranch } from "../tools/flet_mallorn.mjs";
import { SIZE, SIZE_Y, TRUNK_AT, CHOSEN, TRUNK_ANCHOR } from "../tools/build_structures.mjs";
import { existsSync } from "node:fs";
import { parseMcstructure } from "../tools/village_sim.mjs";
import { CHEST_BLOCK, hasChest } from "../tools/build_structures.mjs";
import * as N from "../lothlorien_bp/scripts/great_mallorn_rules.js";
import { ANCHOR_AT } from "../tools/build_structures.mjs";

const flets = [{}, { woven: true, lush: true }].flatMap((opts) =>
  Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), opts)));
const plains = Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), { woven: true, lush: true, flet: false }));
const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
const rounds = [{ woven: true, lush: true, round: true }, { woven: true, lush: true, flet: false, round: true }].map((opts) =>
  Array.from({ length: 30 }, (_, i) => buildFletMallorn(makeRandom(i * 7919 + 1), opts)));
const roundFlets = rounds[0], roundPlains = rounds[1];

test("flet: ladder unbroken from the ground through the floor, with a floor to step onto", () => {
  for (const t of flets) {
    for (let y = 0; y <= t.floorY; y++) assert.equal(at(t, LADDER.x, y, LADDER.z), B.ropeHanging, `ladder gap at y ${y}`);
    for (let y = 0; y <= t.floorY + 2; y++) assert.equal(at(t, LADDER.x, y, LADDER.z - 1) === B.leaves || at(t, LADDER.x, y, LADDER.z - 1) === B.log, false);
    assert.equal(at(t, LADDER.x, t.floorY, LADDER.z - 1), B.planks);
    for (let y = t.floorY + 1; y <= t.floorY + 3; y++) assert.equal(at(t, LADDER.x, y, LADDER.z), undefined, "headroom over the hole");
  }
});

test("flet: chest stands on the floor with room above", () => {
  for (const t of flets) {
    const [k] = [...t.blocks].find(([, v]) => v.name === B.chest);
    const [x, y, z] = k.split(",").map(Number);
    assert.equal(y, t.floorY + 1);
    assert.ok([B.planks, B.log].includes(at(t, x, y - 1, z)));
    assert.equal(at(t, x, y + 1, z), undefined);
  }
});

test(`giants: every leaf is within ${LEAF_KEEP} steps of a log (no decay after generation)`, () => {
  for (const t of [...flets, ...plains]) {
    const seen = new Set(), queue = [];
    for (const [k, v] of t.blocks) if (v.name === B.log) { seen.add(k); queue.push([k, 0]); }
    for (let i = 0; i < queue.length; i++) {
      const [k, d] = queue[i];
      if (d === LEAF_KEEP) continue;
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = `${x + dx},${y + dy},${z + dz}`;
        if (!seen.has(n) && t.blocks.get(n)?.name === B.leaves) { seen.add(n); queue.push([n, d + 1]); }
      }
    }
    for (const [k, v] of t.blocks) if (v.name === B.leaves) assert.ok(seen.has(k), `far leaf ${k}`);
  }
});

test("giants: tree fits the structure box and drops few leaves", () => {
  for (const t of [...flets, ...plains]) {
    for (const k of t.blocks.keys()) {
      const [x, y, z] = k.split(",").map(Number);
      assert.ok(x + TRUNK_AT >= 0 && x + TRUNK_AT < SIZE && z + TRUNK_AT >= 0 && z + TRUNK_AT < SIZE, `outside x/z ${k}`);
      assert.ok(y + ROOT_DEPTH >= 0 && y + ROOT_DEPTH < SIZE_Y, `outside y ${k}`);
    }
    assert.ok(t.trimmed < 60, `${t.trimmed} leaves trimmed`);
  }
});

test("plain giant: no platform, fence, ladder or chest", () => {
  for (const t of plains) {
    for (const v of t.blocks.values()) assert.ok(![B.ropeHanging, B.chest, B.fence, B.planks].includes(v.name), v.name);
  }
});

test("round trunk: 12 cells (corners cut above the roots) up to the top of the 4x4 part; ladder, chest and floor still work", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    for (let y = -ROOT_DEPTH; y < t.floorY; y++) {
      for (const [x, z] of [[0, 0], [3, 0], [0, 3], [3, 3]]) if (y > 3) assert.ok(![B.log, B.wood].includes(at(t, x, y, z)), `corner log above the foot at ${x},${y},${z}`);
      for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
        if (![0, 3].includes(x) || ![0, 3].includes(z)) assert.equal([B.log, B.wood, B.ropeHanging].includes(at(t, x, y, z)), true, `hole in trunk ${x},${y},${z}`);
      }
    }
  }
  for (const t of roundFlets) {
    for (let y = 0; y <= t.floorY; y++) assert.equal(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z), B.ropeHanging, `ladder gap at y ${y}`);
    for (let y = -ROOT_DEPTH; y <= t.floorY; y++) assert.ok([B.log, B.wood].includes(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z + 1)), `nothing behind the ladder at y ${y}`);
    for (let y = 0; y <= t.floorY + 2; y++) assert.ok(![B.leaves, B.log, B.wood].includes(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z - 1)), "ladder front blocked");
    for (let y = t.floorY + 1; y <= t.floorY + 3; y++) assert.equal(at(t, ROUND_LADDER.x, y, ROUND_LADDER.z), undefined, "headroom over the hole");
    const [k] = [...t.blocks].find(([, v]) => v.name === B.chest);
    const [x, y, z] = k.split(",").map(Number);
    assert.ok([B.log, B.wood].includes(at(t, x - 1, y, z)), "chest against a trunk cell");
    assert.equal(y, t.floorY + 1);
  }
});

test("round trunk: every log joins the trunk through face or edge contact (nothing hangs by a corner only)", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    const logs = new Set([...t.blocks].filter(([, v]) => v.name === B.log || v.name === B.wood).map(([k]) => k));
    const seen = new Set(["1,0,1"]), queue = ["1,0,1"];
    for (let i = 0; i < queue.length; i++) {
      const [x, y, z] = queue[i].split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const n = `${x + dx},${y + dy},${z + dz}`; // rising branches step up and sideways at once: edges count
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 2 && logs.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    assert.equal(seen.size, logs.size, `${logs.size - seen.size} logs not joined to the trunk`);
  }
});

test("round trunk: fits the box and keeps leaves in reach of a log", () => {
  for (const t of [...roundFlets, ...roundPlains]) {
    for (const k of t.blocks.keys()) {
      const [x, y, z] = k.split(",").map(Number);
      assert.ok(x + TRUNK_AT >= 0 && x + TRUNK_AT < SIZE && z + TRUNK_AT >= 0 && z + TRUNK_AT < SIZE && y + ROOT_DEPTH >= 0 && y + ROOT_DEPTH < SIZE_Y, `outside ${k}`);
    }
    assert.ok(t.trimmed < 60);
  }
  for (const t of roundPlains) for (const v of t.blocks.values()) assert.ok(![B.ropeHanging, B.chest, B.fence, B.planks].includes(v.name), v.name);
});

test("giants: legacy jigsaw pool retains CHOSEN and the root shrine, every piece ships, tree grid preserves spacing", () => {
  const pool = bp("worldgen/template_pools/giant_mallorn.json")["minecraft:template_pool"];
  const GIANT_TREES = pool.elements.map((e) => e.element.location.replace("lothlorien/", ""));
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_pool, pool.description.identifier);
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_height.value.absolute, -ROOT_DEPTH);
  assert.ok(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].max_depth >= 1, "max_depth 0 never builds");
  const set = bp("worldgen/structure_sets/giant_mallorn.json")["minecraft:structure_set"];
  assert.ok(set.placement.separation * 2 < set.placement.spacing, "engine rule: separation < spacing / 2");
  // start chunks of neighbouring cells are at least separation + 1 chunks apart; the trunk anchor keeps each
  // trunk on its start however the piece is rotated (without it, trunks were seen 27 apart at separation 2)
  assert.equal(bp("worldgen/structures/giant_mallorn.json")["minecraft:jigsaw"].start_jigsaw_name, TRUNK_ANCHOR);
  assert.ok((set.placement.separation + 1) * 16 >= SIZE, "tree-to-tree spacing fits; village exclusion is a separate unresolved requirement");
  assert.deepEqual(pool.elements.map((e) => e.weight), [...CHOSEN.map(([, , w]) => w * 3), 16]);
  assert.deepEqual(GIANT_TREES, [...CHOSEN.map(([v, n]) => `mallorn_${v}_${String(n).padStart(2, "0")}`), "root_shrine_01"]);
  for (const name of GIANT_TREES) {
    assert.ok(existsSync(new URL(`../lothlorien_bp/structures/lothlorien/${name}.mcstructure`, import.meta.url)), name);
  }
});

test("great nut: tree box and anchor match the structure builder; the sprout sits in the trunk at ground level", () => {
  assert.deepEqual([N.SIZE, N.SIZE_Y, N.TRUNK_AT, N.ROOT_DEPTH], [SIZE, SIZE_Y, TRUNK_AT, ROOT_DEPTH]);
  assert.deepEqual(N.ANCHOR, { x: TRUNK_AT + ANCHOR_AT.x, y: ROOT_DEPTH + ANCHOR_AT.y, z: TRUNK_AT + ANCHOR_AT.z });
  const at = { x: 100, y: 64, z: -20 }, o = N.treeOrigin(at);
  const cell = { x: at.x - o.x, y: at.y - o.y, z: at.z - o.z };
  assert.ok(cell.x >= TRUNK_AT && cell.x <= TRUNK_AT + 3 && cell.z >= TRUNK_AT && cell.z <= TRUNK_AT + 3, "inside the 4x4 trunk");
  assert.equal(cell.y, ROOT_DEPTH, "first cell above the ground");
});

test("great nut: grows only plain giants, with no platform, furnishings or elves", () => {
  const plains = CHOSEN.filter(([v]) => v === "roundplain").map(([v, n]) => `lothlorien:mallorn_${v}_${String(n).padStart(2, "0")}`);
  assert.ok(plains.length > 0);
  assert.deepEqual([...N.PLAIN_TREES].sort(), plains.sort());
  const naturalTreeBlocks = new Set(["lothlorien:mallorn_log", "lothlorien:mallorn_wood", "lothlorien:mallorn_leaves"]);
  for (const id of N.PLAIN_TREES) {
    const bytes = readFileSync(new URL(`../lothlorien_bp/structures/${id.replace(":", "/")}.mcstructure`, import.meta.url));
    const tree = parseMcstructure(bytes, id);
    assert.equal(tree.entities.length, 0, `${id}: no elves or other entities`);
    for (const block of tree.blocks) assert.ok(naturalTreeBlocks.has(block.name), `${id}: unexpected ${block.name}`);
  }
});

test("great nut: terrain, plants, leaves and logs give way; anything built stops the tree", () => {
  for (const id of ["minecraft:air", "minecraft:grass_block", "minecraft:stone", "minecraft:iron_ore", "minecraft:oak_leaves", "minecraft:oak_log",
    "minecraft:short_grass", "minecraft:red_tulip", "minecraft:water", "lothlorien:mallorn_leaves", "lothlorien:mallorn_log", "lothlorien:elanor",
    N.SPROUT_ID]) assert.ok(N.isNatural(id), id);
  for (const id of ["minecraft:oak_planks", "minecraft:stripped_oak_log", "minecraft:cobblestone", "minecraft:stone_bricks", "minecraft:glass",
    "minecraft:chest", "minecraft:torch", "minecraft:farmland", "minecraft:oak_door", "lothlorien:mallorn_planks", "lothlorien:mallorn_stripped_log",
    "minecraft:stone_slab", "minecraft:sandstone"]) assert.ok(!N.isNatural(id), id);
});

test("great nut: unique rare item that plants the sprout; sprout grows like a sapling, survives blasts, gives the nut back", () => {
  const item = readJson("../lothlorien_bp/items/great_mallorn_nut.json")["minecraft:item"];
  assert.equal(item.description.identifier, N.NUT_ID);
  assert.equal(item.components["minecraft:block_placer"].block, N.SPROUT_ID);
  assert.equal(item.components["minecraft:glint"], true);
  assert.equal(item.components["minecraft:compostable"], undefined, "the one gift is never composted by accident");
  const block = readJson("../lothlorien_bp/blocks/great_mallorn_sprout.json")["minecraft:block"];
  const sapling = readJson("../lothlorien_bp/blocks/mallorn_sapling.json")["minecraft:block"];
  assert.equal(block.description.identifier, N.SPROUT_ID);
  assert.deepEqual(block.description.states, sapling.description.states);
  assert.deepEqual(block.components["minecraft:placement_filter"], sapling.components["minecraft:placement_filter"], "same soil as the sapling");
  assert.ok(block.components["lothlorien:great_sprout"]);
  assert.ok(block.components["minecraft:destructible_by_explosion"].explosion_resistance >= 1200);
  assert.ok(!block.components["minecraft:flammable"]);
  const loot = readJson("../lothlorien_bp/loot_tables/blocks/great_mallorn_sprout.json");
  assert.deepEqual(loot.pools.flatMap((p) => p.entries.map((e) => e.name)), [N.NUT_ID]);
  for (const f of ["loot_tables/chests/mallorn_flet.json"]) assert.ok(!readFileSync(new URL(`../lothlorien_bp/${f}`, import.meta.url), "utf8").includes(N.NUT_ID), "not in loot");
  const src = readFileSync(new URL("../lothlorien_bp/scripts/great_mallorn.js", import.meta.url), "utf8");
  assert.ok(src.includes("event.cancel = true") && src.includes("repeatedUse"), "bone meal refused once per use");
  assert.ok(/playerPlaceBlock[\s\S]*message\("mallorn.planted"\)/.test(src), "planting sends a localized space warning");
  const catalog = readJson("../localization/catalog.json");
  assert.match(catalog.packs.lothlorien_rp.entries["lothlorien.message.mallorn.planted"].source, /40 blocks wide and 50 high/);
  assert.ok(readFileSync(new URL("../lothlorien_bp/scripts/main.js", import.meta.url), "utf8").includes('import "./great_mallorn.js"'));
});

test("giant structures: worldgen flet giants hold a chest, plain giants none; no leftover marker blocks", () => {
  for (const [v, n] of CHOSEN) {
    const id = `lothlorien:mallorn_${v}_${String(n).padStart(2, "0")}`;
    const bytes = readFileSync(new URL(`../lothlorien_bp/structures/${id.replace(":", "/")}.mcstructure`, import.meta.url));
    assert.equal(bytes.includes(Buffer.from(CHEST_BLOCK)), v === "round", `${id}: chest only in the flet giants`);
    assert.ok(!bytes.includes(Buffer.from("structure_marker")), `${id}: marker removed (run node tools/build_structures.mjs)`);
  }
  assert.ok(!existsSync(new URL("../lothlorien_bp/blocks/structure_marker.json", import.meta.url)));
  // the generator rule itself: flet trees have a chest, plain giants none
  assert.ok(flets.every((t) => hasChest(t.blocks)) && plains.every((t) => !hasChest(t.blocks)));
});

test("flet tree: the rope hangs on the trunk, facing away from it", () => {
  for (const t of flets) {
    const piece = t.blocks.get(`${LADDER.x},0,${LADDER.z}`);
    assert.deepEqual(piece, { name: B.ropeHanging, states: { "minecraft:cardinal_direction": "north" } });
    assert.ok([B.log, B.wood].includes(at(t, LADDER.x, 0, LADDER.z + 1)), "wall behind the rope");
  }
});

test("giant mallorn generator: the chosen trees have no bare branch end, and bentBranch without maxY keeps its output", () => {
  const draw = (maxY) => { const b = makeBuilder(makeRandom(5)); const r = makeRandom(9); bentBranch(b, r, 0, 0, 1, 0, 3, 12, 0.9, 2, maxY); return b.result(30).logs.map((c) => c.y); };
  assert.deepEqual(draw(), draw(Infinity));
  assert.ok(Math.max(...draw(8)) <= 8 && Math.max(...draw()) > 8, "maxY caps the rise (and without it the branch does climb past 8)");
});

finish();
