#!/usr/bin/env node
/**
 * Creates a plain SQL backup using pg_dump.
 * Usage: node sql/backup.js [--out=path/to/backup.sql]
 */
require('dotenv').config();

// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  BACKUPS_DIR,
  // Contribute this line to the enclosing declaration or statement.
  ensureDir,
  // Contribute this line to the enclosing declaration or statement.
  formatTimestamp,
  // Contribute this line to the enclosing declaration or statement.
  parseCliArgs,
  // Contribute this line to the enclosing declaration or statement.
  requireDatabaseUrl,
  // Contribute this line to the enclosing declaration or statement.
  resolvePgBinary,
  // Contribute this line to the enclosing declaration or statement.
  runCommand,
// Continue the surrounding logic with this statement.
} = require('./dbCliUtils');

/**
 * Create a plain SQL backup using pg_dump.
 *
 * @param {*} [argv] - argv = process.argv.slice(2)
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function backup(argv = process.argv.slice(2)) {
  // Create the database url constant.
  const databaseUrl = requireDatabaseUrl();
  // Create the options constant.
  const options = parseCliArgs(argv);
  // Create the pg dump constant.
  const pgDump = resolvePgBinary('pg_dump');

  // Call ensureDir to perform this step.
  ensureDir(BACKUPS_DIR);

  // Create the output path constant.
  const outputPath =
    // Contribute this line to the enclosing declaration or statement.
    options.out ||
    // Call path.join to perform this step.
    path.join(BACKUPS_DIR, `luxride_${formatTimestamp()}.sql`);

  // Create the resolved output constant.
  const resolvedOutput = path.resolve(outputPath);
  // Call ensureDir to perform this step.
  ensureDir(path.dirname(resolvedOutput));

  // Emit a diagnostic log message.
  console.log(`→ backing up to ${resolvedOutput}`);

  // Wait until the asynchronous operation resolves.
  await runCommand(pgDump, [
    // Supply the literal value used by the enclosing expression.
    '--dbname',
    // Contribute this line to the enclosing declaration or statement.
    databaseUrl,
    // Continue the surrounding logic with this statement.
    '--format=plain',
    // Supply the literal value used by the enclosing expression.
    '--no-owner',
    // Supply the literal value used by the enclosing expression.
    '--no-acl',
    // Supply the literal value used by the enclosing expression.
    '--file',
    // Contribute this line to the enclosing declaration or statement.
    resolvedOutput,
  ]);

  // Emit a diagnostic log message.
  console.log(`✓ Backup saved: ${resolvedOutput}`);
  // Return the resulting value to the caller.
  return resolvedOutput;
}

// Evaluate the condition and enter the branch when it is true.
if (require.main === module) {
  // Call backup to perform this step.
  backup().catch((err) => {
    // Emit a diagnostic log message.
    console.error('Backup failed:', err.message);
    // Call process.exit to perform this step.
    process.exit(1);
  });
}

// Assign the CommonJS module exports.
module.exports = { backup };
