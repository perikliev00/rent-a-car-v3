// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parsePositiveInt,
  // Contribute this line to the enclosing declaration or statement.
  resolvePoolOptions,
  // Contribute this line to the enclosing declaration or statement.
  applySessionTimeouts,
// Continue the surrounding logic with this statement.
} = require('../../src/db/poolConfig');

// Declare a test suite grouping related cases.
describe('poolConfig', () => {
  // Define a single test case and its expectations.
  test('parsePositiveInt falls back on empty or invalid', () => {
    // Assert that the value matches the intended expectation.
    expect(parsePositiveInt(undefined, 10)).toBe(10);
    // Assert that the value matches the intended expectation.
    expect(parsePositiveInt('', 10)).toBe(10);
    // Assert that the value matches the intended expectation.
    expect(parsePositiveInt('abc', 10)).toBe(10);
    // Assert that the value matches the intended expectation.
    expect(parsePositiveInt('-1', 10)).toBe(10);
    // Assert that the value matches the intended expectation.
    expect(parsePositiveInt('25', 10)).toBe(25);
    // Assert that the value matches the intended expectation.
    expect(parsePositiveInt('0', 10)).toBe(0);
  });

  // Define a single test case and its expectations.
  test('production defaults include pool max and session timeouts', () => {
    // Create the options constant.
    const options = resolvePoolOptions({ NODE_ENV: 'production' });
    // Assert that the value matches the intended expectation.
    expect(options.max).toBe(20);
    // Assert that the value matches the intended expectation.
    expect(options.idleTimeoutMillis).toBe(30000);
    // Assert that the value matches the intended expectation.
    expect(options.connectionTimeoutMillis).toBe(5000);
    // Assert that the value matches the intended expectation.
    expect(options.statementTimeoutMs).toBe(15000);
    // Assert that the value matches the intended expectation.
    expect(options.idleInTransactionTimeoutMs).toBe(30000);
    // Assert that the value matches the intended expectation.
    expect(options.lockTimeoutMs).toBe(5000);
  });

  // Define a single test case and its expectations.
  test('development defaults leave statement timeouts off', () => {
    // Create the options constant.
    const options = resolvePoolOptions({ NODE_ENV: 'development' });
    // Assert that the value matches the intended expectation.
    expect(options.max).toBe(10);
    // Assert that the value matches the intended expectation.
    expect(options.statementTimeoutMs).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(options.idleInTransactionTimeoutMs).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(options.lockTimeoutMs).toBe(0);
  });

  // Define a single test case and its expectations.
  test('test defaults keep a small pool and allowExitOnIdle', () => {
    // Create the options constant.
    const options = resolvePoolOptions({ NODE_ENV: 'test' });
    // Assert that the value matches the intended expectation.
    expect(options.max).toBe(5);
    // Assert that the value matches the intended expectation.
    expect(options.idleTimeoutMillis).toBe(1000);
    // Assert that the value matches the intended expectation.
    expect(options.allowExitOnIdle).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(options.statementTimeoutMs).toBe(0);
  });

  // Define a single test case and its expectations.
  test('env overrides win', () => {
    // Create the options constant.
    const options = resolvePoolOptions({
      // Provide the node env field value.
      NODE_ENV: 'production',
      // Provide the pg pool max field value.
      PG_POOL_MAX: '8',
      // Provide the pg statement timeout ms field value.
      PG_STATEMENT_TIMEOUT_MS: '20000',
      // Provide the pg lock timeout ms field value.
      PG_LOCK_TIMEOUT_MS: '0',
    });
    // Assert that the value matches the intended expectation.
    expect(options.max).toBe(8);
    // Assert that the value matches the intended expectation.
    expect(options.statementTimeoutMs).toBe(20000);
    // Assert that the value matches the intended expectation.
    expect(options.lockTimeoutMs).toBe(0);
  });

  // Define a single test case and its expectations.
  test('applySessionTimeouts no-ops when all timeouts are zero', async () => {
    // Create the client constant.
    const client = { query: jest.fn() };
    // Wait until the asynchronous operation resolves.
    await applySessionTimeouts(client, {
      // Provide the statement timeout ms field value.
      statementTimeoutMs: 0,
      // Provide the idle in transaction timeout ms field value.
      idleInTransactionTimeoutMs: 0,
      // Provide the lock timeout ms field value.
      lockTimeoutMs: 0,
    });
    // Assert that the value matches the intended expectation.
    expect(client.query).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('applySessionTimeouts sets enabled timeouts', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({}) };
    // Wait until the asynchronous operation resolves.
    await applySessionTimeouts(client, {
      // Provide the statement timeout ms field value.
      statementTimeoutMs: 15000,
      // Provide the idle in transaction timeout ms field value.
      idleInTransactionTimeoutMs: 30000,
      // Provide the lock timeout ms field value.
      lockTimeoutMs: 5000,
    });
    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith(
      // Continue the surrounding logic with this statement.
      'SET statement_timeout = 15000; SET idle_in_transaction_session_timeout = 30000; SET lock_timeout = 5000'
    );
  });
});
