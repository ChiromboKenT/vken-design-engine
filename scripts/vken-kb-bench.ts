import path from 'node:path';
import { runKbBench, type VkenKbBenchVariant } from '../apps/daemon/dist/vken/kb-bench-core.js';
import type { VkenSampleId } from '../apps/daemon/dist/vken/types.js';

const args = process.argv.slice(2);
const variant = readArg('--variant') ?? args.find((arg) => arg === 'seed-only' || arg === 'seed+learned') ?? 'seed+learned';
const samplesArg = readArg('--samples');
const json = args.includes('--json');
const repoRoot = path.resolve(import.meta.dirname, '..');
const samples = samplesArg ? normalizeSamples(samplesArg) : undefined;

const result = await runKbBench({
  projectRoot: repoRoot,
  variant: normalizeVariant(variant),
  ...(samples === undefined ? {} : { samples }),
});

console.log(JSON.stringify(result, null, 2));
if (!json) console.log('VKEN_KB_BENCH_OK');

function readArg(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function normalizeVariant(value: string): VkenKbBenchVariant {
  return value === 'seed-only' ? 'seed-only' : 'seed+learned';
}

function normalizeSamples(value: string): VkenSampleId[] {
  const allowed = new Set<VkenSampleId>(['landing-generic', 'dashboard-cluttered', 'ecommerce-basic']);
  const samples = value
    .split(',')
    .map((sample) => sample.trim())
    .filter((sample): sample is VkenSampleId => allowed.has(sample as VkenSampleId));
  if (samples.length === 0) throw new Error(`--samples must include at least one known sample: ${[...allowed].join(', ')}`);
  return samples;
}
