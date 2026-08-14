#!/usr/bin/env node
/**
 * Creates a plain SQL backup using pg_dump.
 * Usage: node sql/backup.js [--out=path/to/backup.sql]
 */
require('dotenv').config();

const path = require('path');
const {
  BACKUPS_DIR,
  ensureDir,
  formatTimestamp,
  parseCliArgs,
  requireDatabaseUrl,
  resolvePgBinary,
  runCommand,
} = require('./dbCliUtils');

async function backup(argv = process.argv.slice(2)) {
  const databaseUrl = requireDatabaseUrl();
  const options = parseCliArgs(argv);
  const pgDump = resolvePgBinary('pg_dump');

  ensureDir(BACKUPS_DIR);

  const outputPath =
    options.out ||
    path.join(BACKUPS_DIR, `luxride_${formatTimestamp()}.sql`);

  const resolvedOutput = path.resolve(outputPath);
  ensureDir(path.dirname(resolvedOutput));

  console.log(`→ backing up to ${resolvedOutput}`);

  await runCommand(pgDump, [
    '--dbname',
    databaseUrl,
    '--format=plain',
    '--no-owner',
    '--no-acl',
    '--file',
    resolvedOutput,
  ]);

  console.log(`✓ Backup saved: ${resolvedOutput}`);
  return resolvedOutput;
}

if (require.main === module) {
  backup().catch((err) => {
    console.error('Backup failed:', err.message);
    process.exit(1);
  });
}

module.exports = { backup };
