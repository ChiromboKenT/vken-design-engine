import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { chatVL } from './llm/client.js';
import { CritiqueSchema, type CritiqueResult } from './llm/schema.js';
import { recordUsage } from './llm/token-account.js';

export interface VkenCritiqueFinding {
  id: string;
  dimension: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  description: string;
  affectedFiles: string[];
  regionBox?: { x: number; y: number; w: number; h: number };
}

export async function critiqueCapture(input: {
  captureId: string;
  runId: string;
  db: any;
  opts?: { sampleId?: string | undefined; byok?: any; noLlm?: boolean | undefined };
}): Promise<{ designQuality: number; findings: VkenCritiqueFinding[]; providerId: string; modelId: string }> {
  const capture = input.db
    .prepare(
      `SELECT vc.id,
              vc.run_id AS runId,
              vc.route_path AS routePath,
              vc.viewport AS viewport,
              vc.screenshot_path AS screenshotPath,
              vc.aria_yaml AS ariaYaml,
              vc.box_models_json AS boxModelsJson,
              vt.source_ref AS sampleId
         FROM vken_captures vc
         JOIN vken_runs vr ON vr.id = vc.run_id
         JOIN vken_targets vt ON vt.id = vr.target_id
        WHERE vc.id = ?`,
    )
    .get(input.captureId);
  if (!capture) throw new Error(`capture not found: ${input.captureId}`);

  const screenshot = fs.existsSync(capture.screenshotPath)
    ? fs.readFileSync(capture.screenshotPath).toString('base64')
    : '';
  const result = await chatVL(
    [
      {
        role: 'system',
        content:
          'You are a senior product designer auditing a React + Tailwind screenshot against VKEN neuroinclusive design standards. Respond with a single JSON object only. No prose.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: critiquePrompt({
              routePath: capture.routePath,
              viewport: capture.viewport,
              ariaYaml: capture.ariaYaml ?? '',
              boxModelsJson: capture.boxModelsJson ?? '[]',
            }),
          },
          ...(screenshot
            ? [
                {
                  type: 'image_url' as const,
                  image_url: { url: `data:image/png;base64,${screenshot}` },
                },
              ]
            : []),
        ],
      },
    ],
    CritiqueSchema,
    {
      byok: input.opts?.byok,
      provider: input.opts?.noLlm ? 'cassette' : undefined,
      sampleId: input.opts?.sampleId ?? capture.sampleId,
      phase: 'critique',
    },
  );
  recordUsage(input.db, input.runId, result.providerId, result.modelId, result.usage, 'vl');
  const parsed = result.parsed as CritiqueResult;
  const now = Date.now();
  const findings = parsed.findings.map((finding) => {
    const base: VkenCritiqueFinding = {
      id: randomUUID(),
      dimension: finding.dimension,
      severity: finding.severity,
      description: finding.description,
      affectedFiles: [],
    };
    return finding.regionBox ? { ...base, regionBox: finding.regionBox } : base;
  });
  for (const finding of findings) {
    input.db
      .prepare(
        `INSERT INTO vken_findings
          (id, run_id, source, dimension, severity, description, affected_files, region_box, created_at)
         VALUES (?, ?, 'vl', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        finding.id,
        input.runId,
        finding.dimension,
        finding.severity,
        finding.description,
        JSON.stringify(finding.affectedFiles),
        finding.regionBox ? JSON.stringify(finding.regionBox) : null,
        now,
      );
  }
  return {
    designQuality: parsed.designQuality,
    findings,
    providerId: result.providerId,
    modelId: result.modelId,
  };
}

function critiquePrompt(input: {
  routePath: string;
  viewport: string;
  ariaYaml: string;
  boxModelsJson: string;
}): string {
  return `Audit this single ${input.viewport} screenshot for route ${input.routePath}.

Output ONE JSON object only:
{
  "designQuality": number,
  "findings": [
    {
      "dimension": "hierarchy"|"contrast"|"spacing"|"typography"|"alignment"|"color"|"motion"|"a11y"|"neuroinclusive",
      "severity": "P0"|"P1"|"P2"|"P3",
      "description": "<one sentence, imperative>",
      "regionBox": { "x": 0, "y": 0, "w": 0, "h": 0 }
    }
  ]
}

Rules:
- designQuality is 0..1 and must not default to 0.5.
- Give 5-15 findings when possible.
- Use the ARIA snapshot and box models as evidence.
- Flag neuroinclusive issues when the UI increases cognitive load, creates sensory overload, hides focus/recovery paths, or makes reading and task flow unpredictable.
- JSON only.

ARIA:
${input.ariaYaml.slice(0, 3000)}

Box models:
${input.boxModelsJson.slice(0, 5000)}`;
}
