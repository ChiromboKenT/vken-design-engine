import { describe, expect, it } from 'vitest';

import { resolveVkenChromiumLaunchOptions } from '../src/vken/browser.js';

describe('vken browser launch options', () => {
  it('uses VKEN_CHROMIUM_EXECUTABLE_PATH when configured', () => {
    expect(
      resolveVkenChromiumLaunchOptions({
        VKEN_CHROMIUM_EXECUTABLE_PATH: '/usr/bin/chromium',
      }),
    ).toEqual({ headless: true, executablePath: '/usr/bin/chromium' });
  });

  it('falls back to CHROME_BIN for container runtimes', () => {
    expect(
      resolveVkenChromiumLaunchOptions({
        CHROME_BIN: '/usr/bin/chromium',
      }),
    ).toEqual({ headless: true, executablePath: '/usr/bin/chromium' });
  });

  it('uses Playwright managed browsers when no executable is configured', () => {
    expect(resolveVkenChromiumLaunchOptions({})).toEqual({ headless: true });
  });
});
