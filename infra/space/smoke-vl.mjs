import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDir, '..', '..');
const sampleId = process.argv[2] || 'landing-generic';
const tscBin = path.join(repoRoot, 'apps', 'daemon', 'node_modules', 'typescript', 'bin', 'tsc');

if (!fs.existsSync(tscBin)) {
  console.error('VL_SMOKE_FAILED missing TypeScript dependency; run pnpm install');
  process.exit(1);
}

const build = spawnSync(process.execPath, [tscBin, '-p', path.join('apps', 'daemon', 'tsconfig.json')], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const { chatVL } = await import(pathToFileURL(path.join(repoRoot, 'apps', 'daemon', 'dist', 'vken', 'llm', 'client.js')).href);
const { CritiqueSchema } = await import(pathToFileURL(path.join(repoRoot, 'apps', 'daemon', 'dist', 'vken', 'llm', 'schema.js')).href);

const result = await chatVL(
  [
    { role: 'system', content: 'Respond with a single JSON object only. No prose.' },
    { role: 'user', content: `Smoke critique for ${sampleId}` },
  ],
  CritiqueSchema,
  { provider: process.env.VKEN_LLM_PROVIDER || 'cassette', sampleId, phase: 'critique', timeoutMs: 60_000 },
);

if (typeof result.parsed?.designQuality !== 'number' || !Array.isArray(result.parsed?.findings)) {
  console.error('VL_SMOKE_FAILED invalid critique payload');
  process.exit(1);
}

console.log(`VL_SMOKE_OK provider=${result.providerId} model=${result.modelId} designQuality=${result.parsed.designQuality}`);
