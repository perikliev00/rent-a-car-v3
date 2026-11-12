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
      // Customer-only surface after admin split (2026-09-04): statements 70.41%, branches 61.98%, functions 68.39%, lines 72.09%
      thresholds: {
        statements: 70,
        branches: 61,
        functions: 68,
        lines: 72,
      },
    },
  },
});
