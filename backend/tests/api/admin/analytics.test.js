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
jest.mock('../../../src/modules/analytics/analytics.service', () => ({
  // Provide the get overview field value.
  getOverview: jest.fn(),
  // Provide the get revenue by car field value.
  getRevenueByCar: jest.fn(),
  // Provide the get revenue by location field value.
  getRevenueByLocation: jest.fn(),
  // Provide the get utilization field value.
  getUtilization: jest.fn(),
  // Provide the get cars performance field value.
  getCarsPerformance: jest.fn(),
  // Provide the get car performance field value.
  getCarPerformance: jest.fn(),
  // Provide the export csv field value.
  exportCsv: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('bcrypt', () => ({
  // Provide the compare field value.
  compare: jest.fn(),
  // Provide the hash field value.
  hash: jest.fn(),
}));

// Require the '../../../src/modules/analytics/analytics.service' module as analyticsService.
const analyticsService = require('../../../src/modules/analytics/analytics.service');
// Require the '../../../src/services/rbac/rbacService' module as rbacService.
const rbacService = require('../../../src/services/rbac/rbacService');

// Declare a test suite grouping related cases.
describe('Admin analytics APIs', () => {
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
  test('GET /api/admin/analytics/overview returns KPIs', async () => {
    // Call analyticsService.getOverview.mockResolvedValue to perform this step.
    analyticsService.getOverview.mockResolvedValue({
      // Provide the from field value.
      from: '2026-07-01',
      // Provide the to field value.
      to: '2026-07-31',
      // Provide the period days field value.
      periodDays: 31,
      // Provide the kpis field value.
      kpis: { monthlyRevenue: 1000, weeklyBookings: 5 },
      // Provide the revenue series field value.
      revenueSeries: [],
      // Provide the bookings series field value.
      bookingsSeries: [],
      // Provide the most rented cars field value.
      mostRentedCars: [],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the res constant.
    const res = await agent
      // Call .get to perform this step.
      .get('/api/admin/analytics/overview?from=2026-07-01&to=2026-07-31')
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(res.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(res.body.data.kpis.monthlyRevenue).toBe(1000);
    // Assert that the value matches the intended expectation.
    expect(analyticsService.getOverview).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/analytics/overview rejects missing dates', async () => {
    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Wait until the asynchronous operation resolves.
    await agent.get('/api/admin/analytics/overview').expect(422);
  });

  // Define a single test case and its expectations.
  test('GET /api/admin/analytics/cars/:carId returns performance', async () => {
    // Call analyticsService.getCarPerformance.mockResolvedValue to perform this step.
    analyticsService.getCarPerformance.mockResolvedValue({
      // Provide the from field value.
      from: '2026-07-01',
      // Provide the to field value.
      to: '2026-07-31',
      // Provide the period days field value.
      periodDays: 31,
      // Provide the car field value.
      car: { carId: '1', revenue: 500, profitability: 400 },
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);

    // Create the res constant.
    const res = await agent
      // Call .get to perform this step.
      .get('/api/admin/analytics/cars/1?from=2026-07-01&to=2026-07-31')
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(res.body.data.car.revenue).toBe(500);
  });

  // Define a single test case and its expectations.
  test('forbids analytics without finance permissions', async () => {
    // Call rbacService.getUserAccess.mockResolvedValue to perform this step.
    rbacService.getUserAccess.mockResolvedValue({
      // Provide the roles field value.
      roles: ['driver'],
      // Provide the permissions field value.
      permissions: ['can_view_reservations_ops'],
      // Provide the role details field value.
      roleDetails: [{ id: '2', slug: 'driver', name: 'Driver' }],
    });

    // Create the app constant.
    const app = createApiTestApp();
    // Create the agent constant.
    const agent = await loginAsAdmin(app);
    // Wait until the asynchronous operation resolves.
    await agent
      // Call .get to perform this step.
      .get('/api/admin/analytics/overview?from=2026-07-01&to=2026-07-31')
      // Call .expect to perform this step.
      .expect(403);
  });
});
