jest.mock('../../../../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn(async ({ reservationId, newStatus, patch }) => ({
    reservation: {
      id: reservationId,
      status: newStatus,
      holdExpiresAt: patch?.holdExpiresAt || new Date(),
    },
    changed: true,
    oldStatus: 'pending_payment',
    newStatus,
  })),
}));

const { changeStatus } = require('../../../../src/services/reservation/reservationStatusService');
const {
  compensateReservationAfterStripeFailure,
} = require('../../../../src/services/payment/checkout/checkoutCompensationService');

describe('compensateReservationAfterStripeFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('no-ops when reservation is missing', async () => {
    await compensateReservationAfterStripeFailure(null);
    expect(changeStatus).not.toHaveBeenCalled();
  });

  test('cancels reservation and expires hold when created this step', async () => {
    const reservation = { id: '42', status: 'pending_payment' };

    await compensateReservationAfterStripeFailure(reservation, true);

    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: '42',
        newStatus: 'cancelled',
        reason: 'stripe_checkout_failed',
        patch: expect.objectContaining({ holdExpiresAt: expect.any(Date) }),
      })
    );
  });

  test('keeps existing hold when reservation was not created this step', async () => {
    const reservation = { id: '42', status: 'pending_payment' };

    await compensateReservationAfterStripeFailure(reservation, false);

    expect(changeStatus).not.toHaveBeenCalled();
  });
});
