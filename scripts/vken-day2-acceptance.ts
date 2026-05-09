import { spawnSync } from 'node:child_process';

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
  ['node', ['scripts/vken-kb-bench.ts', 'seed-only']],
  ['node', ['scripts/vken-kb-bench.ts', 'seed+learned']],
] as const;

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, VKEN_LLM_PROVIDER: process.env.VKEN_LLM_PROVIDER || 'cassette' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('DAY_2_ACCEPTANCE_OK');
