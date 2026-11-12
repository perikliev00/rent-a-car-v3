/**
 * Run `backend` `db:setup` against the test DATABASE_URL from `.env.test`.
 * Used by CI / local test database provisioning (`npm run db:setup:test`).
 */

const { spawnSync } = require('child_process');
const path = require('path');
const { requireTestDatabaseUrl } = require('./loadTestEnv');

requireTestDatabaseUrl('npm run db:setup:test');

const repoRoot = path.resolve(__dirname, '..');
const result = spawnSync('npm', ['--prefix', 'backend', 'run', 'db:setup'], {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
