#!/usr/bin/env node
/**
 * Drops and recreates the public schema, then applies schema and migrations.
 * Development only — requires --confirm or FORCE_DB_RESET=1.
 *
 * Usage: node sql/reset.js [--confirm]
 */
require('dotenv').config();

// Require the '../src/db/pool' module as pool.
const pool = require('../src/db/pool');
// Destructure object properties into local variables.
const { applySchema } = require('./applySchema');
// Destructure object properties into local variables.
const { migrate } = require('./migrate');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertDevelopmentOnly,
  // Contribute this line to the enclosing declaration or statement.
  parseCliArgs,
  // Contribute this line to the enclosing declaration or statement.
  parseDatabaseUrl,
  // Contribute this line to the enclosing declaration or statement.
  requireDatabaseUrl,
  // Contribute this line to the enclosing declaration or statement.
  requireDestructiveConfirmation,
// Continue the surrounding logic with this statement.
} = require('./dbCliUtils');

/**
 * Drop and recreate the public schema (destructive reset helper).
 *
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function dropPublicSchema() {
  // Create the database url constant.
  const databaseUrl = requireDatabaseUrl();
  // Destructure object properties into local variables.
  const { user } = parseDatabaseUrl(databaseUrl);
  // Create the client constant.
  const client = await pool.connect();

  // Start a try block for operations that may fail.
  try {
    // Emit a diagnostic log message.
    console.log('→ dropping public schema');
    // Wait until the asynchronous operation resolves.
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    // Wait until the asynchronous operation resolves.
    await client.query('CREATE SCHEMA public');
    // Wait until the asynchronous operation resolves.
    await client.query(`GRANT ALL ON SCHEMA public TO ${quoteIdentifier(user)}`);
    // Wait until the asynchronous operation resolves.
    await client.query('GRANT ALL ON SCHEMA public TO public');
    // Emit a diagnostic log message.
    console.log('✓ Public schema recreated');
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Call client.release to perform this step.
    client.release();
  }
}

/**
 * Quote a PostgreSQL identifier with double quotes.
 *
 * @param {*} identifier
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

/**
 * Reset the database (drop public schema + re-apply schema/migrations as configured).
 *
 * @param {*} [argv] - argv = process.argv.slice(2)
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
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
