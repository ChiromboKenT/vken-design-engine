import { randomUUID } from 'node:crypto';
import type { VkenDirection } from './types.js';
import { chatCoder } from './llm/client.js';
import { DirectionsSchema, type DirectionResult } from './llm/schema.js';
import { recordUsage } from './llm/token-account.js';

export async function proposeDirections(input: {
  runId: string;
  db: any;
  index: unknown;
  opts?: {
    sampleId?: string | undefined;
    byok?: any;
    noLlm?: boolean | undefined;
    kbRules?: Array<{ id: string; ruleText: string }> | undefined;
  };
}): Promise<Array<VkenDirection & { providerId?: string; modelId?: string }>> {
  const findings = input.db
    .prepare(
      `SELECT id, dimension, severity, description, affected_files AS affectedFiles
         FROM vken_findings
        WHERE run_id = ?
        ORDER BY created_at`,
    )
    .all(input.runId);
  const result = await chatCoder(
    [
      {
        role: 'system',
        content:
          'You are a senior product designer planning a small safe patch set for a Vite React Tailwind app. Respond with a single JSON object only. No prose.',
      },
      {
        role: 'user',
        content: `Return exactly two directions in this JSON shape: {"directions":[{"id":"short-kebab","name":"...","mood":"...","summary":"...","changes":["..."],"effort":"low|medium|high","risk":"low|medium|high","evidenceKbIds":["..."]}]}.

Workspace index:
${JSON.stringify(input.index).slice(0, 7000)}

Findings:
${JSON.stringify(findings).slice(0, 5000)}

Retrieved KB rules:
${JSON.stringify(input.opts?.kbRules ?? []).slice(0, 2000)}`,
      },
    ],
    DirectionsSchema,
    {
      byok: input.opts?.byok,
      provider: input.opts?.noLlm ? 'cassette' : undefined,
      sampleId: input.opts?.sampleId,
      phase: 'directions',
    },
  );
  recordUsage(input.db, input.runId, result.providerId, result.modelId, result.usage, 'coder');
  const parsed = result.parsed as { directions: DirectionResult[] };
  const now = Date.now();
  const directions = parsed.directions.map((direction) => normalizeDirection(direction));
  for (const direction of directions) {
    input.db
      .prepare(
        `INSERT OR REPLACE INTO vken_directions
          (id, run_id, name, mood, summary, changes_json, effort, risk, evidence_kb_ids, is_chosen, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT is_chosen FROM vken_directions WHERE id = ?), 0), ?)`,
      )
      .run(
        direction.id,
        input.runId,
        direction.name,
        direction.mood,
        direction.summary,
        JSON.stringify(direction.changes),
        direction.effort,
        direction.risk,
        JSON.stringify(direction.evidenceKbIds),
        direction.id,
        now,
      );
  }
  return directions.map((direction) => ({
    ...direction,
    providerId: result.providerId,
    modelId: result.modelId,
  }));
}

function normalizeDirection(direction: DirectionResult): VkenDirection {
  return {
    id: direction.id || randomUUID(),
    name: direction.name,
    mood: direction.mood,
    summary: direction.summary,
    changes: direction.changes,
    effort: direction.effort,
    risk: direction.risk,
    evidenceKbIds: direction.evidenceKbIds ?? [],
  };
}
