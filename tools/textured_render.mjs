// Textured isometric preview of any block structure (software renderer, no game needed): real block textures, approximate shapes, optional night lighting.
// Judge colour, texture and composition with it; it is NOT the game's renderer (no ambient occlusion, plants are axis-aligned crosses, shapes are approximations).
//   import { renderTextured, renderBlocks } from "./textured_render.mjs";
//   renderTextured(get, R, "C:/.../out.png", opts)   get(x,y,z) -> { n: "ns:name", st: {states} } | null ; R = { x0,x1,y0,y1,z0,z1 } inclusive
//   renderBlocks(blocksMap, "out.png", opts)         blocksMap = Map("x,y,z" -> { name, states }) (build_village.mjs format); the region is the map's bounding box
// opts: ppb (pixels per block edge, default 16), rot (0-3 quarter turns of the view), night, nightFactor (ambient light at night, 0.28), lightBlocks (default = night; hidden light blocks stay invisible, at night they glow faint: let
//       minecraft:light_block_N emit, they stay invisible), bg ([r,g,b]), leaves (false hides leaves, as the flat renderer's default), quiet (no warning print).
// Textures: vanilla ones are downloaded once from Mojang's public bedrock-samples repo into temp/texture_cache/ (PNG/JSON only, nothing executed); mod blocks
// (lothlorien:*) are read from lothlorien_bp/blocks/*.json (material_instances) + lothlorien_rp/textures/terrain_texture.json. Flipbooks use their first frame.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "..", "..", "temp", "texture_cache") + "/";
const RAW = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/";
const MOD_NS = "lothlorien:";

// ---- PNG / TGA decode, PNG encode (pure JS; only these two formats are ever parsed from downloads) ------------------------
export function decodePng(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let p = 8, w = 0, h = 0, depth = 8, ctype = 6, interlace = 0, plte = null, trns = null;
  const idat = [];
  while (p + 12 <= buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("latin1", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    p += 12 + len;
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; interlace = d[12]; }
    else if (type === "PLTE") plte = d; else if (type === "tRNS") trns = d; else if (type === "IDAT") idat.push(d); else if (type === "IEND") break;
  }
  if (interlace) throw new Error("interlaced PNG");
  if (!w || !h || w * h > 1.6e7) throw new Error("bad PNG size");
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype], bits = ch * depth, bpp = Math.max(1, bits >> 3), stride = Math.ceil((w * bits) / 8);
  const raw = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0, b = y ? px[dst - stride + i] : 0, c = i >= bpp && y ? px[dst - stride + i - bpp] : 0;
      let v = raw[src + i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + i] = v & 255;
    }
  }
  const out = new Uint8Array(w * h * 4), max = (1 << Math.min(depth, 8)) - 1;
  const sample = (row, idx) => depth === 8 ? px[row + idx] : depth === 16 ? px[row + idx * 2] : (px[row + ((idx * depth) >> 3)] >> (8 - depth - ((idx * depth) & 7))) & max;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const row = y * stride, o = (y * w + x) * 4;
    if (ctype === 3) { const i = sample(row, x); out.set([plte[i * 3], plte[i * 3 + 1], plte[i * 3 + 2], trns && i < trns.length ? trns[i] : 255], o); }
    else if (ctype === 0 || ctype === 4) { const g = Math.round((sample(row, x * ch) * 255) / max); out.set([g, g, g, ctype === 4 ? sample(row, x * ch + 1) : 255], o); }
    else out.set([sample(row, x * ch), sample(row, x * ch + 1), sample(row, x * ch + 2), ctype === 6 ? sample(row, x * ch + 3) : 255], o);
  }
  return { w, h, data: out };
}

function decodeTga(buf) { // uncompressed / RLE true-colour and grey, 8-32 bit
  const idLen = buf[0], cmType = buf[1], type = buf[2], w = buf.readUInt16LE(12), h = buf.readUInt16LE(14), bpp = buf[16], top = (buf[17] & 32) !== 0;
  if (cmType || ![2, 3, 10, 11].includes(type) || ![8, 24, 32].includes(bpp) || !w || !h || w * h > 1.6e7) throw new Error("unsupported TGA");
  const n = bpp >> 3, rle = type >= 10, px = new Uint8Array(w * h * n);
  let p = 18 + idLen, o = 0;
  while (o < px.length) {
    if (!rle) { px.set(buf.subarray(p, p + px.length), 0); break; }
    const hd = buf[p++], cnt = (hd & 127) + 1;
    if (hd & 128) { for (let i = 0; i < cnt && o < px.length; i++) { px.set(buf.subarray(p, p + n), o); o += n; } p += n; }
    else { const len = Math.min(cnt * n, px.length - o); px.set(buf.subarray(p, p + len), o); o += len; p += cnt * n; }
  }
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((top ? y : h - 1 - y) * w + x) * n, d = (y * w + x) * 4;
    if (n === 1) out.set([px[s], px[s], px[s], 255], d); else out.set([px[s + 2], px[s + 1], px[s], n === 4 ? px[s + 3] : 255], d);
  }
  return { w, h, data: out };
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function encodePng(W, H, rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) Buffer.from(rgb.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  const crc = (b) => { let c = ~0; for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (type, data) => { const b = Buffer.concat([Buffer.from(type), data]), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(data.length); c.writeUInt32BE(crc(b)); return Buffer.concat([l, b, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---- texture sources -----------------------------------------------------------------------------------------------------
// Download one file of the samples repo into the cache (null when it does not exist; misses are remembered in <file>.404).
function fetchCached(rel, kind) {
  const file = CACHE + rel;
  if (existsSync(file)) return file;
  if (existsSync(file + ".404")) return null;
  mkdirSync(dirname(file), { recursive: true });
  try {
    execFileSync("curl", ["-sfL", "--max-time", "30", RAW + rel, "-o", file + ".part"], { stdio: "ignore" });
    const head = readFileSync(file + ".part").subarray(0, 8);
    if (kind === "png" && head.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
    renameSync(file + ".part", file);
    return file;
  } catch { rmSync(file + ".part", { force: true }); writeFileSync(file + ".404", ""); return null; }
}
function loadJson(file) { // blocks.json is plain JSON; terrain_texture.json starts with // comment lines
  return JSON.parse(readFileSync(file, "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"));
}
let vanilla = null;
function vanillaData() {
  if (vanilla) return vanilla;
  const b = fetchCached("blocks.json", "json"), t = fetchCached("textures/terrain_texture.json", "json");
  if (!b || !t) throw new Error("cannot download blocks.json / terrain_texture.json (network?)");
  return (vanilla = { blocks: loadJson(b), terrain: loadJson(t).texture_data });
}
let mod = null;
function modData() {
  if (mod) return mod;
  return (mod = { terrain: loadJson(join(ROOT, "lothlorien_rp", "textures", "terrain_texture.json")).texture_data, blocks: new Map() });
}
function modBlock(short) { // BP block json -> { mi, geometry, light, box }
  const m = modData();
  if (m.blocks.has(short)) return m.blocks.get(short);
  const f = join(ROOT, "lothlorien_bp", "blocks", short + ".json");
  let info = null;
  if (existsSync(f)) {
    const c = JSON.parse(readFileSync(f, "utf8"))["minecraft:block"].components ?? {}, g = c["minecraft:geometry"];
    let bx = c["minecraft:collision_box"] ?? c["minecraft:selection_box"];
    if (Array.isArray(bx)) bx = bx[0]; // a list of boxes (newer formats): the first one is enough for a preview
    if (bx && !bx.origin) bx = null;
    info = { mi: c["minecraft:material_instances"] ?? {}, geometry: typeof g === "string" ? g : g?.identifier ?? "", light: c["minecraft:light_emission"] ?? 0,
      box: bx && typeof bx === "object" ? [8 + bx.origin[0], bx.origin[1], 8 + bx.origin[2], 8 + bx.origin[0] + bx.size[0], bx.origin[1] + bx.size[1], 8 + bx.origin[2] + bx.size[2]] : null };
  }
  m.blocks.set(short, info);
  return info;
}

const imgCache = new Map(); // "v:path" | "m:path" -> image | null
function firstFrame(img) { return img.h > img.w && img.h % img.w === 0 ? { w: img.w, h: img.w, data: img.data.subarray(0, img.w * img.w * 4) } : img; }
function loadImage(path, isMod) { // path like "textures/blocks/planks_oak" (no extension)
  const key = (isMod ? "m:" : "v:") + path;
  if (imgCache.has(key)) return imgCache.get(key);
  let img = null;
  try {
    for (const ext of ["png", "tga"]) {
      const file = isMod ? join(ROOT, "lothlorien_rp", path + "." + ext) : fetchCached(path + "." + ext, ext);
      if (file && existsSync(file)) { const b = readFileSync(file); img = firstFrame(ext === "png" ? decodePng(b) : decodeTga(b)); break; }
    }
  } catch (e) { console.warn(`texture ${key}: ${e.message}`); }
  imgCache.set(key, img);
  return img;
}

// terrain_texture entry -> { path, tint? } (first variant, or the one `variant` picks)
function terrainPath(td, short, variant = 0) {
  let e = td[short]?.textures;
  if (Array.isArray(e)) e = e[Math.min(variant, e.length - 1)];
  if (e && typeof e === "object") e = e.path;
  return e ?? null;
}

// ---- tints, emitters, name classes ---------------------------------------------------------------------------------------
const GRASS = [121, 192, 90], FOLIAGE = [119, 171, 47], WATER = [63, 118, 228];
const tintOf = (name, face) => {
  if (name === "leaf_litter") return [150, 104, 52]; // vanilla tints the litter with the dry-foliage colour (a flat stand-in here)
  if (name === "grass_block" || name === "grass") return face === "up" ? GRASS : null;
  if (/^(short_grass|tall_grass|fern|large_fern|tallgrass|vine|sugar_cane|grass_path)$/.test(name)) return GRASS;
  if (name === "birch_leaves") return [128, 167, 85];
  if (name === "spruce_leaves") return [97, 153, 97];
  if (/^(oak|jungle|acacia|dark_oak|mangrove)_leaves$/.test(name)) return FOLIAGE;
  if (name === "lily_pad") return [32, 128, 48];
  if (/^(flowing_)?water$/.test(name)) return WATER;
  return null;
};
const EMIT = { lantern: 15, soul_lantern: 10, end_rod: 14, ochre_froglight: 15, verdant_froglight: 15, pearlescent_froglight: 15, cave_vines_body_with_berries: 14,
  cave_vines_head_with_berries: 14, sea_pickle: 6, firefly_bush: 2, torch: 14, soul_torch: 10, glowstone: 15, shroomlight: 15, sea_lantern: 15, campfire: 15, jack_o_lantern: 15,
  lit_redstone_lamp: 15, magma: 3, fire: 15, lava: 15, glow_lichen: 7, candle: 3, beacon: 15 };
const emitLevel = (n) => {
  if (n.startsWith(MOD_NS)) return modBlock(n.slice(MOD_NS.length))?.light ?? 0;
  const s = n.replace(/^minecraft:/, ""), lb = /^light_block_(\d+)$/.exec(s);
  return lb ? +lb[1] : /_candle$/.test(s) ? 3 : EMIT[s] ?? 0;
};
const isAir = (n) => !n || /(^|:)(air|cave_air|void_air|structure_void)$/.test(n);
const isLightBlock = (n) => /^minecraft:light_block/.test(n);
const CUTOUT = /leaves|glass|ice$|water|ladder|chain|bars|rail|_door$|trapdoor/;
const FLOWERS = "poppy dandelion allium azure_bluet blue_orchid cornflower lily_of_the_valley oxeye_daisy red_tulip orange_tulip pink_tulip white_tulip wither_rose torchflower open_eyeblossom closed_eyeblossom"
  + " short_grass tall_grass fern large_fern tallgrass short_dry_grass tall_dry_grass deadbush dead_bush bush firefly_bush brown_mushroom red_mushroom sweet_berry_bush hanging_roots"
  + " pale_hanging_moss glow_berries kelp seagrass sugar_cane small_dripleaf spore_blossom rose_bush peony lilac sunflower pitcher_plant yellow_flower red_flower double_plant reeds"
  + " wheat carrots potatoes beetroot nether_wart wildflowers azalea_bush";
const CROSS = new Set(FLOWERS.split(" "));
const isCross = (s) => CROSS.has(s) || /(_sapling|_propagule|^cave_vines|^weeping_vines|^twisting_vines|_roots$)/.test(s);

// ---- textures of one block -----------------------------------------------------------------------------------------------
const FACES = ["up", "down", "north", "south", "east", "west"];
const texCache = new Map();
// block models whose terrain texture is a model atlas, not a face texture: a plain stand-in
const synth = (rgb, edge) => { const d = new Uint8Array(16 * 16 * 4); for (let i = 0; i < 256; i++) { const e = edge && (i % 16 === 0 || i % 16 === 15 || i < 16 || i >= 240); d.set([...(e ? edge : rgb), 255], i * 4); } return { w: 16, h: 16, data: d }; };
const SYNTH = { lantern: synth([255, 200, 90], [70, 56, 46]), soul_lantern: synth([100, 210, 230], [60, 60, 70]), torch: synth([255, 170, 60], [120, 85, 45]), soul_torch: synth([90, 200, 230], [120, 85, 45]),
  end_rod: synth([245, 240, 225], [200, 190, 170]), chain: synth([70, 70, 80], [40, 40, 48]) };
const FALLBACK = { chest: "planks_oak", trapped_chest: "planks_oak", ender_chest: "obsidian", barrel: "barrel_side", bed: "planks_oak", water: "water_still_grey", flowing_water: "water_still_grey" };
const SUFFIX = { trapdoor: "trapdoor", door: "door_wood_lower" };
// -> { up, down, north, south, east, west } each { img, tint, blend } | null ; null overall = unknown block
function blockTextures(n, st) {
  const tip = st?.tip === true ? 1 : /with_berries$/.test(n) ? 1 : 0, key = n + "|" + tip;
  if (texCache.has(key)) return texCache.get(key);
  let res = null;
  if (n.startsWith(MOD_NS)) {
    const short = n.slice(MOD_NS.length), b = modBlock(short);
    if (b) {
      const m = modData(), set = {};
      for (const f of FACES) {
        const inst = b.mi[f] ?? (f === "up" || f === "down" ? null : b.mi.side) ?? b.mi["*"] ?? Object.values(b.mi)[0];
        if (!inst) continue;
        const tex = inst.texture.replace(MOD_NS, ""), p = terrainPath(m.terrain, inst.texture) ?? terrainPath(vanillaData().terrain, tex) ?? `textures/blocks/${tex}`;
        const isMod = m.terrain[inst.texture] !== undefined, img = loadImage(p, isMod);
        if (img) set[f] = { img, tint: null, blend: inst.render_method === "blend" };
      }
      if (set.up || set.north) { for (const f of FACES) set[f] ??= set.north ?? set.up; res = set; }
    }
  } else {
    const name = n.replace(/^minecraft:/, ""), { blocks, terrain } = vanillaData();
    if (SYNTH[name]) { const t = { img: SYNTH[name], tint: null, blend: false }; texCache.set(key, one(t)); return one(t); }
    const alias = name === "grass_block" ? "grass" : name;
    let tx = blocks[alias]?.textures;
    if (tx === undefined && FALLBACK[name]) tx = FALLBACK[name];
    if (tx === undefined && terrain[name]) tx = name;
    if (tx === undefined) { const g = /_(trapdoor|door)$/.exec(name); if (g && terrain[SUFFIX[g[1]]]) tx = SUFFIX[g[1]]; }
    if (tx !== undefined) {
      const set = {}, side = typeof tx === "string" ? tx : tx.side ?? tx.north ?? tx.up;
      for (const f of FACES) {
        const short = typeof tx === "string" ? tx : tx[f] ?? (f === "up" || f === "down" ? tx.side : tx.side) ?? side;
        const path = terrainPath(terrain, short, tip) ?? (terrain[short] ? null : `textures/blocks/${short}`);
        const img = path ? loadImage(path, false) : null;
        if (img) set[f] = { img, tint: tintOf(name, f), tintGrey: (name === "grass_block" || name === "grass") && f !== "up" && f !== "down", blend: /^(flowing_)?water$/.test(name) || /glass$|^ice$|glass_pane$/.test(name) };
      }
      if (Object.keys(set).length) { for (const f of FACES) set[f] ??= set.north ?? set.up ?? Object.values(set)[0]; res = set; }
    }
  }
  texCache.set(key, res);
  return res;
}

// ---- geometry: faces (parallelograms) of boxes, crossed planes and thin plates; units are 1/16 block inside the cell -------------
// A face is { p0, p1, p3, uv0, uv1, uv3 (texture 0..1), t (texture), ... }: points p0,p1,p3 span the parallelogram, so projection and texturing stay affine.
function boxFaces(out, x, y, z, [x0, y0, z0, x1, y1, z1], T, skip, extra = {}) {
  const P = (a, b, c) => [x + a / 16, y + b / 16, z + c / 16], U = (u, v) => [u / 16, v / 16], add = (f, p0, p1, p3, a, b, c) => skip?.has(f) || !T[f] || out.push({ p0: P(...p0), p1: P(...p1), p3: P(...p3), uv0: U(...a), uv1: U(...b), uv3: U(...c), t: T[f], ...extra });
  add("up", [x0, y1, z0], [x1, y1, z0], [x0, y1, z1], [x0, z0], [x1, z0], [x0, z1]);
  add("down", [x0, y0, z1], [x1, y0, z1], [x0, y0, z0], [x0, 16 - z1], [x1, 16 - z1], [x0, 16 - z0]);
  add("south", [x0, y1, z1], [x1, y1, z1], [x0, y0, z1], [x0, 16 - y1], [x1, 16 - y1], [x0, 16 - y0]);
  add("north", [x1, y1, z0], [x0, y1, z0], [x1, y0, z0], [16 - x1, 16 - y1], [16 - x0, 16 - y1], [16 - x1, 16 - y0]);
  add("east", [x1, y1, z1], [x1, y1, z0], [x1, y0, z1], [16 - z1, 16 - y1], [16 - z0, 16 - y1], [16 - z1, 16 - y0]);
  add("west", [x0, y1, z0], [x0, y1, z1], [x0, y0, z0], [z0, 16 - y1], [z1, 16 - y1], [z0, 16 - y0]);
}
// vertical plane through the cell at x = c (plane "x") or z = c (plane "z"), both sides visible
function planeFaces(out, x, y, z, axis, c, t, extra = {}) {
  const k = c / 16;
  const f = axis === "x" ? { p0: [x + k, y + 1, z], p1: [x + k, y + 1, z + 1], p3: [x + k, y, z] } : { p0: [x, y + 1, z + k], p1: [x + 1, y + 1, z + k], p3: [x, y, z + k] };
  out.push({ ...f, uv0: [0, 0], uv1: [1, 0], uv3: [0, 1], t, twoSided: true, ...extra });
}
const one = (t) => ({ up: t, down: t, north: t, south: t, east: t, west: t });
const DIRS = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
const NB = { up: [0, 1, 0], down: [0, -1, 0], north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
const ints = ["east", "west", "south", "north"];
const cardinal = (st) => st?.["minecraft:cardinal_direction"] ?? (typeof st?.weirdo_direction === "number" ? ints[st.weirdo_direction] : typeof st?.direction === "number" ? ints[st.direction] : typeof st?.facing_direction === "number" ? ["down", "up", "north", "south", "west", "east"][st.facing_direction] : undefined) ?? "south";
const isTop = (st) => st?.["minecraft:vertical_half"] === "top" || st?.upside_down_bit === true || st?.top_slot_bit === true;
const isOpen = (st) => st?.["lothlorien:open"] === true || st?.open_bit === true;

// ---- banners (block data `banner` = { base, patterns: [{ pattern, color }] }, as the generator writes them; piece files carry none: the owner's watch design) ----
const DYE = { white: [233, 236, 236], light_gray: [142, 142, 134], silver: [142, 142, 134], gray: [62, 68, 71], black: [20, 21, 25], brown: [114, 71, 40], red: [160, 39, 34], orange: [240, 118, 19], yellow: [248, 198, 39],
  lime: [112, 185, 25], green: [84, 109, 27], cyan: [21, 137, 145], light_blue: [58, 175, 217], blue: [53, 57, 157], purple: [137, 50, 184], magenta: [189, 68, 179], pink: [237, 141, 172] };
const WATCH = { base: "green", patterns: [{ pattern: "curly_border", color: "silver" }, { pattern: "stripe_middle", color: "lime" }, { pattern: "flower", color: "green" }] };
const bannerCache = new Map();
function bannerImage(spec) { // 16 x 32 cloth: base colour + a rough drawing of each layer (border, middle stripe, flower, cross, triangles)
  const sp = spec ?? WATCH, id = JSON.stringify(sp);
  if (bannerCache.has(id)) return bannerCache.get(id);
  const W = 16, H = 32, d = new Uint8Array(W * H * 4), px = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) d.set([...c, 255], (y * W + x) * 4); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, DYE[sp.base] ?? DYE.white);
  for (const p of sp.patterns ?? []) {
    const c = DYE[p.color] ?? DYE.white, n = { cbo: "curly_border", bo: "border", ms: "stripe_middle", flo: "flower", cr: "cross", bts: "triangles_bottom", tts: "triangles_top" }[p.pattern] ?? p.pattern;
    if (/border/.test(n)) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) px(x, y, c);
    else if (n === "stripe_middle") for (let y = 0; y < H; y++) for (let x = 6; x < 10; x++) px(x, y, c);
    else if (n === "flower") for (let y = 12; y < 20; y++) for (let x = 4; x < 12; x++) if (Math.abs(x - 7.5) + Math.abs(y - 15.5) <= 4) px(x, y, c);
    else if (n === "cross") for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.abs(x - 7.5 - (y - 15.5) * 0.5) < 1.5 || Math.abs(x - 7.5 + (y - 15.5) * 0.5) < 1.5) px(x, y, c);
    else if (n === "triangles_bottom") for (let y = 22; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 8 < 3) px(x, y, c);
    else if (n === "triangles_top") for (let y = 0; y < 10; y++) for (let x = 0; x < W; x++) if ((x + y) % 8 < 3) px(x, y, c);
  }
  const img = { w: W, h: H, data: d };
  bannerCache.set(id, img);
  return img;
}
function bannerFaces(out, x, y, z, facing, spec) { // a thin cloth, 2 blocks tall, hanging from the top of its cell on the wall behind it
  const t = { img: bannerImage(spec), tint: null, blend: false }, k = 1 / 16, top = y + 15 * k, bot = top - 2, f = { uv0: [0, 0], uv1: [1, 0], uv3: [0, 1], t, twoSided: true };
  const [dx, dz] = DIRS[facing] ?? [0, 1];
  if (dx !== 0) { const c = x + (dx > 0 ? 1 : 15) * k; out.push({ ...f, p0: [c, top, z + 2 * k], p1: [c, top, z + 14 * k], p3: [c, bot, z + 2 * k] }); }
  else { const c = z + (dz > 0 ? 1 : 15) * k; out.push({ ...f, p0: [x + 2 * k, top, c], p1: [x + 14 * k, top, c], p3: [x + 2 * k, bot, c] }); }
}

const kindCache = new Map();
// shape class of a block name: cube slab stairs gate fence wall pane trapdoor door plate lantern small post vine water cross
function kindOf(n) {
  if (kindCache.has(n)) return kindCache.get(n);
  const name = n.replace(/^[^:]+:/, ""), geo = n.startsWith(MOD_NS) ? modBlock(name)?.geometry ?? "" : "";
  let kind = "cube";
  if (/_double_slab$/.test(name)) kind = "cube";
  else if (/_slab$/.test(name)) kind = "slab";
  else if (/_stairs$/.test(name)) kind = "stairs";
  else if (/_fence_gate$/.test(name)) kind = "gate";
  else if (/_fence$/.test(name)) kind = "fence";
  else if (/_wall$/.test(name)) kind = "wall";
  else if (/glass_pane$|^iron_bars$/.test(name)) kind = "pane";
  else if (/trapdoor$/.test(name)) kind = "trapdoor";
  else if (/_door$/.test(name)) kind = "door";
  else if (/_carpet$|^leaf_litter$|pressure_plate$|^pink_petals$|^lily_pad$|^snow_layer$|rail$|^mallorn_blossom|^blossom_/.test(name) || /leaf_litter|blossom_\d/.test(geo)) kind = "plate";
  else if (/(^|_)lantern$|chandelier/.test(name)) kind = "lantern";
  else if (/^(flower_pot|decorated_pot|firefly_jar|cauldron|deer_antler|phial_light)$|(^|_)candle$|candle_cake/.test(name)) kind = "small";
  else if (/torch$|^end_rod$|^chain$|^elven_rope|^lightning_rod$/.test(name)) kind = "post";
  else if (name === "vine") kind = "vine";
  else if (/^(flowing_)?water$/.test(name)) kind = "water";
  else if (isCross(name) || /plant_cross|sapling/.test(geo) || /^(athelas|elanor|niphredil|golden_fern|nectar_bloom|western_corn|great_mallorn_sprout)/.test(name)) kind = "cross";
  else if (n.startsWith(MOD_NS) && geo && geo !== "minecraft:geometry.full_block") kind = "small";
  else if (/^(chest|trapped_chest|ender_chest|bed|.*_bed|.*_banner|.*_sign|.*_skull|.*_head)$/.test(name)) kind = "small";
  kindCache.set(n, kind);
  return kind;
}

// all faces of the block at (x,y,z); `unknown` collects names without texture
function blockFaces(out, b, x, y, z, get, unknown) {
  const n = b.n, st = b.st ?? {}, name = n.replace(/^[^:]+:/, ""), isMod = n.startsWith(MOD_NS), info = isMod ? modBlock(name) : null;
  if (isAir(n) || isLightBlock(n)) return;
  if (name === "standing_banner") { // a pole and a 2-block cloth on it, turned by ground_sign_direction (0 south, 4 west, 8 north, 12 east)
    const d = st.ground_sign_direction ?? 0, facing = ["south", "west", "north", "east"][((d >> 2) % 4 + 4) % 4], t = { img: bannerImage(b.banner), tint: null, blend: false }, k = 1 / 16;
    boxFaces(out, x, y, z, [7.5, 0, 7.5, 8.5, 16, 8.5], one({ img: bannerImage({ base: "brown", patterns: [] }), tint: null, blend: false }), null);
    const f = { uv0: [0, 0], uv1: [1, 0], uv3: [0, 1], t, twoSided: true };
    if (facing === "south" || facing === "north") out.push({ ...f, p0: [x + 2 * k, y + 2, z + 8 * k], p1: [x + 14 * k, y + 2, z + 8 * k], p3: [x + 2 * k, y + 0.3, z + 8 * k] });
    else out.push({ ...f, p0: [x + 8 * k, y + 2, z + 2 * k], p1: [x + 8 * k, y + 2, z + 14 * k], p3: [x + 8 * k, y + 0.3, z + 2 * k] });
    return;
  }
  if (name === "wall_banner") { // the facing_direction state: 2 north, 3 south, 4 west, 5 east
    bannerFaces(out, x, y, z, { 2: "north", 3: "south", 4: "west", 5: "east" }[st.facing_direction] ?? "south", b.banner);
    return;
  }
  const nbName = (d) => { const v = NB[d], o = get(x + v[0], y + v[1], z + v[2]); return o && !isAir(o.n) ? o.n : null; };
  const solid = (o) => o && kindOf(o) === "cube" && !CUTOUT.test(o);
  const cullCube = new Set(FACES.filter((d) => solid(nbName(d))));
  const tmpl = n === "minecraft:jigsaw" ? blockTextures(MOD_NS + "mallorn_planks") : blockTextures(n, st);
  if (!tmpl) { unknown.add(n); boxFaces(out, x, y, z, [0, 0, 0, 16, 16, 16], one({ img: null, magenta: true })); return; }
  const full = (box, T = tmpl, extra, skip) => boxFaces(out, x, y, z, box, T, skip, { emit: emitLevel(n) > 0, ...extra });
  const blendEx = (T) => (T.up?.blend ? { blend: true } : {});
  const dir = cardinal(st), top = isTop(st), kind = n === "minecraft:jigsaw" ? "cube" : kindOf(n);

  const axisFix = () => { // logs: pillar_axis x / z or block_face north..west turns the end caps
    const ax = st.pillar_axis ?? ((v) => v === "east" || v === "west" ? "x" : v === "north" || v === "south" ? "z" : "y")(st["minecraft:block_face"]);
    if (!ax || ax === "y" || tmpl.up === tmpl.north) return tmpl;
    const end = tmpl.up, side = tmpl.north;
    return ax === "x" ? { up: side, down: side, north: side, south: side, east: end, west: end } : { up: side, down: side, north: end, south: end, east: side, west: side };
  };

  if (kind === "cube") { const T = axisFix(); full([0, 0, 0, 16, 16, 16], T, blendEx(T), cullCube); }
  else if (kind === "slab") full([0, top ? 8 : 0, 0, 16, top ? 16 : 8, 16]);
  else if (kind === "stairs") { // slab + a half-high step on the ascending side (corner shapes are not drawn)
    full([0, top ? 8 : 0, 0, 16, top ? 16 : 8, 16]);
    const [dx, dz] = DIRS[dir] ?? [0, 1], bx = dx > 0 ? 8 : 0, bz = dz > 0 ? 8 : 0, ex = dx === 0 ? 16 : bx + 8, ez = dz === 0 ? 16 : bz + 8;
    full([dx === 0 ? 0 : bx, top ? 0 : 8, dz === 0 ? 0 : bz, ex, top ? 8 : 16, ez]);
  } else if (kind === "fence" || kind === "wall" || kind === "pane") {
    const wall = kind === "wall", pane = kind === "pane", hasStates = Object.keys(st).some((k) => k.startsWith("minecraft:connection_"));
    const lo = pane ? 7 : wall ? 4 : 6, hi = 16 - lo, arm = pane ? 1 : wall ? 5 : 7, h = wall ? 16 : 16;
    full([lo, 0, lo, hi, h, hi]);
    for (const d of ["north", "south", "east", "west"]) {
      const o = nbName(d), link = hasStates ? ["true", true, 1].includes(st["minecraft:connection_" + d]) : o && (new RegExp(kind === "wall" ? "_wall$" : kind === "pane" ? "pane$|bars$" : "_fence$|_fence_gate$").test(o) || (!CUTOUT.test(o) && !/slab|stairs|carpet|plate|lantern|torch|plant|sapling|vine|rope|jar|chandelier|grass$|flower/.test(o)));
      if (!link) continue;
      const [dx, dz] = DIRS[d], a0 = 16 - arm, bars = wall || pane ? [[0, wall ? 14 : 16]] : [[6, 9], [12, 15]];
      for (const [by0, by1] of bars) {
        const bx0 = dx > 0 ? hi : dx < 0 ? 0 : a0 / 2, bx1 = dx > 0 ? 16 : dx < 0 ? lo : 16 - a0 / 2, bz0 = dz > 0 ? hi : dz < 0 ? 0 : a0 / 2, bz1 = dz > 0 ? 16 : dz < 0 ? lo : 16 - a0 / 2;
        full([bx0, by0, bz0, bx1, by1, bz1]);
      }
    }
  } else if (kind === "gate") { // two rails across the cell (open gates are drawn closed)
    const along = dir === "north" || dir === "south" ? "x" : "z";
    for (const [a, b] of [[5, 8], [10, 15]]) full(along === "x" ? [0, a, 7, 16, b + 1, 9] : [7, a, 0, 9, b + 1, 16]);
    full(along === "x" ? [0, 5, 7, 2, 16, 9] : [7, 5, 0, 9, 16, 2]); full(along === "x" ? [14, 5, 7, 16, 16, 9] : [7, 5, 14, 9, 16, 16]);
  } else if (kind === "trapdoor") {
    if (!isOpen(st)) full([0, top ? 13 : 0, 0, 16, top ? 16 : 3, 16]);
    else {
      let [dx, dz] = DIRS[dir] ?? [0, 1];
      if (isMod) { dx = -dx; dz = -dz; } // mod trapdoor: the panel is on the edge opposite to `minecraft:cardinal_direction` (its connection rule attaches it there)
      full([dx > 0 ? 13 : 0, 0, dz > 0 ? 13 : 0, dx < 0 ? 3 : 16, 16, dz < 0 ? 3 : 16]);
    }
  } else if (kind === "door") {
    const [dx, dz] = DIRS[dir] ?? [0, 1], op = isOpen(st);
    const side = op ? (dz === 0 ? "z" : "x") : dx === 0 ? "z" : "x";
    const lowSide = (dx > 0 || dz > 0) ? 13 : 0;
    full(side === "z" ? [0, 0, op ? 0 : lowSide, 16, 16, op ? 3 : lowSide + 3] : [op ? 0 : lowSide, 0, 0, op ? 3 : lowSide + 3, 16, 16]);
  } else if (kind === "plate") full([name.includes("pressure") ? 1 : 0, 0, name.includes("pressure") ? 1 : 0, name.includes("pressure") ? 15 : 16, name.includes("pressure") ? 1 : 1, name.includes("pressure") ? 15 : 16]);
  else if (kind === "lantern") {
    const hang = st.hanging === true || st["minecraft:block_face"] === "down";
    if (info?.box || isMod) full([4, hang ? 6 : 0, 4, 12, hang ? 16 : 10, 12]);
    else { full([5, hang ? 7 : 0, 5, 11, hang ? 14 : 7, 11]); full([6, hang ? 14 : 7, 6, 10, hang ? 16 : 9, 10]); }
  } else if (kind === "small") {
    if (name === "flower_pot" && b.plant) { // the potted plant (block entity data) as a cross above the pot
      const pt = blockTextures(b.plant.name, b.plant.states);
      if (pt) { planeFaces(out, x, y + 5 / 16, z, "x", 8, pt.north); planeFaces(out, x, y + 5 / 16, z, "z", 8, pt.north); }
    }
    const b2 = info?.box ?? (name === "flower_pot" ? [5, 0, 5, 11, 6, 11] : name === "decorated_pot" ? [1, 0, 1, 15, 16, 15] : /candle/.test(name) ? [6, 0, 6, 10, 6, 10] : [3, 0, 3, 13, 10, 13]);
    full(b2.map((v) => Math.max(0, Math.min(16, v))), tmpl, blendEx(tmpl));
  } else if (kind === "post") full(/rope/.test(name) ? [7, 0, 7, 9, 16, 9] : name === "chain" ? [6.5, 0, 6.5, 9.5, 16, 9.5] : [7, 0, 7, 9, 10, 9]);
  else if (kind === "vine") {
    const bits = st.vine_direction_bits ?? 0, t = { ...tmpl.north };
    if (bits & 1) planeFaces(out, x, y, z, "z", 15, t); if (bits & 4) planeFaces(out, x, y, z, "z", 1, t); if (bits & 2) planeFaces(out, x, y, z, "x", 1, t); if (bits & 8) planeFaces(out, x, y, z, "x", 15, t);
    if (!bits) boxFaces(out, x, y, z, [0, 15, 0, 16, 16, 16], one(t), null);
  } else if (kind === "water") {
    const above = nbName("up"), hh = above && /water/.test(above) ? 16 : 14;
    full([0, 0, 0, 16, hh, 16], tmpl, { blend: true, alpha: 0.62 }, new Set(FACES.filter((d) => /water/.test(nbName(d) ?? ""))));
  } else if (kind === "cross") {
    const t = tmpl.north;
    planeFaces(out, x, y, z, "x", 8, t, { emit: emitLevel(n) > 0 }); planeFaces(out, x, y, z, "z", 8, t, { emit: emitLevel(n) > 0 });
  }
}

// ---- the renderer --------------------------------------------------------------------------------------------------------
// Faces of the whole region -> z-buffer rasteriser (opaque + cutout first, translucent faces back to front after).
export function renderTextured(get, R, file, opts = {}) {
  const { ppb = 16, rot = 0, night = false, nightFactor = 0.28, lightBlocks = night, leaves = true, quiet = false } = opts;
  const bg = opts.bg ?? (night ? [10, 13, 28] : [150, 184, 222]);
  const nx = R.x1 - R.x0 + 1, nz = R.z1 - R.z0 + 1, r4 = ((rot % 4) + 4) % 4;
  const tr = [(a, b) => [a, b], (a, b) => [nz - b, a], (a, b) => [nx - a, nz - b], (a, b) => [b, nx - a]][r4];
  const view = ([x, y, z]) => { const [a, b] = tr(x - R.x0, z - R.z0); return [a, y - R.y0, b]; };
  const unknown = new Set(), faces = [], emitters = [];
  const getN = (x, y, z) => { const b = get(x, y, z); return b && (leaves || !/leaves/.test(b.n)) ? b : null; };
  for (let x = R.x0; x <= R.x1; x++) for (let y = R.y0; y <= R.y1; y++) for (let z = R.z0; z <= R.z1; z++) {
    const b = getN(x, y, z);
    if (!b) continue;
    const L = emitLevel(b.n);
    if (L > 0 && (lightBlocks || !isLightBlock(b.n))) emitters.push({ q: view([x + 0.5, y + 0.5, z + 0.5]), L: isLightBlock(b.n) ? Math.min(L, 8) : L, faint: isLightBlock(b.n) });
    blockFaces(faces, b, x, y, z, getN, unknown);
  }
  if (unknown.size && !quiet) console.warn(`textured_render: ${unknown.size} block(s) without texture (magenta): ${[...unknown].sort().join(", ")}`);
  if (!faces.length) throw new Error("nothing to render");
  // project: sx = (X - Z) p, sy = (X + Z) p / 2 - Y p ; depth = X + Y + Z (larger = nearer to the viewer)
  const p = ppb;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const f of faces) {
    f.q0 = view(f.p0); f.q1 = view(f.p1); f.q3 = view(f.p3);
    for (const q of [f.q0, f.q1, f.q3, [f.q1[0] + f.q3[0] - f.q0[0], f.q1[1] + f.q3[1] - f.q0[1], f.q1[2] + f.q3[2] - f.q0[2]]]) {
      const sx = (q[0] - q[2]) * p, sy = (q[0] + q[2]) * p / 2 - q[1] * p;
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    }
  }
  const pad = 8, W = Math.ceil(maxX - minX) + 2 * pad, H = Math.ceil(maxY - minY) + 2 * pad;
  const col = new Uint8Array(W * H * 3), dep = new Float32Array(W * H).fill(-1e9), pos = night ? new Float32Array(W * H * 3) : null, glow = night ? new Uint8Array(W * H) : null, axis = night ? new Uint8Array(W * H) : null;
  for (let i = 0; i < W * H; i++) col.set(bg, i * 3);
  const sc = (q) => [(q[0] - q[2]) * p - minX + pad, (q[0] + q[2]) * p / 2 - q[1] * p - minY + pad];

  const draw = (f) => {
    const [s0x, s0y] = sc(f.q0), [s1x, s1y] = sc(f.q1), [s3x, s3y] = sc(f.q3), e1x = s1x - s0x, e1y = s1y - s0y, e2x = s3x - s0x, e2y = s3y - s0y;
    const det = e1x * e2y - e1y * e2x;
    if (Math.abs(det) < 1e-6 || (!f.twoSided && det < 0)) return;
    // shade by the dominant axis of the face normal: top 1.0, left (+z) 0.82, right (+x) 0.64
    const u = [f.q1[0] - f.q0[0], f.q1[1] - f.q0[1], f.q1[2] - f.q0[2]], v = [f.q3[0] - f.q0[0], f.q3[1] - f.q0[1], f.q3[2] - f.q0[2]];
    const nrm = [Math.abs(u[1] * v[2] - u[2] * v[1]), Math.abs(u[2] * v[0] - u[0] * v[2]), Math.abs(u[0] * v[1] - u[1] * v[0])];
    const shade = nrm[1] >= nrm[0] && nrm[1] >= nrm[2] ? 1 : nrm[2] >= nrm[0] ? 0.82 : 0.64;
    const D0 = f.q0[0] + f.q0[1] + f.q0[2], dA = f.q1[0] + f.q1[1] + f.q1[2] - D0, dB = f.q3[0] + f.q3[1] + f.q3[2] - D0;
    const img = f.t.img, tint = f.t.tint, blend = f.blend || f.t.blend, alpha = f.alpha ?? 1;
    const xa = Math.max(0, Math.floor(Math.min(s0x, s1x, s3x, s1x + s3x - s0x))), xb = Math.min(W - 1, Math.ceil(Math.max(s0x, s1x, s3x, s1x + s3x - s0x)));
    const ya = Math.max(0, Math.floor(Math.min(s0y, s1y, s3y, s1y + s3y - s0y))), yb = Math.min(H - 1, Math.ceil(Math.max(s0y, s1y, s3y, s1y + s3y - s0y)));
    const eps = 0.003;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const rx = x + 0.5 - s0x, ry = y + 0.5 - s0y, a = (rx * e2y - ry * e2x) / det, b = (e1x * ry - e1y * rx) / det;
      if (a < -eps || a > 1 + eps || b < -eps || b > 1 + eps) continue;
      const d = D0 + a * dA + b * dB, i = y * W + x;
      if (d < dep[i] - 1e-6) continue;
      let r, g, bl, al = 255;
      if (f.t.magenta) { r = 255; g = 0; bl = 255; } else {
        const ca = Math.min(0.9999, Math.max(0, a)), cb = Math.min(0.9999, Math.max(0, b));
        const uu = f.uv0[0] + ca * (f.uv1[0] - f.uv0[0]) + cb * (f.uv3[0] - f.uv0[0]), vv = f.uv0[1] + ca * (f.uv1[1] - f.uv0[1]) + cb * (f.uv3[1] - f.uv0[1]);
        const tx = Math.min(img.w - 1, Math.max(0, Math.floor(uu * img.w))), ty = Math.min(img.h - 1, Math.max(0, Math.floor(vv * img.h))), ti = (ty * img.w + tx) * 4;
        al = img.data[ti + 3];
        if (blend ? al < 8 : al < 128) continue;
        r = img.data[ti]; g = img.data[ti + 1]; bl = img.data[ti + 2];
        if (tint && !(f.t.tintGrey && (Math.abs(r - g) > 12 || Math.abs(g - bl) > 12))) { r = (r * tint[0]) / 255; g = (g * tint[1]) / 255; bl = (bl * tint[2]) / 255; }
      }
      r = Math.min(255, r * shade); g = Math.min(255, g * shade); bl = Math.min(255, bl * shade);
      if (blend) { const k = (al / 255) * alpha; col[i * 3] = col[i * 3] * (1 - k) + r * k; col[i * 3 + 1] = col[i * 3 + 1] * (1 - k) + g * k; col[i * 3 + 2] = col[i * 3 + 2] * (1 - k) + bl * k; continue; }
      dep[i] = d; col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = bl;
      if (night) {
        pos[i * 3] = f.q0[0] + a * u[0] + b * v[0]; pos[i * 3 + 1] = f.q0[1] + a * u[1] + b * v[1]; pos[i * 3 + 2] = f.q0[2] + a * u[2] + b * v[2];
        glow[i] = f.emit ? 1 : 0; axis[i] = nrm[1] >= nrm[0] && nrm[1] >= nrm[2] ? 1 : nrm[2] >= nrm[0] ? 2 : 0;
      }
    }
  };
  for (const f of faces) if (!f.blend && !f.t.blend) draw(f);
  const depthOf = (f) => f.q0[0] + f.q0[1] + f.q0[2] + (f.q1[0] + f.q1[1] + f.q1[2] + f.q3[0] + f.q3[1] + f.q3[2] - 3 * (f.q0[0] + f.q0[1] + f.q0[2])) / 2;
  const trans = faces.filter((f) => f.blend || f.t.blend).sort((a, b) => depthOf(a) - depthOf(b));
  const solidDep = dep.slice(); // translucent faces test against opaque depth only
  for (const f of trans) { draw(f); dep.set(solidDep); }

  if (night) {
    const field = lightField(getN, R, view);
    lightPass({ col, dep, pos, glow, axis, W, H, p, minX, minY, pad, emitters, nightFactor, field });
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(W, H, col));
  return { W, H, unknown: [...unknown] };
}

// Night: block light as the game spreads it (flood fill from every emitter, -1 per step, stopped by full opaque blocks, -2 through leaves;
// hidden light blocks light the scene too), sampled in the cell in front of each visible face; plus a faint screen-space halo round visible lamps.
const OPAQUE = /(planks|_log$|_wood$|stone|dirt|grass_block|podzol|bookshelf|quartz_block|calcite|froglight|concrete$|_wool$|terracotta|deepslate|moss_block|barrel|loom|fletching_table|composter|double_slab|sandstone|bricks?$|cauldron)/;
function lightField(getN, R, view) {
  const m = 15, L = new Map(), q = [];
  const cost = (x, y, z) => {
    const b = getN(x, y, z);
    if (!b || isAir(b.n) || isLightBlock(b.n)) return 1;
    if (/leaves/.test(b.n)) return 2;
    return OPAQUE.test(b.n.replace(/^[a-z_]+:/, "")) && !/slab$|stairs$|fence|trapdoor|pressure_plate|button|carpet/.test(b.n) ? 0 : 1;
  };
  for (let x = R.x0; x <= R.x1; x++) for (let y = R.y0; y <= R.y1; y++) for (let z = R.z0; z <= R.z1; z++) {
    const b = getN(x, y, z);
    const e = b ? emitLevel(b.n) : 0;
    if (e > 0) { L.set(`${x},${y},${z}`, e); q.push([x, y, z]); }
  }
  q.sort((a, b) => L.get(b.join(",")) - L.get(a.join(",")));
  for (let i = 0; i < q.length; i++) { // not strictly ordered by level, so a cell may be raised again (it is pushed again)
    const [x, y, z] = q[i], l = L.get(`${x},${y},${z}`);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < R.x0 - m || nx > R.x1 + m || ny < R.y0 - m || ny > R.y1 + m || nz < R.z0 - m || nz > R.z1 + m) continue;
      const c = cost(nx, ny, nz);
      if (!c) continue;
      const nl = l - c, k = `${nx},${ny},${nz}`;
      if (nl > 0 && nl > (L.get(k) ?? 0)) { L.set(k, nl); q.push([nx, ny, nz]); }
    }
  }
  const V = new Map(); // view-space cell -> light
  for (const [k, l] of L) { const [x, y, z] = k.split(",").map(Number), v = view([x + 0.5, y + 0.5, z + 0.5]); V.set(`${Math.floor(v[0])},${Math.floor(v[1])},${Math.floor(v[2])}`, l); }
  return V;
}
function lightPass({ col, dep, pos, glow, axis, W, H, p, minX, minY, pad, emitters, nightFactor, field }) {
  const warm = [1.0, 0.8, 0.52];
  const proj = (q) => [(q[0] - q[2]) * p - minX + pad, (q[0] + q[2]) * p / 2 - q[1] * p - minY + pad];
  const amb = [nightFactor * 0.8, nightFactor * 0.92, nightFactor * 1.25];
  for (let i = 0; i < W * H; i++) {
    if (dep[i] < -1e8) continue;
    const a = axis[i], s = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    s[a] += 0.02; // the cell in front of the visible face (visible faces look to +x, +y or +z in view space)
    const l = field.get(`${Math.floor(s[0])},${Math.floor(s[1])},${Math.floor(s[2])}`) ?? 0, f = Math.pow(l / 15, 1.6);
    for (let c = 0; c < 3; c++) col[i * 3 + c] = Math.min(255, col[i * 3 + c] * (glow[i] ? 1.1 : Math.max(amb[c], amb[c] + f * warm[c] * (1 - nightFactor * 0.5))));
  }
  for (const e of emitters) { // halo: additive, dimmed where the pixel is in front of the lamp
    if (e.faint || e.L < 5) continue;
    const [cx, cy] = proj(e.q), R = (0.5 + e.L / 15) * p * 1.1, dE = e.q[0] + e.q[1] + e.q[2];
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
      const d = Math.hypot(x - cx, y - cy) / R;
      if (d >= 1) continue;
      const i = y * W + x, s = Math.pow(1 - d, 2) * 0.5 * (e.L / 15) * (dep[i] > dE + 0.8 ? 0.2 : 1);
      for (let c = 0; c < 3; c++) col[i * 3 + c] = Math.min(255, col[i * 3 + c] + s * 255 * warm[c]);
    }
  }
}

// blocksMap = Map("x,y,z" -> { name, states }) (build_village.mjs format) -> PNG
export function renderBlocks(blocksMap, outPng, opts = {}) {
  const R = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 }, cells = new Map();
  for (const [k, b] of blocksMap) {
    const [x, y, z] = k.split(",").map(Number);
    if (isAir(b.name)) continue;
    cells.set(k, { n: b.name, st: b.states ?? {}, banner: b.banner, plant: b.plant });
    R.x0 = Math.min(R.x0, x); R.x1 = Math.max(R.x1, x); R.y0 = Math.min(R.y0, y); R.y1 = Math.max(R.y1, y); R.z0 = Math.min(R.z0, z); R.z1 = Math.max(R.z1, z);
  }
  if (!cells.size) throw new Error("renderBlocks: no blocks");
  return renderTextured((x, y, z) => cells.get(`${x},${y},${z}`) ?? null, R, outPng, opts);
}
