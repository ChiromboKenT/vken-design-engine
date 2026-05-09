import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../src/db.js';
import { signKbRule } from '../src/vken/kb-signature.js';
import { tryPromoteToTier3 } from '../src/vken/kb.js';

const tempDirs: string[] = [];

afterEach(() => {
  closeDatabase();
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('kb.tryPromoteToTier3', () => {
  it('rejects a rule with only one distinct repo_hash in evidence', async () => {
    const { db, learnedPath } = makeDb();
    seedRule(db, { id: 'r1', evidenceRuns: ['run-a', 'run-b'] });
    seedRunRepoHash(db, { runId: 'run-a', repoHash: 'repo-1' });
    seedRunRepoHash(db, { runId: 'run-b', repoHash: 'repo-1' });

    const result = await tryPromoteToTier3({ db, ruleId: 'r1', kbDir: learnedPath, benchRunner: passingBench });

    expect(result).toMatchObject({ promoted: false, reason: 'fewer than 2 distinct repos' });
  });

  it('promotes a signed rule with multi-repo evidence and non-regressing bench', async () => {
    const { db, learnedPath } = makeDb();
    seedRule(db, { id: 'r2', evidenceRuns: ['run-a', 'run-b'] });
    seedRunRepoHash(db, { runId: 'run-a', repoHash: 'repo-1' });
    seedRunRepoHash(db, { runId: 'run-b', repoHash: 'repo-2' });

    const result = await tryPromoteToTier3({ db, ruleId: 'r2', kbDir: learnedPath, benchRunner: passingBench });

    expect(result).toMatchObject({ promoted: true });
    expect(db.prepare(`SELECT tier FROM vken_kb_rules WHERE id = 'r2'`).get()).toMatchObject({ tier: 3 });
    expect(fs.readFileSync(learnedPath, 'utf8')).toContain('"id":"r2"');
  });

  it('rejects when bench shows an individual sample regression greater than one point', async () => {
    const { db, learnedPath } = makeDb();
    seedRule(db, { id: 'r3', evidenceRuns: ['run-a', 'run-b'] });
    seedRunRepoHash(db, { runId: 'run-a', repoHash: 'repo-1' });
    seedRunRepoHash(db, { runId: 'run-b', repoHash: 'repo-2' });

    const result = await tryPromoteToTier3({
      db,
      ruleId: 'r3',
      kbDir: learnedPath,
      benchRunner: async () => ({ aggregateDelta: 0.2, worstSampleDelta: -1.2 }),
    });

    expect(result).toMatchObject({ promoted: false, reason: 'sample regressed by -1.2' });
  });
});

function makeDb() {
  process.env.VKEN_KB_SIGNING_KEY = 'test-key';
  const projectRoot = path.resolve('../..');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-vken-kb-promotion-'));
  tempDirs.push(dataDir);
  return {
    db: openDatabase(projectRoot, { dataDir }),
    learnedPath: path.join(dataDir, 'learned.jsonl'),
  };
}

function seedRule(db: any, input: { id: string; evidenceRuns: string[] }) {
  const now = Date.now();
  const rule = {
    id: input.id,
    finding_type: 'color',
    framework: 'vite-react-tailwind',
    severity: 'P2',
    rule_text: 'Replace repeated low-contrast color literals with an existing readable token.',
    accept_count: input.evidenceRuns.length,
    reject_count: 0,
    avg_score_delta: 0.5,
    evidence_runs: input.evidenceRuns,
    signature: '',
    tier: 2,
    created_at: now,
    updated_at: now,
  };
  rule.signature = signKbRule(rule);
  db.prepare(
    `INSERT INTO vken_kb_rules
      (id, finding_type, framework, severity, rule_text, accept_count, reject_count,
       avg_score_delta, evidence_runs, signature, tier, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    rule.id,
    rule.finding_type,
    rule.framework,
    rule.severity,
    rule.rule_text,
    rule.accept_count,
    rule.reject_count,
    rule.avg_score_delta,
    JSON.stringify(rule.evidence_runs),
    rule.signature,
    rule.tier,
    rule.created_at,
    rule.updated_at,
  );
}

function seedRunRepoHash(db: any, input: { runId: string; repoHash: string }) {
  const targetId = `target-${input.runId}`;
  const now = Date.now();
  db.prepare(
    `INSERT INTO vken_targets
      (id, source, source_ref, framework, package_manager, tailwind_version, workspace_path, created_at)
     VALUES (?, 'sample', ?, 'vite-react-tailwind', 'npm', 3, '.', ?)`,
  ).run(targetId, input.repoHash, now);
  db.prepare(
    `INSERT INTO vken_runs (id, target_id, status, repo_hash, created_at)
     VALUES (?, ?, 'succeeded', ?, ?)`,
  ).run(input.runId, targetId, input.repoHash, now);
}

async function passingBench() {
  return { aggregateDelta: 0.4, worstSampleDelta: 0 };
}
