import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from '../src/db.js';
import { critiqueCapture } from '../src/vken/critique.js';

const tempDirs: string[] = [];

afterEach(() => {
  closeDatabase();
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('vken critique', () => {
  it('persists cassette-backed VL findings', async () => {
    const projectRoot = path.resolve('../..');
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-vken-critique-'));
    tempDirs.push(dataDir);
    const db = openDatabase(projectRoot, { dataDir });
    const now = Date.now();
    const screenshot = path.join(dataDir, 'shot.png');
    fs.writeFileSync(screenshot, Buffer.from('png'));
    db.prepare(
      `INSERT INTO vken_targets
        (id, source, source_ref, framework, package_manager, tailwind_version, workspace_path, created_at)
       VALUES ('target', 'sample', 'landing-generic', 'vite-react-tailwind', 'npm', 3, ?, ?)`,
    ).run(projectRoot, now);
    db.prepare(`INSERT INTO vken_runs (id, target_id, status, created_at) VALUES ('run', 'target', 'running', ?)`).run(now);
    db.prepare(
      `INSERT INTO vken_captures
        (id, run_id, checkpoint, route_path, viewport, screenshot_path, aria_yaml, css_vars_json, box_models_json, console_json, captured_at)
       VALUES ('capture', 'run', 'initial', '/', 'desktop', ?, '- document: []', '{}', '[]', '[]', ?)`,
    ).run(screenshot, now);

    const result = await critiqueCapture({
      captureId: 'capture',
      runId: 'run',
      db,
      opts: { noLlm: true, sampleId: 'landing-generic' },
    });

    expect(result.designQuality).toBeGreaterThan(0);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(db.prepare(`SELECT COUNT(*) AS count FROM vken_findings WHERE run_id = 'run'`).get()).toMatchObject({
      count: result.findings.length,
    });
  });
});
