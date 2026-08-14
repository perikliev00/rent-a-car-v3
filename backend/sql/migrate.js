#!/usr/bin/env node
/**
 * Applies versioned SQL migrations from migrations/ in sorted order.
 * Tracks applied files in schema_migrations — safe to re-run (skips applied).
 *
 * Usage: node sql/migrate.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');
const { requireDatabaseUrl } = require('./dbCliUtils');
const { acquireDbSetupLock, releaseDbSetupLock } = require('./dbSetupLock');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function migrate({ endPool = true } = {}) {
  requireDatabaseUrl();

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  let locked = false;

  try {
    await acquireDbSetupLock(client);
    locked = true;

    await ensureMigrationsTable(client);

    const appliedResult = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.name));

    let appliedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⊘ skip ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`→ ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    if (appliedCount === 0) {
      console.log('✓ Database is up to date');
    } else {
      console.log(`✓ Applied ${appliedCount} migration(s)`);
    }
  } finally {
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
  migrate().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { migrate };
