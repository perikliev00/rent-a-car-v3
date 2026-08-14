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
  await runCommand(psql, ['--dbname', databaseUrl, '--file', resolvedBackup], {
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

module.exports = { restore };
