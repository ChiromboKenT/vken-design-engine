import { describe, expect, it } from 'vitest';
import { renderValidationChecklist } from '../src/vken/pr.js';

describe('vken/pr', () => {
  it('renders validation checklist from measured stages', () => {
    const body = renderValidationChecklist({
      tsc: { ok: true, details: { skipped: 'no tsconfig.json' } },
      build: { ok: true, details: {} },
      a11y: { ok: false, details: { violationCount: 3, seriousCount: 1 } },
      pixel: { ok: true, details: { visualGap: 0.071, threshold: 0.2 } },
      console: { ok: true, details: { errors: [] } },
    });

    expect(body).toContain('PASS tsc --noEmit (skipped: no tsconfig.json)');
    expect(body).toContain('FAIL axe-core (3 violations, 1 serious)');
    expect(body).toContain('PASS pixel diff vs initial capture (gap 0.071 / 0.2)');
    expect(body).toContain('PASS browser console scan (0 errors)');
  });
});
