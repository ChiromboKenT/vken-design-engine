import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outFile = path.join(repoRoot, 'kb', 'seed.jsonl');
const key = process.env.VKEN_KB_SIGNING_KEY || 'vken-dev-signing-key';
const dimensions = ['hierarchy', 'color', 'spacing', 'contrast', 'alignment', 'visual-system'];
const rules = Array.from({ length: 30 }, (_, index) => {
  const now = 1778265600000 + index;
  const dimension = dimensions[index % dimensions.length]!;
  const rule = {
    id: `seed-${dimension}-${String(index + 1).padStart(2, '0')}`,
    finding_type: dimension,
    framework: 'vite-react-tailwind',
    severity: index % 5 === 0 ? 'P1' : 'P2',
    rule_text: seedText(dimension, index),
    accept_count: 2 + (index % 4),
    reject_count: 0,
    avg_score_delta: Number((0.4 + (index % 5) * 0.12).toFixed(2)),
    evidence_runs: ['landing-generic', 'dashboard-cluttered', 'ecommerce-basic'].slice(0, 2 + (index % 2)),
    signature: '',
    created_at: now,
    updated_at: now,
  };
  rule.signature = sign(rule);
  return rule;
});

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${rules.map((rule) => JSON.stringify(rule)).join('\n')}\n`);
console.log(`VKEN_KB_SEED_OK file=${outFile} rules=${rules.length}`);

function seedText(dimension: string, index: number): string {
  const base = {
    hierarchy: 'Prefer one visually dominant primary action per viewport and demote adjacent secondary controls.',
    color: 'Replace one-off hardcoded colors with a compact neutral/accent token pair before tuning copy.',
    spacing: 'Normalize repeated card padding and radius before changing layout density.',
    contrast: 'Raise low-contrast status text before adding new labels or explanatory text.',
    alignment: 'Remove image distortion and align media to the same grid as product content.',
    'visual-system': 'Use literal search-replace patches for token and rhythm fixes so every proposal is auditable.',
  }[dimension]!;
  return `${base} Seed variant ${index + 1}.`;
}

function sign(rule: { id: string; finding_type: string; rule_text: string; created_at: number }): string {
  return createHmac('sha256', key)
    .update([rule.id, rule.finding_type, rule.rule_text, String(rule.created_at)].join('|'))
    .digest('hex');
}
