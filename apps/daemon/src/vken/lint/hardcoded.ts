import type { HardcodedValueFinding } from '../types.js';

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;
const SPACING_RE = /\b\d+(?:\.\d+)?(?:px|rem|em)\b/g;
const TOKEN_FILE_RE = /(?:tokens|theme|variables|tailwind\.config)\.(?:css|ts|js|mjs|cjs)$/;

export function findHardcodedValues(file: string, content: string): HardcodedValueFinding[] {
  if (TOKEN_FILE_RE.test(file.replaceAll('\\', '/'))) return [];
  const findings: HardcodedValueFinding[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    collectMatches(COLOR_RE, line, (value) => {
      findings.push({ file, line: i + 1, kind: 'color', value });
    });
    collectMatches(SPACING_RE, line, (value) => {
      const kind = /border[-Rr]adius|border-radius|rounded-/.test(line) ? 'radius' : 'spacing';
      findings.push({ file, line: i + 1, kind, value });
    });
  }
  return findings;
}

function collectMatches(regex: RegExp, input: string, onMatch: (value: string) => void): void {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) {
    onMatch(match[0]);
  }
}
