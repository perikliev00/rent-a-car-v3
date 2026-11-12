// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createApiTestApp } = require('../../helpers/apiTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin } = require('../../helpers/apiAdminLogin');
// Destructure object properties into local variables.
const { ALL_PERMISSIONS } = require('../../helpers/rbacTestAccess');

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
jest.mock('../../../src/modules/notifications/notifications.service', () => ({
  // Provide the list for admin field value.
  listForAdmin: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/modules/notifications/notifications.service' module as notificationsService.
const notificationsService = require('../../../src/modules/notifications/notifications.service');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Declare a test suite grouping related cases.
describe('Admin notifications API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: [...ALL_PERMISSIONS, 'can_manage_notifications'],
      // Provide the role details field value.
      roleDetails: [{ id: '1', slug: 'owner', name: 'Owner' }],
    });
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/notifications returns rows', async () => {
    // Call notificationsService.listForAdmin.mockResolvedValue to perform this step.
    notificationsService.listForAdmin.mockResolvedValue({
      // Provide the rows field value.
      rows: [{ id: '1', type: 'pickup_reminder', status: 'pending' }],
      // Provide the total field value.
      total: 1,
      // Provide the limit field value.
      limit: 50,
      // Provide the offset field value.
      offset: 0,
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Create the res constant.
    const res = await agent.get('/api/admin/notifications').expect(200);
    // Assert that the value matches the intended expectation.
    expect(res.body.data.total).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(res.body.data.rows[0].type).toBe('pickup_reminder');
  });
});
