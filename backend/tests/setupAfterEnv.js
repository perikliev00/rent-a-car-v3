/**
 * Global DB pool stub for the default unit/API suite.
 * Prevents pgPass / open-handle crashes when a suite accidentally
 * exercises a real SQL path. Opt-in DB tests keep the real pool.
 */
jest.mock('../src/db/pool', () => {
  if (process.env.RUN_DB_TESTS === 'true') {
    return jest.requireActual('../src/db/pool');
  }

  const query = jest.fn(async () => ({ rows: [], rowCount: 0 }));
  return {
    query,
    connect: jest.fn(async () => ({
      query,
      release: jest.fn(),
    })),
    end: jest.fn(async () => undefined),
    on: jest.fn(),
  };
});

afterAll(async () => {
  if (process.env.RUN_DB_TESTS !== 'true') return;
  const pool = jest.requireActual('../src/db/pool');
  if (pool && typeof pool.end === 'function' && !pool.ended && !pool.ending) {
    await pool.end();
  }
});
