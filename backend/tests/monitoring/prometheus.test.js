const client = require('prom-client');
const {
  getMetrics,
  recordRequest,
  setWorkerHeartbeat,
  incrementBackgroundJobFailure,
  setBackgroundJobLastSuccess,
  incrementStorageErrors,
  setGaugeValues,
} = require('../../src/monitoring/prometheus');

describe('prometheus', () => {
  test('getMetrics returns prometheus text format', async () => {
    recordRequest('GET', '/api/cars', 200, 12, '/api/cars');
    const metrics = await getMetrics();

    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('http_requests_total');
  });

  test('exposes worker, job, readiness, and storage metrics', async () => {
    setWorkerHeartbeat(1_700_000_000);
    incrementBackgroundJobFailure('cleanup.car_images');
    setBackgroundJobLastSuccess('cleanup.car_images', 1_700_000_100);
    incrementStorageErrors('local', 'write');
    setGaugeValues({
      readyStatus: 1,
      migrationsOk: 1,
      migrationsPending: 0,
      pgDatabaseSizeBytes: 42,
      storagePaths: {
        private_uploads: { freeBytes: 50, sizeBytes: 100 },
        postgres_data: { freeBytes: 20, sizeBytes: 100 },
      },
    });

    const metrics = await getMetrics();

    expect(metrics).toContain('worker_heartbeat_unixtime');
    expect(metrics).toContain('background_job_failures_total');
    expect(metrics).toContain('background_job_last_success_unixtime');
    expect(metrics).toContain('storage_errors_total');
    expect(metrics).toContain('ready_status');
    expect(metrics).toContain('migrations_ok');
    expect(metrics).toContain('migrations_pending');
    expect(metrics).toContain('storage_free_bytes');
    expect(metrics).toContain('pg_database_size_bytes');
    expect(client.register.getSingleMetric('worker_heartbeat_unixtime')).toBeTruthy();
  });
});
