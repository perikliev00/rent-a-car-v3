#!/usr/bin/env node
/**
 * Restores a plain SQL backup using psql after dropping the public schema.
 * Development only — requires --confirm or FORCE_DB_RESTORE=1.
 *
 * Usage: node sql/restore.js --file=backups/luxride_....sql --confirm
 *        node sql/restore.js --latest --confirm
 */
require('dotenv').config();

// Require the 'fs' module as fs.
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { dropPublicSchema } = require('./reset');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertDevelopmentOnly,
  // Contribute this line to the enclosing declaration or statement.
  parseCliArgs,
  // Contribute this line to the enclosing declaration or statement.
  requireDatabaseUrl,
  // Contribute this line to the enclosing declaration or statement.
  requireDestructiveConfirmation,
  // Contribute this line to the enclosing declaration or statement.
  resolveLatestBackup,
  // Contribute this line to the enclosing declaration or statement.
  resolvePgBinary,
  // Contribute this line to the enclosing declaration or statement.
  runCommand,
// Continue the surrounding logic with this statement.
} = require('./dbCliUtils');

/**
 * Restore a plain SQL backup using psql.
 *
 * @param {*} [argv] - argv = process.argv.slice(2)
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function restore(argv = process.argv.slice(2)) {
  // Call assertDevelopmentOnly to perform this step.
  assertDevelopmentOnly('db:restore');

  // Create the options constant.
  const options = parseCliArgs(argv);
  // Call requireDestructiveConfirmation to perform this step.
  requireDestructiveConfirmation('db:restore', options);

  // Create the database url constant.
  const databaseUrl = requireDatabaseUrl();
  // Initialize the mutable backup file variable.
  let backupFile = options.file;

  // Evaluate the condition and enter the branch when it is true.
  if (options.latest) {
    // Update backupFile with the right-hand side value.
    backupFile = resolveLatestBackup();
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!backupFile) {
    // Throw an error to stop the current control flow.
    throw new Error('Restore requires --file=path/to/backup.sql or --latest');
  }

  // Create the resolved backup constant.
  const resolvedBackup = path.resolve(backupFile);
  // Evaluate the condition and enter the branch when it is true.
  if (!fs.existsSync(resolvedBackup)) {
    // Throw an error to stop the current control flow.
    throw new Error(`Backup file not found: ${resolvedBackup}`);
  }

  // Create the psql constant.
  const psql = resolvePgBinary('psql');

  // Wait until the asynchronous operation resolves.
  await dropPublicSchema();

  // Emit a diagnostic log message.
  console.log(`→ restoring from ${resolvedBackup}`);
  // Wait until the asynchronous operation resolves.
  await runCommand(psql, ['--dbname', databaseUrl, '--file', resolvedBackup], {
    // Provide the inherit stdio field value.
    inheritStdio: true,
  });

  // Emit a diagnostic log message.
  console.log('✓ Database restored successfully');
}

// Evaluate the condition and enter the branch when it is true.
if (require.main === module) {
  // Call restore to perform this step.
  restore().catch((err) => {
    // Emit a diagnostic log message.
    console.error('Restore failed:', err.message);
    // Call process.exit to perform this step.
    process.exit(1);
  });
}

// Assign the CommonJS module exports.
module.exports = { restore };
