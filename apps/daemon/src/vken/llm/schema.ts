import { z } from 'zod';

export const SeveritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export const RiskSchema = z.enum(['low', 'medium', 'high']);

export const CritiqueFindingSchema = z.object({
  dimension: z.enum([
    'hierarchy',
    'contrast',
    'spacing',
    'typography',
    'alignment',
    'color',
    'motion',
    'a11y',
    'neuroinclusive',
  ]),
  severity: SeveritySchema,
  description: z.string().min(8),
  regionBox: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
});

export const CritiqueSchema = z.object({
  designQuality: z.number().min(0).max(1),
  findings: z.array(CritiqueFindingSchema).min(1).max(20),
});

export const DirectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  mood: z.string().min(2),
  summary: z.string().min(8),
  changes: z.array(z.string().min(2)).min(1).max(8),
  effort: RiskSchema,
  risk: RiskSchema,
  evidenceKbIds: z.array(z.string()).default([]),
});

export const DirectionsSchema = z.object({
  directions: z.array(DirectionSchema).length(2),
});

export const PatchSchema = z.object({
  id: z.string().min(1),
  findingIds: z.array(z.string()).default([]),
  filePath: z.string().min(1),
  format: z.literal('search-replace').default('search-replace'),
  hunks: z
    .array(
      z.object({
        search: z.string().min(1),
        replace: z.string(),
      }),
    )
    .min(1)
    .max(4),
  rationale: z.string().min(8),
  severity: SeveritySchema,
  impact: z.number().min(0).max(10),
  risk: z.number().min(0).max(10),
  effort: z.number().min(0).max(10),
  confidence: z.number().min(0).max(1),
  patchable: z.number().min(0).max(1),
  evidenceKbIds: z.array(z.string()).default([]),
  status: z.enum(['proposed', 'approved', 'skipped', 'applied', 'reverted']).default('proposed'),
});

export const ProposeSchema = z.object({
  patches: z.array(PatchSchema).min(1).max(12),
});

export type CritiqueResult = z.infer<typeof CritiqueSchema>;
export type DirectionResult = z.infer<typeof DirectionSchema>;
export type ProposeResult = z.infer<typeof ProposeSchema>;
