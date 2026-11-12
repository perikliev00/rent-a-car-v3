// Call jest.mock to perform this step.
jest.mock('../../../../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn(async ({ reservationId, newStatus, patch }) => ({
    // Provide the reservation field value.
    reservation: {
      // Provide the id field value.
      id: reservationId,
      // Provide the status field value.
      status: newStatus,
      // Provide the hold expires at field value.
      holdExpiresAt: patch?.holdExpiresAt || new Date(),
    },
    // Provide the changed field value.
    changed: true,
    // Provide the old status field value.
    oldStatus: 'pending_payment',
    // Contribute this line to the enclosing declaration or statement.
    newStatus,
  })),
}));

// Destructure object properties into local variables.
const { changeStatus } = require('../../../../src/services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  compensateReservationAfterStripeFailure,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/checkout/checkoutCompensationService');

// Declare a test suite grouping related cases.
describe('compensateReservationAfterStripeFailure', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('no-ops when reservation is missing', async () => {
    // Wait until the asynchronous operation resolves.
    await compensateReservationAfterStripeFailure(null);
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('cancels reservation and expires hold when created this step', async () => {
    // Create the reservation constant.
    const reservation = { id: '42', status: 'pending_payment' };

    // Wait until the asynchronous operation resolves.
    await compensateReservationAfterStripeFailure(reservation, true);

    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the new status field value.
        newStatus: 'cancelled',
        // Provide the reason field value.
        reason: 'stripe_checkout_failed',
        // Provide the patch field value.
        patch: expect.objectContaining({ holdExpiresAt: expect.any(Date) }),
      })
    );
  });

  // Define a single test case and its expectations.
  test('keeps existing hold when reservation was not created this step', async () => {
    // Create the reservation constant.
    const reservation = { id: '42', status: 'pending_payment' };

    // Wait until the asynchronous operation resolves.
    await compensateReservationAfterStripeFailure(reservation, false);

    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
  });
});
