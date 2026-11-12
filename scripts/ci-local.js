#!/usr/bin/env node
/**
 * Local CI gate — mirrors `.github/workflows/ci.yml` required checks.
 *
 * Usage: npm run ci:local
 *
 * Provisions an ephemeral PostgreSQL (unique Compose project + random host port)
 * so concurrent ci:local runs cannot share DB state. Holds a repo lock so E2E
 * fixed ports (3000/5173/5174) do not collide across concurrent invocations.
 *
 * Any failed step, crash, timeout, or missing dependency exits non-zero.
 * There is no skip/bypass for failing checks.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const lockPath = path.join(repoRoot, '.ci-local.lock');
const composeFile = path.join(repoRoot, 'docker-compose.ci.yml');

const EXPECTED_NODE_MAJOR = 22;

const CI_COMMON_ENV = {
  STRIPE_STUB: '1',
  EMAIL_ENABLED: 'false',
  STRIPE_SECRET: 'sk_test_ci_placeholder_key_123456789012',
  STRIPE_WEBHOOK_SECRET: 'whsec_ci_placeholder_secret',
  SESSION_SECRET: 'test-session-secret-32-chars-minimum!!',
  FRONTEND_BASE_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174',
  CI: 'true',
};

/** @type {{ project: string | null, lockHeld: boolean, results: Array<{ name: string, ok: boolean, ms: number }> }} */
const state = {
  project: null,
  lockHeld: false,
  results: [],
};

function nowMs() {
  return Date.now();
}

function log(msg) {
  console.log(msg);
}

function fail(message, code = 1) {
  console.error(`\n✗ ${message}`);
  cleanup();
  printSummary();
  process.exit(code);
}

function printSummary() {
  if (state.results.length === 0) return;
  log('\n──────── ci:local summary ────────');
  for (const r of state.results) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    log(`  [${mark}] ${r.name} (${(r.ms / 1000).toFixed(1)}s)`);
  }
  log('──────────────────────────────────');
}

function cleanup() {
  if (state.project) {
    log(`\nTearing down Postgres project ${state.project}…`);
    spawnSync(
      'docker',
      ['compose', '-p', state.project, '-f', composeFile, 'down', '-v', '--remove-orphans'],
      { cwd: repoRoot, stdio: 'inherit', shell: false }
    );
    state.project = null;
  }
  releaseLock();
}

function acquireLock() {
  const payload = `${process.pid}\n${new Date().toISOString()}\n`;
  try {
    fs.writeFileSync(lockPath, payload, { flag: 'wx' });
    state.lockHeld = true;
    return;
  } catch (err) {
    if (!err || err.code !== 'EEXIST') throw err;
  }

  let stale = false;
  try {
    const existing = fs.readFileSync(lockPath, 'utf8');
    const pid = Number(String(existing).split(/\r?\n/)[0]);
    if (!Number.isFinite(pid) || pid <= 0) {
      stale = true;
    } else if (process.platform === 'win32') {
      const check = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], {
        encoding: 'utf8',
        shell: false,
      });
      const out = `${check.stdout || ''}`;
      stale = !out.includes(String(pid));
    } else {
      try {
        process.kill(pid, 0);
        stale = false;
      } catch {
        stale = true;
      }
    }
  } catch {
    stale = true;
  }

  if (stale) {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // ignore
    }
    fs.writeFileSync(lockPath, payload, { flag: 'wx' });
    state.lockHeld = true;
    return;
  }

  fail(
    `Another ci:local run holds ${path.relative(repoRoot, lockPath)}. ` +
      'Wait for it to finish (prevents Postgres/port interference).',
    1
  );
}

function releaseLock() {
  if (!state.lockHeld) return;
  try {
    const existing = fs.readFileSync(lockPath, 'utf8');
    const pid = Number(String(existing).split(/\r?\n/)[0]);
    if (pid === process.pid) fs.unlinkSync(lockPath);
  } catch {
    // ignore
  }
  state.lockHeld = false;
}

/**
 * @param {string} name
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string, string>, shell?: boolean }} [opts]
 */
function runStep(name, command, args, opts = {}) {
  log(`\n═══ ${name} ═══`);
  const started = nowMs();
  const result = spawnSync(command, args, {
    cwd: opts.cwd || repoRoot,
    env: { ...process.env, ...(opts.env || {}) },
    stdio: 'inherit',
    shell: opts.shell === true || (process.platform === 'win32' && command === 'npm'),
  });
  const ms = nowMs() - started;
  const ok = result.status === 0 && !result.error;
  state.results.push({ name, ok, ms });
  if (result.error) {
    console.error(result.error);
    fail(`${name}: failed to start process`, 1);
  }
  if (result.status !== 0) {
    fail(`${name}: exited with code ${result.status}`, result.status ?? 1);
  }
  log(`✓ ${name}`);
}

function requireCommand(cmd, hint) {
  const result = spawnSync(cmd, ['--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0 || result.error) {
    fail(`Missing required dependency: ${cmd}. ${hint}`, 1);
  }
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major !== EXPECTED_NODE_MAJOR) {
    console.warn(
      `WARNING: GitHub CI uses Node ${EXPECTED_NODE_MAJOR}; this machine is Node ${process.versions.node}. ` +
        'Prefer Node 22 for equivalent results.'
    );
  }
  if (major < EXPECTED_NODE_MAJOR) {
    fail(`Node ${EXPECTED_NODE_MAJOR}+ required (found ${process.versions.node})`, 1);
  }
}

function requirePackageTree(relDir) {
  const nm = path.join(repoRoot, relDir, 'node_modules');
  if (!fs.existsSync(nm)) {
    fail(
      `Missing ${relDir}/node_modules. Run: npm --prefix "${relDir}" ci`,
      1
    );
  }
}

function dockerCompose(args, opts = {}) {
  return spawnSync('docker', ['compose', '-p', state.project, '-f', composeFile, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: opts.stdio || 'pipe',
    shell: false,
    env: { ...process.env, ...(opts.env || {}) },
  });
}

function startPostgres() {
  const suffix = crypto.randomBytes(4).toString('hex');
  state.project = `luxrideci${process.pid}${suffix}`;
  log(`\n═══ postgres (project=${state.project}) ═══`);

  const up = dockerCompose(['up', '-d', '--wait'], { stdio: 'inherit' });
  if (up.status !== 0) {
    fail('Failed to start ephemeral PostgreSQL via docker compose', up.status ?? 1);
  }

  const portResult = dockerCompose(['port', 'postgres', '5432']);
  if (portResult.status !== 0) {
    fail(`docker compose port failed: ${portResult.stderr || portResult.stdout}`, 1);
  }
  const portLine = String(portResult.stdout || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .pop();
  const match = portLine && portLine.match(/:(\d+)\s*$/);
  if (!match) {
    fail(`Could not parse Postgres host port from: ${portLine}`, 1);
  }
  const hostPort = match[1];

  const migrateCreate = dockerCompose(
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'luxride',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      "CREATE DATABASE luxride_migrate OWNER luxride;",
    ],
    { stdio: 'pipe' }
  );
  if (migrateCreate.status !== 0) {
    const err = `${migrateCreate.stderr || ''}${migrateCreate.stdout || ''}`;
    if (!/already exists/i.test(err)) {
      fail(`Failed to create luxride_migrate: ${err}`, migrateCreate.status ?? 1);
    }
  }

  const base = `postgres://luxride:luxride@127.0.0.1:${hostPort}`;
  log(`✓ postgres ready on 127.0.0.1:${hostPort}`);
  return {
    testUrl: `${base}/luxride_test`,
    migrateUrl: `${base}/luxride_migrate`,
  };
}

function runGitleaks() {
  const name = 'security-scan / gitleaks';
  log(`\n═══ ${name} ═══`);
  const started = nowMs();

  // Prefer local binary; fall back to the official image (same tool family as gitleaks-action).
  const local = spawnSync('gitleaks', ['version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  let result;
  if (local.status === 0 && !local.error) {
    result = spawnSync('gitleaks', ['detect', '--source', repoRoot, '--verbose', '--redact', '-c', path.join(repoRoot, '.gitleaks.toml')], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  } else {
    const mount = process.platform === 'win32' ? repoRoot.replace(/\\/g, '/') : repoRoot;
    result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${mount}:/repo`,
        '-w',
        '/repo',
        'zricethezav/gitleaks:v8.28.0',
        'detect',
        '--source=/repo',
        '--verbose',
        '--redact',
        '-c',
        '/repo/.gitleaks.toml',
      ],
      { cwd: repoRoot, stdio: 'inherit', shell: false }
    );
  }

  const ms = nowMs() - started;
  const ok = result.status === 0 && !result.error;
  state.results.push({ name, ok, ms });
  if (result.error) {
    console.error(result.error);
    fail(`${name}: failed to start`, 1);
  }
  if (result.status !== 0) {
    fail(`${name}: exited with code ${result.status}`, result.status ?? 1);
  }
  log(`✓ ${name}`);
}

function main() {
  process.on('SIGINT', () => fail('Interrupted', 130));
  process.on('SIGTERM', () => fail('Terminated', 143));
  process.on('uncaughtException', (err) => {
    console.error(err);
    fail(`Uncaught exception: ${err.message}`, 1);
  });

  log('ci:local — reproducing GitHub CI required checks');
  checkNodeVersion();
  requireCommand('npm', 'Install Node.js 22+ with npm.');
  requireCommand('docker', 'Install Docker Desktop / Engine and ensure the daemon is running.');

  requirePackageTree('backend');
  requirePackageTree('front end');
  requirePackageTree('admin-front-end');
  requirePackageTree('e2e');

  if (!fs.existsSync(composeFile)) {
    fail(`Missing ${composeFile}`, 1);
  }

  acquireLock();

  // ── Jobs that do not need Postgres (order mirrors workflow readability) ──
  runStep('backend-lint', 'npm', ['run', 'lint'], { cwd: path.join(repoRoot, 'backend') });
  runStep('backend-unit', 'npm', ['run', 'test:coverage'], { cwd: path.join(repoRoot, 'backend') });

  runStep('frontend / check', 'npm', ['run', 'check'], {
    cwd: path.join(repoRoot, 'front end'),
  });
  runStep('frontend / test:coverage', 'npm', ['run', 'test:coverage'], {
    cwd: path.join(repoRoot, 'front end'),
  });
  runStep('frontend / build', 'npm', ['run', 'build'], {
    cwd: path.join(repoRoot, 'front end'),
  });

  runStep('frontend-admin / check', 'npm', ['run', 'check'], {
    cwd: path.join(repoRoot, 'admin-front-end'),
  });
  runStep('frontend-admin / test:coverage', 'npm', ['run', 'test:coverage'], {
    cwd: path.join(repoRoot, 'admin-front-end'),
  });
  runStep('frontend-admin / build', 'npm', ['run', 'build'], {
    cwd: path.join(repoRoot, 'admin-front-end'),
  });

  runGitleaks();

  runStep('security-scan / npm audit (backend)', 'npm', ['audit', '--audit-level=high'], {
    cwd: path.join(repoRoot, 'backend'),
  });
  runStep('security-scan / npm audit (front end)', 'npm', ['audit', '--audit-level=high'], {
    cwd: path.join(repoRoot, 'front end'),
  });
  runStep('security-scan / npm audit (admin-front-end)', 'npm', ['audit', '--audit-level=high'], {
    cwd: path.join(repoRoot, 'admin-front-end'),
  });
  runStep('security-scan / npm audit (e2e)', 'npm', ['audit', '--audit-level=high'], {
    cwd: path.join(repoRoot, 'e2e'),
  });

  const db = startPostgres();

  // migration-test
  runStep('migration-test / db:setup', 'npm', ['run', 'db:setup'], {
    cwd: path.join(repoRoot, 'backend'),
    env: { DATABASE_URL: db.migrateUrl },
  });
  runStep('migration-test / db:assert-migrations', 'npm', ['run', 'db:assert-migrations'], {
    cwd: path.join(repoRoot, 'backend'),
    env: { DATABASE_URL: db.migrateUrl },
  });
  runStep('migration-test / db:migrate (idempotent)', 'npm', ['run', 'db:migrate'], {
    cwd: path.join(repoRoot, 'backend'),
    env: { DATABASE_URL: db.migrateUrl },
  });

  // db-consistency
  runStep('db-consistency / db:setup', 'npm', ['run', 'db:setup'], {
    cwd: path.join(repoRoot, 'backend'),
    env: { DATABASE_URL: db.testUrl, ...CI_COMMON_ENV },
  });
  runStep('db-consistency / test:db', 'npm', ['run', 'test:db'], {
    cwd: path.join(repoRoot, 'backend'),
    env: {
      DATABASE_URL: db.testUrl,
      RUN_DB_TESTS: 'true',
      ...CI_COMMON_ENV,
    },
  });

  // integration (schema already applied on luxride_test)
  runStep('integration / test:integration', 'npm', ['run', 'test:integration'], {
    cwd: path.join(repoRoot, 'backend'),
    env: {
      DATABASE_URL: db.testUrl,
      RUN_INTEGRATION_TESTS: '1',
      ...CI_COMMON_ENV,
    },
  });

  // e2e — DATABASE_URL overrides .env.test via load-if-empty semantics
  runStep('e2e / playwright install', 'npm', ['run', 'e2e:install'], {
    env: { DATABASE_URL: db.testUrl, ...CI_COMMON_ENV },
  });
  runStep('e2e / playwright', 'npm', ['run', 'e2e'], {
    env: { DATABASE_URL: db.testUrl, ...CI_COMMON_ENV },
  });
  runStep('e2e / check-flakes', 'npm', ['run', 'e2e:check-flakes'], {
    env: { DATABASE_URL: db.testUrl, ...CI_COMMON_ENV },
  });

  // docker-build (PR-equivalent: build only, no push)
  const tag = `local-${process.pid}`;
  runStep('docker-build / api', 'docker', [
    'build',
    '-t',
    `rentacar-api:${tag}`,
    path.join(repoRoot, 'backend'),
  ]);
  runStep('docker-build / customer', 'docker', [
    'build',
    '--build-arg',
    'VITE_API_BASE_URL=http://localhost:3000',
    '-t',
    `rentacar-customer:${tag}`,
    path.join(repoRoot, 'front end'),
  ]);
  runStep('docker-build / admin', 'docker', [
    'build',
    '--build-arg',
    'VITE_API_BASE_URL=http://localhost:3000',
    '-t',
    `rentacar-admin:${tag}`,
    path.join(repoRoot, 'admin-front-end'),
  ]);

  cleanup();
  printSummary();
  log('\n✓ ci:local passed — all required checks green');
  process.exit(0);
}

main();
