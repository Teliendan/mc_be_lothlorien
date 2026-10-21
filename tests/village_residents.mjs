// village residents regression tests; run independently or via tests/run.mjs.
import { test, finish } from './test_helpers.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { B } from "../tools/flet_mallorn.mjs";
import { readdirSync } from "node:fs";
import { parseMcstructure, PLANKS, FENCE } from "../tools/village_sim.mjs";
import * as EL from "../lothlorien_bp/scripts/elf_rules.js";
import * as EW from "../lothlorien_bp/scripts/elven_warden_rules.js";

const at = (t, x, y, z) => t.blocks.get(`${x},${y},${z}`)?.name;
const VILLAGE = "../lothlorien_bp/structures/lothlorien/village";
const villagePieces = () => readdirSync(new URL(`${VILLAGE}/`, import.meta.url)).filter((f) => f.endsWith(".mcstructure")).map((f) =>
  parseMcstructure(readFileSync(new URL(`${VILLAGE}/${f}`, import.meta.url)), f.replace(".mcstructure", "")));
const isAirName = (n) => n === null || n === undefined || n === "minecraft:air";
const postsOf = (p) => p.entities.filter((e) => e.id === EL.POST_ID).map((e) => ({ e, x: Math.floor(e.pos[0]), y: Math.floor(e.pos[1]), z: Math.floor(e.pos[2]), kind: e.defs[1].slice(`+${EL.POST_GROUP_PREFIX}`.length) }));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

test("elf posts in pieces: central tree 1 loremaster + RESERVE_POSTS reserves, every combo one home post, nothing else; groups via the definitions list", () => {
  const counts = {};
  for (const p of villagePieces()) {
    const posts = postsOf(p), kinds = posts.map((q) => q.kind).sort();
    counts[p.name] = posts.length;
    if (p.name === "central_mallorn_01") assert.deepEqual(kinds, ["loremaster", ...Array(EL.RESERVE_POSTS).fill("reserve")].sort(), "central posts");
    else if (p.name.startsWith("combo_")) assert.deepEqual(kinds, ["home"], `${p.name}: exactly one home post`);
    else assert.deepEqual(kinds, [], `${p.name}: no posts`);
    for (const q of posts) {
      assert.deepEqual(q.e.defs, [`+${EL.POST_ID}`, `+${EL.POST_GROUP_PREFIX}${q.kind}`], `${p.name}: definitions`);
      assert.ok(q.x > 0 && q.x < p.size[0] && q.z > 0 && q.z < p.size[2] && q.y > 0 && q.y < p.size[1], `${p.name}: inside the box`);
      assert.equal(q.e.invulnerable, true, `${p.name}: posts cannot be hurt`);
    }
  }
  assert.ok(Object.values(counts).filter((n) => n === 1).length >= 20, "about 23 combo pieces carry a post");
});

test("elf posts stand on deck: planks underneath, three cells of air, open deck around (central), POST_SPACING from wardens and other posts, Loremaster by the rope", () => {
  for (const p of villagePieces()) {
    const posts = postsOf(p), wardens = p.entities.filter((e) => e.id === EW.WARDEN_ID).map((e) => ({ x: Math.floor(e.pos[0]), z: Math.floor(e.pos[2]) }));
    for (const q of posts) {
      assert.equal(p.at(q.x, q.y - 1, q.z), PLANKS, `${p.name}: deck under the post`);
      for (const h of [0, 1, 2]) assert.ok(isAirName(p.at(q.x, q.y + h, q.z)) || /^minecraft:light_block_\d+$/.test(p.at(q.x, q.y + h, q.z)), `${p.name}: headroom ${h}`); // a hidden light block is air to stand in
      for (const w of wardens) assert.ok(cheb(q, w) >= EL.POST_SPACING, `${p.name}: ${cheb(q, w)} cells from a warden`);
      for (const o of posts) if (o !== q) assert.ok(cheb(q, o) >= EL.POST_SPACING, `${p.name}: posts ${cheb(q, o)} apart`);
      if (q.kind !== "home") for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { // full warden margins on the big central deck
        assert.notEqual(p.at(q.x + dx, q.y, q.z + dz), FENCE, `${p.name}: away from rails`);
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) assert.ok([PLANKS, "lothlorien:mallorn_heartwood_planks"].includes(p.at(q.x + dx, q.y - 1, q.z + dz)), `${p.name}: open deck around`);
      }
      if (q.kind === "loremaster") {
        const rope = p.blocks.filter((b) => b.name === B.ropeHanging && b.y === q.y - 1);
        assert.ok(rope.length >= 1, "rope on the deck layer");
        for (const r of rope) assert.ok(cheb(q, r) >= EL.ROPE_CLEARANCE, `${p.name}: Loremaster ${cheb(q, r)} from the rope`);
        assert.ok(Math.hypot(q.x - rope[0].x, q.z - rope[0].z) <= 6, "the Loremaster stands by the rope top");
      }
      if (q.kind === "home") { // inside the biggest free square of the lower deck
        const at = (x, y, z) => p.at(x, y, z) ?? "minecraft:air", mine = EL.homeSite(at, q.x, q.y - 1, q.z);
        // a pavilion (village_dress.mjs, WP3) has a marker lantern: a gold elven lantern hanging at deck + 3; the post stands inside its square (its furnishing area is the free space,
        // not a 3 x 3 square of homeSite). Without one (no pavilion fits) the post stands in the reserved biggest free square.
        const marker = p.blocks.find((b) => b.name === "lothlorien:elven_lantern_heartwood" && b.states["minecraft:block_face"] === "down" && b.y === q.y + 2 && cheb(b, q) <= 3);
        if (marker) { assert.ok(cheb(marker, q) <= 2, `${p.name}: the home post is within 2 cells of the pavilion lantern`); continue; }
        assert.ok(mine && mine.k >= EL.HOME_MIN_SQUARE, `${p.name}: a free square round the home post`);
        let best = 0;
        for (const b of p.blocks) if ((b.name === PLANKS || b.name === "lothlorien:mallorn_heartwood_planks") && b.y === q.y - 1 && !wardens.some((w) => cheb(b, w) < EL.POST_SPACING)) best = Math.max(best, EL.homeSite(at, b.x, b.y, b.z)?.k ?? 0);
        assert.equal(mine.k, best, `${p.name}: the post stands in the biggest free square (${best})`);
      }
    }
  }
});

finish();
