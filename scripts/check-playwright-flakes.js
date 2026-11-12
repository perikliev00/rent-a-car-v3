#!/usr/bin/env node
/**
 * Fail CI when Playwright JSON shows retries — retries are a flake signal, not a pass.
 * Usage: node scripts/check-playwright-flakes.js [path-to-results.json]
 */
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');

// Create the results path constant.
const resultsPath =
  // Continue the surrounding logic with this statement.
  process.argv[2] || path.join(__dirname, '..', 'e2e', 'test-results', 'results.json');

// Evaluate the condition and enter the branch when it is true.
if (!fs.existsSync(resultsPath)) {
  // Emit a diagnostic log message.
  console.error(`Playwright results not found: ${resultsPath}`);
  // Call process.exit to perform this step.
  process.exit(1);
}

// Create the report constant.
const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
// Create the flaky constant.
const flaky = [];

/**
 * Recursively walk Playwright suite nodes while checking flake heuristics.
 *
 * @param {*} [suites] - suites = []
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function walkSuites(suites = []) {
  // Iterate using the loop initializer, condition, and step.
  for (const suite of suites) {
    // Iterate using the loop initializer, condition, and step.
    for (const spec of suite.specs || []) {
      // Iterate using the loop initializer, condition, and step.
      for (const test of spec.tests || []) {
        // Create the results constant.
        const results = test.results || [];
        // Create the retried constant.
        const retried = results.length > 1;
        // Create the had retry pass constant.
        const hadRetryPass = results.some((r, i) => i > 0 && r.status === 'passed');
        // Evaluate the condition and enter the branch when it is true.
        if (retried || hadRetryPass || (test.status === 'flaky')) {
          // Call flaky.push to perform this step.
          flaky.push({
            // Provide the title field value.
            title: [...(suite.title ? [suite.title] : []), spec.title].filter(Boolean).join(' › '),
            // Provide the status field value.
            status: test.status,
            // Provide the attempts field value.
            attempts: results.length,
            // Provide the outcomes field value.
            outcomes: results.map((r) => r.status),
          });
        }
      }
    }
    // Evaluate the condition and enter the branch when it is true.
    if (suite.suites?.length) walkSuites(suite.suites);
  }
}

// Call walkSuites to perform this step.
walkSuites(report.suites || []);

// Evaluate the condition and enter the branch when it is true.
if (flaky.length === 0) {
  // Emit a diagnostic log message.
  console.log('✓ No Playwright retries / flaky tests detected');
  // Call process.exit to perform this step.
  process.exit(0);
}

// Emit a diagnostic log message.
console.error('Playwright flake signal — tests passed only after retry:');
// Iterate using the loop initializer, condition, and step.
for (const item of flaky) {
  // Emit a diagnostic log message.
  console.error(`  - ${item.title} (attempts=${item.attempts}, outcomes=${item.outcomes.join(',')})`);
}
// Emit a diagnostic log message.
console.error('Fix the root cause; do not raise retries or ignore this check.');
// Call process.exit to perform this step.
process.exit(1);
