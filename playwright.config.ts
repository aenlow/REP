import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the PRODUCTION build served under /REP/ — the same subpath
 * GitHub Pages uses. Build first: `npm run build:pages`.
 *
 * Optional: CHROMIUM_PATH / CHROMIUM_ARGS (JSON array) to use a specific Chromium binary.
 */
const executablePath = process.env.CHROMIUM_PATH;
const args = process.env.CHROMIUM_ARGS ? (JSON.parse(process.env.CHROMIUM_ARGS) as string[]) : [];

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/REP/',
    ...devices['iPhone 13'],
    // iPhone 13 profile defaults to WebKit; we run its viewport/touch in Chromium here.
    browserName: 'chromium',
    defaultBrowserType: 'chromium',
    serviceWorkers: 'allow',
    launchOptions: { ...(executablePath ? { executablePath } : {}), args },
    trace: 'off',
  },
  webServer: {
    command: 'node scripts/serve-subpath.mjs docs /REP/ 4173',
    url: 'http://localhost:4173/REP/',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
