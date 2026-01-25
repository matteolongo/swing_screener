import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100',
  },
  webServer: {
    command: 'yarn dev -p 3100 -H 127.0.0.1',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
