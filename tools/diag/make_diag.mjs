// Build the Lothlorien DIAGNOSTIC packs from a git commit (the release candidate; never the working tree).
// Normally run through the workspace command `.\mods diag lothlorien <version> [--commit REV] [--deploy]`.
// - every script imports system/world through diag_wrap.js (per-file callback timing, freeze reports that name the
//   slowest single call, gap classes 150/300/700 ms, per-minute chat summary, dew flip / spawn / removal counters)
// - the release code is otherwise unchanged (leaf decay ON; 0.8.1/0.8.2 DIAG switched the old random-tick decay off)
// - BP/RP version as given (same UUIDs: importing upgrades the tester's installed packs in place), name tagged DIAG
// - lothlorien_skins is copied unchanged from the commit
// Usage: node make_diag.mjs <version> <commit> <out dir>
//   writes <out dir>/lothlorien_bp, lothlorien_rp, lothlorien_skins and <out dir>/../src (scratch extract of the commit)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
if (process.argv.length < 5) { console.error("usage: node make_diag.mjs <version> <commit> <out dir>"); process.exit(2); }
const VERSION = process.argv[2].split(".").map(Number), VS = VERSION.join(".");
if (VERSION.length !== 3 || VERSION.some((n) => !Number.isInteger(n) || n < 0)) throw new Error(`bad version ${process.argv[2]}`);
const COMMIT = process.argv[3];
const outRoot = path.resolve(process.argv[4]);
const srcRoot = path.join(path.dirname(outRoot), "src");
fs.rmSync(srcRoot, { recursive: true, force: true });
fs.mkdirSync(srcRoot, { recursive: true });
// relative paths: GNU tar (Git's) reads "C:" in a path as a remote host
execFileSync("git", ["-C", repo, "archive", "--format=tar", "-o", path.join(srcRoot, "src.tar"), COMMIT, "lothlorien_bp", "lothlorien_rp", "lothlorien_skins"]);
execFileSync("tar", ["-xf", "src.tar"], { cwd: srcRoot });
fs.rmSync(path.join(srcRoot, "src.tar"));
console.log(`source: ${execFileSync("git", ["-C", repo, "rev-parse", "--short", COMMIT]).toString().trim()} (git archive)`);
const src = path.join(srcRoot, "lothlorien_bp");
const out = path.join(outRoot, "lothlorien_bp");
fs.rmSync(outRoot, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
const scripts = path.join(out, "scripts");
const expected = fs.readdirSync(scripts).filter((n) => n.endsWith(".js"))
  .reduce((n, f) => n + (fs.readFileSync(path.join(scripts, f), "utf8").match(/registerCustomComponent\(/g)?.length ?? 0), 0);
fs.writeFileSync(path.join(scripts, "diag_wrap.js"),
  fs.readFileSync(path.join(here, "diag_wrap.js"), "utf8").replace("const EXPECTED = 0;", `const EXPECTED = ${expected};`));

// dew flip counter: the wrapper sets globalThis.__diagDew; the line must exist exactly once or the build fails
{
  const dewFile = path.join(scripts, "dew.js"), dewText = fs.readFileSync(dewFile, "utf8");
  const LINE = "if (next !== dewy) block.setPermutation(block.permutation.withState(DEW, next));";
  const n = dewText.split(LINE).length - 1;
  if (n !== 1) throw new Error(`dew.js: expected the dew flip line exactly once, found ${n}; update make_diag.mjs`);
  fs.writeFileSync(dewFile, dewText.replace(LINE, "if (next !== dewy) { globalThis.__diagDew?.(); block.setPermutation(block.permutation.withState(DEW, next)); }"));
}

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*"@minecraft\/server"\s*;?/;
let patched = 0;
for (const name of fs.readdirSync(scripts)) {
  if (!name.endsWith(".js") || name === "diag_wrap.js") continue;
  const file = path.join(scripts, name);
  let text = fs.readFileSync(file, "utf8");
  const m = text.match(IMPORT);
  if (!m) continue;
  const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  const want = names.filter((n) => n === "system" || n === "world");
  if (!want.length) continue;
  if (names.some((n) => /^(system|world)\s+as\b/.test(n))) throw new Error(`${name}: aliased import, patch by hand`);
  const rest = names.filter((n) => n !== "system" && n !== "world");
  const decl = want.map((n) => `const ${n} = __diag${n === "system" ? "System" : "World"}(${JSON.stringify(name)});`).join(" ");
  const repl = `${rest.length ? `import { ${rest.join(", ")} } from "@minecraft/server";\n` : ""}import { __diagSystem, __diagWorld } from "./diag_wrap.js";\n${decl}`;
  text = text.replace(IMPORT, repl);
  fs.writeFileSync(file, text);
  patched++;
}
// declarations must come after ALL imports of a file: move every later import line above the first const
for (const name of fs.readdirSync(scripts)) {
  const file = path.join(scripts, name);
  const text = fs.readFileSync(file, "utf8");
  const declLine = /^const (system|world) = __diag.*$/m;
  const d = text.match(declLine);
  if (!d) continue;
  const before = text.slice(0, d.index), after = text.slice(d.index + d[0].length);
  // later top-level imports (single or multi-line) are lifted above the declaration
  const lifted = [];
  const rest = after.replace(/^import\s[\s\S]*?from\s*"[^"]+"\s*;?[ \t]*$|^import\s+"[^"]+"\s*;?[ \t]*$/gm, (imp) => { lifted.push(imp); return ""; });
  fs.writeFileSync(file, before + lifted.join("\n") + (lifted.length ? "\n" : "") + d[0] + rest);
}

// version and name
const mf = path.join(out, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(mf, "utf8"));
manifest.header.version = VERSION;
for (const mod of manifest.modules) mod.version = VERSION;
// the resource pack: unchanged content, same version as the BP (so an install over a higher old version upgrades both)
const rpSrc = path.join(srcRoot, "lothlorien_rp"), rpOut = path.join(outRoot, "lothlorien_rp");
fs.cpSync(rpSrc, rpOut, { recursive: true });
fs.cpSync(path.join(srcRoot, "lothlorien_skins"), path.join(outRoot, "lothlorien_skins"), { recursive: true });
const rmf = path.join(rpOut, "manifest.json"), rp = JSON.parse(fs.readFileSync(rmf, "utf8"));
rp.header.version = VS; for (const mod of rp.modules) mod.version = VS;
fs.writeFileSync(rmf, JSON.stringify(rp, null, 4) + "\n");
const dep = manifest.dependencies.find((d) => d.uuid === rp.header.uuid);
if (!dep) throw new Error("BP has no dependency on the RP");
dep.version = VERSION;
fs.writeFileSync(mf, JSON.stringify(manifest, null, 4) + "\n");
for (const lang of fs.readdirSync(path.join(out, "texts")).filter((f) => f.endsWith(".lang"))) {
  const lf = path.join(out, "texts", lang);
  const lines = fs.readFileSync(lf, "utf8").split("\n").map((l) => l.startsWith("pack.name=") ? `${l.replace(/\s+$/, "")} DIAG ${VS}` : l);
  fs.writeFileSync(lf, lines.join("\n"));
}
console.log(`patched ${patched} script files -> ${out}`);
