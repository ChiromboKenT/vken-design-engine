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
});
