import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDir, '..', '..');
const sampleId = process.argv[2] || 'landing-generic';
const tscBin = path.join(repoRoot, 'apps', 'daemon', 'node_modules', 'typescript', 'bin', 'tsc');

if (!fs.existsSync(tscBin)) {
  console.error('CODER_SMOKE_FAILED missing TypeScript dependency; run pnpm install');
  process.exit(1);
}

const build = spawnSync(process.execPath, [tscBin, '-p', path.join('apps', 'daemon', 'tsconfig.json')], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const { chatCoder } = await import(pathToFileURL(path.join(repoRoot, 'apps', 'daemon', 'dist', 'vken', 'llm', 'client.js')).href);
const { DirectionsSchema } = await import(pathToFileURL(path.join(repoRoot, 'apps', 'daemon', 'dist', 'vken', 'llm', 'schema.js')).href);

const result = await chatCoder(
  [
    { role: 'system', content: 'Respond with a single JSON object only. No prose.' },
    { role: 'user', content: `Smoke directions for ${sampleId}` },
  ],
  DirectionsSchema,
  { provider: process.env.VKEN_LLM_PROVIDER || 'cassette', sampleId, phase: 'directions', timeoutMs: 60_000 },
);

if (!Array.isArray(result.parsed?.directions) || result.parsed.directions.length !== 2) {
  console.error('CODER_SMOKE_FAILED invalid directions payload');
  process.exit(1);
}

console.log(`CODER_SMOKE_OK provider=${result.providerId} model=${result.modelId} directions=${result.parsed.directions.length}`);
