import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { VkenDirection, VkenPatch, VkenSeverity } from './types.js';
import { chatCoder } from './llm/client.js';
import { ProposeSchema, type ProposeResult } from './llm/schema.js';
import { recordUsage } from './llm/token-account.js';
import { initVirtualFs, norm, patchSearchMatches, type VkenVirtualFsSession } from './apply.js';

export async function proposePatches(input: {
  runId: string;
  db: any;
  workspacePath: string;
  index: unknown;
  direction: VkenDirection;
  session?: VkenVirtualFsSession;
  opts?: {
    sampleId?: string | undefined;
    byok?: any;
    noLlm?: boolean | undefined;
    kbRules?: Array<{ id: string; ruleText: string }> | undefined;
  };
}): Promise<{ patches: VkenPatch[]; session: VkenVirtualFsSession }> {
  const session = input.session ?? initVirtualFs(input.workspacePath);
  const findings = input.db
    .prepare(
      `SELECT id, dimension, severity, description, affected_files AS affectedFiles
         FROM vken_findings
        WHERE run_id = ?
        ORDER BY created_at`,
    )
    .all(input.runId);

  let modelPatches: VkenPatch[] = [];
  try {
    const result = await chatCoder(
      [
        {
          role: 'system',
          content:
            'You propose literal search-replace patches for existing files. Every search string must already exist exactly. Respond with a single JSON object only. No prose.',
        },
        {
          role: 'user',
          content: `Return {"patches":[...]} with at least 5 search-replace patches.

Direction:
${JSON.stringify(input.direction)}

Workspace index:
${JSON.stringify(input.index).slice(0, 7000)}

Findings:
${JSON.stringify(findings).slice(0, 5000)}

File excerpts:
${fileExcerpts(session).slice(0, 9000)}

KB:
${JSON.stringify(input.opts?.kbRules ?? []).slice(0, 2000)}`,
        },
      ],
      ProposeSchema,
      {
        byok: input.opts?.byok,
        provider: input.opts?.noLlm ? 'cassette' : undefined,
        sampleId: input.opts?.sampleId,
        phase: 'patches',
      },
    );
    recordUsage(input.db, input.runId, result.providerId, result.modelId, result.usage, 'coder');
    modelPatches = ((result.parsed as ProposeResult).patches as VkenPatch[]).map((patch) => ({
      ...patch,
      status: 'proposed',
    }));
  } catch (error) {
    console.warn(`[vken:propose] model proposal failed; using deterministic generator: ${error instanceof Error ? error.message : String(error)}`);
  }

  const deterministic = deterministicPatches(session, input.direction, findings);
  const candidates = [...modelPatches, ...deterministic];
  const seen = new Set<string>();
  const patches = candidates
    .filter((patch) => {
      const key = `${patch.filePath}:${patch.hunks.map((hunk) => hunk.search).join('|')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      if (!patchSearchMatches(session, patch)) {
        console.warn(`[vken:propose] dropped hallucinated patch ${patch.id} (${patch.filePath})`);
        return false;
      }
      return true;
    })
    .slice(0, 8);

  const now = Date.now();
  for (const patch of patches) {
    input.db
      .prepare(
        `INSERT OR REPLACE INTO vken_patches
          (id, run_id, finding_ids, file_path, format, hunks_json, rationale, severity,
           impact, risk, effort, confidence, patchable, status, evidence_kb_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        patch.id,
        input.runId,
        JSON.stringify(patch.findingIds),
        patch.filePath,
        patch.format,
        JSON.stringify(patch.hunks),
        patch.rationale,
        patch.severity,
        patch.impact,
        patch.risk,
        patch.effort,
        patch.confidence,
        patch.patchable,
        patch.status,
        JSON.stringify(patch.evidenceKbIds),
        now,
        now,
      );
  }
  input.db
    .prepare(`UPDATE vken_runs SET patches_proposed = ? WHERE id = ?`)
    .run(patches.length, input.runId);
  return { patches, session };
}

function deterministicPatches(
  session: VkenVirtualFsSession,
  direction: VkenDirection,
  findings: Array<{ id: string; severity: VkenSeverity }>,
): VkenPatch[] {
  const patches: VkenPatch[] = [];
  const findingIds = findings.slice(0, 2).map((finding) => finding.id);
  const severity = findings[0]?.severity ?? 'P2';
  const cssFiles = [...session.files.keys()].filter((file) => file.endsWith('.css'));
  for (const filePath of cssFiles) {
    const content = session.files.get(filePath);
    if (!content) continue;
    const lines = norm(content).split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (/border-radius:\s*(?:[2-9]\d|1[6-9])px;/.test(trimmed)) {
        patches.push(makePatch(filePath, line, line.replace(/border-radius:\s*\d+px;/, 'border-radius: 12px;'), {
          direction,
          findingIds,
          severity,
          rationale: 'Normalize oversized radii so repeated surfaces share a calmer system.',
          evidenceKbIds: ['seed-token-rhythm'],
        }));
      }
      if (/color:\s*#(?:98a2b3|9a8170|667085|8a6f58|6b7280);/i.test(trimmed)) {
        patches.push(makePatch(filePath, line, line.replace(/color:\s*#[0-9a-f]{6};/i, 'color: #344054;'), {
          direction,
          findingIds,
          severity,
          rationale: 'Increase text contrast for secondary content without changing copy.',
          evidenceKbIds: ['seed-status-contrast'],
        }));
      }
      if (/background:\s*#(?:f4f1ff|fdf2fa|eef4ff|fffaf5|fffaeb|efe1d1);/i.test(trimmed)) {
        patches.push(makePatch(filePath, line, line.replace(/background:\s*#[0-9a-f]{6};/i, 'background: #f8fafc;'), {
          direction,
          findingIds,
          severity: 'P2',
          rationale: 'Reduce one-off background colors into a neutral surface token.',
          evidenceKbIds: ['seed-token-rhythm'],
        }));
      }
      if (/opacity:\s*0\.72;/.test(trimmed)) {
        patches.push(makePatch(filePath, line, line.replace('opacity: 0.72;', 'opacity: 1;'), {
          direction,
          findingIds,
          severity: 'P1',
          rationale: 'Restore full primary CTA emphasis for the main conversion action.',
          evidenceKbIds: ['seed-action-contrast'],
        }));
      }
      if (/transform:\s*scaleX\(1\.06\);/.test(trimmed)) {
        patches.push(makePatch(filePath, line, line.replace('transform: scaleX(1.06);', 'transform: none;'), {
          direction,
          findingIds,
          severity: 'P2',
          rationale: 'Remove image distortion so the product preview stays trustworthy.',
          evidenceKbIds: ['seed-commerce-action'],
        }));
      }
      if (patches.length >= 8) return patches;
    }
  }
  return patches;
}

function makePatch(
  filePath: string,
  search: string,
  replace: string,
  meta: {
    direction: VkenDirection;
    findingIds: string[];
    severity: VkenSeverity;
    rationale: string;
    evidenceKbIds: string[];
  },
): VkenPatch {
  return {
    id: `${meta.direction.id}-${randomUUID().slice(0, 8)}`,
    findingIds: meta.findingIds,
    filePath,
    format: 'search-replace',
    hunks: [{ search, replace }],
    rationale: meta.rationale,
    severity: meta.severity,
    impact: meta.severity === 'P1' ? 1.2 : 0.8,
    risk: 1,
    effort: 1,
    confidence: 0.9,
    patchable: 1,
    evidenceKbIds: meta.evidenceKbIds,
    status: 'proposed',
  };
}

function fileExcerpts(session: VkenVirtualFsSession): string {
  return [...session.files.entries()]
    .filter(([file]) => file.endsWith('.css') || path.basename(file) === 'App.tsx')
    .map(([file, content]) => `--- ${file}\n${content.slice(0, 2500)}`)
    .join('\n\n');
}
