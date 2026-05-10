import fs from 'node:fs';
import { chromium, type Browser } from 'playwright';

type ChromiumLaunchOptions = NonNullable<Parameters<typeof chromium.launch>[0]>;

const CHROMIUM_EXECUTABLE_PATH_ENVS = [
  'VKEN_CHROMIUM_EXECUTABLE_PATH',
  'CHROME_BIN',
] as const;

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveVkenChromiumLaunchOptions(
  env: NodeJS.ProcessEnv = process.env,
): ChromiumLaunchOptions {
  for (const key of CHROMIUM_EXECUTABLE_PATH_ENVS) {
    const executablePath = cleanString(env[key]);
    if (executablePath) return { headless: true, executablePath };
  }
  return { headless: true };
}

export async function launchVkenChromium(): Promise<Browser> {
  const options = resolveVkenChromiumLaunchOptions();
  if (options.executablePath && !fs.existsSync(options.executablePath)) {
    throw new Error(
      `Configured Chromium executable does not exist: ${options.executablePath}. ` +
        'Set VKEN_CHROMIUM_EXECUTABLE_PATH to an installed Chromium binary or unset it to use Playwright managed browsers.',
    );
  }
  return chromium.launch(options);
}
