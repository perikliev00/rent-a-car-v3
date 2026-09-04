/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    host: true,
  },
  preview: {
    port: 5174,
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: false,
    testTimeout: 30000,
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
      // Admin surface after split (2026-09-04): statements 51.42%, branches 45.22%, functions 40.77%, lines 52.95%
      thresholds: {
        statements: 51,
        branches: 45,
        functions: 40,
        lines: 52,
      },
    },
  },
});
