import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');
const frontendDir = path.join(repoRoot, 'front end');

const testDatabaseUrl =
  process.env.DATABASE_URL || 'postgres://luxride:luxride@localhost:5432/luxride_test';

const backendEnv = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: testDatabaseUrl,
  STRIPE_STUB: '1',
  EMAIL_ENABLED: 'false',
  STRIPE_SECRET: process.env.STRIPE_SECRET || 'sk_test_jest_placeholder_key_1234567890',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_jest_placeholder_secret',
  SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret-32-chars-minimum!!',
  FRONTEND_BASE_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@luxride.local',
  RATE_LIMIT_LOGIN_MAX: '1000',
  RATE_LIMIT_AUTH_MAX: '1000',
  RATE_LIMIT_SIGNUP_MAX: '1000',
  RATE_LIMIT_ADMIN_MAX: '5000',
  RATE_LIMIT_ACCOUNT_UPLOAD_MAX: '500',
  RATE_LIMIT_BOOKING_MAX: '5000',
  RATE_LIMIT_CHECKOUT_MAX: '5000',
};

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: backendDir,
      url: 'http://localhost:3000/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: backendEnv,
    },
    {
      command: 'npm run dev',
      cwd: frontendDir,
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: 'http://localhost:3000',
      },
    },
  ],
});
