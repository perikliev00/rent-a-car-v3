#!/usr/bin/env node
/**
 * Drops and recreates the public schema, then applies schema and migrations.
 * Development only — requires --confirm or FORCE_DB_RESET=1.
 *
 * Usage: node sql/reset.js [--confirm]
 */
require('dotenv').config();

const pool = require('../src/db/pool');
const { applySchema } = require('./applySchema');
const { migrate } = require('./migrate');
const {
  assertDevelopmentOnly,
  parseCliArgs,
  parseDatabaseUrl,
  requireDatabaseUrl,
  requireDestructiveConfirmation,
} = require('./dbCliUtils');

async function dropPublicSchema() {
  const databaseUrl = requireDatabaseUrl();
  const { user } = parseDatabaseUrl(databaseUrl);
  const client = await pool.connect();

  try {
    console.log('→ dropping public schema');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query(`GRANT ALL ON SCHEMA public TO ${quoteIdentifier(user)}`);
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✓ Public schema recreated');
  } finally {
    client.release();
  }
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function reset(argv = process.argv.slice(2)) {
  assertDevelopmentOnly('db:reset');

  const options = parseCliArgs(argv);
  requireDestructiveConfirmation('db:reset', options);

  await dropPublicSchema();
  await applySchema({ endPool: false });
  await migrate({ endPool: false });
  await pool.end();

  console.log('✓ Database reset complete');
}

if (require.main === module) {
  reset().catch((err) => {
    console.error('Reset failed:', err.message);
    process.exit(1);
  });
}

module.exports = { reset, dropPublicSchema };
