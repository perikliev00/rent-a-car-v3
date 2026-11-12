/**
 * Shared helpers for DB CLI tooling (backup, restore, reset, migrate, seed).
 * Covers DATABASE_URL checks, pg binary resolution, and destructive-action confirmation.
 */

const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Destructure object properties into local variables.
const { spawn } = require('child_process');
// Destructure object properties into local variables.
const { URL } = require('node:url');

/** Directory where plain SQL backups are written by default. */
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

/**
 * @returns {string}
 * @throws {Error} when DATABASE_URL is unset
 */
function requireDatabaseUrl() {
  // Create the database url constant.
  const databaseUrl = process.env.DATABASE_URL;
  // Evaluate the condition and enter the branch when it is true.
  if (!databaseUrl) {
    // Throw an error to stop the current control flow.
    throw new Error('DATABASE_URL is required');
  }
  // Return the resulting value to the caller.
  return databaseUrl;
}

/**
 * Block destructive CLI commands when NODE_ENV=production.
 * @param {string} command
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function assertDevelopmentOnly(command) {
  // Evaluate the condition and enter the branch when it is true.
  if (process.env.NODE_ENV === 'production') {
    // Throw an error to stop the current control flow.
    throw new Error(`${command} is disabled when NODE_ENV=production`);
  }
}

/**
 * @param {string} databaseUrl
 * @returns {{ host: string, port: string, database: string, user: string, password: string }}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function parseDatabaseUrl(databaseUrl) {
  // Create the parsed constant.
  const parsed = new URL(databaseUrl);
  // Return the resulting value to the caller.
  return {
    // Provide the host field value.
    host: parsed.hostname,
    // Provide the port field value.
    port: parsed.port || '5432',
    // Provide the database field value.
    database: parsed.pathname.replace(/^\//, ''),
    // Provide the user field value.
    user: decodeURIComponent(parsed.username),
    // Provide the password field value.
    password: decodeURIComponent(parsed.password),
  };
}

/**
 * Create a directory (and parents) if it does not exist.
 *
 * @param {string} dirPath - Absolute or relative directory path
 * @returns {void}
 * @throws {Error} When mkdirSync fails (permissions, invalid path, …)
 */
function ensureDir(dirPath) {
  // Call fs.mkdirSync to perform this step.
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Resolve `pg_dump` / `psql` from PATH (adds `.exe` on Windows).
 *
 * @param {string} name
 * @returns {string} Absolute path to the binary
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function resolvePgBinary(name) {
  // Create the binary constant.
  const binary = process.platform === 'win32' ? `${name}.exe` : name;
  // Create the path entries constant.
  const pathEntries = (process.env.PATH || '').split(path.delimiter);

  // Iterate using the loop initializer, condition, and step.
  for (const entry of pathEntries) {
    // Create the candidate constant.
    const candidate = path.join(entry, binary);
    // Evaluate the condition and enter the branch when it is true.
    if (fs.existsSync(candidate)) {
      // Return the resulting value to the caller.
      return candidate;
    }
  }

  // Create the docker hint constant.
  const dockerHint =
    // Supply the literal value used by the enclosing expression.
    'PostgreSQL client tools not found in PATH. ' +
    // Supply the literal value used by the enclosing expression.
    'Install them locally or use Docker, e.g.:\n' +
    // Continue the surrounding logic with this statement.
    '  docker compose -f docker-compose.dev.yml exec -T db pg_dump -U luxride luxride > backup.sql';

  // Create the err constant.
  const err = new Error(`${name} not found. ${dockerHint}`);
  // Update err.code with the right-hand side value.
  err.code = 'PG_BINARY_NOT_FOUND';
  // Throw an error to stop the current control flow.
  throw err;
}

/**
 * Spawn a child process and resolve on exit code 0.
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {{ inheritStdio?: boolean, env?: NodeJS.ProcessEnv }} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function runCommand(bin, args, options = {}) {
  // Return the resulting value to the caller.
  return new Promise((resolve, reject) => {
    // Create the child constant.
    const child = spawn(bin, args, {
      // Provide the stdio field value.
      stdio: options.inheritStdio ? 'inherit' : 'pipe',
      // Provide the env field value.
      env: { ...process.env, ...options.env },
      // Provide the shell field value.
      shell: false,
    });

    // Initialize the mutable stdout variable.
    let stdout = '';
    // Initialize the mutable stderr variable.
    let stderr = '';

    // Evaluate the condition and enter the branch when it is true.
    if (!options.inheritStdio) {
      // Continue the surrounding logic with this statement.
      child.stdout?.on('data', (chunk) => {
        // Update stdout with the right-hand side value.
        stdout += chunk.toString();
      });
      // Continue the surrounding logic with this statement.
      child.stderr?.on('data', (chunk) => {
        // Update stderr with the right-hand side value.
        stderr += chunk.toString();
      });
    }

    // Call child.on to perform this step.
    child.on('error', reject);
    // Call child.on to perform this step.
    child.on('close', (code) => {
      // Evaluate the condition and enter the branch when it is true.
      if (code === 0) {
        // Call resolve to perform this step.
        resolve({ stdout, stderr });
        // Return control to the caller with the following value.
        return;
      }

      // Create the err constant.
      const err = new Error(
        // Continue the surrounding logic with this statement.
        `${path.basename(bin)} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`
      );
      // Update err.stdout with the right-hand side value.
      err.stdout = stdout;
      // Update err.stderr with the right-hand side value.
      err.stderr = stderr;
      // Call reject to perform this step.
      reject(err);
    });
  });
}

/**
 * Filename-friendly timestamp: `YYYY-MM-DD_HH-mm-ss`.
 * @param {Date} [date]
 * @returns {string}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function formatTimestamp(date = new Date()) {
  // Create the pad constant.
  const pad = (value) => String(value).padStart(2, '0');
  // Return the resulting value to the caller.
  return [
    // Call date.getFullYear to perform this step.
    date.getFullYear(),
    // Call pad to perform this step.
    pad(date.getMonth() + 1),
    // Call pad to perform this step.
    pad(date.getDate()),
  // Continue the surrounding logic with this statement.
  ].join('-') + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

/**
 * Parse common CLI flags used by backup/restore/reset scripts.
 *
 * @param {string[]} argv
 * @returns {{ confirm: boolean, file: string | null, latest: boolean, out: string | null }}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function parseCliArgs(argv) {
  // Create the options constant.
  const options = {
    // Provide the confirm field value.
    confirm: false,
    // Provide the file field value.
    file: null,
    // Provide the latest field value.
    latest: false,
    // Provide the out field value.
    out: null,
  };

  // Iterate using the loop initializer, condition, and step.
  for (const arg of argv) {
    // Evaluate the condition and enter the branch when it is true.
    if (arg === '--confirm') {
      // Update options.confirm with the right-hand side value.
      options.confirm = true;
    // Continue the surrounding logic with this statement.
    } else if (arg === '--latest') {
      // Update options.latest with the right-hand side value.
      options.latest = true;
    // Continue the surrounding logic with this statement.
    } else if (arg.startsWith('--file=')) {
      // Update options.file with the right-hand side value.
      options.file = arg.slice('--file='.length);
    // Continue the surrounding logic with this statement.
    } else if (arg.startsWith('--out=')) {
      // Update options.out with the right-hand side value.
      options.out = arg.slice('--out='.length);
    }
  }

  // Return the resulting value to the caller.
  return options;
}

/**
 * Require `--confirm` or FORCE_DB_RESET / FORCE_DB_RESTORE env for destructive ops.
 *
 * @param {string} command
 * @param {{ confirm?: boolean }} options
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function requireDestructiveConfirmation(command, options) {
  // Create the forced constant.
  const forced =
    // Update process.env.FORCE_DB_RESET with the right-hand side value.
    process.env.FORCE_DB_RESET === '1' ||
    // Update process.env.FORCE_DB_RESET with the right-hand side value.
    process.env.FORCE_DB_RESET === 'true' ||
    // Update process.env.FORCE_DB_RESTORE with the right-hand side value.
    process.env.FORCE_DB_RESTORE === '1' ||
    // Update process.env.FORCE_DB_RESTORE with the right-hand side value.
    process.env.FORCE_DB_RESTORE === 'true';

  // Evaluate the condition and enter the branch when it is true.
  if (options.confirm || forced) {
    // Return control to the caller with the following value.
    return;
  }

  // Throw an error to stop the current control flow.
  throw new Error(
    // Continue the surrounding logic with this statement.
    `${command} requires confirmation. Pass --confirm or set FORCE_DB_RESET=1 / FORCE_DB_RESTORE=1.`
  );
}

/**
 * Newest `*.sql` file under BACKUPS_DIR by mtime.
 * @returns {string} Absolute path
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function resolveLatestBackup() {
  // Call ensureDir to perform this step.
  ensureDir(BACKUPS_DIR);

  // Create the files constant.
  const files = fs
    // Call .readdirSync to perform this step.
    .readdirSync(BACKUPS_DIR)
    // Call .filter to perform this step.
    .filter((name) => name.endsWith('.sql'))
    // Call .map to perform this step.
    .map((name) => ({
      // Contribute this line to the enclosing declaration or statement.
      name,
      // Provide the full path field value.
      fullPath: path.join(BACKUPS_DIR, name),
      // Provide the mtime field value.
      mtime: fs.statSync(path.join(BACKUPS_DIR, name)).mtimeMs,
    }))
    // Call .sort to perform this step.
    .sort((a, b) => b.mtime - a.mtime);

  // Evaluate the condition and enter the branch when it is true.
  if (!files.length) {
    // Throw an error to stop the current control flow.
    throw new Error(`No backup files found in ${BACKUPS_DIR}`);
  }

  // Return the resulting value to the caller.
  return files[0].fullPath;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  BACKUPS_DIR,
  // Contribute this line to the enclosing declaration or statement.
  requireDatabaseUrl,
  // Contribute this line to the enclosing declaration or statement.
  assertDevelopmentOnly,
  // Contribute this line to the enclosing declaration or statement.
  parseDatabaseUrl,
  // Contribute this line to the enclosing declaration or statement.
  ensureDir,
  // Contribute this line to the enclosing declaration or statement.
  resolvePgBinary,
  // Contribute this line to the enclosing declaration or statement.
  runCommand,
  // Contribute this line to the enclosing declaration or statement.
  formatTimestamp,
  // Contribute this line to the enclosing declaration or statement.
  parseCliArgs,
  // Contribute this line to the enclosing declaration or statement.
  requireDestructiveConfirmation,
  // Contribute this line to the enclosing declaration or statement.
  resolveLatestBackup,
};
