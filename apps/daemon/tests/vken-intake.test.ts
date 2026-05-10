import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { intakeFromUrl, repoSizeLimitMb, VkenIntakeError } from '../src/vken/intake.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('vken intake', () => {
  it('uses a configurable repository size limit with a practical default', () => {
    const originalLimit = process.env.VKEN_REPO_SIZE_LIMIT_MB;

    try {
      delete process.env.VKEN_REPO_SIZE_LIMIT_MB;
      expect(repoSizeLimitMb()).toBe(200);
      process.env.VKEN_REPO_SIZE_LIMIT_MB = '75';
      expect(repoSizeLimitMb()).toBe(75);
      process.env.VKEN_REPO_SIZE_LIMIT_MB = '0';
      expect(repoSizeLimitMb()).toBe(200);
      process.env.VKEN_REPO_SIZE_LIMIT_MB = 'nope';
      expect(repoSizeLimitMb()).toBe(200);
    } finally {
      if (originalLimit === undefined) delete process.env.VKEN_REPO_SIZE_LIMIT_MB;
      else process.env.VKEN_REPO_SIZE_LIMIT_MB = originalLimit;
    }
  });

  it('reports a clear error when git is missing from the runtime', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-vken-intake-'));
    tempDirs.push(dataDir);
    const originalPath = process.env.PATH;
    process.env.PATH = '';

    try {
      let error: unknown;
      try {
        intakeFromUrl('https://github.com/example/vite-react-tailwind.git', {
          dataDir,
          runId: 'run-missing-git',
        });
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(VkenIntakeError);
      expect(error).toMatchObject({ message: expect.stringContaining('git executable not found') });
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });
});
