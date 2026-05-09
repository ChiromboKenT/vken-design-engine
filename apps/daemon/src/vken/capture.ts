import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';
import type { VkenViewport, VkenWorkspaceIndex } from './types.js';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const;

export interface VkenCaptureRecord {
  id: string;
  routePath: string;
  viewport: VkenViewport;
  screenshotPath: string;
  ariaYaml: string;
  cssVarsJson: string;
  boxModelsJson: string;
  consoleJson: string;
  capturedAt: number;
}

export async function captureVkenWorkspace(input: {
  runId: string;
  runDir: string;
  index: VkenWorkspaceIndex;
  baseUrl: string;
  checkpoint?: string;
}): Promise<VkenCaptureRecord[]> {
  const captures: VkenCaptureRecord[] = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of input.index.routes) {
      for (const viewport of ['desktop', 'tablet', 'mobile'] as const) {
        captures.push(
          await captureRoute({
            browser,
            baseUrl: input.baseUrl,
            runDir: input.runDir,
            checkpoint: input.checkpoint ?? 'initial',
            routePath: route.path,
            viewport,
          }),
        );
      }
    }
  } finally {
    await browser.close();
  }
  return captures;
}

async function captureRoute(input: {
  browser: Browser;
  baseUrl: string;
  runDir: string;
  checkpoint: string;
  routePath: string;
  viewport: VkenViewport;
}): Promise<VkenCaptureRecord> {
  const page = await input.browser.newPage({ viewport: VIEWPORTS[input.viewport] });
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  const url = new URL(input.routePath, input.baseUrl).toString();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20_000 });

  const dir = path.join(
    input.runDir,
    input.checkpoint,
    input.routePath === '/' ? 'root' : input.routePath.replace(/[^\w.-]+/g, '_'),
    input.viewport,
  );
  fs.mkdirSync(dir, { recursive: true });

  const screenshotPath = path.join(dir, 'screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const ariaYaml = await readAriaSnapshot(page);
  const cssVars = await readCssVars(page);
  const boxModels = await readBoxModels(page);
  const cssVarsJson = JSON.stringify(cssVars, null, 2);
  const boxModelsJson = JSON.stringify(boxModels, null, 2);
  const consoleJson = JSON.stringify(consoleErrors, null, 2);
  fs.writeFileSync(path.join(dir, 'aria.yml'), ariaYaml);
  fs.writeFileSync(path.join(dir, 'css-vars.json'), cssVarsJson);
  fs.writeFileSync(path.join(dir, 'box-models.json'), boxModelsJson);
  fs.writeFileSync(path.join(dir, 'console.json'), consoleJson);
  await page.close();

  return {
    id: randomUUID(),
    routePath: input.routePath,
    viewport: input.viewport,
    screenshotPath,
    ariaYaml,
    cssVarsJson,
    boxModelsJson,
    consoleJson,
    capturedAt: Date.now(),
  };
}

async function readAriaSnapshot(page: Page): Promise<string> {
  try {
    return await page.locator('body').ariaSnapshot();
  } catch {
    const text = await page.locator('body').innerText({ timeout: 2_000 }).catch(() => '');
    return `- document:\n  - text: ${JSON.stringify(text.slice(0, 500))}\n`;
  }
}

async function readCssVars(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const browserGlobal = globalThis as any;
    const documentRef = browserGlobal.document;
    const computed = browserGlobal.getComputedStyle(documentRef.documentElement);
    const vars: Record<string, string> = {};
    for (const sheet of Array.from(documentRef.styleSheets) as any[]) {
      try {
        for (const rule of Array.from(sheet.cssRules) as any[]) {
          if (rule instanceof browserGlobal.CSSStyleRule && rule.selectorText.includes(':root')) {
            for (const prop of Array.from(rule.style) as string[]) {
              if (prop.startsWith('--')) {
                vars[prop] = computed.getPropertyValue(prop).trim();
              }
            }
          }
        }
      } catch {
        // Cross-origin sheets can throw; local Vite samples should not.
      }
    }
    return vars;
  });
}

async function readBoxModels(page: Page) {
  return page.evaluate(() => {
    const browserGlobal = globalThis as any;
    const documentRef = browserGlobal.document;
    const selectors = ['h1', 'h2', '.hero', 'nav', '[data-cta]', 'button', '.card', 'article'];
    return selectors.flatMap((selector) =>
      (Array.from(documentRef.querySelectorAll(selector)) as any[])
        .slice(0, 3)
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const style = browserGlobal.getComputedStyle(el);
          return {
            selector,
            text: el.textContent?.trim().slice(0, 80) ?? '',
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            color: style.color,
            background: style.backgroundColor,
            borderRadius: style.borderRadius,
            padding: style.padding,
            fontWeight: style.fontWeight,
            letterSpacing: style.letterSpacing,
          };
        }),
    );
  });
}
