process.env.RUN_INTEGRATION_TESTS = '1';

const { spawnSync } = require('child_process');

const result = spawnSync(
  process.execPath,
  [
    require.resolve('jest/bin/jest'),
    '--config',
    require.resolve('../jest.integration.config.js'),
    '--runInBand',
  ],
  { stdio: 'inherit', env: process.env, shell: false }
);

process.exit(result.status ?? 1);
