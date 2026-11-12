// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp, withCsrf } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');

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
jest.mock('../../../src/services/admin/paymentAdminService', () => ({
  // Provide the get payment monitoring data field value.
  getPaymentMonitoringData: jest.fn(),
  // Provide the run payment reconciliation field value.
  runPaymentReconciliation: jest.fn(),
  // Provide the list payment refund queue field value.
  listPaymentRefundQueue: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/admin/paymentAdminService' module as paymentAdminService.
const paymentAdminService = require('../../../src/services/admin/paymentAdminService');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Call jest.setTimeout to perform this step.
jest.setTimeout(20000);

// Create the mock monitoring data constant.
const mockMonitoringData = {
  // Provide the events field value.
  events: [{ id: 1, event_type: 'checkout.session.completed' }],
  // Provide the failures field value.
  failures: [{ id: 2, reason: 'overlap_after_payment' }],
  // Provide the unresolved failure count field value.
  unresolvedFailureCount: 1,
};

// Declare a test suite grouping related cases.
describe('GET /api/admin/payments', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call paymentAdminService.getPaymentMonitoringData.mockResolvedValue to perform this step.
    paymentAdminService.getPaymentMonitoringData.mockResolvedValue(mockMonitoringData);
  });

  // Define a single test case and its expectations.
  test('returns payment monitoring data for admin', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/payments').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: mockMonitoringData,
    });
  });
});

// Declare a test suite grouping related cases.
describe('POST /api/admin/payments/reconcile', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call paymentAdminService.runPaymentReconciliation.mockResolvedValue to perform this step.
    paymentAdminService.runPaymentReconciliation.mockResolvedValue({
      // Provide the stdout field value.
      stdout: 'done',
      // Provide the stderr field value.
      stderr: '',
    });
  });

  // Define a single test case and its expectations.
  test('runs reconciliation', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await withCsrf(agent, agent.post('/api/admin/payments/reconcile'))
      // Call .send to perform this step.
      .send({ dryRun: true })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.data).toEqual({ ok: true, dryRun: true });
    // Assert that the value matches the intended expectation.
    expect(paymentAdminService.runPaymentReconciliation).toHaveBeenCalledWith({ dryRun: true });
  });
});

// Declare a test suite grouping related cases.
describe('GET /api/admin/payments/refund-queue', () => {
  // Create the queue data constant.
  const queueData = {
    // Provide the refundable field value.
    refundable: [{ id: '512', status: 'confirmed', orderId: '88' }],
    // Provide the recent refunds field value.
    recentRefunds: [{ id: '400', status: 'refunded' }],
    // Provide the limit field value.
    limit: 50,
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call paymentAdminService.listPaymentRefundQueue.mockResolvedValue to perform this step.
    paymentAdminService.listPaymentRefundQueue.mockResolvedValue(queueData);
  });

  // Define a single test case and its expectations.
  test('returns refund queue for owner', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/payments/refund-queue?q=512').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: true,
      // Provide the data field value.
      data: queueData,
    });
    // Assert that the value matches the intended expectation.
    expect(paymentAdminService.listPaymentRefundQueue).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({ q: '512' })
    );
  });

  // Define a single test case and its expectations.
  test('returns 422 for invalid status', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/payments/refund-queue?status=nope').expect(422);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(paymentAdminService.listPaymentRefundQueue).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns 403 without can_refund_payments', async () => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['accountant'],
      // Provide the permissions field value.
      permissions: ['can_manage_payments_monitor', 'can_view_revenue'],
      // Provide the role details field value.
      roleDetails: [{ id: '4', slug: 'accountant', name: 'Accountant' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/payments/refund-queue').expect(403);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('FORBIDDEN');
    // Assert that the value matches the intended expectation.
    expect(paymentAdminService.listPaymentRefundQueue).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('returns 401 without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the response constant.
    const response = await request(app).get('/api/admin/payments/refund-queue').expect(401);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

// Declare a test suite grouping related cases.
describe('admin payments authorization', () => {
  // Define a single test case and its expectations.
  test('returns unauthorized without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/admin/payments').expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
