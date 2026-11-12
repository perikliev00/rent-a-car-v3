// Call jest.mock to perform this step.
jest.mock('../../src/db/pool', () => ({
  // Provide the connect field value.
  connect: jest.fn(),
  // Provide the query field value.
  query: jest.fn(),
}));

// Require the '../../src/db/pool' module as pool.
const pool = require('../../src/db/pool');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  isUniqueViolation,
  // Contribute this line to the enclosing declaration or statement.
  isCarDateBlockOverlapViolation,
  // Contribute this line to the enclosing declaration or statement.
  isReservationHoldOverlapViolation,
  // Contribute this line to the enclosing declaration or statement.
  isActiveSessionHoldUniqueViolation,
  // Contribute this line to the enclosing declaration or statement.
  acquireCarAdvisoryLock,
  // Contribute this line to the enclosing declaration or statement.
  acquireCarAdvisoryLocks,
  // Contribute this line to the enclosing declaration or statement.
  acquireSessionAdvisoryLock,
  // Contribute this line to the enclosing declaration or statement.
  tryAcquireReservationCheckoutLock,
  // Contribute this line to the enclosing declaration or statement.
  acquireReservationCheckoutLock,
  // Contribute this line to the enclosing declaration or statement.
  releaseReservationCheckoutLock,
  // Contribute this line to the enclosing declaration or statement.
  withReservationCheckoutLock,
  // Contribute this line to the enclosing declaration or statement.
  isCheckoutLockBusyError,
  // Contribute this line to the enclosing declaration or statement.
  withJobLock,
  // Contribute this line to the enclosing declaration or statement.
  tryAcquireJobLock,
  // Contribute this line to the enclosing declaration or statement.
  releaseJobLock,
  // Contribute this line to the enclosing declaration or statement.
  ADVISORY_LOCK_NS,
  // Contribute this line to the enclosing declaration or statement.
  ACTIVE_SESSION_HOLD_UNIQUE_INDEX,
// Continue the surrounding logic with this statement.
} = require('../../src/db/transaction');

// Declare a test suite grouping related cases.
describe('transaction error helpers', () => {
  // Define a single test case and its expectations.
  test('isUniqueViolation detects postgres unique violations', () => {
    // Assert that the value matches the intended expectation.
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
  });

  // Define a single test case and its expectations.
  test('isCheckoutLockBusyError detects checkout lock busy', () => {
    // Assert that the value matches the intended expectation.
    expect(isCheckoutLockBusyError({ code: 'CHECKOUT_LOCK_BUSY' })).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isCheckoutLockBusyError({ code: 'OTHER' })).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isCheckoutLockBusyError(null)).toBe(false);
  });

  // Define a single test case and its expectations.
  test('isCarDateBlockOverlapViolation detects car block overlap', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call isCarDateBlockOverlapViolation to perform this step.
      isCarDateBlockOverlapViolation({
        // Provide the code field value.
        code: '23P01',
        // Provide the constraint field value.
        constraint: 'no_overlapping_car_blocks',
      })
    // Continue the surrounding logic with this statement.
    ).toBe(true);
  });

  // Define a single test case and its expectations.
  test('isReservationHoldOverlapViolation detects reservation hold overlap', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call isReservationHoldOverlapViolation to perform this step.
      isReservationHoldOverlapViolation({
        // Provide the code field value.
        code: '23P01',
        // Provide the constraint field value.
        constraint: 'no_overlapping_active_reservation_holds',
      })
    // Continue the surrounding logic with this statement.
    ).toBe(true);
  });

  // Define a single test case and its expectations.
  test('isActiveSessionHoldUniqueViolation detects the session hold unique index', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call isActiveSessionHoldUniqueViolation to perform this step.
      isActiveSessionHoldUniqueViolation({
        // Provide the code field value.
        code: '23505',
        // Provide the constraint field value.
        constraint: ACTIVE_SESSION_HOLD_UNIQUE_INDEX,
      })
    // Continue the surrounding logic with this statement.
    ).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(
      // Call isActiveSessionHoldUniqueViolation to perform this step.
      isActiveSessionHoldUniqueViolation({
        // Provide the code field value.
        code: '23505',
        // Provide the constraint field value.
        constraint: 'idx_reservations_stripe_session_unique',
      })
    // Continue the surrounding logic with this statement.
    ).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isActiveSessionHoldUniqueViolation({ code: '23505' })).toBe(false);
  });

  // Define a single test case and its expectations.
  test('acquireCarAdvisoryLock queries namespaced pg_advisory_xact_lock', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    // Wait until the asynchronous operation resolves.
    await acquireCarAdvisoryLock(client, 42);

    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, $2)', [
      // Contribute this line to the enclosing declaration or statement.
      ADVISORY_LOCK_NS.CAR,
      // Supply the literal value used by the enclosing expression.
      42,
    ]);
  });

  // Define a single test case and its expectations.
  test('acquireCarAdvisoryLock rejects invalid car id', async () => {
    // Create the client constant.
    const client = { query: jest.fn() };

    // Wait until the asynchronous operation resolves.
    await expect(acquireCarAdvisoryLock(client, 'bad')).rejects.toThrow(
      // Supply the literal value used by the enclosing expression.
      'Invalid car id for advisory lock'
    );
    // Assert that the value matches the intended expectation.
    expect(client.query).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('acquireCarAdvisoryLocks locks unique ids in sorted order', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    // Wait until the asynchronous operation resolves.
    await acquireCarAdvisoryLocks(client, [9, 3, 9, 1]);

    // Assert that the value matches the intended expectation.
    expect(client.query.mock.calls).toEqual([
      // Continue the surrounding logic with this statement.
      ['SELECT pg_advisory_xact_lock($1, $2)', [ADVISORY_LOCK_NS.CAR, 1]],
      // Continue the surrounding logic with this statement.
      ['SELECT pg_advisory_xact_lock($1, $2)', [ADVISORY_LOCK_NS.CAR, 3]],
      // Continue the surrounding logic with this statement.
      ['SELECT pg_advisory_xact_lock($1, $2)', [ADVISORY_LOCK_NS.CAR, 9]],
    ]);
  });

  // Define a single test case and its expectations.
  test('acquireSessionAdvisoryLock uses namespaced hashtext', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    // Wait until the asynchronous operation resolves.
    await acquireSessionAdvisoryLock(client, 'sess-abc');

    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
      // Contribute this line to the enclosing declaration or statement.
      ADVISORY_LOCK_NS.SESSION,
      // Supply the literal value used by the enclosing expression.
      'sess-abc',
    ]);
  });

  // Define a single test case and its expectations.
  test('acquireSessionAdvisoryLock rejects invalid session id', async () => {
    // Create the client constant.
    const client = { query: jest.fn() };

    // Wait until the asynchronous operation resolves.
    await expect(acquireSessionAdvisoryLock(client, '')).rejects.toThrow(
      // Supply the literal value used by the enclosing expression.
      'Invalid session id for advisory lock'
    );
    // Assert that the value matches the intended expectation.
    expect(client.query).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('acquireReservationCheckoutLock queries namespaced pg_try_advisory_lock', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: true }] }) };

    // Wait until the asynchronous operation resolves.
    await acquireReservationCheckoutLock(client, 42);

    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
      // Contribute this line to the enclosing declaration or statement.
      ADVISORY_LOCK_NS.CHECKOUT,
      // Supply the literal value used by the enclosing expression.
      42,
    ]);
  });

  // Define a single test case and its expectations.
  test('tryAcquireReservationCheckoutLock returns false when the lock is held', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }) };

    // Wait until the asynchronous operation resolves.
    await expect(tryAcquireReservationCheckoutLock(client, 42)).resolves.toBe(false);
  });

  // Define a single test case and its expectations.
  test('acquireReservationCheckoutLock throws when the lock is not acquired', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }) };

    // Wait until the asynchronous operation resolves.
    await expect(acquireReservationCheckoutLock(client, 42)).rejects.toMatchObject({
      // Provide the code field value.
      code: 'CHECKOUT_LOCK_BUSY',
    });
  });

  // Define a single test case and its expectations.
  test('releaseReservationCheckoutLock queries namespaced pg_advisory_unlock', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    // Wait until the asynchronous operation resolves.
    await releaseReservationCheckoutLock(client, 42);

    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, $2)', [
      // Contribute this line to the enclosing declaration or statement.
      ADVISORY_LOCK_NS.CHECKOUT,
      // Supply the literal value used by the enclosing expression.
      42,
    ]);
  });

  // Define a single test case and its expectations.
  test('acquireReservationCheckoutLock rejects invalid reservation id', async () => {
    // Create the client constant.
    const client = { query: jest.fn() };

    // Wait until the asynchronous operation resolves.
    await expect(acquireReservationCheckoutLock(client, 'bad')).rejects.toThrow(
      // Supply the literal value used by the enclosing expression.
      'Invalid reservation id for checkout lock'
    );
    // Assert that the value matches the intended expectation.
    expect(client.query).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('CHECKOUT namespace is distinct from CAR and SESSION', () => {
    // Assert that the value matches the intended expectation.
    expect(ADVISORY_LOCK_NS.CHECKOUT).toBe(3);
    // Assert that the value matches the intended expectation.
    expect(ADVISORY_LOCK_NS.CHECKOUT).not.toBe(ADVISORY_LOCK_NS.CAR);
    // Assert that the value matches the intended expectation.
    expect(ADVISORY_LOCK_NS.CHECKOUT).not.toBe(ADVISORY_LOCK_NS.SESSION);
  });

  // Define a single test case and its expectations.
  test('JOB namespace is distinct from CAR, SESSION, and CHECKOUT', () => {
    // Assert that the value matches the intended expectation.
    expect(ADVISORY_LOCK_NS.JOB).toBe(4);
    // Assert that the value matches the intended expectation.
    expect(ADVISORY_LOCK_NS.JOB).not.toBe(ADVISORY_LOCK_NS.CAR);
    // Assert that the value matches the intended expectation.
    expect(ADVISORY_LOCK_NS.JOB).not.toBe(ADVISORY_LOCK_NS.SESSION);
    // Assert that the value matches the intended expectation.
    expect(ADVISORY_LOCK_NS.JOB).not.toBe(ADVISORY_LOCK_NS.CHECKOUT);
  });
});

// Declare a test suite grouping related cases.
describe('withReservationCheckoutLock', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call pool.connect.mockReset to perform this step.
    pool.connect.mockReset();
    // Call pool.query.mockReset to perform this step.
    pool.query.mockReset();
  });

  // Define a single test case and its expectations.
  test('releases the pool client before sleeping when the lock is busy', async () => {
    // Create the events constant.
    const events = [];
    // Create the sleep constant.
    const sleep = jest.fn(async () => {
      // Call events.push to perform this step.
      events.push('sleep');
    });

    // Create the busy client constant.
    const busyClient = {
      // Provide the query field value.
      query: jest.fn(async (sql) => {
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_try_advisory_lock')) {
          // Call events.push to perform this step.
          events.push('try-busy');
          // Return the resulting value to the caller.
          return { rows: [{ acquired: false }] };
        }
        // Return the resulting value to the caller.
        return { rows: [] };
      }),
      // Provide the release field value.
      release: jest.fn(() => {
        // Call events.push to perform this step.
        events.push('release-busy');
      }),
    };
    // Create the held client constant.
    const heldClient = {
      // Provide the query field value.
      query: jest.fn(async (sql) => {
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_try_advisory_lock')) {
          // Call events.push to perform this step.
          events.push('try-held');
          // Return the resulting value to the caller.
          return { rows: [{ acquired: true }] };
        }
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_advisory_unlock')) {
          // Call events.push to perform this step.
          events.push('unlock');
          // Return the resulting value to the caller.
          return { rows: [] };
        }
        // Return the resulting value to the caller.
        return { rows: [] };
      }),
      // Provide the release field value.
      release: jest.fn(() => {
        // Call events.push to perform this step.
        events.push('release-held');
      }),
    };

    // Call pool.connect.mockResolvedValueOnce to perform this step.
    pool.connect.mockResolvedValueOnce(busyClient).mockResolvedValueOnce(heldClient);

    // Create the work constant.
    const work = jest.fn(async () => {
      // Call events.push to perform this step.
      events.push('work');
      // Return the resulting value to the caller.
      return 'ok';
    });

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call withReservationCheckoutLock to perform this step.
      withReservationCheckoutLock(42, work, { sleep, delayMsForAttempt: () => 1 })
    // Continue the surrounding logic with this statement.
    ).resolves.toBe('ok');

    // Assert that the value matches the intended expectation.
    expect(events).toEqual([
      // Supply the literal value used by the enclosing expression.
      'try-busy',
      // Supply the literal value used by the enclosing expression.
      'release-busy',
      // Supply the literal value used by the enclosing expression.
      'sleep',
      // Supply the literal value used by the enclosing expression.
      'try-held',
      // Supply the literal value used by the enclosing expression.
      'work',
      // Supply the literal value used by the enclosing expression.
      'unlock',
      // Supply the literal value used by the enclosing expression.
      'release-held',
    ]);
    // Assert that the value matches the intended expectation.
    expect(work).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(busyClient.query).not.toHaveBeenCalledWith(
      // Call expect.stringContaining to perform this step.
      expect.stringContaining('pg_advisory_lock($1, $2)'),
      // Call expect.anything to perform this step.
      expect.anything()
    );
  });

  // Define a single test case and its expectations.
  test('unlocks and releases the client when work throws', async () => {
    // Create the events constant.
    const events = [];
    // Create the held client constant.
    const heldClient = {
      // Provide the query field value.
      query: jest.fn(async (sql) => {
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_try_advisory_lock')) {
          // Return the resulting value to the caller.
          return { rows: [{ acquired: true }] };
        }
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_advisory_unlock')) {
          // Call events.push to perform this step.
          events.push('unlock');
          // Return the resulting value to the caller.
          return { rows: [] };
        }
        // Return the resulting value to the caller.
        return { rows: [] };
      }),
      // Provide the release field value.
      release: jest.fn(() => {
        // Call events.push to perform this step.
        events.push('release');
      }),
    };

    // Call pool.connect.mockResolvedValue to perform this step.
    pool.connect.mockResolvedValue(heldClient);

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call withReservationCheckoutLock to perform this step.
      withReservationCheckoutLock(42, async () => {
        // Call events.push to perform this step.
        events.push('work');
        // Throw an error to stop the current control flow.
        throw new Error('stripe down');
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toThrow('stripe down');

    // Assert that the value matches the intended expectation.
    expect(events).toEqual(['work', 'unlock', 'release']);
  });

  // Define a single test case and its expectations.
  test('throws CHECKOUT_LOCK_BUSY after bounded retries without holding a client', async () => {
    // Create the sleep constant.
    const sleep = jest.fn().mockResolvedValue(undefined);
    // Create the client constant.
    const client = {
      // Provide the query field value.
      query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
      // Provide the release field value.
      release: jest.fn(),
    };
    // Call pool.connect.mockResolvedValue to perform this step.
    pool.connect.mockResolvedValue(client);

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call withReservationCheckoutLock to perform this step.
      withReservationCheckoutLock(42, jest.fn(), {
        // Provide the max attempts field value.
        maxAttempts: 3,
        // Contribute this line to the enclosing declaration or statement.
        sleep,
        // Provide the delay ms for attempt field value.
        delayMsForAttempt: () => 5,
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({ code: 'CHECKOUT_LOCK_BUSY' });

    // Assert that the value matches the intended expectation.
    expect(pool.connect).toHaveBeenCalledTimes(3);
    // Assert that the value matches the intended expectation.
    expect(client.release).toHaveBeenCalledTimes(3);
    // Assert that the value matches the intended expectation.
    expect(sleep).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
      // Contribute this line to the enclosing declaration or statement.
      ADVISORY_LOCK_NS.CHECKOUT,
      // Supply the literal value used by the enclosing expression.
      42,
    ]);
    // Assert that the value matches the intended expectation.
    expect(client.query).not.toHaveBeenCalledWith(
      // Call expect.stringContaining to perform this step.
      expect.stringContaining('pg_advisory_unlock'),
      // Call expect.anything to perform this step.
      expect.anything()
    );
  });
});

// Declare a test suite grouping related cases.
describe('withJobLock', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call pool.connect.mockReset to perform this step.
    pool.connect.mockReset();
    // Call pool.query.mockReset to perform this step.
    pool.query.mockReset();
  });

  // Define a single test case and its expectations.
  test('tryAcquireJobLock queries namespaced hashtext lock', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: true }] }) };

    // Wait until the asynchronous operation resolves.
    await expect(tryAcquireJobLock(client, 'cleanup.outdated_dates')).resolves.toBe(true);

    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith(
      // Continue the surrounding logic with this statement.
      'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
      // Contribute this line to the enclosing declaration or statement.
      [ADVISORY_LOCK_NS.JOB, 'cleanup.outdated_dates']
    );
  });

  // Define a single test case and its expectations.
  test('releaseJobLock queries namespaced unlock', async () => {
    // Create the client constant.
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    // Wait until the asynchronous operation resolves.
    await releaseJobLock(client, 'fleet.alerts');

    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, hashtext($2))', [
      // Contribute this line to the enclosing declaration or statement.
      ADVISORY_LOCK_NS.JOB,
      // Supply the literal value used by the enclosing expression.
      'fleet.alerts',
    ]);
  });

  // Define a single test case and its expectations.
  test('runs work when the lock is acquired and unlocks before release', async () => {
    // Create the events constant.
    const events = [];
    // Create the client constant.
    const client = {
      // Provide the query field value.
      query: jest.fn(async (sql) => {
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_try_advisory_lock')) {
          // Call events.push to perform this step.
          events.push('try');
          // Return the resulting value to the caller.
          return { rows: [{ acquired: true }] };
        }
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_advisory_unlock')) {
          // Call events.push to perform this step.
          events.push('unlock');
          // Return the resulting value to the caller.
          return { rows: [] };
        }
        // Return the resulting value to the caller.
        return { rows: [] };
      }),
      // Provide the release field value.
      release: jest.fn(() => {
        // Call events.push to perform this step.
        events.push('release');
      }),
    };
    // Call pool.connect.mockResolvedValue to perform this step.
    pool.connect.mockResolvedValue(client);

    // Create the outcome constant.
    const outcome = await withJobLock('notifications.worker', async () => {
      // Call events.push to perform this step.
      events.push('work');
      // Return the resulting value to the caller.
      return 'done';
    });

    // Assert that the value matches the intended expectation.
    expect(outcome).toEqual({ skipped: false, result: 'done' });
    // Assert that the value matches the intended expectation.
    expect(events).toEqual(['try', 'work', 'unlock', 'release']);
  });

  // Define a single test case and its expectations.
  test('returns skipped when the lock is held without calling work', async () => {
    // Create the work constant.
    const work = jest.fn();
    // Create the client constant.
    const client = {
      // Provide the query field value.
      query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
      // Provide the release field value.
      release: jest.fn(),
    };
    // Call pool.connect.mockResolvedValue to perform this step.
    pool.connect.mockResolvedValue(client);

    // Wait until the asynchronous operation resolves.
    await expect(withJobLock('metrics.gauges', work)).resolves.toEqual({ skipped: true });
    // Assert that the value matches the intended expectation.
    expect(work).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(client.release).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(client.query).not.toHaveBeenCalledWith(
      // Call expect.stringContaining to perform this step.
      expect.stringContaining('pg_advisory_unlock'),
      // Call expect.anything to perform this step.
      expect.anything()
    );
  });

  // Define a single test case and its expectations.
  test('unlocks and releases when work throws', async () => {
    // Create the events constant.
    const events = [];
    // Create the client constant.
    const client = {
      // Provide the query field value.
      query: jest.fn(async (sql) => {
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_try_advisory_lock')) {
          // Return the resulting value to the caller.
          return { rows: [{ acquired: true }] };
        }
        // Evaluate the condition and enter the branch when it is true.
        if (String(sql).includes('pg_advisory_unlock')) {
          // Call events.push to perform this step.
          events.push('unlock');
          // Return the resulting value to the caller.
          return { rows: [] };
        }
        // Return the resulting value to the caller.
        return { rows: [] };
      }),
      // Provide the release field value.
      release: jest.fn(() => {
        // Call events.push to perform this step.
        events.push('release');
      }),
    };
    // Call pool.connect.mockResolvedValue to perform this step.
    pool.connect.mockResolvedValue(client);

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call withJobLock to perform this step.
      withJobLock('cleanup.car_images', async () => {
        // Call events.push to perform this step.
        events.push('work');
        // Throw an error to stop the current control flow.
        throw new Error('cleanup failed');
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toThrow('cleanup failed');

    // Assert that the value matches the intended expectation.
    expect(events).toEqual(['work', 'unlock', 'release']);
  });

  // Define a single test case and its expectations.
  test('rejects invalid job keys', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(withJobLock('', jest.fn())).rejects.toThrow('Invalid job key for advisory lock');
    // Assert that the value matches the intended expectation.
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
