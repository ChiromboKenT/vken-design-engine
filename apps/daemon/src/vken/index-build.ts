import fs from 'node:fs';
import path from 'node:path';
import type { VkenWorkspaceIndex } from './types.js';
import type { VkenIntakeResult } from './intake.js';
import { findHardcodedValues } from './lint/hardcoded.js';
import { extractCssTokens } from './lint/tokens.js';

const SOURCE_EXT_RE = /\.(?:tsx|ts|jsx|js|css)$/;

export function buildVkenWorkspaceIndex(intake: VkenIntakeResult): VkenWorkspaceIndex {
  const files = walk(intake.workspacePath).filter((file) => SOURCE_EXT_RE.test(file));
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(intake.workspacePath, 'package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  const css = files
    .filter((file) => file.endsWith('.css'))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const tokens = extractCssTokens(css);
  return {
    framework: intake.framework,
    packageManager: intake.packageManager,
    tailwindVersion: intake.tailwindVersion,
    routes: detectRoutes(intake.workspacePath, files),
    components: detectComponents(intake.workspacePath, files),
    tokens,
    hardcodedValues: files.flatMap((file) =>
      findHardcodedValues(relative(intake.workspacePath, file), fs.readFileSync(file, 'utf8')),
    ),
    dependencies,
  };
}

function detectRoutes(root: string, files: string[]): VkenWorkspaceIndex['routes'] {
  const candidates = files.filter((file) => /(?:App|Home|Page|Route)\.(?:tsx|jsx)$/.test(path.basename(file)));
  const app = candidates.find((file) => path.basename(file).startsWith('App')) ?? candidates[0];
  return [
    {
      path: '/',
      componentFile: app ? relative(root, app) : 'src/App.tsx',
      auth: false,
    },
  ];
}

function detectComponents(root: string, files: string[]): VkenWorkspaceIndex['components'] {
  return files
    .filter((file) => /\.(?:tsx|jsx)$/.test(file))
    .map((file) => {
      const content = fs.readFileSync(file, 'utf8');
      const name = path.basename(file).replace(/\.(?:tsx|jsx)$/, '');
      return {
        file: relative(root, file),
        name,
        lines: content.split(/\r?\n/).length,
        primitives: [...new Set([...content.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((match) => match[1] ?? ''))].filter(Boolean),
      };
    });
}

function walk(root: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(root)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = path.join(root, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function relative(root: string, file: string): string {
  return path.relative(root, file).replaceAll(path.sep, '/');
}
