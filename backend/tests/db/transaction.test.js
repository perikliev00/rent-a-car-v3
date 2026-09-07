jest.mock('../../src/db/pool', () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

const pool = require('../../src/db/pool');
const {
  isUniqueViolation,
  isCarDateBlockOverlapViolation,
  isReservationHoldOverlapViolation,
  isActiveSessionHoldUniqueViolation,
  acquireCarAdvisoryLock,
  acquireCarAdvisoryLocks,
  acquireSessionAdvisoryLock,
  tryAcquireReservationCheckoutLock,
  acquireReservationCheckoutLock,
  releaseReservationCheckoutLock,
  withReservationCheckoutLock,
  isCheckoutLockBusyError,
  withJobLock,
  tryAcquireJobLock,
  releaseJobLock,
  ADVISORY_LOCK_NS,
  ACTIVE_SESSION_HOLD_UNIQUE_INDEX,
} = require('../../src/db/transaction');

describe('transaction error helpers', () => {
  test('isUniqueViolation detects postgres unique violations', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
  });

  test('isCheckoutLockBusyError detects checkout lock busy', () => {
    expect(isCheckoutLockBusyError({ code: 'CHECKOUT_LOCK_BUSY' })).toBe(true);
    expect(isCheckoutLockBusyError({ code: 'OTHER' })).toBe(false);
    expect(isCheckoutLockBusyError(null)).toBe(false);
  });

  test('isCarDateBlockOverlapViolation detects car block overlap', () => {
    expect(
      isCarDateBlockOverlapViolation({
        code: '23P01',
        constraint: 'no_overlapping_car_blocks',
      })
    ).toBe(true);
  });

  test('isReservationHoldOverlapViolation detects reservation hold overlap', () => {
    expect(
      isReservationHoldOverlapViolation({
        code: '23P01',
        constraint: 'no_overlapping_active_reservation_holds',
      })
    ).toBe(true);
  });

  test('isActiveSessionHoldUniqueViolation detects the session hold unique index', () => {
    expect(
      isActiveSessionHoldUniqueViolation({
        code: '23505',
        constraint: ACTIVE_SESSION_HOLD_UNIQUE_INDEX,
      })
    ).toBe(true);
    expect(
      isActiveSessionHoldUniqueViolation({
        code: '23505',
        constraint: 'idx_reservations_stripe_session_unique',
      })
    ).toBe(false);
    expect(isActiveSessionHoldUniqueViolation({ code: '23505' })).toBe(false);
  });

  test('acquireCarAdvisoryLock queries namespaced pg_advisory_xact_lock', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await acquireCarAdvisoryLock(client, 42);

    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, $2)', [
      ADVISORY_LOCK_NS.CAR,
      42,
    ]);
  });

  test('acquireCarAdvisoryLock rejects invalid car id', async () => {
    const client = { query: jest.fn() };

    await expect(acquireCarAdvisoryLock(client, 'bad')).rejects.toThrow(
      'Invalid car id for advisory lock'
    );
    expect(client.query).not.toHaveBeenCalled();
  });

  test('acquireCarAdvisoryLocks locks unique ids in sorted order', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await acquireCarAdvisoryLocks(client, [9, 3, 9, 1]);

    expect(client.query.mock.calls).toEqual([
      ['SELECT pg_advisory_xact_lock($1, $2)', [ADVISORY_LOCK_NS.CAR, 1]],
      ['SELECT pg_advisory_xact_lock($1, $2)', [ADVISORY_LOCK_NS.CAR, 3]],
      ['SELECT pg_advisory_xact_lock($1, $2)', [ADVISORY_LOCK_NS.CAR, 9]],
    ]);
  });

  test('acquireSessionAdvisoryLock uses namespaced hashtext', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await acquireSessionAdvisoryLock(client, 'sess-abc');

    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, hashtext($2))', [
      ADVISORY_LOCK_NS.SESSION,
      'sess-abc',
    ]);
  });

  test('acquireSessionAdvisoryLock rejects invalid session id', async () => {
    const client = { query: jest.fn() };

    await expect(acquireSessionAdvisoryLock(client, '')).rejects.toThrow(
      'Invalid session id for advisory lock'
    );
    expect(client.query).not.toHaveBeenCalled();
  });

  test('acquireReservationCheckoutLock queries namespaced pg_try_advisory_lock', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: true }] }) };

    await acquireReservationCheckoutLock(client, 42);

    expect(client.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
      ADVISORY_LOCK_NS.CHECKOUT,
      42,
    ]);
  });

  test('tryAcquireReservationCheckoutLock returns false when the lock is held', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }) };

    await expect(tryAcquireReservationCheckoutLock(client, 42)).resolves.toBe(false);
  });

  test('acquireReservationCheckoutLock throws when the lock is not acquired', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }) };

    await expect(acquireReservationCheckoutLock(client, 42)).rejects.toMatchObject({
      code: 'CHECKOUT_LOCK_BUSY',
    });
  });

  test('releaseReservationCheckoutLock queries namespaced pg_advisory_unlock', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await releaseReservationCheckoutLock(client, 42);

    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, $2)', [
      ADVISORY_LOCK_NS.CHECKOUT,
      42,
    ]);
  });

  test('acquireReservationCheckoutLock rejects invalid reservation id', async () => {
    const client = { query: jest.fn() };

    await expect(acquireReservationCheckoutLock(client, 'bad')).rejects.toThrow(
      'Invalid reservation id for checkout lock'
    );
    expect(client.query).not.toHaveBeenCalled();
  });

  test('CHECKOUT namespace is distinct from CAR and SESSION', () => {
    expect(ADVISORY_LOCK_NS.CHECKOUT).toBe(3);
    expect(ADVISORY_LOCK_NS.CHECKOUT).not.toBe(ADVISORY_LOCK_NS.CAR);
    expect(ADVISORY_LOCK_NS.CHECKOUT).not.toBe(ADVISORY_LOCK_NS.SESSION);
  });

  test('JOB namespace is distinct from CAR, SESSION, and CHECKOUT', () => {
    expect(ADVISORY_LOCK_NS.JOB).toBe(4);
    expect(ADVISORY_LOCK_NS.JOB).not.toBe(ADVISORY_LOCK_NS.CAR);
    expect(ADVISORY_LOCK_NS.JOB).not.toBe(ADVISORY_LOCK_NS.SESSION);
    expect(ADVISORY_LOCK_NS.JOB).not.toBe(ADVISORY_LOCK_NS.CHECKOUT);
  });
});

describe('withReservationCheckoutLock', () => {
  beforeEach(() => {
    pool.connect.mockReset();
    pool.query.mockReset();
  });

  test('releases the pool client before sleeping when the lock is busy', async () => {
    const events = [];
    const sleep = jest.fn(async () => {
      events.push('sleep');
    });

    const busyClient = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('pg_try_advisory_lock')) {
          events.push('try-busy');
          return { rows: [{ acquired: false }] };
        }
        return { rows: [] };
      }),
      release: jest.fn(() => {
        events.push('release-busy');
      }),
    };
    const heldClient = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('pg_try_advisory_lock')) {
          events.push('try-held');
          return { rows: [{ acquired: true }] };
        }
        if (String(sql).includes('pg_advisory_unlock')) {
          events.push('unlock');
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn(() => {
        events.push('release-held');
      }),
    };

    pool.connect.mockResolvedValueOnce(busyClient).mockResolvedValueOnce(heldClient);

    const work = jest.fn(async () => {
      events.push('work');
      return 'ok';
    });

    await expect(
      withReservationCheckoutLock(42, work, { sleep, delayMsForAttempt: () => 1 })
    ).resolves.toBe('ok');

    expect(events).toEqual([
      'try-busy',
      'release-busy',
      'sleep',
      'try-held',
      'work',
      'unlock',
      'release-held',
    ]);
    expect(work).toHaveBeenCalledTimes(1);
    expect(busyClient.query).not.toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_lock($1, $2)'),
      expect.anything()
    );
  });

  test('unlocks and releases the client when work throws', async () => {
    const events = [];
    const heldClient = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: true }] };
        }
        if (String(sql).includes('pg_advisory_unlock')) {
          events.push('unlock');
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn(() => {
        events.push('release');
      }),
    };

    pool.connect.mockResolvedValue(heldClient);

    await expect(
      withReservationCheckoutLock(42, async () => {
        events.push('work');
        throw new Error('stripe down');
      })
    ).rejects.toThrow('stripe down');

    expect(events).toEqual(['work', 'unlock', 'release']);
  });

  test('throws CHECKOUT_LOCK_BUSY after bounded retries without holding a client', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    await expect(
      withReservationCheckoutLock(42, jest.fn(), {
        maxAttempts: 3,
        sleep,
        delayMsForAttempt: () => 5,
      })
    ).rejects.toMatchObject({ code: 'CHECKOUT_LOCK_BUSY' });

    expect(pool.connect).toHaveBeenCalledTimes(3);
    expect(client.release).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
      ADVISORY_LOCK_NS.CHECKOUT,
      42,
    ]);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_unlock'),
      expect.anything()
    );
  });
});

describe('withJobLock', () => {
  beforeEach(() => {
    pool.connect.mockReset();
    pool.query.mockReset();
  });

  test('tryAcquireJobLock queries namespaced hashtext lock', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ acquired: true }] }) };

    await expect(tryAcquireJobLock(client, 'cleanup.outdated_dates')).resolves.toBe(true);

    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
      [ADVISORY_LOCK_NS.JOB, 'cleanup.outdated_dates']
    );
  });

  test('releaseJobLock queries namespaced unlock', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await releaseJobLock(client, 'fleet.alerts');

    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, hashtext($2))', [
      ADVISORY_LOCK_NS.JOB,
      'fleet.alerts',
    ]);
  });

  test('runs work when the lock is acquired and unlocks before release', async () => {
    const events = [];
    const client = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('pg_try_advisory_lock')) {
          events.push('try');
          return { rows: [{ acquired: true }] };
        }
        if (String(sql).includes('pg_advisory_unlock')) {
          events.push('unlock');
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn(() => {
        events.push('release');
      }),
    };
    pool.connect.mockResolvedValue(client);

    const outcome = await withJobLock('notifications.worker', async () => {
      events.push('work');
      return 'done';
    });

    expect(outcome).toEqual({ skipped: false, result: 'done' });
    expect(events).toEqual(['try', 'work', 'unlock', 'release']);
  });

  test('returns skipped when the lock is held without calling work', async () => {
    const work = jest.fn();
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ acquired: false }] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    await expect(withJobLock('metrics.gauges', work)).resolves.toEqual({ skipped: true });
    expect(work).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_unlock'),
      expect.anything()
    );
  });

  test('unlocks and releases when work throws', async () => {
    const events = [];
    const client = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: true }] };
        }
        if (String(sql).includes('pg_advisory_unlock')) {
          events.push('unlock');
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: jest.fn(() => {
        events.push('release');
      }),
    };
    pool.connect.mockResolvedValue(client);

    await expect(
      withJobLock('cleanup.car_images', async () => {
        events.push('work');
        throw new Error('cleanup failed');
      })
    ).rejects.toThrow('cleanup failed');

    expect(events).toEqual(['work', 'unlock', 'release']);
  });

  test('rejects invalid job keys', async () => {
    await expect(withJobLock('', jest.fn())).rejects.toThrow('Invalid job key for advisory lock');
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
