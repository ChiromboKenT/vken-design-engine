import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(thisDir, '..', '..');
const args = process.argv.slice(2);

function fail(message) {
  console.error(`VKEN_SMOKE_FAILED ${message}`);
  process.exit(1);
}

function usage() {
  fail('usage: node infra/space/smoke.mjs [--no-llm] sample landing-generic');
}

if (!process.versions.node.startsWith('24.')) {
  fail(`Node ${process.versions.node} detected; run with Node 24.x`);
}

const positional = args.filter((arg) => arg !== '--no-llm');
if (positional.length !== 2 || positional[0] !== 'sample') {
  usage();
}

const sampleId = positional[1];
const noLlm = args.includes('--no-llm');
if (!noLlm && !process.env.VKEN_OPENROUTER_KEY && !process.env.GOOGLE_API_KEY) {
  process.env.VKEN_LLM_PROVIDER = process.env.VKEN_LLM_PROVIDER || 'cassette';
}
const allowedSamples = new Set(['landing-generic', 'dashboard-cluttered', 'ecommerce-basic']);
if (!allowedSamples.has(sampleId)) {
  fail(`unknown sample "${sampleId}"`);
}

const daemonDist = path.join(repoRoot, 'apps', 'daemon', 'dist');
const runPipelineDist = path.join(daemonDist, 'vken', 'run-pipeline.js');
const dbDist = path.join(daemonDist, 'db.js');
const tscBin = path.join(repoRoot, 'apps', 'daemon', 'node_modules', 'typescript', 'bin', 'tsc');

if (!fs.existsSync(tscBin)) {
  fail('missing apps/daemon TypeScript dependency; run pnpm install first');
}

const build = spawnSync(process.execPath, [tscBin, '-p', path.join('apps', 'daemon', 'tsconfig.json')], {
  cwd: repoRoot,
  env: { ...process.env, CI: 'true' },
  stdio: 'inherit',
});
if (build.status !== 0) {
  fail(`daemon build exited ${build.status ?? 'unknown'}`);
}

if (!fs.existsSync(runPipelineDist) || !fs.existsSync(dbDist)) {
  fail('daemon dist was not produced');
}

const [{ openDatabase, closeDatabase }, { executeDeterministicVkenRun }] = await Promise.all([
  import(pathToFileURL(dbDist).href),
  import(pathToFileURL(runPipelineDist).href),
]);

const dataDir = path.resolve(process.env.OD_DATA_DIR || path.join(repoRoot, 'data'));
fs.mkdirSync(dataDir, { recursive: true });

const events = [];
const run = { id: `space-smoke-${randomUUID()}`, status: 'queued' };
const service = {
  emit(_run, event, data) {
    events.push({ event, data });
  },
  finish(targetRun, status) {
    targetRun.status = status;
    events.push({ event: 'end', data: { status } });
  },
  fail(targetRun, code, message) {
    targetRun.status = 'failed';
    events.push({ event: 'error', data: { code, message } });
  },
};

let db;
try {
  db = openDatabase(repoRoot, { dataDir });
  await executeDeterministicVkenRun({
    db,
    projectRoot: repoRoot,
    dataDir,
    service,
    run,
    request: { intake: { kind: 'sample', sampleId }, noLlm },
  });

  if (noLlm && run.status !== 'succeeded') {
    const error = events.find((event) => event.event === 'error');
    fail(error?.data?.message || 'deterministic run did not succeed');
  }
  if (!noLlm && run.status === 'failed') {
    const error = events.find((event) => event.event === 'error');
    fail(error?.data?.message || 'LLM run failed');
  }

  const captureRow = db
    .prepare('SELECT COUNT(*) AS count FROM vken_captures WHERE run_id = ?')
    .get(run.id);
  if (captureRow.count !== 3) {
    fail(`expected 3 captures, got ${captureRow.count}`);
  }

  const captures = db
    .prepare(
      `SELECT screenshot_path AS screenshotPath, aria_yaml AS ariaYaml, box_models_json AS boxModelsJson
       FROM vken_captures
       WHERE run_id = ?
       ORDER BY viewport`,
    )
    .all(run.id);
  for (const capture of captures) {
    if (!fs.existsSync(capture.screenshotPath)) {
      fail(`missing screenshot ${capture.screenshotPath}`);
    }
    const screenshotSize = fs.statSync(capture.screenshotPath).size;
    if (screenshotSize < 1024) {
      fail(`screenshot too small (${screenshotSize} bytes): ${capture.screenshotPath}`);
    }
    if (!capture.ariaYaml || capture.ariaYaml.length < 10) {
      fail(`empty ARIA snapshot for ${capture.screenshotPath}`);
    }
    const boxModels = JSON.parse(capture.boxModelsJson);
    if (!Array.isArray(boxModels) || boxModels.length === 0) {
      fail(`empty box model capture for ${capture.screenshotPath}`);
    }
  }

  const scoreRow = db
    .prepare('SELECT score_initial AS scoreInitial FROM vken_runs WHERE id = ?')
    .get(run.id);
  if (typeof scoreRow.scoreInitial !== 'number' || Number.isNaN(scoreRow.scoreInitial)) {
    fail('missing initial score');
  }

  const eventNames = new Set(events.map((event) => event.event));
  for (const requiredEvent of ['vken:intake', 'vken:scan', 'vken:capture', 'vken:score', 'end']) {
    if (!noLlm && requiredEvent === 'end') continue;
    if (!eventNames.has(requiredEvent)) {
      fail(`missing event ${requiredEvent}`);
    }
  }
  if (!noLlm) {
    const directionCount = events.filter((event) => event.event === 'vken:direction' && !event.data?.done).length;
    if (directionCount < 2) fail(`expected at least 2 directions, got ${directionCount}`);
  }

  console.log(
    `VKEN_SMOKE_OK noLlm=${noLlm} sample=${sampleId} run=${run.id} captures=${captureRow.count} score=${scoreRow.scoreInitial.toFixed(1)} data=${dataDir}`,
  );
} finally {
  if (db) {
    closeDatabase();
  }
}
