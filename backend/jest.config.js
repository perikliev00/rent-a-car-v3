// Assign the CommonJS module exports.
module.exports = {
  // Provide the test environment field value.
  testEnvironment: 'node',
  // Provide the test match field value.
  testMatch: ['**/tests/**/*.test.js'],
  // Provide the test path ignore patterns field value.
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  // Provide the clear mocks field value.
  clearMocks: true,
  // Provide the setup files field value.
  setupFiles: ['<rootDir>/tests/setup.js'],
  // Provide the setup files after env field value.
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.js'],
  // Provide the slow test threshold field value.
  slowTestThreshold: 500,
  // Provide the verbose field value.
  verbose: !!process.env.CI,
  // Provide the collect coverage from field value.
  collectCoverageFrom: [
    // Supply the literal value used by the enclosing expression.
    'src/**/*.js',
    // Supply the literal value used by the enclosing expression.
    '!**/node_modules/**',
    // Supply the literal value used by the enclosing expression.
    '!src/public/**',
  ],
  // Provide the coverage reporters field value.
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // Baseline 2026-08-22 unit coverage (Prompt 1 re-run): statements 46.62%, branches 28.72%, functions 40.75%, lines 47.73%
  coverageThreshold: {
    // Provide the global field value.
    global: {
      // Provide the statements field value.
      statements: 46,
      // Provide the branches field value.
      branches: 28,
      // Provide the functions field value.
      functions: 40,
      // Provide the lines field value.
      lines: 47,
    },
  },
};
