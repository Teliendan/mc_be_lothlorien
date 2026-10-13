import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFletMallorn, B, ROUND_LADDER } from "../tools/flet_mallorn.mjs";
import { makeRandom } from "../lothlorien_bp/scripts/mallorn_tree.js";
import { CHOSEN, VARIANTS, TRUNK_AT, ANCHOR_AT, TRUNK_ANCHOR, toMcstructure } from "../tools/build_structures.mjs";
import { ROOT_DEPTH } from "../tools/flet_mallorn.mjs";
import { parseMcstructure, readNbt } from "../tools/village_sim.mjs";
import { furnishWatchCamp, watchCampLoot, CAMP_LANTERN } from "../tools/watch_camp.mjs";
import { CAMP } from "../tools/watch_camp_rules.mjs";
import { blockLight, defaultPasses } from "../../../.claude/skills/bedrock-modding/scripts/structure_light.mjs";

const bp = new URL("../lothlorien_bp/", import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, bp), "utf8"));
const key = (x, y, z) => `${x},${y},${z}`;
const emitted = json("blocks/elven_lantern.json")["minecraft:block"].components["minecraft:light_emission"];
for (const [variant, seed] of CHOSEN) {
  const path = `structures/lothlorien/mallorn_${variant}_${String(seed).padStart(2, "0")}.mcstructure`;
  const bytes = readFileSync(new URL(path, bp));
  const raw = readNbt(bytes), piece = parseMcstructure(bytes, path);
  if (variant === "roundplain") {
    assert.equal(piece.entities.length, 0, `${path}: no camp on a plain giant`);
    assert.ok(!piece.blocks.some((b) => /straw_bed|banner|lantern|carpet/.test(b.name)));
    continue;
  }
  const get = (x, y, z) => piece.at(x, y, z);
  const wardens = raw.structure.entities.filter((e) => e.identifier === "lothlorien:elven_warden");
  const cushions = raw.structure.entities.filter((e) => e.identifier === "minecraft:cushion");
  assert.equal(wardens.length, 2);
  assert.deepEqual(cushions.map((e) => e.Variant).sort((a, b) => a-b), [2, 7]);
  for (const e of [...wardens, ...cushions]) {
    const [x, y, z] = e.Pos.map(Math.floor);
    assert.ok([B.planks, B.log].includes(get(x, y - 1, z)), `${path}: entity support`);
    assert.ok(!get(x, y, z) && !get(x, y + 1, z), `${path}: entity headroom`);
    assert.equal(e.Invulnerable, 0);
    assert.equal(e.isPersistent, 1);
  }
  for (const e of wardens) {
    assert.ok(e.definitions.includes("+lothlorien:village_warden"));
    assert.equal(e.Mainhand[0].Name, "minecraft:bow");
  }
  const beds = piece.blocks.filter((b) => b.name === "minecraft:straw_bed");
  assert.equal(beds.length, 4);
  for (const b of beds) {
    assert.equal(b.states["minecraft:cardinal_direction"], "north");
    assert.equal(b.states.occupied_bit, 0);
    const partner = beds.find((p) => p.x === b.x && p.z === b.z + (b.states.head_piece_bit ? 1 : -1));
    assert.ok(partner && partner.states.head_piece_bit !== b.states.head_piece_bit, `${path}: complete bed pair`);
    assert.ok([B.planks, B.log].includes(get(b.x, b.y - 1, b.z)));
    assert.equal(get(b.x, b.y + 1, b.z), null);
  }
  const banner = Object.values(raw.structure.palette.default.block_position_data).map((p) => p.block_entity_data).find((e) => e.id === "Banner");
  assert.equal(banner.Base, 2);
  assert.equal(banner.Type, 0);
  assert.deepEqual(banner.Patterns, [
    { Pattern: "cr", Color: 10 }, { Pattern: "bt", Color: 10 }, { Pattern: "tt", Color: 10 },
    { Pattern: "cbo", Color: 7 }, { Pattern: "ms", Color: 10 }, { Pattern: "flo", Color: 2 },
  ]);
  assert.ok([B.log, B.wood].includes(get(banner.x, banner.y, banner.z - 1)), "banner attached to trunk");
  assert.equal(piece.blocks.filter((b) => b.name === CAMP_LANTERN).length, 4);
  const light = blockLight(get, piece.size, { [CAMP_LANTERN]: emitted }, (n) => n === null || defaultPasses(n));
  const y = wardens[0].Pos[1], walk = new Set();
  for (const b of piece.blocks) if (b.y === y-1 && [B.planks, B.log].includes(b.name) &&
    [null, "minecraft:air", "minecraft:green_carpet"].includes(get(b.x, y, b.z)) &&
    [null, "minecraft:air"].includes(get(b.x, y+1, b.z))) walk.add(key(b.x, y, b.z));
  for (const cell of walk) assert.ok((light.get(cell) ?? 0) >= CAMP.lightMinimum, `${path}: dark deck ${cell}`);
  // A player can reach the chest, both guards and both cushions from the rope landing without jumping furniture.
  const start = key(TRUNK_AT + ROUND_LADDER.x, y, TRUNK_AT + ROUND_LADDER.z - 1);
  assert.ok(walk.has(start));
  const reached = new Set([start]), queue = [start];
  for (let i=0; i<queue.length; i++) {
    const [x, yy, z] = queue[i].split(",").map(Number);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const cell = key(x+dx, yy, z+dz);
      if (walk.has(cell) && !reached.has(cell)) { reached.add(cell); queue.push(cell); }
    }
  }
  for (const e of [...wardens, ...cushions]) assert.ok(reached.has(key(...e.Pos.map(Math.floor))), `${path}: inaccessible ${e.identifier}`);
  const chest = piece.blocks.find((b) => b.name === "minecraft:chest");
  assert.ok(reached.has(key(chest.x+1, y, chest.z)), "chest approach clear");
  for (const head of beds.filter((b) => b.states.head_piece_bit)) assert.ok(
    [[1,0],[-1,0],[0,-1]].some(([dx,dz]) => reached.has(key(head.x+dx, y, head.z+dz))), "bed reachable");
}

// Plain giants stay byte-identical to the unfurnished generator, and camps regenerate exactly.
for (const [variant, seed] of CHOSEN) {
  const t = buildFletMallorn(makeRandom(seed*7919), VARIANTS[variant]);
  const original = toMcstructure(t.blocks).buffer;
  const entities = furnishWatchCamp(t);
  if (variant === "roundplain") assert.deepEqual(toMcstructure(t.blocks).buffer, original);
  else assert.equal(entities.filter((e) => e.id === "minecraft:cushion").length, 2);
  t.blocks.set(key(ANCHOR_AT.x, ANCHOR_AT.y, ANCHOR_AT.z), {
    name: "minecraft:jigsaw", states: { facing_direction: 0, rotation: 0 },
    jigsaw: TRUNK_ANCHOR, finalState: B.log,
  });
  const local = entities.map((e) => ({ ...e, x: e.x+TRUNK_AT, y: e.y+ROOT_DEPTH, z: e.z+TRUNK_AT }));
  const rebuilt = toMcstructure(t.blocks, undefined, undefined, local).buffer;
  assert.deepEqual(rebuilt, readFileSync(new URL(`structures/lothlorien/mallorn_${variant}_${String(seed).padStart(2,"0")}.mcstructure`, bp)), "shipped tree matches generator");
}

const loot = json("loot_tables/chests/mallorn_flet.json");
assert.deepEqual(loot, watchCampLoot(), "generated loot is current");
const shield = loot.pools[2].entries.find((e) => e.name === "minecraft:shield");
assert.equal(shield.weight / loot.pools[2].entries.reduce((s,e) => s+e.weight,0), 0.25);
assert.deepEqual(shield.functions[0], { function: "set_banner_details", type: 0, base_color: "green", patterns: [
  {pattern:"cross",color:"lime"}, {pattern:"triangles_bottom",color:"lime"}, {pattern:"triangles_top",color:"lime"},
  {pattern:"curly_border",color:"silver"}, {pattern:"stripe_middle",color:"lime"}, {pattern:"flower",color:"green"},
] });
const supplies = loot.pools[1].entries.map((e) => e.name);
for (const id of ["morning_dew", "bottle_of_fireflies", "mallorn_nectar", "elven_rope", "athelas_salve", "galadhrim_arrow"])
  assert.ok(supplies.includes(`lothlorien:${id}`));
assert.ok(!JSON.stringify(loot).includes("great_mallorn_nut"));
console.log("ok - Great Mallorn watch camps: supported furniture, accessible deck, night light, persistent guards and silver-pattern loot");
