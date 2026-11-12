// Import fs from 'fs'.
import fs from 'fs';
// Import path from 'path'.
import path from 'path';
// Import named exports from '@playwright/test'.
import { defineConfig, devices } from '@playwright/test';

// Create the test env path constant.
const testEnvPath = path.resolve(__dirname, '..', '.env.test');
// Evaluate the condition and enter the branch when it is true.
if (fs.existsSync(testEnvPath)) {
  // Iterate using the loop initializer, condition, and step.
  for (const rawLine of fs.readFileSync(testEnvPath, 'utf8').split(/\r?\n/)) {
    // Create the line constant.
    const line = rawLine.trim();
    // Evaluate the condition and enter the branch when it is true.
    if (!line || line.startsWith('#')) continue;
    // Create the eq constant.
    const eq = line.indexOf('=');
    // Evaluate the condition and enter the branch when it is true.
    if (eq <= 0) continue;
    // Create the key constant.
    const key = line.slice(0, eq).trim();
    // Initialize the mutable value variable.
    let value = line.slice(eq + 1).trim();
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Continue the surrounding logic with this statement.
      (value.startsWith('"') && value.endsWith('"')) ||
      // Continue the surrounding logic with this statement.
      (value.startsWith("'") && value.endsWith("'"))
    // Continue the surrounding logic with this statement.
    ) {
      // Update value with the right-hand side value.
      value = value.slice(1, -1);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (process.env[key] === undefined || process.env[key] === '') {
      // Update process.env[key] with the right-hand side value.
      process.env[key] = value;
    }
  }
}

// Create the repo root constant.
const repoRoot = path.resolve(__dirname, '..');
// Create the backend dir constant.
const backendDir = path.join(repoRoot, 'backend');
// Create the frontend dir constant.
const frontendDir = path.join(repoRoot, 'front end');
// Create the admin frontend dir constant.
const adminFrontendDir = path.join(repoRoot, 'admin-front-end');

// Create the test database url constant.
const testDatabaseUrl =
  // Contribute this line to the enclosing declaration or statement.
  process.env.DATABASE_URL || 'postgres://luxride:luxride@localhost:5432/luxride_test';

// Create the backend env constant.
const backendEnv = {
  // Spread process.env into the surrounding structure.
  ...process.env,
  // Provide the node env field value.
  NODE_ENV: 'development',
  // Provide the database url field value.
  DATABASE_URL: testDatabaseUrl,
  // Provide the stripe stub field value.
  STRIPE_STUB: '1',
  // Provide the email enabled field value.
  EMAIL_ENABLED: 'false',
  // Provide the stripe secret field value.
  STRIPE_SECRET: process.env.STRIPE_SECRET || 'sk_test_jest_placeholder_key_1234567890',
  // Provide the stripe webhook secret field value.
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_jest_placeholder_secret',
  // Provide the session secret field value.
  SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret-32-chars-minimum!!',
  // Provide the frontend base url field value.
  FRONTEND_BASE_URL: 'http://localhost:5173',
  // Provide the cors origins field value.
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174',
  // Provide the admin email field value.
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@luxride.local',
  // Provide the rate limit login max field value.
  RATE_LIMIT_LOGIN_MAX: '1000',
  // Provide the rate limit auth max field value.
  RATE_LIMIT_AUTH_MAX: '1000',
  // Provide the rate limit signup max field value.
  RATE_LIMIT_SIGNUP_MAX: '1000',
  // Provide the rate limit admin read max field value.
  RATE_LIMIT_ADMIN_READ_MAX: '5000',
  // Provide the rate limit admin write max field value.
  RATE_LIMIT_ADMIN_WRITE_MAX: '5000',
  // Provide the rate limit admin realtime max field value.
  RATE_LIMIT_ADMIN_REALTIME_MAX: '500',
  // Provide the rate limit account upload max field value.
  RATE_LIMIT_ACCOUNT_UPLOAD_MAX: '500',
  // Provide the rate limit booking max field value.
  RATE_LIMIT_BOOKING_MAX: '5000',
  // Provide the rate limit checkout max field value.
  RATE_LIMIT_CHECKOUT_MAX: '5000',
};

// Create the reuse existing server constant.
const reuseExistingServer = process.env.E2E_REUSE_SERVER === '1';

// Provide the module's default export.
export default defineConfig({
  // Provide the test dir field value.
  testDir: './specs',
  // Provide the fully parallel field value.
  fullyParallel: false,
  // Provide the forbid only field value.
  forbidOnly: !!process.env.CI,
  // Provide the retries field value.
  retries: process.env.CI ? 1 : 0,
  // Provide the workers field value.
  workers: 1,
  // Provide the reporter field value.
  reporter: [
    // Contribute this line to the enclosing declaration or statement.
    ['list'],
    // Contribute this line to the enclosing declaration or statement.
    ['html', { open: 'never' }],
    // Contribute this line to the enclosing declaration or statement.
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  // Provide the use field value.
  use: {
    // Provide the base url field value.
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    // Provide the trace field value.
    trace: 'on-first-retry',
    // Provide the screenshot field value.
    screenshot: 'only-on-failure',
    // Provide the video field value.
    video: 'retain-on-failure',
  },
  // Provide the projects field value.
  projects: [
    {
      // Provide the name field value.
      name: 'chromium',
      // Provide the use field value.
      use: { ...devices['Desktop Chrome'] },
      // Provide the test ignore field value.
      testIgnore: /mobile-.*\.spec\.ts/,
    },
    {
      // Provide the name field value.
      name: 'mobile-chrome',
      // Provide the use field value.
      use: { ...devices['Pixel 5'] },
      // Provide the test match field value.
      testMatch: /mobile-.*\.spec\.ts/,
    },
  ],
  // Provide the web server field value.
  webServer: [
    {
      // Provide the command field value.
      command: 'npm run dev',
      // Provide the cwd field value.
      cwd: backendDir,
      // Provide the url field value.
      url: 'http://localhost:3000/health/live',
      // Contribute this line to the enclosing declaration or statement.
      reuseExistingServer,
      // Provide the timeout field value.
      timeout: 120_000,
      // Provide the env field value.
      env: backendEnv,
    },
    {
      // Provide the command field value.
      command: 'npm run dev',
      // Provide the cwd field value.
      cwd: frontendDir,
      // Provide the url field value.
      url: 'http://localhost:5173',
      // Contribute this line to the enclosing declaration or statement.
      reuseExistingServer,
      // Provide the timeout field value.
      timeout: 120_000,
      // Provide the env field value.
      env: {
        // Spread process.env into the surrounding structure.
        ...process.env,
        // Provide the vite api base url field value.
        VITE_API_BASE_URL: 'http://localhost:3000',
        // Provide the vite admin frontend url field value.
        VITE_ADMIN_FRONTEND_URL: 'http://localhost:5174',
      },
    },
    {
      // Provide the command field value.
      command: 'npm run dev',
      // Provide the cwd field value.
      cwd: adminFrontendDir,
      // Provide the url field value.
      url: 'http://localhost:5174',
      // Contribute this line to the enclosing declaration or statement.
      reuseExistingServer,
      // Provide the timeout field value.
      timeout: 120_000,
      // Provide the env field value.
      env: {
        // Spread process.env into the surrounding structure.
        ...process.env,
        // Provide the vite api base url field value.
        VITE_API_BASE_URL: 'http://localhost:3000',
        // Provide the vite customer frontend url field value.
        VITE_CUSTOMER_FRONTEND_URL: 'http://localhost:5173',
      },
    },
  ],
});
