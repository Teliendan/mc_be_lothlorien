// Small per-process harness. Feature suites never import another suite's tests.
import { readFileSync } from 'node:fs';
export const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
export const bp = (path) => readJson(`../lothlorien_bp/${path}`);
export const catalogEntries = () => readJson('../localization/catalog.json').packs.lothlorien_rp.entries;
let failed = 0;
export function test(name, body) {
  try { body(); console.log(`ok   ${name}`); }
  catch (error) { failed++; console.log(`FAIL ${name}\n     ${error.stack ?? error.message}`); }
}
export function finish() {
  if (failed) { console.log(`${failed} test(s) failed`); process.exitCode = 1; }
  else console.log('all tests passed');
}
