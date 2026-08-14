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
};
