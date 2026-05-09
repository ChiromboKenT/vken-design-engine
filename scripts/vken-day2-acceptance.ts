import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const samples = ['landing-generic', 'dashboard-cluttered', 'ecommerce-basic'] as const;
const STRICT = process.argv.includes('--strict');

const commands = [
  ['pnpm', ['install']],
  ['pnpm', ['typecheck']],
  ['pnpm', ['test']],
  ['pnpm', ['build']],
  ['pnpm', ['check:residual-js']],
  ['node', ['infra/space/smoke.mjs', '--no-llm', 'sample', 'landing-generic']],
  ['node', ['infra/space/smoke.mjs', '--no-llm', 'sample', 'dashboard-cluttered']],
  ['node', ['infra/space/smoke.mjs', '--no-llm', 'sample', 'ecommerce-basic']],
  ['node', ['infra/space/smoke-vl.mjs', 'landing-generic']],
  ['node', ['infra/space/smoke-coder.mjs', 'landing-generic']],
] as const;

for (const [command, args] of commands) run(command, args);

assertNoFabricatedMetricSource();
assertSeedIsHarvested();
assertBenchDiverges();
assertCassettesAreStructurallyValid();
if (STRICT) {
  assertCassettesHaveRealPatches();
  console.log('DAY_3_ACCEPTANCE_OK (strict)');
} else {
  console.log('  [skip strict cassette-patch check — run with --strict after MI300X recording]');
  console.log('DAY_3_ACCEPTANCE_OK (non-strict)');
}

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, [...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, VKEN_LLM_PROVIDER: process.env.VKEN_LLM_PROVIDER || 'cassette' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runJson(command: string, args: readonly string[]): unknown {
  const result = spawnSync(command, [...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, VKEN_LLM_PROVIDER: process.env.VKEN_LLM_PROVIDER || 'cassette' },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    process.stdout.write(result.stdout ?? '');
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout);
}

function assertNoFabricatedMetricSource(): void {
  const pattern = 'patches\\.length \\* 0\\.[0-9]|visualGap: 0\\.0[0-9]|hardcoded.*ok: true';
  const result = spawnSync('git', ['grep', '-nE', pattern, 'apps/daemon/src'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status === 0) {
    console.error(result.stdout);
    throw new Error('fabricated metric source still present');
  }
  if (result.status !== 1) throw new Error(result.stderr || 'git grep failed');
}

function assertSeedIsHarvested(): void {
  const seed = fs.readFileSync(path.join(repoRoot, 'kb', 'seed.jsonl'), 'utf8');
  if (seed.includes('Seed variant')) throw new Error('kb/seed.jsonl still contains placeholder Seed variant text');
}

function assertBenchDiverges(): void {
  const seedOnly = runJson('node', ['scripts/vken-kb-bench.ts', '--variant', 'seed-only', '--json']) as {
    aggregate?: unknown;
  };
  const seedLearned = runJson('node', ['scripts/vken-kb-bench.ts', '--variant', 'seed+learned', '--json']) as {
    aggregate?: unknown;
  };
  if (typeof seedOnly.aggregate !== 'number' || typeof seedLearned.aggregate !== 'number') {
    throw new Error('kb bench aggregate is not numeric');
  }
  if (seedOnly.aggregate === seedLearned.aggregate) {
    throw new Error('kb bench seed-only and seed+learned aggregates should diverge');
  }
}

function assertCassettesAreStructurallyValid(): void {
  for (const sample of samples) {
    const cassette = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'infra', 'space', 'cassettes', `${sample}.json`), 'utf8'),
    ) as {
      schemaVersion?: number;
      sampleId?: string;
      calls?: Array<{ task?: string; phase?: string; response?: unknown }>;
    };
    if (cassette.schemaVersion !== 1) throw new Error(`cassette ${sample} schemaVersion != 1`);
    if (cassette.sampleId !== sample) throw new Error(`cassette ${sample} sampleId mismatch`);
    const phases = new Set((cassette.calls ?? []).map((call) => call.phase));
    for (const required of ['critique', 'directions', 'patches']) {
      if (!phases.has(required)) throw new Error(`cassette ${sample} missing phase ${required}`);
    }
  }
}

function assertCassettesHaveRealPatches(): void {
  for (const sample of samples) {
    const cassette = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'infra', 'space', 'cassettes', `${sample}.json`), 'utf8'),
    ) as {
      calls?: Array<{ phase?: string; response?: { patches?: unknown[] } }>;
    };
    const patchCall = cassette.calls?.find((call) => call.phase === 'patches');
    const patchCount = patchCall?.response?.patches?.length ?? 0;
    if (patchCount <= 0) throw new Error(`cassette ${sample} still has no recorded patch response`);
  }
}
