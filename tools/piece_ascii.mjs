// ASCII cross-sections of one Elven village .mcstructure piece (lothlorien_bp/structures/lothlorien/village/), run from mods/lothlorien:
//   node tools/piece_ascii.mjs                              list the piece names
//   node tools/piece_ascii.mjs <piece>                      size, jigsaw connectors (position, facing, name, pool) and entities
//   node tools/piece_ascii.mjs <piece> y <y>                one horizontal layer (rows = z, columns = x)
//   node tools/piece_ascii.mjs <piece> x <z> [y0 y1]        a vertical cut at fixed z (rows = y from the top, columns = x)   (mode name is the axis that runs ACROSS the picture)
//   node tools/piece_ascii.mjs <piece> z <x> [y0 y1]        a vertical cut at fixed x (columns = z)
// Legend: . air, P planks, b / t bottom / top slab, F fence, L lantern, % leaves, # log or wood, J jigsaw, ? other block, space = void (not stored).
// Coordinates are the piece's own (x east, z south, y up) before any jigsaw rotation.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMcstructure } from "./village_sim.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "lothlorien_bp", "structures", "lothlorien", "village");
const [name, mode, ...rest] = process.argv.slice(2);
if (!name) { console.log(readdirSync(dir).map((f) => f.replace(".mcstructure", "")).join("\n")); process.exit(0); }
const p = parseMcstructure(readFileSync(join(dir, name + ".mcstructure")), name);
const st = new Map(p.blocks.map((b) => [`${b.x},${b.y},${b.z}`, b]));
const ch = (x, y, z) => {
  const n = p.at(x, y, z); if (n == null) return " "; if (n.endsWith("air")) return ".";
  const b = st.get(`${x},${y},${z}`); if (!b) return "J";
  if (n.includes("slab")) return b.states["minecraft:vertical_half"] === "top" ? "t" : "b";
  if (n.includes("fence")) return "F"; if (n.includes("lantern")) return "L"; if (n.includes("plank")) return "P"; if (n.includes("leaves")) return "%";
  if (n.includes("log") || n.includes("wood")) return "#"; return "?";
};
const [sx, sy, sz] = p.size;
console.log(name, "size", p.size.join("x"));
if (!mode) {
  for (const j of p.jigsaws) console.log(`  jigsaw ${j.x},${j.y},${j.z} facing ${j.dirId} name ${j.name} target ${j.target} pool ${j.pool} final ${j.final}`);
  for (const e of p.entities) console.log(`  entity ${e.id} at ${e.pos?.map((v) => v.toFixed(1)).join(",")}`);
}
const rows = (a, b, line) => { for (let i = a; i >= b; i--) console.log(String(i).padStart(3), line(i)); };
if (mode === "x") { const z = +rest[0]; rows(+(rest[2] ?? sy - 1), +(rest[1] ?? 0), (y) => { let s = ""; for (let x = 0; x < sx; x++) s += ch(x, y, z); return s; }); }
if (mode === "z") { const x = +rest[0]; rows(+(rest[2] ?? sy - 1), +(rest[1] ?? 0), (y) => { let s = ""; for (let z = 0; z < sz; z++) s += ch(x, y, z); return s; }); }
if (mode === "y") { const y = +rest[0]; for (let z = 0; z < sz; z++) { let s = ""; for (let x = 0; x < sx; x++) s += ch(x, y, z); console.log(String(z).padStart(3), s); } }
