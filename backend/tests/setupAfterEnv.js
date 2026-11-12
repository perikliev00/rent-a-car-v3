/**
 * Global DB pool stub for the default unit/API suite.
 * Prevents pgPass / open-handle crashes when a suite accidentally
 * exercises a real SQL path. Opt-in DB tests keep the real pool.
 */
jest.mock('../src/db/pool', () => {
  // Evaluate the condition and enter the branch when it is true.
  if (process.env.RUN_DB_TESTS === 'true') {
    // Return the resulting value to the caller.
    return jest.requireActual('../src/db/pool');
  }

  // Create the query constant.
  const query = jest.fn(async () => ({ rows: [], rowCount: 0 }));
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    query,
    // Provide the connect field value.
    connect: jest.fn(async () => ({
      // Contribute this line to the enclosing declaration or statement.
      query,
      // Provide the release field value.
      release: jest.fn(),
    })),
    // Provide the end field value.
    end: jest.fn(async () => undefined),
    // Provide the on field value.
    on: jest.fn(),
  };
});

// Register cleanup that runs after the tests.
afterAll(async () => {
  // Evaluate the condition and enter the branch when it is true.
  if (process.env.RUN_DB_TESTS !== 'true') return;
  // Create the pool constant.
  const pool = jest.requireActual('../src/db/pool');
  // Evaluate the condition and enter the branch when it is true.
  if (pool && typeof pool.end === 'function' && !pool.ended && !pool.ending) {
    // Wait until the asynchronous operation resolves.
    await pool.end();
  }
});
