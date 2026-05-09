import { existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const samples = readdirSync(here)
  .filter((name) => statSync(join(here, name)).isDirectory())
  .filter((name) => existsSync(join(here, name, 'package.json')));

for (const name of samples) {
  const dir = join(here, name);
  const viteBin = join(dir, 'node_modules', 'vite', 'bin', 'vite.js');
  const tailwindBin = join(dir, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
  const startedAt = Date.now();
  if (existsSync(viteBin) && existsSync(tailwindBin)) {
    console.log(`[skip] ${name} (already installed)`);
    continue;
  }
  console.log(`[install] ${name}`);
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`[fail] ${name}`);
    process.exit(1);
  }
  const durationMs = Date.now() - startedAt;
  console.log(`[done] ${name} ${durationMs}ms`);
}

console.log('SAMPLES_INSTALLED_OK');
