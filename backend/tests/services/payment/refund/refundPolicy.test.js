const { amountCentsFromReservation } = require('../../../../src/services/payment/refund/refundPolicy');

describe('amountCentsFromReservation', () => {
  test('uses resolved remaining amount even when totalPrice is lower', () => {
    expect(
      amountCentsFromReservation(
        { totalPrice: 40, paidAmountCents: 4000 },
        { amountCents: 10000 }
      )
    ).toBe(10000);
  });

  test('uses paidAmountCents snapshot when resolved amount is missing', () => {
    expect(
      amountCentsFromReservation(
        { totalPrice: 40, paidAmountCents: 10000 },
        { amountCents: null }
      )
    ).toBe(10000);
  });

  test('does not use mutable totalPrice', async () => {
    await expect(
      Promise.resolve().then(() =>
        amountCentsFromReservation({ totalPrice: 120 }, { amountCents: null })
      )
    ).rejects.toMatchObject({
      code: 'REFUND_NO_AMOUNT',
    });
  });

  test('throws REFUND_NO_AMOUNT when Stripe remaining is zero', async () => {
    await expect(
      Promise.resolve().then(() =>
        amountCentsFromReservation(
          { totalPrice: 120, paidAmountCents: 10000 },
          { amountCents: 0 }
        )
      )
    ).rejects.toMatchObject({
      code: 'REFUND_NO_AMOUNT',
    });
  });
});
