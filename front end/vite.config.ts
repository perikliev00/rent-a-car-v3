/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: false,
    testTimeout: 15000,
    slowTestThreshold: 500,
    reporters: [
      'default',
      ['json', { outputFile: './test-results/vitest-results.json' }],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.*',
        '**/test/**',
        'src/test/setup.ts',
        'src/vite-env.d.ts',
      ],
      // Baseline 2026-08-22 unit coverage (Prompt 1 re-run): statements 52.86%, branches 47.56%, functions 42.6%, lines 54.27%
      thresholds: {
        statements: 52,
        branches: 47,
        functions: 42,
        lines: 54,
      },
    },
  },
});
