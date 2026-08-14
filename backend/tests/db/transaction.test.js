const {
  isUniqueViolation,
  isCarDateBlockOverlapViolation,
  isReservationHoldOverlapViolation,
  acquireCarAdvisoryLock,
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

  test('acquireCarAdvisoryLock queries pg_advisory_xact_lock for valid car id', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await acquireCarAdvisoryLock(client, 42);

    expect(client.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', [42]);
  });

  test('acquireCarAdvisoryLock rejects invalid car id', async () => {
    const client = { query: jest.fn() };

    await expect(acquireCarAdvisoryLock(client, 'bad')).rejects.toThrow(
      'Invalid car id for advisory lock'
    );
    expect(client.query).not.toHaveBeenCalled();
  });
});
