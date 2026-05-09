import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../src/db.js';
import { kb } from '../src/vken/kb.js';
import { signKbRule, verifyKbRule } from '../src/vken/kb-signature.js';

const tempDirs: string[] = [];

afterEach(() => {
  closeDatabase();
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('vken kb', () => {
  it('stages, commits, retrieves, unstages, demotes, and verifies signatures', () => {
    process.env.VKEN_KB_SIGNING_KEY = 'test-key';
    const projectRoot = path.resolve('../..');
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-vken-kb-'));
    tempDirs.push(dataDir);
    const db = openDatabase(projectRoot, { dataDir });
    kb.stage({ db, runId: 'run-1', ruleId: 'rule-1', delta: 0.7, ruleText: 'Normalize card radius.', findingType: 'spacing' });
    const committed = kb.commit({ db, runId: 'run-1', kbDir: path.join(dataDir, 'learned.jsonl') });
    expect(committed).toHaveLength(1);
    expect(verifyKbRule(committed[0]!)).toBe(true);

    const retrieved = kb.retrieve({
      db,
      framework: 'vite-react-tailwind',
      findings: [{ dimension: 'spacing', severity: 'P2' }],
      topK: 1,
    });
    expect(retrieved[0]?.id).toBe('rule-1');

    kb.stage({ db, runId: 'run-2', ruleId: 'rule-2', delta: 0.1 });
    kb.unstage({ db, runId: 'run-2' });
    expect(kb.commit({ db, runId: 'run-2', kbDir: path.join(dataDir, 'learned.jsonl') })).toHaveLength(0);

    kb.demote({ db, ruleId: 'rule-1', reason: 'test' });
    expect(db.prepare(`SELECT reject_count AS rejectCount FROM vken_kb_rules WHERE id = 'rule-1'`).get()).toMatchObject({
      rejectCount: 1,
    });

    const signed = { ...committed[0]!, signature: signKbRule(committed[0]!) };
    fs.writeFileSync(path.join(dataDir, 'seed.jsonl'), `${JSON.stringify(signed)}\n`);
    expect(kb.loadJsonl(path.join(dataDir, 'seed.jsonl'))).toHaveLength(1);
  });
});
