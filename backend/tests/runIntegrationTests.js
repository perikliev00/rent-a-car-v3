// Destructure object properties into local variables.
const { spawnSync } = require('child_process');
// Destructure object properties into local variables.
const { requireTestDatabaseUrl } = require('../../scripts/loadTestEnv');

// Call requireTestDatabaseUrl to perform this step.
requireTestDatabaseUrl('npm run test:integration');
// Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
process.env.RUN_INTEGRATION_TESTS = '1';

// Create the result constant.
const result = spawnSync(
  // Contribute this line to the enclosing declaration or statement.
  process.execPath,
  [
    // Call require.resolve to perform this step.
    require.resolve('jest/bin/jest'),
    // Supply the literal value used by the enclosing expression.
    '--config',
    // Call require.resolve to perform this step.
    require.resolve('../jest.integration.config.js'),
    // Supply the literal value used by the enclosing expression.
    '--runInBand',
    // Supply the literal value used by the enclosing expression.
    '--json',
    // Continue the surrounding logic with this statement.
    '--outputFile=test-results/jest-integration-results.json',
  ],
  // Contribute this line to the enclosing declaration or statement.
  { stdio: 'inherit', env: process.env, shell: false }
);

// Call process.exit to perform this step.
process.exit(result.status ?? 1);
