import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { signKbRule, verifyKbRule } from './kb-signature.js';
import { runKbBenchForCandidate, type VkenKbBenchCandidateSummary } from './kb-bench-core.js';

export interface KbRule {
  id: string;
  finding_type: string;
  framework: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  rule_text: string;
  accept_count: number;
  reject_count: number;
  avg_score_delta: number;
  evidence_runs: string[];
  signature: string;
  tier: 2 | 3;
  created_at: number;
  updated_at: number;
}

const staged = new Map<string, Array<{ ruleId: string; delta: number; ruleText?: string; findingType?: string }>>();

export const kb = {
  retrieve,
  stage,
  commit,
  tryPromoteToTier3,
  unstage,
  demote,
  loadJsonl,
};

export function retrieve(input: {
  findings: Array<{ dimension?: string; severity?: string }>;
  framework: string;
  topK: number;
  db: any;
}): KbRule[] {
  const dbRules = input.db
    .prepare(
      `SELECT id, finding_type, framework, severity, rule_text, accept_count, reject_count,
              avg_score_delta, evidence_runs, signature, tier, created_at, updated_at
         FROM vken_kb_rules
        WHERE framework = ?
        ORDER BY tier DESC, accept_count DESC, avg_score_delta DESC
        LIMIT ?`,
    )
    .all(input.framework, Math.max(input.topK * 2, input.topK))
    .map(normalizeRule) as KbRule[];
  const seedRules = loadJsonl(path.join(repoRoot(), 'kb', 'seed.jsonl'));
  const dimensions = new Set(input.findings.map((finding) => finding.dimension).filter(Boolean));
  return [...dbRules, ...seedRules]
    .sort((a, b) => scoreRule(b, dimensions) - scoreRule(a, dimensions))
    .slice(0, input.topK);
}

export function stage(input: {
  db: any;
  runId: string;
  ruleId: string;
  delta: number;
  ruleText?: string;
  findingType?: string;
}): void {
  const list = staged.get(input.runId) ?? [];
  const stagedItem: { ruleId: string; delta: number; ruleText?: string; findingType?: string } = {
    ruleId: input.ruleId,
    delta: input.delta,
  };
  if (input.ruleText !== undefined) stagedItem.ruleText = input.ruleText;
  if (input.findingType !== undefined) stagedItem.findingType = input.findingType;
  list.push(stagedItem);
  staged.set(input.runId, list);
}

export function commit(input: { db: any; runId: string; kbDir?: string }): KbRule[] {
  const list = staged.get(input.runId) ?? [];
  const now = Date.now();
  const committed: KbRule[] = [];
  for (const item of list) {
    const existing = input.db
      .prepare(
        `SELECT id, finding_type, framework, severity, rule_text, accept_count, reject_count,
                avg_score_delta, evidence_runs, signature, tier, created_at, updated_at
           FROM vken_kb_rules
          WHERE id = ?`,
      )
      .get(item.ruleId);
    const base: KbRule = existing
      ? normalizeRule(existing)
      : {
          id: item.ruleId || randomUUID(),
          finding_type: item.findingType ?? 'visual-system',
          framework: 'vite-react-tailwind',
          severity: 'P2',
          rule_text:
            item.ruleText ??
            'Prefer concrete token and hierarchy fixes that can be validated by literal search-replace patches.',
          accept_count: 0,
          reject_count: 0,
          avg_score_delta: 0,
          evidence_runs: [],
          signature: '',
          tier: 2,
          created_at: now,
          updated_at: now,
        };
    const acceptCount = base.accept_count + 1;
    const avgDelta = base.avg_score_delta === 0 ? item.delta : base.avg_score_delta * 0.7 + item.delta * 0.3;
    const evidenceRuns = [...new Set([...base.evidence_runs, input.runId])].slice(-50);
    const next: KbRule = {
      ...base,
      accept_count: acceptCount,
      avg_score_delta: avgDelta,
      evidence_runs: evidenceRuns,
      tier: base.tier ?? 2,
      updated_at: now,
    };
    next.signature = signKbRule(next);
    input.db
      .prepare(
        `INSERT INTO vken_kb_rules
          (id, finding_type, framework, severity, rule_text, accept_count, reject_count,
           avg_score_delta, evidence_runs, signature, tier, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           accept_count = excluded.accept_count,
           reject_count = excluded.reject_count,
           avg_score_delta = excluded.avg_score_delta,
           evidence_runs = excluded.evidence_runs,
           signature = excluded.signature,
           tier = excluded.tier,
           updated_at = excluded.updated_at`,
      )
      .run(
        next.id,
        next.finding_type,
        next.framework,
        next.severity,
        next.rule_text,
        next.accept_count,
        next.reject_count,
        next.avg_score_delta,
        JSON.stringify(next.evidence_runs),
        next.signature,
        next.tier,
        next.created_at,
        next.updated_at,
      );
    writeKbExamples({ db: input.db, runId: input.runId, ruleId: next.id, scoreDelta: item.delta });
    committed.push(next);
  }
  staged.delete(input.runId);
  return committed;
}

export async function tryPromoteToTier3(input: {
  db: any;
  ruleId: string;
  benchSamples?: string[];
  kbDir?: string;
  benchRunner?: (candidateRuleId: string) => Promise<VkenKbBenchCandidateSummary>;
}): Promise<{ promoted: boolean; reason?: string }> {
  const row = input.db
    .prepare(
      `SELECT id, finding_type, framework, severity, rule_text, accept_count, reject_count,
              avg_score_delta, evidence_runs, signature, tier, created_at, updated_at
         FROM vken_kb_rules
        WHERE id = ?`,
    )
    .get(input.ruleId);
  if (!row) return { promoted: false, reason: 'rule not found' };
  const rule = normalizeRule(row);
  if (rule.tier === 3) return { promoted: true, reason: 'already tier 3' };
  if (rule.evidence_runs.length === 0) return { promoted: false, reason: 'no evidence runs' };

  const repoHashes = input.db
    .prepare(
      `SELECT DISTINCT COALESCE(vr.repo_hash, vt.source_ref) AS repoHash
         FROM vken_runs vr
         JOIN vken_targets vt ON vt.id = vr.target_id
        WHERE vr.id IN (${rule.evidence_runs.map(() => '?').join(',')})`,
    )
    .all(...rule.evidence_runs)
    .map((candidate: any) => candidate.repoHash)
    .filter(Boolean);
  if (new Set(repoHashes).size < 2) return { promoted: false, reason: 'fewer than 2 distinct repos' };

  const bench = input.benchRunner
    ? await input.benchRunner(input.ruleId)
    : await runKbBenchForCandidate({
        db: input.db,
        candidateRuleId: input.ruleId,
        ...(input.benchSamples === undefined ? {} : { samples: input.benchSamples }),
      });
  if (bench.aggregateDelta < 0) return { promoted: false, reason: `aggregate regression ${bench.aggregateDelta}` };
  if (bench.worstSampleDelta < -1) return { promoted: false, reason: `sample regressed by ${bench.worstSampleDelta}` };

  if (!verifyKbRule(rule)) return { promoted: false, reason: 'signature invalid' };

  const now = Date.now();
  const promoted: KbRule = { ...rule, tier: 3, updated_at: now };
  input.db.prepare(`UPDATE vken_kb_rules SET tier = 3, updated_at = ? WHERE id = ?`).run(now, rule.id);
  upsertJsonlRule(input.kbDir ?? path.join(repoRoot(), 'kb', 'learned.jsonl'), promoted);
  return { promoted: true };
}

export function unstage(input: { db: any; runId: string; ruleIds?: string[] }): void {
  const current = staged.get(input.runId) ?? [];
  if (!input.ruleIds) {
    staged.delete(input.runId);
    return;
  }
  staged.set(
    input.runId,
    current.filter((item) => !input.ruleIds!.includes(item.ruleId)),
  );
}

export function demote(input: { db: any; ruleId: string; reason: string }): void {
  input.db
    .prepare(
      `UPDATE vken_kb_rules
          SET reject_count = reject_count + 1,
              updated_at = ?
        WHERE id = ?`,
    )
    .run(Date.now(), input.ruleId);
  console.warn(`[vken:kb] demoted ${input.ruleId}: ${input.reason}`);
}

export function loadJsonl(filePath: string): KbRule[] {
  if (!fs.existsSync(filePath)) return [];
  const rules: KbRule[] = [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const rule = normalizeRule(JSON.parse(line));
      if (!verifyKbRule(rule)) {
        console.warn(`[vken:kb] invalid signature skipped: ${rule.id}`);
        continue;
      }
      rules.push(rule);
    } catch (error) {
      console.warn(`[vken:kb] invalid JSONL line skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return rules;
}

function upsertJsonlRule(filePath: string, rule: KbRule): void {
  const existing = loadJsonl(filePath).filter((item) => item.id !== rule.id);
  const rules = [...existing, rule].sort((a, b) => a.id.localeCompare(b.id));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${rules.map((item) => JSON.stringify(item)).join('\n')}\n`);
}

function writeKbExamples(input: { db: any; runId: string; ruleId: string; scoreDelta: number }): void {
  const patches = input.db
    .prepare(
      `SELECT id, finding_ids AS findingIds, file_path AS filePath, format, hunks_json AS hunksJson,
              rationale, severity, impact, risk, effort, confidence, patchable, evidence_kb_ids AS evidenceKbIds
         FROM vken_patches
        WHERE run_id = ? AND status = 'applied'
        ORDER BY updated_at DESC`,
    )
    .all(input.runId)
    .filter((patch: any) => {
      const ids = JSON.parse(patch.evidenceKbIds || '[]') as string[];
      return ids.includes(input.ruleId) || input.ruleId.startsWith(`learn-${patch.id}`);
    })
    .slice(0, 3);
  const insert = input.db.prepare(
    `INSERT OR IGNORE INTO vken_kb_examples
      (id, rule_id, finding_summary, patch_format, patch_json, score_delta, source_run_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const patch of patches) {
    insert.run(
      `ex_${patch.id}_${input.ruleId}`.slice(0, 120),
      input.ruleId,
      patch.rationale,
      patch.format,
      JSON.stringify({
        filePath: patch.filePath,
        hunks: JSON.parse(patch.hunksJson || '[]'),
        severity: patch.severity,
        impact: patch.impact,
        risk: patch.risk,
        effort: patch.effort,
        confidence: patch.confidence,
        patchable: patch.patchable,
        findingIds: JSON.parse(patch.findingIds || '[]'),
      }),
      input.scoreDelta,
      input.runId,
      Date.now(),
    );
  }
  input.db
    .prepare(
      `DELETE FROM vken_kb_examples
        WHERE rule_id = ?
          AND id NOT IN (
            SELECT id
              FROM vken_kb_examples
             WHERE rule_id = ?
             ORDER BY created_at DESC
             LIMIT 3
          )`,
    )
    .run(input.ruleId, input.ruleId);
}

function normalizeRule(rule: any): KbRule {
  return {
    id: String(rule.id),
    finding_type: String(rule.finding_type ?? rule.findingType ?? 'visual-system'),
    framework: String(rule.framework ?? 'vite-react-tailwind'),
    severity: normalizeSeverity(rule.severity),
    rule_text: String(rule.rule_text ?? rule.ruleText ?? ''),
    accept_count: Number(rule.accept_count ?? rule.acceptCount ?? 0),
    reject_count: Number(rule.reject_count ?? rule.rejectCount ?? 0),
    avg_score_delta: Number(rule.avg_score_delta ?? rule.avgScoreDelta ?? 0),
    evidence_runs: Array.isArray(rule.evidence_runs ?? rule.evidenceRuns)
      ? (rule.evidence_runs ?? rule.evidenceRuns).map(String)
      : JSON.parse(String(rule.evidence_runs ?? rule.evidenceRuns ?? '[]')).map(String),
    signature: String(rule.signature ?? ''),
    tier: Number(rule.tier) === 3 ? 3 : 2,
    created_at: Number(rule.created_at ?? rule.createdAt ?? 0),
    updated_at: Number(rule.updated_at ?? rule.updatedAt ?? rule.created_at ?? rule.createdAt ?? 0),
  };
}

function normalizeSeverity(value: unknown): KbRule['severity'] {
  return value === 'P0' || value === 'P1' || value === 'P2' || value === 'P3' ? value : 'P2';
}

function scoreRule(rule: KbRule, dimensions: Set<string | undefined>): number {
  const dimensionMatch = dimensions.has(rule.finding_type) ? 10 : 0;
  const tierBonus = rule.tier === 3 ? 3 : 1;
  return dimensionMatch + tierBonus + rule.accept_count * 2 + rule.avg_score_delta - rule.reject_count * 3;
}

function repoRoot(): string {
  return path.resolve(import.meta.dirname, '..', '..', '..', '..');
}
