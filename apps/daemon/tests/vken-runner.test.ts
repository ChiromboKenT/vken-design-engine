import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ensureWorkspaceDependencies, resolveInstallCommand } from '../src/vken/runner.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-vken-runner-'));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: {}, dependencies: { vite: '^5.0.0' } }));
  return dir;
}

describe('vken runner dependency bootstrap', () => {
  it('chooses the package manager from lockfiles', () => {
    const dir = tempWorkspace();

    expect(resolveInstallCommand(dir)).toEqual({ command: 'npm', args: ['install', '--no-audit', '--no-fund'] });
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    expect(resolveInstallCommand(dir)).toEqual({ command: 'npm', args: ['ci', '--no-audit', '--no-fund'] });
    fs.rmSync(path.join(dir, 'package-lock.json'));

    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), '');
    expect(resolveInstallCommand(dir)).toEqual({ command: 'pnpm', args: ['install', '--no-frozen-lockfile'] });
    fs.rmSync(path.join(dir, 'pnpm-lock.yaml'));

    fs.writeFileSync(path.join(dir, 'yarn.lock'), '');
    expect(resolveInstallCommand(dir)).toEqual({ command: 'yarn', args: ['install'] });
    fs.rmSync(path.join(dir, 'yarn.lock'));

    fs.writeFileSync(path.join(dir, 'bun.lock'), '');
    expect(resolveInstallCommand(dir)).toEqual({ command: 'bun', args: ['install'] });
  });

  it('does not run an install when the Vite binary already exists', () => {
    const dir = tempWorkspace();
    const viteBin = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js');
    fs.mkdirSync(path.dirname(viteBin), { recursive: true });
    fs.writeFileSync(viteBin, '');
    const originalPath = process.env.PATH;
    process.env.PATH = '';

    try {
      expect(() => ensureWorkspaceDependencies(dir)).not.toThrow();
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });
});
