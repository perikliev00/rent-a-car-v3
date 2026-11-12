// Require the './jest.config' module as baseConfig.
const baseConfig = require('./jest.config');

// Assign the CommonJS module exports.
module.exports = {
  // Spread baseConfig into the surrounding structure.
  ...baseConfig,
  // Provide the setup files field value.
  setupFiles: [
    // Continue the surrounding logic with this statement.
    '<rootDir>/tests/setup.js',
    // Continue the surrounding logic with this statement.
    '<rootDir>/tests/integration/setupIntegration.js',
  ],
  // Provide the setup files after env field value.
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setupIntegrationAfterEnv.js'],
  // Provide the test match field value.
  testMatch: ['**/tests/integration/**/*.test.js'],
  // Provide the test path ignore patterns field value.
  testPathIgnorePatterns: ['/node_modules/'],
  // Provide the slow test threshold field value.
  slowTestThreshold: 8000,
};
