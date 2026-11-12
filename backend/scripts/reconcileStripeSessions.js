#!/usr/bin/env node
/**
 * Reconcile paid Stripe checkout sessions with local reservations/orders.
 * Recovery path when webhooks fail temporarily.
 *
 * Usage: node scripts/reconcileStripeSessions.js [--dry-run] [--limit=50]
 */
require('dotenv').config();

// Require the '../src/db/pool' module as pool.
const pool = require('../src/db/pool');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  reconcileStripeSessions,
// Continue the surrounding logic with this statement.
} = require('../src/services/payment/reconcileStripeSessionsService');

/**
 * @param {string[]} argv
 * @returns {{ dryRun: boolean, limit: number }}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function parseArgs(argv) {
  // Create the options constant.
  const options = { dryRun: false, limit: 50 };

  // Iterate using the loop initializer, condition, and step.
  for (const arg of argv) {
    // Evaluate the condition and enter the branch when it is true.
    if (arg === '--dry-run') {
      // Update options.dryRun with the right-hand side value.
      options.dryRun = true;
    // Continue the surrounding logic with this statement.
    } else if (arg.startsWith('--limit=')) {
      // Create the value constant.
      const value = Number(arg.split('=')[1]);
      // Evaluate the condition and enter the branch when it is true.
      if (Number.isInteger(value) && value > 0) {
        // Update options.limit with the right-hand side value.
        options.limit = value;
      }
    }
  }

  // Return the resulting value to the caller.
  return options;
}

/**
 * CLI entry point for this script.
 *
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function main() {
  // Create the options constant.
  const options = parseArgs(process.argv.slice(2));

  // Evaluate the condition and enter the branch when it is true.
  if (!process.env.STRIPE_SECRET) {
    // Throw an error to stop the current control flow.
    throw new Error('STRIPE_SECRET is required');
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!process.env.DATABASE_URL) {
    // Throw an error to stop the current control flow.
    throw new Error('DATABASE_URL is required');
  }

  // Emit a diagnostic log message.
  console.log(`Reconciling Stripe sessions (dryRun=${options.dryRun}, limit=${options.limit})`);

  // Create the result constant.
  const result = await reconcileStripeSessions(options);

  // Evaluate the condition and enter the branch when it is true.
  if (!result.processed) {
    // Emit a diagnostic log message.
    console.log('No processing reservations with Stripe session IDs found.');
    // Wait until the asynchronous operation resolves.
    await pool.end();
    // Return control to the caller with the following value.
    return;
  }

  // Iterate using the loop initializer, condition, and step.
  for (const summary of result.results) {
    // Emit a diagnostic log message.
    console.log(JSON.stringify(summary));
  }

  // Emit a diagnostic log message.
  console.log(
    // Continue the surrounding logic with this statement.
    `Done. processed=${result.processed} finalized_or_ready=${result.finalizedOrReady} skipped=${result.skipped}`
  );
  // Wait until the asynchronous operation resolves.
  await pool.end();
}

// Call main to perform this step.
main().catch(async (err) => {
  // Emit a diagnostic log message.
  console.error('Reconcile failed:', err.message);
  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await pool.end();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // ignore pool shutdown errors on fatal exit
  }
  // Call process.exit to perform this step.
  process.exit(1);
});
