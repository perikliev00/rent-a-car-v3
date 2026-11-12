#!/usr/bin/env node
/**
 * Create or align the least-privilege application role and grant DML only.
 * Run with the migration/bootstrap connection, never with the runtime role.
 * The password is read from APP_DB_PASSWORD and is not written to logs.
 */
const { Client } = require('pg');

const RUNTIME_ROLE_NAME = 'luxride_app';
const RUNTIME_ROLE_ATTRIBUTES = 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT';

/**
 * Privilege statements applied after the role exists.
 * Identifiers are fixed constants; the database name is validated by the caller.
 *
 * @param {string} databaseName
 * @returns {string[]}
 */
function runtimePrivilegeStatements(databaseName) {
  return [
    `GRANT CONNECT ON DATABASE ${databaseName} TO ${RUNTIME_ROLE_NAME}`,
    `GRANT USAGE ON SCHEMA public TO ${RUNTIME_ROLE_NAME}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RUNTIME_ROLE_NAME}`,
    `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.schema_migrations FROM ${RUNTIME_ROLE_NAME}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RUNTIME_ROLE_NAME}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${RUNTIME_ROLE_NAME}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${RUNTIME_ROLE_NAME}`,
    `REVOKE CREATE ON SCHEMA public FROM ${RUNTIME_ROLE_NAME}`,
  ];
}

/**
 * @param {string} databaseName
 * @returns {boolean}
 */
function isSafeIdentifier(databaseName) {
  return typeof databaseName === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseName);
}

/**
 * @param {import('pg').Client | import('pg').PoolClient} client
 * @param {string} password
 * @returns {Promise<void>}
 */
async function ensureRuntimeRole(client, password) {
  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('APP_DB_PASSWORD must be at least 16 characters');
  }

  const quoted = await client.query('SELECT quote_literal($1) AS literal', [password]);
  const passwordLiteral = quoted.rows[0] && quoted.rows[0].literal;
  if (typeof passwordLiteral !== 'string' || !/^'(?:''|[^'])*'$/.test(passwordLiteral)) {
    throw new Error('Could not quote the runtime role password');
  }

  const existing = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [
    RUNTIME_ROLE_NAME,
  ]);
  const statement =
    existing.rowCount > 0
      ? `ALTER ROLE ${RUNTIME_ROLE_NAME} WITH ${RUNTIME_ROLE_ATTRIBUTES} PASSWORD ${passwordLiteral}`
      : `CREATE ROLE ${RUNTIME_ROLE_NAME} WITH ${RUNTIME_ROLE_ATTRIBUTES} PASSWORD ${passwordLiteral}`;
  await client.query(statement);

  const database = await client.query('SELECT current_database() AS name');
  const databaseName = database.rows[0] && database.rows[0].name;
  if (!isSafeIdentifier(databaseName)) {
    throw new Error('Refusing to grant privileges on an unexpected database name');
  }

  for (const sql of runtimePrivilegeStatements(databaseName)) {
    await client.query(sql);
  }
}

async function main() {
  require('dotenv').config();
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await ensureRuntimeRole(client, process.env.APP_DB_PASSWORD || '');
    console.log(`Runtime role ${RUNTIME_ROLE_NAME} is restricted to DML`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Runtime role setup failed:', err.message);
    process.exit(1);
  });
}

module.exports = {
  RUNTIME_ROLE_NAME,
  RUNTIME_ROLE_ATTRIBUTES,
  runtimePrivilegeStatements,
  isSafeIdentifier,
  ensureRuntimeRole,
};
