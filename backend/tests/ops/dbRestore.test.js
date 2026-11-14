/**
 * B7: `sql/restore.js` must fail loudly (non-zero exit, no success banner) when the SQL dump
 * contains an error. Live tests ONLY ever touch freshly created disposable databases named
 * `luxride_restore_b7_*`; they are skipped unless RUN_INTEGRATION_TESTS=1, DATABASE_URL points at a
 * server we may create databases on, and psql is installed.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { URL } = require('url');
const { Client } = require('pg');

const backendRoot = path.join(__dirname, '..', '..');
const restoreScript = path.join(backendRoot, 'sql', 'restore.js');
const DISPOSABLE_PREFIX = 'luxride_restore_b7_';

function findPgBinDir() {
  const exe = (name) => (process.platform === 'win32' ? `${name}.exe` : name);
  const candidates = [];
  if (process.env.PG_BIN_DIR) candidates.push(process.env.PG_BIN_DIR);
  for (const entry of (process.env.PATH || '').split(path.delimiter)) {
    if (entry) candidates.push(entry);
  }
  if (process.platform === 'win32') {
    const root = 'C:\\Program Files\\PostgreSQL';
    if (fs.existsSync(root)) {
      for (const version of fs.readdirSync(root).sort().reverse()) {
        candidates.push(path.join(root, version, 'bin'));
      }
    }
  }
  return candidates.find((dir) => fs.existsSync(path.join(dir, exe('psql')))) || null;
}

const pgBinDir = findPgBinDir();
const adminUrl = process.env.DATABASE_URL || '';
const runLive = process.env.RUN_INTEGRATION_TESTS === '1' && Boolean(adminUrl) && Boolean(pgBinDir);
const describeLive = runLive ? describe : describe.skip;

function urlForDatabase(baseUrl, dbName) {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

function assertDisposable(dbName) {
  if (!dbName.startsWith(DISPOSABLE_PREFIX)) {
    throw new Error(`Refusing to touch non-disposable database: ${dbName}`);
  }
}

async function withAdminClient(work) {
  const client = new Client({ connectionString: urlForDatabase(adminUrl, 'postgres') });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function createDisposableDb() {
  const name = `${DISPOSABLE_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  assertDisposable(name);
  await withAdminClient((c) => c.query(`CREATE DATABASE "${name}"`));
  return name;
}

async function dropDisposableDb(name) {
  assertDisposable(name);
  await withAdminClient((c) => c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
}

async function queryDb(name, sql) {
  assertDisposable(name);
  const client = new Client({ connectionString: urlForDatabase(adminUrl, name) });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

function runNode(script, args, dbName) {
  assertDisposable(dbName);
  return spawnSync(process.execPath, [script, ...args], {
    cwd: backendRoot,
    encoding: 'utf8',
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FORCE_DB_RESTORE: '1',
      DATABASE_URL: urlForDatabase(adminUrl, dbName),
      PATH: `${pgBinDir}${path.delimiter}${process.env.PATH || ''}`,
    },
  });
}

describe('restore.js psql arguments (no database needed)', () => {
  test('buildPsqlRestoreArgs stops on first SQL error and reads the dump file', () => {
    const { buildPsqlRestoreArgs } = require('../../sql/restore');
    expect(typeof buildPsqlRestoreArgs).toBe('function');

    const args = buildPsqlRestoreArgs('postgresql://u:p@localhost:5432/db', '/tmp/dump.sql');
    const joined = args.join(' ');
    expect(joined).toMatch(/ON_ERROR_STOP=1/);
    expect(args).toContain('--dbname');
    expect(args[args.indexOf('--dbname') + 1]).toBe('postgresql://u:p@localhost:5432/db');
    expect(args).toContain('--file');
    expect(args[args.indexOf('--file') + 1]).toBe('/tmp/dump.sql');
    // `-v ON_ERROR_STOP=1` must be passed as a variable assignment pair.
    const vIdx = args.indexOf('-v');
    expect(vIdx).toBeGreaterThanOrEqual(0);
    expect(args[vIdx + 1]).toBe('ON_ERROR_STOP=1');
  });
});

describeLive('B7: dbRestore (live, disposable databases only)', () => {
  jest.setTimeout(180_000);

  let tmpDir;
  const created = [];

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luxride-b7-'));
  });

  afterAll(async () => {
    for (const name of created) {
      await dropDisposableDb(name).catch(() => undefined);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function newDb() {
    const name = await createDisposableDb();
    created.push(name);
    return name;
  }

  test('valid SQL backup restores into a disposable database (exit 0, data present)', async () => {
    // Hand-written dump (not host pg_dump): avoids client/server version skew in ci:local
    // where the local pg_dump may emit SETs that Postgres 16 rejects under ON_ERROR_STOP.
    const dumpFile = path.join(tmpDir, 'valid.sql');
    fs.writeFileSync(
      dumpFile,
      [
        'CREATE TABLE b7_items (id int PRIMARY KEY, label text NOT NULL);',
        "INSERT INTO b7_items VALUES (1, 'alpha'), (2, 'beta');",
        '',
      ].join('\n')
    );

    const target = await newDb();
    await queryDb(target, 'CREATE TABLE b7_stale (x int)'); // must be dropped by restore
    const restore = runNode(restoreScript, [`--file=${dumpFile}`, '--confirm'], target);

    expect({ status: restore.status, stderr: restore.stderr, stdout: restore.stdout }).toMatchObject({
      status: 0,
    });
    expect(restore.stdout).toMatch(/Database restored successfully/);

    const rows = await queryDb(target, 'SELECT id, label FROM b7_items ORDER BY id');
    expect(rows.rows).toEqual([
      { id: 1, label: 'alpha' },
      { id: 2, label: 'beta' },
    ]);
    const stale = await queryDb(target, `SELECT to_regclass('public.b7_stale') AS t`);
    expect(stale.rows[0].t).toBeNull();
  });

  test('corrupted SQL dump fails with non-zero exit and no success banner', async () => {
    const dumpFile = path.join(tmpDir, 'corrupt.sql');
    fs.writeFileSync(
      dumpFile,
      [
        'CREATE TABLE b7_a (id int);',
        'INSERT INTO b7_a VALUES (1);',
        'INSERT INTO b7_table_that_does_not_exist VALUES (1);', // SQL error mid-dump
        'CREATE TABLE b7_after_error (id int);',
        '',
      ].join('\n')
    );

    const target = await newDb();
    const restore = runNode(restoreScript, [`--file=${dumpFile}`, '--confirm'], target);

    expect(restore.stdout).not.toMatch(/Database restored successfully/);
    expect(restore.status).not.toBe(0);
    expect(`${restore.stdout}\n${restore.stderr}`).toMatch(
      /b7_table_that_does_not_exist|exited with code|Restore failed/
    );

    // ON_ERROR_STOP: statements after the failing one must not have run.
    const after = await queryDb(target, `SELECT to_regclass('public.b7_after_error') AS t`);
    expect(after.rows[0].t).toBeNull();
  });
});
