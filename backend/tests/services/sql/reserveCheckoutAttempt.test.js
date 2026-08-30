const { reserveCheckoutAttempt } = require('../../../src/services/sql/reservation/reservationLifecycleRepository');

describe('reserveCheckoutAttempt', () => {
  test('reuses or bumps the attempt and clears stripe_session_id', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ stripe_checkout_attempt: 1 }],
      }),
    };

    const attempt = await reserveCheckoutAttempt(42, { client });

    expect(attempt).toBe(1);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('stripe_checkout_attempt'),
      [42, false]
    );
    expect(client.query.mock.calls[0][0]).toContain('stripe_session_id = NULL');
  });

  test('forceIncrement always increments', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ stripe_checkout_attempt: 3 }],
      }),
    };

    const attempt = await reserveCheckoutAttempt(42, { forceIncrement: true, client });

    expect(attempt).toBe(3);
    expect(client.query).toHaveBeenCalledWith(expect.any(String), [42, true]);
  });

  test('rejects invalid reservation id', async () => {
    const client = { query: jest.fn() };
    await expect(reserveCheckoutAttempt('bad', { client })).rejects.toThrow(
      'Invalid reservation id'
    );
    expect(client.query).not.toHaveBeenCalled();
  });
});
