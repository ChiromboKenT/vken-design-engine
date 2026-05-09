import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { closeDatabase, openDatabase } from '../apps/daemon/dist/db.js';
import { initVirtualFs } from '../apps/daemon/dist/vken/apply.js';
import { setTranscriptRecorder } from '../apps/daemon/dist/vken/llm/client.js';
import { proposePatches } from '../apps/daemon/dist/vken/propose.js';
import { executeDeterministicVkenRun } from '../apps/daemon/dist/vken/run-pipeline.js';
import type { VkenRiskLevel, VkenSampleId, VkenWorkspaceIndex } from '../apps/daemon/dist/vken/types.js';

const sampleId = normalizeSample(process.argv[2]);
if (!sampleId) {
  console.error('usage: node scripts/vken-record-cassette.ts <sampleId>');
  process.exit(1);
}

const repoRoot = path.resolve(import.meta.dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vken-record-cassette-'));
const calls: any[] = [];
setTranscriptRecorder({
  record(call) {
    calls.push({
      task: call.task,
      phase: call.phase,
      response: call.response,
      usage: {
        inputTokens: call.usage.inputTokens,
        outputTokens: call.usage.outputTokens,
      },
      providerId: call.providerId,
      modelId: call.modelId,
    });
  },
});

try {
  const db = openDatabase(repoRoot, { dataDir });
  const service = fakeService();
  const run: ScriptRun = { id: randomUUID(), status: 'queued' };
  await executeDeterministicVkenRun({
    db,
    projectRoot: repoRoot,
    dataDir,
    service,
    run,
    request: { intake: { kind: 'sample', sampleId } },
  });
  if (run.status === 'failed') {
    throw new Error(`run failed: ${JSON.stringify(service.events.slice(-3))}`);
  }
  if (!run.workspacePath || !run.index) throw new Error(`run ${run.id} did not initialize workspace context`);
  const direction = db
    .prepare(
      `SELECT id, name, mood, summary, changes_json AS changesJson, effort, risk, evidence_kb_ids AS evidenceKbIds
         FROM vken_directions
        WHERE run_id = ?
        ORDER BY created_at
        LIMIT 1`,
    )
    .get(run.id) as DirectionRow | undefined;
  if (!direction) throw new Error('no direction recorded');
  const vfs = initVirtualFs(run.workspacePath);
  const patches = await proposePatches({
    runId: run.id,
    db,
    workspacePath: run.workspacePath,
    index: run.index,
    direction: {
      id: direction.id,
      name: direction.name,
      mood: direction.mood,
      summary: direction.summary,
      changes: JSON.parse(direction.changesJson || '[]'),
      effort: normalizeRisk(direction.effort),
      risk: normalizeRisk(direction.risk),
      evidenceKbIds: JSON.parse(direction.evidenceKbIds || '[]'),
    },
    session: vfs,
    opts: { sampleId },
  });
  const out = {
    schemaVersion: 1,
    sampleId,
    runId: run.id,
    recordedAt: Date.now(),
    provider: process.env.VKEN_LLM_PROVIDER ?? 'openrouter',
    calls,
    patchCount: patches.patches.length,
  };
  const file = path.join(repoRoot, 'infra', 'space', 'cassettes', `${sampleId}.json`);
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`VKEN_CASSETTE_RECORDED file=${file} calls=${calls.length} patches=${patches.patches.length}`);
} finally {
  setTranscriptRecorder(null);
  closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
}

function fakeService() {
  const events: Array<{ event: string; data: unknown }> = [];
  return {
    events,
    emit(_run: unknown, event: string, data: unknown) {
      events.push({ event, data });
    },
    finish(run: { status: string }, status: string) {
      run.status = status;
      events.push({ event: 'end', data: { status } });
    },
    fail(run: { status: string }, _code: string, message: string) {
      run.status = 'failed';
      events.push({ event: 'error', data: { message } });
    },
  };
}

interface ScriptRun {
  id: string;
  status: string;
  workspacePath?: string;
  index?: VkenWorkspaceIndex;
}

interface DirectionRow {
  id: string;
  name: string;
  mood: string;
  summary: string;
  changesJson: string;
  effort: string;
  risk: string;
  evidenceKbIds: string;
}

function normalizeSample(value: string | undefined): VkenSampleId | null {
  const allowed = new Set<VkenSampleId>(['landing-generic', 'dashboard-cluttered', 'ecommerce-basic']);
  return value && allowed.has(value as VkenSampleId) ? (value as VkenSampleId) : null;
}

function normalizeRisk(value: string): VkenRiskLevel {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}
