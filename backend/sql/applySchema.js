#!/usr/bin/env node
/**
 * Applies all SQL schema files from sql/schema/ in sorted order.
 * Usage: node sql/applySchema.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');
const { requireDatabaseUrl } = require('./dbCliUtils');
const { acquireDbSetupLock, releaseDbSetupLock } = require('./dbSetupLock');

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
  const ledger = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
    ) AS present
  `);
  if (!ledger.rows[0] || ledger.rows[0].present !== true) return false;
  const applied = await client.query('SELECT 1 FROM schema_migrations LIMIT 1');
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
  if (await hasAppliedMigrations(client)) {
    return { skipped: true, applied: 0 };
  }

  const files = readSchemaFiles ? readSchemaFiles() : readSchemaFilesFromDisk();
  if (!files.length) {
    throw new Error(`No schema files found in ${SCHEMA_DIR}`);
  }

  for (const file of files) {
    console.log(`→ ${file.name}`);
    await client.query(file.sql);
  }
  return { skipped: false, applied: files.length };
}

/**
 * Read sql/schema/*.sql in lexicographic order.
 * @returns {Array<{ name: string, sql: string }>}
 */
function readSchemaFilesFromDisk() {
  return fs
    .readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
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

  const client = await pool.connect();
  let locked = false;

  try {
    // Serialize with migrate so concurrent containers do not interleave DDL.
    await acquireDbSetupLock(client);
    locked = true;

    const result = await applyFreshSchemaIfNeeded(client);
    if (result.skipped) {
      console.log('Existing database detected; skipping fresh schema seed');
    } else {
      console.log('✓ Schema applied successfully');
    }
  } finally {
    // Always unlock and release; optionally end the process pool for CLI mode.
    if (locked) {
      try {
        await releaseDbSetupLock(client);
      } catch {
        // ignore unlock errors on teardown
      }
    }
    client.release();
    if (endPool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  applySchema().catch((err) => {
    console.error('Schema apply failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  applySchema,
  hasAppliedMigrations,
  applyFreshSchemaIfNeeded,
};
