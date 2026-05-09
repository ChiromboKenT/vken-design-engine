import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { PNG } from 'pngjs';
import { chromium, type BrowserContext } from 'playwright';
import { pixelDiff } from './algorithms/pixel-diff.js';
import { computeVisualGap } from './algorithms/visual-gap.js';
import { spawnVitePreview } from './runner.js';
import type { RgbaImage } from './types.js';

export type VkenValidationStage = 'tsc' | 'build' | 'a11y' | 'pixel' | 'console';

export interface VkenValidationResult {
  ok: boolean;
  byStage: Record<VkenValidationStage, { ok: boolean; details: unknown }>;
}

const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const VISUAL_GAP_THRESHOLD = 0.2;

export async function validateMaterializedWorkspace(input: {
  runId: string;
  workspaceDir: string;
  db: any;
  service?: { emit: (run: unknown, event: string, data: unknown) => unknown };
  run?: unknown;
}): Promise<VkenValidationResult> {
  const byStage = {} as VkenValidationResult['byStage'];

  const tsc = fs.existsSync(path.join(input.workspaceDir, 'tsconfig.json'))
    ? runCommand(input.workspaceDir, 'npm', ['exec', 'tsc', '--', '--noEmit', '-p', '.'])
    : { ok: true, details: { skipped: 'no tsconfig.json' } };
  record(input, byStage, 'tsc', tsc.ok, tsc.details);

  const build = runCommand(input.workspaceDir, 'npm', ['run', 'build']);
  record(input, byStage, 'build', build.ok, build.details);

  if (!build.ok) {
    record(input, byStage, 'a11y', false, { skipped: 'build failed' });
    record(input, byStage, 'pixel', false, { skipped: 'build failed' });
    record(input, byStage, 'console', false, { skipped: 'build failed' });
    return { ok: false, byStage };
  }

  let preview: Awaited<ReturnType<typeof spawnVitePreview>> | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  let context: BrowserContext | null = null;
  try {
    preview = await spawnVitePreview({ workspacePath: input.workspaceDir, timeoutMs: 30_000 });
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(preview.url, { waitUntil: 'networkidle', timeout: 30_000 });

    const axe = await new AxeBuilder({ page }).analyze();
    const seriousViolations = axe.violations.filter(
      (violation: { impact?: string | null }) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    record(input, byStage, 'a11y', seriousViolations.length === 0, {
      axeRuns: 1,
      violationCount: axe.violations.length,
      seriousCount: seriousViolations.length,
      topViolations: seriousViolations.slice(0, 5).map((violation: any) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.length,
      })),
    });

    const afterPng = await page.screenshot({ fullPage: true, type: 'png' });
    const before = input.db
      .prepare(
        `SELECT id, screenshot_path AS screenshotPath
           FROM vken_captures
          WHERE run_id = ? AND viewport = ? AND checkpoint = ?
          ORDER BY captured_at DESC
          LIMIT 1`,
      )
      .get(input.runId, 'desktop', 'initial') as { id: string; screenshotPath: string } | undefined;

    if (before?.screenshotPath && fs.existsSync(before.screenshotPath)) {
      const beforeImage = decodePng(fs.readFileSync(before.screenshotPath));
      const afterImage = decodePng(afterPng);
      const [beforeComparable, afterComparable] = cropToCommonShape(beforeImage, afterImage);
      const diff = pixelDiff(beforeComparable, afterComparable);
      const gap = computeVisualGap(beforeComparable, afterComparable);
      record(input, byStage, 'pixel', gap.visualGap < VISUAL_GAP_THRESHOLD, {
        visualGap: gap.visualGap,
        threshold: VISUAL_GAP_THRESHOLD,
        match: gap.match,
        pHashDistance: gap.pHashDistance,
        diffRatio: diff.diffRatio,
        ssim: gap.ssim,
        beforeCaptureId: before.id,
        comparedSize: {
          width: beforeComparable.width,
          height: beforeComparable.height,
        },
      });
    } else {
      record(input, byStage, 'pixel', true, { skipped: 'no initial desktop capture' });
    }

    record(input, byStage, 'console', consoleErrors.length === 0, {
      errors: consoleErrors.slice(0, 20),
      totalErrors: consoleErrors.length,
    });
  } catch (error) {
    const details = { error: error instanceof Error ? error.message : String(error) };
    console.warn(`[vken:validate] browser validation failed: ${details.error}`);
    if (!byStage.a11y) record(input, byStage, 'a11y', false, details);
    if (!byStage.pixel) record(input, byStage, 'pixel', false, details);
    if (!byStage.console) record(input, byStage, 'console', false, details);
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
    await preview?.kill().catch(() => undefined);
  }

  return {
    ok: Object.values(byStage).every((stage) => stage.ok),
    byStage,
  };
}

function record(
  input: { runId: string; db: any; service?: { emit: (run: unknown, event: string, data: unknown) => unknown }; run?: unknown },
  byStage: VkenValidationResult['byStage'],
  stage: VkenValidationStage,
  ok: boolean,
  details: unknown,
): void {
  byStage[stage] = { ok, details };
  input.db
    .prepare(
      `INSERT INTO vken_validations (id, run_id, stage, ok, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), input.runId, stage, ok ? 1 : 0, JSON.stringify(details), Date.now());
  input.service?.emit(input.run, 'vken:validate', { stage, ok, details });
}

function runCommand(cwd: string, command: string, args: string[]): { ok: boolean; details: unknown } {
  const spec = commandSpec(command, args);
  const result = spawnSync(spec.command, spec.args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, CI: 'true' },
  });
  return {
    ok: result.status === 0,
    details: {
      command: [command, ...args].join(' '),
      status: result.status,
      stdout: result.stdout?.slice(-4000) ?? '',
      stderr: result.stderr?.slice(-4000) ?? '',
      error: result.error?.message,
      timedOut: Boolean(result.error && result.error.message.includes('ETIMEDOUT')),
    },
  };
}

function commandSpec(command: string, args: string[]): { command: string; args: string[] } {
  if (process.platform !== 'win32') return { command, args };
  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', [command, ...args].map(quoteWindowsCmdArg).join(' ')],
  };
}

function quoteWindowsCmdArg(value: string): string {
  if (/^[A-Za-z0-9._:/\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function decodePng(buffer: Buffer): RgbaImage {
  const png = PNG.sync.read(buffer);
  return {
    width: png.width,
    height: png.height,
    data: png.data,
  };
}

function cropToCommonShape(a: RgbaImage, b: RgbaImage): [RgbaImage, RgbaImage] {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  return [crop(a, width, height), crop(b, width, height)];
}

function crop(image: RgbaImage, width: number, height: number): RgbaImage {
  if (image.width === width && image.height === height) return image;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * image.width * 4;
    const targetStart = y * width * 4;
    data.set(image.data.slice(sourceStart, sourceStart + width * 4), targetStart);
  }
  return { width, height, data };
}
