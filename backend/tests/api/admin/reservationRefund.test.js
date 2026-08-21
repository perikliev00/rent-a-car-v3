const request = require('supertest');
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

jest.mock('../../../src/services/reservationService', () => ({}));
jest.mock('../../../src/middleware/rateLimit', () => ({
  authLimiter: (_req, _res, next) => next(),
  loginLimiter: (_req, _res, next) => next(),
  signupLimiter: (_req, _res, next) => next(),
  adminLimiter: (_req, _res, next) => next(),
  adminUploadLimiter: (_req, _res, next) => next(),
  accountUploadLimiter: (_req, _res, next) => next(),
  checkoutLimiter: (_req, _res, next) => next(),
  bookingLimiter: (_req, _res, next) => next(),
  chatLimiter: (_req, _res, next) => next(),
  contactLimiter: (_req, _res, next) => next(),
}));
jest.mock('../../../src/services/rbac/rbacService', () =>
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
jest.mock('../../../src/services/sql/userSqlService', () => ({
  findUserByEmail: jest.fn(),
}));
jest.mock('../../../src/services/account/accountClaimService', () => ({
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
jest.mock('../../../src/services/admin/reservationOpsDashboardService', () => ({
  getOpsDashboard: jest.fn(),
}));
jest.mock('../../../src/services/admin/reservationAdminService', () => ({
  changeReservationStatus: jest.fn(),
  getReservationDetail: jest.fn(),
}));
jest.mock('../../../src/services/admin/checklistAdminService', () => ({
  submitPickupChecklist: jest.fn(),
  submitReturnChecklist: jest.fn(),
  getChecklists: jest.fn(),
  downloadReservationPdf: jest.fn(),
  listCancellationRequests: jest.fn(),
  reviewCancellationRequest: jest.fn(),
}));
jest.mock('../../../src/services/payment/refund/reservationRefundService', () => ({
  requestReservationRefund: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const reservationAdminService = require('../../../src/services/admin/reservationAdminService');
const {
  requestReservationRefund,
} = require('../../../src/services/payment/refund/reservationRefundService');
const rbacService = require('../../../src/services/rbac/rbacService');

describe('POST /api/admin/reservations/:id/refund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: ALL_PERMISSIONS,
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  test('returns succeeded refund payload', async () => {
    requestReservationRefund.mockResolvedValue({
      status: 'succeeded',
      refundOperation: { id: 1, status: 'succeeded' },
      reservation: { id: 5, status: 'refunded' },
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/refund'))
      .send({ reason: 'test' })
      .expect(200);

    expect(response.body.data.status).toBe('succeeded');
    expect(requestReservationRefund).toHaveBeenCalled();
  });

  test('maps REFUND_NO_PAYMENT_INTENT to 422', async () => {
    const err = new Error('no pi');
    err.code = 'REFUND_NO_PAYMENT_INTENT';
    err.status = 422;
    requestReservationRefund.mockRejectedValue(err);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/refund'))
      .send({})
      .expect(422);

    expect(response.body.error.code).toBe('REFUND_NO_PAYMENT_INTENT');
  });

  test('status-only refunded is rejected by admin service', async () => {
    const err = new Error('Use POST .../refund');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    reservationAdminService.changeReservationStatus.mockRejectedValue(err);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/status'))
      .send({ status: 'refunded' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects unauthenticated requests', async () => {
    const app = createApiTestApp();
    const response = await request(app).post('/api/admin/reservations/5/refund').send({});
    expect([401, 403]).toContain(response.status);
  });
});
