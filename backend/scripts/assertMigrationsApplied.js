#!/usr/bin/env node
/**
 * Assert every *.sql file in migrations/ is recorded in schema_migrations.
 * Run after `npm run db:setup` (or an equivalent migrate path).
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { requireDatabaseUrl } = require('../sql/dbCliUtils');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function main() {
  requireDatabaseUrl();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migration files found in ${MIGRATIONS_DIR}`);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query('SELECT name FROM schema_migrations ORDER BY name');
    const applied = new Set(result.rows.map((row) => row.name));
    const missing = files.filter((file) => !applied.has(file));
    const unexpected = [...applied].filter((name) => !files.includes(name));

    if (missing.length > 0) {
      throw new Error(`Migrations not applied: ${missing.join(', ')}`);
    }
    if (unexpected.length > 0) {
      console.warn(`Warning: schema_migrations has unknown names: ${unexpected.join(', ')}`);
    }

    console.log(`✓ ${files.length} migration(s) recorded in schema_migrations`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
