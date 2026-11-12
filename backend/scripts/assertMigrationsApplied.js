#!/usr/bin/env node
/**
 * Assert every *.sql file in migrations/ is recorded in schema_migrations.
 * Run after `npm run db:setup` (or an equivalent migrate path).
 */
require('dotenv').config();

// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { Client } = require('pg');
// Destructure object properties into local variables.
const { requireDatabaseUrl } = require('../sql/dbCliUtils');

// Create the migrations dir constant.
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

/**
 * CLI entry point for this script.
 *
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function main() {
  // Call requireDatabaseUrl to perform this step.
  requireDatabaseUrl();

  // Create the files constant.
  const files = fs
    // Call .readdirSync to perform this step.
    .readdirSync(MIGRATIONS_DIR)
    // Call .filter to perform this step.
    .filter((name) => name.endsWith('.sql'))
    // Call .sort to perform this step.
    .sort();

  // Evaluate the condition and enter the branch when it is true.
  if (files.length === 0) {
    // Throw an error to stop the current control flow.
    throw new Error(`No migration files found in ${MIGRATIONS_DIR}`);
  }

  // Create the client constant.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  // Wait until the asynchronous operation resolves.
  await client.connect();
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await client.query('SELECT name FROM schema_migrations ORDER BY name');
    // Create the applied constant.
    const applied = new Set(result.rows.map((row) => row.name));
    // Create the missing constant.
    const missing = files.filter((file) => !applied.has(file));
    // Create the unexpected constant.
    const unexpected = [...applied].filter((name) => !files.includes(name));

    // Evaluate the condition and enter the branch when it is true.
    if (missing.length > 0) {
      // Throw an error to stop the current control flow.
      throw new Error(`Migrations not applied: ${missing.join(', ')}`);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (unexpected.length > 0) {
      // Emit a diagnostic log message.
      console.warn(`Warning: schema_migrations has unknown names: ${unexpected.join(', ')}`);
    }

    // Emit a diagnostic log message.
    console.log(`✓ ${files.length} migration(s) recorded in schema_migrations`);
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Wait until the asynchronous operation resolves.
    await client.end();
  }
}

// Call main to perform this step.
main().catch((err) => {
  // Emit a diagnostic log message.
  console.error(err.message || err);
  // Call process.exit to perform this step.
  process.exit(1);
});
