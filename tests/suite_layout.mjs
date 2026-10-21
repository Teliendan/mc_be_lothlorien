// Guard test discoverability and independent suite loading as new tests are added.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('./', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('suites.json', root), 'utf8'));
assert.equal(manifest.version, 1);
const runners = new Set(Object.values(manifest.suites).flat());
const support = new Set(Object.keys(manifest.support_files));
for (const file of readdirSync(root).filter(name => /\.(mjs|js|py)$/.test(name))) {
  assert.ok(file === 'run.mjs' || runners.has(file) || support.has(file), `${file}: register its feature suite or document it as support`);
  if (!runners.has(file)) continue;
  const source = readFileSync(new URL(file, root), 'utf8');
  const imports = [...source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["']\.\/([^"']+)["']/g)];
  for (const [, dependency] of imports) {
    assert.ok(!runners.has(dependency) && dependency !== 'run.mjs', `${file}: importing ${dependency} runs unrelated tests; use a shared helper`);
  }
}
assert.equal(runners.has('run.mjs'), false, 'full entry point must not recurse into itself');
console.log(`ok   suite layout: ${runners.size} independent registered runners`);
