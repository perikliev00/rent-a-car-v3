const request = require('supertest');
const bcrypt = require('bcrypt');
const { createApiTestApp, initTestAgent, withCsrf } = require('../../helpers/apiTestApp');
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
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const userSql = require('../../../src/services/sql/userSqlService');
const reservationOpsDashboardService = require('../../../src/services/admin/reservationOpsDashboardService');
const reservationAdminService = require('../../../src/services/admin/reservationAdminService');
const checklistAdminService = require('../../../src/services/admin/checklistAdminService');
const rbacService = require('../../../src/services/rbac/rbacService');

const adminUser = {
  id: 1,
  email: 'admin@example.com',
  password: 'hashed-password',
  role: 'admin',
};

async function loginAsAdmin(app) {
  const agent = await initTestAgent(app);
  userSql.findUserByEmail.mockResolvedValue(adminUser);
  bcrypt.compare.mockResolvedValue(true);
  const loginRes = await withCsrf(agent, agent.post('/api/auth/login'))
    .send({ email: 'admin@example.com', password: 'Secret123' })
    .expect(200);
  agent.csrfToken = loginRes.body.data.csrfToken;
  return agent;
}

describe('Admin reservations / ops APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['owner'],
      permissions: ALL_PERMISSIONS,
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  test('GET /api/admin/reservations/ops-dashboard returns widgets', async () => {
    reservationOpsDashboardService.getOpsDashboard.mockResolvedValue({
      today: '2026-08-04',
      limit: 20,
      widgets: {
        todaysPickups: [{ id: '10', status: 'confirmed' }],
        todaysReturns: [],
        activeRentals: [],
        overdueReturns: [],
        manualReview: [],
        paidNotConfirmed: [],
        cancelled: [],
        failedPayments: [],
      },
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/reservations/ops-dashboard?limit=20').expect(200);

    expect(response.body.data.widgets.todaysPickups).toHaveLength(1);
    expect(reservationOpsDashboardService.getOpsDashboard).toHaveBeenCalledWith({ limit: 20 });
  });

  test('GET /api/admin/reservations/:id returns detail', async () => {
    reservationAdminService.getReservationDetail.mockResolvedValue({
      reservation: { id: '10', status: 'confirmed' },
      history: [],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/reservations/10').expect(200);

    expect(response.body.data.reservation.id).toBe('10');
  });

  test('GET /api/admin/reservations/:id returns 404 when missing', async () => {
    const err = new Error('not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    reservationAdminService.getReservationDetail.mockRejectedValue(err);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/reservations/999').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('POST /api/admin/reservations/:id/status changes status', async () => {
    reservationAdminService.changeReservationStatus.mockResolvedValue({
      reservation: { id: '10', status: 'car_prepared' },
      changed: true,
      oldStatus: 'confirmed',
      newStatus: 'car_prepared',
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/status'))
      .send({ status: 'car_prepared', reason: 'Ready at lot' })
      .expect(200);

    expect(response.body.data.changed).toBe(true);
    expect(response.body.data.newStatus).toBe('car_prepared');
    expect(reservationAdminService.changeReservationStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        reservationId: '10',
        status: 'car_prepared',
        reason: 'Ready at lot',
      })
    );
  });

  test('POST /api/admin/reservations/:id/status returns 422 on invalid transition', async () => {
    const err = new Error('Cannot go backwards');
    err.code = 'INVALID_STATUS_TRANSITION';
    reservationAdminService.changeReservationStatus.mockRejectedValue(err);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/status'))
      .send({ status: 'confirmed' })
      .expect(422);

    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('POST /api/admin/reservations/:id/status validates body', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/status'))
      .send({})
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/admin/reservations/:id/checklists returns checklists', async () => {
    checklistAdminService.getChecklists.mockResolvedValue({
      pickupChecklist: { id: 1, fuelLevel: 'full' },
      returnChecklist: null,
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/reservations/10/checklists').expect(200);
    expect(response.body.data.pickupChecklist.fuelLevel).toBe('full');
  });

  test('POST pickup-checklist creates checklist without files', async () => {
    checklistAdminService.submitPickupChecklist.mockResolvedValue({
      checklist: { id: 5, fuelLevel: 'full', mileage: 12000 },
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/pickup-checklist'))
      .field('fuelLevel', 'full')
      .field('mileage', '12000')
      .expect(201);

    expect(response.body.data.checklist.id).toBe(5);
    expect(checklistAdminService.submitPickupChecklist).toHaveBeenCalled();
  });

  test('POST return-checklist creates checklist', async () => {
    checklistAdminService.submitReturnChecklist.mockResolvedValue({
      checklist: { id: 6, fuelLevel: 'half', mileage: 12100 },
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/return-checklist'))
      .field('fuelLevel', 'half')
      .field('mileage', '12100')
      .field('lateReturn', 'false')
      .expect(201);

    expect(response.body.data.checklist.id).toBe(6);
  });

  test('GET /api/admin/reservations/:id/pdf/:kind streams PDF', async () => {
    checklistAdminService.downloadReservationPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 test'),
      filename: 'luxride-invoice-10.pdf',
      contentType: 'application/pdf',
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/reservations/10/pdf/invoice').expect(200);

    expect(response.headers['content-type']).toMatch(/application\/pdf/);
    expect(response.headers['content-disposition']).toContain('luxride-invoice-10.pdf');
  });

  test('GET pdf rejects invalid kind', async () => {
    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/reservations/10/pdf/not-a-kind').expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET cancellation-requests lists pending requests', async () => {
    checklistAdminService.listCancellationRequests.mockResolvedValue([
      { id: 1, reservationId: '10', status: 'pending' },
    ]);

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/reservations/cancellation-requests').expect(200);
    expect(response.body.data.requests).toHaveLength(1);
  });

  test('POST cancellation-requests/:id/review approves request', async () => {
    checklistAdminService.reviewCancellationRequest.mockResolvedValue({
      request: { id: 1, status: 'approved' },
      reservation: { id: '10', status: 'cancelled' },
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(
      agent,
      agent.post('/api/admin/reservations/cancellation-requests/1/review')
    )
      .send({ approve: true, adminNote: 'OK' })
      .expect(200);

    expect(response.body.data.request.status).toBe('approved');
    expect(checklistAdminService.reviewCancellationRequest).toHaveBeenCalledWith(
      expect.anything(),
      '1',
      expect.objectContaining({ approve: true, adminNote: 'OK' })
    );
  });

  test('returns 403 without can_view_reservations_ops', async () => {
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['driver'],
      permissions: ['can_view_orders'],
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await agent.get('/api/admin/reservations/ops-dashboard').expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  test('POST /:id/status returns 403 with view ops but without can_change_reservation_status', async () => {
    rbacService.getUserAccess.mockResolvedValue({
      roles: ['driver'],
      permissions: ['can_view_reservations_ops'],
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    const app = createApiTestApp();
    const agent = await loginAsAdmin(app);

    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/status'))
      .send({ status: 'car_prepared' })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(reservationAdminService.changeReservationStatus).not.toHaveBeenCalled();
  });

  test('returns 401 without session', async () => {
    const app = createApiTestApp();
    const response = await request(app).get('/api/admin/reservations/ops-dashboard').expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
