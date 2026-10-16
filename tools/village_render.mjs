// Pictures of the Elven village: pieces, simulated villages and real world dumps, as PNG (software renderer, no game needed).
// Run from mods/lothlorien; every command writes into temp/village_render/ and prints the file names.
//
//   node tools/village_render.mjs piece <name> [rot=0] [--leaves]        isometric + top view of one .mcstructure piece (file name without .mcstructure, e.g. combo_node_b_west_bridge_11, crown_medium, balcony_braced)
//   node tools/village_render.mjs side <piece> [scale=6] [x|z]         side view (looking along z or x) of one piece
//   node tools/village_render.mjs sim <seed> [--links]                  top + side view of a simulated village (--links: run the loop planner and apply its links)
//   node tools/village_render.mjs sim <seed> --iso x0 x1 z0 z1 [y0 y1]   + isometric / top view of a region (world coordinates of the sim; --links as above)
//   node tools/village_render.mjs dump <dump.json[.gz]> [--markers m.json] [--region x0 x1 z0 z1] [--budget 3] [--iso]
//        top view of a REAL village with the planner's picks (one colour per link, white = its two ends, red lines = leftover candidates, red squares = open exits).
//        <dump> = tools/world_scan.py --dump output ({origin,size,palette,blocks}) or tests/fixtures/village_v2.json.gz ({..., cols, markers}).
//        --markers = JSON from `world_scan.py "<world>" --actors lothlorien:loop_marker --json m.json` ([{pos:[x,y,z]}] or [[x,y,z]]); without markers no planner runs.
//        --iso also writes an isometric picture of the --region (default: the planner's first pick, padded).
//   node tools/village_render.mjs mcs <any.mcstructure> [rot=0]        isometric picture of any structure file (e.g. a mockup written to temp/); textured, add --flat for the flat colours
//   Textured preview (real block textures, see tools/textured_render.mjs): add --tex to piece / sim --iso / dump --iso; --night (lamp light), --ppb N (pixels per block, 16), --rot R (view turned R quarter turns),
//        --crop x0 x1 z0 z1 / --y y0 y1 (piece only: render just this part of the box, e.g. the Hall of the central tree), --tag name (suffix of the file);
//        --noleaves (hide leaves); textures are downloaded once into temp/texture_cache/. Without --tex the flat output is unchanged.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync, deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadVillageData, parseMcstructure, rotated, wkey, wdecode, simulate, check, planLoops, renderTop, renderSide } from "./village_sim.mjs";
import { finalBlocks } from "../lothlorien_bp/scripts/village_loop.js";
import { planVillage, startsFromMarkers, enumerate } from "../lothlorien_bp/scripts/village_planner.js";
import { renderTextured } from "./textured_render.mjs";
import { ROOTS } from "./village_mallorn.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "..", "..", "temp", "village_render") + "/";
const PIECES = join(root, "lothlorien_bp", "structures", "lothlorien", "village") + "/";
const PL = "lothlorien:mallorn_planks", SL = "lothlorien:mallorn_slab", FE = "lothlorien:mallorn_fence";
const AIR = (n) => !n || /air$/.test(n);

// ---- PNG ---------------------------------------------------------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function png(W, H, img) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const crc = (b) => { let c = ~0; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (type, data) => { const b = Buffer.concat([Buffer.from(type), data]), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(data.length); c.writeUInt32BE(crc(b)); return Buffer.concat([l, b, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const save = (name, buf) => { mkdirSync(OUT, { recursive: true }); writeFileSync(OUT + name, buf); console.log(OUT + name); };

// ---- isometric / top renderer of any block source -----------------------------------------------------------------------
const COL = (n) => n.includes("leaves") ? [214, 170, 40] : /_log$|_wood$/.test(n) ? [120, 124, 132] : n.includes("slab") ? [225, 190, 120] : n.includes("planks") ? [205, 165, 105]
  : n.includes("fence") ? [150, 95, 50] : n.includes("lantern") ? [255, 240, 80] : n.includes("rope") ? [230, 230, 200] : [90, 90, 100];
function box(n, st) { // [x0,x1,y0,y1,z0,z1] of one block inside its cell
  if (n.includes("slab")) return st?.["minecraft:vertical_half"] === "top" ? [0, 1, 0.5, 1, 0, 1] : [0, 1, 0, 0.5, 0, 1];
  if (n.includes("fence")) return [0.375, 0.625, 0, 1.5, 0.375, 0.625];
  if (n.includes("lantern")) return [0.3, 0.7, 0, 0.6, 0.3, 0.7];
  return [0, 1, 0, 1, 0, 1];
}
function fillPoly(img, W, H, pts, c) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let pos = 0, neg = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], cr = (b[0] - a[0]) * (y + 0.5 - a[1]) - (b[1] - a[1]) * (x + 0.5 - a[0]);
      if (cr > 0) pos++; else if (cr < 0) neg++;
    }
    if (pos === 0 || neg === 0) { const o = (y * W + x) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; }
  }
}
const shade = (c, k) => c.map((v) => Math.min(255, Math.round(v * k)));
// get(x,y,z) -> { n, st } | null ; R = { x0,x1,y0,y1,z0,z1 } inclusive. iso: painter's order, light from the top left; top: flat, shaded by height.
export function render(get, R, file, { iso = true, S = 14, leaves = false } = {}) {
  const blocks = [];
  for (let x = R.x0; x <= R.x1; x++) for (let y = R.y0; y <= R.y1; y++) for (let z = R.z0; z <= R.z1; z++) {
    const b = get(x, y, z);
    if (!b || AIR(b.n) || b.n.includes("jigsaw") || (!leaves && b.n.includes("leaves"))) continue;
    blocks.push({ x, y, z, ...b });
  }
  if (iso) blocks.sort((a, b) => a.x + a.z - (b.x + b.z) || a.y - b.y); else blocks.sort((a, b) => a.y - b.y);
  const a = S * 0.866, bb = S * 0.5, c = S;
  const P = iso ? (x, y, z) => [(x - R.x0 - (z - R.z0)) * a, (x - R.x0 + (z - R.z0)) * bb - (y - R.y0) * c] : (x, y, z) => [(x - R.x0) * S, (z - R.z0) * S];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const [x, y, z] of [[R.x0, R.y0, R.z0], [R.x1 + 1, R.y0, R.z0], [R.x0, R.y0, R.z1 + 1], [R.x1 + 1, R.y0, R.z1 + 1], [R.x0, R.y1 + 2, R.z0], [R.x1 + 1, R.y1 + 2, R.z0], [R.x0, R.y1 + 2, R.z1 + 1], [R.x1 + 1, R.y1 + 2, R.z1 + 1]]) {
    const p = P(x, y, z); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }
  const W = Math.ceil(maxX - minX) + 8, H = Math.ceil(maxY - minY) + 8, img = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { img[i * 3] = 22; img[i * 3 + 1] = 24; img[i * 3 + 2] = 32; }
  const Q = (x, y, z) => { const p = P(x, y, z); return [p[0] - minX + 4, p[1] - minY + 4]; };
  const yspan = Math.max(1, R.y1 - R.y0);
  for (const b of blocks) {
    const [x0, x1, y0, y1, z0, z1] = box(b.n, b.st), X = b.x, Y = b.y, Z = b.z, base = COL(b.n);
    if (iso) {
      const top = [Q(X + x0, Y + y1, Z + z0), Q(X + x1, Y + y1, Z + z0), Q(X + x1, Y + y1, Z + z1), Q(X + x0, Y + y1, Z + z1)];
      const south = [Q(X + x0, Y + y1, Z + z1), Q(X + x1, Y + y1, Z + z1), Q(X + x1, Y + y0, Z + z1), Q(X + x0, Y + y0, Z + z1)];
      const east = [Q(X + x1, Y + y1, Z + z0), Q(X + x1, Y + y1, Z + z1), Q(X + x1, Y + y0, Z + z1), Q(X + x1, Y + y0, Z + z0)];
      fillPoly(img, W, H, south, shade(base, 0.62)); fillPoly(img, W, H, east, shade(base, 0.8)); fillPoly(img, W, H, top, base);
    } else {
      const k = 0.5 + 0.5 * (Y - R.y0) / yspan;
      fillPoly(img, W, H, [Q(X + x0, 0, Z + z0), Q(X + x1, 0, Z + z0), Q(X + x1, 0, Z + z1), Q(X + x0, 0, Z + z1)], shade(base, k));
    }
  }
  save(file, png(W, H, img));
}
const bothViews = (get, R, name, S) => { render(get, R, `${name}_iso.png`, { iso: true, S }); render(get, R, `${name}_top.png`, { iso: false, S }); };
// textured isometric picture (flags --tex --night --noleaves, options --ppb --rot); the region is rendered as is
function texView(get, R, name, flags, opt) {
  mkdirSync(OUT, { recursive: true });
  const file = `${name}_tex${flags.night ? "_night" : ""}${opt.rot ? "_rot" + opt.rot : ""}.png`;
  renderTextured(get, R, OUT + file, { ppb: opt.ppb ?? 16, rot: opt.rot ?? 0, night: !!flags.night, leaves: !flags.noleaves });
  console.log(OUT + file);
}

// ---- commands ----------------------------------------------------------------------------------------------------------
const loadPiece = (name) => parseMcstructure(readFileSync(PIECES + name + ".mcstructure"), name);

function cmdPiece(name, rot = 0, flags, opt = {}) {
  if (!name) throw new Error("piece <name> [rot] [--leaves]");
  const rp = rotated(loadPiece(name), +rot), map = new Map();
  for (const b of rp.blocks) map.set(`${b.x},${b.y},${b.z}`, { n: b.name, st: b.states, banner: b.banner, plant: b.plant });
  const [sx, sy, sz] = rp.size, S = Math.max(8, Math.min(20, Math.floor(900 / (sx + sz))));
  if (flags.tex) { // jigsaw cells show their final state (usually air) so the picture shows the piece as it ends up
    for (const j of rp.jigsaws) if (j.final && !AIR(j.final)) map.set(`${j.x},${j.y},${j.z}`, { n: j.final, st: {} });
    const R = { x0: 0, x1: sx - 1, y0: 0, y1: sy - 1, z0: 0, z1: sz - 1 };
    if (opt.crop) [R.x0, R.x1, R.z0, R.z1] = opt.crop; // --crop x0 x1 z0 z1 (box coordinates of the piece, before --rot)
    if (opt.yr) [R.y0, R.y1] = opt.yr; // --y y0 y1 (box coordinates: the piece's y 0 is ROOTS below the nominal ground)
    return texView((x, y, z) => map.get(`${x},${y},${z}`), R, `piece_${name}_r${rot}${opt.tag ? "_" + opt.tag : ""}`, flags, opt);
  }
  bothViews((x, y, z) => map.get(`${x},${y},${z}`), { x0: 0, x1: sx - 1, y0: 0, y1: sy - 1, z0: 0, z1: sz - 1 }, `piece_${name}_r${rot}`, S);
  if (flags.leaves) { render((x, y, z) => map.get(`${x},${y},${z}`), { x0: 0, x1: sx - 1, y0: 0, y1: sy - 1, z0: 0, z1: sz - 1 }, `piece_${name}_r${rot}_leaves_iso.png`, { iso: true, S, leaves: true }); }
}

// side view of one piece (looking along z or x; nearest block wins, depth shaded): shows arches, stairs, pillars and crowns clearly
function cmdSide(name, sc = "6", axis = "z") {
  if (!name) throw new Error("side <piece> [scale] [x|z]");
  const S = +sc, P = rotated(loadPiece(name), 0), cells = new Map();
  for (const b of P.blocks) cells.set(`${b.x},${b.y},${b.z}`, b.name);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, d0 = 1e9, d1 = -1e9; const front = new Map();
  for (const [k, n] of cells) {
    const [x, y, z] = k.split(",").map(Number), u = axis === "z" ? x : z, d = axis === "z" ? z : x, c = `${u},${y}`, cur = front.get(c);
    if (!cur || cur.d < d) front.set(c, { d, n });
    x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, y); y1 = Math.max(y1, y); d0 = Math.min(d0, d); d1 = Math.max(d1, d);
  }
  const W = (x1 - x0 + 1) * S, H = (y1 - y0 + 1) * S, img = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { img[i * 3] = 24; img[i * 3 + 1] = 26; img[i * 3 + 2] = 34; }
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const t = front.get(`${Math.floor(px / S) + x0},${y1 - Math.floor(py / S)}`);
    if (!t) continue;
    let c = shade(COL(t.n), 0.55 + 0.45 * (t.d - d0) / Math.max(1, d1 - d0));
    if (px % S === 0 || py % S === 0) c = shade(c, 0.8);
    img.set(c, (py * W + px) * 3);
  }
  save(`side_${name}_${axis}.png`, png(W, H, img));
}

function cmdSim(seed, flags, rest, opt = {}) {
  seed = +seed || 1;
  const data = loadVillageData(), res = simulate(data, seed), ck = check(data, res);
  if (flags.links) {
    const lp = planLoops(res, ck.world, ck.states, { verify: true });
    console.log(`seed ${seed}: ${res.placed.length} pieces, ${lp.merges} merges, ${lp.loops} links ${JSON.stringify(lp.byKind)}, bad ${lp.bad.length}`);
  } else console.log(`seed ${seed}: ${res.placed.length} pieces, trees ${ck.kinds.trees}, fail ${ck.fail.length}`);
  const tag = `sim_seed${seed}${flags.links ? "_links" : ""}`;
  save(`${tag}_top.png`, renderTop(ck.world));
  save(`${tag}_side.png`, renderSide(ck.world));
  if (flags.iso) {
    const [x0, x1, z0, z1, y0, y1] = rest.map(Number);
    if ([x0, x1, z0, z1].some(Number.isNaN)) throw new Error("--iso x0 x1 z0 z1 [y0 y1]");
    // --links: the sim's flat terrain (grass on top, 3 dirt) is drawn too, so the forest floor of the repairs is visible; the default y range then starts at the ground
    const terrain = (y) => y === ROOTS - 1 ? "minecraft:grass_block" : y < ROOTS - 1 && y >= ROOTS - 4 ? "minecraft:dirt" : null;
    const get = (x, y, z) => { const n = ck.world.get(wkey(x, y, z)) ?? (flags.links ? terrain(y) : null); return n && !AIR(n) ? { n, st: ck.states.get(wkey(x, y, z)) } : null; };
    let lo = y0, hi = y1;
    if (lo === undefined) { lo = 1e9; hi = -1e9; for (const [k, n] of ck.world) { const [x, y, z] = wdecode(k); if (x >= x0 && x <= x1 && z >= z0 && z <= z1 && !AIR(n)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } } }
    if (flags.links) lo = Math.min(lo, ROOTS - 3);
    if (flags.tex) texView(get, { x0, x1, z0, z1, y0: lo, y1: hi }, `${tag}_region`, flags, opt);
    else bothViews(get, { x0, x1, z0, z1, y0: lo, y1: hi }, `${tag}_region`, 12);
  }
}

function loadDump(file) {
  let buf = readFileSync(file); if (file.endsWith(".gz")) buf = gunzipSync(buf);
  const f = JSON.parse(buf), [ox, oy, oz] = f.origin, [sx, sy, sz] = f.size;
  const names = f.palette.map((p) => (typeof p === "string" ? p : p.name)), sts = f.palette.map((p) => (typeof p === "string" ? undefined : p.states));
  let blocks = f.blocks;
  if (!blocks) { // fixture format: one run-length list [palette, count, ...] per (x, z) column
    blocks = new Int16Array(sx * sy * sz);
    f.cols.forEach((runs, ci) => { const i = Math.floor(ci / sz), k = ci % sz; let j = 0; for (let r = 0; r < runs.length; r += 2) for (let n = 0; n < runs[r + 1]; n++) blocks[(i * sy + j++) * sz + k] = runs[r]; });
  }
  const idx = (x, y, z) => { const i = x - ox, j = y - oy, k = z - oz; return i < 0 || j < 0 || k < 0 || i >= sx || j >= sy || k >= sz ? -2 : blocks[(i * sy + j) * sz + k]; };
  const at = (x, y, z) => { const v = idx(x, y, z); return v === -2 ? undefined : v < 0 ? "minecraft:air" : names[v]; };
  const st = (x, y, z) => { const v = idx(x, y, z); return v < 0 ? undefined : sts[v]; };
  return { f, ox, oy, oz, sx, sy, sz, at, st };
}
const markerCell = (m) => { const p = Array.isArray(m) ? m : m.pos; return [Math.floor(p[0]), Math.floor(p[1]) - 1, Math.floor(p[2])]; }; // entity position -> deck cell under it

function cmdDump(file, flags, opt) {
  if (!file) throw new Error("dump <dump.json[.gz]> ...");
  const w = loadDump(file);
  const mk = opt.markers ? JSON.parse(readFileSync(opt.markers, "utf8")) : w.f.markers;
  const markers = (mk ?? []).map(markerCell);
  const [x0, x1, z0, z1] = opt.region ?? [w.ox, w.ox + w.sx - 1, w.oz, w.oz + w.sz - 1];
  const r = markers.length ? planVillage(w.at, markers, { budget: opt.budget ?? 3 }) : { picks: [], merges: [], at: { over: new Map() }, log: [] };
  const over = r.at.over, get = (x, y, z) => over.get(`${x},${y},${z}`) ?? w.at(x, y, z);
  const S = Math.max(2, Math.min(8, Math.floor(1800 / Math.max(x1 - x0 + 1, z1 - z0 + 1)))), W = (x1 - x0 + 1) * S, H = (z1 - z0 + 1) * S, img = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { img[i * 3] = 22; img[i * 3 + 1] = 26; img[i * 3 + 2] = 34; }
  const put = (x, z, c, f = 1) => { for (let dz = 0; dz < S; dz++) for (let dx = 0; dx < S; dx++) { const px = (x - x0) * S + dx, pz = (z - z0) * S + dz; if (px < 0 || pz < 0 || px >= W || pz >= H) continue; if (f < 1 && S > 3 && !(dx > 0 && dx < S - 1 && dz > 0 && dz < S - 1)) continue; img.set(c, (pz * W + px) * 3); } };
  const yTop = w.oy + w.sy - 1;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    let best = null;
    for (let y = yTop; y >= w.oy; y--) {
      const n = get(x, y, z); if (!n) continue;
      if (n === PL || n === SL) { best = { y, n, t: "deck" }; break; }
      if (!best && /mallorn_(log|wood)$/.test(n)) best = { y, n, t: "log" };
      if (!best && n.endsWith("mallorn_leaves")) best = { y, n, t: "leaf" };
    }
    if (!best) continue;
    if (best.t === "leaf") put(x, z, [34, 56, 34]); else if (best.t === "log") put(x, z, [120, 124, 132]);
    else { const c = best.y >= 85 ? [235, 205, 140] : best.y >= 80 ? [200, 160, 110] : [205, 175, 120]; put(x, z, best.n === SL ? shade(c, 0.8) : c); } // brighter = higher deck level
  }
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = yTop; y >= w.oy; y--) if (w.at(x, y, z) === FE && !over.has(`${x},${y},${z}`)) { put(x, z, [110, 75, 40], 0.5); break; }
  const cols = [[255, 0, 200], [0, 220, 255], [120, 255, 80], [255, 140, 0], [255, 255, 0], [160, 120, 255]], picks = [...r.merges, ...r.picks];
  picks.forEach((p, i) => {
    const c = p.kind === "merge" ? [90, 200, 90] : cols[(i - r.merges.length) % cols.length];
    for (const [k, b] of finalBlocks(p.plan)) { const [x, , z] = k.split(",").map(Number); if (b.id === PL || b.id === SL || b.id.includes("log")) put(x, z, shade(c, 0.75)); }
    for (const e of [p.A, p.B]) put(e.x, e.z, [255, 255, 255], 0.5);
  });
  if (markers.length) {
    const st = startsFromMarkers(get, markers), chosen = new Set(r.picks.map((p) => `${p.A.x},${p.A.z}`));
    const line = (a, b, c) => { const n = Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)); for (let i = 0; i <= n; i++) { const x = Math.round(a.x + (b.x - a.x) * i / n), z = Math.round(a.z + (b.z - a.z) * i / n), px = (x - x0) * S + 1, pz = (z - z0) * S + 1; if (px >= 0 && pz >= 0 && px < W && pz < H) img.set(c, (pz * W + px) * 3); } };
    for (const c of enumerate(get, st)) if (!chosen.has(`${c.A.x},${c.A.z}`)) line(c.A, c.B, [255, 60, 60]);
    for (const e of st.exits) put(e.x, e.z, [255, 40, 40], 0.5);
  }
  const tag = "dump_" + (file.split(/[\\/]/).pop().replace(/\.json(\.gz)?$/, ""));
  save(`${tag}_top.png`, png(W, H, img));
  console.log(`${markers.length} markers, ${r.merges.length} merges, ${r.picks.length} picks (budget ${opt.budget ?? 3})`);
  for (const p of r.picks) console.log(`  ${p.kind} ${p.A.x},${p.A.y},${p.A.z} -> ${p.B.x},${p.B.z}  length ${p.len}  walk saved ${p.dnet}  value ${p.value}`);
  for (const l of r.log.slice(0, 10)) console.log("  skipped: " + l);
  if (flags.iso) {
    const p0 = r.picks[0], R = opt.region ? { x0, x1, z0, z1, y0: w.oy, y1: yTop } : p0 ? (() => {
      const cells = [...finalBlocks(p0.plan).keys()].map((k) => k.split(",").map(Number));
      return { x0: Math.min(...cells.map((c) => c[0])) - 8, x1: Math.max(...cells.map((c) => c[0])) + 8, z0: Math.min(...cells.map((c) => c[2])) - 8, z1: Math.max(...cells.map((c) => c[2])) + 8, y0: p0.A.y - 3, y1: p0.A.y + 7 };
    })() : null;
    const regionGet = (x, y, z) => { const n = get(x, y, z); return n && !AIR(n) ? { n, st: over.has(`${x},${y},${z}`) ? undefined : w.st(x, y, z) } : null; };
    if (R && flags.tex) texView(regionGet, R, tag + "_region", flags, opt);
    else if (R) bothViews(regionGet, R, tag + "_region", 14);
  }
}

// any .mcstructure file (rot = quarter turns of the structure itself, like piece); textured unless --flat
function cmdMcs(file, rot = 0, flags, opt) {
  if (!file) throw new Error("mcs <file.mcstructure> [rot] [--flat] [--night] [--ppb N] [--rot R]");
  const name = file.replace(/\\/g, "/").split("/").pop().replace(/\.mcstructure$/, ""), rp = rotated(parseMcstructure(readFileSync(file), name), +rot), map = new Map();
  for (const b of rp.blocks) map.set(`${b.x},${b.y},${b.z}`, { n: b.name, st: b.states, banner: b.banner, plant: b.plant });
  for (const j of rp.jigsaws) if (j.final && !AIR(j.final)) map.set(`${j.x},${j.y},${j.z}`, { n: j.final, st: {} });
  const [sx, sy, sz] = rp.size, R = { x0: 0, x1: sx - 1, y0: 0, y1: sy - 1, z0: 0, z1: sz - 1 }, get = (x, y, z) => map.get(`${x},${y},${z}`);
  if (flags.flat) bothViews(get, R, `mcs_${name}_r${rot}`, Math.max(8, Math.min(20, Math.floor(900 / (sx + sz)))));
  else texView(get, R, `mcs_${name}_r${rot}`, flags, opt);
}

// ---- argv --------------------------------------------------------------------------------------------------------------
function main() {
  const [cmd, ...args] = process.argv.slice(2), pos = [], flags = {}, opt = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--markers") opt.markers = args[++i];
    else if (a === "--budget") opt.budget = +args[++i];
    else if (a === "--ppb") opt.ppb = +args[++i];
    else if (a === "--rot") opt.rot = +args[++i];
    else if (a === "--crop") opt.crop = args.slice(i + 1, i + 5).map(Number), i += 4;
    else if (a === "--y") opt.yr = args.slice(i + 1, i + 3).map(Number), i += 2;
    else if (a === "--tag") opt.tag = args[++i];
    else if (a === "--region") opt.region = args.slice(i + 1, i + 5).map(Number), i += 4;
    else if (a.startsWith("--")) flags[a.slice(2)] = true;
    else pos.push(a);
  }
  if (cmd === "piece") cmdPiece(pos[0], pos[1], flags, opt);
  else if (cmd === "side") cmdSide(...pos);
  else if (cmd === "sim") cmdSim(pos[0], flags, pos.slice(1), opt);
  else if (cmd === "dump") cmdDump(pos[0], flags, opt);
  else if (cmd === "mcs") cmdMcs(pos[0], pos[1], flags, opt);
  else console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
}
if (process.argv[1]?.endsWith("village_render.mjs")) main();
