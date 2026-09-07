const {
  parsePositiveInt,
  resolvePoolOptions,
  applySessionTimeouts,
} = require('../../src/db/poolConfig');

describe('poolConfig', () => {
  test('parsePositiveInt falls back on empty or invalid', () => {
    expect(parsePositiveInt(undefined, 10)).toBe(10);
    expect(parsePositiveInt('', 10)).toBe(10);
    expect(parsePositiveInt('abc', 10)).toBe(10);
    expect(parsePositiveInt('-1', 10)).toBe(10);
    expect(parsePositiveInt('25', 10)).toBe(25);
    expect(parsePositiveInt('0', 10)).toBe(0);
  });

  test('production defaults include pool max and session timeouts', () => {
    const options = resolvePoolOptions({ NODE_ENV: 'production' });
    expect(options.max).toBe(20);
    expect(options.idleTimeoutMillis).toBe(30000);
    expect(options.connectionTimeoutMillis).toBe(5000);
    expect(options.statementTimeoutMs).toBe(15000);
    expect(options.idleInTransactionTimeoutMs).toBe(30000);
    expect(options.lockTimeoutMs).toBe(5000);
  });

  test('development defaults leave statement timeouts off', () => {
    const options = resolvePoolOptions({ NODE_ENV: 'development' });
    expect(options.max).toBe(10);
    expect(options.statementTimeoutMs).toBe(0);
    expect(options.idleInTransactionTimeoutMs).toBe(0);
    expect(options.lockTimeoutMs).toBe(0);
  });

  test('test defaults keep a small pool and allowExitOnIdle', () => {
    const options = resolvePoolOptions({ NODE_ENV: 'test' });
    expect(options.max).toBe(5);
    expect(options.idleTimeoutMillis).toBe(1000);
    expect(options.allowExitOnIdle).toBe(true);
    expect(options.statementTimeoutMs).toBe(0);
  });

  test('env overrides win', () => {
    const options = resolvePoolOptions({
      NODE_ENV: 'production',
      PG_POOL_MAX: '8',
      PG_STATEMENT_TIMEOUT_MS: '20000',
      PG_LOCK_TIMEOUT_MS: '0',
    });
    expect(options.max).toBe(8);
    expect(options.statementTimeoutMs).toBe(20000);
    expect(options.lockTimeoutMs).toBe(0);
  });

  test('applySessionTimeouts no-ops when all timeouts are zero', async () => {
    const client = { query: jest.fn() };
    await applySessionTimeouts(client, {
      statementTimeoutMs: 0,
      idleInTransactionTimeoutMs: 0,
      lockTimeoutMs: 0,
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  test('applySessionTimeouts sets enabled timeouts', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    await applySessionTimeouts(client, {
      statementTimeoutMs: 15000,
      idleInTransactionTimeoutMs: 30000,
      lockTimeoutMs: 5000,
    });
    expect(client.query).toHaveBeenCalledWith(
      'SET statement_timeout = 15000; SET idle_in_transaction_session_timeout = 30000; SET lock_timeout = 5000'
    );
  });
});
