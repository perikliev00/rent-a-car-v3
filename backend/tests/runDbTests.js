process.env.RUN_DB_TESTS = 'true';

const { spawnSync } = require('child_process');

const result = spawnSync(
  process.execPath,
  [require.resolve('jest/bin/jest'), '--runInBand', 'tests/dbConsistency.test.js'],
  { stdio: 'inherit', env: process.env, shell: false }
);

process.exit(result.status ?? 1);
