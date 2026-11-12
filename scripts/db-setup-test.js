/**
 * Run `backend` `db:setup` against the test DATABASE_URL from `.env.test`.
 * Used by CI / local test database provisioning (`npm run db:setup:test`).
 */

const { spawnSync } = require('child_process');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { requireTestDatabaseUrl } = require('./loadTestEnv');

// Call requireTestDatabaseUrl to perform this step.
requireTestDatabaseUrl('npm run db:setup:test');

// Create the repo root constant.
const repoRoot = path.resolve(__dirname, '..');
// Create the result constant.
const result = spawnSync('npm', ['--prefix', 'backend', 'run', 'db:setup'], {
  // Provide the cwd field value.
  cwd: repoRoot,
  // Provide the env field value.
  env: process.env,
  // Provide the stdio field value.
  stdio: 'inherit',
  // Provide the shell field value.
  shell: true,
});

// Call process.exit to perform this step.
process.exit(result.status ?? 1);
