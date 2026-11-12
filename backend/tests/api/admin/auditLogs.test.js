// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp } = require('../../helpers/apiTestApp');
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
jest.mock('../../../src/services/admin/adminAuditService', () => ({
  // Provide the log admin action field value.
  logAdminAction: jest.fn().mockResolvedValue(undefined),
  // Provide the log system action field value.
  logSystemAction: jest.fn().mockResolvedValue(undefined),
  // Provide the list audit logs field value.
  listAuditLogs: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/services/admin/adminAuditService' module as adminAuditService.
const adminAuditService = require('../../../src/services/admin/adminAuditService');

// Declare a test suite grouping related cases.
describe('GET /api/admin/audit-logs', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call adminAuditService.listAuditLogs.mockResolvedValue to perform this step.
    adminAuditService.listAuditLogs.mockResolvedValue({
      // Provide the logs field value.
      logs: [
        {
          // Provide the id field value.
          id: 1,
          // Provide the created at field value.
          createdAt: '2026-07-29T12:00:00.000Z',
          // Provide the action field value.
          action: 'admin.created_car',
          // Provide the category field value.
          category: 'admin',
          // Provide the actor type field value.
          actorType: 'admin',
          // Provide the admin user field value.
          adminUser: { id: 1, email: 'admin@example.com' },
          // Provide the entity type field value.
          entityType: 'car',
          // Provide the entity id field value.
          entityId: '7',
          // Provide the metadata field value.
          metadata: { name: 'BMW' },
          // Provide the ip address field value.
          ipAddress: '127.0.0.1',
        },
      ],
      // Provide the pagination field value.
      pagination: { page: 1, limit: 50, total: 1 },
    });
  });

  // Define a single test case and its expectations.
  test('returns audit logs for admin', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the response constant.
    const response = await agent.get('/api/admin/audit-logs').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.logs).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(response.body.data.pagination.total).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(adminAuditService.listAuditLogs).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('passes filters to service', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Wait until the asynchronous operation resolves.
    await agent
      // Call .get to perform this step.
      .get('/api/admin/audit-logs')
      // Call .query to perform this step.
      .query({
        // Provide the page field value.
        page: 2,
        // Provide the limit field value.
        limit: 25,
        // Provide the actor type field value.
        actorType: 'customer',
        // Provide the action prefix field value.
        actionPrefix: 'customer',
        // Provide the entity type field value.
        entityType: 'reservation',
        // Provide the entity id field value.
        entityId: '42',
      })
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(adminAuditService.listAuditLogs).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the page field value.
        page: 2,
        // Provide the limit field value.
        limit: 25,
        // Provide the actor type field value.
        actorType: 'customer',
        // Provide the action prefix field value.
        actionPrefix: 'customer',
        // Provide the entity type field value.
        entityType: 'reservation',
        // Provide the entity id field value.
        entityId: '42',
      })
    );
  });

  // Define a single test case and its expectations.
  test('returns unauthorized without session', async () => {
    // Create the app constant.
    const app = createApiTestApp();

    // Create the response constant.
    const response = await request(app).get('/api/admin/audit-logs').expect(401);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
