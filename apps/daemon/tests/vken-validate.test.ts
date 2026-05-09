import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateMaterializedWorkspace } from '../src/vken/validate.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('vken/validate', () => {
  it('reports real Playwright measurements instead of fixed constants', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vken-validate-'));
    tempDirs.push(dir);
    const fixture = path.resolve('../..', 'samples', 'landing-generic');
    fs.cpSync(fixture, dir, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules`),
    });
    fs.symlinkSync(path.join(fixture, 'node_modules'), path.join(dir, 'node_modules'), 'junction');

    const db = makeMemoryDb();
    const events: Array<{ stage: string; ok: boolean }> = [];
    const result = await validateMaterializedWorkspace({
      runId: 'r_test',
      workspaceDir: dir,
      db,
      service: {
        emit: (_run, _event, data: any) => events.push({ stage: data.stage, ok: data.ok }),
      },
    });

    expect(result.byStage.a11y.details).toHaveProperty('axeRuns', 1);
    expect(result.byStage.pixel.details).not.toMatchObject({ visualGap: 0.04 });
    expect(new Set(events.map((event) => event.stage))).toEqual(
      new Set(['tsc', 'build', 'a11y', 'pixel', 'console']),
    );
  }, 120_000);
});

function makeMemoryDb() {
  const rows: any[] = [];
  return {
    prepare(sql: string) {
      if (sql.includes('SELECT id, screenshot_path')) {
        return { get: () => undefined };
      }
      return {
        run: (...args: any[]) => rows.push(args),
        get: () => undefined,
      };
    },
    rows,
  };
}
