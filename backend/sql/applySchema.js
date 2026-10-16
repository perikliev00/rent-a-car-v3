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
 * Apply all SQL schema files from sql/schema/ in sorted order under the setup lock.
 *
 * @param {object} options - { endPool = true } = {}
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function applySchema({ endPool = true } = {}) {
  // Fail fast when DATABASE_URL is missing.
  requireDatabaseUrl();

  // Lexicographic order keeps schema fragments deterministic.
  const files = fs
    .readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (!files.length) {
    throw new Error(`No schema files found in ${SCHEMA_DIR}`);
  }

  const client = await pool.connect();
  let locked = false;

  try {
    // Serialize with migrate so concurrent containers do not interleave DDL.
    await acquireDbSetupLock(client);
    locked = true;

    for (const file of files) {
      const sql = fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8');
      console.log(`→ ${file}`);
      await client.query(sql);
    }
    console.log('✓ Schema applied successfully');
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

module.exports = { applySchema };
