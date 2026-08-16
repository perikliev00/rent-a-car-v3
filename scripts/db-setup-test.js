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
