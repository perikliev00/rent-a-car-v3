const { spawnSync } = require('child_process');
const { requireTestDatabaseUrl } = require('../../scripts/loadTestEnv');

requireTestDatabaseUrl('npm run test:db');
process.env.RUN_DB_TESTS = 'true';

const result = spawnSync(
  process.execPath,
  [
    require.resolve('jest/bin/jest'),
    '--runInBand',
    '--slowTestThreshold=8000',
    '--json',
    '--outputFile=test-results/jest-db-results.json',
    'tests/dbConsistency.test.js',
  ],
  { stdio: 'inherit', env: process.env, shell: false }
);

process.exit(result.status ?? 1);
