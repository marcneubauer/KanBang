import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:api',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: './e2e-test.db',
        RATE_LIMIT_MAX: '1000',
      },
    },
    {
      command: 'pnpm dev:web',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
