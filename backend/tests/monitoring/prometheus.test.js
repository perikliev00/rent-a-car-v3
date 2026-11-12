// Require the 'prom-client' module as client.
const client = require('prom-client');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getMetrics,
  // Contribute this line to the enclosing declaration or statement.
  recordRequest,
  // Contribute this line to the enclosing declaration or statement.
  setWorkerHeartbeat,
  // Contribute this line to the enclosing declaration or statement.
  incrementBackgroundJobFailure,
  // Contribute this line to the enclosing declaration or statement.
  setBackgroundJobLastSuccess,
  // Contribute this line to the enclosing declaration or statement.
  incrementStorageErrors,
  // Contribute this line to the enclosing declaration or statement.
  setGaugeValues,
// Continue the surrounding logic with this statement.
} = require('../../src/monitoring/prometheus');

// Declare a test suite grouping related cases.
describe('prometheus', () => {
  // Define a single test case and its expectations.
  test('getMetrics returns prometheus text format', async () => {
    // Call recordRequest to perform this step.
    recordRequest('GET', '/api/cars', 200, 12, '/api/cars');
    // Create the metrics constant.
    const metrics = await getMetrics();

    // Assert that the value matches the intended expectation.
    expect(typeof metrics).toBe('string');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('http_requests_total');
  });

  // Define a single test case and its expectations.
  test('exposes worker, job, readiness, and storage metrics', async () => {
    // Call setWorkerHeartbeat to perform this step.
    setWorkerHeartbeat(1_700_000_000);
    // Call incrementBackgroundJobFailure to perform this step.
    incrementBackgroundJobFailure('cleanup.car_images');
    // Call setBackgroundJobLastSuccess to perform this step.
    setBackgroundJobLastSuccess('cleanup.car_images', 1_700_000_100);
    // Call incrementStorageErrors to perform this step.
    incrementStorageErrors('local', 'write');
    // Call setGaugeValues to perform this step.
    setGaugeValues({
      // Provide the ready status field value.
      readyStatus: 1,
      // Provide the migrations ok field value.
      migrationsOk: 1,
      // Provide the migrations pending field value.
      migrationsPending: 0,
      // Provide the pg database size bytes field value.
      pgDatabaseSizeBytes: 42,
      // Provide the storage paths field value.
      storagePaths: {
        // Provide the private uploads field value.
        private_uploads: { freeBytes: 50, sizeBytes: 100 },
        // Provide the postgres data field value.
        postgres_data: { freeBytes: 20, sizeBytes: 100 },
      },
    });

    // Create the metrics constant.
    const metrics = await getMetrics();

    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('worker_heartbeat_unixtime');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('background_job_failures_total');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('background_job_last_success_unixtime');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('storage_errors_total');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('ready_status');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('migrations_ok');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('migrations_pending');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('storage_free_bytes');
    // Assert that the value matches the intended expectation.
    expect(metrics).toContain('pg_database_size_bytes');
    // Assert that the value matches the intended expectation.
    expect(client.register.getSingleMetric('worker_heartbeat_unixtime')).toBeTruthy();
  });
});
