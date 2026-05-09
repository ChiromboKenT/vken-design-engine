import type { RadiusFinding } from '../types.js';

const RADIUS_RE = /\b(?:border-radius\s*:\s*|rounded-\[)(\d+(?:\.\d+)?(?:px|rem|em))/g;

export function findRadiusLiterals(file: string, content: string): RadiusFinding[] {
  const findings: RadiusFinding[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    RADIUS_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = RADIUS_RE.exec(line))) {
      findings.push({ file, line: i + 1, value: match[1] ?? '' });
    }
  }
  return findings;
}

