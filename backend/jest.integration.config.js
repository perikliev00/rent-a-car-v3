const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  setupFiles: [
    '<rootDir>/tests/setup.js',
    '<rootDir>/tests/integration/setupIntegration.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setupIntegrationAfterEnv.js'],
  testMatch: ['**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Match backend unit coverage (`--testTimeout=60000`) and suites that call
  // jest.setTimeout(60_000). bcrypt admin bootstrap often exceeds Jest's 5s default.
  testTimeout: 60_000,
  slowTestThreshold: 8000,
};
