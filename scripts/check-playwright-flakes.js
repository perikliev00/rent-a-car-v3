#!/usr/bin/env node
/**
 * Fail CI when Playwright JSON shows retries — retries are a flake signal, not a pass.
 * Usage: node scripts/check-playwright-flakes.js [path-to-results.json]
 */
const fs = require('fs');
const path = require('path');

const resultsPath =
  process.argv[2] || path.join(__dirname, '..', 'e2e', 'test-results', 'results.json');

if (!fs.existsSync(resultsPath)) {
  console.error(`Playwright results not found: ${resultsPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const flaky = [];

function walkSuites(suites = []) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const results = test.results || [];
        const retried = results.length > 1;
        const hadRetryPass = results.some((r, i) => i > 0 && r.status === 'passed');
        if (retried || hadRetryPass || (test.status === 'flaky')) {
          flaky.push({
            title: [...(suite.title ? [suite.title] : []), spec.title].filter(Boolean).join(' › '),
            status: test.status,
            attempts: results.length,
            outcomes: results.map((r) => r.status),
          });
        }
      }
    }
    if (suite.suites?.length) walkSuites(suite.suites);
  }
}

walkSuites(report.suites || []);

if (flaky.length === 0) {
  console.log('✓ No Playwright retries / flaky tests detected');
  process.exit(0);
}

console.error('Playwright flake signal — tests passed only after retry:');
for (const item of flaky) {
  console.error(`  - ${item.title} (attempts=${item.attempts}, outcomes=${item.outcomes.join(',')})`);
}
console.error('Fix the root cause; do not raise retries or ignore this check.');
process.exit(1);
