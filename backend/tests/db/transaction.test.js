const {
  isUniqueViolation,
  isCarDateBlockOverlapViolation,
  isReservationHoldOverlapViolation,
  isActiveSessionHoldUniqueViolation,
  acquireCarAdvisoryLock,
  acquireCarAdvisoryLocks,
  acquireSessionAdvisoryLock,
  acquireReservationCheckoutLock,
  releaseReservationCheckoutLock,
  ADVISORY_LOCK_NS,
  ACTIVE_SESSION_HOLD_UNIQUE_INDEX,
} = require('../../src/db/transaction');

describe('transaction error helpers', () => {
  test('isUniqueViolation detects postgres unique violations', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
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

  test('acquireReservationCheckoutLock queries namespaced pg_advisory_lock', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await acquireReservationCheckoutLock(client, 42);

    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_lock($1, $2)', [
      ADVISORY_LOCK_NS.CHECKOUT,
      42,
    ]);
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
});
