// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  // Provide the insert refund operation field value.
  insertRefundOperation: jest.fn(),
  // Provide the find by id field value.
  findById: jest.fn(),
  // Provide the find by idempotency key field value.
  findByIdempotencyKey: jest.fn(),
  // Provide the find active by reservation id field value.
  findActiveByReservationId: jest.fn(),
  // Provide the update refund operation field value.
  updateRefundOperation: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/reservationSqlService', () => ({
  // Provide the apply status change field value.
  applyStatusChange: jest.fn(),
}));

// Require the '../../../../src/services/sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createPendingOperation,
  // Contribute this line to the enclosing declaration or statement.
  markRefundFailed,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/refundLedgerService');

// Create the unique err constant.
const uniqueErr = { code: '23505' };

// Define the baseArgs function.
function baseArgs() {
  // Return the resulting value to the caller.
  return {
    // Provide the reservation field value.
    reservation: { id: 1 },
    // Provide the order field value.
    order: { id: 77 },
    // Provide the payment intent id field value.
    paymentIntentId: 'pi_1',
    // Provide the amount cents field value.
    amountCents: 10000,
    // Provide the currency field value.
    currency: 'eur',
    // Provide the reason field value.
    reason: 'admin',
    // Provide the requested by user id field value.
    requestedByUserId: 9,
  };
}

// Declare a test suite grouping related cases.
describe('refundLedgerService.createPendingOperation', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);
  });

  // Define a single test case and its expectations.
  test('unique conflict, byKey failed → insert attempt2, do not return failed', async () => {
    // Contribute this line to the enclosing declaration or statement.
    refundOpSql.insertRefundOperation
      // Call .mockRejectedValueOnce to perform this step.
      .mockRejectedValueOnce(uniqueErr)
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the id field value.
        id: 2,
        // Provide the status field value.
        status: 'pending',
        // Provide the reservation id field value.
        reservationId: 1,
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:reservation:1:full:attempt2',
      });
    // Call refundOpSql.findByIdempotencyKey.mockResolvedValue to perform this step.
    refundOpSql.findByIdempotencyKey.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'failed',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    });

    // Create the op constant.
    const op = await createPendingOperation(baseArgs());

    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(op.id).toBe(2);
    // Assert that the value matches the intended expectation.
    expect(op.idempotencyKey).toBe('refund:reservation:1:full:attempt2');
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.insertRefundOperation).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.insertRefundOperation.mock.calls[1][0].idempotencyKey).toBe(
      // Supply the literal value used by the enclosing expression.
      'refund:reservation:1:full:attempt2'
    );
  });

  // Define a single test case and its expectations.
  test('unique conflict pending → return pending', async () => {
    // Call refundOpSql.insertRefundOperation.mockRejectedValue to perform this step.
    refundOpSql.insertRefundOperation.mockRejectedValue(uniqueErr);
    // Call refundOpSql.findByIdempotencyKey.mockResolvedValue to perform this step.
    refundOpSql.findByIdempotencyKey.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    });

    // Create the op constant.
    const op = await createPendingOperation(baseArgs());

    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(op.id).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.insertRefundOperation).toHaveBeenCalledTimes(1);
  });

  // Define a single test case and its expectations.
  test('unique conflict succeeded → return succeeded', async () => {
    // Call refundOpSql.insertRefundOperation.mockRejectedValue to perform this step.
    refundOpSql.insertRefundOperation.mockRejectedValue(uniqueErr);
    // Call refundOpSql.findByIdempotencyKey.mockResolvedValue to perform this step.
    refundOpSql.findByIdempotencyKey.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'succeeded',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    });

    // Create the op constant.
    const op = await createPendingOperation(baseArgs());

    // Assert that the value matches the intended expectation.
    expect(op.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(op.id).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.insertRefundOperation).toHaveBeenCalledTimes(1);
  });
});

// Declare a test suite grouping related cases.
describe('refundLedgerService.markRefundFailed', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('update null and find shows succeeded → returns succeeded, does not throw', async () => {
    // Call refundOpSql.updateRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.updateRefundOperation.mockResolvedValue(null);
    // Call refundOpSql.findById.mockResolvedValue to perform this step.
    refundOpSql.findById.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'succeeded',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the stripe refund id field value.
      stripeRefundId: 're_1',
    });

    // Create the result constant.
    const result = await markRefundFailed(
      // Contribute this line to the enclosing declaration or statement.
      { id: 10, status: 'pending' },
      // Contribute this line to the enclosing declaration or statement.
      { code: 'failed', message: 'race' }
    );

    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(result.stripeRefundId).toBe('re_1');
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.findById).toHaveBeenCalledWith(10, null);
  });
});
