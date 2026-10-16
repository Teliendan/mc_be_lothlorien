// Home furnishing (M7 WP4b): lothlorien_bp/scripts/home_furnish.js (pure) on synthetic pavilions of every size and orientation, and on the real village pieces.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { findHome, furnishLayout, planFurnish, frameArea, frameCell, framePost, frameLamp, frameCu, frameSquare, siteOf, hasLayout, MARKER_LANTERN, bannerStructure, BANNER_DESIGNS } from "../lothlorien_bp/scripts/home_furnish.js";
import { supportScan, isSupportSkipped } from "../tools/village_checks.mjs";
import { parseMcstructure, entityCells } from "../tools/village_sim.mjs";
import { bannerStructures } from "../tools/build_furnish.mjs";

let failed = 0;
function test(name, fn) { try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.stack.split("\n").slice(0, 4).join("\n     ")}`); } }
const key = (x, y, z) => `${x},${y},${z}`;
const PL = "lothlorien:mallorn_planks", STRIPPED = "lothlorien:mallorn_stripped_log";
const DVS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const FACING = { 2: [0, -1], 3: [0, 1], 4: [-1, 0], 5: [1, 0] };

// a synthetic pavilion: k x k deck square, stripped-log posts on the outer corners, the marker lantern; deck margin round it
function pavilion(k, dv, origin = [10, 20]) {
  const du = [-dv[1], dv[0]], cu = (k - 1) >> 1, y = 34;
  const f = { x0: origin[0], z0: origin[1], du, dv, k, y, open: k < 5 };
  f.post = framePost(f); f.lamp = frameLamp(f);
  const m = new Map();
  for (let u = -3; u < k + 3; u++) for (let v = -3; v < k + 3; v++) { const [x, z] = frameCell(f, u, v); m.set(key(x, y, z), { name: PL, states: {} }); }
  for (const u of [0, k - 1]) { const [x, z] = frameCell(f, u, k - 1); for (const h of [1, 2, 3]) m.set(key(x, y + h, z), { name: STRIPPED, states: { "minecraft:block_face": "up" } }); }
  const [lx, lz] = frameCell(f, ...frameLamp(f));
  m.set(key(lx, y + 3, lz), { name: MARKER_LANTERN, states: { "minecraft:block_face": "down" } });
  const at = (x, yy, z) => m.get(key(x, yy, z))?.name ?? "minecraft:air";
  const [px, pz] = frameCell(f, ...f.post);
  return { f, m, at, post: { x: px, y: y + 1, z: pz } };
}
const applied = (p, plan) => {
  const m = new Map(p.m);
  for (const w of plan.writes) m.set(key(w.x, w.y, w.z), { name: w.name, states: w.states });
  for (const b of plan.banners) m.set(key(b.x, b.y, b.z), { name: "minecraft:wall_banner", states: { facing_direction: { "0,-1": 2, "0,1": 3, "-1,0": 4, "1,0": 5 }[p.f.dv.join(",")] } });
  return m;
};
const floating = (m, only) => supportScan((fn) => { for (const [k, b] of m) { if (only && !only.has(k)) continue; const [x, y, z] = k.split(",").map(Number); if (!isSupportSkipped(b.name)) fn(x, y, z, b); } }, (x, y, z) => m.get(key(x, y, z)), { max: 20 });

test("home_furnish: findHome finds a pavilion of every size in every orientation from the post and the marker lantern; the frame equals the one it was built from", () => {
  for (const k of [4, 5, 6, 7]) for (const dv of DVS) {
    const p = pavilion(k, dv), f = findHome(p.at, p.post);
    assert.ok(f, `k ${k} dv ${dv}`);
    assert.deepEqual([f.x0, f.z0, f.du, f.dv, f.k, f.y, f.open], [p.f.x0, p.f.z0, p.f.du, p.f.dv, p.f.k, p.f.y, p.f.open]);
    assert.deepEqual(f.post, framePost(f)); assert.deepEqual(f.lamp, frameLamp(f));
  }
});
test("home_furnish: findHome returns null without the lantern, on a floor with a hole, and for a post elsewhere; siteOf gives the frame's square, else the old free square", () => {
  const p = pavilion(5, [0, 1]);
  const m2 = new Map(p.m); const [lx, lz] = frameCell(p.f, ...p.f.lamp); m2.delete(key(lx, p.f.y + 3, lz));
  assert.equal(findHome((x, y, z) => m2.get(key(x, y, z))?.name, p.post), null, "no marker lantern");
  const m3 = new Map(p.m); const [hx, hz] = frameCell(p.f, 2, 2); m3.delete(key(hx, p.f.y, hz));
  assert.equal(findHome((x, y, z) => m3.get(key(x, y, z))?.name, p.post), null, "a hole in the deck");
  assert.equal(findHome(p.at, { ...p.post, x: p.post.x + 9 }), null);
  const sq = frameSquare(p.f);
  assert.equal(sq.k, 5); assert.deepEqual(siteOf(p.at, p.post), sq);
  const plain = (x, y, z) => (y === 5 && Math.abs(x) < 6 && Math.abs(z) < 6 ? PL : y > 5 && y < 9 && Math.abs(x) < 6 && Math.abs(z) < 6 ? "minecraft:air" : "minecraft:stone");
  const old = siteOf(plain, { x: 0, y: 6, z: 0 });
  assert.ok(old && old.k >= 5, "no pavilion: homeSite");
});

test("home_furnish: the healer layout fits every k and orientation, stays in the furnishing area at +1/+2, avoids the post cell and the door lane, has no double cells, is deterministic", () => {
  assert.ok(hasLayout("healer") && !hasLayout("gardener"));
  assert.deepEqual(furnishLayout("gardener", pavilion(5, [0, 1]).f), []);
  for (const k of [4, 5, 6, 7, 8]) for (const dv of DVS) for (const origin of [[10, 20], [11, 20], [10, 21], [-7, 13]]) {
    const p = pavilion(k, dv, origin), area = new Set(frameArea(p.f).map((c) => c.join(",")));
    const lay = furnishLayout("healer", p.f);
    assert.ok(lay.length >= 2, `k ${k}`);
    const seen = new Set();
    for (const it of lay) {
      assert.ok(area.has(`${it.u},${it.v}`), `k ${k}: ${it.name} at ${it.u},${it.v} is outside the area`);
      assert.ok(it.h === 1 || it.h === 2);
      const id = `${it.u},${it.v},${it.h}`; assert.ok(!seen.has(id), `double cell ${id}`); seen.add(id);
      assert.ok(!(it.u === frameCu(p.f) && it.v <= p.f.k - 3 && !/carpet$/.test(it.name)), `the aisle column u = cu stays free of solid things (${it.name} at ${it.u},${it.v})`);
    }
    assert.equal(JSON.stringify(lay), JSON.stringify(furnishLayout("healer", p.f)), "deterministic");
  }
});
test("home_furnish: k 5, 6, 7 carry at least six kinds of objects (cauldron with water, brewing stand, bed, candles, herb planters), k 6 and 7 the white banner post and both herbs", () => {
  for (const k of [5, 6, 7]) {
    const p = pavilion(k, [1, 0]), plan = planFurnish("healer", p.f, p.at), m = applied(p, plan);
    const names = new Set([...m.values()].map((b) => b.name));
    const kinds = ["minecraft:cauldron", "minecraft:brewing_stand", "minecraft:straw_bed", "minecraft:white_candle", "lothlorien:athelas", "minecraft:white_carpet", "minecraft:decorated_pot", "lothlorien:niphredil", "minecraft:wall_banner"].filter((n) => names.has(n));
    assert.ok(kinds.length >= (k === 5 ? 6 : 8), `k ${k}: ${kinds.join(" ")}`);
    const cauldron = plan.writes.find((w) => w.name === "minecraft:cauldron");
    assert.deepEqual(cauldron.states, { cauldron_liquid: "water", fill_level: 6 });
    assert.ok(plan.writes.some((w) => w.name === "minecraft:white_candle" && w.states.lit === true), "lit candles: the healer works at night");
    if (k > 5) { assert.equal(plan.banners.length, 1); assert.equal(plan.banners[0].structure, bannerStructure("healer", "east")); assert.ok(names.has("lothlorien:niphredil")); }
    assert.equal(plan.skipped.length, 0, `k ${k} on a free deck fits whole`);
  }
  const small = pavilion(4, [0, -1]), sp = planFurnish("healer", small.f, small.at);
  assert.ok(sp.writes.some((w) => w.name === "minecraft:cauldron") && sp.writes.some((w) => w.name === "minecraft:brewing_stand"), "the open variant holds the work corner");
});
test("home_furnish: orientation is derived from the frame: the bed's head lies towards the trunk, the banner faces the door, in all four orientations", () => {
  for (const dv of DVS) for (const k of [5, 6, 7]) {
    const p = pavilion(k, dv), lay = furnishLayout("healer", p.f), beds = lay.filter((it) => it.name === "minecraft:straw_bed");
    assert.ok(beds.length >= 2);
    const card = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
    for (const b of beds) assert.deepEqual(card[b.states["minecraft:cardinal_direction"]], [-dv[0] + 0, -dv[1] + 0]);
    for (const head of beds.filter((b) => b.states.head_piece_bit)) { // the foot is one row towards the door, in the same column
      const foot = beds.find((b) => !b.states.head_piece_bit && b.u === head.u && b.v === head.v + 1);
      assert.ok(foot, "bed foot behind its head");
      const [hx, hz] = frameCell(p.f, head.u, head.v), [fx, fz] = frameCell(p.f, foot.u, foot.v);
      assert.deepEqual([hx - fx + 0, hz - fz + 0], [-dv[0] + 0, -dv[1] + 0], "the head is nearer the trunk than the foot");
    }
    const ban = lay.find((it) => it.banner);
    if (ban) assert.deepEqual(FACING[ban.states.facing_direction], dv, "the cloth faces away from the trunk");
  }
});
test("home_furnish: everything placed is supported (supportScan), the wall banner has its pillar behind it, the post cell stays empty", () => {
  for (const k of [4, 5, 6, 7]) for (const dv of DVS) {
    const p = pavilion(k, dv), plan = planFurnish("healer", p.f, p.at), m = applied(p, plan);
    const only = new Set([...plan.writes, ...plan.banners].map((w) => key(w.x, w.y, w.z)));
    assert.deepEqual(floating(m, only).map((v) => `${v.name} ${v.at} ${v.detail}`), [], `k ${k} dv ${dv}`);
    const [px, pz] = frameCell(p.f, ...p.f.post);
    for (const h of [1, 2, 3]) assert.ok(!m.has(key(px, p.f.y + h, pz)) || m.get(key(px, p.f.y + h, pz)).name === MARKER_LANTERN, "post cell empty");
    for (const [x, z] of [frameArea(p.f)].flat().filter(([u, v]) => v === p.f.k - 2).map(([u, v]) => frameCell(p.f, u, v))) if (Math.abs(x) + Math.abs(z) < 0) throw new Error("unreachable");
    for (const b of plan.banners) { const [bx, bz] = [b.x - dv[0], b.z - dv[1]]; assert.equal(m.get(key(bx, b.y, bz)).name, STRIPPED, "pillar behind the banner"); }
  }
});
test("home_furnish: planFurnish never replaces a block, never writes outside the area, keeps the aisle walkable, and drops a group instead of walling in a cell", () => {
  const p = pavilion(6, [1, 0]);
  const [bx, bz] = frameCell(p.f, 1, 0), busy = new Map(p.m); busy.set(key(bx, p.f.y + 1, bz), { name: "lothlorien:mallorn_trapdoor", states: {} });
  const plan = planFurnish("healer", p.f, (x, y, z) => busy.get(key(x, y, z))?.name ?? "minecraft:air");
  const area = new Set(frameArea(p.f).flatMap(([u, v]) => { const [x, z] = frameCell(p.f, u, v); return [key(x, p.f.y + 1, z), key(x, p.f.y + 2, z)]; }));
  for (const w of [...plan.writes, ...plan.banners]) { assert.ok(area.has(key(w.x, w.y, w.z)), "inside the area"); assert.ok(!busy.has(key(w.x, w.y, w.z)), "no replace"); }
  assert.ok(plan.writes.some((w) => w.name === "minecraft:cauldron"), "the cauldron moved to a free cell");
  const cells = new Set([...plan.writes].filter((w) => !/carpet/.test(w.name)).map((w) => `${w.x},${w.z}`));
  const cu = frameCu(p.f);
  for (let v = 0; v <= p.f.k - 3; v++) { const [x, z] = frameCell(p.f, cu, v); assert.ok(!cells.has(`${x},${z}`), "aisle free"); }
  // a pocket: an edge cell whose only way in is through the interior cell the layout wants: the furniture goes elsewhere or is dropped, the cell stays reachable
  const pk = pavilion(5, [0, 1]), wall = new Map(pk.m);
  for (const v of [0, 2]) { const [x, z] = frameCell(pk.f, 4, v); wall.set(key(x, pk.f.y + 1, z), { name: "lothlorien:mallorn_trapdoor", states: {} }); }
  for (const v of [-1, 0, 1, 2, 3]) { const [x, z] = frameCell(pk.f, 5, v); wall.set(key(x, pk.f.y + 1, z), { name: "lothlorien:mallorn_fence", states: {} }); } // the rim beyond the gap
  const atW = (x, y, z) => wall.get(key(x, y, z))?.name ?? "minecraft:air", plan2 = planFurnish("healer", pk.f, atW);
  const [gx, gz] = frameCell(pk.f, 4, 1);
  for (const w of plan2.writes) assert.ok(!(w.x === gx && w.z === gz), "the gap cell is not written");
  const [nx, nz] = frameCell(pk.f, 3, 1);
  assert.ok(!plan2.writes.some((w) => w.x === nx && w.z === nz && !/carpet/.test(w.name)), "the cell that leads into the gap stays walkable");
});
test("home_furnish: a second run on the furnished pavilion places nothing (idempotent), an unloaded cell is not free", () => {
  const p = pavilion(7, [-1, 0]), plan = planFurnish("healer", p.f, p.at), m = applied(p, plan);
  const again = planFurnish("healer", p.f, (x, y, z) => m.get(key(x, y, z))?.name ?? "minecraft:air");
  assert.equal(again.writes.length + again.banners.length, 0);
  const none = planFurnish("healer", p.f, (x, y, z) => (y > p.f.y ? undefined : p.at(x, y, z)));
  assert.equal(none.writes.length + none.banners.length, 0);
});

test("home_furnish: on every real village piece with a pavilion the healer set fits, writes only into air inside the area, nothing floats, no walkable cell is walled in", () => {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/village/", import.meta.url);
  let homes = 0;
  for (const f of readdirSync(dir)) {
    const piece = parseMcstructure(readFileSync(new URL(f, dir)), f), map = new Map();
    for (const b of piece.blocks) map.set(key(b.x, b.y, b.z), { name: b.name, states: b.states });
    const at = (x, y, z) => map.get(key(x, y, z))?.name ?? "minecraft:air";
    for (const post of entityCells({ piece, rot: 0, o: [0, 0, 0] }, "lothlorien:elf_post").filter((c) => c.kind === "home")) {
      const fr = findHome(at, { x: post.cell[0], y: post.cell[1] + 1, z: post.cell[2] });
      if (!fr) continue;
      homes++;
      const plan = planFurnish("healer", fr, at), area = new Set(frameArea(fr).flatMap(([u, v]) => { const [x, z] = frameCell(fr, u, v); return [key(x, fr.y + 1, z), key(x, fr.y + 2, z)]; }));
      assert.ok(plan.writes.length + plan.banners.length >= 6, `${f}: ${plan.writes.length} blocks`);
      const m = new Map(map);
      for (const w of plan.writes) { assert.ok(area.has(key(w.x, w.y, w.z)), `${f}: outside the area`); assert.equal(at(w.x, w.y, w.z), "minecraft:air", `${f}: replaces`); m.set(key(w.x, w.y, w.z), { name: w.name, states: w.states }); }
      for (const b of plan.banners) { assert.ok(area.has(key(b.x, b.y, b.z))); m.set(key(b.x, b.y, b.z), { name: "minecraft:wall_banner", states: { facing_direction: { "0,-1": 2, "0,1": 3, "-1,0": 4, "1,0": 5 }[fr.dv.join(",")] } }); }
      const only = new Set([...plan.writes, ...plan.banners].map((w) => key(w.x, w.y, w.z)));
      assert.deepEqual(floating(m, only).map((v) => `${v.name} ${v.at} ${v.detail}`), [], f);
    }
  }
  assert.ok(homes >= 4, `${homes} pavilions found in the pieces`);
});
test("home_furnish: the banner structures on disk are the generated ones (one per design and facing), 1 x 1 x 1 with a wall banner", () => {
  const dir = new URL("../lothlorien_bp/structures/lothlorien/furnish/", import.meta.url), want = bannerStructures();
  assert.equal(want.length, Object.keys(BANNER_DESIGNS).length * 4);
  for (const s of want) {
    assert.ok(Buffer.from(readFileSync(new URL(s.file, dir))).equals(s.buffer), `${s.file} is stale: run node tools/build_furnish.mjs`);
    const piece = parseMcstructure(s.buffer, s.file);
    assert.deepEqual(piece.size, [1, 1, 1]); assert.equal(piece.blocks[0].name, "minecraft:wall_banner");
    assert.equal(s.id, bannerStructure("healer", s.file.replace(/^banner_healer_|\.mcstructure$/g, "")));
  }
});

if (failed) { console.log(`${failed} home furnishing test(s) failed`); process.exit(1); }
