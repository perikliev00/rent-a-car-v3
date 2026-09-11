const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('node:url');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  return databaseUrl;
}

function assertDevelopmentOnly(command) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${command} is disabled when NODE_ENV=production`);
  }
}

function parseDatabaseUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolvePgBinary(name) {
  const binary = process.platform === 'win32' ? `${name}.exe` : name;
  const pathEntries = (process.env.PATH || '').split(path.delimiter);

  for (const entry of pathEntries) {
    const candidate = path.join(entry, binary);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const dockerHint =
    'PostgreSQL client tools not found in PATH. ' +
    'Install them locally or use Docker, e.g.:\n' +
    '  docker compose -f docker-compose.dev.yml exec -T db pg_dump -U luxride luxride > backup.sql';

  const err = new Error(`${name} not found. ${dockerHint}`);
  err.code = 'PG_BINARY_NOT_FOUND';
  throw err;
}

function runCommand(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: options.inheritStdio ? 'inherit' : 'pipe',
      env: { ...process.env, ...options.env },
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    if (!options.inheritStdio) {
      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const err = new Error(
        `${path.basename(bin)} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`
      );
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function parseCliArgs(argv) {
  const options = {
    confirm: false,
    file: null,
    latest: false,
    out: null,
  };

  for (const arg of argv) {
    if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--latest') {
      options.latest = true;
    } else if (arg.startsWith('--file=')) {
      options.file = arg.slice('--file='.length);
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    }
  }

  return options;
}

function requireDestructiveConfirmation(command, options) {
  const forced =
    process.env.FORCE_DB_RESET === '1' ||
    process.env.FORCE_DB_RESET === 'true' ||
    process.env.FORCE_DB_RESTORE === '1' ||
    process.env.FORCE_DB_RESTORE === 'true';

  if (options.confirm || forced) {
    return;
  }

  throw new Error(
    `${command} requires confirmation. Pass --confirm or set FORCE_DB_RESET=1 / FORCE_DB_RESTORE=1.`
  );
}

function resolveLatestBackup() {
  ensureDir(BACKUPS_DIR);

  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({
      name,
      fullPath: path.join(BACKUPS_DIR, name),
      mtime: fs.statSync(path.join(BACKUPS_DIR, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (!files.length) {
    throw new Error(`No backup files found in ${BACKUPS_DIR}`);
  }

  return files[0].fullPath;
}

module.exports = {
  BACKUPS_DIR,
  requireDatabaseUrl,
  assertDevelopmentOnly,
  parseDatabaseUrl,
  ensureDir,
  resolvePgBinary,
  runCommand,
  formatTimestamp,
  parseCliArgs,
  requireDestructiveConfirmation,
  resolveLatestBackup,
};
