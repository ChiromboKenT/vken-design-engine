import type {
  HardcodedValueFinding,
  VkenPatch,
  VkenProblemCategoryBreakdown,
  VkenProblemCategoryId,
  VkenProblemEvidence,
  VkenSeverity,
  VkenWorkspaceIndex,
} from './types.js';

const CATEGORY_LABELS: Record<VkenProblemCategoryId, string> = {
  tokens: 'Color tokens missing',
  spacing: 'Spacing inconsistencies',
  contrast: 'Contrast issues',
  repetition: 'Component repetition',
};

const CATEGORY_ORDER: VkenProblemCategoryId[] = ['tokens', 'spacing', 'contrast', 'repetition'];

export type VkenProblemTotals = Partial<Record<VkenProblemCategoryId, number>>;

export interface VkenFindingForCategories {
  id?: string;
  dimension?: string;
  severity?: VkenSeverity;
  description?: string;
  affectedFiles?: string | string[];
}

export function buildVkenProblemCategories(
  index: VkenWorkspaceIndex,
  options: {
    totals?: VkenProblemTotals;
    fixedByPatch?: VkenProblemTotals;
    findings?: VkenFindingForCategories[];
  } = {},
): VkenProblemCategoryBreakdown[] {
  const tokenEvidence = index.hardcodedValues
    .filter((finding) => finding.kind === 'color')
    .map((finding) => hardcodedEvidence(finding, 'Hardcoded color value'))
    .concat(findingEvidenceForCategory(options.findings, 'tokens'));
  const spacingEvidence = index.hardcodedValues
    .filter((finding) => finding.kind === 'spacing' || finding.kind === 'radius')
    .map((finding) =>
      hardcodedEvidence(
        finding,
        finding.kind === 'radius' ? 'One-off radius value' : 'One-off spacing value',
      ),
    )
    .concat(findingEvidenceForCategory(options.findings, 'spacing'));
  const contrastEvidence = (options.findings ?? [])
    .filter((finding) => findingCategory(finding) === 'contrast')
    .map((finding) => findingEvidence(finding));
  const repetitionEvidence = repeatedValueEvidence(index.hardcodedValues).concat(
    findingEvidenceForCategory(options.findings, 'repetition'),
  );

  const current: Record<VkenProblemCategoryId, { count: number; evidence: VkenProblemEvidence[] }> = {
    tokens: { count: tokenEvidence.length, evidence: tokenEvidence },
    spacing: { count: spacingEvidence.length, evidence: spacingEvidence },
    contrast: { count: contrastEvidence.length, evidence: contrastEvidence },
    repetition: { count: repetitionEvidence.length, evidence: repetitionEvidence },
  };

  return CATEGORY_ORDER.map((category) => {
    const remainingRaw = current[category].count;
    const total = Math.max(options.totals?.[category] ?? remainingRaw, remainingRaw);
    const fixed = Math.min(
      total,
      Math.max(total - remainingRaw, options.fixedByPatch?.[category] ?? 0),
    );
    const remaining = Math.max(0, total - fixed);
    return {
      category,
      label: CATEGORY_LABELS[category],
      total,
      remaining,
      fixed,
      queued: remaining,
      evidence: current[category].evidence.slice(0, 24),
    };
  });
}

export function categoryTotals(
  categories: VkenProblemCategoryBreakdown[],
): Record<VkenProblemCategoryId, number> {
  return categories.reduce(
    (acc, category) => {
      acc[category.category] = category.total;
      return acc;
    },
    { tokens: 0, spacing: 0, contrast: 0, repetition: 0 } satisfies Record<
      VkenProblemCategoryId,
      number
    >,
  );
}

export function categorizeVkenPatch(patch: Pick<VkenPatch, 'hunks' | 'rationale' | 'filePath'>): VkenProblemCategoryId[] {
  const haystack = [
    patch.filePath,
    patch.rationale,
    ...patch.hunks.flatMap((hunk) => [hunk.search, hunk.replace]),
  ]
    .join('\n')
    .toLowerCase();
  const categories = new Set<VkenProblemCategoryId>();

  if (/(token|palette|color|surface|#[0-9a-f]{3,8}|var\(--)/i.test(haystack)) {
    categories.add('tokens');
  }
  if (/(spacing|padding|margin|gap|radius|border-radius|rounded|rem|px)/i.test(haystack)) {
    categories.add('spacing');
  }
  if (/(contrast|opacity|legibility|cta|primary action|secondary text)/i.test(haystack)) {
    categories.add('contrast');
  }
  if (/(repeat|duplicate|shared|component|reuse|normalize)/i.test(haystack)) {
    categories.add('repetition');
  }

  if (categories.size === 0) categories.add('tokens');
  return [...categories];
}

export function addFixedPatchCounts(
  target: VkenProblemTotals | undefined,
  categories: VkenProblemCategoryId[],
): Record<VkenProblemCategoryId, number> {
  const next = {
    tokens: target?.tokens ?? 0,
    spacing: target?.spacing ?? 0,
    contrast: target?.contrast ?? 0,
    repetition: target?.repetition ?? 0,
  };
  for (const category of categories) next[category] += 1;
  return next;
}

function hardcodedEvidence(finding: HardcodedValueFinding, label: string): VkenProblemEvidence {
  return {
    file: finding.file,
    line: finding.line,
    label,
    value: finding.value,
  };
}

function findingEvidence(finding: VkenFindingForCategories): VkenProblemEvidence {
  const files = parseAffectedFiles(finding.affectedFiles);
  return {
    file: files[0] ?? 'visual capture',
    label: finding.description ?? 'Visual finding',
    ...(finding.severity ? { severity: finding.severity } : {}),
  };
}

function repeatedValueEvidence(findings: HardcodedValueFinding[]): VkenProblemEvidence[] {
  const byValue = new Map<string, HardcodedValueFinding[]>();
  for (const finding of findings) {
    const bucket = byValue.get(finding.value) ?? [];
    bucket.push(finding);
    byValue.set(finding.value, bucket);
  }

  const out: VkenProblemEvidence[] = [];
  for (const [value, bucket] of byValue) {
    if (bucket.length < 2) continue;
    for (const finding of bucket) {
      out.push({
        file: finding.file,
        line: finding.line,
        label: `${bucket.length} repeated uses of ${value}`,
        value,
      });
    }
  }
  return out;
}

function findingEvidenceForCategory(
  findings: VkenFindingForCategories[] | undefined,
  category: VkenProblemCategoryId,
): VkenProblemEvidence[] {
  return (findings ?? [])
    .filter((finding) => findingCategory(finding) === category)
    .map((finding) => findingEvidence(finding));
}

function findingCategory(finding: VkenFindingForCategories): VkenProblemCategoryId {
  const text = `${finding.dimension ?? ''} ${finding.description ?? ''}`.toLowerCase();
  if (/contrast|a11y|accessib|legibility|readability|hierarchy|cta|primary action|secondary text/.test(text)) {
    return 'contrast';
  }
  if (/space|spacing|padding|margin|gap|radius|layout|composition|alignment|rhythm|density/.test(text)) {
    return 'spacing';
  }
  if (/repeat|duplicate|generic|component|pattern|reuse|card|surface/.test(text)) {
    return 'repetition';
  }
  return 'tokens';
}

function parseAffectedFiles(input: string | string[] | undefined): string[] {
  if (Array.isArray(input)) return input.filter((item) => typeof item === 'string' && item.length > 0);
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  } catch {
    return input.length > 0 ? [input] : [];
  }
}
