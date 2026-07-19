import { defineConfig, devices } from '@playwright/test';

const appUrl = process.env.DOCS_APP_URL || 'http://127.0.0.1:5173';
const appHost = new URL(appUrl).hostname;
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);

if (!localHosts.has(appHost) && process.env.DOCS_CAPTURE_ALLOW_REMOTE !== 'true') {
  throw new Error(
    `Refusing documentation capture against ${appHost}. ` +
      'Use a local fixture environment or set DOCS_CAPTURE_ALLOW_REMOTE=true explicitly.'
  );
}

export default defineConfig({
  testDir: './tests/screenshots',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: appUrl,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/Detroit',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'documentation-chromium', use: { browserName: 'chromium' } }],
});
