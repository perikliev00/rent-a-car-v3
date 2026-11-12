module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  clearMocks: true,
  setupFiles: ['<rootDir>/tests/setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.js'],
  slowTestThreshold: 500,
  verbose: !!process.env.CI,
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!src/public/**',
  ],
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // Baseline 2026-08-22 unit coverage (Prompt 1 re-run): statements 46.62%, branches 28.72%, functions 40.75%, lines 47.73%
  coverageThreshold: {
    global: {
      statements: 46,
      branches: 28,
      functions: 40,
      lines: 47,
    },
  },
};
