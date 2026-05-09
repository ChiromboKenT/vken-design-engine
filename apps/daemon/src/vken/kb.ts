import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { signKbRule, verifyKbRule } from './kb-signature.js';

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
  created_at: number;
  updated_at: number;
}

const staged = new Map<string, Array<{ ruleId: string; delta: number; ruleText?: string; findingType?: string }>>();

export const kb = {
  retrieve,
  stage,
  commit,
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
              avg_score_delta, evidence_runs, signature, created_at, updated_at
         FROM vken_kb_rules
        WHERE framework = ?
        ORDER BY accept_count DESC, avg_score_delta DESC
        LIMIT ?`,
    )
    .all(input.framework, Math.max(input.topK * 2, input.topK)) as KbRule[];
  const seedRules = loadJsonl(path.join(repoRoot(), 'kb', 'seed.jsonl'));
  const dimensions = new Set(input.findings.map((finding) => finding.dimension).filter(Boolean));
  return [...dbRules, ...seedRules]
    .map((rule) => ({
      ...rule,
      evidence_runs: Array.isArray(rule.evidence_runs) ? rule.evidence_runs : JSON.parse(String(rule.evidence_runs || '[]')),
    }))
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
                avg_score_delta, evidence_runs, signature, created_at, updated_at
           FROM vken_kb_rules
          WHERE id = ?`,
      )
      .get(item.ruleId) as KbRule | undefined;
    const base: KbRule = existing ?? {
      id: item.ruleId || randomUUID(),
      finding_type: item.findingType ?? 'visual-system',
      framework: 'vite-react-tailwind',
      severity: 'P2',
      rule_text: item.ruleText ?? 'Prefer concrete token and hierarchy fixes that can be validated by literal search-replace patches.',
      accept_count: 0,
      reject_count: 0,
      avg_score_delta: 0,
      evidence_runs: [],
      signature: '',
      created_at: now,
      updated_at: now,
    };
    const acceptCount = base.accept_count + 1;
    const avgDelta = base.avg_score_delta === 0 ? item.delta : base.avg_score_delta * 0.7 + item.delta * 0.3;
    const evidenceRuns = [...new Set([...base.evidence_runs, input.runId])];
    const next: KbRule = {
      ...base,
      accept_count: acceptCount,
      avg_score_delta: avgDelta,
      evidence_runs: evidenceRuns,
      updated_at: now,
    };
    next.signature = signKbRule(next);
    input.db
      .prepare(
        `INSERT INTO vken_kb_rules
          (id, finding_type, framework, severity, rule_text, accept_count, reject_count,
           avg_score_delta, evidence_runs, signature, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           accept_count = excluded.accept_count,
           reject_count = excluded.reject_count,
           avg_score_delta = excluded.avg_score_delta,
           evidence_runs = excluded.evidence_runs,
           signature = excluded.signature,
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
        next.created_at,
        next.updated_at,
      );
    committed.push(next);
  }
  if (committed.length > 0) appendJsonl(input.kbDir ?? path.join(repoRoot(), 'kb', 'learned.jsonl'), committed);
  staged.delete(input.runId);
  return committed;
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
      const rule = JSON.parse(line) as KbRule;
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

function appendJsonl(filePath: string, rules: KbRule[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${rules.map((rule) => JSON.stringify(rule)).join('\n')}\n`);
}

function scoreRule(rule: KbRule, dimensions: Set<string | undefined>): number {
  const dimensionMatch = dimensions.has(rule.finding_type) ? 10 : 0;
  return dimensionMatch + rule.accept_count * 2 + rule.avg_score_delta - rule.reject_count * 3;
}

function repoRoot(): string {
  return path.resolve(import.meta.dirname, '..', '..', '..', '..');
}
