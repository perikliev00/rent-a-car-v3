/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
// Import react from '@vitejs/plugin-react'.
import react from '@vitejs/plugin-react';
// Import tailwindcss from '@tailwindcss/vite'.
import tailwindcss from '@tailwindcss/vite';

// Provide the module's default export.
export default defineConfig({
  // Provide the plugins field value.
  plugins: [react(), tailwindcss()],
  // Provide the test field value.
  test: {
    // Provide the environment field value.
    environment: 'jsdom',
    // Provide the setup files field value.
    setupFiles: './src/test/setup.ts',
    // Provide the globals field value.
    globals: true,
    // Provide the css field value.
    css: false,
    // Provide the test timeout field value.
    testTimeout: 15000,
    // Provide the slow test threshold field value.
    slowTestThreshold: 500,
    // Provide the reporters field value.
    reporters: [
      // Supply the literal value used by the enclosing expression.
      'default',
      // Contribute this line to the enclosing declaration or statement.
      ['json', { outputFile: './test-results/vitest-results.json' }],
    ],
    // Provide the coverage field value.
    coverage: {
      // Provide the provider field value.
      provider: 'v8',
      // Provide the reporter field value.
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      // Provide the include field value.
      include: ['src/**/*.{ts,tsx}'],
      // Provide the exclude field value.
      exclude: [
        // Supply the literal value used by the enclosing expression.
        '**/*.test.*',
        // Supply the literal value used by the enclosing expression.
        '**/test/**',
        // Supply the literal value used by the enclosing expression.
        'src/test/setup.ts',
        // Supply the literal value used by the enclosing expression.
        'src/vite-env.d.ts',
      ],
      // Customer-only surface after admin split (2026-09-04): statements 70.41%, branches 61.98%, functions 68.39%, lines 72.09%
      thresholds: {
        // Provide the statements field value.
        statements: 70,
        // Provide the branches field value.
        branches: 61,
        // Provide the functions field value.
        functions: 68,
        // Provide the lines field value.
        lines: 72,
      },
    },
  },
});
