// village structures regression tests; run independently or via tests/run.mjs.
import { test, finish, readJson } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPlanterPanel } from "../lothlorien_bp/scripts/planter_panels.js";
import * as H from "../lothlorien_bp/scripts/harmony.js";
import { B, bareBranchEnds } from "../tools/flet_mallorn.mjs";
import { existsSync, readdirSync } from "node:fs";
import { loadVillageData, parseMcstructure, rotated, PLANKS, FENCE, LANTERN_ID } from "../tools/village_sim.mjs";
import { RING, FLOOR_H as V_FLOOR, LEVEL_H as V_LEVEL, ROOTS as V_ROOTS, worstLight, LIGHT_TARGET, LANTERN_LIGHT } from "../tools/village_mallorn.mjs";
import { bridgeShape } from "../lothlorien_bp/scripts/village_bridge.js";
import { buildBridge, STRAIGHT } from "../tools/village_combo.mjs";
import { checkWalk, protectedCells } from "../../../.claude/skills/bedrock-modding/scripts/structure_walk.mjs";
import { buildTree as vBuildTree, SHAPES as V_SHAPES, linkRails, LEVEL_H as V_LEVEL_H } from "../tools/village_mallorn.mjs";
import * as MEND from "../lothlorien_bp/scripts/rail_mender_rules.js";
import * as LOOP from "../lothlorien_bp/scripts/village_loop.js";
import { applyPlan, joinChecks } from "../tools/village_sim.mjs";

const L = "lothlorien:lothlorien", RIVER = "minecraft:river", FOREST = "minecraft:forest";
const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
const flat = () => 64;
const VILLAGE = "../lothlorien_bp/structures/lothlorien/village";
const villageData = loadVillageData();
const DECK_NAME = "lothlorien:village_deck", DECK_HI_NAME = "lothlorien:village_deck_hi", CROWN_NAME = "lothlorien:village_crown";
const MALLORN_LOG = "lothlorien:mallorn_log";
const villagePieces = () => readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
  parseMcstructure(readFileSync(new URL(`${VILLAGE}/${f}`, import.meta.url)), f.replace(".mcstructure", "")));
const isTree = (n) => /^(combo_|central_)/.test(n);
const shippedStructures = () => ["../lothlorien_bp/structures/lothlorien", VILLAGE].flatMap((d) =>
  readdirSync(new URL(`${d}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
    parseMcstructure(readFileSync(new URL(`${d}/${f}`, import.meta.url)), f.replace(".mcstructure", ""))));
const POST_FOOT = /mallorn_(heartwood_)?planks$|mallorn_slab$/;
function railPosts(piece) {
  const isPost = (x, y, z) => piece.at(x, y, z) === "lothlorien:mallorn_stripped_log" && POST_FOOT.test(piece.at(x, y - 1, z) ?? "");
  const byKey = new Map(piece.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b]));
  const SIDES = { north: [0, -1, "south"], south: [0, 1, "north"], west: [-1, 0, "east"], east: [1, 0, "west"] };
  const topSet = new Set(piece.blocks.filter((b) => b.name === "lothlorien:mallorn_slab" && b.states?.["minecraft:vertical_half"] === "top").map((b) => `${b.x},${b.y},${b.z}`)), roofKeys = new Set(), seenS = new Set();
  for (const k0 of topSet) { // groups of top slabs standing on fence posts and on nothing else: a roof, no floor
    if (seenS.has(k0)) continue;
    const grp = [k0]; seenS.add(k0); let post = false, solid = false;
    for (let i = 0; i < grp.length; i++) { const [x, y, z] = grp[i].split(",").map(Number), bn = piece.at(x, y - 1, z) ?? "minecraft:air"; if (/fence$/.test(bn)) post = true; else if (!/air$|pale_hanging_moss|cave_vines|light_block/.test(bn)) solid = true; for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (/fence$/.test(piece.at(x + a, y, z + c) ?? "")) post = true; const nk = `${x + a},${y},${z + c}`; if (!seenS.has(nk) && topSet.has(nk)) { seenS.add(nk); grp.push(nk); } } }
    if (post && !solid) grp.forEach((k) => roofKeys.add(k));
  }
  const roofSlab = (b) => roofKeys.has(`${b.x},${b.y},${b.z}`); // a top-slab roof on posts is no floor
  const blocks = piece.blocks.map((b) => {
    if (isPlanterPanel((x,y,z)=>byKey.get(`${x},${y},${z}`),b.x,b.y,b.z,b)) return {...b,name:"minecraft:air",states:{}}; // thin moss skirts leave the cell-center walk lane open
    if (roofSlab(b)) return { ...b, name: "lothlorien:mallorn_log" };
    if (!isPost(b.x, b.y, b.z)) return b;
    const states = {};
    for (const [side, [dx, dz, back]] of Object.entries(SIDES)) states[`minecraft:connection_${side}`] = !!byKey.get(`${b.x + dx},${b.y},${b.z + dz}`)?.states?.[`minecraft:connection_${back}`];
    return { ...b, name: FENCE, states, post: true };
  });
  const roofAt = new Set(piece.blocks.filter(roofSlab).map((b) => `${b.x},${b.y},${b.z}`));
  return { ...piece, blocks, at: (x, y, z) => (isPlanterPanel((a,b,c)=>byKey.get(`${a},${b},${c}`),x,y,z) ? "minecraft:air" : isPost(x, y, z) ? FENCE : roofAt.has(`${x},${y},${z}`) ? "lothlorien:mallorn_log" : piece.at(x, y, z)) };
}
const SLAB_ID = "lothlorien:mallorn_slab", LEAVES_ID = "lothlorien:mallorn_leaves";
const halfOf = (p) => { const up = p.jigsaws.find((j) => j.dirId === 1); return up ? [up.x, up.z] : [(p.size[0] - 1) / 2, (p.size[2] - 1) / 2]; };
const walkOf = (p) => { // a parsed piece as get(x, y, z) for the checker (jigsaw states: horizontal ones are deck connectors)
  const st = new Map(p.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b.states]));
  const jig = new Map(p.jigsaws.map((j) => [`${j.x},${j.y},${j.z}`, j.dirId]));
  return (x, y, z) => { const n = p.at(x, y, z); return n == null ? undefined : { name: n, states: n === "minecraft:jigsaw" ? { facing_direction: jig.get(`${x},${y},${z}`) } : st.get(`${x},${y},${z}`) ?? {} }; };
};
const towerSpec = () => ({ pool: "p", upPool: "u", trunk: "square3", seed: 88088, lamps: 0, levels: [
  { rows: V_SHAPES.plus15w, conn: [{ facing: "east", off: 1 }, { facing: "north", off: -1 }, { facing: "south", off: 0 }] },
  { rows: V_SHAPES.octagon15, conn: [{ facing: "south", off: 1, hi: true }, { facing: "west", off: -1, hi: true }] }] });
const towerWalk = (mutate) => {
  const t = vBuildTree(towerSpec());
  if (mutate) mutate(t.blocks);
  const trunk = []; for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) trunk.push([x, z]);
  const box = { x0: -t.box.hx, x1: t.box.hx, y0: -V_ROOTS, y1: t.topY + 5, z0: -t.box.hz, z1: t.box.hz };
  const raw=(x,y,z)=>t.blocks.get(`${x},${y},${z}`);
  return checkWalk((x,y,z)=>isPlanterPanel(raw,x,y,z)?undefined:raw(x,y,z), box, { ring: [{ trunk, level: V_FLOOR + 1 }, { trunk, level: V_FLOOR + V_LEVEL + 1 }], must: t.connectors.map((c) => ({ x: c.x, y: c.y + 1, z: c.z })) });
};
const rulesOf = (r) => [...new Set(r.violations.map((v) => v.rule))].sort();
const joined = (f, d) => { // apply a built plan and run the walk + light checks on it
  assert.equal(d.action, "build", d.reason);
  const r = joinChecks(f.world, f.states, d.plan, () => applyPlan(f.world, f.states, d.plan));
  assert.deepEqual(r.walk, [], `${d.kind}: walk violations`);
  assert.ok(r.light >= LOOP.LOOP.lightTarget, `${d.kind}: darkest walk cell ${r.light}`);
  return r;
};
const deck = (w, d, extra = {}) => (x, y, z) => { // a hand-made deck: planks at y 0, air at y 1..3, anything else unloaded
  if (x < 0 || z < 0 || x >= w || z >= d) return undefined;
  if (extra[`${x},${y},${z}`]) return extra[`${x},${y},${z}`];
  return y === 0 ? PLANKS : y >= 1 && y <= 3 ? "minecraft:air" : undefined;
};

test("village: every deck connector is a rim connector on the box face, faces outward and follows the connector standard", () => {
  const pieces = villagePieces();
  assert.ok(pieces.length >= 25, `${pieces.length} village pieces`);
  for (const piece of pieces) {
    const name = piece.name, [sx, , sz] = piece.size;
    const deckJigsaws = piece.jigsaws.filter((j) => j.dir && j.pool !== undefined && j.target === DECK_NAME);
    if (name.startsWith("crown_")) { assert.equal(deckJigsaws.length, 0, `${name}: crowns have no deck connector`); continue; }
    assert.ok(deckJigsaws.length >= 1, `${name}: no deck connector`);
    for (const j of deckJigsaws) {
      const tag = `${name} ${j.dirId}@${j.x},${j.y},${j.z}`;
      const [dx, dz] = j.dir;
      const onFace = dx === 1 ? j.x === sx - 1 : dx === -1 ? j.x === 0 : dz === 1 ? j.z === sz - 1 : j.z === 0;
      assert.ok(onFace, `${tag}: not on the outer face of the box`);
      assert.ok(j.name === DECK_NAME || (j.name === DECK_HI_NAME && /^(combo_|central_)/.test(name)), `${tag}: name ${j.name}`);
      assert.equal(j.final, PLANKS, `${tag}: final_state`);
      assert.equal(j.joint, "aligned", `${tag}: joint`);
      const plug = name === "railing_end", pp = [-dz, dx];
      for (let off = -2; off <= 2; off++) {
        const x = j.x + pp[0] * off, z = j.z + pp[1] * off, at = (h) => piece.at(x, j.y + h, z);
        const deck = at(0);
        assert.ok(off === 0 ? deck === "minecraft:jigsaw" : deck === PLANKS, `${tag}: deck at ${off} is ${deck}`);
        if (Math.abs(off) === 2) assert.equal(at(1), FENCE, `${tag}: rail at ${off}`);
        else if (!plug) for (let h = 1; h <= 3; h++) assert.ok([null, "minecraft:air", "minecraft:light_block_0"].includes(at(h)), `${tag}: headroom ${off},${h}: ${at(h)}`); // light_block_0: headroom shield
      }
    }
  }
});

test("village: tree pieces carry an upward rollable crown jigsaw (log final state) 5 above the top deck; crowns have the matching downward one", () => {
  const pieces = villagePieces();
  const trees = pieces.filter((p) => isTree(p.name));
  assert.ok(trees.length >= 10, `${trees.length} tree pieces`);
  for (const p of trees) {
    const ups = p.jigsaws.filter((j) => j.dirId === 1);
    assert.equal(ups.length, 1, `${p.name}: upward jigsaws`);
    const [j] = ups, [sx, sy, sz] = p.size;
    assert.equal(j.name, CROWN_NAME); assert.equal(j.target, CROWN_NAME); assert.equal(j.joint, "rollable"); assert.equal(j.final, MALLORN_LOG);
    assert.ok(villageData.pools.has(j.pool), `${p.name}: crown pool ${j.pool}`);
    assert.equal(j.y, sy - 1, `${p.name}: crown jigsaw on the top face`);
    if (!p.name.startsWith("combo_")) assert.deepEqual([j.x, j.z], [(sx - 1) / 2, (sz - 1) / 2], `${p.name}: crown jigsaw on the trunk axis`);
    const topDeck = Math.max(...p.jigsaws.filter((k) => k.dir).map((k) => k.y));
    const hall = p.name.startsWith("central") ? V_LEVEL_H : 0; // the central tree's top deck is the Hall: its connectors are the Court's, one level (+8) below
    assert.equal(j.y - topDeck - hall, 5, `${p.name}: crown box starts 6 above the top deck (headroom + highest arch box)`);
    assert.equal(p.at(j.x, j.y - 1, j.z), MALLORN_LOG, `${p.name}: trunk reaches the jigsaw`);
  }
  const crowns = pieces.filter((p) => p.name.startsWith("crown_"));
  assert.ok(crowns.length >= 5);
  for (const p of crowns) {
    const downs = p.jigsaws.filter((j) => j.dirId === 0);
    assert.equal(downs.length, 1, `${p.name}: downward jigsaws`);
    const [j] = downs, [sx, , sz] = p.size;
    assert.equal(j.name, CROWN_NAME); assert.equal(j.target, CROWN_NAME); assert.equal(j.final, MALLORN_LOG); assert.equal(j.pool, "minecraft:empty");
    assert.deepEqual([j.x, j.y, j.z], [(sx - 1) / 2, 0, (sz - 1) / 2], `${p.name}: jigsaw at the bottom centre`);
    assert.equal(p.at(j.x, 1, j.z), MALLORN_LOG, `${p.name}: the trunk continues above the jigsaw`);
    assert.ok(p.blocks.some((b) => b.name === "lothlorien:mallorn_leaves"), `${p.name}: leaves`);
    assert.equal(p.blocks.filter((b) => b.y === 0 && b.name !== "lothlorien:mallorn_leaves" && b.name !== MALLORN_LOG).length, 0, `${p.name}: nothing but leaves and trunk in the jigsaw layer`);
  }
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const locs = (id) => pool(id).elements.map((e) => e.element.location.split("/").pop());
  assert.deepEqual(locs("crowns"), ["crown_large", "crown_medium"]);
  assert.equal(pool("crowns").fallback, "lothlorien:village/crowns_fallback");
  assert.deepEqual(locs("crowns_fallback"), ["crown_large", "crown_medium", "crown_small", "crown_tiny", "crown_nub"], "trees at max_depth only see the fallback: it offers the big crowns too, and the last resorts (small weights)");
  assert.deepEqual(locs("crowns_small"), ["crown_small", "crown_tiny", "crown_nub"]);
  assert.equal(pool("crowns_central").fallback, "lothlorien:village/crowns_small");
  assert.ok(locs("crowns_central").length >= 2);
  assert.equal(pool("exits").elements.length, 3);
  assert.equal(pool("combos").fallback, "lothlorien:village/exits");
  assert.equal(pool("exits").fallback, "lothlorien:village/plugs");
  assert.ok(!villageData.pools.has("lothlorien:village/bridges") && !villageData.pools.has("lothlorien:village/nodes"), "no pool hands out a bridge or a node alone");
  assert.ok(villageData.getPiece("lothlorien/village/central_mallorn_01").jigsaws.some((j) => j.name === "lothlorien:village_anchor"), "start anchor");
});

test("village: the one rail constant is the only rail block, bridges are symmetric slab arches in half steps, rails follow", () => {
  const SLAB_ID = "lothlorien:mallorn_slab";
  for (const p of villagePieces()) {
    for (const b of p.blocks) assert.ok(!b.name.endsWith("_fence") || b.name === FENCE, `${p.name}: another rail block ${b.name}`);
    for (const b of p.blocks) if (b.name === SLAB_ID) assert.ok(["bottom", "top"].includes(b.states["minecraft:vertical_half"]), `${p.name}: slab state`);
  }
  const lengths = new Set();
  for (const p of villagePieces().filter((q) => /^combo_.*_bridge_\d+$/.test(q.name))) { // straight bridges: the arch of the combo, along the entry column
    const L = Number(p.name.match(/_bridge_(\d+)$/)[1]);
    lengths.add(L);
    const entry = p.jigsaws.find((j) => j.dirId === 2 && j.z === 0 && j.name === DECK_NAME), cx = entry.x, y0 = entry.y;
    const surf = [];
    for (let z = 0; z < L; z++) {
      let s = null;
      for (let y = y0; y < p.size[1]; y++) {
        const n = p.at(cx, y, z);
        if (n === PLANKS) s = 2 * (y - y0) + 2; else if (n === SLAB_ID) s = 2 * (y - y0) + 1;
        if (n === "minecraft:jigsaw") s = 2 * (y - y0) + 2;
      }
      surf.push(s);
    }
    const bn = `${p.name} (bridge ${L})`;
    assert.equal(surf[0], 2, `${bn}: starts at the connector deck`);
    assert.deepEqual(surf, [...surf].reverse(), `${bn}: symmetric arch ${surf}`);
    for (let z = 1; z < L; z++) assert.ok(Math.abs(surf[z] - surf[z - 1]) <= 1, `${bn}: step > 0.5 block at ${z}: ${surf}`);
    assert.equal(Math.max(...surf) - 2, L <= 7 ? 2 : 4, `${bn}: rise`);
    for (let z = 0; z < L; z++) for (const x of [cx - 2, cx + 2]) { // rail one cell above the block the walker stands on
      const layer = surf[z] % 2 === 0 ? surf[z] / 2 - 1 : (surf[z] - 1) / 2;
      assert.equal(p.at(x, y0 + layer + 1, z), FENCE, `${bn}: rail at ${x},${z}`);
    }
  }
  assert.deepEqual([...lengths].sort((a, b) => a - b), [7, 9, 11, 13, 15], "every straight bridge length is used by some combo"); // P9: no 5-long bridge, the bigger crowns need room
  const names = villagePieces().map((q) => q.name);
  // owner 2026-10-08: no dog-legs in combos ("ugly and unnecessary, it could have been straight"); the loop closer keeps the diagonal
  assert.ok(!names.some((q) => q.includes("_bridge_dog_")), "no dog-leg combo");
});

test("village: platform shapes differ (irregular rectilinear outlines of different sizes)", () => {
  const seen = new Map();
  for (const p of villagePieces().filter((q) => isTree(q.name))) {
    const ys = p.jigsaws.filter((j) => j.dir).map((j) => j.y), y = Math.min(...ys);
    const cells = p.blocks.filter((b) => b.y === y && b.name === PLANKS).map((b) => `${b.x},${b.z}`).sort().join(";") + `|${p.size}`;
    seen.set(p.name, cells);
  }
  const nodes = new Set([...seen.keys()].filter((n) => /^combo_node_/.test(n)).map((n) => n.match(/^combo_(node_[a-z])_/)[1]));
  assert.equal(nodes.size, 6, "all six node platforms are used by combos");
  assert.ok(new Set(villagePieces().filter((q) => /^combo_tower_/.test(q.name)).map((q) => q.name.match(/^combo_(tower_[a-z])_/)[1])).size === 3, "all three towers are used by combos");
  const sizes = new Set([...seen.keys()].map((n) => villageData.getPiece(`lothlorien/village/${n}`).size.slice(0, 1).concat(villageData.getPiece(`lothlorien/village/${n}`).size.slice(2)).join("x")));
  assert.ok(sizes.size >= 8, `footprint sizes: ${[...sizes]}`);
});

test("village: pools, fallbacks, piece files and connector pools all resolve", () => {
  const ids = [...villageData.pools.keys()].filter((k) => k.startsWith("lothlorien:village/"));
  assert.ok(ids.length >= 8, `${ids.length} pools`);
  for (const id of ids) {
    const p = villageData.pools.get(id);
    for (const e of p.elements) {
      assert.ok(existsSync(new URL(`../lothlorien_bp/structures/${e.element.location}.mcstructure`, import.meta.url)), `${id}: ${e.element.location}`);
      for (const j of villageData.getPiece(e.element.location).jigsaws) {
        if (j.name === DECK_NAME || j.name === DECK_HI_NAME || j.name === CROWN_NAME) assert.ok(j.pool === "minecraft:empty" || villageData.pools.has(j.pool), `${id}: ${e.element.location} points at missing pool ${j.pool}`);
      }
    }
    if (p.fallback && p.fallback !== "minecraft:empty") assert.ok(villageData.pools.has(p.fallback), `${id}: fallback ${p.fallback}`);
  }
  assert.ok(villageData.pools.has(villageData.structure.start_pool));
  assert.ok(villageData.structure.max_depth >= 1);
  const used = new Set([...villageData.pools.values()].flatMap((p) => p.elements.map((e) => e.element.location.split("/").pop())));
  for (const p of villagePieces()) assert.ok(used.has(p.name), `${p.name}: piece file is in no pool (remove it)`);
});

test("village combos: a bridge only exists inside a combo piece with its destination tree (entry on the bridge, tree exits, crown jigsaw, trunk to the ground)", () => {
  const names = readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) => f.replace(".mcstructure", ""));
  assert.ok(!names.some((n) => /^(bridge_|node_|tower_|tree_platform)/.test(n)), "no bridge, node or tower piece is shipped alone");
  const combos = villagePieces().filter((p) => p.name.startsWith("combo_"));
  assert.ok(combos.length >= 20, `${combos.length} combo pieces`); // straight bridges only since 2026-10-08
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const inCombos = new Set(pool("combos").elements.map((e) => e.element.location.split("/").pop()));
  for (const p of combos) {
    assert.ok(inCombos.has(p.name), `${p.name} is in the combos pool`);
    const deck = p.jigsaws.filter((j) => j.dir && j.target === DECK_NAME);
    const entries = deck.filter((j) => j.name === DECK_NAME);
    assert.equal(entries.length, 1, `${p.name}: exactly one entry connector (the bridge's far end)`);
    const [en] = entries;
    assert.deepEqual([en.dirId, en.z, en.pool], [2, 0, "minecraft:empty"], `${p.name}: entry faces north on the bridge end`);
    assert.ok(deck.length >= 2 && deck.every((j) => j === en || (j.name === DECK_HI_NAME && j.pool === "lothlorien:village/combos")), `${p.name}: the tree's exits only act as parents and point at combos`);
    // the destination tree: crown jigsaw on a log trunk that reaches the bottom of the box, deck on the entry level
    const up = p.jigsaws.find((j) => j.dirId === 1);
    assert.ok(up, `${p.name}: crown jigsaw`);
    assert.equal(p.at(up.x, up.y - 1, up.z), MALLORN_LOG, `${p.name}: trunk`);
    assert.equal(p.at(up.x, 0, up.z), MALLORN_LOG, `${p.name}: trunk reaches the ground (ROOTS)`);
    // the bridge end is joined to the platform inside the piece: no jigsaw faces south on the bridge, the exits are the node's own faces
    const L = deck.length;
    assert.ok(!p.jigsaws.some((j) => j.dirId === 3 && j.z < 5), `${p.name}: no connector at the bridge's far end (it is joined to the node)`);
    assert.ok(L >= 2);
  }
});

test("village exits: no free-floating balcony; the braced balcony and the lookout stand on a log pillar to the bottom of the box and are braced under the deck", () => {
  assert.ok(!existsSync(new URL(`${VILLAGE}/balcony_small.mcstructure`, import.meta.url)), "balcony_small is gone");
  for (const p of villageData.pools.values()) for (const e of p.elements) assert.ok(!/balcony_small/.test(e.element.location), "balcony_small is in no pool");
  const bal = villagePieces().find((p) => p.name === "balcony_braced");
  const con = bal.jigsaws.find((j) => j.dir);
  assert.deepEqual([con.name, con.target, con.pool, con.final], [DECK_NAME, DECK_NAME, "minecraft:empty", PLANKS]);
  const logs = bal.blocks.filter((b) => b.name === MALLORN_LOG);
  const pillarX = new Set(logs.filter((b) => b.y === 0).map((b) => `${b.x},${b.z}`));
  assert.ok(pillarX.size >= 5, "pillar cross-section at the bottom of the box");
  for (const k of pillarX) { const [x, z] = k.split(",").map(Number); for (let y = 0; y < con.y; y++) assert.equal(bal.at(x, y, z), MALLORN_LOG, `pillar column ${k} is continuous up to the deck (y ${y})`); }
  assert.ok(con.y >= 40, "the pillar runs 40 below the deck: it reaches the ground from any deck of the village (up to 3 levels)");
  const braces = logs.filter((b) => b.y >= con.y - 3 && b.y < con.y && !pillarX.has(`${b.x},${b.z}`));
  assert.ok(braces.length >= 8, `braces under the deck: ${braces.length}`);
  assert.ok(braces.every((b) => ["bottom", undefined].every(() => true)) && braces.some((b) => b.y === con.y - 1), "a brace ends right under the deck");
  const lookout = villagePieces().find((p) => p.name === "lookout_01");
  assert.equal(lookout.at(5, 0, 5), MALLORN_LOG, "lookout pillar to the bottom of the box (11 x 11 since phase 3)");
  const ex = villageData.pools.get("lothlorien:village/exits");
  assert.deepEqual(ex.elements.map((e) => e.element.location.split("/").pop()).sort(), ["balcony_braced", "lookout_01", "railing_end"]);
  assert.equal(ex.fallback, "lothlorien:village/plugs");
});

test("village sim: the bridge-without-destination metric flags a bridge piece placed alone and a combo without its tree", () => {
  const ck = (placed) => { // minimal fake placement run through the same counting rules
    const hasLog = (p) => p.piece.blocks.some((b) => b.y === 0 && /_(log|wood)$/.test(b.name));
    return placed.filter((p) => p.name.startsWith("bridge_") || (p.name.startsWith("combo_") && !(hasLog(p) && p.piece.jigsaws.some((j) => j.dirId === 1)))).length;
  };
  const good = villageData.getPiece("lothlorien/village/" + villagePieces().find((p) => p.name.startsWith("combo_")).name);
  assert.equal(ck([{ name: "combo_x", piece: good }]), 0);
  assert.equal(ck([{ name: "bridge_7", piece: good }]), 1);
  assert.equal(ck([{ name: "combo_x", piece: { blocks: [], jigsaws: [] } }]), 1);
});

test("village: every branch end of every shipped village piece carries leaves (>= 6 within 2); fixtures: a bare branch is flagged, a tufted one passes", () => {
  for (const p of villagePieces()) {
    const m = new Map(p.blocks.map((b) => [`${b.x},${b.y},${b.z}`, { name: b.name, states: b.states }]));
    assert.deepEqual(bareBranchEnds(m), [], `${p.name}: bare branch end`);
  }
  const log = (face) => ({ name: B.log, states: { "minecraft:block_face": face } });
  const branch = new Map([["0,0,0", log("up")], ["0,1,0", log("up")], ["1,1,0", log("east")], ["2,1,0", log("east")], ["3,1,0", log("east")], ["4,1,0", log("east")]]);
  assert.deepEqual(bareBranchEnds(branch).map((q) => [q.x, q.y, q.z]), [[4, 1, 0]], "4 logs and no leaves: the end is bare");
  for (let x = 3; x <= 5; x++) for (let y = 1; y <= 3; y++) for (let z = -1; z <= 1; z++) if (!branch.has(`${x},${y},${z}`)) branch.set(`${x},${y},${z}`, { name: B.leaves, states: {} });
  assert.deepEqual(bareBranchEnds(branch), [], "a 3x3x3 leaf blob on the tip passes");
});

test("village and giants: no orphan leaves (every leaf has a 6-neighbour path of <= 10 leaves to a log; trees.js decays the rest)", () => {
  for (const piece of shippedStructures()) {
    const names = new Map(piece.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b.name]));
    for (const b of piece.blocks) if (b.name === "lothlorien:mallorn_leaves" && [true, 1].includes(b.states?.["lothlorien:persistent"])) names.set(`${b.x},${b.y},${b.z}`, "persistent_leaves"); // placed by the dressing: never decays, carries nothing
    const dist = new Map();
    const queue = [];
    for (const [k, n] of names) if (n === "lothlorien:mallorn_log" || n === "lothlorien:mallorn_wood") { dist.set(k, 0); queue.push(k); }
    for (let i = 0; i < queue.length; i++) {
      const [x, y, z] = queue[i].split(",").map(Number);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = `${x + dx},${y + dy},${z + dz}`;
        if (names.get(n) === "lothlorien:mallorn_leaves" && !dist.has(n)) { dist.set(n, dist.get(queue[i]) + 1); queue.push(n); }
      }
    }
    const orphans = [...names].filter(([k, n]) => n === "lothlorien:mallorn_leaves" && !(dist.get(k) <= 10));
    assert.equal(orphans.length, 0, `${piece.name}: ${orphans.length} orphan leaves, e.g. ${orphans[0]?.[0]}`);
  }
});

test("village: fence links are symmetric and consistent in every piece (the stored state matches the neighbouring fence)", () => {
  const OPP = { north: "south", south: "north", east: "west", west: "east" };
  const VEC = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
  const pieces = shippedStructures().filter((p) => villageData.pieces.has(`lothlorien/village/${p.name}`)).map(railPosts);
  assert.ok(pieces.length >= 25);
  for (const piece of pieces) {
    const at = new Map(piece.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b]));
    for (const b of piece.blocks) {
      if (b.name !== FENCE) continue;
      for (const [side, [dx, dz]] of Object.entries(VEC)) {
        const stored = !!b.states[`minecraft:connection_${side}`];
        const inBox = piece.at(b.x + dx, b.y, b.z + dz) !== undefined;
        const nb = at.get(`${b.x + dx},${b.y},${b.z + dz}`);
        if (b.post || nb?.post) continue; // a log post in a rail cell: the engine links fences to it by itself
        const tag = `${piece.name} fence ${b.x},${b.y},${b.z} ${side}`;
        if (!inBox) continue; // a link out of the box is the connector standard's forced link, checked in the connector test
        assert.equal(stored, MEND.isLinkTarget(nb?.name), `${tag}: stored ${stored}, neighbour ${nb?.name}`);
        if (nb?.name === FENCE) assert.equal(!!nb.states[`minecraft:connection_${OPP[side]}`], stored, `${tag}: one-way link`);
      }
    }
  }
});

test("village: rails are straight runs and square corners only (no diagonal staircase of single cells)", () => {
  for (const piece0 of shippedStructures()) {
    if (!villageData.pieces.has(`lothlorien/village/${piece0.name}`)) continue;
    const piece = railPosts(piece0);
    const rail = new Set(piece.blocks.filter((b) => b.name === FENCE && b.y > 0).map((b) => `${b.x},${b.y},${b.z}`));
    for (const k of rail) {
      const [x, y, z] = k.split(",").map(Number);
      for (const [dx, dz] of [[1, 1], [1, -1]]) {
        // a diagonal pair with neither orthogonal cell present would be an unlinked staircase step
        if (rail.has(`${x + dx},${y},${z + dz}`)) assert.ok(rail.has(`${x + dx},${y},${z}`) || rail.has(`${x},${y},${z + dz}`), `${piece.name}: diagonal rail step at ${k}`);
      }
    }
  }
});

test("Elven rope hanging: structure-only twin of the rope, same geometry, a state Bedrock rotates, same script handling", () => {
  const rope = readJson("../lothlorien_bp/blocks/elven_rope.json")["minecraft:block"];
  const hang = readJson("../lothlorien_bp/blocks/elven_rope_hanging.json")["minecraft:block"];
  assert.equal(hang.description.identifier, "lothlorien:elven_rope_hanging");
  assert.deepEqual(hang.description.menu_category, { category: "none" }, "hidden from the Creative menu");
  assert.deepEqual(hang.description.traits["minecraft:placement_direction"].enabled_states, ["minecraft:cardinal_direction"]);
  assert.equal(hang.description.states, undefined, "no custom state: custom-namespace states are not rotated with a piece");
  assert.deepEqual(hang.components, rope.components, "same geometry, texture, sound, selection box");
  assert.equal(hang.components["minecraft:loot"], "loot_tables/blocks/elven_rope.json", "native loot uses the normal rope item for either block variant");
  assert.deepEqual(hang.permutations.map((p) => p.condition.replace("minecraft:cardinal_direction", "lothlorien:face")), rope.permutations.map((p) => p.condition));
  assert.deepEqual(hang.permutations.map((p) => p.components), rope.permutations.map((p) => p.components), "same side for the same value");
  const js = readFileSync(new URL("../lothlorien_bp/scripts/elven_rope.js", import.meta.url), "utf8");
  assert.ok(js.includes('"lothlorien:elven_rope_hanging"') && js.includes("ROPE_IDS.has"), "script treats it as a rope (climb, break, wall check)");
  const lang = readFileSync(new URL("../lothlorien_rp/texts/en_US.lang", import.meta.url), "utf8");
  assert.ok(lang.includes("tile.lothlorien:elven_rope_hanging.name=Elven Rope"), "named like the rope");
});

test("village crowns: the trunk keeps its full section well up into the crown and thins only in the top third (3x3 village, 5x5 central)", () => {
  for (const p of villagePieces().filter((q) => q.name.startsWith("crown_"))) {
    const central = p.name.startsWith("crown_central"), H = p.size[1], top = H - 4, [hx, hz] = halfOf(p);
    const trunkAt = (y) => p.blocks.filter((b) => b.y === y && b.name === MALLORN_LOG && b.states["minecraft:block_face"] !== "east" && b.states["minecraft:block_face"] !== "south"
      && Math.abs(b.x - hx) <= 2 && Math.abs(b.z - hz) <= 2).length;
    const counts = []; for (let y = 1; y <= top; y++) counts.push(trunkAt(y));
    assert.ok(counts[0] >= (central ? 21 : 9), `${p.name}: starts with the full section, got ${counts[0]}`);
    for (let y = 1; y < counts.length; y++) assert.ok(counts[y] <= counts[y - 1], `${p.name}: the trunk only tapers ${counts}`);
    assert.ok(counts[Math.floor(top * 0.3) - 1] >= 9, `${p.name}: 3x3 or wider at 30%`);
    assert.ok(counts[Math.floor(top * 0.6) - 1] >= 5, `${p.name}: plus or wider at 60%`);
    assert.equal(counts[top - 1], 1, `${p.name}: 1x1 at the top`);
    assert.equal(p.blocks.filter((b) => b.y === 0 && b.name !== MALLORN_LOG).length, 0, `${p.name}: only trunk in the jigsaw layer`);
  }
  for (const p of villagePieces().filter((q) => isTree(q.name))) { // the platform trunk below carries the same full section
    const [hx, hz] = halfOf(p), central = p.name.startsWith("central"), top = p.size[1] - 1;
    const n = (y) => p.blocks.filter((b) => b.y === y && b.name === MALLORN_LOG && Math.abs(b.x - hx) <= 2 && Math.abs(b.z - hz) <= 2).length + (p.at(hx, y, hz) === "minecraft:jigsaw" ? 1 : 0);
    assert.ok(n(top - 1) >= (central ? 21 : 9), `${p.name}: full section under the crown jigsaw`);
  }
});

test("village trees (P9, giant Mallorn style): root flare of bark at ground level, trunk down to ROOTS, bent branches and big leaf blobs in the crowns", () => {
  const WOOD_ID = "lothlorien:mallorn_wood", BRANCH = (b) => b.name === MALLORN_LOG && ["east", "south", "west", "north"].includes(b.states["minecraft:block_face"]); // combos are turned: east/south become west/north
  for (const p of villagePieces().filter((q) => isTree(q.name))) {
    const [hx, hz] = halfOf(p), central = p.name.startsWith("central"), r = central ? 2 : 1;
    const outside = (b) => Math.max(Math.abs(b.x - hx), Math.abs(b.z - hz)) > r;
    const flare = p.blocks.filter((b) => b.name === WOOD_ID && b.y >= V_ROOTS && b.y < V_ROOTS + 4 && outside(b));
    assert.ok(flare.length >= (central ? 30 : 15), `${p.name}: root flare of bark round the trunk at nominal ground level, got ${flare.length}`);
    assert.ok(flare.some((b) => b.y === V_ROOTS) && flare.some((b) => b.y >= V_ROOTS + 2), `${p.name}: the flare rises above the ground`);
    assert.ok(!p.blocks.some((b) => b.name === WOOD_ID && b.y >= V_ROOTS + 8), `${p.name}: bark foot only near the ground`);
    const trunkBottom = p.blocks.filter((b) => b.y === 0 && b.name === MALLORN_LOG && !outside(b)).length + (p.at(hx, 0, hz) === "minecraft:jigsaw" ? 1 : 0); // the start anchor jigsaw replaces the centre log
    assert.ok(trunkBottom >= (central ? 21 : 9), `${p.name}: the trunk reaches ROOTS below nominal ground with its full section (${trunkBottom})`);
    // the round trunk: no corner cell in the central 5x5
    if (central) for (const [cx, cz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) assert.ok(!p.blocks.some((b) => b.y === V_ROOTS + 8 && b.x === hx + cx && b.z === hz + cz && b.name === MALLORN_LOG), "round trunk: corner cell empty");
    assert.ok(p.blocks.filter(BRANCH).length >= (central ? 40 : 15), `${p.name}: bent low branches on the bare trunk`);
  }
  const need = { crown_small: [7, 16], crown_medium: [8, 20], crown_large: [10, 24], crown_central_a: [16, 34], crown_central_b: [13, 30] };
  for (const [name, [h, H]] of Object.entries(need)) {
    const p = villagePieces().find((q) => q.name === name);
    assert.deepEqual([(p.size[0] - 1) / 2, p.size[1]], [h, H], `${name}: giant-style crowns are this big`);
    const branches = p.blocks.filter(BRANCH), leaves = p.blocks.filter((b) => b.name === LEAVES_ID);
    assert.ok(branches.length >= 3 * h, `${name}: bent branches (${branches.length})`);
    assert.ok(new Set(branches.map((b) => b.y)).size >= 5, `${name}: branches climb (rise on the way)`);
    assert.ok(leaves.length >= 14 * h * h / 3, `${name}: full leaf blobs (${leaves.length})`);
    const [hx, hz] = halfOf(p), far = Math.max(...branches.map((b) => Math.max(Math.abs(b.x - hx), Math.abs(b.z - hz))));
    assert.ok(far >= h - 5, `${name}: branches reach out (${far} of ${h})`);
  }
});

test("village bridges: the rail is one continuous stepped line (consecutive rail fences are face-adjacent, no diagonal-only joins)", () => {
  const bridges = STRAIGHT.map((spec) => { // the shapes the combos are built from (a bridge is never a piece of its own)
    const b = buildBridge(spec.length, spec);
    return { name: spec.name, blocks: [...b.blocks].map(([k, v]) => { const [x, y, z] = k.split(",").map(Number); return { x, y, z, name: v.name }; }) };
  });
  assert.equal(bridges.length, 5);
  for (const p of bridges) {
    const rail = new Set(p.blocks.filter((b) => b.name === FENCE).map((b) => `${b.x},${b.y},${b.z}`));
    let sawStep = false;
    for (const k of rail) {
      const [x, y, z] = k.split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const n = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        if (n !== 2 || !rail.has(`${x + dx},${y + dy},${z + dz}`)) continue;
        if (dy !== 0) sawStep = true;
        // a diagonal pair needs a rail at one of the shared face neighbours (an L of face-adjacent fences)
        const joined = [[dx, 0, 0], [0, dy, 0], [0, 0, dz]].some(([a, b, c]) => (a || b || c) && rail.has(`${x + a},${y + b},${z + c}`));
        assert.ok(joined, `${p.name}: diagonal-only rail join at ${k} -> ${[dx, dy, dz]}`);
      }
    }
    if (/bridge_(9|11|13)$/.test(p.name)) assert.ok(sawStep, `${p.name}: expected stepped rails`);
    const seen = new Set(); let comps = 0; // one rail line per side
    for (const k of rail) {
      if (seen.has(k)) continue;
      comps++; const st = [k]; seen.add(k);
      while (st.length) {
        const [x, y, z] = st.pop().split(",").map(Number);
        for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const m = `${x + a},${y + b},${z + c}`; if (rail.has(m) && !seen.has(m)) { seen.add(m); st.push(m); } }
      }
    }
    const wantComps = 2;
    assert.equal(comps, wantComps, `${p.name}: one rail line per side, got ${comps}`);
  }
});

test("bridgeShape: dog-legs shift one block sideways per block forward, walk stays 3 wide and connected, exits at the ends", () => {
  for (const [len, off] of [[11, 2], [11, -2], [13, 3], [13, -3], [9, 0], [9, 4]]) {
    const s = bridgeShape(len, off, len <= 7 ? 1 : 2), xs = (z) => s.walk.filter((c) => c[2] === z).map((c) => c[0]).sort((a, b) => a - b);
    for (let z = 0; z < len; z++) {
      const r = xs(z);
      assert.equal(r.length, 3, `${len}/${off} row ${z}: 3 wide`);
      if (z) assert.ok(Math.abs(r[1] - xs(z - 1)[1]) <= 1, `${len}/${off} row ${z}: centre moves at most one block`);
    }
    assert.equal(s.connectors[1].x - s.connectors[0].x, off);
    assert.equal(s.size[0], 5 + Math.abs(off));
  }
});

test("village: a bottom slab is never one slab thin - a top slab (or solid block) directly under every bottom slab", () => {
  for (const p of villagePieces()) {
    for (const b of p.blocks) {
      if (b.name !== SLAB_ID || b.states["minecraft:vertical_half"] !== "bottom") continue;
      const under = p.blocks.find((q) => q.x === b.x && q.y === b.y - 1 && q.z === b.z);
      const jig = p.at(b.x, b.y - 1, b.z) === "minecraft:jigsaw";
      assert.ok(jig || (under && (under.name === PLANKS || under.name === MALLORN_LOG || (under.name === SLAB_ID && under.states["minecraft:vertical_half"] === "top"))), `${p.name}: thin slab at ${[b.x, b.y, b.z]}`);
    }
  }
});

test("village: rails, deck, walk cells and headroom win over leaves in every piece (no leaf within 3 above a deck or stair block)", () => {
  for (const p of villagePieces()) {
    for (const b of p.blocks) {
      if (b.name !== PLANKS && b.name !== SLAB_ID) continue;
      for (let h = 1; h <= 3; h++) assert.notEqual(p.at(b.x, b.y + h, b.z), LEAVES_ID, `${p.name}: leaf ${h} above deck at ${[b.x, b.y, b.z]}`);
    }
  }
});

test("village walkability: every shipped piece passes the checker (headroom over every step, rails guard drops, rail step links, connectors reachable)", () => {
  for (const p of villagePieces()) {
    if (p.name.startsWith("crown_")) continue;
    const must = p.name === "railing_end" ? [] : p.jigsaws.filter((j) => j.dir && (j.target === DECK_NAME || j.name === DECK_HI_NAME)).map((j) => ({ x: j.x, y: j.y + 1, z: j.z }));
    assert.ok(p.name === "railing_end" || must.length >= 1, `${p.name}: connectors`);
    const r = checkWalk(walkOf(railPosts(p)), { x0: 0, x1: p.size[0] - 1, y0: 0, y1: p.size[1] - 1, z0: 0, z1: p.size[2] - 1 }, { must });
    assert.deepEqual(r.violations.slice(0, 3), [], `${p.name}: ${r.violations.length} walkability violations`);
    assert.ok(r.components.length <= 1, `${p.name}: walk nodes split in ${r.components}`);
  }
});

test("village walkability fixtures: the owner's four stair problems are caught (low slab over the head, ring blocked, leaves in the way, rail without step link)", () => {
  assert.deepEqual(towerWalk().violations, [], "the generated tower is clean");
  const U = V_FLOOR + V_LEVEL, topSlab = { name: SLAB_ID, states: { "minecraft:vertical_half": "top" } }, fence = { name: FENCE, states: {} };
  // 1: the old top slab over ring cell 10 (surface 13 half-blocks, next tread 14): the head hits it while stepping up
  assert.ok(rulesOf(towerWalk((b) => b.set(`${RING[10][0]},${U},${RING[10][1]}`, topSlab))).includes("headroom"), "top slab over the step-up is a headroom violation");
  // 2: a fence wall across the deck beside the stair foot (what the old low, shifted stair rails amounted to): the walk ring is cut
  assert.ok(rulesOf(towerWalk((b) => { for (let x = 2; x <= 8; x++) b.set(`${x},${V_FLOOR + 1},0`, fence); })).includes("ring"), "a low rail line cuts the walk round the stair foot");
  // 3: a leaf block at the head of a tread
  assert.ok(rulesOf(towerWalk((b) => b.set(`${RING[6][0]},${V_FLOOR + 5},${RING[6][1]}`, { name: LEAVES_ID, states: {} }))).includes("headroom"), "leaves over a tread are a headroom violation");
  // 4: a rail that steps up one block with no post, and the same pair after linkRails
  assert.ok(rulesOf(towerWalk((b) => { b.set(`5,${V_FLOOR + 3},0`, fence); b.set(`6,${V_FLOOR + 4},0`, fence); })).includes("rail_link"), "missing up-forward link");
  const linked = new Set(["4,0,5", "5,1,5"]); linkRails(linked);
  assert.ok(linked.has("5,0,5"), "linkRails adds the post below the higher rail");
  // 5: an unguarded opening: the deck rails around the stair opening removed
  const noRails = towerWalk((b) => { for (const [k, v] of [...b]) { const [x, y, z] = k.split(",").map(Number); if (v.name === FENCE && y === U + 1 && Math.abs(x) <= 3 && Math.abs(z) <= 3) b.delete(k); } });
  assert.ok(rulesOf(noRails).includes("unguarded_edge"), "an opening without a rail is an unguarded edge");
});

test("village walkability: synthetic cases of the checker model (step height, ceilings, ropes, jump, protected cells)", () => {
  const deck = (n = 7) => { const m = new Map(); for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) m.set(`${x},0,${z}`, { name: PLANKS, states: {} }); return m; };
  const BOX = { x0: 0, x1: 8, y0: -1, y1: 8, z0: 0, z1: 8 };
  const run = (m, opts = {}) => checkWalk((x, y, z) => m.get(`${x},${y},${z}`), BOX, opts);
  const slab = (half = "bottom") => ({ name: SLAB_ID, states: { "minecraft:vertical_half": half } });
  const full = { name: PLANKS, states: {} };
  // a flat deck with a rim of fences: no violations; no rim: the edges are open drops
  const flat = deck(); for (let i = 0; i < 7; i++) for (const [x, z] of [[i, 0], [i, 6], [0, i], [6, i]]) flat.set(`${x},1,${z}`, { name: FENCE, states: {} });
  assert.deepEqual(run(flat).violations, []);
  assert.ok(rulesOf(run(deck())).includes("unguarded_edge"));
  // a bottom slab step (+0.5) walks; a full block (+1) is a wall unless the walker may jump
  const step = new Map(flat); step.set("4,1,4", slab());
  assert.equal(run(step).components.length, 1, "a slab step joins");
  const wall = new Map(flat); wall.set("4,1,4", full);
  assert.ok(run(wall).components.length >= 2, "a full block is a wall without a jump");
  assert.equal(run(wall, { jump: true }).components.length, 1, "with a jump the full block joins");
  // ceilings: a block 2 above a deck cell leaves 1.0 free (not a walk cell); a top slab 2 above a bottom-slab tread leaves 2.0 (ok)
  const low = new Map(flat); low.set("4,2,4", full);
  assert.equal(run(low).nodes.filter((n) => n.x === 4 && n.z === 4 && n.T === 1).length, 0, "1 block of air is not a walk cell");
  const ok = new Map(flat); ok.set("4,1,4", slab()); ok.set("4,3,4", slab("top"));
  assert.equal(run(ok).nodes.filter((n) => n.x === 4 && n.z === 4 && n.T === 1.5).length, 1, "bottom slab tread under a top slab: 2.0 free");
  // a rope side is a way down, not a fall
  const rope = deck(); rope.set("4,0,4", { name: "lothlorien:elven_rope_hanging", states: {} });
  assert.ok(!run(rope).violations.some((v) => v.rule === "unguarded_edge" && Math.abs(v.at[0] - 4) + Math.abs(v.at[2] - 4) === 1));
  // protected cells: rails, and the surface block plus the two cells above it
  const pc = protectedCells((x, y, z) => flat.get(`${x},${y},${z}`), BOX);
  assert.ok(pc.has("4,1,4") && pc.has("4,2,4") && pc.has("0,1,0") && !pc.has("4,3,4"));
});

test("village: crown pieces never reach a platform's rail, deck, walk or headroom cells in any of the 4 rollable rotations; crowns own only their cells (void elsewhere, no air)", () => {
  const pool = (id) => villageData.pools.get(`lothlorien:village/${id}`);
  const crownsOf = (first) => {
    const out = [];
    for (let id = first; id && id !== "minecraft:empty"; id = pool(id.split("/").pop())?.fallback) for (const e of pool(id.split("/").pop()).elements) out.push(villageData.getPiece(e.element.location));
    return out;
  };
  for (const tree of villagePieces().filter((p) => isTree(p.name))) {
    const up = tree.jigsaws.find((j) => j.dirId === 1), members = crownsOf(up.pool);
    assert.ok(members.length >= 1);
    const guarded = new Map();
    for (let y = 0; y < tree.size[1]; y++) for (let x = 0; x < tree.size[0]; x++) for (let z = 0; z < tree.size[2]; z++) {
      const n = tree.at(x, y, z);
      if ([PLANKS, SLAB_ID, FENCE, LANTERN_ID, "minecraft:air"].includes(n)) guarded.set(`${x},${y},${z}`, n);
    }
    for (const crown of members) {
      assert.equal(crown.blocks.filter((b) => b.name === "minecraft:air").length, 0, `${crown.name}: no air blocks (void outside its own cells)`);
      for (let r = 0; r < 4; r++) {
        const rp = rotated(crown, r), cj = rp.jigsaws.find((j) => j.dirId === 0);
        const o = [up.x - cj.x, up.y + 1 - cj.y, up.z - cj.z]; // the crown's jigsaw cell sits one above the platform's
        for (const b of rp.blocks) {
          const k = `${o[0] + b.x},${o[1] + b.y},${o[2] + b.z}`;
          assert.ok(!guarded.has(k), `${tree.name} + ${crown.name} rot ${r}: crown ${b.name} on platform ${guarded.get(k)} at ${k}`);
        }
        assert.ok(o[1] > tree.size[1] - 1, `${tree.name} + ${crown.name}: the crown box starts above the platform box`);
      }
    }
  }
});

test("village: block light - every walkable cell of every piece is lit to >= 8 by the emitters inside the piece (hidden light blocks, lamps; leaves, slabs and full blocks stop light; air, void, fences, lamps and decor pass it)", () => {
  assert.equal(LANTERN_LIGHT, readJson("../lothlorien_bp/blocks/elven_lantern.json")["minecraft:block"].components["minecraft:light_emission"], "the model uses the lantern's real emission");
  const worst = {};
  for (const p of villagePieces()) {
    const nameAt = (x, y, z) => { const n = p.at(x, y, z); return n === null ? undefined : n; };
    const grid = new Map(p.blocks.map(b => [`${b.x},${b.y},${b.z}`, b]));
    const r = worstLight(nameAt, { x0: 0, x1: p.size[0] - 1, y0: 0, y1: p.size[1] - 1, z0: 0, z1: p.size[2] - 1 }, (x,y,z) => grid.get(`${x},${y},${z}`)?.states);
    if (!r.cells) continue;
    assert.ok(r.worst >= LIGHT_TARGET, `${p.name}: walk cell ${r.at} has block light ${r.worst}`);
    const type = p.name.replace(/_(dog_)?\d+.*$/, "").replace(/_[a-z]$/, "");
    worst[type] = Math.min(worst[type] ?? 99, r.worst);
  }
  console.log("worst walk-cell block light per piece type:", JSON.stringify(worst));
});

finish();
