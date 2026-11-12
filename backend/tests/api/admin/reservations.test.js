// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
// Destructure object properties into local variables.
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

// Call jest.mock to perform this step.
jest.mock('../../../src/services/reservationService', () => ({}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/rateLimit', () =>
  // Call require to perform this step.
  require('../../helpers/rateLimitPassthrough')
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/rbac/rbacService', () =>
  // Call require to perform this step.
  require('../../helpers/rbacTestAccess').createOwnerRbacMock()
);
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/userSqlService', () => ({
  // Provide the find user by email field value.
  findUserByEmail: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/account/accountClaimService', () => ({
  // Provide the claim reservations for user field value.
  claimReservationsForUser: jest.fn().mockResolvedValue({ reservations: 0, orders: 0 }),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/reservationOpsDashboardService', () => ({
  // Provide the get ops dashboard field value.
  getOpsDashboard: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/reservationAdminService', () => ({
  // Provide the change reservation status field value.
  changeReservationStatus: jest.fn(),
  // Provide the get reservation detail field value.
  getReservationDetail: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/checklistAdminService', () => ({
  // Provide the submit pickup checklist field value.
  submitPickupChecklist: jest.fn(),
  // Provide the submit return checklist field value.
  submitReturnChecklist: jest.fn(),
  // Provide the get checklists field value.
  getChecklists: jest.fn(),
  // Provide the download reservation pdf field value.
  downloadReservationPdf: jest.fn(),
  // Provide the list cancellation requests field value.
  listCancellationRequests: jest.fn(),
  // Provide the review cancellation request field value.
  reviewCancellationRequest: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/admin/reservationOpsDashboardService' module as reservationOpsDashboardService.
const reservationOpsDashboardService = require('../../../src/services/admin/reservationOpsDashboardService');
// Require the '../../../src/services/admin/reservationAdminService' module as reservationAdminService.
const reservationAdminService = require('../../../src/services/admin/reservationAdminService');
// Require the '../../../src/services/admin/checklistAdminService' module as checklistAdminService.
const checklistAdminService = require('../../../src/services/admin/checklistAdminService');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Declare a test suite grouping related cases.
describe('Admin reservations / ops APIs', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: ALL_PERMISSIONS,
      // Provide the role details field value.
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/reservations/ops-dashboard returns widgets', async () => {
    // Call reservationOpsDashboardService.getOpsDashboard.mockResolvedValue to perform this step.
    reservationOpsDashboardService.getOpsDashboard.mockResolvedValue({
      // Provide the today field value.
      today: '2026-08-04',
      // Provide the limit field value.
      limit: 20,
      // Provide the widgets field value.
      widgets: {
        // Provide the todays pickups field value.
        todaysPickups: [{ id: '10', status: 'confirmed' }],
        // Provide the todays returns field value.
        todaysReturns: [],
        // Provide the active rentals field value.
        activeRentals: [],
        // Provide the overdue returns field value.
        overdueReturns: [],
        // Provide the manual review field value.
        manualReview: [],
        // Provide the paid not confirmed field value.
        paidNotConfirmed: [],
        // Provide the cancelled field value.
        cancelled: [],
        // Provide the failed payments field value.
        failedPayments: [],
      },
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/reservations/ops-dashboard?limit=20').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.widgets.todaysPickups).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(reservationOpsDashboardService.getOpsDashboard).toHaveBeenCalledWith({ limit: 20 });
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/reservations/:id returns detail', async () => {
    // Call reservationAdminService.getReservationDetail.mockResolvedValue to perform this step.
    reservationAdminService.getReservationDetail.mockResolvedValue({
      // Provide the reservation field value.
      reservation: { id: '10', status: 'confirmed' },
      // Provide the history field value.
      history: [],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/reservations/10').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.reservation.id).toBe('10');
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/reservations/:id returns 404 when missing', async () => {
    // Create the err constant.
    const err = new Error('not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Call reservationAdminService.getReservationDetail.mockRejectedValue to perform this step.
    reservationAdminService.getReservationDetail.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/reservations/999').expect(404);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/reservations/:id/status changes status', async () => {
    // Call reservationAdminService.changeReservationStatus.mockResolvedValue to perform this step.
    reservationAdminService.changeReservationStatus.mockResolvedValue({
      // Provide the reservation field value.
      reservation: { id: '10', status: 'car_prepared' },
      // Provide the changed field value.
      changed: true,
      // Provide the old status field value.
      oldStatus: 'confirmed',
      // Provide the new status field value.
      newStatus: 'car_prepared',
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/status'))
      // Call .send to perform this step.
      .send({ status: 'car_prepared', reason: 'Ready at lot' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.changed).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.newStatus).toBe('car_prepared');
    // Assert that the value matches the intended expectation.
    expect(reservationAdminService.changeReservationStatus).toHaveBeenCalledWith(
      // Call expect.anything to perform this step.
      expect.anything(),
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the reservation id field value.
        reservationId: '10',
        // Provide the status field value.
        status: 'car_prepared',
        // Provide the reason field value.
        reason: 'Ready at lot',
      })
    );
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/reservations/:id/status returns 422 on invalid transition', async () => {
    // Create the err constant.
    const err = new Error('Cannot go backwards');
    // Update err.code with the right-hand side value.
    err.code = 'INVALID_STATUS_TRANSITION';
    // Call reservationAdminService.changeReservationStatus.mockRejectedValue to perform this step.
    reservationAdminService.changeReservationStatus.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/status'))
      // Call .send to perform this step.
      .send({ status: 'confirmed' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  // Define a single test case and its expectations.
  test('POST /api/admin/reservations/:id/status validates body', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/status'))
      // Call .send to perform this step.
      .send({})
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/reservations/:id/checklists returns checklists', async () => {
    // Call checklistAdminService.getChecklists.mockResolvedValue to perform this step.
    checklistAdminService.getChecklists.mockResolvedValue({
      // Provide the pickup checklist field value.
      pickupChecklist: { id: 1, fuelLevel: 'full' },
      // Provide the return checklist field value.
      returnChecklist: null,
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/reservations/10/checklists').expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.pickupChecklist.fuelLevel).toBe('full');
  });

  // Define a single test case and its expectations.
  test('POST pickup-checklist creates checklist without files', async () => {
    // Call checklistAdminService.submitPickupChecklist.mockResolvedValue to perform this step.
    checklistAdminService.submitPickupChecklist.mockResolvedValue({
      // Provide the checklist field value.
      checklist: { id: 5, fuelLevel: 'full', mileage: 12000 },
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/pickup-checklist'))
      // Call .field to perform this step.
      .field('fuelLevel', 'full')
      // Call .field to perform this step.
      .field('mileage', '12000')
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.checklist.id).toBe(5);
    // Assert that the value matches the intended expectation.
    expect(checklistAdminService.submitPickupChecklist).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('POST return-checklist creates checklist', async () => {
    // Call checklistAdminService.submitReturnChecklist.mockResolvedValue to perform this step.
    checklistAdminService.submitReturnChecklist.mockResolvedValue({
      // Provide the checklist field value.
      checklist: { id: 6, fuelLevel: 'half', mileage: 12100 },
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/return-checklist'))
      // Call .field to perform this step.
      .field('fuelLevel', 'half')
      // Call .field to perform this step.
      .field('mileage', '12100')
      // Call .field to perform this step.
      .field('lateReturn', 'false')
      // Call .expect to perform this step.
      .expect(201);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.checklist.id).toBe(6);
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/reservations/:id/pdf/:kind streams PDF', async () => {
    // Call checklistAdminService.downloadReservationPdf.mockResolvedValue to perform this step.
    checklistAdminService.downloadReservationPdf.mockResolvedValue({
      // Provide the buffer field value.
      buffer: Buffer.from('%PDF-1.4 test'),
      // Provide the filename field value.
      filename: 'luxride-invoice-10.pdf',
      // Provide the content type field value.
      contentType: 'application/pdf',
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/reservations/10/pdf/invoice').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.headers['content-type']).toMatch(/application\/pdf/);
    // Assert that the value matches the intended expectation.
    expect(response.headers['content-disposition']).toContain('luxride-invoice-10.pdf');
  });

  // Define a single test case and its expectations.
  test('GET pdf rejects invalid kind', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/reservations/10/pdf/not-a-kind').expect(422);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('GET cancellation-requests lists pending requests', async () => {
    // Call checklistAdminService.listCancellationRequests.mockResolvedValue to perform this step.
    checklistAdminService.listCancellationRequests.mockResolvedValue([
      // Contribute this line to the enclosing declaration or statement.
      { id: 1, reservationId: '10', status: 'pending' },
    ]);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/reservations/cancellation-requests').expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.requests).toHaveLength(1);
  });

  // Define a single test case and its expectations.
  test('POST cancellation-requests/:id/review approves request', async () => {
    // Call checklistAdminService.reviewCancellationRequest.mockResolvedValue to perform this step.
    checklistAdminService.reviewCancellationRequest.mockResolvedValue({
      // Provide the request field value.
      request: { id: 1, status: 'approved' },
      // Provide the reservation field value.
      reservation: { id: '10', status: 'cancelled' },
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.post to perform this step.
      agent.post('/api/admin/reservations/cancellation-requests/1/review')
    )
      // Call .send to perform this step.
      .send({ approve: true, adminNote: 'OK' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.request.status).toBe('approved');
    // Assert that the value matches the intended expectation.
    expect(checklistAdminService.reviewCancellationRequest).toHaveBeenCalledWith(
      // Call expect.anything to perform this step.
      expect.anything(),
      // Supply the literal value used by the enclosing expression.
      '1',
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ approve: true, adminNote: 'OK' })
    );
  });

  // Define a single test case and its expectations.
  test('returns 403 without can_view_reservations_ops', async () => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_orders'],
      // Provide the role details field value.
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/reservations/ops-dashboard').expect(403);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  // Define a single test case and its expectations.
  test('POST /:id/status returns 403 with view ops but without can_change_reservation_status', async () => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_reservations_ops'],
      // Provide the role details field value.
      roleDetails: [{ id: '3', slug: 'driver', name: 'Driver' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/10/status'))
      // Call .send to perform this step.
      .send({ status: 'car_prepared' })
      // Call .expect to perform this step.
      .expect(403);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
    // Assert that the value matches the intended expectation.
    expect(reservationAdminService.changeReservationStatus).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns 401 without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the response constant.
    const response = await request(app).get('/api/admin/reservations/ops-dashboard').expect(401);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
