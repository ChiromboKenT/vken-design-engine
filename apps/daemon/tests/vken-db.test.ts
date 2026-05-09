import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { closeDatabase, openDatabase } from '../src/db.js';

const tempDirs: string[] = [];

afterEach(() => {
  closeDatabase();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-vken-db-'));
  tempDirs.push(dir);
  return { db: openDatabase(dir, { dataDir: path.join(dir, '.od') }), dir };
}

describe('vken database migrations', () => {
  it('creates every vken table idempotently', () => {
    const { dir } = createDb();
    closeDatabase();
    const reopened = openDatabase(dir, { dataDir: path.join(dir, '.od') });
    const rows = reopened
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'vken_%' ORDER BY name`,
      )
      .all() as Array<{ name: string }>;

    expect(rows.map((row) => row.name)).toEqual([
      'vken_captures',
      'vken_directions',
      'vken_findings',
      'vken_kb_examples',
      'vken_kb_rules',
      'vken_patches',
      'vken_repo_memory',
      'vken_run_memory',
      'vken_runs',
      'vken_targets',
      'vken_validations',
    ]);
  });
});
