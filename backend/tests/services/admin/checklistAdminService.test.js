// Call jest.mock to perform this step.
jest.mock('../../../src/services/storage/privateStorageService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/fileUpload/uploadUtils', () => ({
  // Provide the remove uploaded file field value.
  removeUploadedFile: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/pickupChecklistSqlService', () => ({
  // Provide the upsert field value.
  upsert: jest.fn(),
  // Provide the find by reservation id field value.
  findByReservationId: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/returnChecklistSqlService', () => ({
  // Provide the upsert field value.
  upsert: jest.fn(),
  // Provide the find by reservation id field value.
  findByReservationId: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/cancellationRequestSqlService', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
  // Provide the review field value.
  review: jest.fn(),
  // Provide the list pending field value.
  listPending: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/carDamageReportSqlService', () => ({
  // Provide the insert field value.
  insert: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/pdf/pdfDocumentService', () => ({
  // Provide the generate pdf field value.
  generatePdf: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/payment/refund/reservationRefundService', () => ({
  // Provide the request reservation refund field value.
  requestReservationRefund: jest.fn(),
}));

// Require the '../../../src/services/sql/cancellationRequestSqlService' module as cancellationSql.
const cancellationSql = require('../../../src/services/sql/cancellationRequestSqlService');
// Require the '../../../src/services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../../src/services/sql/reservationSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../../src/services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  requestReservationRefund,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/payment/refund/reservationRefundService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  reviewCancellationRequest,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/admin/checklistAdminService');

// Define the reqWithPermissions function.
function reqWithPermissions(permissions = []) {
  // Return the resulting value to the caller.
  return {
    // Provide the session field value.
    session: {
      // Provide the user field value.
      user: {
        // Provide the id field value.
        id: 9,
        // Provide the roles field value.
        roles: [],
        // Contribute this line to the enclosing declaration or statement.
        permissions,
      },
    },
  };
}

// Declare a test suite grouping related cases.
describe('reviewCancellationRequest', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call cancellationSql.findById.mockResolvedValue to perform this step.
    cancellationSql.findById.mockResolvedValue({
      // Provide the id field value.
      id: 5,
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the status field value.
      status: 'pending',
    });
    // Call cancellationSql.review.mockImplementation to perform this step.
    cancellationSql.review.mockImplementation(async ({ status }) => ({
      // Provide the id field value.
      id: 5,
      // Provide the reservation id field value.
      reservationId: 1,
      // Contribute this line to the enclosing declaration or statement.
      status,
    }));
  });

  // Define a single test case and its expectations.
  test('refundable reservation + approve refunds instead of cancelling', async () => {
    // Create the req constant.
    const req = reqWithPermissions(['can_refund_payments']);
    // Call reservationSql.findById.mockResolvedValue to perform this step.
    reservationSql.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });
    // Call requestReservationRefund.mockResolvedValue to perform this step.
    requestReservationRefund.mockResolvedValue({
      // Provide the status field value.
      status: 'succeeded',
      // Provide the reservation field value.
      reservation: { id: 1, status: 'refunded' },
      // Provide the refund operation field value.
      refundOperation: { id: 10, status: 'succeeded' },
    });

    // Create the result constant.
    const result = await reviewCancellationRequest(req, 5, {
      // Provide the approve field value.
      approve: true,
      // Provide the admin note field value.
      adminNote: 'ok',
    });

    // Assert that the value matches the intended expectation.
    expect(requestReservationRefund).toHaveBeenCalledWith(
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ reservationId: 1 })
    );
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(cancellationSql.review).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ status: 'approved' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.reservation.status).toBe('refunded');
  });

  // Define a single test case and its expectations.
  test('refundable approve without can_refund_payments is forbidden', async () => {
    // Create the req constant.
    const req = reqWithPermissions(['can_cancel_orders']);
    // Call reservationSql.findById.mockResolvedValue to perform this step.
    reservationSql.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });

    // Wait until the asynchronous operation resolves.
    await expect(reviewCancellationRequest(req, 5, { approve: true })).rejects.toMatchObject({
      // Provide the code field value.
      code: 'FORBIDDEN',
      // Provide the status field value.
      status: 403,
    });

    // Assert that the value matches the intended expectation.
    expect(requestReservationRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(cancellationSql.review).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('unpaid / no PI approve cancels as today', async () => {
    // Create the req constant.
    const req = reqWithPermissions(['can_refund_payments']);
    // Call reservationSql.findById.mockResolvedValue to perform this step.
    reservationSql.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
    });
    // Call requestReservationRefund.mockRejectedValue to perform this step.
    requestReservationRefund.mockRejectedValue(
      // Call Object.assign to perform this step.
      Object.assign(new Error('no pi'), {
        // Provide the code field value.
        code: 'REFUND_NO_PAYMENT_INTENT',
        // Provide the status field value.
        status: 422,
      })
    );
    // Call changeStatus.mockResolvedValue to perform this step.
    changeStatus.mockResolvedValue({
      // Provide the reservation field value.
      reservation: { id: 1, status: 'cancelled' },
      // Provide the changed field value.
      changed: true,
    });

    // Create the result constant.
    const result = await reviewCancellationRequest(req, 5, { approve: true });

    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ newStatus: 'cancelled' })
    );
    // Assert that the value matches the intended expectation.
    expect(cancellationSql.review).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ status: 'approved' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.reservation.status).toBe('cancelled');
  });

  // Define a single test case and its expectations.
  test('non-refundable approve without refund permission cancels only', async () => {
    // Create the req constant.
    const req = reqWithPermissions(['can_cancel_orders']);
    // Call reservationSql.findById.mockResolvedValue to perform this step.
    reservationSql.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'picked_up',
    });
    // Call changeStatus.mockResolvedValue to perform this step.
    changeStatus.mockResolvedValue({
      // Provide the reservation field value.
      reservation: { id: 1, status: 'cancelled' },
      // Provide the changed field value.
      changed: true,
    });

    // Create the result constant.
    const result = await reviewCancellationRequest(req, 5, { approve: true });

    // Assert that the value matches the intended expectation.
    expect(requestReservationRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ newStatus: 'cancelled' })
    );
    // Assert that the value matches the intended expectation.
    expect(cancellationSql.review).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ status: 'approved' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.reservation.status).toBe('cancelled');
  });

  // Define a single test case and its expectations.
  test('reject without refund permission does not refund or cancel', async () => {
    // Create the req constant.
    const req = reqWithPermissions(['can_cancel_orders']);
    // Call reservationSql.findById.mockResolvedValue to perform this step.
    reservationSql.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
    });

    // Create the result constant.
    const result = await reviewCancellationRequest(req, 5, { approve: false });

    // Assert that the value matches the intended expectation.
    expect(requestReservationRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(cancellationSql.review).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ status: 'rejected' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.cancellationRequest.status).toBe('rejected');
  });
});
