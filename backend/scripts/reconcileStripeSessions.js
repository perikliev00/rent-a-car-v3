#!/usr/bin/env node
/**
 * Reconcile paid Stripe checkout sessions with local reservations/orders.
 * Recovery path when webhooks fail temporarily.
 *
 * Usage: node scripts/reconcileStripeSessions.js [--dry-run] [--limit=50]
 */
require('dotenv').config();

const pool = require('../src/db/pool');
const {
  reconcileStripeSessions,
} = require('../src/services/payment/reconcileStripeSessionsService');

function parseArgs(argv) {
  const options = { dryRun: false, limit: 50 };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isInteger(value) && value > 0) {
        options.limit = value;
      }
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!process.env.STRIPE_SECRET) {
    throw new Error('STRIPE_SECRET is required');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  console.log(`Reconciling Stripe sessions (dryRun=${options.dryRun}, limit=${options.limit})`);

  const result = await reconcileStripeSessions(options);

  if (!result.processed) {
    console.log('No processing reservations with Stripe session IDs found.');
    await pool.end();
    return;
  }

  for (const summary of result.results) {
    console.log(JSON.stringify(summary));
  }

  console.log(
    `Done. processed=${result.processed} finalized_or_ready=${result.finalizedOrReady} skipped=${result.skipped}`
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error('Reconcile failed:', err.message);
  try {
    await pool.end();
  } catch {
    // ignore pool shutdown errors on fatal exit
  }
  process.exit(1);
});
