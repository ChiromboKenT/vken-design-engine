import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { applyPatchVirtual, initVirtualFs, materializeTo } from './apply.js';
import { buildVkenWorkspaceIndex, buildVkenWorkspaceIndexFromPath } from './index-build.js';
import { intakeFromSample } from './intake.js';
import { verifyKbRule } from './kb-signature.js';
import { scoreVkenIndex } from './score.js';
import type { VkenPatch, VkenSampleId } from './types.js';

export type VkenKbBenchVariant = 'seed-only' | 'seed+learned';

export interface VkenKbBenchDelta {
  sample: VkenSampleId;
  scoreInitial: number;
  scoreFinal: number;
  delta: number;
  patchesApplied: number;
  rulesApplied: string[];
}

export interface VkenKbBenchResult {
  variant: VkenKbBenchVariant;
  deltas: VkenKbBenchDelta[];
  aggregate: number;
  generatedAt: number;
  ruleCounts: {
    seed: number;
    learned: number;
    signed: number;
  };
}

export interface VkenKbBenchCandidateSummary {
  aggregateDelta: number;
  worstSampleDelta: number;
}

interface BenchRule {
  id: string;
  finding_type: string;
  rule_text: string;
  accept_count: number;
  reject_count: number;
  avg_score_delta: number;
  evidence_runs: string[];
  signature?: string;
  created_at?: number;
  updated_at?: number;
  examples?: Array<{ filePath?: string; hunks?: Array<{ search: string; replace: string }> }>;
}

const DEFAULT_SAMPLES: VkenSampleId[] = ['landing-generic', 'dashboard-cluttered', 'ecommerce-basic'];

export async function runKbBench(input: {
  projectRoot: string;
  variant?: VkenKbBenchVariant;
  samples?: VkenSampleId[];
  extraRules?: BenchRule[];
}): Promise<VkenKbBenchResult> {
  const variant = input.variant ?? 'seed+learned';
  const seedRules = readRules(path.join(input.projectRoot, 'kb', 'seed.jsonl'));
  const learnedRules = variant === 'seed+learned' ? readRules(path.join(input.projectRoot, 'kb', 'learned.jsonl')) : [];
  const rules = dedupeRules([...seedRules, ...learnedRules, ...(input.extraRules ?? [])]);
  const signed = rules.filter((rule) => !rule.signature || verifyKbRule(rule)).length;
  const deltas = (input.samples ?? DEFAULT_SAMPLES).map((sample) =>
    benchSample({
      projectRoot: input.projectRoot,
      sample,
      rules,
    }),
  );
  return {
    variant,
    deltas,
    aggregate: round(deltas.reduce((sum, row) => sum + row.delta, 0)),
    generatedAt: Date.now(),
    ruleCounts: {
      seed: seedRules.length,
      learned: learnedRules.length + (input.extraRules?.length ?? 0),
      signed,
    },
  };
}

export async function runKbBenchForCandidate(input: {
  db: any;
  candidateRuleId: string;
  samples?: string[];
  projectRoot?: string;
}): Promise<VkenKbBenchCandidateSummary> {
  const projectRoot = input.projectRoot ?? repoRoot();
  const candidate = input.db
    .prepare(
      `SELECT id, finding_type, rule_text, accept_count, reject_count, avg_score_delta,
              evidence_runs, signature, created_at, updated_at
         FROM vken_kb_rules
        WHERE id = ?`,
    )
    .get(input.candidateRuleId);
  const samples = normalizeSamples(input.samples);
  const seedOnly = await runKbBench({ projectRoot, variant: 'seed-only', samples });
  const withCandidate = await runKbBench({
    projectRoot,
    variant: 'seed-only',
    samples,
    extraRules: candidate ? [normalizeRule(candidate)] : [],
  });
  const sampleDeltas = withCandidate.deltas.map((row, index) => round(row.delta - (seedOnly.deltas[index]?.delta ?? 0)));
  return {
    aggregateDelta: round(withCandidate.aggregate - seedOnly.aggregate),
    worstSampleDelta: Math.min(...sampleDeltas, 0),
  };
}

function benchSample(input: {
  projectRoot: string;
  sample: VkenSampleId;
  rules: BenchRule[];
}): VkenKbBenchDelta {
  const intake = intakeFromSample(input.projectRoot, input.sample);
  const initialIndex = buildVkenWorkspaceIndex(intake);
  const initial = scoreVkenIndex(initialIndex, { when: 'initial' });
  const session = initVirtualFs(intake.workspacePath);
  const patches = input.rules.flatMap((rule) => patchesForRule(rule, session.files));
  const rulesApplied = new Set<string>();
  let patchesApplied = 0;
  for (const patch of patches) {
    const result = applyPatchVirtual(session, patch);
    if (result.ok) {
      patchesApplied += 1;
      for (const id of patch.evidenceKbIds) rulesApplied.add(id);
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `vken-kb-bench-${input.sample}-`));
  try {
    materializeTo(session, dir);
    const finalIndex = buildVkenWorkspaceIndexFromPath(dir);
    const final = scoreVkenIndex(finalIndex, { when: 'final' });
    return {
      sample: input.sample,
      scoreInitial: initial.value,
      scoreFinal: final.value,
      delta: round(final.value - initial.value),
      patchesApplied,
      rulesApplied: [...rulesApplied],
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function patchesForRule(rule: BenchRule, files: Map<string, string>): VkenPatch[] {
  const examplePatches = (rule.examples ?? []).flatMap((example) =>
    example.filePath && example.hunks?.length
      ? [
          makePatch({
            rule,
            filePath: example.filePath,
            search: example.hunks[0]!.search,
            replace: example.hunks[0]!.replace,
          }),
        ]
      : [],
  );
  if (examplePatches.length > 0) return examplePatches;

  const intent = `${rule.finding_type} ${rule.rule_text}`.toLowerCase();
  const patches: VkenPatch[] = [];
  for (const [filePath, content] of files) {
    if (!filePath.endsWith('.css')) continue;
    if (content.includes(':root {') && !content.includes('--vken-text-secondary')) {
      patches.push(
        makePatch({
          rule,
          filePath,
          search: ':root {',
          replace:
            ':root {\n  --vken-text-secondary: #344054;\n  --vken-surface-muted: #f8fafc;\n  --vken-radius-card: 12px;',
        }),
      );
    }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if ((intent.includes('radius') || intent.includes('spacing')) && /border-radius:\s*(?:[2-9]\d|1[6-9])px;/.test(trimmed)) {
        patches.push(makePatch({ rule, filePath, search: line, replace: line.replace(/border-radius:\s*\d+px;/, 'border-radius: var(--vken-radius-card);') }));
      }
      if (
        (intent.includes('color') || intent.includes('contrast')) &&
        /color:\s*#(?:98a2b3|9a8170|667085|8a6f58|6b7280|7a8494|94715a);/i.test(trimmed)
      ) {
        patches.push(makePatch({ rule, filePath, search: line, replace: line.replace(/color:\s*#[0-9a-f]{6};/i, 'color: var(--vken-text-secondary);') }));
      }
      if (
        (intent.includes('surface') || intent.includes('palette') || intent.includes('token')) &&
        /background:\s*#(?:f4f1ff|fdf2fa|eef4ff|fffaf5|fffaeb|efe1d1);/i.test(trimmed)
      ) {
        patches.push(makePatch({ rule, filePath, search: line, replace: line.replace(/background:\s*#[0-9a-f]{6};/i, 'background: var(--vken-surface-muted);') }));
      }
      if ((intent.includes('primary') || intent.includes('action') || intent.includes('hierarchy')) && /opacity:\s*0\.72;/.test(trimmed)) {
        patches.push(makePatch({ rule, filePath, search: line, replace: line.replace('opacity: 0.72;', 'opacity: 1;') }));
      }
      if ((intent.includes('image') || intent.includes('alignment') || intent.includes('distortion')) && /transform:\s*scaleX\(1\.06\);/.test(trimmed)) {
        patches.push(makePatch({ rule, filePath, search: line, replace: line.replace('transform: scaleX(1.06);', 'transform: none;') }));
      }
      if (patches.length >= 2) return patches;
    }
  }
  return patches;
}

function makePatch(input: { rule: BenchRule; filePath: string; search: string; replace: string }): VkenPatch {
  return {
    id: `bench-${input.rule.id}-${randomUUID().slice(0, 8)}`,
    findingIds: [],
    filePath: input.filePath,
    format: 'search-replace',
    hunks: [{ search: input.search, replace: input.replace }],
    rationale: input.rule.rule_text,
    severity: 'P2',
    impact: Math.max(0.1, input.rule.avg_score_delta || 0.5),
    risk: 1,
    effort: 1,
    confidence: 0.8,
    patchable: 1,
    evidenceKbIds: [input.rule.id],
    status: 'proposed',
  };
}

function readRules(filePath: string): BenchRule[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const rule = normalizeRule(JSON.parse(line));
        return verifyKbRule(rule) ? [rule] : [];
      } catch {
        return [];
      }
    });
}

function dedupeRules(rules: BenchRule[]): BenchRule[] {
  const byId = new Map<string, BenchRule>();
  for (const rule of rules) {
    const existing = byId.get(rule.id);
    if (!existing || (rule.updated_at ?? 0) >= (existing.updated_at ?? 0)) byId.set(rule.id, rule);
  }
  return [...byId.values()];
}

function normalizeRule(rule: any): BenchRule {
  return {
    id: String(rule.id),
    finding_type: String(rule.finding_type ?? rule.findingType ?? 'visual-system'),
    rule_text: String(rule.rule_text ?? rule.ruleText ?? ''),
    accept_count: Number(rule.accept_count ?? rule.acceptCount ?? 0),
    reject_count: Number(rule.reject_count ?? rule.rejectCount ?? 0),
    avg_score_delta: Number(rule.avg_score_delta ?? rule.avgScoreDelta ?? 0),
    evidence_runs: Array.isArray(rule.evidence_runs ?? rule.evidenceRuns)
      ? (rule.evidence_runs ?? rule.evidenceRuns).map(String)
      : JSON.parse(String(rule.evidence_runs ?? rule.evidenceRuns ?? '[]')).map(String),
    signature: typeof rule.signature === 'string' ? rule.signature : '',
    created_at: Number(rule.created_at ?? rule.createdAt ?? 0),
    updated_at: Number(rule.updated_at ?? rule.updatedAt ?? 0),
    examples: Array.isArray(rule.examples) ? rule.examples : [],
  };
}

function normalizeSamples(samples?: string[]): VkenSampleId[] {
  const allowed = new Set(DEFAULT_SAMPLES);
  const selected = (samples ?? DEFAULT_SAMPLES).filter((sample): sample is VkenSampleId =>
    allowed.has(sample as VkenSampleId),
  );
  return selected.length > 0 ? selected : DEFAULT_SAMPLES;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function repoRoot(): string {
  return path.resolve(import.meta.dirname, '..', '..', '..', '..');
}
