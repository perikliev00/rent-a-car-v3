jest.mock('../../../src/services/storage/privateStorageService', () => ({}));
jest.mock('../../../src/middleware/fileUpload/uploadUtils', () => ({
  removeUploadedFile: jest.fn(),
}));
jest.mock('../../../src/services/sql/pickupChecklistSqlService', () => ({
  upsert: jest.fn(),
  findByReservationId: jest.fn(),
}));
jest.mock('../../../src/services/sql/returnChecklistSqlService', () => ({
  upsert: jest.fn(),
  findByReservationId: jest.fn(),
}));
jest.mock('../../../src/services/sql/cancellationRequestSqlService', () => ({
  findById: jest.fn(),
  review: jest.fn(),
  listPending: jest.fn(),
}));
jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../src/services/sql/carDamageReportSqlService', () => ({
  insert: jest.fn(),
}));
jest.mock('../../../src/services/reservation/reservationStatusService', () => ({
  changeStatus: jest.fn(),
}));
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/pdf/pdfDocumentService', () => ({
  generatePdf: jest.fn(),
}));
jest.mock('../../../src/services/payment/refund/reservationRefundService', () => ({
  requestReservationRefund: jest.fn(),
}));

const cancellationSql = require('../../../src/services/sql/cancellationRequestSqlService');
const reservationSql = require('../../../src/services/sql/reservationSqlService');
const { changeStatus } = require('../../../src/services/reservation/reservationStatusService');
const {
  requestReservationRefund,
} = require('../../../src/services/payment/refund/reservationRefundService');
const {
  reviewCancellationRequest,
} = require('../../../src/services/admin/checklistAdminService');

function reqWithPermissions(permissions = []) {
  return {
    session: {
      user: {
        id: 9,
        roles: [],
        permissions,
      },
    },
  };
}

describe('reviewCancellationRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cancellationSql.findById.mockResolvedValue({
      id: 5,
      reservationId: 1,
      status: 'pending',
    });
    cancellationSql.review.mockImplementation(async ({ status }) => ({
      id: 5,
      reservationId: 1,
      status,
    }));
  });

  test('refundable reservation + approve refunds instead of cancelling', async () => {
    const req = reqWithPermissions(['can_refund_payments']);
    reservationSql.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      stripePaymentIntentId: 'pi_1',
    });
    requestReservationRefund.mockResolvedValue({
      status: 'succeeded',
      reservation: { id: 1, status: 'refunded' },
      refundOperation: { id: 10, status: 'succeeded' },
    });

    const result = await reviewCancellationRequest(req, 5, {
      approve: true,
      adminNote: 'ok',
    });

    expect(requestReservationRefund).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ reservationId: 1 })
    );
    expect(changeStatus).not.toHaveBeenCalled();
    expect(cancellationSql.review).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' })
    );
    expect(result.reservation.status).toBe('refunded');
  });

  test('refundable approve without can_refund_payments is forbidden', async () => {
    const req = reqWithPermissions(['can_cancel_orders']);
    reservationSql.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      stripePaymentIntentId: 'pi_1',
    });

    await expect(reviewCancellationRequest(req, 5, { approve: true })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });

    expect(requestReservationRefund).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalled();
    expect(cancellationSql.review).not.toHaveBeenCalled();
  });

  test('unpaid / no PI approve cancels as today', async () => {
    const req = reqWithPermissions(['can_refund_payments']);
    reservationSql.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
    });
    requestReservationRefund.mockRejectedValue(
      Object.assign(new Error('no pi'), {
        code: 'REFUND_NO_PAYMENT_INTENT',
        status: 422,
      })
    );
    changeStatus.mockResolvedValue({
      reservation: { id: 1, status: 'cancelled' },
      changed: true,
    });

    const result = await reviewCancellationRequest(req, 5, { approve: true });

    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'cancelled' })
    );
    expect(cancellationSql.review).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' })
    );
    expect(result.reservation.status).toBe('cancelled');
  });

  test('non-refundable approve without refund permission cancels only', async () => {
    const req = reqWithPermissions(['can_cancel_orders']);
    reservationSql.findById.mockResolvedValue({
      id: 1,
      status: 'picked_up',
    });
    changeStatus.mockResolvedValue({
      reservation: { id: 1, status: 'cancelled' },
      changed: true,
    });

    const result = await reviewCancellationRequest(req, 5, { approve: true });

    expect(requestReservationRefund).not.toHaveBeenCalled();
    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: 'cancelled' })
    );
    expect(cancellationSql.review).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' })
    );
    expect(result.reservation.status).toBe('cancelled');
  });

  test('reject without refund permission does not refund or cancel', async () => {
    const req = reqWithPermissions(['can_cancel_orders']);
    reservationSql.findById.mockResolvedValue({
      id: 1,
      status: 'confirmed',
    });

    const result = await reviewCancellationRequest(req, 5, { approve: false });

    expect(requestReservationRefund).not.toHaveBeenCalled();
    expect(changeStatus).not.toHaveBeenCalled();
    expect(cancellationSql.review).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'rejected' })
    );
    expect(result.cancellationRequest.status).toBe('rejected');
  });
});
