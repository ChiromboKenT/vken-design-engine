import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/db.js';
import { executeDeterministicVkenRun } from '../src/vken/run-pipeline.js';

const tempDirs: string[] = [];

afterEach(() => {
  closeDatabase();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

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

describe('vken deterministic run pipeline', () => {
  it('indexes and scores the landing-generic sample without LLM calls', async () => {
    const projectRoot = path.resolve('../..');
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-vken-pipeline-'));
    tempDirs.push(dataDir);
    const db = openDatabase(projectRoot, { dataDir });
    const service = fakeService();
    const run = { id: 'run-test', status: 'queued' };

    await executeDeterministicVkenRun({
      db,
      projectRoot,
      dataDir,
      service,
      run,
      request: { intake: { kind: 'sample', sampleId: 'landing-generic' }, noLlm: true } as any,
    });

    expect(run.status).toBe('succeeded');
    expect(service.events.map((event) => event.event)).toContain('vken:intake');
    expect(service.events.map((event) => event.event)).toContain('vken:scan');
    expect(service.events.map((event) => event.event)).toContain('vken:capture');
    expect(service.events.map((event) => event.event)).toContain('vken:score');
    expect(
      db.prepare(`SELECT COUNT(*) AS count FROM vken_captures WHERE run_id = ?`).get(run.id),
    ).toMatchObject({ count: 3 });
  }, 60_000);

  it('auto-picks a direction and proposes patches for repairable samples', async () => {
    const originalProvider = process.env.VKEN_LLM_PROVIDER;
    process.env.VKEN_LLM_PROVIDER = 'cassette';
    const projectRoot = path.resolve('../..');
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-vken-pipeline-'));
    tempDirs.push(dataDir);
    const db = openDatabase(projectRoot, { dataDir });
    const service = fakeService();
    const run = { id: 'run-auto-propose', status: 'queued' };

    try {
      await executeDeterministicVkenRun({
        db,
        projectRoot,
        dataDir,
        service,
        run,
        request: { intake: { kind: 'sample', sampleId: 'landing-generic' } },
      });
    } finally {
      if (originalProvider === undefined) delete process.env.VKEN_LLM_PROVIDER;
      else process.env.VKEN_LLM_PROVIDER = originalProvider;
    }

    expect(run.status).toBe('running');
    expect(service.events).toContainEqual({
      event: 'vken:direction',
      data: { id: 'token-consolidation', picked: true },
    });
    expect(service.events.some((event) => event.event === 'vken:patch' && (event.data as { id?: string }).id)).toBe(true);
    const runRow = db
      .prepare(`SELECT direction_id AS directionId, patches_proposed AS patchesProposed FROM vken_runs WHERE id = ?`)
      .get(run.id) as { directionId: string; patchesProposed: number };
    const patchRow = db.prepare(`SELECT COUNT(*) AS count FROM vken_patches WHERE run_id = ?`).get(run.id) as {
      count: number;
    };
    expect(runRow.directionId).toBe('token-consolidation');
    expect(runRow.patchesProposed).toBeGreaterThan(0);
    expect(patchRow.count).toBeGreaterThan(0);
  }, 60_000);
});
