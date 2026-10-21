// Thin full-suite entry point. Select a feature with --suite NAME or mods --suite NAME.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const runner = fileURLToPath(new URL('../../../tools/test_suites.py', import.meta.url));
const manifest = fileURLToPath(new URL('./suites.json', import.meta.url));
const result = spawnSync('python', ['-B', runner, manifest, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
