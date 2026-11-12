/**
 * Periodic poller that refreshes Prometheus gauges from DB counts, readiness, and disk stats.
 */

const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');
// Require the './metrics' module as metrics.
const metrics = require('./metrics');
// Destructure object properties into local variables.
const { getReadyStatus } = require('../services/healthService');

// Create the default interval ms constant.
const DEFAULT_INTERVAL_MS = 30_000;

// Create the private uploads dir constant.
const PRIVATE_UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'private');
// Create the public uploads dir constant.
const PUBLIC_UPLOADS_DIR = path.join(__dirname, '..', 'public', 'images', 'uploads');
// Create the default pgdata monitor path constant.
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
  // Start a try block for operations that may fail.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (ensureDir) {
      // Wait until the asynchronous operation resolves.
      await fs.promises.mkdir(targetPath, { recursive: true });
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Wait until the asynchronous operation resolves.
      await fs.promises.access(targetPath, fs.constants.R_OK);
    }

    // Evaluate the condition and enter the branch when it is true.
    if (typeof fs.promises.statfs !== 'function') {
      // Return the resulting value to the caller.
      return null;
    }

    // Create the stats constant.
    const stats = await fs.promises.statfs(targetPath);
    // Create the block size constant.
    const blockSize = Number(stats.bsize) || 0;
    // Return the resulting value to the caller.
    return {
      // Contribute this line to the enclosing declaration or statement.
      label,
      // Provide the free bytes field value.
      freeBytes: blockSize * Number(stats.bavail || 0),
      // Provide the size bytes field value.
      sizeBytes: blockSize * Number(stats.blocks || 0),
    };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.debug to perform this step.
    logger.debug({ err, path: targetPath, label }, 'Storage path statfs failed');
    // Return the resulting value to the caller.
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
  // Return the resulting value to the caller.
  return process.env.POSTGRES_DATA_MONITOR_PATH || DEFAULT_PGDATA_MONITOR_PATH;
}

/**
 * Parse `DISK_MONITOR_PATHS` as `label=path,label2=path2`.
 * @returns {Array<{ label: string, path: string }>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function parseExtraDiskMonitorPaths() {
  // Create the raw constant.
  const raw = process.env.DISK_MONITOR_PATHS || '';
  // Evaluate the condition and enter the branch when it is true.
  if (!raw.trim()) {
    // Return the resulting value to the caller.
    return [];
  }

  // Return the resulting value to the caller.
  return raw
    // Call .split to perform this step.
    .split(',')
    // Call .map to perform this step.
    .map((entry) => entry.trim())
    // Call .filter to perform this step.
    .filter(Boolean)
    // Call .map to perform this step.
    .map((entry) => {
      // Create the sep constant.
      const sep = entry.indexOf('=');
      // Evaluate the condition and enter the branch when it is true.
      if (sep <= 0) {
        // Return the resulting value to the caller.
        return null;
      }
      // Return the resulting value to the caller.
      return {
        // Provide the label field value.
        label: entry.slice(0, sep).trim(),
        // Provide the path field value.
        path: entry.slice(sep + 1).trim(),
      };
    })
    // Call .filter to perform this step.
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
  // Create the pgdata path constant.
  const pgdataPath = resolvePostgresMonitorPath();
  // Create the extra paths constant.
  const extraPaths = parseExtraDiskMonitorPaths();

  // Destructure array values into local variables.
  const [
    // Contribute this line to the enclosing declaration or statement.
    paidNotConfirmedResult,
    // Contribute this line to the enclosing declaration or statement.
    processingPaidResult,
    // Contribute this line to the enclosing declaration or statement.
    activeReservationsResult,
    // Contribute this line to the enclosing declaration or statement.
    unresolvedFailuresResult,
    // Contribute this line to the enclosing declaration or statement.
    dbSizeResult,
    // Contribute this line to the enclosing declaration or statement.
    readyPayload,
    // Contribute this line to the enclosing declaration or statement.
    privateStorage,
    // Contribute this line to the enclosing declaration or statement.
    publicStorage,
    // Contribute this line to the enclosing declaration or statement.
    postgresStorage,
    // Spread extraStorage into the surrounding structure.
    ...extraStorage
  // Store the awaited result in ].
  ] = await Promise.all([
    // Call pool.query to perform this step.
    pool.query(
      // Continue the surrounding logic with this statement.
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status IN ('manual_review', 'paid')"
    ),
    // Call pool.query to perform this step.
    pool.query(
      // Continue the surrounding logic with this statement.
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'processing_payment' AND stripe_session_id IS NOT NULL"
    ),
    // Call pool.query to perform this step.
    pool.query(
      // Continue the surrounding logic with this statement.
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status IN ('pending_payment', 'processing_payment')"
    ),
    // Call pool.query to perform this step.
    pool.query(
      // Continue the surrounding logic with this statement.
      'SELECT COUNT(*)::int AS count FROM payment_failures WHERE resolved = false'
    ),
    // Call pool.query to perform this step.
    pool.query('SELECT pg_database_size(current_database())::bigint AS size'),
    // Call getReadyStatus to perform this step.
    getReadyStatus(pool),
    // Call collectStoragePathSizes to perform this step.
    collectStoragePathSizes(PRIVATE_UPLOADS_DIR, 'private_uploads', { ensureDir: true }),
    // Call collectStoragePathSizes to perform this step.
    collectStoragePathSizes(PUBLIC_UPLOADS_DIR, 'public_uploads', { ensureDir: true }),
    // Call collectStoragePathSizes to perform this step.
    collectStoragePathSizes(pgdataPath, 'postgres_data', { ensureDir: false }),
    // Call ...extraPaths.map to perform this step.
    ...extraPaths.map((entry) =>
      // Call collectStoragePathSizes to perform this step.
      collectStoragePathSizes(entry.path, entry.label, { ensureDir: false })
    ),
  ]);

  // Create the storage paths constant.
  const storagePaths = {};
  // Iterate using the loop initializer, condition, and step.
  for (const entry of [privateStorage, publicStorage, postgresStorage, ...extraStorage]) {
    // Evaluate the condition and enter the branch when it is true.
    if (entry) {
      // Update storagePaths[entry.label] with the right-hand side value.
      storagePaths[entry.label] = {
        // Provide the free bytes field value.
        freeBytes: entry.freeBytes,
        // Provide the size bytes field value.
        sizeBytes: entry.sizeBytes,
      };
    }
  }

  // Create the pending count constant.
  const pendingCount = Array.isArray(readyPayload?.checks?.migrations?.pending)
    // Contribute this line to the enclosing declaration or statement.
    ? readyPayload.checks.migrations.pending.length
    // Contribute this line to the enclosing declaration or statement.
    : 0;

  // Create the db size bytes constant.
  const dbSizeBytes = Number(dbSizeResult.rows[0]?.size);
  // Call metrics.setGaugeValues to perform this step.
  metrics.setGaugeValues({
    // Provide the paid not confirmed field value.
    paidNotConfirmed: paidNotConfirmedResult.rows[0]?.count ?? 0,
    // Provide the processing paid field value.
    processingPaid: processingPaidResult.rows[0]?.count ?? 0,
    // Provide the active reservations field value.
    activeReservations: activeReservationsResult.rows[0]?.count ?? 0,
    // Provide the unresolved payment failures field value.
    unresolvedPaymentFailures: unresolvedFailuresResult.rows[0]?.count ?? 0,
    // Provide the db pool total field value.
    dbPoolTotal: pool.totalCount,
    // Provide the db pool idle field value.
    dbPoolIdle: pool.idleCount,
    // Provide the db pool waiting field value.
    dbPoolWaiting: pool.waitingCount,
    // Provide the ready status field value.
    readyStatus: readyPayload?.status === 'ready' ? 1 : 0,
    // Provide the migrations ok field value.
    migrationsOk: readyPayload?.checks?.migrations?.ok ? 1 : 0,
    // Provide the migrations pending field value.
    migrationsPending: pendingCount,
    // Provide the pg database size bytes field value.
    pgDatabaseSizeBytes: Number.isFinite(dbSizeBytes) ? dbSizeBytes : 0,
    // Contribute this line to the enclosing declaration or statement.
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
  // Create the poll constant.
  const poll = async () => {
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await collectGaugeValues(pool);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call logger.error to perform this step.
      logger.error({ err }, 'Gauge poller failed');
    }
  };

  // Continue the surrounding logic with this statement.
  void poll();
  // Return the resulting value to the caller.
  return setInterval(poll, intervalMs);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  startGaugePoller,
  // Contribute this line to the enclosing declaration or statement.
  collectGaugeValues,
  // Contribute this line to the enclosing declaration or statement.
  collectStoragePathSizes,
  // Contribute this line to the enclosing declaration or statement.
  resolvePostgresMonitorPath,
  // Contribute this line to the enclosing declaration or statement.
  parseExtraDiskMonitorPaths,
};
