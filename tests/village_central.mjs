// The central tree of the Elven village (M7 WP2, tools/village_central.mjs; docs/design/village_central.md): Court, stair, Hall, stream, basin,
// reading circle. Reads the shipped piece (run `node tools/build_village.mjs` first). Nothing here is verified in game (2026-10-15).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMcstructure } from "../tools/village_sim.mjs";
import { waterCheck, supportCheck, keepClearViolations } from "../tools/village_checks.mjs";
import { FLOOR_H, LEVEL_H, ROOTS, STAIR7, stairLayer, RAIL } from "../tools/village_mallorn.mjs";
import { BASIN, SPRING } from "../tools/village_central.mjs";

let failed = 0;
function test(name, fn) { try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); } }
const piece = parseMcstructure(readFileSync(new URL("../lothlorien_bp/structures/lothlorien/village/central_mallorn_01.mcstructure", import.meta.url)), "central");
const [SX, SY, SZ] = piece.size, OX = (SX - 1) / 2, OZ = (SZ - 1) / 2, D = FLOOR_H, H = FLOOR_H + LEVEL_H;
// tree coordinates (trunk axis 0,0; nominal ground y 0) -> block name / states
const nameAt = (x, y, z) => piece.at(x + OX, y + ROOTS, z + OZ);
const blocks = new Map(piece.blocks.map((b) => [`${b.x - OX},${b.y - ROOTS},${b.z - OZ}`, { name: b.name, states: b.states }]));
const get = (x, y, z) => blocks.get(`${x},${y},${z}`);
const count = (re) => piece.blocks.filter((b) => re.test(b.name)).length;

test("central tree: 23 x 48 x 23, four Court connectors at deck 16, none on the Hall (+8), one upward crown jigsaw 5 above the Hall", () => {
  assert.deepEqual(piece.size, [23, ROOTS + H + 5 + 1, 23]);
  const horiz = piece.jigsaws.filter((j) => j.dir), up = piece.jigsaws.filter((j) => j.dirId === 1);
  assert.equal(horiz.length, 4); assert.ok(horiz.every((j) => j.y - ROOTS === D), "connectors on the Court layer");
  assert.equal(up.length, 1); assert.equal(up[0].y - ROOTS, H + 5);
  for (const [x, z] of [[0, -3]]) assert.equal(nameAt(x, D, z), "lothlorien:elven_rope_hanging", "the rope arrives at the Court (0, -3)");
  assert.equal(nameAt(0, H, -3), "lothlorien:mallorn_planks", "no rope hole in the Hall floor");
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { assert.equal(nameAt(x, D + 3, z), "lothlorien:mallorn_log", "stair pillar between the decks"); assert.notEqual(nameAt(x, 8, z), "lothlorien:mallorn_log", "the trunk is round below the Court"); }
});

test("central tree: the slab spiral climbs 16 half-block treads round the round trunk from the Court to the Hall, the exit on the west", () => {
  STAIR7.forEach(([x, z], i) => {
    const n = nameAt(x, D + stairLayer(i), z);
    assert.ok(n === "lothlorien:mallorn_planks" || n === "lothlorien:mallorn_slab", `tread ${i} at ${x},${z}: ${n}`);
  });
  assert.deepEqual(STAIR7[15], [-3, -1]); assert.equal(nameAt(-3, H, -1), "lothlorien:mallorn_planks", "the last tread is Hall floor");
  assert.ok(["minecraft:air", "minecraft:light_block_0"].includes(nameAt(-4, H + 1, -1)), "no rail at the exit"); // light_block_0: headroom shield
  assert.ok(["minecraft:air", "minecraft:light_block_0"].includes(nameAt(-3, H + 1, 2)), "the stair opening itself is open (railed on the outside)");
});

test("central tree: Hall inside the height limit (<= Hall + 5), open pavilion (17 posts), chandelier, lookout bay with a bench, spore blossoms, no froglights on the crest", () => {
  const above = piece.blocks.filter((b) => b.y - ROOTS > H + 5);
  assert.deepEqual(above, [], "nothing above Hall + 5");
  assert.ok(count(/stripped_log$/) >= 17 + 17, "posts + beam");
  assert.equal(count(/elven_chandelier$/), 1);
  assert.equal(count(/froglight$/), 0); // review 2026-10-15: bare white cubes on the dome
  assert.equal(count(/spore_blossom$/), 2);
  for (const z of [-1, 0, 1]) assert.ok(["minecraft:air", "minecraft:light_block_0"].includes(nameAt(8, H + 1, z)), "the bay's seats are native cushions (actors), the cells stay free");
  assert.equal(count(/mallorn_stairs$/), 0, "no stair seats (the engine links fences to stairs); seats are cushion actors (review 2026-10-15)");
  assert.ok(piece.entities.filter((e) => e.id === "minecraft:cushion").length >= 20, "the Hall seats, the bay bench and the reading circle are native cushions");
  assert.ok(count(/cushion/) === 0, "cushions are entities (no cushion blocks in a structure)");
});

test("central tree: 8-12 visible lamps (lanterns + chandelier), gold on the Court and in the Hall", () => {
  const lamps = piece.blocks.filter((b) => /elven_lantern|elven_chandelier/.test(b.name));
  assert.ok(lamps.length >= 8 && lamps.length <= 12, `${lamps.length} lamps`);
  assert.ok(lamps.filter((b) => b.y - ROOTS >= H).length >= 3, "lamps in the Hall");
  assert.ok(lamps.filter((b) => b.y - ROOTS < H).length >= 5, "lamps on the Court");
});

test("central tree stream: a spring vessel in the trunk, a contained trough (heartwood floor, full-block walls), a fall outside the Hall rim into a raised basin; waterCheck passes", () => {
  const { x: sx, z: sz } = SPRING;
  assert.equal(nameAt(sx, H + 4, sz), "minecraft:water", "spring source");
  for (const [dx, dz, y] of [[-1, 0, H + 4], [1, 0, H + 4], [0, 0, H + 3], [0, -1, H + 4]]) assert.ok(!/air$|water$/.test(nameAt(sx + dx, y, sz + dz)), `niche wall ${dx},${dz},${y}`);
  assert.match(nameAt(sx, H + 5, sz), /heartwood_stairs$/, "hood");
  for (let z = sz + 1; z <= 8; z++) {
    assert.equal(nameAt(sx, H + 4, z), "minecraft:water", `trough water at z ${z}`);
    assert.equal(nameAt(sx, H + 3, z), "lothlorien:mallorn_heartwood_planks", "trough floor");
    for (const dx of [-1, 1]) assert.ok(!/air$|water$/.test(nameAt(sx + dx, H + 4, z)), `trough wall ${dx},${z}`);
  }
  const [fx, fz] = BASIN.fall;
  for (let y = D + 2; y <= H + 4; y++) assert.equal(nameAt(fx, y, fz), "minecraft:flowing_water", `fall cell ${y}`);
  assert.equal(get(fx, H + 4, fz).states.liquid_depth, 8);
  // the basin: water at Court + 1 inside a rim of full blocks of the same height, floor = deck, outside the walk ring / paths
  for (let x = BASIN.x0; x <= BASIN.x1; x++) for (let z = BASIN.z0; z <= BASIN.z1; z++) {
    assert.ok(/water$|sea_pickle$/.test(nameAt(x, D + 1, z)), `basin cell ${x},${z}`);
    assert.equal(nameAt(x, D, z), "lothlorien:mallorn_planks", "floor");
  }
  for (let x = BASIN.x0 - 1; x <= BASIN.x1 + 1; x++) for (let z = BASIN.z0 - 1; z <= BASIN.z1 + 1; z++) {
    if (x >= BASIN.x0 && x <= BASIN.x1 && z >= BASIN.z0 && z <= BASIN.z1) continue;
    assert.match(nameAt(x, D + 1, z), /stripped_(wood|log)$/, `rim ${x},${z}`);
  }
  assert.ok(count(/waterlily$/) >= 2, "lily pads");
  assert.equal(count(/sea_pickle$/), 1);
  assert.equal(get(BASIN.x1, D + 1, BASIN.z0 + 1).states.__water, true, "the sea pickle is waterlogged (liquid layer)");
  assert.deepEqual(waterCheck(blocks), [], "every source has a vessel; the only flow is the fall");
  assert.deepEqual(supportCheck(blocks), [], "nothing floats");
  // water cells: the declared set of the piece
  assert.equal(count(/^minecraft:water$/), 1 + 6 + 8, "sources: niche + 6 trough cells + 8 basin cells (the 9th basin cell is the waterlogged pickle)");
  assert.equal(count(/^minecraft:flowing_water$/), H + 4 - (D + 2) + 1, "the fall: one falling cell per layer");
});

test("central tree: reading circle on the Court (chiseled bookshelves backed against the rim rail, a lectern, seats in a half ring, a banner pole), two banners by the rope", () => {
  assert.equal(count(/chiseled_bookshelf$/), 4);
  for (const x of [2, 3]) { assert.equal(nameAt(x, D + 1, -10), "minecraft:chiseled_bookshelf"); assert.equal(nameAt(x, D + 1, -11), RAIL, "rail line behind the shelves"); }
  assert.equal(count(/lectern$/), 1);
  for (const x of [-1, 1]) assert.equal(get(x, D + 4, -3).name, "minecraft:wall_banner", "banner by the rope");
  assert.equal(get(-1, D + 4, -3).states.facing_direction, 2); // faces north: the visitor's side
  assert.equal(nameAt(0, D, -3), "lothlorien:elven_rope_hanging");
});

test("central tree: elves - 2 wardens, the Loremaster and 4 reserve posts on the Court deck", () => {
  const posts = piece.entities.filter((e) => e.id === "lothlorien:elf_post"), wardens = piece.entities.filter((e) => e.id === "lothlorien:elven_warden");
  assert.equal(wardens.length, 2); assert.equal(posts.length, 5);
  for (const e of [...posts, ...wardens]) assert.equal(Math.floor(e.pos[1]) - ROOTS, D + 1, "standing on the Court layer");
});

// ---- crown stars (phase 3): lanterns on copper chains, froglights inside the blobs, spore blossoms; the last-resort crowns ---------------------------------------------
import { readdirSync } from "node:fs";
test("crown stars: every crown carries lanterns on green copper chains, central crowns 8-10 plus spore blossoms, froglights sit inside leaf blobs (no bare cube), all supported", () => {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  const want = { crown_small: [2, 1], crown_medium: [3, 2], crown_large: [4, 3], crown_central_a: [10, 3], crown_central_b: [8, 3], crown_tiny: [1, 0], crown_nub: [1, 0] };
  for (const [name, [lamps, fruit]] of Object.entries(want)) {
    const p = parseMcstructure(readFileSync(new URL(`${name}.mcstructure`, dir)), name), n = (re) => p.blocks.filter((b) => re.test(b.name)).length;
    assert.equal(n(/elven_lantern(_heartwood)?$/), lamps, `${name}: lanterns`);
    assert.ok(n(/waxed_oxidized_copper_chain$/) >= lamps, `${name}: chains`);
    assert.equal(n(/froglight$/), fruit, `${name}: froglights`);
    if (name.startsWith("crown_central")) assert.equal(n(/spore_blossom$/), 2, `${name}: spore blossoms`);
    const m = new Map(p.blocks.map((b) => [`${b.x},${b.y},${b.z}`, { name: b.name, states: b.states }]));
    assert.deepEqual(supportCheck(m), [], `${name}: nothing floats`);
    for (const b of p.blocks.filter((q) => /froglight$/.test(q.name))) { // glowing fruit: at most one open face, never the top one
      const open = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].filter(([dx, dy, dz]) => !/leaves|_log$|_wood$/.test(p.at(b.x + dx, b.y + dy, b.z + dz) ?? ""));
      assert.ok(open.length <= 1 && !open.some((o) => o[1] === 1), `${name}: froglight at ${b.x},${b.y},${b.z} is inside the blob`);
    }
  }
});
test("no stub trees: the crown pools end in last-resort crowns (7 x 8 x 7 and 5 x 8 x 5), every tree piece's trunk top carries a leaf cap", () => {
  const dir = "../lothlorien_bp/structures/lothlorien/village/";
  for (const [name, size] of [["crown_tiny", [7, 8, 7]], ["crown_nub", [5, 8, 5]]]) assert.deepEqual(parseMcstructure(readFileSync(new URL(`${dir}${name}.mcstructure`, import.meta.url)), name).size, size);
  for (const f of readdirSync(new URL(dir, import.meta.url)).filter((q) => /^combo_(node|tower)/.test(q))) {
    const p = parseMcstructure(readFileSync(new URL(dir + f, import.meta.url)), f), up = p.jigsaws.find((j) => j.dirId === 1);
    const leaves = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => p.at(up.x + dx, up.y, up.z + dz) === "lothlorien:mallorn_leaves").length;
    assert.ok(leaves >= 2, `${f}: leaf cap round the crown jigsaw (${leaves})`);
  }
});

if (failed) throw new Error(`${failed} central tree test(s) failed`);
