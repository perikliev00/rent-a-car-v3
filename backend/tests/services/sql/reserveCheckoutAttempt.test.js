// Destructure object properties into local variables.
const { reserveCheckoutAttempt } = require('../../../src/services/sql/reservation/reservationLifecycleRepository');

// Declare a test suite grouping related cases.
describe('reserveCheckoutAttempt', () => {
  // Define a single test case and its expectations.
  test('reuses or bumps the attempt and clears stripe_session_id', async () => {
    // Create the client constant.
    const client = {
      // Provide the query field value.
      query: jest.fn().mockResolvedValue({
        // Provide the row count field value.
        rowCount: 1,
        // Provide the rows field value.
        rows: [{ stripe_checkout_attempt: 1 }],
      }),
    };

    // Create the attempt constant.
    const attempt = await reserveCheckoutAttempt(42, { client });

    // Assert that the value matches the intended expectation.
    expect(attempt).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith(
      // Call expect.stringContaining to perform this step.
      expect.stringContaining('stripe_checkout_attempt'),
      // Contribute this line to the enclosing declaration or statement.
      [42, false]
    );
    // Assert that the value matches the intended expectation.
    expect(client.query.mock.calls[0][0]).toContain('stripe_session_id = NULL');
  });

  // Define a single test case and its expectations.
  test('forceIncrement always increments', async () => {
    // Create the client constant.
    const client = {
      // Provide the query field value.
      query: jest.fn().mockResolvedValue({
        // Provide the row count field value.
        rowCount: 1,
        // Provide the rows field value.
        rows: [{ stripe_checkout_attempt: 3 }],
      }),
    };

    // Create the attempt constant.
    const attempt = await reserveCheckoutAttempt(42, { forceIncrement: true, client });

    // Assert that the value matches the intended expectation.
    expect(attempt).toBe(3);
    // Assert that the value matches the intended expectation.
    expect(client.query).toHaveBeenCalledWith(expect.any(String), [42, true]);
  });

  // Define a single test case and its expectations.
  test('rejects invalid reservation id', async () => {
    // Create the client constant.
    const client = { query: jest.fn() };
    // Wait until the asynchronous operation resolves.
    await expect(reserveCheckoutAttempt('bad', { client })).rejects.toThrow(
      // Supply the literal value used by the enclosing expression.
      'Invalid reservation id'
    );
    // Assert that the value matches the intended expectation.
    expect(client.query).not.toHaveBeenCalled();
  });
});
