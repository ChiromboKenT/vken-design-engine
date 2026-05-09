/**
 * Records a real engine run's score sequence into apps/web/src/components/vken/hook-stream.json.
 * The Hook component on the public landing page replays this sequence at first paint —
 * it must reflect a real run, not a hand-tuned curve.
 *
 * Usage:
 *   pnpm --filter @open-design/daemon build
 *   node scripts/vken-record-hook-stream.ts [sampleId]   # default: landing-generic
 *
 * Provider: respects $VKEN_LLM_PROVIDER (default: cassette). For the public hook we want
 * a deterministic, judge-reproducible curve, so cassette mode is fine — the score values
 * still come from the real lint/score pipeline against the materialized FS.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { applyPatchVirtual, initVirtualFs, materializeTo } from '../apps/daemon/dist/vken/apply.js';
import { closeDatabase, openDatabase } from '../apps/daemon/dist/db.js';
import { proposePatches } from '../apps/daemon/dist/vken/propose.js';
import { executeDeterministicVkenRun, recomputeScoreFromMaterialized } from '../apps/daemon/dist/vken/run-pipeline.js';
import type { VkenRiskLevel, VkenSampleId, VkenWorkspaceIndex } from '../apps/daemon/dist/vken/types.js';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sampleId = (process.argv[2] ?? 'landing-generic') as VkenSampleId;
const outFile = path.resolve(repoRoot, 'apps/web/src/components/vken/hook-stream.json');
process.env.VKEN_LLM_PROVIDER ??= 'cassette';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `vken-hook-${sampleId}-`));
const scoreEvents: Array<{ when: string; value: number; ts: number }> = [];

try {
  const db = openDatabase(repoRoot, { dataDir });
  const service = makeRecordingService(scoreEvents);
  const run = { id: randomUUID(), status: 'queued' } as { id: string; status: string; workspacePath?: string; index?: VkenWorkspaceIndex };

  await executeDeterministicVkenRun({
    db,
    projectRoot: repoRoot,
    dataDir,
    service,
    run,
    request: { intake: { kind: 'sample', sampleId } },
  });
  if (run.status === 'failed' || !run.workspacePath || !run.index) throw new Error(`run ${run.id} failed to initialize`);

  // Approve up to 5 deterministic patches against a virtual FS, recording score after each apply.
  const direction = db
    .prepare(
      `SELECT id, name, mood, summary, changes_json AS changesJson, effort, risk, evidence_kb_ids AS evidenceKbIds
         FROM vken_directions WHERE run_id = ? ORDER BY created_at LIMIT 1`,
    )
    .get(run.id) as
    | { id: string; name: string; mood: string; summary: string; changesJson: string; effort: string; risk: string; evidenceKbIds: string }
    | undefined;
  if (!direction) throw new Error(`run ${run.id} produced no direction`);

  const vfs = initVirtualFs(run.workspacePath);
  const proposed = await proposePatches({
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

  const toApprove = proposed.patches.slice(0, 5);
  for (const patch of toApprove) {
    const result = applyPatchVirtual(vfs, patch);
    if (!result.ok) continue;
    const materializedDir = path.join(dataDir, `step-${scoreEvents.length}`);
    materializeTo(vfs, materializedDir, { linkNodeModules: true });
    const score = await recomputeScoreFromMaterialized({ runId: run.id, db, workspaceDir: materializedDir });
    scoreEvents.push({ when: 'scrub', value: score.value, ts: Date.now() });
  }
} finally {
  closeDatabase();
  fs.rmSync(dataDir, { recursive: true, force: true });
}

if (scoreEvents.length < 3) {
  console.error(`Only ${scoreEvents.length} score events captured; need >= 3 for a usable hook stream`);
  process.exit(1);
}

const scores = scoreEvents.map((event) => Math.round(event.value * 10) / 10);
const dts = scoreEvents.slice(1).map((event, index) => event.ts - scoreEvents[index]!.ts);
const intervalMs = dts.length > 0 ? Math.max(600, Math.round(dts.reduce((a, b) => a + b, 0) / dts.length)) : 900;

const payload = {
  $comment: `Recorded by vken-record-hook-stream.ts from a real ${sampleId} engine run on ${new Date().toISOString()}.`,
  source: 'recorded',
  sampleId,
  intervalMs,
  scores,
};
fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`VKEN_HOOK_STREAM_OK file=${outFile} samples=${scores.length} intervalMs=${intervalMs}`);

function normalizeRisk(value: string): VkenRiskLevel {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}

function makeRecordingService(scoreEvents: Array<{ when: string; value: number; ts: number }>) {
  return {
    emit(_run: unknown, event: string, data: unknown): void {
      if (event === 'vken:score') {
        const payload = data as { when?: string; value?: number };
        if (typeof payload.value === 'number') {
          scoreEvents.push({ when: payload.when ?? 'unknown', value: payload.value, ts: Date.now() });
        }
      }
    },
    finish(run: { status: string }, status: string): void {
      run.status = status;
    },
    fail(run: { status: string }): void {
      run.status = 'failed';
    },
  };
}
