// Call jest.mock to perform this step.
jest.mock('../../../../src/repositories/reservationRepository', () => ({
  // Provide the find by id field value.
  findById: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/orderSqlService', () => ({
  // Provide the find order by reservation id field value.
  findOrderByReservationId: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/reservationSqlService', () => ({
  // Provide the find by id for update field value.
  findByIdForUpdate: jest.fn(),
  // Provide the apply status change field value.
  applyStatusChange: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/sql/refundOperationSqlService', () => ({
  // Provide the insert refund operation field value.
  insertRefundOperation: jest.fn(),
  // Provide the find by idempotency key field value.
  findByIdempotencyKey: jest.fn(),
  // Provide the find active by reservation id field value.
  findActiveByReservationId: jest.fn(),
  // Provide the find latest by reservation id field value.
  findLatestByReservationId: jest.fn(),
  // Provide the find by stripe refund id field value.
  findByStripeRefundId: jest.fn(),
  // Provide the find by payment intent id field value.
  findByPaymentIntentId: jest.fn(),
  // Provide the find by id field value.
  findById: jest.fn(),
  // Provide the update refund operation field value.
  updateRefundOperation: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/reservation/reservationStatusService', () => ({
  // Provide the change status field value.
  changeStatus: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/payment/stripeRefundService', () => ({
  // Provide the create refund field value.
  createRefund: jest.fn(),
  // Provide the retrieve refund field value.
  retrieveRefund: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/payment/refund/resolvePaymentIntent', () => {
  // Create the actual constant.
  const actual = jest.requireActual(
    // Supply the literal value used by the enclosing expression.
    '../../../../src/services/payment/refund/resolvePaymentIntent'
  );
  // Return the resulting value to the caller.
  return {
    // Spread actual into the surrounding structure.
    ...actual,
    // Provide the resolve payment intent for reservation field value.
    resolvePaymentIntentForReservation: jest.fn(),
  };
});
// Call jest.mock to perform this step.
jest.mock('../../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
  // Provide the log system action field value.
  logSystemAction: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('../../../../src/db/transaction', () => ({
  // Provide the run with transaction field value.
  runWithTransaction: async (fn) => fn(null),
  // Provide the is unique violation field value.
  isUniqueViolation: () => false,
}));

// Require the '../../../../src/repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../../../src/repositories/reservationRepository');
// Require the '../../../../src/services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../../../src/services/sql/reservationSqlService');
// Require the '../../../../src/services/sql/orderSqlService' module as orderSql.
const orderSql = require('../../../../src/services/sql/orderSqlService');
// Require the '../../../../src/services/sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../../../src/services/sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../../../src/services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createRefund,
  // Contribute this line to the enclosing declaration or statement.
  retrieveRefund,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/stripeRefundService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  resolvePaymentIntentForReservation,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/resolvePaymentIntent');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  requestReservationRefund,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/reservationRefundService');

// Declare a test suite grouping related cases.
describe('reservationRefundService.requestReservationRefund', () => {
  // Create the req constant.
  const req = { session: { user: { id: 9 } } };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call orderSql.findOrderByReservationId.mockResolvedValue to perform this step.
    orderSql.findOrderByReservationId.mockResolvedValue({ id: 77, status: 'active' });
    // Call resolvePaymentIntentForReservation.mockResolvedValue to perform this step.
    resolvePaymentIntentForReservation.mockResolvedValue({
      // Provide the payment intent id field value.
      paymentIntentId: 'pi_1',
      // Provide the amount cents field value.
      amountCents: 10000,
      // Provide the currency field value.
      currency: 'eur',
      // Provide the source field value.
      source: 'reservation',
    });
    // Call changeStatus.mockImplementation to perform this step.
    changeStatus.mockImplementation(async ({ reservationId, newStatus, patch }) => ({
      // Provide the reservation field value.
      reservation: {
        // Provide the id field value.
        id: reservationId,
        // Provide the status field value.
        status: newStatus,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: patch?.stripePaymentIntentId || 'pi_1',
        // Provide the total price field value.
        totalPrice: 100,
      },
      // Provide the changed field value.
      changed: true,
    }));
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 100,
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });
    // Call refundOpSql.findLatestByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findLatestByReservationId.mockResolvedValue(null);
  });

  // Define a single test case and its expectations.
  test('happy path: Stripe succeeded applies refunded status', async () => {
    // Contribute this line to the enclosing declaration or statement.
    reservationRepository.findById
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the id field value.
        id: 1,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the total price field value.
        totalPrice: 100,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: 'pi_1',
      })
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the id field value.
        id: 1,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the total price field value.
        totalPrice: 100,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: 'pi_1',
      })
      // Call .mockResolvedValue to perform this step.
      .mockResolvedValue({
        // Provide the id field value.
        id: 1,
        // Provide the status field value.
        status: 'refunded',
        // Provide the total price field value.
        totalPrice: 100,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: 'pi_1',
      });

    // Contribute this line to the enclosing declaration or statement.
    refundOpSql.findActiveByReservationId
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce(null)
      // Call .mockResolvedValue to perform this step.
      .mockResolvedValue({
        // Provide the id field value.
        id: 10,
        // Provide the status field value.
        status: 'pending',
        // Provide the reservation id field value.
        reservationId: 1,
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:reservation:1:full',
      });

    // Call refundOpSql.insertRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.insertRefundOperation.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    });

    // Call createRefund.mockResolvedValue to perform this step.
    createRefund.mockResolvedValue({
      // Provide the id field value.
      id: 're_1',
      // Provide the status field value.
      status: 'succeeded',
      // Provide the payment intent field value.
      payment_intent: 'pi_1',
      // Provide the amount field value.
      amount: 10000,
    });

    // Call refundOpSql.updateRefundOperation.mockImplementation to perform this step.
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the status field value.
      status: patch.status || 'pending',
      // Provide the stripe refund id field value.
      stripeRefundId: patch.stripeRefundId || 're_1',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    }));

    // Create the result constant.
    const result = await requestReservationRefund(req, { reservationId: 1 });

    // Assert that the value matches the intended expectation.
    expect(createRefund).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the payment intent id field value.
        paymentIntentId: 'pi_1',
        // Provide the amount cents field value.
        amountCents: 10000,
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:reservation:1:full',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ newStatus: 'refunded' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
  });

  // Define a single test case and its expectations.
  test('P0: full refund after reprice uses paid remaining, not mutable totalPrice', async () => {
    // Call resolvePaymentIntentForReservation.mockResolvedValue to perform this step.
    resolvePaymentIntentForReservation.mockResolvedValue({
      // Provide the payment intent id field value.
      paymentIntentId: 'pi_1',
      // Provide the amount cents field value.
      amountCents: 10000,
      // Provide the currency field value.
      currency: 'eur',
      // Provide the source field value.
      source: 'stripe_pi',
      // Provide the paid amount cents field value.
      paidAmountCents: 10000,
    });
    // Contribute this line to the enclosing declaration or statement.
    reservationRepository.findById
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the id field value.
        id: 1,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the total price field value.
        totalPrice: 50,
        // Provide the paid amount cents field value.
        paidAmountCents: 10000,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: 'pi_1',
      })
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the id field value.
        id: 1,
        // Provide the status field value.
        status: 'confirmed',
        // Provide the total price field value.
        totalPrice: 50,
        // Provide the paid amount cents field value.
        paidAmountCents: 10000,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: 'pi_1',
      })
      // Call .mockResolvedValue to perform this step.
      .mockResolvedValue({
        // Provide the id field value.
        id: 1,
        // Provide the status field value.
        status: 'refunded',
        // Provide the total price field value.
        totalPrice: 50,
        // Provide the paid amount cents field value.
        paidAmountCents: 10000,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: 'pi_1',
      });
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 50,
      // Provide the paid amount cents field value.
      paidAmountCents: 10000,
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });
    // Contribute this line to the enclosing declaration or statement.
    refundOpSql.findActiveByReservationId
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce(null)
      // Call .mockResolvedValue to perform this step.
      .mockResolvedValue({
        // Provide the id field value.
        id: 10,
        // Provide the status field value.
        status: 'pending',
        // Provide the reservation id field value.
        reservationId: 1,
        // Provide the amount cents field value.
        amountCents: 10000,
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:reservation:1:full',
      });
    // Call refundOpSql.insertRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.insertRefundOperation.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the amount cents field value.
      amountCents: 10000,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    });
    // Call createRefund.mockResolvedValue to perform this step.
    createRefund.mockResolvedValue({
      // Provide the id field value.
      id: 're_1',
      // Provide the status field value.
      status: 'succeeded',
      // Provide the payment intent field value.
      payment_intent: 'pi_1',
      // Provide the amount field value.
      amount: 10000,
    });
    // Call refundOpSql.updateRefundOperation.mockImplementation to perform this step.
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the status field value.
      status: patch.status || 'pending',
      // Provide the stripe refund id field value.
      stripeRefundId: patch.stripeRefundId || 're_1',
      // Provide the amount cents field value.
      amountCents: 10000,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    }));

    // Create the result constant.
    const result = await requestReservationRefund(req, { reservationId: 1 });

    // Assert that the value matches the intended expectation.
    expect(refundOpSql.insertRefundOperation).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ amountCents: 10000 }),
      // Supply the literal value used by the enclosing expression.
      null
    );
    // Assert that the value matches the intended expectation.
    expect(createRefund).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the payment intent id field value.
        paymentIntentId: 'pi_1',
        // Provide the amount cents field value.
        amountCents: 10000,
      })
    );
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ amountCents: 5000 })
    );
    // Assert that the value matches the intended expectation.
    expect(changeStatus).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ newStatus: 'refunded' })
    );
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
  });

  // Define a single test case and its expectations.
  test('idempotent when already succeeded', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'refunded',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
      // Provide the total price field value.
      totalPrice: 100,
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'succeeded',
      // Provide the reservation id field value.
      reservationId: 1,
    });

    // Create the result constant.
    const result = await requestReservationRefund(req, { reservationId: 1 });
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(result.idempotent).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('refunded with no ledger row is REFUND_LEDGER_INCONSISTENT', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'refunded',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
      // Provide the total price field value.
      totalPrice: 100,
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);

    // Wait until the asynchronous operation resolves.
    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_LEDGER_INCONSISTENT',
      // Provide the status field value.
      status: 409,
    });
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('refunded with pending ledger is REFUND_LEDGER_INCONSISTENT', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'refunded',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
      // Provide the total price field value.
      totalPrice: 100,
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
    });

    // Wait until the asynchronous operation resolves.
    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_LEDGER_INCONSISTENT',
      // Provide the status field value.
      status: 409,
    });
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('locked refunded without succeeded ledger is REFUND_LEDGER_INCONSISTENT', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
      // Provide the total price field value.
      totalPrice: 100,
    });
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'refunded',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
      // Provide the total price field value.
      totalPrice: 100,
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);

    // Wait until the asynchronous operation resolves.
    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_LEDGER_INCONSISTENT',
      // Provide the status field value.
      status: 409,
    });
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('pending Stripe refund does not change reservation to refunded', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 100,
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);
    // Call refundOpSql.insertRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.insertRefundOperation.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    });
    // Call createRefund.mockResolvedValue to perform this step.
    createRefund.mockResolvedValue({
      // Provide the id field value.
      id: 're_pending',
      // Provide the status field value.
      status: 'pending',
      // Provide the payment intent field value.
      payment_intent: 'pi_1',
    });
    // Call refundOpSql.updateRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.updateRefundOperation.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
      // Provide the stripe refund id field value.
      stripeRefundId: 're_pending',
      // Provide the reservation id field value.
      reservationId: 1,
    });

    // Create the result constant.
    const result = await requestReservationRefund(req, { reservationId: 1 });
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.updateRefundOperation).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      10,
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the status field value.
        status: 'pending',
        // Provide the stripe refund id field value.
        stripeRefundId: 're_pending',
        // Provide the stripe raw status field value.
        stripeRawStatus: 'pending',
        // Provide the failure code field value.
        failureCode: null,
        // Provide the failure message field value.
        failureMessage: null,
      })
    );
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ newStatus: 'refunded' })
    );
  });

  // Define a single test case and its expectations.
  test('pending persist no-op on succeeded ledger does not report pending', async () => {
    // Create the succeeded op constant.
    const succeededOp = {
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'succeeded',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the stripe refund id field value.
      stripeRefundId: 're_1',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    };
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 100,
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });
    // Contribute this line to the enclosing declaration or statement.
    refundOpSql.findActiveByReservationId
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce(null)
      // Call .mockResolvedValue to perform this step.
      .mockResolvedValue(succeededOp);
    // Call refundOpSql.insertRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.insertRefundOperation.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    });
    // Call createRefund.mockResolvedValue to perform this step.
    createRefund.mockResolvedValue({
      // Provide the id field value.
      id: 're_1',
      // Provide the status field value.
      status: 'pending',
      // Provide the payment intent field value.
      payment_intent: 'pi_1',
    });
    // Call refundOpSql.updateRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.updateRefundOperation.mockResolvedValue(null);
    // Call refundOpSql.findById.mockResolvedValue to perform this step.
    refundOpSql.findById.mockResolvedValue(succeededOp);

    // Create the result constant.
    const result = await requestReservationRefund(req, { reservationId: 1 });

    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(result.status).not.toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(changeStatus).not.toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ newStatus: 'refunded' })
    );
  });

  // Define a single test case and its expectations.
  test('rejects picked_up status', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'picked_up',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
      // Provide the total price field value.
      totalPrice: 100,
    });
    // Call reservationSql.findByIdForUpdate.mockResolvedValue to perform this step.
    reservationSql.findByIdForUpdate.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'picked_up',
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
      // Provide the total price field value.
      totalPrice: 100,
    });

    // Wait until the asynchronous operation resolves.
    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_NOT_ALLOWED',
    });
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('rejects when no payment intent', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 100,
    });
    // Call resolvePaymentIntentForReservation.mockRejectedValue to perform this step.
    resolvePaymentIntentForReservation.mockRejectedValue(
      // Call Object.assign to perform this step.
      Object.assign(new Error('no pi'), {
        // Provide the code field value.
        code: 'REFUND_NO_PAYMENT_INTENT',
        // Provide the status field value.
        status: 422,
      })
    );

    // Wait until the asynchronous operation resolves.
    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_NO_PAYMENT_INTENT',
    });
  });

  // Define a single test case and its expectations.
  test('confirmed failed refund then retry creates with attempt2, not :full', async () => {
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 100,
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue(null);
    // Call refundOpSql.findLatestByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findLatestByReservationId.mockResolvedValue({
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'failed',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the stripe refund id field value.
      stripeRefundId: 're_old',
      // Provide the stripe raw status field value.
      stripeRawStatus: 'failed',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    });
    // Call retrieveRefund.mockResolvedValue to perform this step.
    retrieveRefund.mockResolvedValue({ id: 're_old', status: 'failed' });
    // Call refundOpSql.insertRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.insertRefundOperation.mockResolvedValue({
      // Provide the id field value.
      id: 11,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full:attempt2',
    });
    // Call createRefund.mockResolvedValue to perform this step.
    createRefund.mockResolvedValue({
      // Provide the id field value.
      id: 're_2',
      // Provide the status field value.
      status: 'succeeded',
      // Provide the payment intent field value.
      payment_intent: 'pi_1',
      // Provide the amount field value.
      amount: 10000,
    });
    // Call refundOpSql.updateRefundOperation.mockImplementation to perform this step.
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the status field value.
      status: patch.status || 'pending',
      // Provide the stripe refund id field value.
      stripeRefundId: patch.stripeRefundId || 're_2',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full:attempt2',
    }));

    // Create the result constant.
    const result = await requestReservationRefund(req, { reservationId: 1 });

    // Assert that the value matches the intended expectation.
    expect(retrieveRefund).toHaveBeenCalledWith('re_old');
    // Assert that the value matches the intended expectation.
    expect(createRefund).toHaveBeenCalledTimes(1);
    // Assert that the value matches the intended expectation.
    expect(createRefund).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:reservation:1:full:attempt2',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:reservation:1:full',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
  });

  // Define a single test case and its expectations.
  test('timeout with no refund id leaves pending; second call retries same key', async () => {
    // Create the pending no id constant.
    const pendingNoId = {
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
      // Provide the stripe refund id field value.
      stripeRefundId: null,
    };
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 100,
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });
    // Contribute this line to the enclosing declaration or statement.
    refundOpSql.findActiveByReservationId
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce(null)
      // Call .mockResolvedValue to perform this step.
      .mockResolvedValue(pendingNoId);
    // Call refundOpSql.insertRefundOperation.mockResolvedValue to perform this step.
    refundOpSql.insertRefundOperation.mockResolvedValue(pendingNoId);
    // Create the timeout err constant.
    const timeoutErr = new Error('connect timeout');
    // Update timeoutErr.type with the right-hand side value.
    timeoutErr.type = 'StripeConnectionError';
    // Update timeoutErr.code with the right-hand side value.
    timeoutErr.code = 'ETIMEDOUT';
    // Reference the identifier used by the enclosing expression.
    createRefund
      // Call .mockRejectedValueOnce to perform this step.
      .mockRejectedValueOnce(timeoutErr)
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce({
        // Provide the id field value.
        id: 're_1',
        // Provide the status field value.
        status: 'succeeded',
        // Provide the payment intent field value.
        payment_intent: 'pi_1',
        // Provide the amount field value.
        amount: 10000,
      });
    // Call refundOpSql.updateRefundOperation.mockImplementation to perform this step.
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the status field value.
      status: patch.status || 'pending',
      // Provide the stripe refund id field value.
      stripeRefundId: patch.stripeRefundId || 're_1',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    }));

    // Wait until the asynchronous operation resolves.
    await expect(requestReservationRefund(req, { reservationId: 1 })).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_INDETERMINATE',
      // Provide the status field value.
      status: 503,
    });
    // Assert that the value matches the intended expectation.
    expect(refundOpSql.updateRefundOperation).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(createRefund).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:reservation:1:full',
      })
    );

    // Create the result constant.
    const result = await requestReservationRefund(req, { reservationId: 1 });

    // Assert that the value matches the intended expectation.
    expect(createRefund).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(createRefund.mock.calls[1][0].idempotencyKey).toBe('refund:reservation:1:full');
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:reservation:1:full:attempt2',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
  });

  // Define a single test case and its expectations.
  test('timeout with existing stripeRefundId retrieves and applies; createRefund not called', async () => {
    // Create the pending with id constant.
    const pendingWithId = {
      // Provide the id field value.
      id: 10,
      // Provide the status field value.
      status: 'pending',
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the stripe refund id field value.
      stripeRefundId: 're_1',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    };
    // Call reservationRepository.findById.mockResolvedValue to perform this step.
    reservationRepository.findById.mockResolvedValue({
      // Provide the id field value.
      id: 1,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the total price field value.
      totalPrice: 100,
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_1',
    });
    // Call refundOpSql.findActiveByReservationId.mockResolvedValue to perform this step.
    refundOpSql.findActiveByReservationId.mockResolvedValue(pendingWithId);
    // Call retrieveRefund.mockResolvedValue to perform this step.
    retrieveRefund.mockResolvedValue({
      // Provide the id field value.
      id: 're_1',
      // Provide the status field value.
      status: 'succeeded',
      // Provide the payment intent field value.
      payment_intent: 'pi_1',
      // Provide the amount field value.
      amount: 10000,
    });
    // Call refundOpSql.updateRefundOperation.mockImplementation to perform this step.
    refundOpSql.updateRefundOperation.mockImplementation(async (id, patch) => ({
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the status field value.
      status: patch.status || 'succeeded',
      // Provide the stripe refund id field value.
      stripeRefundId: patch.stripeRefundId || 're_1',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:reservation:1:full',
    }));

    // Create the result constant.
    const result = await requestReservationRefund(req, { reservationId: 1 });

    // Assert that the value matches the intended expectation.
    expect(retrieveRefund).toHaveBeenCalledWith('re_1');
    // Assert that the value matches the intended expectation.
    expect(createRefund).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(result.status).toBe('succeeded');
  });
});
