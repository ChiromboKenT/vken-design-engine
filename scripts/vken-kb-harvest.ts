import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { applyPatchVirtual, initVirtualFs, materializeTo } from '../apps/daemon/dist/vken/apply.js';
import { closeDatabase, openDatabase } from '../apps/daemon/dist/db.js';
import { signKbRule } from '../apps/daemon/dist/vken/kb-signature.js';
import { proposePatches } from '../apps/daemon/dist/vken/propose.js';
import { executeDeterministicVkenRun, recomputeScoreFromMaterialized } from '../apps/daemon/dist/vken/run-pipeline.js';
import type { VkenRiskLevel, VkenSampleId, VkenWorkspaceIndex } from '../apps/daemon/dist/vken/types.js';

const repoRoot = path.resolve(import.meta.dirname, '..');
process.env.VKEN_LLM_PROVIDER ??= 'cassette';
const runs = Number(readArg('--runs') ?? 30);
const samples = normalizeSamples(readArg('--samples') ?? 'landing-generic,dashboard-cluttered,ecommerce-basic');
const outFile = path.join(repoRoot, 'kb', 'seed.jsonl');
const collected: HarvestEntry[] = [];

for (let i = 0; i < runs; i += 1) {
  const sampleId = samples[i % samples.length]!;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `vken-kb-harvest-${sampleId}-`));
  try {
    const db = openDatabase(repoRoot, { dataDir });
    const service = fakeService();
    const run: ScriptRun = { id: randomUUID(), status: 'queued' };
    await executeDeterministicVkenRun({
      db,
      projectRoot: repoRoot,
      dataDir,
      service,
      run,
      request: { intake: { kind: 'sample', sampleId } },
    });
    if (run.status === 'failed') continue;
    if (!run.workspacePath || !run.index) throw new Error(`run ${run.id} did not initialize workspace context`);
    const direction = db
      .prepare(
        `SELECT id, name, mood, summary, changes_json AS changesJson, effort, risk, evidence_kb_ids AS evidenceKbIds
           FROM vken_directions
          WHERE run_id = ?
          ORDER BY json_array_length(evidence_kb_ids) DESC, created_at
          LIMIT 1`,
      )
      .get(run.id) as DirectionRow | undefined;
    if (!direction) continue;
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
    const approved = proposed.patches.slice(0, 8);
    for (const patch of approved) {
      const result = applyPatchVirtual(vfs, patch);
      if (!result.ok) continue;
      db.prepare(`UPDATE vken_patches SET status = 'applied', updated_at = ? WHERE id = ? AND run_id = ?`).run(
        Date.now(),
        patch.id,
        run.id,
      );
    }
    if (approved.length === 0) continue;
    const materializedDir = path.join(dataDir, 'final');
    materializeTo(vfs, materializedDir, { linkNodeModules: true });
    const initialScore = await recomputeScoreFromMaterialized({ runId: run.id, db, workspaceDir: run.workspacePath });
    const finalScore = await recomputeScoreFromMaterialized({ runId: run.id, db, workspaceDir: materializedDir });
    const scoreDelta = Number((finalScore.value - initialScore.value).toFixed(2));
    for (const patch of approved) {
      collected.push({
        runId: run.id,
        findingType: inferFindingType(patch),
        ruleText: patch.rationale,
        scoreDelta,
        patch: {
          filePath: patch.filePath,
          hunks: patch.hunks,
        },
      });
    }
  } finally {
    closeDatabase();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

const rules = buildRules(collected);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${rules.map((rule) => JSON.stringify(rule)).join('\n')}\n`);
console.log(`VKEN_KB_HARVEST_OK rules=${rules.length} samples=${samples.length} runs=${runs}`);

interface HarvestEntry {
  runId: string;
  findingType: string;
  ruleText: string;
  scoreDelta: number;
  patch: {
    filePath: string;
    hunks: Array<{ search: string; replace: string }>;
  };
}

interface ScriptRun {
  id: string;
  status: string;
  workspacePath?: string;
  index?: VkenWorkspaceIndex;
}

interface DirectionRow {
  id: string;
  name: string;
  mood: string;
  summary: string;
  changesJson: string;
  effort: string;
  risk: string;
  evidenceKbIds: string;
}

function buildRules(entries: HarvestEntry[]) {
  // Group on (findingType, normalizedRuleText) so distinct rationales become distinct rules
  // instead of collapsing all hierarchy/contrast/spacing entries into one row each.
  const byKey = new Map<string, { findingType: string; ruleText: string; entries: HarvestEntry[] }>();
  for (const entry of entries) {
    const normalized = normalizeRuleText(entry.ruleText);
    const key = `${entry.findingType}::${normalized}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.entries.push(entry);
    else byKey.set(key, { findingType: entry.findingType, ruleText: entry.ruleText, entries: [entry] });
  }
  // Stable order: by findingType, then by descending support, then by rule text.
  const ordered = [...byKey.values()].sort((a, b) => {
    if (a.findingType !== b.findingType) return a.findingType.localeCompare(b.findingType);
    if (a.entries.length !== b.entries.length) return b.entries.length - a.entries.length;
    return a.ruleText.localeCompare(b.ruleText);
  });
  // Drop singletons unless we have very few rules — keeps the seed signal-rich
  // without losing diversity when harvest yield is low.
  const filtered = ordered.length > 8 ? ordered.filter((bucket) => bucket.entries.length >= 2) : ordered;
  return filtered.map(({ findingType, ruleText, entries: matching }, index) => {
    const now = Date.now() + index;
    const rule = {
      id: `harvest-${findingType}-${String(index + 1).padStart(2, '0')}`,
      finding_type: findingType,
      framework: 'vite-react-tailwind',
      severity: findingType === 'hierarchy' ? 'P1' : 'P2',
      rule_text: ruleText,
      accept_count: matching.length,
      reject_count: 0,
      avg_score_delta: average(matching.map((entry) => entry.scoreDelta)),
      evidence_runs: [...new Set(matching.map((entry) => entry.runId))],
      examples: distinctExamples(matching),
      signature: '',
      tier: 3,
      created_at: now,
      updated_at: now,
    };
    rule.signature = signKbRule(rule);
    return rule;
  });
}

function normalizeRuleText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function distinctExamples(entries: HarvestEntry[]) {
  const seen = new Set<string>();
  const out = [];
  for (const entry of entries) {
    const key = JSON.stringify(entry.patch);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry.patch);
    if (out.length === 3) break;
  }
  return out;
}

function inferFindingType(patch: any): string {
  const text = `${patch.rationale} ${patch.evidenceKbIds?.join(' ') ?? ''}`.toLowerCase();
  if (text.includes('contrast') || text.includes('color')) return 'contrast';
  if (text.includes('radius') || text.includes('spacing')) return 'spacing';
  if (text.includes('action') || text.includes('hierarchy') || text.includes('cta')) return 'hierarchy';
  if (text.includes('image') || text.includes('distortion') || text.includes('align')) return 'alignment';
  return 'visual-system';
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Prefer validated, literal search-replace design-system fixes.';
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function normalizeSamples(value: string): VkenSampleId[] {
  const allowed = new Set<VkenSampleId>(['landing-generic', 'dashboard-cluttered', 'ecommerce-basic']);
  const samples = value
    .split(',')
    .map((sample) => sample.trim())
    .filter((sample): sample is VkenSampleId => allowed.has(sample as VkenSampleId));
  if (samples.length === 0) throw new Error(`--samples must include at least one known sample: ${[...allowed].join(', ')}`);
  return samples;
}

function normalizeRisk(value: string): VkenRiskLevel {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
}

function fakeService() {
  const events: Array<{ event: string; data: unknown }> = [];
  return {
    events,
    emit(_run: unknown, event: string, data: unknown) {
      this.events.push({ event, data });
    },
    finish(run: { status: string }, status: string) {
      run.status = status;
    },
    fail(run: { status: string }) {
      run.status = 'failed';
    },
  };
}
