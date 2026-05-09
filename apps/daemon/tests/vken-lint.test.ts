import { describe, expect, it } from 'vitest';

import {
  extractCssTokens,
  findHardcodedValues,
  findRadiusLiterals,
  placeholderA11yScan,
} from '../src/vken/index.js';

describe('vken lint modules', () => {
  it('finds hardcoded color, spacing, and radius values outside token files', () => {
    const findings = findHardcodedValues(
      'src/App.tsx',
      `
        <div style={{ color: '#ff00aa' }} />
        <div style={{ padding: '24px' }} />
        <div style={{ borderRadius: '8px' }} />
      `,
    );
    expect(findings.map((finding) => finding.kind)).toEqual(['color', 'spacing', 'radius']);
  });

  it('ignores hardcoded values in token definition files', () => {
    expect(findHardcodedValues('src/styles/tokens.css', ':root { --blue: #00f; }')).toEqual([]);
  });

  it('extracts token buckets and coverage from CSS', () => {
    const tokens = extractCssTokens(`
      :root {
        --color-primary: #0f172a;
        --space-md: 1rem;
        --radius-md: 10px;
      }
      .button { color: var(--color-primary); padding: 12px; border-radius: var(--radius-md); }
    `);
    expect(tokens.colors['--color-primary']).toBe('#0f172a');
    expect(tokens.spacings['--space-md']).toBe('1rem');
    expect(tokens.radii['--radius-md']).toBe('10px');
    expect(tokens.coverageRatio).toBeGreaterThan(0);
  });

  it('finds raw radius literals in CSS and Tailwind arbitrary classes', () => {
    const findings = findRadiusLiterals(
      'src/styles.css',
      '.card { border-radius: 12px; } <div className="rounded-[18px]" />',
    );
    expect(findings.map((finding) => finding.value)).toEqual(['12px', '18px']);
  });

  it('keeps a11y placeholder deterministic for day 1', () => {
    expect(placeholderA11yScan()).toEqual([]);
  });
});
