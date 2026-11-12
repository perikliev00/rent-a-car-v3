// Destructure object properties into local variables.
const { amountCentsFromReservation } = require('../../../../src/services/payment/refund/refundPolicy');

// Declare a test suite grouping related cases.
describe('amountCentsFromReservation', () => {
  // Define a single test case and its expectations.
  test('uses resolved remaining amount even when totalPrice is lower', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call amountCentsFromReservation to perform this step.
      amountCentsFromReservation(
        // Contribute this line to the enclosing declaration or statement.
        { totalPrice: 40, paidAmountCents: 4000 },
        // Contribute this line to the enclosing declaration or statement.
        { amountCents: 10000 }
      )
    // Continue the surrounding logic with this statement.
    ).toBe(10000);
  });

  // Define a single test case and its expectations.
  test('uses paidAmountCents snapshot when resolved amount is missing', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call amountCentsFromReservation to perform this step.
      amountCentsFromReservation(
        // Contribute this line to the enclosing declaration or statement.
        { totalPrice: 40, paidAmountCents: 10000 },
        // Contribute this line to the enclosing declaration or statement.
        { amountCents: null }
      )
    // Continue the surrounding logic with this statement.
    ).toBe(10000);
  });

  // Define a single test case and its expectations.
  test('does not use mutable totalPrice', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(
      // Call Promise.resolve to perform this step.
      Promise.resolve().then(() =>
        // Call amountCentsFromReservation to perform this step.
        amountCentsFromReservation({ totalPrice: 120 }, { amountCents: null })
      )
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_NO_AMOUNT',
    });
  });

  // Define a single test case and its expectations.
  test('throws REFUND_NO_AMOUNT when Stripe remaining is zero', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(
      // Call Promise.resolve to perform this step.
      Promise.resolve().then(() =>
        // Call amountCentsFromReservation to perform this step.
        amountCentsFromReservation(
          // Contribute this line to the enclosing declaration or statement.
          { totalPrice: 120, paidAmountCents: 10000 },
          // Contribute this line to the enclosing declaration or statement.
          { amountCents: 0 }
        )
      )
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_NO_AMOUNT',
    });
  });
});
