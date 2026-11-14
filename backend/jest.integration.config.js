const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  setupFiles: [
    '<rootDir>/tests/setup.js',
    '<rootDir>/tests/integration/setupIntegration.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setupIntegrationAfterEnv.js'],
  // Include disposable-DB restore CLI coverage (B7) alongside API/DB integration suites.
  testMatch: [
    '**/tests/integration/**/*.test.js',
    '**/tests/ops/dbRestore.test.js',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  // Match backend unit coverage (`--testTimeout=60000`) and suites that call
  // jest.setTimeout(60_000). bcrypt admin bootstrap often exceeds Jest's 5s default.
  testTimeout: 60_000,
  slowTestThreshold: 8000,
};
