#!/usr/bin/env node
/**
 * Applies all SQL schema files from sql/schema/ in sorted order.
 * Usage: node sql/applySchema.js
 */
require('dotenv').config();

// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Require the '../src/db/pool' module as pool.
const pool = require('../src/db/pool');
// Destructure object properties into local variables.
const { requireDatabaseUrl } = require('./dbCliUtils');
// Destructure object properties into local variables.
const { acquireDbSetupLock, releaseDbSetupLock } = require('./dbSetupLock');

// Create the schema dir constant.
const SCHEMA_DIR = path.join(__dirname, 'schema');

/**
 * True when versioned migrations have already been applied.
 * Fresh installs have no ledger yet. Existing databases must not replay
 * schema seeds: ON CONFLICT DO NOTHING re-inserts revoked role permissions.
 *
 * @param {{ query: Function }} client
 * @returns {Promise<boolean>}
 */
async function hasAppliedMigrations(client) {
  // Create the ledger constant.
  const ledger = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
    ) AS present
  `);
  // Evaluate the condition and enter the branch when it is true.
  if (!ledger.rows[0] || ledger.rows[0].present !== true) return false;
  // Create the applied constant.
  const applied = await client.query('SELECT 1 FROM schema_migrations LIMIT 1');
  // Return the resulting value to the caller.
  return applied.rowCount > 0;
}

/**
 * Apply fresh-install schema files only when the migration ledger is empty.
 *
 * @param {{ query: Function }} client
 * @param {{ readSchemaFiles?: () => Array<{ name: string, sql: string }> }} [options]
 * @returns {Promise<{ skipped: boolean, applied: number }>}
 */
async function applyFreshSchemaIfNeeded(client, { readSchemaFiles } = {}) {
  // Evaluate the condition and enter the branch when it is true.
  if (await hasAppliedMigrations(client)) {
    // Return the resulting value to the caller.
    return { skipped: true, applied: 0 };
  }

  // Create the files constant.
  const files = readSchemaFiles ? readSchemaFiles() : readSchemaFilesFromDisk();
  // Evaluate the condition and enter the branch when it is true.
  if (!files.length) {
    // Throw an error to stop the current control flow.
    throw new Error(`No schema files found in ${SCHEMA_DIR}`);
  }

  // Iterate using the loop initializer, condition, and step.
  for (const file of files) {
    // Emit a diagnostic log message.
    console.log(`→ ${file.name}`);
    // Wait until the asynchronous operation resolves.
    await client.query(file.sql);
  }
  // Return the resulting value to the caller.
  return { skipped: false, applied: files.length };
}

/**
 * Read sql/schema/*.sql in lexicographic order.
 * @returns {Array<{ name: string, sql: string }>}
 */
function readSchemaFilesFromDisk() {
  // Return the resulting value to the caller.
  return fs
    // Call .readdirSync to perform this step.
    .readdirSync(SCHEMA_DIR)
    // Call .filter to perform this step.
    .filter((name) => name.endsWith('.sql'))
    // Call .sort to perform this step.
    .sort()
    // Call .map to perform this step.
    .map((name) => ({
      // Contribute this line to the enclosing declaration or statement.
      name,
      // Provide the sql field value.
      sql: fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8'),
    }));
}

/**
 * Apply all SQL schema files from sql/schema/ in sorted order under the setup lock.
 *
 * @param {object} options - { endPool = true } = {}
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function applySchema({ endPool = true } = {}) {
  // Fail fast when DATABASE_URL is missing.
  requireDatabaseUrl();

  // Create the client constant.
  const client = await pool.connect();
  // Initialize the mutable locked variable.
  let locked = false;

  // Start a try block for operations that may fail.
  try {
    // Serialize with migrate so concurrent containers do not interleave DDL.
    await acquireDbSetupLock(client);
    // Update locked with the right-hand side value.
    locked = true;

    // Create the result constant.
    const result = await applyFreshSchemaIfNeeded(client);
    // Evaluate the condition and enter the branch when it is true.
    if (result.skipped) {
      // Emit a diagnostic log message.
      console.log('Existing database detected; skipping fresh schema seed');
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Emit a diagnostic log message.
      console.log('✓ Schema applied successfully');
    }
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Always unlock and release; optionally end the process pool for CLI mode.
    if (locked) {
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await releaseDbSetupLock(client);
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // ignore unlock errors on teardown
      }
    }
    // Call client.release to perform this step.
    client.release();
    // Evaluate the condition and enter the branch when it is true.
    if (endPool) {
      // Wait until the asynchronous operation resolves.
      await pool.end();
    }
  }
}

// Evaluate the condition and enter the branch when it is true.
if (require.main === module) {
  // Call applySchema to perform this step.
  applySchema().catch((err) => {
    // Emit a diagnostic log message.
    console.error('Schema apply failed:', err.message);
    // Call process.exit to perform this step.
    process.exit(1);
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  applySchema,
  // Contribute this line to the enclosing declaration or statement.
  hasAppliedMigrations,
  // Contribute this line to the enclosing declaration or statement.
  applyFreshSchemaIfNeeded,
};
