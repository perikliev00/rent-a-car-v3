/**
 * Periodic poller that refreshes Prometheus gauges from DB counts, readiness, and disk stats.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const metrics = require('./metrics');
const { getReadyStatus } = require('../services/healthService');

const DEFAULT_INTERVAL_MS = 30_000;

const PRIVATE_UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'private');
const PUBLIC_UPLOADS_DIR = path.join(__dirname, '..', 'public', 'images', 'uploads');
const DEFAULT_PGDATA_MONITOR_PATH = '/mnt/pgdata';

/**
 * Read free/total bytes for a filesystem path via `statfs` (when available).
 *
 * @param {string} targetPath
 * @param {string} label
 * @param {{ ensureDir?: boolean }} [options]
 * @returns {Promise<{ label: string, freeBytes: number, sizeBytes: number } | null>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function collectStoragePathSizes(targetPath, label, { ensureDir = false } = {}) {
  try {
    if (ensureDir) {
      await fs.promises.mkdir(targetPath, { recursive: true });
    } else {
      await fs.promises.access(targetPath, fs.constants.R_OK);
    }

    if (typeof fs.promises.statfs !== 'function') {
      return null;
    }

    const stats = await fs.promises.statfs(targetPath);
    const blockSize = Number(stats.bsize) || 0;
    return {
      label,
      freeBytes: blockSize * Number(stats.bavail || 0),
      sizeBytes: blockSize * Number(stats.blocks || 0),
    };
  } catch (err) {
    logger.debug({ err, path: targetPath, label }, 'Storage path statfs failed');
    return null;
  }
}

/**
 * Resolve the Postgres data directory path used for disk gauges.
 *
 * @returns {string}
 * @throws {never}
 */
function resolvePostgresMonitorPath() {
  return process.env.POSTGRES_DATA_MONITOR_PATH || DEFAULT_PGDATA_MONITOR_PATH;
}

/**
 * Parse `DISK_MONITOR_PATHS` as `label=path,label2=path2`.
 * @returns {Array<{ label: string, path: string }>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function parseExtraDiskMonitorPaths() {
  const raw = process.env.DISK_MONITOR_PATHS || '';
  if (!raw.trim()) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf('=');
      if (sep <= 0) {
        return null;
      }
      return {
        label: entry.slice(0, sep).trim(),
        path: entry.slice(sep + 1).trim(),
      };
    })
    .filter((entry) => entry && entry.label && entry.path);
}

/**
 * Query operational counts and push them into Prometheus gauges.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<*>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
async function collectGaugeValues(pool) {
  const pgdataPath = resolvePostgresMonitorPath();
  const extraPaths = parseExtraDiskMonitorPaths();

  const [
    paidNotConfirmedResult,
    processingPaidResult,
    activeReservationsResult,
    unresolvedFailuresResult,
    dbSizeResult,
    readyPayload,
    privateStorage,
    publicStorage,
    postgresStorage,
    ...extraStorage
  ] = await Promise.all([
    pool.query(
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status IN ('manual_review', 'paid')"
    ),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'processing_payment' AND stripe_session_id IS NOT NULL"
    ),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status IN ('pending_payment', 'processing_payment')"
    ),
    pool.query(
      'SELECT COUNT(*)::int AS count FROM payment_failures WHERE resolved = false'
    ),
    pool.query('SELECT pg_database_size(current_database())::bigint AS size'),
    getReadyStatus(pool),
    collectStoragePathSizes(PRIVATE_UPLOADS_DIR, 'private_uploads', { ensureDir: true }),
    collectStoragePathSizes(PUBLIC_UPLOADS_DIR, 'public_uploads', { ensureDir: true }),
    collectStoragePathSizes(pgdataPath, 'postgres_data', { ensureDir: false }),
    ...extraPaths.map((entry) =>
      collectStoragePathSizes(entry.path, entry.label, { ensureDir: false })
    ),
  ]);

  const storagePaths = {};
  for (const entry of [privateStorage, publicStorage, postgresStorage, ...extraStorage]) {
    if (entry) {
      storagePaths[entry.label] = {
        freeBytes: entry.freeBytes,
        sizeBytes: entry.sizeBytes,
      };
    }
  }

  const pendingCount = Array.isArray(readyPayload?.checks?.migrations?.pending)
    ? readyPayload.checks.migrations.pending.length
    : 0;

  const dbSizeBytes = Number(dbSizeResult.rows[0]?.size);
  metrics.setGaugeValues({
    paidNotConfirmed: paidNotConfirmedResult.rows[0]?.count ?? 0,
    processingPaid: processingPaidResult.rows[0]?.count ?? 0,
    activeReservations: activeReservationsResult.rows[0]?.count ?? 0,
    unresolvedPaymentFailures: unresolvedFailuresResult.rows[0]?.count ?? 0,
    dbPoolTotal: pool.totalCount,
    dbPoolIdle: pool.idleCount,
    dbPoolWaiting: pool.waitingCount,
    readyStatus: readyPayload?.status === 'ready' ? 1 : 0,
    migrationsOk: readyPayload?.checks?.migrations?.ok ? 1 : 0,
    migrationsPending: pendingCount,
    pgDatabaseSizeBytes: Number.isFinite(dbSizeBytes) ? dbSizeBytes : 0,
    storagePaths,
  });
}

/**
 * Start the interval poller; returns the timer handle for shutdown.
 *
 * @param {import('pg').Pool} pool
 * @param {number} [intervalMs]
 * @returns {NodeJS.Timeout}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function startGaugePoller(pool, intervalMs = DEFAULT_INTERVAL_MS) {
  const poll = async () => {
    try {
      await collectGaugeValues(pool);
    } catch (err) {
      logger.error({ err }, 'Gauge poller failed');
    }
  };

  void poll();
  return setInterval(poll, intervalMs);
}

module.exports = {
  startGaugePoller,
  collectGaugeValues,
  collectStoragePathSizes,
  resolvePostgresMonitorPath,
  parseExtraDiskMonitorPaths,
};
