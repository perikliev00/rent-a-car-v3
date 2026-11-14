#!/usr/bin/env node
/**
 * Restores a plain SQL backup using psql after dropping the public schema.
 * Development only — requires --confirm or FORCE_DB_RESTORE=1.
 *
 * Usage: node sql/restore.js --file=backups/luxride_....sql --confirm
 *        node sql/restore.js --latest --confirm
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { dropPublicSchema } = require('./reset');
const {
  assertDevelopmentOnly,
  parseCliArgs,
  requireDatabaseUrl,
  requireDestructiveConfirmation,
  resolveLatestBackup,
  resolvePgBinary,
  runCommand,
} = require('./dbCliUtils');

/**
 * psql argv for restoring a plain SQL dump; aborts on the first SQL error.
 *
 * @param {string} databaseUrl
 * @param {string} backupFile - Absolute path to the .sql dump
 * @returns {string[]}
 */
function buildPsqlRestoreArgs(databaseUrl, backupFile) {
  return ['--dbname', databaseUrl, '-v', 'ON_ERROR_STOP=1', '--file', backupFile];
}

/**
 * Restore a plain SQL backup using psql.
 *
 * @param {*} [argv] - argv = process.argv.slice(2)
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function restore(argv = process.argv.slice(2)) {
  assertDevelopmentOnly('db:restore');

  const options = parseCliArgs(argv);
  requireDestructiveConfirmation('db:restore', options);

  const databaseUrl = requireDatabaseUrl();
  let backupFile = options.file;

  if (options.latest) {
    backupFile = resolveLatestBackup();
  }

  if (!backupFile) {
    throw new Error('Restore requires --file=path/to/backup.sql or --latest');
  }

  const resolvedBackup = path.resolve(backupFile);
  if (!fs.existsSync(resolvedBackup)) {
    throw new Error(`Backup file not found: ${resolvedBackup}`);
  }

  const psql = resolvePgBinary('psql');

  await dropPublicSchema();

  console.log(`→ restoring from ${resolvedBackup}`);
  // ON_ERROR_STOP=1: psql exits non-zero (code 3) on the first SQL error instead of
  // continuing and reporting success for a half-restored database.
  await runCommand(psql, buildPsqlRestoreArgs(databaseUrl, resolvedBackup), {
    inheritStdio: true,
  });

  console.log('✓ Database restored successfully');
}

if (require.main === module) {
  restore().catch((err) => {
    console.error('Restore failed:', err.message);
    process.exit(1);
  });
}

module.exports = { restore, buildPsqlRestoreArgs };
