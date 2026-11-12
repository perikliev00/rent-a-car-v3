#!/usr/bin/env node
/**
 * Applies versioned SQL migrations from migrations/ in sorted order.
 * Tracks applied files in schema_migrations — safe to re-run (skips applied).
 *
 * Usage: node sql/migrate.js
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

// Create the migrations dir constant.
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

/**
 * Ensure the schema_migrations tracking table exists.
 *
 * @param {*} client
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function ensureMigrationsTable(client) {
  // Wait until the asynchronous operation resolves.
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Apply pending versioned SQL migrations in sorted order under the setup lock.
 *
 * @param {object} options - { endPool = true } = {}
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function migrate({ endPool = true } = {}) {
  // Fail fast when DATABASE_URL is missing.
  requireDatabaseUrl();

  // Evaluate the condition and enter the branch when it is true.
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    // Throw an error to stop the current control flow.
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  // Deterministic order: lexicographic filename sort (use numbered prefixes).
  const files = fs
    // Call .readdirSync to perform this step.
    .readdirSync(MIGRATIONS_DIR)
    // Call .filter to perform this step.
    .filter((name) => name.endsWith('.sql'))
    // Call .sort to perform this step.
    .sort();

  // Create the client constant.
  const client = await pool.connect();
  // Initialize the mutable locked variable.
  let locked = false;

  // Start a try block for operations that may fail.
  try {
    // Serialize with applySchema so concurrent containers do not interleave DDL.
    await acquireDbSetupLock(client);
    // Update locked with the right-hand side value.
    locked = true;

    // Wait until the asynchronous operation resolves.
    await ensureMigrationsTable(client);

    // Load already-applied names so re-runs are idempotent.
    const appliedResult = await client.query('SELECT name FROM schema_migrations');
    // Create the applied constant.
    const applied = new Set(appliedResult.rows.map((row) => row.name));

    // Initialize the mutable applied count variable.
    let appliedCount = 0;

    // Iterate using the loop initializer, condition, and step.
    for (const file of files) {
      // Evaluate the condition and enter the branch when it is true.
      if (applied.has(file)) {
        // Emit a diagnostic log message.
        console.log(`⊘ skip ${file}`);
        // Continue with the next loop iteration.
        continue;
      }

      // Create the sql constant.
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      // Emit a diagnostic log message.
      console.log(`→ ${file}`);

      // One transaction per file: DDL + schema_migrations insert, or full rollback.
      await client.query('BEGIN');
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await client.query(sql);
        // Wait until the asynchronous operation resolves.
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        // Wait until the asynchronous operation resolves.
        await client.query('COMMIT');
        // Update appliedCount with the right-hand side value.
        appliedCount += 1;
      // Continue the surrounding logic with this statement.
      } catch (err) {
        // Wait until the asynchronous operation resolves.
        await client.query('ROLLBACK');
        // Throw an error to stop the current control flow.
        throw err;
      }
    }

    // Evaluate the condition and enter the branch when it is true.
    if (appliedCount === 0) {
      // Emit a diagnostic log message.
      console.log('✓ Database is up to date');
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Emit a diagnostic log message.
      console.log(`✓ Applied ${appliedCount} migration(s)`);
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
  // Call migrate to perform this step.
  migrate().catch((err) => {
    // Emit a diagnostic log message.
    console.error('Migration failed:', err.message);
    // Call process.exit to perform this step.
    process.exit(1);
  });
}

// Assign the CommonJS module exports.
module.exports = { migrate };
