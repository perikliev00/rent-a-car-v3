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
jest.mock('../../../src/services/payment/refund/reservationRefundService', () => ({
  // Provide the request reservation refund field value.
  requestReservationRefund: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/admin/reservationAdminService' module as reservationAdminService.
const reservationAdminService = require('../../../src/services/admin/reservationAdminService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  requestReservationRefund,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/payment/refund/reservationRefundService');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Declare a test suite grouping related cases.
describe('POST /api/admin/reservations/:id/refund', () => {
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
  test('returns succeeded refund payload', async () => {
    // Call requestReservationRefund.mockResolvedValue to perform this step.
    requestReservationRefund.mockResolvedValue({
      // Provide the status field value.
      status: 'succeeded',
      // Provide the refund operation field value.
      refundOperation: { id: 1, status: 'succeeded' },
      // Provide the reservation field value.
      reservation: { id: 5, status: 'refunded' },
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/refund'))
      // Call .send to perform this step.
      .send({ reason: 'test' })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(requestReservationRefund).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('maps REFUND_NO_PAYMENT_INTENT to 422', async () => {
    // Create the err constant.
    const err = new Error('no pi');
    // Update err.code with the right-hand side value.
    err.code = 'REFUND_NO_PAYMENT_INTENT';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Call requestReservationRefund.mockRejectedValue to perform this step.
    requestReservationRefund.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/refund'))
      // Call .send to perform this step.
      .send({})
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('REFUND_NO_PAYMENT_INTENT');
  });

  // Define a single test case and its expectations.
  test('maps REFUND_FAILED to 502', async () => {
    // Create the err constant.
    const err = new Error('Stripe refund failed');
    // Update err.code with the right-hand side value.
    err.code = 'REFUND_FAILED';
    // Update err.status with the right-hand side value.
    err.status = 502;
    // Call requestReservationRefund.mockRejectedValue to perform this step.
    requestReservationRefund.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/refund'))
      // Call .send to perform this step.
      .send({})
      // Call .expect to perform this step.
      .expect(502);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('REFUND_FAILED');
  });

  // Define a single test case and its expectations.
  test('maps REFUND_INDETERMINATE to 503', async () => {
    // Create the err constant.
    const err = new Error('Stripe refund result is indeterminate');
    // Update err.code with the right-hand side value.
    err.code = 'REFUND_INDETERMINATE';
    // Update err.status with the right-hand side value.
    err.status = 503;
    // Call requestReservationRefund.mockRejectedValue to perform this step.
    requestReservationRefund.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/refund'))
      // Call .send to perform this step.
      .send({})
      // Call .expect to perform this step.
      .expect(503);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('REFUND_INDETERMINATE');
  });

  // Define a single test case and its expectations.
  test('maps REFUND_LEDGER_INCONSISTENT to 409', async () => {
    // Create the err constant.
    const err = new Error(
      // Apply the TypeScript type assertion for this value.
      'Reservation is marked refunded but has no succeeded refund ledger row. Do not treat this as a Stripe refund.'
    );
    // Update err.code with the right-hand side value.
    err.code = 'REFUND_LEDGER_INCONSISTENT';
    // Update err.status with the right-hand side value.
    err.status = 409;
    // Call requestReservationRefund.mockRejectedValue to perform this step.
    requestReservationRefund.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/refund'))
      // Call .send to perform this step.
      .send({})
      // Call .expect to perform this step.
      .expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('REFUND_LEDGER_INCONSISTENT');
  });

  // Define a single test case and its expectations.
  test('status-only refunded is rejected by admin service', async () => {
    // Create the err constant.
    const err = new Error('Use POST .../refund');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Call reservationAdminService.changeReservationStatus.mockRejectedValue to perform this step.
    reservationAdminService.changeReservationStatus.mockRejectedValue(err);

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/reservations/5/status'))
      // Call .send to perform this step.
      .send({ status: 'refunded' })
      // Call .expect to perform this step.
      .expect(422);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Define a single test case and its expectations.
  test('rejects unauthenticated requests', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the response constant.
    const response = await request(app).post('/api/admin/reservations/5/refund').send({});
    // Assert that the value matches the intended expectation.
    expect([401, 403]).toContain(response.status);
  });
});
